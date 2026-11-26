package com.travelmate.trips;

import com.travelmate.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "trip_members")
public class TripMember extends BaseEntity {

    public static final String OWNER = "OWNER";
    public static final String CO_PLANNER = "CO_PLANNER";
    public static final String TRAVELER = "TRAVELER";
    public static final String VIEWER = "VIEWER";

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 20)
    private String role;

    protected TripMember() {}

    public TripMember(UUID tripId, UUID userId, String role) {
        this.tripId = tripId;
        this.userId = userId;
        this.role = role;
    }

    public UUID getTripId() { return tripId; }
    public UUID getUserId() { return userId; }
    public String getRole() { return role; }
}
