package com.travelmate.users;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public record UserDto(UUID id, String email, String displayName, String avatarUrl, boolean emailVerified,
                      String status, List<String> roles, List<String> permissions, Instant createdAt) {

    public static UserDto of(User u, Set<String> permissions) {
        return new UserDto(u.getId(), u.getEmail(), u.getDisplayName(), u.getAvatarUrl(), u.isEmailVerified(),
                u.getStatus(), u.getRoles().stream().sorted().toList(), permissions.stream().sorted().toList(),
                u.getCreatedAt());
    }
}
