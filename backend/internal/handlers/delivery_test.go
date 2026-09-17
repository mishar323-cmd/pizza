package handlers

import (
	"encoding/json"
	"os"
	"slices"
	"testing"

	"pizza-backend/internal/geo"
)

var testOrigin = geo.Point{Lat: 55.767003, Lon: 37.236615}

func prodZones(t *testing.T) []zoneDef {
	t.Helper()
	raw, err := os.ReadFile("testdata/zones.json")
	if err != nil {
		t.Fatal(err)
	}
	var zones []zoneDef
	if err := json.Unmarshal(raw, &zones); err != nil {
		t.Fatal(err)
	}
	return zones
}

// Coordinates are what the Yandex geocoder returned for real addresses.
var addressCases = []struct {
	name string
	pt   geo.Point
	want string
}{
	{"Романовская 5", geo.Point{Lat: 55.767003, Lon: 37.236615}, "A"},
	{"Глухово", geo.Point{Lat: 55.771256, Lon: 37.253818}, "B"},
	{"ЖК Резиденции Новая Рига 3", geo.Point{Lat: 55.775596, Lon: 37.232276}, "B"},
	{"Жуковка", geo.Point{Lat: 55.736828, Lon: 37.249056}, "B"},
	{"Архангельское", geo.Point{Lat: 55.79638, Lon: 37.296137}, "C"},
	{"Опалиха", geo.Point{Lat: 55.827722, Lon: 37.252317}, "C"},
	{"Красногорск, Ильинский б-р 5 (10.1 км)", geo.Point{Lat: 55.818665, Lon: 37.368928}, ""},
}

func zoneID(z *zoneDef) string {
	if z == nil {
		return ""
	}
	return z.ID
}

func TestResolveZoneProdData(t *testing.T) {
	zones := prodZones(t)
	for _, c := range addressCases {
		if got := zoneID(resolveZone(zones, testOrigin, c.pt)); got != c.want {
			t.Errorf("%s: zone %q, want %q", c.name, got, c.want)
		}
	}
}

func TestResolveZoneIgnoresListOrder(t *testing.T) {
	zones := prodZones(t)
	slices.Reverse(zones)
	for _, c := range addressCases {
		if got := zoneID(resolveZone(zones, testOrigin, c.pt)); got != c.want {
			t.Errorf("reversed %s: zone %q, want %q", c.name, got, c.want)
		}
	}
}

func TestResolveZoneRadiusFromAdmin(t *testing.T) {
	zones := prodZones(t)
	far := addressCases[len(addressCases)-1].pt
	for i := range zones {
		if zones[i].isCircle() {
			zones[i].RadiusKm = 15
		}
	}
	if got := zoneID(resolveZone(zones, testOrigin, far)); got != "C" {
		t.Fatalf("radius 15 km: zone %q, want C", got)
	}
}

func inBox(b geo.BBox, p geo.Point) bool {
	return p.Lat >= b.MinLat && p.Lat <= b.MaxLat && p.Lon >= b.MinLon && p.Lon <= b.MaxLon
}

func TestSearchAreaCoversAllZones(t *testing.T) {
	zones := prodZones(t)
	for i := range zones {
		if zones[i].isCircle() {
			zones[i].RadiusKm = 25
		}
	}
	zones = append(zones, zoneDef{ID: "far", Polygon: [][2]float64{{56.2, 37.9}, {56.3, 37.9}, {56.3, 38.0}}})
	box := searchArea(zones, testOrigin)

	for _, c := range addressCases {
		if !inBox(box, c.pt) {
			t.Errorf("%s outside search area", c.name)
		}
	}
	// edge of 25 km circle, due east
	east := geo.Point{Lat: testOrigin.Lat, Lon: testOrigin.Lon + 25/(111*0.5629)}
	if !inBox(box, east) {
		t.Error("east edge of 25 km circle outside search area")
	}
	if !inBox(box, geo.Point{Lat: 56.3, Lon: 38.0}) {
		t.Error("far polygon vertex outside search area")
	}
}
