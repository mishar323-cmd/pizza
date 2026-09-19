package sms

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func fakeSMSC(t *testing.T, smsResp, callResp string) (*SMSC, *[]string) {
	t.Helper()
	var calls []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		if r.Form.Get("login") != "u" || r.Form.Get("psw") != "p" || r.Form.Get("phones") != "79161234567" {
			t.Errorf("bad auth/phone params: %v", r.Form)
		}
		if r.Form.Get("call") == "1" {
			calls = append(calls, "call")
			w.Write([]byte(callResp))
			return
		}
		calls = append(calls, "sms:"+r.Form.Get("mes"))
		w.Write([]byte(smsResp))
	}))
	t.Cleanup(srv.Close)
	s := NewSMSC("u", "p", "", false)
	s.BaseURL = srv.URL
	return s, &calls
}

func TestSMSDelivered(t *testing.T) {
	s, calls := fakeSMSC(t, `{"id":1,"cnt":1}`, `{}`)
	code, ch, err := s.SendCode(context.Background(), "+79161234567", "4821")
	if err != nil || code != "4821" || ch != ChannelSMS || len(*calls) != 1 {
		t.Fatalf("got %q %q %v calls=%v", code, ch, err, *calls)
	}
}

func TestSMSDeniedFallsBackToCall(t *testing.T) {
	s, calls := fakeSMSC(t, `{"error":"message is denied","error_code":6}`, `{"id":2,"cnt":1,"code":"79001234597"}`)
	code, ch, err := s.SendCode(context.Background(), "+79161234567", "4821")
	if err != nil || ch != ChannelCall || code != "4597" {
		t.Fatalf("got %q %q %v", code, ch, err)
	}
	if len(*calls) != 2 || (*calls)[1] != "call" {
		t.Fatalf("calls=%v", *calls)
	}
}

func TestOutageDoesNotFallBack(t *testing.T) {
	s, calls := fakeSMSC(t, `{"error":"no money","error_code":3}`, `{"code":"1111"}`)
	if _, _, err := s.SendCode(context.Background(), "+79161234567", "4821"); err == nil {
		t.Fatal("expected error")
	}
	if len(*calls) != 1 {
		t.Fatalf("must not try call on account errors, calls=%v", *calls)
	}
}
