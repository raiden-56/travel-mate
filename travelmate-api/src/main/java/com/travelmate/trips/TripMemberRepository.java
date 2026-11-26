package com.travelmate.trips;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface TripMemberRepository extends JpaRepository<TripMember, UUID> {

    Optional<TripMember> findByTripIdAndUserId(UUID tripId, UUID userId);
}
