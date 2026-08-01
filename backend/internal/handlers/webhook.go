package handlers

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	"pizza-backend/internal/repo"
	"pizza-backend/internal/yookassa"
)

// YooKassaWebhook handles payment notifications. The POST body is untrusted, so
// we re-fetch the payment from YooKassa's API to authoritatively confirm the
// status before marking the order paid. Always returns 200 so YooKassa stops
// retrying (we've logged anything worth acting on).
func YooKassaWebhook(yk *yookassa.Client, orders *repo.Orders) http.HandlerFunc {
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
			if err := orders.MarkPaid(r.Context(), info.OrderID, info.ID); err != nil {
				log.Printf("webhook mark paid order %d: %v", info.OrderID, err)
			} else {
				log.Printf("order %d marked paid (payment %s)", info.OrderID, info.ID)
			}
		}
		w.WriteHeader(http.StatusOK)
	}
}
