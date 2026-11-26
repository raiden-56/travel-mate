package com.travelmate.admin;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.travelmate.destinations.DestinationDtos.Faq;
import com.travelmate.destinations.DestinationDtos.GalleryImage;
import com.travelmate.users.UserDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public final class AdminDtos {

    private AdminDtos() {}

    public record AdminStats(long totalUsers, long activeUsers30d, long newUsers7d, long totalTrips, long upcomingTrips,
                             long completedTrips, long destinationsPublished, long destinationsDraft) {}

    public record AdminUserRow(@JsonUnwrapped UserDto user, long tripCount, Instant lastLoginAt) {}

    public record ReasonRequest(@Size(max = 500) String reason) {}

    public record DestinationUpsert(
            @NotBlank @Size(max = 120) String name,
            @Size(max = 120) String slug,
            @NotBlank @Size(max = 120) String region,
            @NotBlank @Size(max = 120) String state,
            @NotBlank @Size(max = 120) String country,
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,
            @NotBlank @Size(max = 500) String summary,
            @NotBlank @Size(max = 8000) String description,
            @Size(max = 1000) String heroImageUrl,
            @Size(max = 300) String heroImageCredit,
            @Size(max = 1000) String bestTimeToVisit,
            @NotNull @Min(1) @Max(60) Integer recommendedDaysMin,
            @NotNull @Min(1) @Max(60) Integer recommendedDaysMax,
            String budgetPerDayMin,
            String budgetPerDayMax,
            @Size(max = 3) String currency,
            @Size(max = 4000) String howToReach,
            @Size(max = 2000) String localTransport,
            @Size(max = 20) List<@Size(max = 300) String> travelTips,
            @Size(max = 2000) String safetyInfo,
            @Size(max = 20) List<@Valid Faq> faqs,
            List<String> categorySlugs,
            Boolean featured,
            @Size(max = 160) String seoTitle,
            @Size(max = 320) String seoDescription,
            @Size(max = 30) List<@Valid GalleryImage> gallery) {}

    public record AttractionUpsert(
            @Size(max = 120) String slug,
            @NotBlank @Size(max = 160) String name,
            @NotBlank String category,
            @NotBlank @Size(max = 4000) String description,
            @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
            @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude,
            @NotNull @Min(5) @Max(1440) Integer typicalDurationMinutes,
            String costMin,
            String costMax,
            @Size(max = 3) String currency,
            @Size(max = 300) String costNote,
            String bestTimeOfDay,
            @Size(max = 300) String openingHoursNote,
            Boolean openingHoursVerified,
            @Size(max = 20) List<@Size(max = 40) String> tags,
            Boolean familyFriendly,
            @Size(max = 500) String accessibilityNote) {}
}
