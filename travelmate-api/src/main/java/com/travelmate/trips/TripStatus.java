package com.travelmate.trips;

import java.util.Map;
import java.util.Set;

public final class TripStatus {

    public static final String PLANNING = "PLANNING";
    public static final String UPCOMING = "UPCOMING";
    public static final String IN_PROGRESS = "IN_PROGRESS";
    public static final String COMPLETED = "COMPLETED";
    public static final String CANCELLED = "CANCELLED";

    public static final Set<String> ALL = Set.of(PLANNING, UPCOMING, IN_PROGRESS, COMPLETED, CANCELLED);

    private static final Map<String, Set<String>> TRANSITIONS = Map.of(
            PLANNING, Set.of(UPCOMING, CANCELLED),
            UPCOMING, Set.of(IN_PROGRESS, PLANNING, CANCELLED),
            IN_PROGRESS, Set.of(COMPLETED, CANCELLED),
            COMPLETED, Set.of(),
            CANCELLED, Set.of(PLANNING));

    private TripStatus() {}

    public static boolean canTransition(String from, String to) {
        return TRANSITIONS.getOrDefault(from, Set.of()).contains(to);
    }
}
