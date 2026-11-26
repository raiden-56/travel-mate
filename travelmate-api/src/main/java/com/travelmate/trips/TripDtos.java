package com.travelmate.trips;

import com.travelmate.destinations.DestinationDtos.DestinationSummary;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;

public final class TripDtos {

    private TripDtos() {}

    public static final Set<String> TRAVEL_STYLES = Set.of("RELAXED", "ADVENTURE", "BUDGET", "LUXURY", "NATURE",
            "FOOD", "PHOTOGRAPHY", "FAMILY", "COUPLE", "BACKPACKING", "CULTURAL", "ROAD_TRIP");

    public record TripDto(UUID id, String name, DestinationSummary destination, String destinationName,
                          String startLocation, LocalDate startDate, LocalDate endDate, int dayCount,
                          int travelers, String tripType, BigDecimal budgetAmount, String currency,
                          String coverImageUrl, String description, String visibility, String status,
                          boolean archived, String myRole, int itemCount, BigDecimal estimatedCost,
                          BigDecimal spentAmount, long version, Instant createdAt, Instant updatedAt) {}

    public record TripUpsert(
            @NotBlank @Size(max = 120) String name,
            @Size(max = 120) String destinationSlug,
            @Size(max = 120) String destinationName,
            @Size(max = 120) String startLocation,
            LocalDate startDate,
            LocalDate endDate,
            @Min(1) @Max(60) Integer dayCount,
            @Min(1) @Max(50) Integer travelers,
            String tripType,
            String budgetAmount,
            @Size(max = 3) String currency,
            @Size(max = 1000) String coverImageUrl,
            @Size(max = 2000) String description,
            String visibility,
            Long version) {}

    public record StatusRequest(@NotBlank String status) {}
}
