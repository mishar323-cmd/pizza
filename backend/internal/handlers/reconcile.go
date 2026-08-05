package handlers

import (
	"context"
	"log"

	"pizza-backend/internal/repo"
	"pizza-backend/internal/telegram"
	"pizza-backend/internal/yookassa"
)

// ReconcilePaidOrders polls recent YooKassa payments and, for any that have
// succeeded and map to an order not yet marked paid, marks it paid and sends
// the Telegram notification. Run on a ticker — this is the reliable path when
// no webhook is configured (webhook management needs OAuth we don't have). The
// newly-paid check keeps it from notifying twice.
func ReconcilePaidOrders(ctx context.Context, yk *yookassa.Client, orders *repo.Orders, tg *telegram.Client) {
	payments, err := yk.ListRecentPayments(ctx, 30)
	if err != nil {
		log.Printf("reconcile list payments: %v", err)
		return
	}
	for _, p := range payments {
		if p.Status != "succeeded" || p.OrderID <= 0 {
			continue
		}
		newlyPaid, err := orders.MarkPaid(ctx, p.OrderID, p.ID)
		if err != nil || !newlyPaid {
			continue
		}
		log.Printf("reconcile: order %d marked paid (payment %s)", p.OrderID, p.ID)
		if tg == nil {
			continue
		}
		o, err := orders.GetByID(ctx, p.OrderID)
		if err != nil || o == nil {
			continue
		}
		if err := tg.SendOrderNotification(ctx, buildTelegramOrder(*o)); err != nil {
			log.Printf("reconcile telegram: %v", err)
		}
	}
}
