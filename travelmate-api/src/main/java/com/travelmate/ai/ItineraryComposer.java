package com.travelmate.ai;

import com.travelmate.ai.PlanDtos.PlanRequest;
import com.travelmate.ai.PlanDtos.ProposedDay;
import com.travelmate.ai.PlanDtos.ProposedItem;
import com.travelmate.ai.PlannerModel.Context;
import com.travelmate.common.Geo;
import com.travelmate.destinations.Attraction;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Deterministic itinerary composition over the curated attraction catalogue:
 * score → select → order by proximity → split into days → schedule with meals, buffers and stays.
 * Every cost it produces is an estimate derived from catalogue ranges or stated per-person rates.
 */
public final class ItineraryComposer {

    public record Prefs(Set<String> keywords, List<String> interests, boolean family, boolean accessibilityNeeds,
                        boolean budgetTight, Set<UUID> preferred, Set<UUID> excluded,
                        List<String> mustIncludeCategories, boolean onlyPreferred) {

        public static Prefs from(PlanRequest req) {
            Set<String> kws = new LinkedHashSet<>();
            List<String> styles = req.styles() == null ? List.of() : req.styles();
            styles.forEach(s -> kws.addAll(STYLE_KEYWORDS.getOrDefault(s, Set.of())));
            boolean family = styles.contains("FAMILY");
            boolean tight = styles.contains("BUDGET") || styles.contains("BACKPACKING");
            return new Prefs(kws, req.interests() == null ? List.of() : req.interests().stream()
                    .map(s -> s.toLowerCase(Locale.ROOT).trim()).filter(s -> s.length() >= 3).toList(),
                    family, req.accessibility() != null && !req.accessibility().isBlank(), tight,
                    Set.of(), Set.of(), List.of(), false);
        }

        public Prefs with(Set<UUID> preferred, Set<UUID> excluded, List<String> mustInclude, boolean onlyPreferred,
                          boolean family, boolean tight, Set<String> extraKeywords) {
            Set<String> kws = new LinkedHashSet<>(keywords);
            kws.addAll(extraKeywords);
            return new Prefs(kws, interests, family || this.family, accessibilityNeeds, tight || budgetTight,
                    preferred, excluded, mustInclude, onlyPreferred);
        }
    }

    public record Composition(List<ProposedDay> days, List<String> assumptions, List<String> warnings) {}

    static final Map<String, Set<String>> STYLE_KEYWORDS = Map.ofEntries(
            Map.entry("ADVENTURE", Set.of("adventure", "trek", "rafting", "scuba", "kayaking", "caves", "snorkeling")),
            Map.entry("NATURE", Set.of("nature", "waterfall", "viewpoint", "wildlife", "mountains", "river")),
            Map.entry("CULTURAL", Set.of("temple", "heritage", "culture", "history", "museum", "fort", "church")),
            Map.entry("RELAXED", Set.of("beach", "sunset", "viewpoint", "cafes")),
            Map.entry("FOOD", Set.of("food", "market", "restaurant", "cafe", "vegetarian")),
            Map.entry("PHOTOGRAPHY", Set.of("photography", "viewpoint", "sunset", "sunrise")),
            Map.entry("FAMILY", Set.of("family")),
            Map.entry("COUPLE", Set.of("romantic", "sunset", "beach", "viewpoint")),
            Map.entry("BUDGET", Set.of()),
            Map.entry("LUXURY", Set.of("water-sports", "scuba", "island")),
            Map.entry("BACKPACKING", Set.of("trek", "market", "beach")),
            Map.entry("ROAD_TRIP", Set.of("viewpoint", "fort", "waterfall")));

    private static final int DAY_START_RELAXED = 9 * 60 + 30;
    private static final int DAY_START = 8 * 60 + 30;
    private static final int LUNCH_EARLIEST = 12 * 60 + 30;
    private static final int EVENING_EARLIEST = 16 * 60 + 30;
    private static final int DINNER_EARLIEST = 19 * 60 + 30;
    private static final int LATEST_MINUTE = 23 * 60 + 59;
    private static final double LOCAL_KMH = 30;
    private static final double ROAD_FACTOR = 1.3;

    private ItineraryComposer() {}

    public static int slotsPerDay(String pace) {
        if ("RELAXED".equals(pace)) return 2;
        if ("PACKED".equals(pace)) return 4;
        return 3;
    }

    static int weight(Attraction a) {
        return a.getTypicalDurationMinutes() >= 300 ? 2 : 1;
    }

    static boolean isActivityCategory(String itemCategory) {
        return !Set.of("RESTAURANT", "HOTEL", "REST", "TRANSPORTATION").contains(itemCategory);
    }

    /** Returns the keywords from prefs that this attraction matches. */
    static List<String> matches(Attraction a, Prefs p) {
        String hay = (a.getCategory() + "," + (a.getTags() == null ? "" : a.getTags()) + "," + a.getName())
                .toLowerCase(Locale.ROOT);
        List<String> out = new ArrayList<>();
        for (String kw : p.keywords()) if (hay.contains(kw)) out.add(kw);
        for (String i : p.interests()) if (hay.contains(i) && !out.contains(i)) out.add(i);
        return out;
    }

    static double score(Attraction a, Prefs p) {
        if (p.excluded().contains(a.getId())) return -1000;
        if (p.onlyPreferred() && !p.preferred().contains(a.getId())) return -1000;
        if (p.family() && !a.isFamilyFriendly()) return -1000;
        double s = 1;
        String hay = (a.getCategory() + "," + (a.getTags() == null ? "" : a.getTags()) + "," + a.getName())
                .toLowerCase(Locale.ROOT);
        for (String kw : p.keywords()) if (hay.contains(kw)) s += 2;
        for (String i : p.interests()) if (hay.contains(i)) s += 3;
        if (p.accessibilityNeeds() && !a.isFamilyFriendly()) s -= 5;
        double mid = a.getCostMin().add(a.getCostMax()).doubleValue() / 2;
        if (p.budgetTight()) s -= mid / 500.0;
        if (p.preferred().contains(a.getId())) s += 10;
        return s;
    }

    public static Composition compose(PlanRequest req, Context ctx, Prefs prefs, List<ProposedItem> fixed) {
        int days = req.days();
        int travelers = req.travelers();
        int slots = slotsPerDay(req.pace());
        boolean hasStart = req.startLocation() != null && !req.startLocation().isBlank();
        List<String> warnings = new ArrayList<>();
        List<String> assumptions = new ArrayList<>();

        Map<Integer, List<ProposedItem>> fixedByDay = new HashMap<>();
        for (ProposedItem f : fixed) fixedByDay.computeIfAbsent(f.dayNumber(), k -> new ArrayList<>()).add(f);
        Set<UUID> fixedAttractions = fixed.stream().map(ProposedItem::attractionId).filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());

        int[] capacity = new int[days + 1];
        int totalCapacity = 0;
        for (int d = 1; d <= days; d++) {
            int c = slots;
            if (hasStart && d == 1) c = Math.max(1, slots - 1);
            if (hasStart && d == days && days > 1) c = Math.max(1, c - 1);
            long fixedActs = fixedByDay.getOrDefault(d, List.of()).stream()
                    .filter(f -> isActivityCategory(f.category())).count();
            c = Math.max(0, c - (int) fixedActs);
            capacity[d] = c;
            totalCapacity += c;
        }

        List<Attraction> candidates = ctx.catalogue().stream()
                .filter(a -> !fixedAttractions.contains(a.getId()))
                .filter(a -> score(a, prefs) > -500)
                .sorted(Comparator.comparingDouble((Attraction a) -> -score(a, prefs)).thenComparing(Attraction::getName))
                .collect(Collectors.toCollection(ArrayList::new));

        List<Attraction> selected = new ArrayList<>();
        int used = 0;
        for (String cat : prefs.mustIncludeCategories()) {
            var match = candidates.stream().filter(a -> a.getCategory().equals(cat) && !selected.contains(a)).findFirst();
            if (match.isPresent()) {
                selected.add(match.get());
                used += weight(match.get());
            } else {
                warnings.add("TravelMate has no curated " + cat.toLowerCase(Locale.ROOT) + " for "
                        + ctx.destinationName() + " yet, so none was added.");
            }
        }
        for (Attraction a : candidates) {
            if (used >= totalCapacity) break;
            if (selected.contains(a)) continue;
            if (used + weight(a) > totalCapacity) continue;
            selected.add(a);
            used += weight(a);
        }
        if (ctx.catalogue().isEmpty()) {
            warnings.add("TravelMate has no curated places for " + ctx.destinationName()
                    + " yet. Add your own activities, or pick a destination from Explore.");
        } else if (selected.isEmpty() && totalCapacity > 0) {
            warnings.add("No catalogue places matched these preferences. Try fewer filters.");
        }

        // Order by proximity: nearest-neighbour tour from the destination centre.
        List<Attraction> tour = nearestNeighbourTour(selected,
                ctx.destination() == null ? null : new double[]{ctx.destination().lat(), ctx.destination().lng()});

        // Fill days in tour order, respecting capacity.
        Map<Integer, List<Attraction>> byDay = new HashMap<>();
        int day = 1;
        int load = 0;
        for (Attraction a : tour) {
            while (day <= days && load + weight(a) > capacity[day]) {
                day++;
                load = 0;
            }
            if (day > days) break;
            byDay.computeIfAbsent(day, k -> new ArrayList<>()).add(a);
            load += weight(a);
        }

        Set<UUID> selectedIds = selected.stream().map(Attraction::getId).collect(Collectors.toSet());
        List<ProposedDay> out = new ArrayList<>();
        for (int d = 1; d <= days; d++) {
            List<Attraction> acts = new ArrayList<>(byDay.getOrDefault(d, List.of()));
            acts.sort(Comparator.comparingInt(a -> timeRank(a.getBestTimeOfDay())));
            List<ProposedItem> items = scheduleDay(d, days, acts, fixedByDay.getOrDefault(d, List.of()), req, ctx,
                    prefs, selectedIds, hasStart);
            out.add(new ProposedDay(d, ctx.dateOf(d), dayTitle(d, days, acts, hasStart, ctx), items));
        }

        assumptions.add("Costs are estimates for " + travelers + " traveller" + (travelers == 1 ? "" : "s")
                + " based on typical ranges in TravelMate's curated data, not live prices.");
        assumptions.add("Gaps between stops are buffers estimated from straight-line distance; check the real route on the map.");
        assumptions.add("Opening hours are not verified. Confirm timings locally before you go.");
        assumptions.add("Stays are shown as a nightly " + accommodationLabel(req.accommodation())
                + " estimate; nothing is booked.");
        if (hasStart) {
            assumptions.add("Travel between " + req.startLocation().trim() + " and " + ctx.destinationName()
                    + " is not timed; check road, bus or train options. Day 1 sightseeing starts mid-afternoon.");
        }
        if (req.dietary() != null && !req.dietary().isBlank()) {
            assumptions.add("Meal blocks are placeholders. TravelMate has no verified restaurant data yet, so look for "
                    + req.dietary().trim() + " options locally.");
        }
        return new Composition(out, assumptions, warnings);
    }

    private static String dayTitle(int d, int days, List<Attraction> acts, boolean hasStart, Context ctx) {
        String names = acts.stream().limit(2).map(Attraction::getName).collect(Collectors.joining(" and "));
        if (d == 1 && hasStart) return names.isEmpty() ? "Arrive in " + ctx.destinationName() : "Arrive, then " + names;
        if (d == days && hasStart && days > 1) return names.isEmpty() ? "Head home" : names + ", then head home";
        return names.isEmpty() ? "Free day" : names;
    }

    static int timeRank(String bestTime) {
        return switch (bestTime == null ? "ANY" : bestTime) {
            case "MORNING" -> 0;
            case "AFTERNOON" -> 2;
            case "EVENING" -> 3;
            default -> 1;
        };
    }

    static List<Attraction> nearestNeighbourTour(List<Attraction> points, double[] origin) {
        List<Attraction> remaining = new ArrayList<>(points);
        List<Attraction> tour = new ArrayList<>();
        double lat = origin == null ? (remaining.isEmpty() ? 0 : remaining.get(0).lat()) : origin[0];
        double lng = origin == null ? (remaining.isEmpty() ? 0 : remaining.get(0).lng()) : origin[1];
        while (!remaining.isEmpty()) {
            final double fLat = lat, fLng = lng;
            Attraction next = remaining.stream()
                    .min(Comparator.comparingDouble(a -> Geo.haversineKm(fLat, fLng, a.lat(), a.lng()))).orElseThrow();
            tour.add(next);
            remaining.remove(next);
            lat = next.lat();
            lng = next.lng();
        }
        return tour;
    }

    private record Window(int start, int end) {}

    private static List<ProposedItem> scheduleDay(int day, int days, List<Attraction> acts, List<ProposedItem> fixed,
                                                  PlanRequest req, Context ctx, Prefs prefs, Set<UUID> selectedIds,
                                                  boolean hasStart) {
        String currency = ctx.currency();
        int travelers = req.travelers();
        List<Window> windows = new ArrayList<>();
        for (ProposedItem f : fixed) {
            if (f.startTime() == null) continue;
            int s = toMin(f.startTime());
            int e = f.endTime() != null ? toMin(f.endTime())
                    : s + (f.durationMinutes() != null ? f.durationMinutes() : 60);
            windows.add(new Window(s, Math.max(e, s + 15)));
        }
        List<ProposedItem> items = new ArrayList<>();
        int t = "RELAXED".equals(req.pace()) ? DAY_START_RELAXED : DAY_START;
        boolean lastDayReturn = hasStart && day == days && days > 1;

        if (hasStart && day == 1) {
            items.add(block(day, "Travel from " + req.startLocation().trim() + " to " + ctx.destinationName(),
                    "Check road, bus or train options and timings. Travel time is not estimated here.",
                    "TRANSPORTATION", t, null, null, currency,
                    "Gets you to " + ctx.destinationName()));
            t = Math.max(t, 14 * 60);
        }

        double[] prev = null;
        boolean lunchDone = false;
        for (Attraction a : acts) {
            int dur = a.getTypicalDurationMinutes();
            if (prev != null) {
                double km = Geo.haversineKm(prev[0], prev[1], a.lat(), a.lng());
                t += bufferMinutes(km);
            }
            if ("EVENING".equals(a.getBestTimeOfDay()) && t < EVENING_EARLIEST) t = EVENING_EARLIEST;
            if (!lunchDone && t >= LUNCH_EARLIEST - 30 && hasMorningOrMidday(items)) {
                int ls = nextFree(Math.max(t, LUNCH_EARLIEST), 60, windows);
                items.add(meal(day, "Lunch break", ls, 60, req, currency, true));
                lunchDone = true;
                t = ls + 60;
            }
            int start = nextFree(t, dur, windows);
            int end = Math.min(LATEST_MINUTE, start + dur);
            double kmFromPrev = prev == null ? -1 : Geo.haversineKm(prev[0], prev[1], a.lat(), a.lng());
            items.add(new ProposedItem(day, 0, a.getName(), a.getDescription(), itemCategoryOf(a), a.getId(),
                    a.getName(), a.lat(), a.lng(), toTime(start), toTime(end), dur,
                    attractionCost(a, travelers), currency, reason(a, prefs, ctx, kmFromPrev),
                    alternatives(a, ctx, selectedIds), false, null));
            t = end;
            prev = new double[]{a.lat(), a.lng()};
        }
        if (!lunchDone && (!acts.isEmpty() || !fixed.isEmpty()) && !(hasStart && day == 1 && acts.isEmpty())) {
            int ls = nextFree(Math.max(t, LUNCH_EARLIEST), 60, windows);
            if (ls < 15 * 60) items.add(meal(day, "Lunch break", ls, 60, req, currency, true));
        }
        if (lastDayReturn) {
            int rs = nextFree(Math.max(t + 30, 15 * 60), 30, windows);
            items.add(block(day, "Return to " + req.startLocation().trim(),
                    "Check road, bus or train options and timings. Travel time is not estimated here.",
                    "TRANSPORTATION", rs, null, null, currency, "Gets you home"));
        } else {
            int ds = nextFree(Math.max(t + 30, DINNER_EARLIEST), 75, windows);
            items.add(meal(day, "Dinner", ds, 75, req, currency, false));
            if (day < days) {
                int ss = Math.min(LATEST_MINUTE - 1, Math.max(ds + 90, 21 * 60 + 30));
                items.add(block(day, "Overnight stay (" + accommodationLabel(req.accommodation()) + ")",
                        "Choose a stay in " + ctx.destinationName() + ". Nothing is booked; the cost is a typical nightly estimate.",
                        "HOTEL", ss, null, stayCost(req), currency, "Nightly stay estimate"));
            }
        }

        List<ProposedItem> merged = new ArrayList<>(fixed);
        merged.addAll(items);
        merged.sort(Comparator.comparingInt((ProposedItem p) -> p.startTime() == null ? -1 : toMin(p.startTime())));
        List<ProposedItem> positioned = new ArrayList<>();
        for (int i = 0; i < merged.size(); i++) positioned.add(merged.get(i).withPosition(i));
        return positioned;
    }

    private static boolean hasMorningOrMidday(List<ProposedItem> items) {
        return items.stream().anyMatch(i -> isActivityCategory(i.category()));
    }

    private static int nextFree(int start, int duration, List<Window> windows) {
        int t = start;
        boolean moved = true;
        int guard = 0;
        while (moved && guard++ < 20) {
            moved = false;
            for (Window w : windows) {
                if (t < w.end() && t + duration > w.start()) {
                    t = w.end() + 10;
                    moved = true;
                }
            }
        }
        return Math.min(t, LATEST_MINUTE - 1);
    }

    static int bufferMinutes(double straightKm) {
        if (straightKm < 0.3) return 5;
        double minutes = straightKm * ROAD_FACTOR / LOCAL_KMH * 60;
        int rounded = (int) (Math.ceil(minutes / 5.0) * 5);
        return Math.max(10, Math.min(240, rounded));
    }

    static String itemCategoryOf(Attraction a) {
        return switch (a.getCategory()) {
            case "RESTAURANT", "CAFE" -> "RESTAURANT";
            case "ADVENTURE" -> "ACTIVITY";
            case "MARKET" -> "SHOPPING";
            default -> "ATTRACTION";
        };
    }

    static BigDecimal attractionCost(Attraction a, int travelers) {
        BigDecimal mid = a.getCostMin().add(a.getCostMax()).divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
        BigDecimal total = mid.multiply(BigDecimal.valueOf(travelers));
        return total.divide(BigDecimal.TEN, 0, RoundingMode.HALF_UP).multiply(BigDecimal.TEN).setScale(2, RoundingMode.HALF_UP);
    }

    static String tier(PlanRequest req) {
        String a = req.accommodation() == null ? "" : req.accommodation();
        List<String> styles = req.styles() == null ? List.of() : req.styles();
        if (a.equals("LUXURY") || (a.isEmpty() && styles.contains("LUXURY"))) return "LUXURY";
        if (a.equals("BUDGET") || a.equals("HOSTEL") || a.equals("CAMPING")
                || (a.isEmpty() && (styles.contains("BUDGET") || styles.contains("BACKPACKING")))) return "BUDGET";
        return "MIDRANGE";
    }

    /** Typical per-person meal estimates in INR by tier. Stated assumptions, not prices. */
    static BigDecimal mealCost(PlanRequest req, boolean lunch) {
        int perPerson = switch (tier(req)) {
            case "LUXURY" -> lunch ? 800 : 1500;
            case "BUDGET" -> lunch ? 150 : 250;
            default -> lunch ? 300 : 500;
        };
        return BigDecimal.valueOf((long) perPerson * req.travelers()).setScale(2, RoundingMode.HALF_UP);
    }

    /** Typical nightly stay estimates in INR. Per room (2 people) unless dorm/camping (per person). */
    static BigDecimal stayCost(PlanRequest req) {
        String a = req.accommodation() == null ? "" : req.accommodation();
        int travelers = req.travelers();
        int rooms = (travelers + 1) / 2;
        long total = switch (a) {
            case "HOSTEL" -> 700L * travelers;
            case "CAMPING" -> 1500L * travelers;
            case "HOMESTAY" -> 2500L * rooms;
            case "LUXURY" -> 9000L * rooms;
            case "BUDGET" -> 1500L * rooms;
            default -> switch (tier(req)) {
                case "LUXURY" -> 9000L * rooms;
                case "BUDGET" -> 1500L * rooms;
                default -> 3500L * rooms;
            };
        };
        return BigDecimal.valueOf(total).setScale(2, RoundingMode.HALF_UP);
    }

    static String accommodationLabel(String accommodation) {
        if (accommodation == null || accommodation.isBlank()) return "mid-range";
        return switch (accommodation) {
            case "BUDGET" -> "budget";
            case "LUXURY" -> "luxury";
            case "HOSTEL" -> "hostel";
            case "HOMESTAY" -> "homestay";
            case "CAMPING" -> "camping";
            default -> "mid-range";
        };
    }

    private static ProposedItem meal(int day, String title, int start, int dur, PlanRequest req, String currency,
                                     boolean lunch) {
        String diet = req.dietary() == null || req.dietary().isBlank() ? "" : " Look for " + req.dietary().trim() + " options.";
        return new ProposedItem(day, 0, title, "Pick a place nearby." + diet, "RESTAURANT", null, null, null, null,
                toTime(start), toTime(Math.min(LATEST_MINUTE, start + dur)), dur, mealCost(req, lunch), currency,
                "Typical " + tier(req).toLowerCase(Locale.ROOT) + " meal estimate per person × travellers",
                List.of(), false, null);
    }

    private static ProposedItem block(int day, String title, String description, String category, int start,
                                      Integer duration, BigDecimal cost, String currency, String reason) {
        return new ProposedItem(day, 0, title, description, category, null, null, null, null, toTime(start), null,
                duration, cost, currency, reason, List.of(), false, null);
    }

    private static String reason(Attraction a, Prefs prefs, Context ctx, double kmFromPrev) {
        List<String> m = matches(a, prefs);
        StringBuilder sb = new StringBuilder(m.isEmpty() ? "One of the notable places in " + ctx.destinationName()
                : "Matches your interest in " + String.join(", ", m.subList(0, Math.min(3, m.size()))));
        sb.append(". ");
        switch (a.getBestTimeOfDay()) {
            case "MORNING" -> sb.append("Best visited in the morning. ");
            case "AFTERNOON" -> sb.append("Works well in the afternoon. ");
            case "EVENING" -> sb.append("Best in the evening. ");
            default -> { }
        }
        if (kmFromPrev >= 0) {
            sb.append(String.format(Locale.ROOT, "About %.1f km from the previous stop (straight line). ", kmFromPrev));
        }
        if (a.getCostNote() != null) sb.append("Cost: ").append(a.getCostNote()).append('.');
        return sb.toString().trim();
    }

    private static List<String> alternatives(Attraction a, Context ctx, Set<UUID> selectedIds) {
        return ctx.catalogue().stream()
                .filter(o -> !o.getId().equals(a.getId()) && !selectedIds.contains(o.getId()))
                .sorted(Comparator.comparingInt((Attraction o) -> o.getCategory().equals(a.getCategory()) ? 0 : 1)
                        .thenComparingDouble(o -> Geo.haversineKm(a.lat(), a.lng(), o.lat(), o.lng())))
                .limit(2).map(Attraction::getName).toList();
    }

    static int toMin(LocalTime t) {
        return t.getHour() * 60 + t.getMinute();
    }

    static LocalTime toTime(int minutes) {
        int m = Math.max(0, Math.min(LATEST_MINUTE, minutes));
        return LocalTime.of(m / 60, m % 60);
    }

    /** Total of all estimated costs in the proposal currency. */
    public static BigDecimal total(List<ProposedDay> days, String currency) {
        return days.stream().flatMap(d -> d.items().stream())
                .filter(i -> i.estimatedCost() != null && currency.equals(i.currency()))
                .map(ProposedItem::estimatedCost).reduce(BigDecimal.ZERO.setScale(2), BigDecimal::add);
    }

    static Set<UUID> attractionIds(List<ProposedDay> days) {
        Set<UUID> out = new HashSet<>();
        days.forEach(d -> d.items().forEach(i -> { if (i.attractionId() != null) out.add(i.attractionId()); }));
        return out;
    }
}
