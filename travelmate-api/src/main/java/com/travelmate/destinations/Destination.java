package com.travelmate.destinations;

import com.travelmate.common.BaseEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "destinations")
public class Destination extends BaseEntity {

    @Column(nullable = false, length = 120) private String slug;
    @Column(nullable = false, length = 120) private String name;
    @Column(nullable = false, length = 120) private String region;
    @Column(nullable = false, length = 120) private String state;
    @Column(nullable = false, length = 120) private String country;
    @Column(nullable = false, precision = 9, scale = 6) private BigDecimal latitude;
    @Column(nullable = false, precision = 9, scale = 6) private BigDecimal longitude;
    @Column(nullable = false, length = 500) private String summary;
    @Column(nullable = false, length = 8000) private String description;
    @Column(name = "hero_image_url", length = 1000) private String heroImageUrl;
    @Column(name = "hero_image_credit", length = 300) private String heroImageCredit;
    @Column(name = "best_time_to_visit", length = 1000) private String bestTimeToVisit;
    @Column(name = "recommended_days_min", nullable = false) private int recommendedDaysMin = 1;
    @Column(name = "recommended_days_max", nullable = false) private int recommendedDaysMax = 3;
    @Column(name = "budget_per_day_min", nullable = false, precision = 12, scale = 2) private BigDecimal budgetPerDayMin = BigDecimal.ZERO;
    @Column(name = "budget_per_day_max", nullable = false, precision = 12, scale = 2) private BigDecimal budgetPerDayMax = BigDecimal.ZERO;
    @Column(nullable = false, length = 3) private String currency = "INR";
    @Column(name = "how_to_reach", length = 4000) private String howToReach;
    @Column(name = "local_transport", length = 2000) private String localTransport;
    /** Pipe-separated tips. */
    @Column(name = "travel_tips", length = 4000) private String travelTips;
    @Column(name = "safety_info", length = 2000) private String safetyInfo;
    /** JSON array of {question, answer}. */
    @Column(length = 8000) private String faqs;
    @Column(nullable = false, length = 20) private String status = "DRAFT";
    @Column(nullable = false) private boolean featured;
    @Column(name = "seo_title", length = 160) private String seoTitle;
    @Column(name = "seo_description", length = 320) private String seoDescription;
    @Column(name = "is_seed_data", nullable = false) private boolean seedData;
    @Column(nullable = false) private int popularity;
    @Column(name = "deleted_at") private Instant deletedAt;
    @Version private long version;

    @ManyToMany
    @JoinTable(name = "destination_category_map",
            joinColumns = @JoinColumn(name = "destination_id"),
            inverseJoinColumns = @JoinColumn(name = "category_id"))
    @OrderBy("sortOrder ASC")
    private Set<DestinationCategory> categories = new LinkedHashSet<>();

    @OneToMany(mappedBy = "destination", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<DestinationImage> images = new ArrayList<>();

    public boolean isPublished() { return "PUBLISHED".equals(status) && deletedAt == null; }
    public double lat() { return latitude.doubleValue(); }
    public double lng() { return longitude.doubleValue(); }

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }
    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }
    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getHeroImageUrl() { return heroImageUrl; }
    public void setHeroImageUrl(String heroImageUrl) { this.heroImageUrl = heroImageUrl; }
    public String getHeroImageCredit() { return heroImageCredit; }
    public void setHeroImageCredit(String heroImageCredit) { this.heroImageCredit = heroImageCredit; }
    public String getBestTimeToVisit() { return bestTimeToVisit; }
    public void setBestTimeToVisit(String bestTimeToVisit) { this.bestTimeToVisit = bestTimeToVisit; }
    public int getRecommendedDaysMin() { return recommendedDaysMin; }
    public void setRecommendedDaysMin(int v) { this.recommendedDaysMin = v; }
    public int getRecommendedDaysMax() { return recommendedDaysMax; }
    public void setRecommendedDaysMax(int v) { this.recommendedDaysMax = v; }
    public BigDecimal getBudgetPerDayMin() { return budgetPerDayMin; }
    public void setBudgetPerDayMin(BigDecimal v) { this.budgetPerDayMin = v; }
    public BigDecimal getBudgetPerDayMax() { return budgetPerDayMax; }
    public void setBudgetPerDayMax(BigDecimal v) { this.budgetPerDayMax = v; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public String getHowToReach() { return howToReach; }
    public void setHowToReach(String howToReach) { this.howToReach = howToReach; }
    public String getLocalTransport() { return localTransport; }
    public void setLocalTransport(String localTransport) { this.localTransport = localTransport; }
    public String getTravelTips() { return travelTips; }
    public void setTravelTips(String travelTips) { this.travelTips = travelTips; }
    public String getSafetyInfo() { return safetyInfo; }
    public void setSafetyInfo(String safetyInfo) { this.safetyInfo = safetyInfo; }
    public String getFaqs() { return faqs; }
    public void setFaqs(String faqs) { this.faqs = faqs; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public boolean isFeatured() { return featured; }
    public void setFeatured(boolean featured) { this.featured = featured; }
    public String getSeoTitle() { return seoTitle; }
    public void setSeoTitle(String seoTitle) { this.seoTitle = seoTitle; }
    public String getSeoDescription() { return seoDescription; }
    public void setSeoDescription(String seoDescription) { this.seoDescription = seoDescription; }
    public boolean isSeedData() { return seedData; }
    public int getPopularity() { return popularity; }
    public void setPopularity(int popularity) { this.popularity = popularity; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
    public Set<DestinationCategory> getCategories() { return categories; }
    public List<DestinationImage> getImages() { return images; }
}
