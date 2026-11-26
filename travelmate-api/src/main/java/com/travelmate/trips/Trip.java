package com.travelmate.trips;

import com.travelmate.common.BaseEntity;
import com.travelmate.destinations.Destination;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "trips")
public class Trip extends BaseEntity {

    @Column(name = "owner_id", nullable = false) private UUID ownerId;
    @Column(nullable = false, length = 120) private String name;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "destination_id")
    private Destination destination;
    @Column(name = "destination_name", nullable = false, length = 120) private String destinationName;
    @Column(name = "start_location", length = 120) private String startLocation;
    @Column(name = "start_date") private LocalDate startDate;
    @Column(name = "end_date") private LocalDate endDate;
    @Column(name = "day_count", nullable = false) private int dayCount = 1;
    @Column(nullable = false) private int travelers = 1;
    @Column(name = "trip_type", length = 20) private String tripType;
    @Column(name = "budget_amount", precision = 12, scale = 2) private BigDecimal budgetAmount;
    @Column(nullable = false, length = 3) private String currency = "INR";
    @Column(name = "cover_image_url", length = 1000) private String coverImageUrl;
    @Column(length = 2000) private String description;
    @Column(nullable = false, length = 20) private String visibility = "PRIVATE";
    @Column(nullable = false, length = 20) private String status = TripStatus.PLANNING;
    @Column(nullable = false) private boolean archived;
    @Column(name = "deleted_at") private Instant deletedAt;
    @Version private long version;

    public UUID getOwnerId() { return ownerId; }
    public void setOwnerId(UUID ownerId) { this.ownerId = ownerId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Destination getDestination() { return destination; }
    public void setDestination(Destination destination) { this.destination = destination; }
    public String getDestinationName() { return destinationName; }
    public void setDestinationName(String destinationName) { this.destinationName = destinationName; }
    public String getStartLocation() { return startLocation; }
    public void setStartLocation(String startLocation) { this.startLocation = startLocation; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public int getDayCount() { return dayCount; }
    public void setDayCount(int dayCount) { this.dayCount = dayCount; }
    public int getTravelers() { return travelers; }
    public void setTravelers(int travelers) { this.travelers = travelers; }
    public String getTripType() { return tripType; }
    public void setTripType(String tripType) { this.tripType = tripType; }
    public BigDecimal getBudgetAmount() { return budgetAmount; }
    public void setBudgetAmount(BigDecimal budgetAmount) { this.budgetAmount = budgetAmount; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public String getCoverImageUrl() { return coverImageUrl; }
    public void setCoverImageUrl(String coverImageUrl) { this.coverImageUrl = coverImageUrl; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getVisibility() { return visibility; }
    public void setVisibility(String visibility) { this.visibility = visibility; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public boolean isArchived() { return archived; }
    public void setArchived(boolean archived) { this.archived = archived; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
    public long getVersion() { return version; }

    /** Calendar date of a 1-based day number, or null when the trip has no dates. */
    public LocalDate dateOfDay(int dayNumber) {
        return startDate == null ? null : startDate.plusDays(dayNumber - 1L);
    }
}
