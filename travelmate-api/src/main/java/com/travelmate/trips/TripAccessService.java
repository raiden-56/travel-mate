package com.travelmate.trips;

import com.travelmate.common.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Resource-level authorization for trips. Non-members get 404 so trip existence is not leaked;
 * members whose trip role lacks the permission get 403. Admin roles grant no implicit access.
 */
@Service
public class TripAccessService {

    public enum TripPermission { VIEW, EDIT, ADD_EXPENSE, MANAGE }

    public record Access(Trip trip, String role) {}

    private static final Map<String, Set<TripPermission>> ROLE_PERMISSIONS = Map.of(
            TripMember.OWNER, Set.of(TripPermission.values()),
            TripMember.CO_PLANNER, Set.of(TripPermission.VIEW, TripPermission.EDIT, TripPermission.ADD_EXPENSE),
            TripMember.TRAVELER, Set.of(TripPermission.VIEW, TripPermission.ADD_EXPENSE),
            TripMember.VIEWER, Set.of(TripPermission.VIEW));

    private final TripRepository trips;
    private final TripMemberRepository members;

    public TripAccessService(TripRepository trips, TripMemberRepository members) {
        this.trips = trips;
        this.members = members;
    }

    @Transactional(readOnly = true)
    public Access require(UUID tripId, UUID userId, TripPermission permission) {
        Trip trip = trips.findActive(tripId).orElseThrow(() -> ApiException.notFound("Trip"));
        TripMember member = members.findByTripIdAndUserId(tripId, userId)
                .orElseThrow(() -> ApiException.notFound("Trip"));
        if (!ROLE_PERMISSIONS.getOrDefault(member.getRole(), Set.of()).contains(permission)) {
            throw ApiException.forbidden("Your role on this trip does not allow this action.");
        }
        return new Access(trip, member.getRole());
    }
}
