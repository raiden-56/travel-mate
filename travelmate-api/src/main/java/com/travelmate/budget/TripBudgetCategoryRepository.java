package com.travelmate.budget;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface TripBudgetCategoryRepository extends JpaRepository<TripBudgetCategory, TripBudgetCategory.Key> {

    @Query("select b from TripBudgetCategory b where b.id.tripId = :tripId")
    List<TripBudgetCategory> findByTrip(@Param("tripId") UUID tripId);

    @Modifying
    @Query("delete from TripBudgetCategory b where b.id.tripId = :tripId")
    void deleteByTrip(@Param("tripId") UUID tripId);
}
