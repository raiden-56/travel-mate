package com.travelmate.budget;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ExpenseRepository extends JpaRepository<Expense, UUID> {

    @Query("select e from Expense e where e.tripId = :tripId and e.deletedAt is null order by e.date desc, e.createdAt desc")
    List<Expense> findActiveByTrip(@Param("tripId") UUID tripId);

    @Query("select e from Expense e where e.tripId in :tripIds and e.deletedAt is null")
    List<Expense> findActiveByTrips(@Param("tripIds") Collection<UUID> tripIds);

    @Query("select e from Expense e where e.id = :id and e.deletedAt is null")
    Optional<Expense> findActive(@Param("id") UUID id);

    Optional<Expense> findByTripIdAndClientRequestId(UUID tripId, String clientRequestId);
}
