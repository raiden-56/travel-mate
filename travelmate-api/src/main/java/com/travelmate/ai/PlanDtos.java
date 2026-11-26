package com.travelmate.ai;

import com.travelmate.trips.TripDtos.TripUpsert;
import jakarta.validation.Valid;
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

public final class PlanDtos {

    private PlanDtos() {}

    public record PlanRequest(
            @Size(max = 120) String startLocation,
            @Size(max = 120) String destinationSlug,
            @Size(max = 120) String destinationName,
            LocalDate startDate,
            Boolean flexibleDates,
            @NotNull @Min(1) @Max(14) Integer days,
            @NotNull @Min(1) @Max(20) Integer travelers,
            String budget,
            @Size(max = 3) String currency,
            String transport,
            String accommodation,
            @Size(max = 12) List<String> styles,
            @Size(max = 20) List<@Size(max = 60) String> interests,
            String pace,
            @Size(max = 200) String dietary,
            @Size(max = 300) String accessibility) {

        public PlanRequest withDays(int d) {
            return new PlanRequest(startLocation, destinationSlug, destinationName, startDate, flexibleDates, d,
                    travelers, budget, currency, transport, accommodation, styles, interests, pace, dietary, accessibility);
        }

        public PlanRequest withPace(String p) {
            return new PlanRequest(startLocation, destinationSlug, destinationName, startDate, flexibleDates, days,
                    travelers, budget, currency, transport, accommodation, styles, interests, p, dietary, accessibility);
        }

        public PlanRequest withStyles(List<String> s) {
            return new PlanRequest(startLocation, destinationSlug, destinationName, startDate, flexibleDates, days,
                    travelers, budget, currency, transport, accommodation, s, interests, pace, dietary, accessibility);
        }

        public PlanRequest withBudget(String b) {
            return new PlanRequest(startLocation, destinationSlug, destinationName, startDate, flexibleDates, days,
                    travelers, b, currency, transport, accommodation, styles, interests, pace, dietary, accessibility);
        }

        public PlanRequest withAccommodation(String a) {
            return new PlanRequest(startLocation, destinationSlug, destinationName, startDate, flexibleDates, days,
                    travelers, budget, currency, transport, a, styles, interests, pace, dietary, accessibility);
        }

        public PlanRequest withDietary(String d) {
            return new PlanRequest(startLocation, destinationSlug, destinationName, startDate, flexibleDates, days,
                    travelers, budget, currency, transport, accommodation, styles, interests, pace, d, accessibility);
        }
    }

    public record ProposedItem(int dayNumber, int position, String title, String description, String category,
                               UUID attractionId, String locationName, Double latitude, Double longitude,
                               LocalTime startTime, LocalTime endTime, Integer durationMinutes,
                               BigDecimal estimatedCost, String currency, String reason, List<String> alternatives,
                               boolean locked, UUID sourceItemId) {

        public ProposedItem at(int day, int pos, LocalTime start, LocalTime end) {
            return new ProposedItem(day, pos, title, description, category, attractionId, locationName, latitude,
                    longitude, start, end, durationMinutes, estimatedCost, currency, reason, alternatives, locked,
                    sourceItemId);
        }

        public ProposedItem withPosition(int pos) {
            return at(dayNumber, pos, startTime, endTime);
        }
    }

    public record ProposedDay(int dayNumber, LocalDate date, String title, List<ProposedItem> items) {}

    public record EngineInfo(String id, String label, String model, boolean simulated) {}

    public record PlanProposal(UUID id, EngineInfo engine, PlanRequest request, UUID tripId, String summary,
                               List<ProposedDay> days, BigDecimal estimatedTotal, String currency,
                               String budgetStatus, List<String> tips, List<String> assumptions,
                               List<String> warnings, Instant createdAt) {}

    public record ModifyRequest(@NotNull UUID tripId, @NotBlank @Size(max = 500) String instruction) {}

    public record ApplyRequest(UUID tripId, @Valid TripUpsert trip) {}
}
