package com.travelmate.common;

/** Where integration-backed data came from, and how much to trust it. */
public record Provenance(String source, boolean approximate, boolean simulated, String note) {

    public static Provenance real(String source) {
        return new Provenance(source, false, false, null);
    }

    public static Provenance approximate(String source, String note) {
        return new Provenance(source, true, false, note);
    }

    public static Provenance ruleBased(String source, String note) {
        return new Provenance(source, true, true, note);
    }
}
