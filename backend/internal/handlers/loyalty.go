package handlers

import (
	"math"
	"sort"

	"pizza-backend/internal/repo"
)

// pizzaGift applies "every 8th pizza is free": each pizza in this order that
// lands on a multiple of 8 (counting the customer's earlier pizzas) is free.
// The cheapest pizzas in the order are the free ones.
func pizzaGift(pizzasBefore int, items []repo.OrderItem) (freeQty int, discount float64) {
	var prices []float64
	for _, it := range items {
		if it.Cat != "pizza" || it.Qty <= 0 || it.Price <= 0 {
			continue
		}
		for i := 0; i < it.Qty && i < 100; i++ {
			prices = append(prices, it.Price)
		}
	}
	if len(prices) == 0 || pizzasBefore < 0 {
		return 0, 0
	}
	freeQty = (pizzasBefore+len(prices))/pizzasPerGift - pizzasBefore/pizzasPerGift
	if freeQty <= 0 {
		return 0, 0
	}
	sort.Float64s(prices)
	for i := 0; i < freeQty; i++ {
		discount += prices[i]
	}
	return freeQty, math.Round(discount)
}
