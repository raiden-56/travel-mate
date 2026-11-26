package com.travelmate.destinations;

import com.travelmate.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "attractions")
public class Attraction extends BaseEntity {

    public static final java.util.Set<String> CATEGORIES = java.util.Set.of("BEACH", "TEMPLE", "WATERFALL", "FORT",
            "VIEWPOINT", "MUSEUM", "ADVENTURE", "NATURE", "WILDLIFE", "MARKET", "ISLAND", "HERITAGE", "RESTAURANT",
            "CAFE", "OTHER");
    public static final java.util.Set<String> TIMES = java.util.Set.of("MORNING", "AFTERNOON", "EVENING", "ANY");

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "destination_id")
    private Destination destination;

    @Column(nullable = false, length = 120) private String slug;
    @Column(nullable = false, length = 160) private String name;
    @Column(nullable = false, length = 20) private String category;
    @Column(nullable = false, length = 4000) private String description;
    @Column(nullable = false, precision = 9, scale = 6) private BigDecimal latitude;
    @Column(nullable = false, precision = 9, scale = 6) private BigDecimal longitude;
    @Column(name = "typical_duration_minutes", nullable = false) private int typicalDurationMinutes = 60;
    @Column(name = "cost_min", nullable = false, precision = 12, scale = 2) private BigDecimal costMin = BigDecimal.ZERO;
    @Column(name = "cost_max", nullable = false, precision = 12, scale = 2) private BigDecimal costMax = BigDecimal.ZERO;
    @Column(nullable = false, length = 3) private String currency = "INR";
    @Column(name = "cost_note", length = 300) private String costNote;
    @Column(name = "best_time_of_day", nullable = false, length = 10) private String bestTimeOfDay = "ANY";
    @Column(name = "opening_hours_note", length = 300) private String openingHoursNote;
    @Column(name = "opening_hours_verified", nullable = false) private boolean openingHoursVerified;
    /** Comma-separated tags. */
    @Column(length = 500) private String tags;
    @Column(name = "family_friendly", nullable = false) private boolean familyFriendly = true;
    @Column(name = "accessibility_note", length = 500) private String accessibilityNote;
    @Column(name = "is_seed_data", nullable = false) private boolean seedData;
    @Column(name = "deleted_at") private Instant deletedAt;

    public double lat() { return latitude.doubleValue(); }
    public double lng() { return longitude.doubleValue(); }
    public java.util.List<String> tagList() { return com.travelmate.common.Slugs.split(tags, ","); }
    public boolean hasTag(String tag) { return tagList().contains(tag); }

    public Destination getDestination() { return destination; }
    public void setDestination(Destination destination) { this.destination = destination; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }
    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }
    public int getTypicalDurationMinutes() { return typicalDurationMinutes; }
    public void setTypicalDurationMinutes(int v) { this.typicalDurationMinutes = v; }
    public BigDecimal getCostMin() { return costMin; }
    public void setCostMin(BigDecimal costMin) { this.costMin = costMin; }
    public BigDecimal getCostMax() { return costMax; }
    public void setCostMax(BigDecimal costMax) { this.costMax = costMax; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public String getCostNote() { return costNote; }
    public void setCostNote(String costNote) { this.costNote = costNote; }
    public String getBestTimeOfDay() { return bestTimeOfDay; }
    public void setBestTimeOfDay(String bestTimeOfDay) { this.bestTimeOfDay = bestTimeOfDay; }
    public String getOpeningHoursNote() { return openingHoursNote; }
    public void setOpeningHoursNote(String openingHoursNote) { this.openingHoursNote = openingHoursNote; }
    public boolean isOpeningHoursVerified() { return openingHoursVerified; }
    public void setOpeningHoursVerified(boolean v) { this.openingHoursVerified = v; }
    public String getTags() { return tags; }
    public void setTags(String tags) { this.tags = tags; }
    public boolean isFamilyFriendly() { return familyFriendly; }
    public void setFamilyFriendly(boolean familyFriendly) { this.familyFriendly = familyFriendly; }
    public String getAccessibilityNote() { return accessibilityNote; }
    public void setAccessibilityNote(String accessibilityNote) { this.accessibilityNote = accessibilityNote; }
    public boolean isSeedData() { return seedData; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
}
