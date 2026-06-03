package handlers

import (
	"errors"
	"log"
	"net/http"
	"time"

	"pizza-backend/internal/repo"
)

type PromosDeps struct {
	Promos *repo.Promos
}

// ValidatePromo accepts {code, subtotal, phone} and returns the resolvable discount.
// Does NOT mutate state — call RedeemPromo at order creation to lock it in.
func ValidatePromo(d *PromosDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Code     string  `json:"code"`
			Subtotal float64 `json:"subtotal"`
			Phone    string  `json:"phone"`
		}
		if err := decodeJSON(w, r, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if req.Code == "" {
			writeError(w, http.StatusBadRequest, "code required")
			return
		}

		p, err := d.Promos.FindByCode(r.Context(), req.Code)
		if errors.Is(err, repo.ErrPromoNotFound) {
			writeError(w, http.StatusNotFound, "Промокод не найден")
			return
		}
		if err != nil {
			log.Printf("promo lookup: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}

		discount, reason := resolveDiscount(p, req.Subtotal)
		if reason != "" {
			writeError(w, http.StatusUnprocessableEntity, reason)
			return
		}
		if p.PerPhoneLimit > 0 && req.Phone != "" {
			n, err := d.Promos.CountRedemptionsByPhone(r.Context(), p.ID, req.Phone)
			if err != nil {
				log.Printf("promo redemption count: %v", err)
				writeError(w, http.StatusInternalServerError, "internal error")
				return
			}
			if n >= p.PerPhoneLimit {
				writeError(w, http.StatusUnprocessableEntity, "Промокод уже использован для этого номера")
				return
			}
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"code":        p.Code,
			"description": p.Description,
			"discount":    discount,
			"subtotal":    req.Subtotal,
			"newTotal":    round2(req.Subtotal - discount),
		})
	}
}

func resolveDiscount(p *repo.PromoCode, subtotal float64) (float64, string) {
	if !p.Active {
		return 0, "Промокод неактивен"
	}
	now := time.Now()
	if p.StartsAt != nil && now.Before(*p.StartsAt) {
		return 0, "Промокод ещё не действует"
	}
	if p.ExpiresAt != nil && now.After(*p.ExpiresAt) {
		return 0, "Срок действия промокода истёк"
	}
	if p.MaxUses != nil && p.UsedCount >= *p.MaxUses {
		return 0, "Промокод исчерпан"
	}
	if subtotal < p.MinOrder {
		return 0, "Минимальная сумма заказа для этого промокода — " + formatRub(p.MinOrder) + " ₽"
	}
	var d float64
	switch p.DiscountType {
	case "fixed":
		d = p.DiscountValue
	case "percent":
		d = round2(subtotal * p.DiscountValue / 100)
	default:
		return 0, "Промокод с неизвестным типом скидки"
	}
	if d > subtotal {
		d = subtotal
	}
	return d, ""
}

func round2(v float64) float64 {
	return float64(int64(v*100+0.5)) / 100
}

func formatRub(v float64) string {
	if v == float64(int64(v)) {
		return itoa(int64(v))
	}
	return itoa(int64(v*100)/100) + "." + pad2(int64(v*100)%100)
}

func itoa(n int64) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}

func pad2(n int64) string {
	if n < 10 {
		return "0" + itoa(n)
	}
	return itoa(n)
}
