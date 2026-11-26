package com.travelmate.destinations;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface DestinationCategoryRepository extends JpaRepository<DestinationCategory, UUID> {

    List<DestinationCategory> findAllByOrderBySortOrderAsc();

    List<DestinationCategory> findBySlugIn(Collection<String> slugs);
}
