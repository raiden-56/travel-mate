package com.travelmate.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
public class HttpClientConfig {

    public static final String USER_AGENT = "TravelMate-dev/0.1";

    static RestClient build(RestClient.Builder builder, String baseUrl, Duration timeout) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Math.min(timeout.toMillis(), 5000));
        factory.setReadTimeout((int) timeout.toMillis());
        return builder.clone().baseUrl(baseUrl).requestFactory(factory)
                .defaultHeader("User-Agent", USER_AGENT).build();
    }

    @Bean
    public RestClient weatherRestClient(RestClient.Builder builder, AppProperties props) {
        return build(builder, props.weather().openMeteoBaseUrl(), props.weather().timeout());
    }

    @Bean
    public RestClient osrmRestClient(RestClient.Builder builder, AppProperties props) {
        return build(builder, props.routing().osrmBaseUrl(), props.routing().timeout());
    }
}
