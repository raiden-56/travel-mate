package com.travelmate.admin;

import com.travelmate.support.ApiTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AdminPermissionTest extends ApiTestBase {

    private Map<String, Object> destination(String name) {
        Map<String, Object> d = new HashMap<>();
        d.put("name", name);
        d.put("region", "Test region");
        d.put("state", "Karnataka");
        d.put("country", "India");
        d.put("latitude", 13.0);
        d.put("longitude", 75.0);
        d.put("summary", "Short summary");
        d.put("description", "Longer description");
        d.put("recommendedDaysMin", 1);
        d.put("recommendedDaysMax", 2);
        d.put("budgetPerDayMin", "1000");
        d.put("budgetPerDayMax", "2000");
        d.put("categorySlugs", List.of("beaches"));
        d.put("heroImageUrl", "https://upload.wikimedia.org/example.jpg");
        return d;
    }

    @Test
    void travelerIsForbiddenFromAdminEndpoints() throws Exception {
        Session t = register();
        mvc.perform(get("/api/v1/admin/stats").header("Authorization", bearer(t)))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
        mvc.perform(get("/api/v1/admin/users").header("Authorization", bearer(t))).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/admin/destinations").header("Authorization", bearer(t))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(destination("Nope"))))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/stats")).andExpect(status().isUnauthorized());
    }

    @Test
    void adminCreatesDraftThenPublishesDestination() throws Exception {
        Session admin = registerWithRole("ADMIN");
        mvc.perform(get("/api/v1/admin/stats").header("Authorization", bearer(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.destinationsPublished").value(org.hamcrest.Matchers.greaterThanOrEqualTo(10)));

        String name = "Test Cove " + System.nanoTime();
        var created = body(mvc.perform(post("/api/v1/admin/destinations").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(destination(name))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andReturn());
        String id = created.get("id").asText();
        String slug = created.get("slug").asText();

        // Draft is not public.
        mvc.perform(get("/api/v1/destinations/" + slug)).andExpect(status().isNotFound());
        // Publishing requires at least one attraction.
        mvc.perform(post("/api/v1/admin/destinations/" + id + "/publish").header("Authorization", bearer(admin)))
                .andExpect(status().isBadRequest());
        Map<String, Object> attraction = new HashMap<>();
        attraction.put("name", "Lighthouse");
        attraction.put("category", "VIEWPOINT");
        attraction.put("description", "A lighthouse");
        attraction.put("latitude", 13.01);
        attraction.put("longitude", 75.01);
        attraction.put("typicalDurationMinutes", 60);
        attraction.put("costMin", "0");
        attraction.put("costMax", "50");
        mvc.perform(post("/api/v1/admin/destinations/" + id + "/attractions").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(attraction)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.costMax").value("50.00"));
        mvc.perform(post("/api/v1/admin/destinations/" + id + "/publish").header("Authorization", bearer(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PUBLISHED"));
        mvc.perform(get("/api/v1/destinations/" + slug)).andExpect(status().isOk())
                .andExpect(jsonPath("$.attractions.length()").value(1));

        mvc.perform(get("/api/v1/admin/audit-logs").header("Authorization", bearer(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isArray());
    }

    @Test
    void adminCannotSuspendSelfOrSuperAdminButCanSuspendTraveler() throws Exception {
        Session admin = registerWithRole("ADMIN");
        Session superAdmin = registerWithRole("SUPER_ADMIN");
        Session traveler = register();
        mvc.perform(post("/api/v1/admin/users/" + admin.userId() + "/suspend").header("Authorization", bearer(admin)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/admin/users/" + superAdmin.userId() + "/suspend").header("Authorization", bearer(admin)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/admin/users/" + traveler.userId() + "/suspend").header("Authorization", bearer(admin))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(Map.of("reason", "test"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("SUSPENDED"));
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("email", traveler.email(), "password", "secret123"))))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("ACCOUNT_SUSPENDED"));
    }
}
