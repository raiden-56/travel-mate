package com.travelmate.itinerary;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ItineraryItemRepository extends JpaRepository<ItineraryItem, UUID> {

    @Query("""
            select i from ItineraryItem i where i.tripId = :tripId and i.deletedAt is null
            order by i.dayNumber, i.position, i.startTime, i.createdAt
            """)
    List<ItineraryItem> findActiveByTrip(@Param("tripId") UUID tripId);

    @Query("select i from ItineraryItem i where i.tripId in :tripIds and i.deletedAt is null")
    List<ItineraryItem> findActiveByTrips(@Param("tripIds") Collection<UUID> tripIds);

    @Query("select i from ItineraryItem i where i.id = :id and i.deletedAt is null")
    Optional<ItineraryItem> findActive(@Param("id") UUID id);

    @Query("select coalesce(max(i.position), -1) from ItineraryItem i where i.tripId = :tripId and i.dayNumber = :day and i.deletedAt is null")
    int maxPosition(@Param("tripId") UUID tripId, @Param("day") int day);
}
