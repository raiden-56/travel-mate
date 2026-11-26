package com.travelmate.weather;

import com.travelmate.common.ApiException;
import com.travelmate.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Caches forecasts briefly (default 30 min) to stay within provider fair-use limits. */
@Service
public class WeatherService {

    private static final Logger log = LoggerFactory.getLogger(WeatherService.class);

    private record Entry(WeatherDto value, Instant expiresAt) {}

    private final WeatherProvider provider;
    private final AppProperties props;
    private final Map<String, Entry> cache = new ConcurrentHashMap<>();

    public WeatherService(WeatherProvider provider, AppProperties props) {
        this.provider = provider;
        this.props = props;
    }

    public WeatherDto forecast(double lat, double lng) {
        return tryForecast(lat, lng).orElseThrow(() -> ApiException.providerUnavailable(
                "Weather is unavailable right now. Please try again later."));
    }

    public Optional<WeatherDto> tryForecast(double lat, double lng) {
        String key = String.format(Locale.ROOT, "%.2f,%.2f", lat, lng);
        Entry hit = cache.get(key);
        if (hit != null && hit.expiresAt().isAfter(Instant.now())) return Optional.of(hit.value());
        try {
            WeatherDto value = provider.forecast(lat, lng);
            cache.put(key, new Entry(value, Instant.now().plus(props.weather().cacheTtl())));
            if (cache.size() > 2000) cache.entrySet().removeIf(e -> e.getValue().expiresAt().isBefore(Instant.now()));
            return Optional.of(value);
        } catch (WeatherProvider.WeatherUnavailableException e) {
            log.warn("Weather unavailable for {}: {}", key, e.getCause() == null ? e.getMessage() : e.getCause().getMessage());
            return Optional.empty();
        }
    }
}
