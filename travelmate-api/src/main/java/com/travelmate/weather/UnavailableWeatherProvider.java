package com.travelmate.weather;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Used when WEATHER_PROVIDER=none: always reports unavailable rather than inventing data. */
@Component
@ConditionalOnProperty(name = "travelmate.weather.provider", havingValue = "none")
public class UnavailableWeatherProvider implements WeatherProvider {

    @Override
    public WeatherDto forecast(double lat, double lng) {
        throw new WeatherUnavailableException("Weather provider disabled", null);
    }
}
