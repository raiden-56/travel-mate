package com.travelmate.search;

import com.travelmate.common.ApiException;
import com.travelmate.destinations.AttractionRepository;
import com.travelmate.destinations.Destination;
import com.travelmate.destinations.DestinationCategoryRepository;
import com.travelmate.destinations.DestinationDtos.AttractionDto;
import com.travelmate.destinations.DestinationDtos.DestinationSummary;
import com.travelmate.destinations.DestinationMapper;
import com.travelmate.destinations.DestinationRepository;
import com.travelmate.destinations.DestinationService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Unified search over destinations, attractions and categories. Starts with portable
 * case-insensitive LIKE matching; the postgres profile adds trigram indexes. A dedicated
 * search engine can replace this service behind the same API later.
 */
@Service
public class SearchService {

    public record SearchResults(List<DestinationSummary> destinations, List<AttractionDto> attractions) {}

    public record Suggestion(String type, String label, String sublabel, String slug, String destinationSlug) {}

    private final DestinationRepository destinations;
    private final AttractionRepository attractions;
    private final DestinationCategoryRepository categories;
    private final DestinationService destinationService;
    private final DestinationMapper mapper;
    private final SearchQueryRepository queries;

    public SearchService(DestinationRepository destinations, AttractionRepository attractions,
                         DestinationCategoryRepository categories, DestinationService destinationService,
                         DestinationMapper mapper, SearchQueryRepository queries) {
        this.destinations = destinations;
        this.attractions = attractions;
        this.categories = categories;
        this.destinationService = destinationService;
        this.mapper = mapper;
        this.queries = queries;
    }

    @Transactional
    public SearchResults search(String q, String types) {
        String pattern = requirePattern(q);
        Set<String> wanted = types == null || types.isBlank() ? Set.of("destination", "attraction")
                : Set.of(types.toLowerCase(Locale.ROOT).split(","));
        List<DestinationSummary> ds = List.of();
        List<AttractionDto> as = List.of();
        if (wanted.contains("destination")) {
            Set<UUID> saved = destinationService.savedDestinationIds();
            ds = destinations.searchPublished(pattern, null, null, null, null,
                            PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "popularity")))
                    .map(d -> mapper.summary(d, saved)).getContent();
        }
        if (wanted.contains("attraction")) {
            Set<UUID> saved = destinationService.savedAttractionIds();
            as = attractions.searchPublished(pattern, PageRequest.of(0, 30)).stream()
                    .map(a -> mapper.attraction(a, saved)).toList();
        }
        queries.save(new SearchQuery(q.trim().toLowerCase(Locale.ROOT).substring(0, Math.min(100, q.trim().length()))));
        return new SearchResults(ds, as);
    }

    @Transactional(readOnly = true)
    public List<Suggestion> suggest(String q) {
        String pattern = DestinationService.likePattern(q);
        if (pattern == null || q.trim().length() < 2) return List.of();
        List<Suggestion> out = new ArrayList<>();
        destinations.searchPublished(pattern, null, null, null, null,
                        PageRequest.of(0, 5, Sort.by(Sort.Direction.DESC, "popularity")))
                .forEach(d -> out.add(new Suggestion("DESTINATION", d.getName(), d.getRegion() + ", " + d.getState(),
                        d.getSlug(), null)));
        String needle = q.trim().toLowerCase(Locale.ROOT);
        categories.findAllByOrderBySortOrderAsc().stream()
                .filter(c -> c.getName().toLowerCase(Locale.ROOT).contains(needle) || c.getSlug().contains(needle))
                .limit(2)
                .forEach(c -> out.add(new Suggestion("CATEGORY", c.getName(), "Category", c.getSlug(), null)));
        attractions.searchPublished(pattern, PageRequest.of(0, 5))
                .forEach(a -> out.add(new Suggestion("ATTRACTION", a.getName(), a.getDestination().getName(),
                        a.getSlug(), a.getDestination().getSlug())));
        return out.stream().limit(8).toList();
    }

    @Transactional(readOnly = true)
    public List<String> popular() {
        Set<String> out = new LinkedHashSet<>(queries.popularSince(Instant.now().minus(Duration.ofDays(30)),
                PageRequest.of(0, 8)));
        if (out.size() < 8) {
            destinations.findAllPublished().stream()
                    .sorted((a, b) -> Integer.compare(b.getPopularity(), a.getPopularity()))
                    .map(Destination::getName)
                    .forEach(n -> { if (out.size() < 8) out.add(n); });
        }
        return List.copyOf(out);
    }

    private static String requirePattern(String q) {
        if (q == null || q.trim().length() < 2) throw ApiException.badRequest("q", "Enter at least 2 characters");
        if (q.length() > 100) throw ApiException.badRequest("q", "At most 100 characters");
        String pattern = DestinationService.likePattern(q);
        if (pattern == null) throw ApiException.badRequest("q", "Enter at least 2 characters");
        return pattern;
    }
}
