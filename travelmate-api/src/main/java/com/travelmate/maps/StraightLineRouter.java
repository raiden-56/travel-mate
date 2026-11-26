package com.travelmate.maps;

import com.travelmate.common.Geo;
import com.travelmate.common.Provenance;

import java.util.ArrayList;
import java.util.List;

/**
 * Fallback: great-circle distance between consecutive points. Duration is deliberately null —
 * we do not invent drive times from straight-line distance.
 */
public final class StraightLineRouter {

    public static final String SOURCE = "straight-line";
    public static final String NOTE = "Straight-line distance, not a road route. Road distance will be longer.";

    private StraightLineRouter() {}

    public static MapDtos.RouteResult route(List<MapDtos.Point> points) {
        List<MapDtos.Leg> legs = new ArrayList<>();
        List<double[]> geometry = new ArrayList<>();
        double total = 0;
        for (int i = 0; i < points.size(); i++) {
            MapDtos.Point p = points.get(i);
            geometry.add(new double[]{p.lat(), p.lng()});
            if (i > 0) {
                MapDtos.Point prev = points.get(i - 1);
                double km = Geo.haversineKm(prev.lat(), prev.lng(), p.lat(), p.lng());
                total += km;
                legs.add(new MapDtos.Leg(Geo.round1(km), null));
            }
        }
        return new MapDtos.RouteResult(Provenance.approximate(SOURCE, NOTE), Geo.round1(total), null, geometry, legs);
    }

    public static double pathKm(List<MapDtos.Point> points) {
        double total = 0;
        for (int i = 1; i < points.size(); i++) {
            total += Geo.haversineKm(points.get(i - 1).lat(), points.get(i - 1).lng(), points.get(i).lat(), points.get(i).lng());
        }
        return total;
    }
}
