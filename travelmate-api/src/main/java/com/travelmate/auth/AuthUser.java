package com.travelmate.auth;

import java.util.Set;
import java.util.UUID;

/** The authenticated principal, rebuilt from a verified access token on every request. */
public record AuthUser(UUID id, String email, Set<String> roles, Set<String> permissions) {

    public boolean has(String permission) {
        return permissions.contains(permission);
    }

    public boolean isSuperAdmin() {
        return roles.contains("SUPER_ADMIN");
    }
}
