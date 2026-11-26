package com.travelmate.itinerary;

import com.travelmate.itinerary.ItineraryDtos.ItineraryWarning;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ItineraryValidatorTest {

    private static ItineraryItem item(int day, int pos, String title, String start, String end, String cost,
                                      Double lat, Double lng) {
        ItineraryItem i = new ItineraryItem();
        i.setId(UUID.randomUUID());
        i.setDayNumber(day);
        i.setPosition(pos);
        i.setTitle(title);
        i.setCategory("ATTRACTION");
        i.setCurrency("INR");
        if (start != null) i.setStartTime(LocalTime.parse(start));
        if (end != null) i.setEndTime(LocalTime.parse(end));
        if (cost != null) i.setEstimatedCost(new BigDecimal(cost));
        if (lat != null) {
            i.setLatitude(BigDecimal.valueOf(lat));
            i.setLongitude(BigDecimal.valueOf(lng));
        }
        return i;
    }

    private static List<String> codes(List<ItineraryWarning> ws) {
        return ws.stream().map(ItineraryWarning::code).toList();
    }

    private static final ItineraryValidator.Context CTX = new ItineraryValidator.Context(3, null, "INR");

    @Test
    void detectsOverlappingActivities() {
        ItineraryItem a = item(1, 0, "Om Beach", "09:00", "11:00", null, null, null);
        ItineraryItem b = item(1, 1, "Temple", "10:30", "11:30", null, null, null);
        List<ItineraryWarning> ws = ItineraryValidator.validate(CTX, List.of(a, b));
        assertThat(codes(ws)).contains("OVERLAP");
        ItineraryWarning overlap = ws.stream().filter(w -> w.code().equals("OVERLAP")).findFirst().orElseThrow();
        assertThat(overlap.itemIds()).containsExactlyInAnyOrder(a.getId(), b.getId());
        assertThat(overlap.dayNumber()).isEqualTo(1);
    }

    @Test
    void backToBackActivitiesDoNotOverlap() {
        ItineraryItem a = item(1, 0, "A", "09:00", "10:00", null, null, null);
        ItineraryItem b = item(1, 1, "B", "10:00", "11:00", null, null, null);
        assertThat(codes(ItineraryValidator.validate(CTX, List.of(a, b)))).doesNotContain("OVERLAP");
    }

    @Test
    void flagsBudgetExceededUsingExactDecimals() {
        var ctx = new ItineraryValidator.Context(2, new BigDecimal("1000.00"), "INR");
        var a = item(1, 0, "A", null, null, "500.01", null, null);
        var b = item(2, 0, "B", null, null, "500.00", null, null);
        assertThat(codes(ItineraryValidator.validate(ctx, List.of(a, b)))).contains("OVER_BUDGET");

        var c = item(2, 0, "C", null, null, "499.99", null, null);
        assertThat(codes(ItineraryValidator.validate(ctx, List.of(a, c)))).doesNotContain("OVER_BUDGET");
    }

    @Test
    void cancelledItemsDoNotCountTowardBudget() {
        var ctx = new ItineraryValidator.Context(1, new BigDecimal("100.00"), "INR");
        var a = item(1, 0, "A", null, null, "500.00", null, null);
        a.setStatus("CANCELLED");
        assertThat(codes(ItineraryValidator.validate(ctx, List.of(a)))).doesNotContain("OVER_BUDGET");
    }

    @Test
    void flagsTightTransferBetweenDistantStops() {
        // Gokarna to Hampi area: far apart, 15 minutes between them is impossible.
        var a = item(1, 0, "Om Beach", "09:00", "10:00", null, 14.5196, 74.3226);
        var b = item(1, 1, "Virupaksha Temple", "10:15", "11:00", null, 15.3350, 76.4594);
        List<String> c = codes(ItineraryValidator.validate(CTX, List.of(a, b)));
        assertThat(c).contains("TIGHT_TRANSFER", "LONG_TRANSFER");
    }

    @Test
    void flagsDaysAfterTripEndAndOverloadedDays() {
        var late = item(5, 0, "Late", null, null, null, null, null);
        var packed = new java.util.ArrayList<ItineraryItem>();
        for (int i = 0; i < 8; i++) packed.add(item(1, i, "Stop " + i, null, null, null, null, null));
        packed.add(late);
        List<String> c = codes(ItineraryValidator.validate(CTX, packed));
        assertThat(c).contains("OUT_OF_RANGE_DAY", "DAY_OVERLOADED");
    }

    @Test
    void endBeforeStartIsUnrealistic() {
        var a = item(1, 0, "Backwards", "11:00", "10:00", null, null, null);
        assertThat(codes(ItineraryValidator.validate(CTX, List.of(a)))).contains("UNREALISTIC_DURATION");
    }
}
