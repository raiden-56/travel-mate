package com.travelmate.destinations;

import com.travelmate.common.PageResponse;
import com.travelmate.destinations.DestinationDtos.AttractionDto;
import com.travelmate.destinations.DestinationDtos.CategoryDto;
import com.travelmate.destinations.DestinationDtos.DestinationDetail;
import com.travelmate.destinations.DestinationDtos.DestinationSummary;
import com.travelmate.destinations.DestinationDtos.NearbyDestination;
import com.travelmate.weather.WeatherDto;
import com.travelmate.weather.WeatherService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@Tag(name = "Destinations")
public class DestinationController {

    private final DestinationService service;
    private final WeatherService weather;

    public DestinationController(DestinationService service, WeatherService weather) {
        this.service = service;
        this.weather = weather;
    }

    @GetMapping("/api/v1/destinations")
    public PageResponse<DestinationSummary> list(@RequestParam(required = false) String q,
                                                 @RequestParam(required = false) String category,
                                                 @RequestParam(required = false) BigDecimal budgetMax,
                                                 @RequestParam(required = false) Integer maxDays,
                                                 @RequestParam(required = false) Boolean featured,
                                                 @RequestParam(required = false) String sort,
                                                 @RequestParam(required = false) Integer page,
                                                 @RequestParam(required = false) Integer size) {
        return service.list(q, category, budgetMax, maxDays, featured, sort, page, size);
    }

    @GetMapping("/api/v1/destinations/categories")
    public List<CategoryDto> categories() {
        return service.categories();
    }

    @GetMapping("/api/v1/destinations/nearby")
    public List<NearbyDestination> nearby(@RequestParam double lat, @RequestParam double lng,
                                          @RequestParam(defaultValue = "300") double radiusKm) {
        return service.nearby(lat, lng, radiusKm);
    }

    @GetMapping("/api/v1/destinations/{slug}")
    public DestinationDetail detail(@PathVariable String slug) {
        return service.detail(slug);
    }

    @GetMapping("/api/v1/destinations/{slug}/weather")
    public WeatherDto weather(@PathVariable String slug) {
        Destination d = service.publishedBySlug(slug);
        return weather.forecast(d.lat(), d.lng());
    }

    @GetMapping("/api/v1/attractions/{id}")
    public AttractionDto attraction(@PathVariable UUID id) {
        return service.attraction(id);
    }
}
