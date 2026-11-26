package com.travelmate.maps;

import java.util.List;
import java.util.Optional;

/** Port for road routing. Providers return empty when they cannot answer; they never guess. */
public interface RouteProvider {

    Optional<MapDtos.RouteResult> route(List<MapDtos.Point> points);
}
