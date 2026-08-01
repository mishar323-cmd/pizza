// Package geo geocodes addresses via Yandex and resolves delivery zones by
// testing the point against zone polygons (or a radius fallback).
package geo

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type Point struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

type Geocoder struct {
	apiKey string
	http   *http.Client
}

func NewGeocoder(apiKey string) *Geocoder {
	return &Geocoder{apiKey: apiKey, http: &http.Client{Timeout: 8 * time.Second}}
}

func (g *Geocoder) Enabled() bool { return g.apiKey != "" }

// Geocode returns coordinates for an address; ok=false when nothing was found.
func (g *Geocoder) Geocode(ctx context.Context, address string) (Point, bool, error) {
	endpoint := "https://geocode-maps.yandex.ru/1.x/?" + url.Values{
		"apikey":  {g.apiKey},
		"format":  {"json"},
		"results": {"1"},
		"geocode": {address},
	}.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return Point{}, false, err
	}
	resp, err := g.http.Do(req)
	if err != nil {
		return Point{}, false, err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return Point{}, false, fmt.Errorf("geocoder http %d", resp.StatusCode)
	}
	var raw struct {
		Response struct {
			GeoObjectCollection struct {
				FeatureMember []struct {
					GeoObject struct {
						Point struct {
							Pos string `json:"pos"`
						} `json:"Point"`
					} `json:"GeoObject"`
				} `json:"featureMember"`
			} `json:"GeoObjectCollection"`
		} `json:"response"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return Point{}, false, err
	}
	fm := raw.Response.GeoObjectCollection.FeatureMember
	if len(fm) == 0 {
		return Point{}, false, nil
	}
	parts := strings.Fields(fm[0].GeoObject.Point.Pos) // "lon lat"
	if len(parts) != 2 {
		return Point{}, false, nil
	}
	lon, err1 := strconv.ParseFloat(parts[0], 64)
	lat, err2 := strconv.ParseFloat(parts[1], 64)
	if err1 != nil || err2 != nil {
		return Point{}, false, nil
	}
	return Point{Lat: lat, Lon: lon}, true, nil
}

// PointInPolygon runs a ray-casting test. poly vertices are [lat, lon].
func PointInPolygon(p Point, poly [][2]float64) bool {
	if len(poly) < 3 {
		return false
	}
	in := false
	n := len(poly)
	for i, j := 0, n-1; i < n; j, i = i, i+1 {
		latI, lonI := poly[i][0], poly[i][1]
		latJ, lonJ := poly[j][0], poly[j][1]
		if (latI > p.Lat) != (latJ > p.Lat) &&
			p.Lon < (lonJ-lonI)*(p.Lat-latI)/(latJ-latI)+lonI {
			in = !in
		}
	}
	return in
}

// HaversineKm is the great-circle distance in kilometres.
func HaversineKm(a, b Point) float64 {
	const R = 6371.0
	dLat := (b.Lat - a.Lat) * math.Pi / 180
	dLon := (b.Lon - a.Lon) * math.Pi / 180
	la1 := a.Lat * math.Pi / 180
	la2 := b.Lat * math.Pi / 180
	h := math.Sin(dLat/2)*math.Sin(dLat/2) + math.Cos(la1)*math.Cos(la2)*math.Sin(dLon/2)*math.Sin(dLon/2)
	return 2 * R * math.Asin(math.Sqrt(h))
}
