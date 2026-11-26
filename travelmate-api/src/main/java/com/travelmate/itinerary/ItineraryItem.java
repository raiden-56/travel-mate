package com.travelmate.itinerary;

import com.travelmate.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalTime;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "itinerary_items")
public class ItineraryItem extends BaseEntity {

    public static final Set<String> CATEGORIES = Set.of("ATTRACTION", "RESTAURANT", "HOTEL", "ACTIVITY",
            "TRANSPORTATION", "SHOPPING", "REST", "EVENT", "CUSTOM");
    public static final Set<String> STATUSES = Set.of("PLANNED", "BOOKED", "COMPLETED", "SKIPPED", "CANCELLED");
    public static final Set<String> PRIORITIES = Set.of("LOW", "MEDIUM", "HIGH");

    @Column(name = "trip_id", nullable = false) private UUID tripId;
    @Column(name = "day_number", nullable = false) private int dayNumber;
    @Column(nullable = false) private int position;
    @Column(nullable = false, length = 200) private String title;
    @Column(length = 2000) private String description;
    @Column(nullable = false, length = 20) private String category = "CUSTOM";
    @Column(nullable = false, length = 20) private String status = "PLANNED";
    @Column(nullable = false, length = 10) private String priority = "MEDIUM";
    @Column(name = "location_name", length = 200) private String locationName;
    @Column(precision = 9, scale = 6) private BigDecimal latitude;
    @Column(precision = 9, scale = 6) private BigDecimal longitude;
    @Column(name = "start_time") private LocalTime startTime;
    @Column(name = "end_time") private LocalTime endTime;
    @Column(name = "duration_minutes") private Integer durationMinutes;
    @Column(name = "estimated_cost", precision = 12, scale = 2) private BigDecimal estimatedCost;
    @Column(nullable = false, length = 3) private String currency = "INR";
    @Column(name = "cost_is_estimate", nullable = false) private boolean costIsEstimate = true;
    @Column(length = 2000) private String notes;
    @Column(name = "booking_reference", length = 120) private String bookingReference;
    @Column(name = "transport_mode", length = 40) private String transportMode;
    @Column(name = "attraction_id") private UUID attractionId;
    @Column(nullable = false) private boolean locked;
    @Column(nullable = false, length = 10) private String source = "USER";
    @Column(name = "ai_reason", length = 1000) private String aiReason;
    @Column(name = "deleted_at") private Instant deletedAt;
    @Version private long version;

    /** Items the user has committed to; the planner must never drop or move these. */
    public boolean isProtected() {
        return locked || "BOOKED".equals(status) || "COMPLETED".equals(status);
    }

    public boolean countsTowardCost() {
        return !"CANCELLED".equals(status) && !"SKIPPED".equals(status);
    }

    public boolean hasLocation() {
        return latitude != null && longitude != null;
    }

    /** Copies all user-visible fields from another item (used by duplicate). */
    public ItineraryItem copyFrom(ItineraryItem o) {
        this.tripId = o.tripId; this.dayNumber = o.dayNumber; this.position = o.position;
        this.title = o.title; this.description = o.description; this.category = o.category;
        this.status = "PLANNED"; this.priority = o.priority; this.locationName = o.locationName;
        this.latitude = o.latitude; this.longitude = o.longitude; this.startTime = o.startTime;
        this.endTime = o.endTime; this.durationMinutes = o.durationMinutes; this.estimatedCost = o.estimatedCost;
        this.currency = o.currency; this.costIsEstimate = o.costIsEstimate; this.notes = o.notes;
        this.transportMode = o.transportMode; this.attractionId = o.attractionId; this.locked = false;
        this.source = o.source; this.aiReason = o.aiReason;
        return this;
    }

    public UUID getTripId() { return tripId; }
    public void setTripId(UUID tripId) { this.tripId = tripId; }
    public int getDayNumber() { return dayNumber; }
    public void setDayNumber(int dayNumber) { this.dayNumber = dayNumber; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public String getLocationName() { return locationName; }
    public void setLocationName(String locationName) { this.locationName = locationName; }
    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }
    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }
    public LocalTime getStartTime() { return startTime; }
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }
    public LocalTime getEndTime() { return endTime; }
    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }
    public Integer getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(Integer durationMinutes) { this.durationMinutes = durationMinutes; }
    public BigDecimal getEstimatedCost() { return estimatedCost; }
    public void setEstimatedCost(BigDecimal estimatedCost) { this.estimatedCost = estimatedCost; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public boolean isCostIsEstimate() { return costIsEstimate; }
    public void setCostIsEstimate(boolean costIsEstimate) { this.costIsEstimate = costIsEstimate; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getBookingReference() { return bookingReference; }
    public void setBookingReference(String bookingReference) { this.bookingReference = bookingReference; }
    public String getTransportMode() { return transportMode; }
    public void setTransportMode(String transportMode) { this.transportMode = transportMode; }
    public UUID getAttractionId() { return attractionId; }
    public void setAttractionId(UUID attractionId) { this.attractionId = attractionId; }
    public boolean isLocked() { return locked; }
    public void setLocked(boolean locked) { this.locked = locked; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public String getAiReason() { return aiReason; }
    public void setAiReason(String aiReason) { this.aiReason = aiReason; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
    public long getVersion() { return version; }
}
