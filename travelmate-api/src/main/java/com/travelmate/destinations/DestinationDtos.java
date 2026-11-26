package com.travelmate.destinations;

import com.fasterxml.jackson.annotation.JsonUnwrapped;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class DestinationDtos {

    private DestinationDtos() {}

    public record CategoryDto(String slug, String name) {}

    public record DestinationSummary(
            UUID id, String slug, String name, String region, String state, String country,
            String summary, String heroImageUrl, String heroImageCredit,
            double latitude, double longitude,
            List<CategoryDto> categories,
            int recommendedDaysMin, int recommendedDaysMax,
            BigDecimal budgetPerDayMin, BigDecimal budgetPerDayMax, String currency,
            boolean featured, boolean seedData, boolean saved) {}

    public record AttractionDto(
            UUID id, String slug, UUID destinationId, String destinationSlug, String name,
            String category, String description, double latitude, double longitude,
            int typicalDurationMinutes, BigDecimal costMin, BigDecimal costMax, String currency, String costNote,
            String bestTimeOfDay, String openingHoursNote, boolean openingHoursVerified,
            List<String> tags, boolean familyFriendly, String accessibilityNote,
            boolean seedData, boolean saved) {}

    public record Faq(String question, String answer) {}

    public record GalleryImage(String url, String credit, String alt) {}

    public record DestinationDetail(
            @JsonUnwrapped DestinationSummary summaryFields,
            String description, String bestTimeToVisit, String howToReach, String localTransport,
            List<String> travelTips, String safetyInfo, List<Faq> faqs,
            List<GalleryImage> gallery, List<AttractionDto> attractions, List<DestinationSummary> similar,
            String seoTitle, String seoDescription, String status, Instant updatedAt) {}

    public record NearbyDestination(@JsonUnwrapped DestinationSummary summaryFields, double distanceKm) {}

    public record AdminDestinationRow(@JsonUnwrapped DestinationSummary summaryFields, String status, Instant updatedAt) {}
}
