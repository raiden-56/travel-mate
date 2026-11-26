package com.travelmate.checklist;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ChecklistRepository extends JpaRepository<Checklist, UUID> {

    List<Checklist> findByTripIdOrderByCreatedAtAsc(UUID tripId);
}
