package com.travelmate.maps;

import com.travelmate.common.Provenance;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public final class MapDtos {

    private MapDtos() {}

    public record Point(
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double lat,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double lng) {}

    public record RouteRequest(@NotNull @Size(min = 2, max = 25) List<@Valid Point> points, String mode) {}

    public record Leg(double distanceKm, Double durationMinutes) {}

    public record RouteResult(Provenance provenance, double distanceKm, Double durationMinutes,
                              List<double[]> geometry, List<Leg> legs) {}

    public record OptimizeRequest(@NotNull @Size(min = 2, max = 25) List<@Valid Point> points,
                                  Boolean keepFirst, Boolean keepLast) {}

    public record OptimizeResult(Provenance provenance, List<Integer> order, double distanceKmBefore,
                                 double distanceKmAfter) {}
}
