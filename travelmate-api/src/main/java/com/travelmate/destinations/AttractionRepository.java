package com.travelmate.destinations;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AttractionRepository extends JpaRepository<Attraction, UUID> {

    @Query("select a from Attraction a where a.destination.id = :destinationId and a.deletedAt is null order by a.name")
    List<Attraction> findActiveByDestination(@Param("destinationId") UUID destinationId);

    @Query("select a from Attraction a where a.id in :ids and a.deletedAt is null")
    List<Attraction> findActiveByIds(@Param("ids") Collection<UUID> ids);

    @Query("select a from Attraction a where a.id = :id and a.deletedAt is null")
    Optional<Attraction> findActive(@Param("id") UUID id);

    @Query("""
            select a from Attraction a join a.destination d
            where a.deletedAt is null and d.deletedAt is null and d.status = 'PUBLISHED'
              and (lower(a.name) like :q or lower(a.tags) like :q or lower(a.category) like :q)
            order by a.name
            """)
    List<Attraction> searchPublished(@Param("q") String q, Pageable pageable);

    boolean existsByDestinationIdAndSlug(UUID destinationId, String slug);
}
