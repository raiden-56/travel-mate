package com.travelmate.ai;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.core.JsonValue;
import com.anthropic.models.messages.JsonOutputFormat;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.OutputConfig;
import com.anthropic.models.messages.StopReason;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.travelmate.ai.PlanDtos.EngineInfo;
import com.travelmate.ai.PlanDtos.PlanRequest;
import com.travelmate.ai.PlanDtos.ProposedDay;
import com.travelmate.ai.PlanDtos.ProposedItem;
import com.travelmate.ai.PlannerModel.Context;
import com.travelmate.ai.PlannerModel.Draft;
import com.travelmate.ai.PlannerModel.EngineFailure;
import com.travelmate.ai.PlannerModel.ExistingItem;
import com.travelmate.config.AppProperties;
import com.travelmate.destinations.Attraction;
import com.travelmate.itinerary.ItineraryItem;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Claude-backed planner (enabled when ANTHROPIC_API_KEY is set). The model receives the curated
 * catalogue with ids and must answer in a strict JSON schema. Its output is then validated:
 * unknown attraction ids are dropped, coordinates come only from the catalogue, costs are
 * labelled estimates, and protected items are restored exactly if the model omits or alters them.
 */
@Component
public class AnthropicPlannerEngine implements AiPlannerEngine {

    private static final Logger log = LoggerFactory.getLogger(AnthropicPlannerEngine.class);

    // Structured output shape (parsed with Jackson after the schema-constrained response).
    record AiItem(String title, String description, String category, String attractionId, String sourceItemId,
                  String startTime, String endTime, Integer durationMinutes, String estimatedCost, String reason,
                  List<String> alternatives) {}

    record AiDay(Integer dayNumber, String title, List<AiItem> items) {}

    record AiPlan(String summary, List<AiDay> days, List<String> tips, List<String> assumptions, List<String> warnings) {}

    private static final String SYSTEM = """
            You are TravelMate's itinerary planner. You produce realistic day-by-day travel plans.
            Rules you must follow:
            - Only use places from the provided catalogue for sightseeing and activities, and reference them by their exact "id" in attractionId.
              You may add generic blocks without an attractionId only for meals ("RESTAURANT"), rest ("REST"),
              overnight stays ("HOTEL") and travel ("TRANSPORTATION"). Never name a specific hotel, restaurant or operator.
            - Group nearby places on the same day and avoid backtracking. Respect each place's typical duration and best time of day.
            - Leave realistic gaps between stops. Do not state exact travel times or distances; they are calculated separately.
            - Opening hours are not verified; do not claim them.
            - Costs are estimates for the whole group in the requested currency, as a plain decimal string like "1200.00",
              or an empty string when unknown. Never present a cost as a confirmed price.
            - Keep the total estimate within the budget when one is given; say so in warnings if impossible.
            - Times are 24-hour "HH:mm" strings, or an empty string when not scheduled.
            - When modifying an existing plan, every item marked "protected": true must appear unchanged with its sourceItemId,
              on the same day and at the same time. Keep other existing items (with their sourceItemId) unless the instruction asks to change them.
            - Each reason should explain briefly why the item fits this traveller.
            """;

    private final AppProperties props;
    private final ObjectMapper mapper;
    private volatile AnthropicClient client;

    public AnthropicPlannerEngine(AppProperties props, ObjectMapper mapper) {
        this.props = props;
        this.mapper = mapper;
    }

    public boolean isConfigured() {
        String key = props.ai().anthropicApiKey();
        return key != null && !key.isBlank();
    }

    @Override
    public EngineInfo info() {
        return new EngineInfo("anthropic", "Claude", props.ai().model(), false);
    }

    @Override
    public Draft generate(PlanRequest req, Context ctx) {
        Map<String, Object> input = new LinkedHashMap<>();
        input.put("task", "Create a new itinerary.");
        input.put("destination", ctx.destinationName());
        input.put("request", req);
        input.put("catalogue", catalogue(ctx));
        AiPlan plan = call(input);
        return toDraft(plan, req.days(), ctx, List.of());
    }

    @Override
    public Draft modify(String instruction, PlanRequest baseline, Context ctx, List<ExistingItem> current) {
        Map<String, Object> input = new LinkedHashMap<>();
        input.put("task", "Modify the existing itinerary according to the instruction. Return the full revised plan.");
        input.put("instruction", instruction);
        input.put("destination", ctx.destinationName());
        input.put("tripSettings", baseline);
        input.put("currentItinerary", current.stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("sourceItemId", e.id().toString());
            m.put("protected", e.isProtected());
            m.put("dayNumber", e.dayNumber());
            m.put("title", e.title());
            m.put("category", e.category());
            m.put("attractionId", e.attractionId() == null ? "" : e.attractionId().toString());
            m.put("startTime", e.startTime() == null ? "" : e.startTime().toString());
            m.put("endTime", e.endTime() == null ? "" : e.endTime().toString());
            m.put("estimatedCost", e.estimatedCost() == null ? "" : e.estimatedCost().toPlainString());
            return m;
        }).toList());
        input.put("catalogue", catalogue(ctx));
        AiPlan plan = call(input);
        int days = Math.max(baseline.days(), current.stream().mapToInt(ExistingItem::dayNumber).max().orElse(1));
        return toDraft(plan, Math.min(14, days + 1), ctx, current);
    }

    private List<Map<String, Object>> catalogue(Context ctx) {
        return ctx.catalogue().stream().map(a -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", a.getId().toString());
            m.put("name", a.getName());
            m.put("category", a.getCategory());
            m.put("description", a.getDescription());
            m.put("lat", a.lat());
            m.put("lng", a.lng());
            m.put("typicalDurationMinutes", a.getTypicalDurationMinutes());
            m.put("costPerPersonMin", a.getCostMin().toPlainString());
            m.put("costPerPersonMax", a.getCostMax().toPlainString());
            m.put("bestTimeOfDay", a.getBestTimeOfDay());
            m.put("tags", a.tagList());
            m.put("familyFriendly", a.isFamilyFriendly());
            return m;
        }).toList();
    }

    private AnthropicClient client() {
        if (client == null) {
            synchronized (this) {
                if (client == null) {
                    client = AnthropicOkHttpClient.builder()
                            .apiKey(props.ai().anthropicApiKey())
                            .timeout(props.ai().timeout())
                            .build();
                }
            }
        }
        return client;
    }

    private AiPlan call(Map<String, Object> input) {
        if (!isConfigured()) throw new EngineFailure("Anthropic API key not configured", null);
        try {
            MessageCreateParams params = MessageCreateParams.builder()
                    .model(props.ai().model())
                    .maxTokens(16000L)
                    .system(SYSTEM)
                    .outputConfig(OutputConfig.builder()
                            .effort(OutputConfig.Effort.of(props.ai().effort()))
                            .format(JsonOutputFormat.builder().schema(schema()).build())
                            .build())
                    // Server-side refusal fallback (routes a declined request to a fallback model).
                    .putAdditionalHeader("anthropic-beta", "server-side-fallback-2026-07-01")
                    .putAdditionalBodyProperty("fallbacks", JsonValue.from("default"))
                    .addUserMessage(mapper.writeValueAsString(input))
                    .build();
            Message response = client().messages().create(params);
            StopReason stop = response.stopReason().orElse(null);
            if (StopReason.REFUSAL.equals(stop)) throw new EngineFailure("The model declined this request", null);
            if (StopReason.MAX_TOKENS.equals(stop)) throw new EngineFailure("The model response was cut off", null);
            String text = response.content().stream().flatMap(b -> b.text().stream()).map(t -> t.text())
                    .collect(Collectors.joining());
            return mapper.readValue(text, AiPlan.class);
        } catch (EngineFailure e) {
            throw e;
        } catch (Exception e) {
            log.warn("Anthropic planner call failed: {}", e.getMessage());
            throw new EngineFailure("AI planner request failed", e);
        }
    }

    private static JsonOutputFormat.Schema schema() {
        Map<String, Object> str = Map.of("type", "string");
        Map<String, Object> strList = Map.of("type", "array", "items", str);
        Map<String, Object> item = Map.of(
                "type", "object",
                "additionalProperties", false,
                "required", List.of("title", "description", "category", "attractionId", "sourceItemId", "startTime",
                        "endTime", "durationMinutes", "estimatedCost", "reason", "alternatives"),
                "properties", Map.ofEntries(
                        Map.entry("title", str), Map.entry("description", str),
                        Map.entry("category", Map.of("type", "string", "enum", List.copyOf(ItineraryItem.CATEGORIES))),
                        Map.entry("attractionId", str), Map.entry("sourceItemId", str),
                        Map.entry("startTime", str), Map.entry("endTime", str),
                        Map.entry("durationMinutes", Map.of("type", "integer")),
                        Map.entry("estimatedCost", str), Map.entry("reason", str),
                        Map.entry("alternatives", strList)));
        Map<String, Object> day = Map.of(
                "type", "object",
                "additionalProperties", false,
                "required", List.of("dayNumber", "title", "items"),
                "properties", Map.of("dayNumber", Map.of("type", "integer"), "title", str,
                        "items", Map.of("type", "array", "items", item)));
        Map<String, Object> root = Map.of(
                "type", "object",
                "additionalProperties", false,
                "required", List.of("summary", "days", "tips", "assumptions", "warnings"),
                "properties", Map.of("summary", str, "days", Map.of("type", "array", "items", day),
                        "tips", strList, "assumptions", strList, "warnings", strList));
        JsonOutputFormat.Schema.Builder b = JsonOutputFormat.Schema.builder();
        root.forEach((k, v) -> b.putAdditionalProperty(k, JsonValue.from(v)));
        return b.build();
    }

    /** Validates model output against the catalogue and the protected items. */
    Draft toDraft(AiPlan plan, int maxDays, Context ctx, List<ExistingItem> current) {
        if (plan == null || plan.days() == null) throw new EngineFailure("Empty plan", null);
        Map<UUID, Attraction> catalogue = ctx.catalogue().stream()
                .collect(Collectors.toMap(Attraction::getId, Function.identity()));
        Map<UUID, ExistingItem> existing = current.stream()
                .collect(Collectors.toMap(ExistingItem::id, Function.identity()));
        List<String> warnings = new ArrayList<>(plan.warnings() == null ? List.of() : plan.warnings());
        Set<UUID> seenSources = new HashSet<>();
        Map<Integer, List<ProposedItem>> byDay = new LinkedHashMap<>();
        Map<Integer, String> titles = new LinkedHashMap<>();

        for (AiDay d : plan.days()) {
            int day = d.dayNumber() == null ? 1 : Math.max(1, Math.min(maxDays, d.dayNumber()));
            titles.putIfAbsent(day, d.title());
            for (AiItem i : d.items() == null ? List.<AiItem>of() : d.items()) {
                UUID sourceId = uuid(i.sourceItemId());
                ExistingItem src = sourceId == null ? null : existing.get(sourceId);
                if (src != null && !seenSources.add(src.id())) continue;
                if (src != null && src.isProtected()) {
                    byDay.computeIfAbsent(src.dayNumber(), k -> new ArrayList<>())
                            .add(DeterministicPlannerEngine.carry(src, src.dayNumber(), true, ctx.currency()));
                    continue;
                }
                UUID attractionId = uuid(i.attractionId());
                Attraction a = attractionId == null ? null : catalogue.get(attractionId);
                String category = ItineraryItem.CATEGORIES.contains(i.category()) ? i.category() : "CUSTOM";
                if (a == null && attractionId != null) {
                    warnings.add("\"" + i.title() + "\" is not in TravelMate's catalogue; its location is not verified.");
                }
                if (a == null && Set.of("ATTRACTION", "ACTIVITY").contains(category) && src == null) {
                    warnings.add("\"" + i.title() + "\" was suggested without a catalogue match; check it before you go.");
                }
                byDay.computeIfAbsent(day, k -> new ArrayList<>()).add(new ProposedItem(day, 0,
                        a != null ? a.getName() : safe(i.title(), 200),
                        a != null ? a.getDescription() : blankToNull(i.description()),
                        category, a == null ? null : a.getId(),
                        a != null ? a.getName() : (src != null ? src.locationName() : null),
                        a != null ? a.lat() : (src != null ? src.latitude() : null),
                        a != null ? a.lng() : (src != null ? src.longitude() : null),
                        time(i.startTime()), time(i.endTime()),
                        i.durationMinutes() == null || i.durationMinutes() <= 0 || i.durationMinutes() > 1440 ? null : i.durationMinutes(),
                        money(i.estimatedCost()), ctx.currency(), safe(i.reason(), 1000),
                        i.alternatives() == null ? List.of() : i.alternatives().stream().limit(3).toList(),
                        false, src == null ? null : src.id()));
            }
        }
        // Restore protected items the model left out.
        for (ExistingItem e : current) {
            if (e.isProtected() && !seenSources.contains(e.id())) {
                byDay.computeIfAbsent(e.dayNumber(), k -> new ArrayList<>())
                        .add(DeterministicPlannerEngine.carry(e, e.dayNumber(), true, ctx.currency()));
                warnings.add("\"" + e.title() + "\" is locked or booked and was kept as is.");
            }
        }
        int lastDay = Math.max(1, byDay.keySet().stream().mapToInt(Integer::intValue).max().orElse(1));
        List<ProposedDay> days = new ArrayList<>();
        for (int d = 1; d <= lastDay; d++) {
            List<ProposedItem> items = new ArrayList<>(byDay.getOrDefault(d, List.of()));
            items.sort((x, y) -> {
                if (x.startTime() == null && y.startTime() == null) return 0;
                if (x.startTime() == null) return -1;
                if (y.startTime() == null) return 1;
                return x.startTime().compareTo(y.startTime());
            });
            List<ProposedItem> positioned = new ArrayList<>();
            for (int p = 0; p < items.size(); p++) positioned.add(items.get(p).withPosition(p));
            days.add(new ProposedDay(d, ctx.dateOf(d), titles.getOrDefault(d, "Day " + d), positioned));
        }
        List<String> assumptions = new ArrayList<>(plan.assumptions() == null ? List.of() : plan.assumptions());
        assumptions.add("All costs are estimates, not quotes. Opening hours are not verified.");
        return new Draft(safe(plan.summary(), 1000), days, plan.tips() == null ? List.of() : plan.tips(), assumptions,
                warnings);
    }

    private static UUID uuid(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return UUID.fromString(raw.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static LocalTime time(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return LocalTime.parse(raw.trim());
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static BigDecimal money(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            BigDecimal v = new BigDecimal(raw.trim().replace(",", ""));
            if (v.signum() < 0 || v.compareTo(new BigDecimal("10000000")) > 0) return null;
            return v.setScale(2, RoundingMode.HALF_UP);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String safe(String s, int max) {
        if (s == null) return "";
        String t = s.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
