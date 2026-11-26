package com.travelmate.destinations;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.travelmate.common.Slugs;
import com.travelmate.destinations.DestinationDtos.AttractionDto;
import com.travelmate.destinations.DestinationDtos.CategoryDto;
import com.travelmate.destinations.DestinationDtos.DestinationDetail;
import com.travelmate.destinations.DestinationDtos.DestinationSummary;
import com.travelmate.destinations.DestinationDtos.Faq;
import com.travelmate.destinations.DestinationDtos.GalleryImage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@Component
public class DestinationMapper {

    private static final Logger log = LoggerFactory.getLogger(DestinationMapper.class);

    private final ObjectMapper objectMapper;

    public DestinationMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public CategoryDto category(DestinationCategory c) {
        return new CategoryDto(c.getSlug(), c.getName());
    }

    public DestinationSummary summary(Destination d, Set<UUID> savedIds) {
        return new DestinationSummary(d.getId(), d.getSlug(), d.getName(), d.getRegion(), d.getState(),
                d.getCountry(), d.getSummary(), d.getHeroImageUrl(), d.getHeroImageCredit(), d.lat(), d.lng(),
                d.getCategories().stream().map(this::category).toList(),
                d.getRecommendedDaysMin(), d.getRecommendedDaysMax(), d.getBudgetPerDayMin(), d.getBudgetPerDayMax(),
                d.getCurrency(), d.isFeatured(), d.isSeedData(), savedIds != null && savedIds.contains(d.getId()));
    }

    public AttractionDto attraction(Attraction a, Set<UUID> savedIds) {
        return new AttractionDto(a.getId(), a.getSlug(), a.getDestination().getId(), a.getDestination().getSlug(),
                a.getName(), a.getCategory(), a.getDescription(), a.lat(), a.lng(), a.getTypicalDurationMinutes(),
                a.getCostMin(), a.getCostMax(), a.getCurrency(), a.getCostNote(), a.getBestTimeOfDay(),
                a.getOpeningHoursNote(), a.isOpeningHoursVerified(), a.tagList(), a.isFamilyFriendly(),
                a.getAccessibilityNote(), a.isSeedData(), savedIds != null && savedIds.contains(a.getId()));
    }

    public DestinationDetail detail(Destination d, List<Attraction> attractions, List<Destination> similar,
                                    Set<UUID> savedDestinations, Set<UUID> savedAttractions) {
        return new DestinationDetail(summary(d, savedDestinations), d.getDescription(), d.getBestTimeToVisit(),
                d.getHowToReach(), d.getLocalTransport(), Slugs.split(d.getTravelTips(), "\\|"), d.getSafetyInfo(),
                parseFaqs(d.getFaqs()),
                d.getImages().stream().map(i -> new GalleryImage(i.getUrl(), i.getCredit(), i.getAlt())).toList(),
                attractions.stream().map(a -> attraction(a, savedAttractions)).toList(),
                similar.stream().map(s -> summary(s, savedDestinations)).toList(),
                d.getSeoTitle(), d.getSeoDescription(), d.getStatus(), d.getUpdatedAt());
    }

    public List<Faq> parseFaqs(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, new TypeReference<List<Faq>>() {});
        } catch (Exception e) {
            log.warn("Could not parse FAQs JSON: {}", e.getMessage());
            return List.of();
        }
    }

    public String writeFaqs(List<Faq> faqs) {
        if (faqs == null || faqs.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(faqs);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
