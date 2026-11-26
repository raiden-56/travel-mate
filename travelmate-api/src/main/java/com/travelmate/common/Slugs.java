package com.travelmate.common;

import java.text.Normalizer;
import java.util.Locale;

public final class Slugs {

    private Slugs() {}

    public static String slugify(String input) {
        if (input == null) return "";
        String normalized = Normalizer.normalize(input, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        String slug = normalized.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        return slug.length() > 120 ? slug.substring(0, 120) : slug;
    }

    /** Splits a delimited column value into trimmed non-empty parts. */
    public static java.util.List<String> split(String raw, String delimiterRegex) {
        if (raw == null || raw.isBlank()) return java.util.List.of();
        return java.util.Arrays.stream(raw.split(delimiterRegex))
                .map(String::trim).filter(s -> !s.isEmpty()).toList();
    }
}
