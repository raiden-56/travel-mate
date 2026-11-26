package com.travelmate.search;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface SearchQueryRepository extends JpaRepository<SearchQuery, UUID> {

    @Query("""
            select s.query from SearchQuery s where s.createdAt > :since
            group by s.query having count(s) >= 2 order by count(s) desc
            """)
    List<String> popularSince(@Param("since") Instant since, Pageable pageable);
}
