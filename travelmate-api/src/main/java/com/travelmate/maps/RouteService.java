package com.travelmate.maps;

import com.travelmate.common.Geo;
import com.travelmate.common.Provenance;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class RouteService {

    private final Optional<RouteProvider> provider;

    public RouteService(Optional<RouteProvider> provider) {
        this.provider = provider;
    }

    /** Road route when the provider answers, otherwise a clearly-labelled straight-line result. */
    public MapDtos.RouteResult route(List<MapDtos.Point> points) {
        return provider.flatMap(p -> p.route(points)).orElseGet(() -> StraightLineRouter.route(points));
    }

    /**
     * Orders stops to shorten the total path: nearest-neighbour construction then 2-opt improvement,
     * on straight-line distance. Good for a handful of stops in one area; not a road-network optimum.
     */
    public MapDtos.OptimizeResult optimize(List<MapDtos.Point> points, boolean keepFirst, boolean keepLast) {
        int n = points.size();
        double[][] dist = new double[n][n];
        for (int i = 0; i < n; i++)
            for (int j = 0; j < n; j++)
                dist[i][j] = Geo.haversineKm(points.get(i).lat(), points.get(i).lng(), points.get(j).lat(), points.get(j).lng());

        List<Integer> order = new ArrayList<>();
        boolean[] used = new boolean[n];
        int start = 0;
        if (!keepFirst) {
            // Without a fixed start, begin from the point farthest from the centroid (an "end" of the cluster).
            double cLat = points.stream().mapToDouble(MapDtos.Point::lat).average().orElse(0);
            double cLng = points.stream().mapToDouble(MapDtos.Point::lng).average().orElse(0);
            double best = -1;
            for (int i = 0; i < n; i++) {
                if (keepLast && i == n - 1) continue;
                double d = Geo.haversineKm(cLat, cLng, points.get(i).lat(), points.get(i).lng());
                if (d > best) { best = d; start = i; }
            }
        }
        order.add(start);
        used[start] = true;
        if (keepLast && n - 1 != start) used[n - 1] = true;
        while (order.size() < (keepLast && n - 1 != start ? n - 1 : n)) {
            int last = order.get(order.size() - 1);
            int next = -1;
            for (int j = 0; j < n; j++) if (!used[j] && (next < 0 || dist[last][j] < dist[last][next])) next = j;
            order.add(next);
            used[next] = true;
        }
        if (keepLast && n - 1 != start) order.add(n - 1);

        // 2-opt over the movable middle segment.
        int lo = 1;
        int hi = keepLast ? order.size() - 2 : order.size() - 1;
        boolean improved = true;
        int guard = 0;
        while (improved && guard++ < 200) {
            improved = false;
            for (int i = lo; i < hi; i++) {
                for (int k = i + 1; k <= hi; k++) {
                    double before = segment(dist, order, i, k);
                    reverse(order, i, k);
                    if (segment(dist, order, i, k) + 1e-9 < before) improved = true;
                    else reverse(order, i, k);
                }
            }
        }
        double before = StraightLineRouter.pathKm(points);
        List<MapDtos.Point> reordered = order.stream().map(points::get).toList();
        double after = StraightLineRouter.pathKm(reordered);
        return new MapDtos.OptimizeResult(
                Provenance.approximate("straight-line-optimizer",
                        "Order optimised on straight-line distance; check the road route before you go."),
                order, Geo.round1(before), Geo.round1(after));
    }

    private static double segment(double[][] dist, List<Integer> order, int i, int k) {
        double total = 0;
        int from = Math.max(0, i - 1);
        int to = Math.min(order.size() - 1, k + 1);
        for (int x = from + 1; x <= to; x++) total += dist[order.get(x - 1)][order.get(x)];
        return total;
    }

    private static void reverse(List<Integer> order, int i, int k) {
        while (i < k) {
            Integer tmp = order.get(i);
            order.set(i, order.get(k));
            order.set(k, tmp);
            i++;
            k--;
        }
    }
}
