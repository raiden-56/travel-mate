package com.travelmate.itinerary;

import com.travelmate.common.Geo;
import com.travelmate.common.Money;
import com.travelmate.itinerary.ItineraryDtos.ItineraryWarning;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Advisory checks on an itinerary. Pure function of its inputs: it never changes the schedule.
 * Transfer checks use straight-line distance and say so; they flag only clearly impossible gaps.
 */
public final class ItineraryValidator {

    public static final int MAX_ACTIVITIES_PER_DAY = 6;
    public static final int MAX_SCHEDULED_MINUTES_PER_DAY = 14 * 60;
    public static final double LONG_TRANSFER_KM = 100;
    /** Straight-line km are multiplied by this to approximate road distance… */
    static final double ROAD_FACTOR = 1.3;
    /** …and divided by this optimistic speed to get a lower bound on travel time. */
    static final double FAST_ROAD_KMH = 60;

    private static final Set<String> NOT_ACTIVITIES = Set.of("RESTAURANT", "HOTEL", "REST", "TRANSPORTATION");
    private static final Set<String> MULTI_HOUR_OK = Set.of("HOTEL", "REST", "TRANSPORTATION", "EVENT");

    public record Context(int dayCount, BigDecimal budget, String currency) {}

    private ItineraryValidator() {}

    public static List<ItineraryWarning> validate(Context ctx, List<ItineraryItem> all) {
        List<ItineraryWarning> out = new ArrayList<>();
        List<ItineraryItem> items = all.stream().filter(ItineraryItem::countsTowardCost).toList();
        Map<Integer, List<ItineraryItem>> byDay = items.stream().collect(Collectors.groupingBy(
                ItineraryItem::getDayNumber, TreeMap::new, Collectors.toList()));

        for (var entry : byDay.entrySet()) {
            int day = entry.getKey();
            List<ItineraryItem> dayItems = entry.getValue().stream()
                    .sorted(Comparator.comparingInt(ItineraryItem::getPosition)).toList();

            if (day > ctx.dayCount()) {
                out.add(warn("OUT_OF_RANGE_DAY", "WARNING", day,
                        "Day " + day + " is after the last day of the trip (" + ctx.dayCount() + " days).", ids(dayItems)));
            }
            for (ItineraryItem i : dayItems) checkDuration(out, i);
            checkOverlaps(out, day, dayItems);
            checkTransfers(out, day, dayItems);
            checkLoad(out, day, dayItems);
        }
        checkBudget(out, ctx, items);
        return out;
    }

    static LocalTime effectiveEnd(ItineraryItem i) {
        if (i.getStartTime() == null) return null;
        if (i.getEndTime() != null) return i.getEndTime();
        if (i.getDurationMinutes() != null) {
            LocalTime end = i.getStartTime().plusMinutes(i.getDurationMinutes());
            return end.isBefore(i.getStartTime()) ? LocalTime.MAX : end;
        }
        return null;
    }

    private static void checkDuration(List<ItineraryWarning> out, ItineraryItem i) {
        if (i.getStartTime() != null && i.getEndTime() != null && !i.getEndTime().isAfter(i.getStartTime())) {
            out.add(warn("UNREALISTIC_DURATION", "WARNING", i.getDayNumber(),
                    "\"" + i.getTitle() + "\" ends before it starts.", List.of(i.getId())));
            return;
        }
        Integer minutes = i.getDurationMinutes();
        if (minutes == null && i.getStartTime() != null && i.getEndTime() != null) {
            minutes = (int) java.time.Duration.between(i.getStartTime(), i.getEndTime()).toMinutes();
        }
        if (minutes != null && minutes > 12 * 60 && !MULTI_HOUR_OK.contains(i.getCategory())) {
            out.add(warn("UNREALISTIC_DURATION", "INFO", i.getDayNumber(),
                    "\"" + i.getTitle() + "\" is scheduled for over 12 hours.", List.of(i.getId())));
        }
    }

    private static void checkOverlaps(List<ItineraryWarning> out, int day, List<ItineraryItem> dayItems) {
        List<ItineraryItem> timed = dayItems.stream().filter(i -> i.getStartTime() != null && effectiveEnd(i) != null)
                .sorted(Comparator.comparing(ItineraryItem::getStartTime)).toList();
        for (int a = 0; a < timed.size(); a++) {
            for (int b = a + 1; b < timed.size(); b++) {
                ItineraryItem x = timed.get(a);
                ItineraryItem y = timed.get(b);
                if (!y.getStartTime().isBefore(effectiveEnd(x))) break;
                out.add(warn("OVERLAP", "WARNING", day,
                        "\"" + x.getTitle() + "\" overlaps with \"" + y.getTitle() + "\".", List.of(x.getId(), y.getId())));
            }
        }
    }

    private static void checkTransfers(List<ItineraryWarning> out, int day, List<ItineraryItem> dayItems) {
        List<ItineraryItem> located = dayItems.stream().filter(ItineraryItem::hasLocation).toList();
        for (int k = 1; k < located.size(); k++) {
            ItineraryItem prev = located.get(k - 1);
            ItineraryItem next = located.get(k);
            double km = Geo.haversineKm(prev.getLatitude().doubleValue(), prev.getLongitude().doubleValue(),
                    next.getLatitude().doubleValue(), next.getLongitude().doubleValue());
            if (km >= LONG_TRANSFER_KM) {
                out.add(warn("LONG_TRANSFER", "INFO", day, String.format(java.util.Locale.ROOT,
                        "\"%s\" and \"%s\" are about %.0f km apart in a straight line; the road trip will be longer.",
                        prev.getTitle(), next.getTitle(), km), List.of(prev.getId(), next.getId())));
            }
            LocalTime prevEnd = effectiveEnd(prev);
            if (prevEnd != null && next.getStartTime() != null && !next.getStartTime().isBefore(prevEnd)) {
                long gap = java.time.Duration.between(prevEnd, next.getStartTime()).toMinutes();
                double minTravel = km * ROAD_FACTOR / FAST_ROAD_KMH * 60;
                if (km >= 2 && gap < minTravel) {
                    out.add(warn("TIGHT_TRANSFER", "WARNING", day, String.format(java.util.Locale.ROOT,
                            "Only %d min between \"%s\" and \"%s\", which are about %.0f km apart (straight line, approximate). Allow more travel time.",
                            gap, prev.getTitle(), next.getTitle(), km), List.of(prev.getId(), next.getId())));
                }
            }
        }
    }

    private static void checkLoad(List<ItineraryWarning> out, int day, List<ItineraryItem> dayItems) {
        long activities = dayItems.stream().filter(i -> !NOT_ACTIVITIES.contains(i.getCategory())).count();
        int scheduled = dayItems.stream().filter(i -> !"HOTEL".equals(i.getCategory()))
                .mapToInt(i -> {
                    if (i.getDurationMinutes() != null) return i.getDurationMinutes();
                    LocalTime end = effectiveEnd(i);
                    return end == null ? 0 : (int) java.time.Duration.between(i.getStartTime(), end).toMinutes();
                }).sum();
        if (activities > MAX_ACTIVITIES_PER_DAY || scheduled > MAX_SCHEDULED_MINUTES_PER_DAY) {
            out.add(warn("DAY_OVERLOADED", "INFO", day, "Day " + day + " looks packed (" + activities
                    + " activities, about " + Math.round(scheduled / 60.0) + " hours planned). Consider moving something.",
                    ids(dayItems)));
        }
    }

    private static void checkBudget(List<ItineraryWarning> out, Context ctx, List<ItineraryItem> items) {
        if (ctx.budget() == null) return;
        BigDecimal total = items.stream()
                .filter(i -> i.getEstimatedCost() != null && ctx.currency().equals(i.getCurrency()))
                .map(ItineraryItem::getEstimatedCost).reduce(Money.zero(), BigDecimal::add);
        if (total.compareTo(ctx.budget()) > 0) {
            out.add(warn("OVER_BUDGET", "WARNING", null, "Estimated itinerary cost " + ctx.currency() + " "
                    + total.toPlainString() + " is above the trip budget of " + ctx.currency() + " "
                    + Money.of(ctx.budget()).toPlainString() + ".", List.of()));
        }
    }

    private static ItineraryWarning warn(String code, String severity, Integer day, String message, List<UUID> ids) {
        return new ItineraryWarning(code, severity, message, day, ids);
    }

    private static List<UUID> ids(List<ItineraryItem> items) {
        return items.stream().map(ItineraryItem::getId).toList();
    }
}
