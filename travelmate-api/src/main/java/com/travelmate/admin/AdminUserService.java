package com.travelmate.admin;

import com.travelmate.admin.AdminDtos.AdminStats;
import com.travelmate.admin.AdminDtos.AdminUserRow;
import com.travelmate.audit.AuditService;
import com.travelmate.auth.AuthUser;
import com.travelmate.auth.RefreshTokenRepository;
import com.travelmate.common.ApiException;
import com.travelmate.common.PageResponse;
import com.travelmate.destinations.DestinationRepository;
import com.travelmate.destinations.DestinationService;
import com.travelmate.trips.TripRepository;
import com.travelmate.trips.TripStatus;
import com.travelmate.users.PermissionService;
import com.travelmate.users.User;
import com.travelmate.users.UserDto;
import com.travelmate.users.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;

@Service
public class AdminUserService {

    private final UserRepository users;
    private final TripRepository trips;
    private final DestinationRepository destinations;
    private final PermissionService permissions;
    private final RefreshTokenRepository refreshTokens;
    private final AuditService audit;

    public AdminUserService(UserRepository users, TripRepository trips, DestinationRepository destinations,
                            PermissionService permissions, RefreshTokenRepository refreshTokens, AuditService audit) {
        this.users = users;
        this.trips = trips;
        this.destinations = destinations;
        this.permissions = permissions;
        this.refreshTokens = refreshTokens;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public AdminStats stats() {
        Instant now = Instant.now();
        return new AdminStats(users.count(), users.countByLastLoginAtAfter(now.minus(Duration.ofDays(30))),
                users.countByCreatedAtAfter(now.minus(Duration.ofDays(7))), trips.countActive(),
                trips.countByStatus(TripStatus.UPCOMING), trips.countByStatus(TripStatus.COMPLETED),
                destinations.countByStatusAndDeletedAtIsNull("PUBLISHED"),
                destinations.countByStatusAndDeletedAtIsNull("DRAFT"));
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminUserRow> list(String q, String status, Integer page, Integer size) {
        if (status != null && !status.isBlank() && !Set.of("ACTIVE", "SUSPENDED").contains(status)) {
            throw ApiException.badRequest("status", "Unknown status");
        }
        var result = users.search(DestinationService.likePattern(q), status == null || status.isBlank() ? null : status,
                PageRequest.of(PageResponse.clampPage(page), PageResponse.clampSize(size)));
        return PageResponse.of(result, u -> new AdminUserRow(UserDto.of(u, permissions.permissionsFor(u.getRoles())),
                trips.countByOwner(u.getId()), u.getLastLoginAt()));
    }

    @Transactional
    public UserDto setSuspended(AuthUser actor, UUID targetId, boolean suspend, String reason) {
        if (actor.id().equals(targetId)) throw ApiException.forbidden("You cannot change your own account status.");
        User target = users.findById(targetId).orElseThrow(() -> ApiException.notFound("User"));
        if (target.getRoles().contains("SUPER_ADMIN") && !actor.isSuperAdmin()) {
            throw ApiException.forbidden("Only a super admin can change a super admin account.");
        }
        target.setStatus(suspend ? "SUSPENDED" : "ACTIVE");
        target.touch();
        if (suspend) refreshTokens.revokeAllForUser(targetId, Instant.now());
        users.flush();
        audit.record(suspend ? "user.suspend" : "user.reactivate", "USER", targetId,
                reason == null || reason.isBlank() ? null : reason.trim());
        return UserDto.of(target, permissions.permissionsFor(target.getRoles()));
    }
}
