package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"pizza-backend/internal/auth"
	"pizza-backend/internal/repo"
)

type AdminDeps struct {
	Admins   *repo.Admins
	Orders   *repo.Orders
	Settings *repo.Settings
	Promos   *repo.Promos
	Audit    *repo.Audit
	Secret   []byte
}

// clientIP extracts the real client IP, honouring the proxy's X-Forwarded-For.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if i := strings.IndexByte(xff, ','); i > 0 {
			return strings.TrimSpace(xff[:i])
		}
		return strings.TrimSpace(xff)
	}
	return r.RemoteAddr
}

// recordAudit writes a best-effort audit entry for the authenticated caller.
// Never blocks the request on failure.
func recordAudit(d *AdminDeps, r *http.Request, action, target string, details map[string]any) {
	if d.Audit == nil {
		return
	}
	e := repo.AuditEntry{Action: action, Target: target, IP: clientIP(r)}
	if c := auth.FromContext(r.Context()); c != nil {
		e.AdminID, e.AdminLogin, e.AdminName = c.AdminID, c.Login, c.Name
	}
	if details != nil {
		if b, err := json.Marshal(details); err == nil {
			e.Details = b
		}
	}
	if err := d.Audit.Record(r.Context(), e); err != nil {
		log.Printf("audit record: %v", err)
	}
}

func AdminLogin(d *AdminDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Login    string `json:"login"`
			Password string `json:"password"`
		}
		if err := decodeJSON(w, r, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		req.Login = strings.TrimSpace(req.Login)
		if req.Login == "" || req.Password == "" {
			writeError(w, http.StatusBadRequest, "login and password required")
			return
		}
		a, err := d.Admins.GetByLogin(r.Context(), req.Login)
		if err != nil {
			log.Printf("admin login lookup: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		if a == nil || !auth.CheckPassword(a.PasswordHash, req.Password) {
			writeError(w, http.StatusUnauthorized, "invalid credentials")
			return
		}
		tok, err := auth.IssueToken(d.Secret, auth.Claims{
			AdminID: a.ID, Login: a.Login, Role: a.Role, Name: a.Name,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to issue token")
			return
		}
		if d.Audit != nil {
			_ = d.Audit.Record(r.Context(), repo.AuditEntry{
				AdminID: a.ID, AdminLogin: a.Login, AdminName: a.Name,
				Action: "login", Target: a.Name, IP: clientIP(r),
			})
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"token": tok,
			"admin": a,
		})
	}
}

func AdminMe(d *AdminDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c := auth.FromContext(r.Context())
		if c == nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"id": c.AdminID, "login": c.Login, "name": c.Name, "role": c.Role,
		})
	}
}

// requireSuper returns the caller's claims only if they have the "super" role
// (owner). Otherwise it writes an error and returns nil. Admin management
// (create/list/delete admins) is owner-only.
func requireSuper(w http.ResponseWriter, r *http.Request) *auth.Claims {
	c := auth.FromContext(r.Context())
	if c == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return nil
	}
	if c.Role != "super" {
		writeError(w, http.StatusForbidden, "только владелец может управлять админами")
		return nil
	}
	return c
}

func AdminsList(d *AdminDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if requireSuper(w, r) == nil {
			return
		}
		list, err := d.Admins.List(r.Context())
		if err != nil {
			log.Printf("admins list: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		if list == nil {
			list = []repo.Admin{}
		}
		writeJSON(w, http.StatusOK, list)
	}
}

func AdminCreate(d *AdminDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if requireSuper(w, r) == nil {
			return
		}
		var req struct {
			Login    string `json:"login"`
			Name     string `json:"name"`
			Password string `json:"password"`
			Role     string `json:"role"`
		}
		if err := decodeJSON(w, r, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		req.Login = strings.ToLower(strings.TrimSpace(req.Login))
		req.Name = strings.TrimSpace(req.Name)
		if req.Login == "" || req.Name == "" || len(req.Password) < 8 {
			writeError(w, http.StatusBadRequest, "логин, имя и пароль (не короче 8 символов) обязательны")
			return
		}
		if req.Role != "super" && req.Role != "admin" {
			req.Role = "admin"
		}
		existing, err := d.Admins.GetByLogin(r.Context(), req.Login)
		if err != nil {
			log.Printf("admin create lookup: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		if existing != nil {
			writeError(w, http.StatusConflict, "логин уже занят")
			return
		}
		hash, err := auth.HashPassword(req.Password)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		a, err := d.Admins.Create(r.Context(), req.Login, hash, req.Name, req.Role)
		if err != nil {
			log.Printf("admin create: %v", err)
			writeError(w, http.StatusInternalServerError, "не удалось создать админа")
			return
		}
		recordAudit(d, r, "admin.create", "админ "+a.Login, map[string]any{"role": a.Role, "name": a.Name})
		writeJSON(w, http.StatusCreated, a)
	}
}

func AdminDelete(d *AdminDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c := requireSuper(w, r)
		if c == nil {
			return
		}
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid id")
			return
		}
		if id == c.AdminID {
			writeError(w, http.StatusBadRequest, "нельзя удалить самого себя")
			return
		}
		target, err := d.Admins.GetByID(r.Context(), id)
		if err != nil {
			log.Printf("admin delete lookup: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		if target == nil {
			writeError(w, http.StatusNotFound, "админ не найден")
			return
		}
		if target.Role == "super" {
			nSuper, err := d.Admins.CountByRole(r.Context(), "super")
			if err != nil {
				writeError(w, http.StatusInternalServerError, "internal error")
				return
			}
			if nSuper <= 1 {
				writeError(w, http.StatusBadRequest, "нельзя удалить последнего владельца")
				return
			}
		}
		if err := d.Admins.Delete(r.Context(), id); err != nil {
			log.Printf("admin delete: %v", err)
			writeError(w, http.StatusInternalServerError, "не удалось удалить админа")
			return
		}
		recordAudit(d, r, "admin.delete", "админ "+target.Login, map[string]any{"role": target.Role, "name": target.Name})
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}

func AuditList(d *AdminDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if requireSuper(w, r) == nil {
			return
		}
		limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
		list, err := d.Audit.List(r.Context(), limit)
		if err != nil {
			log.Printf("audit list: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		if list == nil {
			list = []repo.AuditEntry{}
		}
		writeJSON(w, http.StatusOK, list)
	}
}

func validatePromoInput(p *repo.PromoCode) string {
	p.Code = strings.ToUpper(strings.TrimSpace(p.Code))
	if p.Code == "" {
		return "код обязателен"
	}
	if p.DiscountType != "percent" && p.DiscountType != "fixed" {
		return "тип скидки должен быть «percent» (%) или «fixed» (₽)"
	}
	if p.DiscountValue <= 0 {
		return "скидка должна быть больше 0"
	}
	if p.DiscountType == "percent" && p.DiscountValue > 100 {
		return "процент скидки не может превышать 100"
	}
	if p.MinOrder < 0 {
		return "минимальная сумма не может быть отрицательной"
	}
	return ""
}

func AdminPromosList(d *AdminDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		list, err := d.Promos.List(r.Context())
		if err != nil {
			log.Printf("promos list: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		if list == nil {
			list = []repo.PromoCode{}
		}
		writeJSON(w, http.StatusOK, list)
	}
}

func AdminPromoCreate(d *AdminDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var p repo.PromoCode
		if err := decodeJSON(w, r, &p); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if msg := validatePromoInput(&p); msg != "" {
			writeError(w, http.StatusBadRequest, msg)
			return
		}
		if err := d.Promos.Create(r.Context(), &p); err != nil {
			log.Printf("promo create: %v", err)
			writeError(w, http.StatusConflict, "не удалось создать промокод (возможно, такой код уже есть)")
			return
		}
		recordAudit(d, r, "promo.create", "промокод "+p.Code,
			map[string]any{"type": p.DiscountType, "value": p.DiscountValue})
		writeJSON(w, http.StatusCreated, p)
	}
}

func AdminPromoUpdate(d *AdminDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid id")
			return
		}
		var p repo.PromoCode
		if err := decodeJSON(w, r, &p); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		p.ID = id
		if msg := validatePromoInput(&p); msg != "" {
			writeError(w, http.StatusBadRequest, msg)
			return
		}
		if err := d.Promos.Update(r.Context(), &p); err != nil {
			if errors.Is(err, repo.ErrPromoNotFound) {
				writeError(w, http.StatusNotFound, "промокод не найден")
				return
			}
			log.Printf("promo update: %v", err)
			writeError(w, http.StatusInternalServerError, "не удалось обновить промокод")
			return
		}
		recordAudit(d, r, "promo.update", "промокод "+p.Code,
			map[string]any{"type": p.DiscountType, "value": p.DiscountValue})
		writeJSON(w, http.StatusOK, p)
	}
}

func AdminPromoDelete(d *AdminDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid id")
			return
		}
		if err := d.Promos.Delete(r.Context(), id); err != nil {
			log.Printf("promo delete: %v", err)
			writeError(w, http.StatusInternalServerError, "не удалось удалить промокод")
			return
		}
		recordAudit(d, r, "promo.delete", "промокод #"+strconv.FormatInt(id, 10), nil)
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}

func AdminOrdersList(d *AdminDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
		orders, err := d.Orders.List(r.Context(), limit)
		if err != nil {
			log.Printf("orders list: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		if orders == nil {
			orders = []repo.Order{}
		}
		writeJSON(w, http.StatusOK, orders)
	}
}

func AdminOrderUpdate(d *AdminDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := r.PathValue("id")
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid id")
			return
		}
		var req struct {
			Status     string `json:"status"`
			AssignedTo string `json:"assignedTo"`
		}
		if err := decodeJSON(w, r, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if !validStatus(req.Status) {
			writeError(w, http.StatusBadRequest, "invalid status")
			return
		}
		if err := d.Orders.UpdateStatus(r.Context(), id, req.Status, req.AssignedTo); err != nil {
			log.Printf("order update: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		recordAudit(d, r, "order.status", "заказ #"+strconv.FormatInt(id, 10),
			map[string]any{"status": req.Status, "assignedTo": req.AssignedTo})
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}

func AdminSettingsGet(d *AdminDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := r.PathValue("key")
		if !validSettingsKey(key) {
			writeError(w, http.StatusBadRequest, "invalid key")
			return
		}
		val, err := d.Settings.GetRaw(r.Context(), key, defaultSettings(key))
		if err != nil {
			log.Printf("settings get: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(val)
	}
}

func AdminSettingsPut(d *AdminDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := r.PathValue("key")
		if !validSettingsKey(key) {
			writeError(w, http.StatusBadRequest, "invalid key")
			return
		}
		var raw json.RawMessage
		if err := decodeJSON(w, r, &raw); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if err := d.Settings.Put(r.Context(), key, raw); err != nil {
			log.Printf("settings put: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		recordAudit(d, r, "settings."+key, settingsLabel(key), nil)
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}

// PublicMenu serves the customer-facing menu (items + custom categories) and
// the stop-list, so the storefront reflects what admins edit. Public, no auth.
// Falls back to empty when nothing is stored yet — the frontend then uses its
// bundled default menu.
func PublicMenu(settings *repo.Settings) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		menuRaw, err := settings.GetRaw(r.Context(), "menu", `{"items":null,"categories":[]}`)
		if err != nil {
			log.Printf("public menu: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		stopRaw, err := settings.GetRaw(r.Context(), "stop", `{"items":[],"categories":[]}`)
		if err != nil {
			stopRaw = []byte(`{"items":[],"categories":[]}`)
		}
		writeJSON(w, http.StatusOK, map[string]json.RawMessage{
			"menu": json.RawMessage(menuRaw),
			"stop": json.RawMessage(stopRaw),
		})
	}
}

var validSettingsKeys = map[string]bool{
	"promos": true, "zones": true, "stop": true, "cook": true, "couriers": true, "store": true, "menu": true,
}

func validSettingsKey(k string) bool { return validSettingsKeys[k] }

func settingsLabel(k string) string {
	switch k {
	case "promos":
		return "акции"
	case "zones":
		return "зоны доставки"
	case "stop":
		return "стоп-лист"
	case "cook":
		return "время готовки"
	case "couriers":
		return "курьеры"
	case "store":
		return "меню и настройки"
	default:
		return k
	}
}

func defaultSettings(key string) string {
	switch key {
	case "promos", "zones", "couriers":
		return `[]`
	case "stop":
		return `{"items":[],"categories":[]}`
	case "cook":
		return `{"cookTimeMinutes":35}`
	case "menu":
		return `{"categories":[]}`
	default:
		return `{}`
	}
}

var validStatuses = map[string]bool{
	"new": true, "cooking": true, "on_way": true, "delivered": true, "cancelled": true,
}

func validStatus(s string) bool { return validStatuses[s] }

// Used to fail explicit type assertion compile checks if someone refactors.
var _ = errors.New
