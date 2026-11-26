package com.travelmate.ai;

import com.travelmate.ai.PlanDtos.ProposedDay;
import com.travelmate.destinations.Attraction;
import com.travelmate.destinations.Destination;
import com.travelmate.itinerary.ItineraryItem;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/** Internal planning types shared by the engines. Entities never reach an engine directly except the catalogue. */
public final class PlannerModel {

    private PlannerModel() {}

    /** What the engine plans against: the destination, its verified catalogue, dates and currency. */
    public record Context(Destination destination, String destinationName, List<Attraction> catalogue,
                          LocalDate startDate, String currency) {

        public LocalDate dateOf(int day) {
            return startDate == null ? null : startDate.plusDays(day - 1L);
        }
    }

    /** Snapshot of an existing itinerary item, used when modifying a saved trip. */
    public record ExistingItem(UUID id, int dayNumber, int position, String title, String description,
                               String category, String status, UUID attractionId, String locationName,
                               Double latitude, Double longitude, LocalTime startTime, LocalTime endTime,
                               Integer durationMinutes, BigDecimal estimatedCost, String currency, boolean locked,
                               String source, boolean isProtected) {

        public static ExistingItem of(ItineraryItem i) {
            return new ExistingItem(i.getId(), i.getDayNumber(), i.getPosition(), i.getTitle(), i.getDescription(),
                    i.getCategory(), i.getStatus(), i.getAttractionId(), i.getLocationName(),
                    i.getLatitude() == null ? null : i.getLatitude().doubleValue(),
                    i.getLongitude() == null ? null : i.getLongitude().doubleValue(),
                    i.getStartTime(), i.getEndTime(), i.getDurationMinutes(), i.getEstimatedCost(), i.getCurrency(),
                    i.isLocked(), i.getSource(), i.isProtected());
        }

        /** Added by the user by hand (not by a planner) and still active. */
        public boolean userCreated() {
            return "USER".equals(source);
        }
    }

    /** Engine output before totals and persistence. */
    public record Draft(String summary, List<ProposedDay> days, List<String> tips, List<String> assumptions,
                        List<String> warnings) {}

    /** Thrown by an engine that cannot produce a plan; the service falls back to the deterministic engine. */
    public static class EngineFailure extends RuntimeException {
        public EngineFailure(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
