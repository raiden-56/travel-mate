package com.travelmate.common;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Currency;

/** Money helpers. All money is BigDecimal with scale 2; never double. */
public final class Money {

    public static final String DEFAULT_CURRENCY = "INR";

    private Money() {}

    public static BigDecimal zero() {
        return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }

    public static BigDecimal of(BigDecimal value) {
        return value == null ? null : value.setScale(2, RoundingMode.HALF_UP);
    }

    public static BigDecimal of(long value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
    }

    public static BigDecimal orZero(BigDecimal value) {
        return value == null ? zero() : of(value);
    }

    public static BigDecimal add(BigDecimal a, BigDecimal b) {
        return orZero(a).add(orZero(b));
    }

    public static BigDecimal parse(String raw, String field) {
        if (raw == null || raw.isBlank()) return null;
        try {
            BigDecimal value = new BigDecimal(raw.trim());
            if (value.signum() < 0) throw ApiException.badRequest(field, "Must not be negative");
            if (value.scale() > 2) throw ApiException.badRequest(field, "At most 2 decimal places");
            if (value.compareTo(new BigDecimal("9999999999.99")) > 0) throw ApiException.badRequest(field, "Amount is too large");
            return of(value);
        } catch (NumberFormatException e) {
            throw ApiException.badRequest(field, "Must be a decimal amount like 1250.00");
        }
    }

    public static String currency(String raw) {
        if (raw == null || raw.isBlank()) return DEFAULT_CURRENCY;
        String code = raw.trim().toUpperCase();
        try {
            Currency.getInstance(code);
            return code;
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("currency", "Unknown currency code");
        }
    }
}
