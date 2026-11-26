package com.travelmate.weather;

import com.fasterxml.jackson.databind.JsonNode;
import com.travelmate.common.Provenance;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Real forecasts from Open-Meteo (keyless, https://open-meteo.com). */
@Component
@ConditionalOnProperty(name = "travelmate.weather.provider", havingValue = "open-meteo", matchIfMissing = true)
public class OpenMeteoWeatherProvider implements WeatherProvider {

    private final RestClient client;

    public OpenMeteoWeatherProvider(@Qualifier("weatherRestClient") RestClient client) {
        this.client = client;
    }

    @Override
    public WeatherDto forecast(double lat, double lng) {
        try {
            JsonNode root = client.get()
                    .uri(u -> u.path("/v1/forecast")
                            .queryParam("latitude", String.format(Locale.ROOT, "%.4f", lat))
                            .queryParam("longitude", String.format(Locale.ROOT, "%.4f", lng))
                            .queryParam("current", "temperature_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code")
                            .queryParam("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max")
                            .queryParam("timezone", "auto")
                            .queryParam("forecast_days", 7)
                            .queryParam("wind_speed_unit", "kmh")
                            .build())
                    .retrieve()
                    .body(JsonNode.class);
            if (root == null || !root.has("daily")) throw new IllegalStateException("Empty response");
            return map(root);
        } catch (Exception e) {
            throw new WeatherUnavailableException("Open-Meteo request failed", e);
        }
    }

    static WeatherDto map(JsonNode root) {
        WeatherDto.Current current = null;
        JsonNode c = root.path("current");
        if (c.isObject() && c.has("temperature_2m")) {
            int code = c.path("weather_code").asInt();
            current = new WeatherDto.Current(c.path("time").asText(), c.path("temperature_2m").asDouble(),
                    c.path("apparent_temperature").asDouble(), c.path("precipitation").asDouble(),
                    c.path("wind_speed_10m").asDouble(), code, WmoCodes.describe(code));
        }
        JsonNode d = root.path("daily");
        List<WeatherDto.Daily> daily = new ArrayList<>();
        JsonNode times = d.path("time");
        for (int i = 0; i < times.size(); i++) {
            int code = d.path("weather_code").path(i).asInt();
            JsonNode prob = d.path("precipitation_probability_max").path(i);
            daily.add(new WeatherDto.Daily(times.path(i).asText(),
                    d.path("temperature_2m_min").path(i).asDouble(),
                    d.path("temperature_2m_max").path(i).asDouble(),
                    prob.isNumber() ? prob.asInt() : null,
                    d.path("precipitation_sum").path(i).asDouble(),
                    code, WmoCodes.describe(code)));
        }
        return new WeatherDto(Provenance.real("open-meteo"), root.path("timezone").asText("UTC"), current, daily);
    }
}
