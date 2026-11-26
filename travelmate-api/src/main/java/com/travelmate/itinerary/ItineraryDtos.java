package com.travelmate.itinerary;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public final class ItineraryDtos {

    private ItineraryDtos() {}

    public record ItineraryItemDto(UUID id, UUID tripId, int dayNumber, int position, LocalDate date, String title,
                                   String description, String category, String status, String priority,
                                   String locationName, Double latitude, Double longitude,
                                   LocalTime startTime, LocalTime endTime, Integer durationMinutes,
                                   BigDecimal estimatedCost, String currency, boolean costIsEstimate,
                                   String notes, String bookingReference, String transportMode,
                                   UUID attractionId, boolean locked, String source, String aiReason,
                                   long version, Instant createdAt, Instant updatedAt) {}

    public record ItineraryWarning(String code, String severity, String message, Integer dayNumber,
                                   List<UUID> itemIds) {}

    public record ItineraryDay(int dayNumber, LocalDate date, List<ItineraryItemDto> items, BigDecimal estimatedCost) {}

    public record ItineraryDto(UUID tripId, int dayCount, List<ItineraryDay> days, List<ItineraryWarning> warnings,
                               BigDecimal estimatedTotal, String currency) {}

    public record ItemRequest(
            @NotNull @Min(1) @Max(60) Integer dayNumber,
            @Min(0) Integer position,
            @NotBlank @Size(max = 200) String title,
            @Size(max = 2000) String description,
            String category,
            String status,
            String priority,
            @Size(max = 200) String locationName,
            @DecimalMin("-90") @DecimalMax("90") Double latitude,
            @DecimalMin("-180") @DecimalMax("180") Double longitude,
            LocalTime startTime,
            LocalTime endTime,
            @Min(0) @Max(1440) Integer durationMinutes,
            String estimatedCost,
            @Size(max = 3) String currency,
            Boolean costIsEstimate,
            @Size(max = 2000) String notes,
            @Size(max = 120) String bookingReference,
            @Size(max = 40) String transportMode,
            UUID attractionId,
            Boolean locked,
            Long version) {}

    public record DayOrder(@NotNull @Min(1) @Max(60) Integer dayNumber, @NotNull List<UUID> itemIds) {}

    public record OrderRequest(@NotNull @Size(min = 1, max = 60) List<DayOrder> days) {}
}
