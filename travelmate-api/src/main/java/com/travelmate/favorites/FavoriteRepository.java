package com.travelmate.favorites;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public interface FavoriteRepository extends JpaRepository<Favorite, UUID> {

    List<Favorite> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<Favorite> findByUserIdAndTargetTypeAndTargetId(UUID userId, String targetType, UUID targetId);

    @Query("select f.targetId from Favorite f where f.userId = :userId and f.targetType = :type")
    Set<UUID> findTargetIds(@Param("userId") UUID userId, @Param("type") String type);

    long countByUserId(UUID userId);
}
