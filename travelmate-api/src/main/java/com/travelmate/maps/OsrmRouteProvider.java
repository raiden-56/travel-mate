package com.travelmate.maps;

import com.fasterxml.jackson.databind.JsonNode;
import com.travelmate.common.Geo;
import com.travelmate.common.Provenance;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Driving routes from an OSRM server (OSRM_BASE_URL). The public demo server is for light
 * development use only; production should point at a self-hosted or commercial OSRM.
 */
@Component
@ConditionalOnProperty(name = "travelmate.routing.provider", havingValue = "osrm", matchIfMissing = true)
public class OsrmRouteProvider implements RouteProvider {

    private static final Logger log = LoggerFactory.getLogger(OsrmRouteProvider.class);

    private final RestClient client;

    public OsrmRouteProvider(@Qualifier("osrmRestClient") RestClient client) {
        this.client = client;
    }

    @Override
    public Optional<MapDtos.RouteResult> route(List<MapDtos.Point> points) {
        String coords = points.stream()
                .map(p -> String.format(Locale.ROOT, "%.6f,%.6f", p.lng(), p.lat()))
                .collect(Collectors.joining(";"));
        try {
            JsonNode root = client.get()
                    .uri("/route/v1/driving/" + coords + "?overview=full&geometries=geojson&steps=false")
                    .retrieve().body(JsonNode.class);
            if (root == null || !"Ok".equals(root.path("code").asText()) || root.path("routes").isEmpty()) {
                return Optional.empty();
            }
            JsonNode route = root.path("routes").path(0);
            List<MapDtos.Leg> legs = new ArrayList<>();
            for (JsonNode leg : route.path("legs")) {
                legs.add(new MapDtos.Leg(Geo.round1(leg.path("distance").asDouble() / 1000.0),
                        (double) Math.round(leg.path("duration").asDouble() / 60.0)));
            }
            List<double[]> geometry = new ArrayList<>();
            for (JsonNode c : route.path("geometry").path("coordinates")) {
                geometry.add(new double[]{c.path(1).asDouble(), c.path(0).asDouble()});
            }
            return Optional.of(new MapDtos.RouteResult(Provenance.real("osrm"),
                    Geo.round1(route.path("distance").asDouble() / 1000.0),
                    (double) Math.round(route.path("duration").asDouble() / 60.0), geometry, legs));
        } catch (Exception e) {
            log.warn("OSRM routing failed: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
