package com.travelmate.favorites;

import com.travelmate.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "favorites")
public class Favorite extends BaseEntity {

    public static final String DESTINATION = "DESTINATION";
    public static final String ATTRACTION = "ATTRACTION";

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "target_type", nullable = false, length = 20)
    private String targetType;

    @Column(name = "target_id", nullable = false)
    private UUID targetId;

    protected Favorite() {}

    public Favorite(UUID userId, String targetType, UUID targetId) {
        this.userId = userId;
        this.targetType = targetType;
        this.targetId = targetId;
    }

    public UUID getUserId() { return userId; }
    public String getTargetType() { return targetType; }
    public UUID getTargetId() { return targetId; }
}
