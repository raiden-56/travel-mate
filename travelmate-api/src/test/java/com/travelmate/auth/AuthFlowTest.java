package com.travelmate.auth;

import com.travelmate.support.ApiTestBase;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthFlowTest extends ApiTestBase {

    @Test
    void registerSetsHttpOnlyStrictCookieAndReturnsTravelerPermissions() throws Exception {
        String email = "new-" + System.nanoTime() + "@example.test";
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("email", email, "password", "secret123", "displayName", "Asha"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.user.email").value(email))
                .andExpect(jsonPath("$.user.roles[0]").value("TRAVELER"))
                .andExpect(jsonPath("$.user.permissions[0]").value("trip:own"))
                .andExpect(jsonPath("$.expiresIn").value(900))
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.allOf(
                        org.hamcrest.Matchers.containsString("tm_refresh="),
                        org.hamcrest.Matchers.containsString("HttpOnly"),
                        org.hamcrest.Matchers.containsString("SameSite=Strict"),
                        org.hamcrest.Matchers.containsString("Path=/api/v1/auth"))));
    }

    @Test
    void duplicateEmailIsRejected() throws Exception {
        Session s = register();
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("email", s.email().toUpperCase(), "password", "secret123", "displayName", "Again"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_TAKEN"));
    }

    @Test
    void weakPasswordFailsValidationWithFieldErrors() throws Exception {
        mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("email", "weak@example.test", "password", "short", "displayName", "W"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors").isArray());
    }

    @Test
    void wrongPasswordIsUnauthorized() throws Exception {
        Session s = register();
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("email", s.email(), "password", "wrongpass1"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    void meRequiresTokenAndReturnsUser() throws Exception {
        Session s = register();
        mvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        mvc.perform(get("/api/v1/auth/me").header("Authorization", bearer(s)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(s.email()));
    }

    @Test
    void refreshRotatesTokenAndReuseRevokesTheFamily() throws Exception {
        Session s = register();

        // Missing CSRF header is refused.
        mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("tm_refresh", s.refreshCookie())))
                .andExpect(status().isForbidden());

        MvcResult first = mvc.perform(post("/api/v1/auth/refresh")
                        .cookie(new Cookie("tm_refresh", s.refreshCookie()))
                        .header("X-Requested-With", "travelmate"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andReturn();
        String rotated = first.getResponse().getCookie("tm_refresh").getValue();
        assertThat(rotated).isNotEqualTo(s.refreshCookie());

        // Re-using the old token is treated as theft: it fails and revokes the rotated one as well.
        mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("tm_refresh", s.refreshCookie()))
                        .header("X-Requested-With", "travelmate"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("tm_refresh", rotated))
                        .header("X-Requested-With", "travelmate"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevokesRefreshToken() throws Exception {
        Session s = register();
        mvc.perform(post("/api/v1/auth/logout").cookie(new Cookie("tm_refresh", s.refreshCookie()))
                        .header("X-Requested-With", "travelmate"))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("tm_refresh", s.refreshCookie()))
                        .header("X-Requested-With", "travelmate"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void forgotPasswordNeverRevealsWhetherAccountExists() throws Exception {
        mvc.perform(post("/api/v1/auth/password/forgot").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("email", "nobody@example.test"))))
                .andExpect(status().isAccepted());
    }
}
