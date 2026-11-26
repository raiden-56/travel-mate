package com.travelmate.destinations;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DestinationRepository extends JpaRepository<Destination, UUID> {

    @Query("""
            select d from Destination d
            where d.deletedAt is null and d.status = 'PUBLISHED'
              and (:q is null or lower(d.name) like :q or lower(d.region) like :q
                   or lower(d.state) like :q or lower(d.summary) like :q)
              and (:category is null or d.id in
                   (select d2.id from Destination d2 join d2.categories c2 where c2.slug = :category))
              and (:budgetMax is null or d.budgetPerDayMin <= :budgetMax)
              and (:maxDays is null or d.recommendedDaysMin <= :maxDays)
              and (:featured is null or d.featured = :featured)
            """)
    Page<Destination> searchPublished(@Param("q") String q, @Param("category") String category,
                                      @Param("budgetMax") BigDecimal budgetMax, @Param("maxDays") Integer maxDays,
                                      @Param("featured") Boolean featured, Pageable pageable);

    @Query("""
            select d from Destination d
            where d.deletedAt is null
              and (:q is null or lower(d.name) like :q or lower(d.region) like :q or lower(d.slug) like :q)
              and (:status is null or d.status = :status)
            """)
    Page<Destination> searchAdmin(@Param("q") String q, @Param("status") String status, Pageable pageable);

    Optional<Destination> findBySlugAndDeletedAtIsNull(String slug);

    Optional<Destination> findByIdAndDeletedAtIsNull(UUID id);

    boolean existsBySlug(String slug);

    @Query("select d from Destination d where d.deletedAt is null and d.status = 'PUBLISHED'")
    List<Destination> findAllPublished();

    long countByStatusAndDeletedAtIsNull(String status);
}
