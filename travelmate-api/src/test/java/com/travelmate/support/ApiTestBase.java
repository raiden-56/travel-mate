package com.travelmate.support;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.travelmate.users.User;
import com.travelmate.users.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class ApiTestBase {

    @Autowired protected MockMvc mvc;
    @Autowired protected ObjectMapper json;
    @Autowired protected UserRepository userRepository;

    protected record Session(String token, String refreshCookie, UUID userId, String email) {}

    protected Session register() throws Exception {
        String email = "user-" + UUID.randomUUID() + "@example.test";
        MvcResult res = mvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("email", email, "password", "secret123",
                                "displayName", "Test Traveller"))))
                .andExpect(status().isCreated()).andReturn();
        JsonNode body = json.readTree(res.getResponse().getContentAsString());
        String cookie = res.getResponse().getCookie("tm_refresh").getValue();
        return new Session(body.get("accessToken").asText(), cookie, UUID.fromString(body.at("/user/id").asText()), email);
    }

    /** Registers a user, grants it a role directly in the database, and logs in again for a fresh token. */
    protected Session registerWithRole(String role) throws Exception {
        Session s = register();
        User u = userRepository.findById(s.userId()).orElseThrow();
        u.getRoles().add(role);
        userRepository.save(u);
        MvcResult res = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("email", s.email(), "password", "secret123"))))
                .andExpect(status().isOk()).andReturn();
        JsonNode body = json.readTree(res.getResponse().getContentAsString());
        return new Session(body.get("accessToken").asText(), res.getResponse().getCookie("tm_refresh").getValue(),
                s.userId(), s.email());
    }

    protected static String bearer(Session s) {
        return "Bearer " + s.token();
    }

    protected JsonNode body(MvcResult r) throws Exception {
        return json.readTree(r.getResponse().getContentAsString());
    }

    protected String toJson(Object o) throws Exception {
        return json.writeValueAsString(o);
    }
}
