package handlers

import (
	"context"
	"log"
	"net/http"

	"pizza-backend/internal/repo"
	"pizza-backend/internal/telegram"
)

type OrdersDeps struct {
	Orders   *repo.Orders
	Promos   *repo.Promos
	Telegram *telegram.Client
}

func buildTelegramOrder(o repo.Order) telegram.Order {
	items := make([]telegram.Item, 0, len(o.Items))
	for _, it := range o.Items {
		items = append(items, telegram.Item{Name: it.Name, Qty: it.Qty, Price: it.Price})
	}
	return telegram.Order{
		Name: o.CustomerName, Phone: o.CustomerPhone, Address: o.Address,
		Comment: o.Comment, ReceiveMethod: o.ReceiveMethod, PayMethod: o.PayMethod,
		DeliveryTime: o.DeliveryTime, Items: items, Total: o.Total,
	}
}

func phoneDigits(s string) int {
	n := 0
	for _, r := range s {
		if r >= '0' && r <= '9' {
			n++
		}
	}
	return n
}

func CreateOrder(d *OrdersDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Name          string           `json:"name"`
			Phone         string           `json:"phone"`
			Address       string           `json:"address"`
			Zone          string           `json:"zone"`
			Comment       string           `json:"comment"`
			ReceiveMethod string           `json:"receiveMethod"`
			PayMethod     string           `json:"payMethod"`
			DeliveryTime  string           `json:"deliveryTime"`
			Items         []repo.OrderItem `json:"items"`
			Total         float64          `json:"total"`
			Delivery      float64          `json:"delivery"`
			PaymentID     string           `json:"paymentId"`
			PromoCode     string           `json:"promoCode"`
			PromoDiscount float64          `json:"promoDiscount"` // клиентское превью, сервер пересчитывает сам
			UtmSource     string           `json:"utmSource"`
			UtmMedium     string           `json:"utmMedium"`
			UtmCampaign   string           `json:"utmCampaign"`
		}
		if err := decodeJSON(w, r, &req); err != nil {
			log.Printf("order decode: %v", err)
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if req.ReceiveMethod == "" {
			req.ReceiveMethod = "delivery"
		}
		if req.PayMethod == "" {
			req.PayMethod = "cash"
		}
		if req.DeliveryTime == "" {
			req.DeliveryTime = "asap"
		}
		if req.Name == "" || len(req.Items) == 0 {
			writeError(w, http.StatusBadRequest, "не заполнены обязательные поля")
			return
		}
		if phoneDigits(req.Phone) < 10 {
			writeError(w, http.StatusBadRequest, "укажите корректный номер телефона")
			return
		}
		if req.ReceiveMethod != "pickup" && req.Address == "" {
			writeError(w, http.StatusBadRequest, "укажите адрес доставки")
			return
		}

		var (
			promo         *repo.PromoCode
			promoDiscount float64
		)
		if req.PromoCode != "" && d.Promos != nil {
			p, err := d.Promos.FindByCode(r.Context(), req.PromoCode)
			if err == nil {
				subtotal := req.Total + req.Delivery
				if disc, reason := resolveDiscount(p, subtotal); reason == "" {
					promo = p
					promoDiscount = disc
				} else {
					log.Printf("promo %s rejected at order creation: %s", req.PromoCode, reason)
				}
			} else {
				log.Printf("promo lookup at order creation: %v", err)
			}
		}

		o := &repo.Order{
			CustomerName:  req.Name,
			CustomerPhone: req.Phone,
			Address:       req.Address,
			Zone:          req.Zone,
			Comment:       req.Comment,
			ReceiveMethod: req.ReceiveMethod,
			PayMethod:     req.PayMethod,
			DeliveryTime:  req.DeliveryTime,
			Items:         req.Items,
			Total:         req.Total,
			Delivery:      req.Delivery,
			PaymentID:     req.PaymentID,
			UtmSource:     req.UtmSource,
			UtmMedium:     req.UtmMedium,
			UtmCampaign:   req.UtmCampaign,
		}
		if promo != nil {
			o.PromoCode = promo.Code
			o.PromoDiscount = promoDiscount
		}
		if err := d.Orders.Create(r.Context(), o); err != nil {
			log.Printf("order create: %v", err)
			writeError(w, http.StatusInternalServerError, "failed to create order")
			return
		}
		if promo != nil {
			if err := d.Promos.Redeem(r.Context(), promo.ID, o.ID, req.Phone, promoDiscount); err != nil {
				log.Printf("promo redeem (non-fatal): %v", err)
			}
		}

		// Notify immediately only for pay-on-delivery orders. Online orders are
		// notified after the payment webhook confirms they are actually paid.
		if o.PayMethod != "online" && d.Telegram != nil {
			go func(o repo.Order) {
				ctx, cancel := context.WithTimeout(context.Background(), 10*1e9)
				defer cancel()
				if err := d.Telegram.SendOrderNotification(ctx, buildTelegramOrder(o)); err != nil {
					log.Printf("telegram notify failed: %v", err)
				}
			}(*o)
		}

		writeJSON(w, http.StatusCreated, map[string]any{
			"id":     o.ID,
			"number": o.Number,
			"status": o.Status,
			"eta":    o.EtaMinutes,
		})
	}
}
