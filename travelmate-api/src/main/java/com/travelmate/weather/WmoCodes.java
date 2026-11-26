package com.travelmate.weather;

/** WMO weather interpretation codes as used by Open-Meteo. */
public final class WmoCodes {

    private WmoCodes() {}

    public static String describe(int code) {
        return switch (code) {
            case 0 -> "Clear sky";
            case 1 -> "Mainly clear";
            case 2 -> "Partly cloudy";
            case 3 -> "Overcast";
            case 45, 48 -> "Fog";
            case 51, 53, 55 -> "Drizzle";
            case 56, 57 -> "Freezing drizzle";
            case 61 -> "Light rain";
            case 63 -> "Moderate rain";
            case 65 -> "Heavy rain";
            case 66, 67 -> "Freezing rain";
            case 71, 73, 75, 77 -> "Snow";
            case 80 -> "Light showers";
            case 81 -> "Showers";
            case 82 -> "Violent showers";
            case 85, 86 -> "Snow showers";
            case 95 -> "Thunderstorm";
            case 96, 99 -> "Thunderstorm with hail";
            default -> "Unknown";
        };
    }

    public static boolean isWet(int code) {
        return code >= 51;
    }

    public static boolean isStormy(int code) {
        return code == 82 || code >= 95;
    }
}
