package com.travelmate.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "travelmate")
public record AppProperties(
        String frontendUrl,
        Jwt jwt,
        Cookie cookie,
        RateLimit rateLimit,
        Bootstrap bootstrap,
        Ai ai,
        Routing routing,
        Weather weather) {

    public record Jwt(String secret, Duration accessTtl, Duration refreshTtl, String issuer) {}

    public record Cookie(boolean secure) {}

    public record RateLimit(int authPerWindow, Duration authWindow, int aiPerWindow, Duration aiWindow) {}

    public record Bootstrap(String adminEmail, String adminPassword) {}

    public record Ai(String anthropicApiKey, String model, String effort, Duration timeout) {}

    public record Routing(String provider, String osrmBaseUrl, Duration timeout) {}

    public record Weather(String provider, String openMeteoBaseUrl, Duration cacheTtl, Duration timeout) {}
}
