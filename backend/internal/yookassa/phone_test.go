package yookassa

import "testing"

func TestNormalizePhone(t *testing.T) {
	cases := map[string]string{
		"+7 999 123-45-67":  "79991234567",
		"8 (999) 123-45-67": "79991234567",
		"89991234567":       "79991234567",
		"79991234567":       "79991234567",
		// Customers often type the number without the country code; YooKassa
		// rejects the receipt unless the phone has 11 digits.
		"9991234567":      "79991234567",
		"999 123-45-67":   "79991234567",
		"(999) 123 45 67": "79991234567",
	}
	for in, want := range cases {
		if got := normalizePhone(in); got != want {
			t.Errorf("normalizePhone(%q) = %q, want %q", in, got, want)
		}
	}
}
