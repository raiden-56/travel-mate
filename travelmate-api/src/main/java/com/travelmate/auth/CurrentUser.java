package com.travelmate.auth;

import com.travelmate.common.ApiException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;
import java.util.UUID;

public final class CurrentUser {

    private CurrentUser() {}

    public static Optional<AuthUser> optional() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthUser user) {
            return Optional.of(user);
        }
        return Optional.empty();
    }

    public static AuthUser require() {
        return optional().orElseThrow(() -> ApiException.unauthorized("UNAUTHORIZED", "Sign in to continue."));
    }

    public static UUID id() {
        return require().id();
    }

    public static Optional<UUID> optionalId() {
        return optional().map(AuthUser::id);
    }
}
