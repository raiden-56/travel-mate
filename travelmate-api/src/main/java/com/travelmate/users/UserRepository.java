package com.travelmate.users;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    @Query("""
            select u from User u
            where (:q is null or lower(u.email) like :q or lower(u.displayName) like :q)
              and (:status is null or u.status = :status)
            order by u.createdAt desc
            """)
    Page<User> search(@Param("q") String q, @Param("status") String status, Pageable pageable);

    long countByCreatedAtAfter(Instant since);

    long countByLastLoginAtAfter(Instant since);
}
