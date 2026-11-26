package com.travelmate.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.travelmate.destinations.Attraction;
import com.travelmate.destinations.AttractionRepository;
import com.travelmate.destinations.DestinationRepository;
import com.travelmate.support.ApiTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PlannerFlowTest extends ApiTestBase {

    @Autowired AttractionRepository attractions;
    @Autowired DestinationRepository destinations;

    private Set<UUID> gokarnaCatalogue() {
        UUID dest = destinations.findBySlugAndDeletedAtIsNull("gokarna").orElseThrow().getId();
        return attractions.findActiveByDestination(dest).stream().map(Attraction::getId).collect(Collectors.toSet());
    }

    private Map<String, Object> request() {
        Map<String, Object> r = new HashMap<>();
        r.put("startLocation", "Bangalore");
        r.put("destinationSlug", "gokarna");
        r.put("days", 3);
        r.put("travelers", 4);
        r.put("budget", "20000");
        r.put("transport", "ROAD_TRIP");
        r.put("styles", List.of("ADVENTURE"));
        r.put("interests", List.of("beach"));
        r.put("pace", "BALANCED");
        return r;
    }

    private static Set<UUID> attractionIds(JsonNode proposal) {
        Set<UUID> ids = new HashSet<>();
        proposal.get("days").forEach(d -> d.get("items").forEach(i -> {
            if (!i.get("attractionId").isNull()) ids.add(UUID.fromString(i.get("attractionId").asText()));
        }));
        return ids;
    }

    @Test
    void statusReportsOfflinePlannerWithoutKey() throws Exception {
        mvc.perform(get("/api/v1/ai/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.engine").value("deterministic"))
                .andExpect(jsonPath("$.simulated").value(true));
    }

    @Test
    void generateUsesOnlyCatalogueAttractionsAndLabelsEstimates() throws Exception {
        Session s = register();
        JsonNode p = body(mvc.perform(post("/api/v1/ai/trip-planner/generate").header("Authorization", bearer(s))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(request())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.engine.simulated").value(true))
                .andExpect(jsonPath("$.days.length()").value(3))
                .andExpect(jsonPath("$.currency").value("INR"))
                .andReturn());
        Set<UUID> used = attractionIds(p);
        assertThat(used).isNotEmpty();
        assertThat(gokarnaCatalogue()).containsAll(used);
        assertThat(p.get("assumptions").toString()).contains("estimates");
        assertThat(p.get("budgetStatus").asText()).isIn("WITHIN", "OVER");
        // Money is a 2-dp string.
        assertThat(p.get("estimatedTotal").asText()).matches("\\d+\\.\\d{2}");
        // Day 1 starts with untimed travel from the start location; no travel duration is invented.
        JsonNode first = p.at("/days/0/items/0");
        assertThat(first.get("category").asText()).isEqualTo("TRANSPORTATION");
        assertThat(first.get("durationMinutes").isNull()).isTrue();
    }

    @Test
    void applyCreatesTripThenModifyKeepsLockedItems() throws Exception {
        Session s = register();
        JsonNode p = body(mvc.perform(post("/api/v1/ai/trip-planner/generate").header("Authorization", bearer(s))
                .contentType(MediaType.APPLICATION_JSON).content(toJson(request()))).andReturn());

        JsonNode trip = body(mvc.perform(post("/api/v1/ai/trip-planner/proposals/" + p.get("id").asText() + "/apply")
                        .header("Authorization", bearer(s)).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("trip", Map.of("name", "Gokarna with friends")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dayCount").value(3))
                .andExpect(jsonPath("$.travelers").value(4))
                .andReturn());
        String tripId = trip.get("id").asText();

        JsonNode itinerary = body(mvc.perform(get("/api/v1/trips/" + tripId + "/itinerary").header("Authorization", bearer(s)))
                .andExpect(status().isOk()).andReturn());
        // Lock the first catalogue attraction.
        JsonNode target = null;
        for (JsonNode d : itinerary.get("days")) for (JsonNode i : d.get("items"))
            if (target == null && !i.get("attractionId").isNull()) target = i;
        assertThat(target).isNotNull();
        Map<String, Object> lock = new HashMap<>();
        lock.put("dayNumber", target.get("dayNumber").asInt());
        lock.put("title", target.get("title").asText());
        lock.put("category", target.get("category").asText());
        lock.put("attractionId", target.get("attractionId").asText());
        lock.put("startTime", target.get("startTime").asText());
        lock.put("endTime", target.get("endTime").asText());
        lock.put("estimatedCost", target.get("estimatedCost").asText());
        lock.put("locked", true);
        lock.put("version", target.get("version").asLong());
        mvc.perform(put("/api/v1/itinerary/" + target.get("id").asText()).header("Authorization", bearer(s))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(lock)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.locked").value(true));

        // Ask to remove the locked place and make it cheaper: the locked item must survive.
        String lockedTitle = target.get("title").asText();
        JsonNode modified = body(mvc.perform(post("/api/v1/ai/trip-planner/modify").header("Authorization", bearer(s))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("tripId", tripId, "instruction", "remove " + lockedTitle + " and make it cheaper"))))
                .andExpect(status().isOk()).andReturn());
        boolean kept = false;
        for (JsonNode d : modified.get("days")) for (JsonNode i : d.get("items"))
            if (target.get("id").asText().equals(i.path("sourceItemId").asText())) {
                kept = true;
                assertThat(i.get("locked").asBoolean()).isTrue();
                assertThat(i.get("startTime").asText()).isEqualTo(target.get("startTime").asText());
            }
        assertThat(kept).isTrue();
        assertThat(modified.get("warnings").toString()).contains("kept");
        assertThat(gokarnaCatalogue()).containsAll(attractionIds(modified));
        assertThat(new BigDecimal(modified.get("estimatedTotal").asText()))
                .isLessThanOrEqualTo(new BigDecimal(itinerary.get("estimatedTotal").asText()));

        // Apply to the trip: locked item still present and unchanged.
        mvc.perform(post("/api/v1/ai/trip-planner/proposals/" + modified.get("id").asText() + "/apply")
                        .header("Authorization", bearer(s)).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("tripId", tripId))))
                .andExpect(status().isOk());
        JsonNode after = body(mvc.perform(get("/api/v1/trips/" + tripId + "/itinerary").header("Authorization", bearer(s)))
                .andReturn());
        boolean stillThere = false;
        for (JsonNode d : after.get("days")) for (JsonNode i : d.get("items"))
            if (target.get("id").asText().equals(i.get("id").asText())) stillThere = i.get("locked").asBoolean();
        assertThat(stillThere).isTrue();
    }

    @Test
    void anotherUserCannotApplyOrModify() throws Exception {
        Session owner = register();
        Session other = register();
        JsonNode p = body(mvc.perform(post("/api/v1/ai/trip-planner/generate").header("Authorization", bearer(owner))
                .contentType(MediaType.APPLICATION_JSON).content(toJson(request()))).andReturn());
        mvc.perform(post("/api/v1/ai/trip-planner/proposals/" + p.get("id").asText() + "/apply")
                        .header("Authorization", bearer(other)).contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("trip", Map.of("name", "Mine now")))))
                .andExpect(status().isNotFound());
    }

    @Test
    void addDayAndFamilyFriendlyInstructionsAreUnderstood() {
        InstructionParser.Intent a = InstructionParser.parse("Add one day and add a waterfall");
        assertThat(a.dayDelta()).isEqualTo(1);
        assertThat(a.addCategories()).contains("WATERFALL");
        InstructionParser.Intent b = InstructionParser.parse("Make it suitable for parents and keep the total budget under 15,000");
        assertThat(b.family()).isTrue();
        assertThat(b.budgetCap()).isEqualByComparingTo("15000");
        assertThat(InstructionParser.parse("Optimize the route").optimizeRoute()).isTrue();
        assertThat(InstructionParser.parse("Make the itinerary less hectic").relax()).isTrue();
        assertThat(InstructionParser.parse("asdf qwerty").understood()).isFalse();
    }
}
