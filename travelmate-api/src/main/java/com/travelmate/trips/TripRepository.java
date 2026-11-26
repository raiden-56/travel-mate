package com.travelmate.trips;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TripRepository extends JpaRepository<Trip, UUID> {

    @Query("select t from Trip t where t.id = :id and t.deletedAt is null")
    Optional<Trip> findActive(@Param("id") UUID id);

    @Query("""
            select t from Trip t
            where t.deletedAt is null
              and t.id in (select m.tripId from TripMember m where m.userId = :userId)
              and (:status is null or t.status = :status)
              and t.archived = :archived
            """)
    List<Trip> findForMember(@Param("userId") UUID userId, @Param("status") String status,
                             @Param("archived") boolean archived);

    @Query("select count(t) from Trip t where t.deletedAt is null and t.status = :status")
    long countByStatus(@Param("status") String status);

    @Query("select count(t) from Trip t where t.deletedAt is null")
    long countActive();

    @Query("select count(t) from Trip t where t.deletedAt is null and t.ownerId = :userId")
    long countByOwner(@Param("userId") UUID userId);
}
