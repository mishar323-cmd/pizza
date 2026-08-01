package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"pizza-backend/internal/geo"
	"pizza-backend/internal/repo"
)

type zoneDef struct {
	ID            string       `json:"id"`
	Name          string       `json:"name"`
	DeliveryPrice float64      `json:"deliveryPrice"`
	FreeFrom      float64      `json:"freeFrom"`
	Eta           int          `json:"eta"`
	Polygon       [][2]float64 `json:"polygon"`
}

func round1(v float64) float64 { return float64(int64(v*10+0.5)) / 10 }

// DeliveryQuote geocodes an address and resolves the delivery zone + price.
// Public — used by the checkout to show the correct delivery fee.
func DeliveryQuote(gc *geo.Geocoder, settings *repo.Settings, origin geo.Point, maxKm float64) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Address  string  `json:"address"`
			Subtotal float64 `json:"subtotal"`
		}
		if err := decodeJSON(w, r, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if len(strings.TrimSpace(req.Address)) < 5 {
			writeError(w, http.StatusBadRequest, "укажите адрес")
			return
		}
		if !gc.Enabled() {
			writeError(w, http.StatusServiceUnavailable, "геокодер не настроен")
			return
		}
		pt, ok, err := gc.Geocode(r.Context(), req.Address)
		if err != nil {
			log.Printf("geocode: %v", err)
			writeError(w, http.StatusBadGateway, "не удалось определить адрес, попробуйте позже")
			return
		}
		if !ok {
			writeJSON(w, http.StatusOK, map[string]any{"found": false, "message": "Адрес не найден — проверьте написание"})
			return
		}

		var zones []zoneDef
		if raw, e := settings.GetRaw(r.Context(), "zones", "[]"); e == nil {
			_ = json.Unmarshal(raw, &zones)
		}

		var matched *zoneDef
		for i := range zones {
			if geo.PointInPolygon(pt, zones[i].Polygon) {
				matched = &zones[i]
				break
			}
		}
		dist := geo.HaversineKm(origin, pt)
		if matched == nil && dist <= maxKm {
			for i := range zones { // radius / catch-all zone (no polygon)
				if len(zones[i].Polygon) < 3 {
					matched = &zones[i]
					break
				}
			}
		}

		if matched == nil {
			writeJSON(w, http.StatusOK, map[string]any{
				"found": true, "inZone": false, "distanceKm": round1(dist), "coords": pt,
				"message": "Вне зоны доставки — доступен только самовывоз",
			})
			return
		}

		free := req.Subtotal > 0 && matched.FreeFrom > 0 && req.Subtotal >= matched.FreeFrom
		price := matched.DeliveryPrice
		if free {
			price = 0
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"found":         true,
			"inZone":        true,
			"zone":          map[string]any{"id": matched.ID, "name": matched.Name, "eta": matched.Eta},
			"deliveryPrice": price,
			"basePrice":     matched.DeliveryPrice,
			"freeFrom":      matched.FreeFrom,
			"freeApplied":   free,
			"distanceKm":    round1(dist),
			"coords":        pt,
		})
	}
}
