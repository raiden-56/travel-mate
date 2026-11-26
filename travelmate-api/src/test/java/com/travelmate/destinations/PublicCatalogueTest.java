package com.travelmate.destinations;

import com.travelmate.support.ApiTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PublicCatalogueTest extends ApiTestBase {

    @Test
    void listsSeedDestinationsWithMoneyAsStrings() throws Exception {
        mvc.perform(get("/api/v1/destinations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(org.hamcrest.Matchers.greaterThanOrEqualTo(10)))
                .andExpect(jsonPath("$.items[0].seedData").value(true))
                .andExpect(jsonPath("$.items[0].budgetPerDayMin").isString())
                .andExpect(jsonPath("$.items[0].saved").value(false));
        mvc.perform(get("/api/v1/destinations").param("category", "waterfalls"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.slug == 'jog-falls')]").exists())
                .andExpect(jsonPath("$.items[?(@.slug == 'gokarna')]").doesNotExist());
    }

    @Test
    void detailIncludesAttractionsFaqsAndSimilar() throws Exception {
        mvc.perform(get("/api/v1/destinations/hampi"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Hampi"))
                .andExpect(jsonPath("$.attractions.length()").value(8))
                .andExpect(jsonPath("$.faqs.length()").value(2))
                .andExpect(jsonPath("$.travelTips").isArray())
                .andExpect(jsonPath("$.similar.length()").value(4))
                .andExpect(jsonPath("$.attractions[0].openingHoursVerified").value(false));
        mvc.perform(get("/api/v1/destinations/atlantis")).andExpect(status().isNotFound());
    }

    @Test
    void weatherIsUnavailableRatherThanInvented() throws Exception {
        mvc.perform(get("/api/v1/destinations/goa/weather"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("PROVIDER_UNAVAILABLE"));
    }

    @Test
    void searchSuggestAndNearby() throws Exception {
        mvc.perform(get("/api/v1/search").param("q", "beach"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.attractions.length()").isNotEmpty());
        mvc.perform(get("/api/v1/search").param("q", "a")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/search/suggest").param("q", "gok"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].type").value("DESTINATION"));
        mvc.perform(get("/api/v1/destinations/nearby").param("lat", "14.5").param("lng", "74.3").param("radiusKm", "100"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].slug").value("gokarna"))
                .andExpect(jsonPath("$[0].distanceKm").isNumber());
    }

    @Test
    void favoritesRoundTripAndSavedFlag() throws Exception {
        Session s = register();
        String id = body(mvc.perform(get("/api/v1/destinations/coorg")).andReturn()).get("id").asText();
        mvc.perform(post("/api/v1/favorites").header("Authorization", bearer(s)).contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("targetType", "DESTINATION", "targetId", id)))).andExpect(status().isCreated());
        mvc.perform(post("/api/v1/favorites").header("Authorization", bearer(s)).contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("targetType", "DESTINATION", "targetId", id)))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/destinations/coorg").header("Authorization", bearer(s)))
                .andExpect(jsonPath("$.saved").value(true));
        mvc.perform(get("/api/v1/favorites").header("Authorization", bearer(s)))
                .andExpect(jsonPath("$[0].destination.slug").value("coorg"));
        mvc.perform(delete("/api/v1/favorites/DESTINATION/" + id).header("Authorization", bearer(s)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/favorites").header("Authorization", bearer(s))).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void routeFallsBackToLabelledStraightLine() throws Exception {
        Session s = register();
        Map<String, Object> body = Map.of("points", List.of(Map.of("lat", 14.5196, "lng", 74.3226),
                Map.of("lat", 14.5323, "lng", 74.315)));
        mvc.perform(post("/api/v1/maps/route").header("Authorization", bearer(s))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.provenance.source").value("straight-line"))
                .andExpect(jsonPath("$.provenance.approximate").value(true))
                .andExpect(jsonPath("$.durationMinutes").doesNotExist());
    }

    @Test
    void checklistFromTemplateAndExpensesIdempotent() throws Exception {
        Session s = register();
        Map<String, Object> trip = new HashMap<>();
        trip.put("name", "Hills");
        trip.put("destinationSlug", "coorg");
        trip.put("dayCount", 2);
        String tripId = body(mvc.perform(post("/api/v1/trips").header("Authorization", bearer(s))
                .contentType(MediaType.APPLICATION_JSON).content(toJson(trip))).andReturn()).get("id").asText();
        mvc.perform(post("/api/v1/trips/" + tripId + "/checklists").header("Authorization", bearer(s))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(Map.of("name", "Packing", "templateKey", "trekking"))))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.totalCount").isNumber());
        mvc.perform(post("/api/v1/trips/" + tripId + "/checklists/suggest").header("Authorization", bearer(s)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isArray());

        Map<String, Object> e = Map.of("title", "Fuel", "amount", "1500.50", "category", "FUEL", "date", "2027-01-10",
                "clientRequestId", "abc-123");
        mvc.perform(post("/api/v1/trips/" + tripId + "/expenses").header("Authorization", bearer(s))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(e)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.amount").value("1500.50"));
        mvc.perform(post("/api/v1/trips/" + tripId + "/expenses").header("Authorization", bearer(s))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(e)))
                .andExpect(status().isOk());
        mvc.perform(put("/api/v1/trips/" + tripId + "/budget").header("Authorization", bearer(s))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("totalBudget", "10000", "categoryBudgets", Map.of("FUEL", "3000")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.spent").value("1500.50"))
                .andExpect(jsonPath("$.remaining").value("8499.50"));
    }
}
