package com.travelmate.weather;

/** Port for weather data. Implementations must never fabricate a forecast. */
public interface WeatherProvider {

    /** @throws WeatherUnavailableException when real data cannot be obtained. */
    WeatherDto forecast(double lat, double lng);

    class WeatherUnavailableException extends RuntimeException {
        public WeatherUnavailableException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
