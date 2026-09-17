package handlers

import (
	"context"
	"encoding/json"
	"log"
	"math"
	"net/http"
	"strings"

	"pizza-backend/internal/geo"
	"pizza-backend/internal/repo"
)

// A zone without a polygon is a circle around the pizzeria; older data has no
// radiusKm, so it falls back to this.
const defaultZoneRadiusKm = 10.0

// Extra margin around all zones for the geocoder search area, so addresses
// just outside a border are still found and reported as "вне зоны".
const searchMarginKm = 5.0

type zoneDef struct {
	ID            string       `json:"id"`
	Name          string       `json:"name"`
	Color         string       `json:"color"`
	Description   string       `json:"description"`
	DeliveryPrice float64      `json:"deliveryPrice"`
	FreeFrom      float64      `json:"freeFrom"`
	Eta           int          `json:"eta"`
	Polygon       [][2]float64 `json:"polygon"`
	RadiusKm      float64      `json:"radiusKm"`
}

func (z zoneDef) isCircle() bool { return len(z.Polygon) < 3 }

func (z zoneDef) radius() float64 {
	if z.RadiusKm > 0 {
		return z.RadiusKm
	}
	return defaultZoneRadiusKm
}

func round1(v float64) float64 { return math.Round(v*10) / 10 }

func loadZones(ctx context.Context, settings *repo.Settings) ([]zoneDef, error) {
	raw, err := settings.GetRaw(ctx, "zones", "[]")
	if err != nil {
		return nil, err
	}
	var zones []zoneDef
	if err := json.Unmarshal(raw, &zones); err != nil {
		return nil, err
	}
	return zones, nil
}

// polygonAreaDeg2 is the planar area in degrees² — only used to compare zones.
func polygonAreaDeg2(poly [][2]float64) float64 {
	s := 0.0
	for i := range poly {
		j := (i + 1) % len(poly)
		s += poly[i][1]*poly[j][0] - poly[j][1]*poly[i][0]
	}
	return math.Abs(s) / 2
}

// resolveZone picks the most specific zone containing pt: the smallest
// matching polygon, otherwise the smallest matching circle. Order of zones in
// the admin list does not matter.
func resolveZone(zones []zoneDef, origin, pt geo.Point) *zoneDef {
	var best *zoneDef
	bestArea := math.Inf(1)
	for i := range zones {
		z := &zones[i]
		if z.isCircle() || !geo.PointInPolygon(pt, z.Polygon) {
			continue
		}
		if a := polygonAreaDeg2(z.Polygon); a < bestArea {
			best, bestArea = z, a
		}
	}
	if best != nil {
		return best
	}
	dist := geo.HaversineKm(origin, pt)
	for i := range zones {
		z := &zones[i]
		if !z.isCircle() || dist > z.radius() {
			continue
		}
		if best == nil || z.radius() < best.radius() {
			best = z
		}
	}
	return best
}

// searchArea covers every zone plus a margin.
func searchArea(zones []zoneDef, origin geo.Point) geo.BBox {
	box := geo.NewBBox(origin, searchMarginKm)
	for _, z := range zones {
		if z.isCircle() {
			box.Extend(origin, z.radius()+searchMarginKm)
			continue
		}
		for _, v := range z.Polygon {
			box.Extend(geo.Point{Lat: v[0], Lon: v[1]}, searchMarginKm)
		}
	}
	return box
}

// DeliveryZones exposes zones for the storefront map. Public.
func DeliveryZones(settings *repo.Settings, origin geo.Point) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		zones, err := loadZones(r.Context(), settings)
		if err != nil {
			log.Printf("delivery zones: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		out := make([]map[string]any, 0, len(zones))
		for _, z := range zones {
			item := map[string]any{
				"id": z.ID, "name": z.Name, "color": z.Color, "description": z.Description,
				"deliveryPrice": z.DeliveryPrice, "freeFrom": z.FreeFrom, "eta": z.Eta,
			}
			if z.isCircle() {
				item["radiusKm"] = z.radius()
			} else {
				item["polygon"] = z.Polygon
			}
			out = append(out, item)
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"origin": []float64{origin.Lat, origin.Lon},
			"zones":  out,
		})
	}
}

// DeliveryQuote geocodes an address and resolves the delivery zone + price.
// Public — used by the checkout to show the correct delivery fee.
func DeliveryQuote(gc *geo.Geocoder, settings *repo.Settings, origin geo.Point) http.HandlerFunc {
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
		zones, err := loadZones(r.Context(), settings)
		if err != nil {
			log.Printf("delivery quote zones: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}

		pt, ok, err := gc.Geocode(r.Context(), req.Address, searchArea(zones, origin))
		if err != nil {
			log.Printf("geocode %q: %v", req.Address, err)
			writeError(w, http.StatusBadGateway, "не удалось проверить адрес")
			return
		}
		if !ok {
			log.Printf("geocode not found: %q", req.Address)
			writeJSON(w, http.StatusOK, map[string]any{
				"found":   false,
				"message": "Не нашли такой адрес рядом с нами — укажите населённый пункт, улицу и дом",
			})
			return
		}

		dist := geo.HaversineKm(origin, pt)
		matched := resolveZone(zones, origin, pt)
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
