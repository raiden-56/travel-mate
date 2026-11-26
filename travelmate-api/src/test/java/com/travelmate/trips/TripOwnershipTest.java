package com.travelmate.trips;

import com.travelmate.support.ApiTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.HashMap;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class TripOwnershipTest extends ApiTestBase {

    private Map<String, Object> trip() {
        Map<String, Object> t = new HashMap<>();
        t.put("name", "Coast weekend");
        t.put("destinationSlug", "gokarna");
        t.put("startDate", "2027-01-10");
        t.put("endDate", "2027-01-12");
        t.put("travelers", 4);
        t.put("budgetAmount", "20000.00");
        return t;
    }

    @Test
    void ownerCanCrudAndOthersCannotSeeTheTrip() throws Exception {
        Session owner = register();
        Session other = register();

        var created = body(mvc.perform(post("/api/v1/trips").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(trip())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.dayCount").value(3))
                .andExpect(jsonPath("$.myRole").value("OWNER"))
                .andExpect(jsonPath("$.budgetAmount").value("20000.00"))
                .andExpect(jsonPath("$.destination.slug").value("gokarna"))
                .andReturn());
        String id = created.get("id").asText();

        mvc.perform(get("/api/v1/trips/" + id)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/trips/" + id).header("Authorization", bearer(other)))
                .andExpect(status().isNotFound());
        Map<String, Object> update = trip();
        update.put("name", "Hijacked");
        update.put("version", created.get("version").asLong());
        mvc.perform(put("/api/v1/trips/" + id).header("Authorization", bearer(other))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(update)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/trips/" + id + "/itinerary").header("Authorization", bearer(other)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/trips/" + id + "/budget").header("Authorization", bearer(other)))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/v1/trips/" + id).header("Authorization", bearer(other)))
                .andExpect(status().isNotFound());

        mvc.perform(get("/api/v1/trips").header("Authorization", bearer(other)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));

        update.put("name", "Renamed");
        mvc.perform(put("/api/v1/trips/" + id).header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(update)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Renamed"));
        // Stale version is a conflict.
        mvc.perform(put("/api/v1/trips/" + id).header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(update)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONFLICT"));

        mvc.perform(delete("/api/v1/trips/" + id).header("Authorization", bearer(owner)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/trips/" + id).header("Authorization", bearer(owner)))
                .andExpect(status().isNotFound());
    }

    @Test
    void statusTransitionsAreValidated() throws Exception {
        Session owner = register();
        Map<String, Object> t = trip();
        t.remove("startDate");
        t.remove("endDate");
        t.put("dayCount", 2);
        String id = body(mvc.perform(post("/api/v1/trips").header("Authorization", bearer(owner))
                .contentType(MediaType.APPLICATION_JSON).content(toJson(t))).andReturn()).get("id").asText();
        mvc.perform(post("/api/v1/trips/" + id + "/status").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(Map.of("status", "UPCOMING"))))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/trips/" + id + "/status").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(Map.of("status", "COMPLETED"))))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/trips/" + id + "/status").header("Authorization", bearer(owner))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(Map.of("status", "CANCELLED"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"));
    }
}
