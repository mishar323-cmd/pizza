package handlers

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"time"

	"pizza-backend/internal/repo"
	"pizza-backend/internal/telegram"
	"pizza-backend/internal/yookassa"
)

// YooKassaWebhook handles payment notifications. The POST body is untrusted, so
// we re-fetch the payment from YooKassa's API to authoritatively confirm the
// status before marking the order paid. Only then (and only once) is the
// Telegram notification sent — so the chat receives online orders solely after
// they are actually paid. Always returns 200 so YooKassa stops retrying.
func YooKassaWebhook(yk *yookassa.Client, orders *repo.Orders, tg *telegram.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Event  string `json:"event"`
			Object struct {
				ID string `json:"id"`
			} `json:"object"`
		}
		if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil || body.Object.ID == "" {
			w.WriteHeader(http.StatusOK)
			return
		}

		info, err := yk.GetPayment(r.Context(), body.Object.ID)
		if err != nil {
			log.Printf("webhook get payment %s: %v", body.Object.ID, err)
			w.WriteHeader(http.StatusOK)
			return
		}

		if info.Status == "succeeded" && info.OrderID > 0 {
			newlyPaid, err := orders.MarkPaid(r.Context(), info.OrderID, info.ID)
			if err != nil {
				log.Printf("webhook mark paid order %d: %v", info.OrderID, err)
			} else if newlyPaid {
				log.Printf("order %d marked paid (payment %s)", info.OrderID, info.ID)
				if o, err := orders.GetByID(r.Context(), info.OrderID); err == nil && o != nil && tg != nil {
					go func(ord repo.Order) {
						ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
						defer cancel()
						if err := tg.SendOrderNotification(ctx, buildTelegramOrder(ord)); err != nil {
							log.Printf("webhook telegram notify: %v", err)
						}
					}(*o)
				}
			}
		}
		w.WriteHeader(http.StatusOK)
	}
}
