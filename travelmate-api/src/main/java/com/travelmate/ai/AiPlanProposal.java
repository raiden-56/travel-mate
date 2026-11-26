package com.travelmate.ai;

import com.travelmate.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** A stored plan proposal. Nothing reaches a trip until the user applies it. */
@Entity
@Table(name = "ai_plan_proposals")
public class AiPlanProposal extends BaseEntity {

    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(name = "trip_id") private UUID tripId;
    @Column(nullable = false, length = 20) private String engine;
    @Column(nullable = false, length = 1_000_000) private String payload;
    @Column(name = "applied_at") private Instant appliedAt;

    protected AiPlanProposal() {}

    public AiPlanProposal(UUID userId, UUID tripId, String engine, String payload) {
        this.userId = userId;
        this.tripId = tripId;
        this.engine = engine;
        this.payload = payload;
    }

    public UUID getUserId() { return userId; }
    public UUID getTripId() { return tripId; }
    public String getPayload() { return payload; }
    public void setPayload(String payload) { this.payload = payload; }
    public Instant getAppliedAt() { return appliedAt; }
    public void markApplied(Instant at) { this.appliedAt = at; }
}
