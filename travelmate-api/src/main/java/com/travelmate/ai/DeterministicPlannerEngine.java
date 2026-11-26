package com.travelmate.ai;

import com.travelmate.ai.InstructionParser.Intent;
import com.travelmate.ai.ItineraryComposer.Composition;
import com.travelmate.ai.ItineraryComposer.Prefs;
import com.travelmate.ai.PlanDtos.EngineInfo;
import com.travelmate.ai.PlanDtos.PlanRequest;
import com.travelmate.ai.PlanDtos.ProposedItem;
import com.travelmate.ai.PlannerModel.Context;
import com.travelmate.ai.PlannerModel.Draft;
import com.travelmate.ai.PlannerModel.ExistingItem;
import com.travelmate.common.Slugs;
import com.travelmate.destinations.Attraction;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Offline planner: builds real itineraries from TravelMate's curated catalogue without an LLM.
 * Labelled simulated=true so the UI can say "Offline planner — no AI key configured".
 */
@Component
public class DeterministicPlannerEngine implements AiPlannerEngine {

    public static final EngineInfo INFO = new EngineInfo("deterministic", "Offline planner — no AI key configured",
            null, true);

    private static final String HELP = "The offline planner understands: make it cheaper, keep it under an amount, "
            + "make it less hectic or busier, add adventure, add a beach/waterfall/temple/fort/viewpoint, remove a place, "
            + "add or remove a day, optimise the route, make it family-friendly, vegetarian meals, or change the stay type.";

    @Override
    public EngineInfo info() {
        return INFO;
    }

    @Override
    public Draft generate(PlanRequest req, Context ctx) {
        Composition c = ItineraryComposer.compose(req, ctx, Prefs.from(req), List.of());
        long activities = c.days().stream().flatMap(d -> d.items().stream())
                .filter(i -> i.attractionId() != null).count();
        String summary = req.days() + "-day plan for " + ctx.destinationName() + " with " + activities
                + " places, ordered to keep travel between stops short.";
        return new Draft(summary, c.days(), tips(ctx), c.assumptions(), c.warnings());
    }

    @Override
    public Draft modify(String instruction, PlanRequest baseline, Context ctx, List<ExistingItem> current) {
        Intent in = InstructionParser.parse(instruction);
        List<String> warnings = new ArrayList<>();
        List<String> changes = new ArrayList<>();
        if (!in.understood()) warnings.add("That request was not understood. " + HELP);

        PlanRequest req = baseline;
        if (in.dayDelta() != 0) {
            int days = Math.max(1, Math.min(14, req.days() + in.dayDelta()));
            if (days != req.days()) changes.add(in.dayDelta() > 0 ? "added a day" : "removed a day");
            req = req.withDays(days);
        }
        if (in.relax()) { req = req.withPace(stepPace(req.pace(), -1)); changes.add("lighter days"); }
        if (in.busier()) { req = req.withPace(stepPace(req.pace(), +1)); changes.add("more per day"); }
        if (in.family()) {
            req = req.withStyles(addStyle(req.styles(), "FAMILY"));
            if ("PACKED".equals(req.pace())) req = req.withPace("BALANCED");
            changes.add("family-friendly places only");
        }
        if (in.adventure()) { req = req.withStyles(addStyle(req.styles(), "ADVENTURE")); changes.add("more adventure"); }
        if (in.vegetarian()) { req = req.withDietary("vegetarian"); changes.add("vegetarian meal notes"); }
        if (in.accommodation() != null) {
            req = req.withAccommodation(in.accommodation());
            changes.add(ItineraryComposer.accommodationLabel(in.accommodation()) + " stays");
        }
        if (in.cheaper()) {
            req = req.withStyles(addStyle(req.styles(), "BUDGET"));
            if (in.accommodation() == null) req = req.withAccommodation(cheaperTier(ItineraryComposer.tier(req)));
            changes.add("lower cost");
        }
        if (in.budgetCap() != null) req = req.withBudget(in.budgetCap().toPlainString());

        // Classify current items.
        List<String> removeNames = in.removeNames();
        Set<UUID> removedIds = new HashSet<>();
        for (ExistingItem e : current) {
            boolean named = removeNames.stream().anyMatch(n -> e.title().toLowerCase(Locale.ROOT).contains(n)
                    || n.contains(e.title().toLowerCase(Locale.ROOT)));
            if (!named) continue;
            if (e.isProtected()) warnings.add("\"" + e.title() + "\" is locked, booked or completed, so it was kept.");
            else { removedIds.add(e.id()); changes.add("removed " + e.title()); }
        }
        Set<UUID> excludedAttractions = current.stream().filter(e -> removedIds.contains(e.id()))
                .map(ExistingItem::attractionId).filter(Objects::nonNull).collect(Collectors.toCollection(HashSet::new));
        for (String n : removeNames) {
            boolean inPlan = current.stream().anyMatch(e -> e.title().toLowerCase(Locale.ROOT).contains(n));
            if (!inPlan) {
                ctx.catalogue().stream().filter(a -> a.getName().toLowerCase(Locale.ROOT).contains(n))
                        .forEach(a -> excludedAttractions.add(a.getId()));
                warnings.add("\"" + n + "\" was not found in this itinerary.");
            }
        }

        int newDays = req.days();
        List<ProposedItem> fixed = new ArrayList<>();
        Set<UUID> preferred = new LinkedHashSet<>();
        for (ExistingItem e : current) {
            if (removedIds.contains(e.id())) continue;
            if (e.isProtected()) {
                if (e.dayNumber() > newDays) {
                    warnings.add("\"" + e.title() + "\" is on day " + e.dayNumber()
                            + ", after the new last day. It was kept; move or unlock it.");
                }
                fixed.add(carry(e, e.dayNumber(), true, ctx.currency()));
            } else if (e.userCreated()) {
                fixed.add(carry(e, Math.min(e.dayNumber(), newDays), false, ctx.currency()));
            } else if (e.attractionId() != null) {
                preferred.add(e.attractionId());
            }
        }
        boolean onlyReorder = in.optimizeRoute() && !in.cheaper() && in.addCategories().isEmpty() && in.dayDelta() == 0
                && !in.relax() && !in.busier() && !in.adventure() && !in.family() && removeNames.isEmpty();
        if (in.optimizeRoute()) changes.add("stops reordered to cut travel");
        if (!in.addCategories().isEmpty()) {
            changes.add("added " + in.addCategories().stream().map(c -> c.toLowerCase(Locale.ROOT))
                    .collect(Collectors.joining(", ")));
        }

        Set<String> extraKeywords = in.adventure() ? ItineraryComposer.STYLE_KEYWORDS.get("ADVENTURE") : Set.of();
        Prefs prefs = Prefs.from(req).with(preferred, excludedAttractions, in.addCategories(), onlyReorder,
                in.family(), in.cheaper(), extraKeywords);
        Composition comp = ItineraryComposer.compose(req, ctx, prefs, fixed);

        BigDecimal currentTotal = current.stream()
                .filter(e -> e.estimatedCost() != null && ctx.currency().equals(e.currency())
                        && !"CANCELLED".equals(e.status()) && !"SKIPPED".equals(e.status()))
                .map(ExistingItem::estimatedCost).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (in.cheaper()) {
            BigDecimal target = in.budgetCap() != null ? in.budgetCap()
                    : currentTotal.multiply(new BigDecimal("0.85")).setScale(2, RoundingMode.HALF_UP);
            int guard = 0;
            Set<UUID> excluded = new HashSet<>(excludedAttractions);
            while (ItineraryComposer.total(comp.days(), ctx.currency()).compareTo(target) > 0 && guard++ < 12) {
                var priciest = comp.days().stream().flatMap(d -> d.items().stream())
                        .filter(i -> i.attractionId() != null && i.sourceItemId() == null && i.estimatedCost() != null
                                && i.estimatedCost().signum() > 0)
                        .max((a, b) -> a.estimatedCost().compareTo(b.estimatedCost()));
                if (priciest.isEmpty()) break;
                excluded.add(priciest.get().attractionId());
                preferred.remove(priciest.get().attractionId());
                prefs = Prefs.from(req).with(preferred, excluded, in.addCategories(), false, in.family(), true, extraKeywords);
                comp = ItineraryComposer.compose(req, ctx, prefs, fixed);
            }
            BigDecimal after = ItineraryComposer.total(comp.days(), ctx.currency());
            if (after.compareTo(target) > 0) {
                warnings.add("Could not bring the estimate below " + ctx.currency() + " " + target.toPlainString()
                        + "; most of what remains is stays, meals or locked items. Try fewer days or a cheaper stay type.");
            }
        }

        List<String> allWarnings = new ArrayList<>(warnings);
        allWarnings.addAll(comp.warnings());
        String summary = changes.isEmpty() ? "No changes were made." : "Updated plan: " + String.join(", ", changes) + ".";
        return new Draft(summary, comp.days(), tips(ctx), comp.assumptions(), allWarnings);
    }

    static ProposedItem carry(ExistingItem e, int day, boolean locked, String currency) {
        return new ProposedItem(day, e.position(), e.title(), e.description(), e.category(), e.attractionId(),
                e.locationName(), e.latitude(), e.longitude(), e.startTime(), e.endTime(), e.durationMinutes(),
                e.estimatedCost(), e.currency() == null ? currency : e.currency(),
                locked ? "Kept: locked, booked or completed" : "Kept: added by you", List.of(), locked, e.id());
    }

    private static List<String> tips(Context ctx) {
        List<String> tips = new ArrayList<>();
        if (ctx.destination() != null) {
            tips.addAll(Slugs.split(ctx.destination().getTravelTips(), "\\|").stream().limit(4).toList());
            if (ctx.destination().getSafetyInfo() != null) tips.add(ctx.destination().getSafetyInfo());
        }
        return tips;
    }

    private static List<String> addStyle(List<String> styles, String style) {
        List<String> out = new ArrayList<>(styles == null ? List.of() : styles);
        if (!out.contains(style)) out.add(style);
        return out;
    }

    private static String stepPace(String pace, int delta) {
        List<String> order = List.of("RELAXED", "BALANCED", "PACKED");
        int idx = order.indexOf(pace == null ? "BALANCED" : pace);
        if (idx < 0) idx = 1;
        return order.get(Math.max(0, Math.min(2, idx + delta)));
    }

    private static String cheaperTier(String tier) {
        return switch (tier) {
            case "LUXURY" -> "MIDRANGE";
            default -> "BUDGET";
        };
    }

    /** Exposed for tests: the catalogue ids a draft uses. */
    static Set<UUID> catalogueIds(List<Attraction> catalogue) {
        return catalogue.stream().map(Attraction::getId).collect(Collectors.toSet());
    }
}
