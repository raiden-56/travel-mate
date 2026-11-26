package com.travelmate.destinations;

import com.travelmate.auth.CurrentUser;
import com.travelmate.common.ApiException;
import com.travelmate.common.Geo;
import com.travelmate.common.PageResponse;
import com.travelmate.destinations.DestinationDtos.AttractionDto;
import com.travelmate.destinations.DestinationDtos.CategoryDto;
import com.travelmate.destinations.DestinationDtos.DestinationDetail;
import com.travelmate.destinations.DestinationDtos.DestinationSummary;
import com.travelmate.destinations.DestinationDtos.NearbyDestination;
import com.travelmate.favorites.Favorite;
import com.travelmate.favorites.FavoriteRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/** Public read side of the destination catalogue. */
@Service
@Transactional(readOnly = true)
public class DestinationService {

    private final DestinationRepository destinations;
    private final DestinationCategoryRepository categories;
    private final AttractionRepository attractions;
    private final FavoriteRepository favorites;
    private final DestinationMapper mapper;

    public DestinationService(DestinationRepository destinations, DestinationCategoryRepository categories,
                              AttractionRepository attractions, FavoriteRepository favorites,
                              DestinationMapper mapper) {
        this.destinations = destinations;
        this.categories = categories;
        this.attractions = attractions;
        this.favorites = favorites;
        this.mapper = mapper;
    }

    public static String likePattern(String q) {
        if (q == null || q.isBlank()) return null;
        String escaped = q.trim().toLowerCase(Locale.ROOT).replace("\\", "").replace("%", "").replace("_", "");
        return escaped.isEmpty() ? null : "%" + escaped + "%";
    }

    public Set<UUID> savedDestinationIds() {
        return CurrentUser.optionalId().map(id -> favorites.findTargetIds(id, Favorite.DESTINATION)).orElse(Set.of());
    }

    public Set<UUID> savedAttractionIds() {
        return CurrentUser.optionalId().map(id -> favorites.findTargetIds(id, Favorite.ATTRACTION)).orElse(Set.of());
    }

    public PageResponse<DestinationSummary> list(String q, String category, BigDecimal budgetMax, Integer maxDays,
                                                 Boolean featured, String sort, Integer page, Integer size) {
        Sort order = switch (sort == null ? "featured" : sort) {
            case "name" -> Sort.by("name");
            case "budget" -> Sort.by("budgetPerDayMin").and(Sort.by("name"));
            default -> Sort.by(Sort.Direction.DESC, "featured").and(Sort.by(Sort.Direction.DESC, "popularity")).and(Sort.by("name"));
        };
        Page<Destination> result = destinations.searchPublished(likePattern(q), blankToNull(category), budgetMax,
                maxDays, featured, PageRequest.of(PageResponse.clampPage(page), PageResponse.clampSize(size), order));
        Set<UUID> saved = savedDestinationIds();
        return PageResponse.of(result, d -> mapper.summary(d, saved));
    }

    public List<CategoryDto> categories() {
        return categories.findAllByOrderBySortOrderAsc().stream().map(mapper::category).toList();
    }

    public DestinationDetail detail(String slug) {
        Destination d = publishedBySlug(slug);
        List<Attraction> list = attractions.findActiveByDestination(d.getId());
        return mapper.detail(d, list, similar(d), savedDestinationIds(), savedAttractionIds());
    }

    public Destination publishedBySlug(String slug) {
        return destinations.findBySlugAndDeletedAtIsNull(slug).filter(Destination::isPublished)
                .orElseThrow(() -> ApiException.notFound("Destination"));
    }

    public List<Destination> similar(Destination d) {
        Set<String> cats = d.getCategories().stream().map(DestinationCategory::getSlug)
                .collect(java.util.stream.Collectors.toSet());
        return destinations.findAllPublished().stream()
                .filter(o -> !o.getId().equals(d.getId()))
                .sorted(Comparator.<Destination>comparingLong(o -> -o.getCategories().stream()
                                .filter(c -> cats.contains(c.getSlug())).count())
                        .thenComparingDouble(o -> Geo.haversineKm(d.lat(), d.lng(), o.lat(), o.lng())))
                .limit(4)
                .toList();
    }

    public List<NearbyDestination> nearby(double lat, double lng, double radiusKm) {
        if (!Geo.valid(lat, lng)) throw ApiException.badRequest("lat", "Invalid coordinates");
        if (radiusKm <= 0 || radiusKm > 1000) throw ApiException.badRequest("radiusKm", "Must be between 0 and 1000");
        Set<UUID> saved = savedDestinationIds();
        return destinations.findAllPublished().stream()
                .map(d -> new NearbyDestination(mapper.summary(d, saved),
                        Geo.round1(Geo.haversineKm(lat, lng, d.lat(), d.lng()))))
                .filter(n -> n.distanceKm() <= radiusKm)
                .sorted(Comparator.comparingDouble(NearbyDestination::distanceKm))
                .toList();
    }

    public AttractionDto attraction(UUID id) {
        Attraction a = attractions.findActive(id).filter(x -> x.getDestination().isPublished())
                .orElseThrow(() -> ApiException.notFound("Attraction"));
        return mapper.attraction(a, savedAttractionIds());
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
