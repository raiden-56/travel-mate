package com.travelmate.checklist;

import com.travelmate.common.ApiException;
import com.travelmate.destinations.Attraction;
import com.travelmate.destinations.AttractionRepository;
import com.travelmate.itinerary.ItineraryItem;
import com.travelmate.itinerary.ItineraryItemRepository;
import com.travelmate.trips.Trip;
import com.travelmate.trips.TripAccessService;
import com.travelmate.trips.TripAccessService.TripPermission;
import com.travelmate.weather.WeatherDto;
import com.travelmate.weather.WeatherService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ChecklistService {

    public record ChecklistItemDto(UUID id, String label, String category, boolean completed, int position,
                                   boolean suggested, String reason) {}

    public record ChecklistDto(UUID id, UUID tripId, String name, String templateKey, List<ChecklistItemDto> items,
                               int completedCount, int totalCount) {}

    public record CreateChecklist(@NotBlank @Size(max = 120) String name, String templateKey) {}

    public record CreateItem(@NotBlank @Size(max = 200) String label, String category, Boolean suggested,
                             @Size(max = 300) String reason) {}

    public record UpdateItem(@Size(max = 200) String label, String category, Boolean completed) {}

    private final ChecklistRepository checklists;
    private final ChecklistItemRepository checklistItems;
    private final TripAccessService access;
    private final ItineraryItemRepository itineraryItems;
    private final AttractionRepository attractions;
    private final WeatherService weather;

    public ChecklistService(ChecklistRepository checklists, ChecklistItemRepository checklistItems,
                            TripAccessService access, ItineraryItemRepository itineraryItems,
                            AttractionRepository attractions, WeatherService weather) {
        this.checklists = checklists;
        this.checklistItems = checklistItems;
        this.access = access;
        this.itineraryItems = itineraryItems;
        this.attractions = attractions;
        this.weather = weather;
    }

    @Transactional(readOnly = true)
    public List<ChecklistDto> list(UUID tripId, UUID userId) {
        access.require(tripId, userId, TripPermission.VIEW);
        return checklists.findByTripIdOrderByCreatedAtAsc(tripId).stream().map(ChecklistService::toDto).toList();
    }

    @Transactional
    public ChecklistDto create(UUID tripId, UUID userId, CreateChecklist req) {
        access.require(tripId, userId, TripPermission.EDIT);
        String key = req.templateKey() == null || req.templateKey().isBlank() ? null : req.templateKey().trim();
        Checklist c = new Checklist(tripId, req.name().trim(), key);
        if (key != null) {
            var template = ChecklistTemplates.find(key)
                    .orElseThrow(() -> ApiException.badRequest("templateKey", "Unknown template"));
            template.items().forEach(i -> c.addItem(i.label(), i.category(), false, null));
        }
        checklists.save(c);
        return toDto(c);
    }

    @Transactional
    public void delete(UUID checklistId, UUID userId) {
        Checklist c = checklists.findById(checklistId).orElseThrow(() -> ApiException.notFound("Checklist"));
        access.require(c.getTripId(), userId, TripPermission.EDIT);
        checklists.delete(c);
    }

    @Transactional
    public ChecklistItemDto addItem(UUID checklistId, UUID userId, CreateItem req) {
        Checklist c = checklists.findById(checklistId).orElseThrow(() -> ApiException.notFound("Checklist"));
        access.require(c.getTripId(), userId, TripPermission.VIEW);
        ChecklistItem item = c.addItem(req.label().trim(), category(req.category()),
                Boolean.TRUE.equals(req.suggested()), req.reason());
        checklists.saveAndFlush(c);
        return toDto(item);
    }

    @Transactional
    public ChecklistItemDto updateItem(UUID itemId, UUID userId, UpdateItem req) {
        ChecklistItem item = checklistItems.findById(itemId).orElseThrow(() -> ApiException.notFound("Checklist item"));
        access.require(item.getChecklist().getTripId(), userId, TripPermission.VIEW);
        if (req.label() != null) {
            if (req.label().isBlank()) throw ApiException.badRequest("label", "Must not be empty");
            item.setLabel(req.label().trim());
        }
        if (req.category() != null) item.setCategory(category(req.category()));
        if (req.completed() != null) item.setCompleted(req.completed());
        item.touch();
        return toDto(item);
    }

    @Transactional
    public void deleteItem(UUID itemId, UUID userId) {
        ChecklistItem item = checklistItems.findById(itemId).orElseThrow(() -> ApiException.notFound("Checklist item"));
        access.require(item.getChecklist().getTripId(), userId, TripPermission.EDIT);
        item.getChecklist().getItems().remove(item);
    }

    @Transactional(readOnly = true)
    public ChecklistSuggester.Result suggest(UUID tripId, UUID userId) {
        Trip trip = access.require(tripId, userId, TripPermission.VIEW).trip();
        Set<String> destCats = trip.getDestination() == null ? Set.of()
                : ChecklistSuggester.categorySlugs(trip.getDestination().getCategories());
        List<ItineraryItem> planned = itineraryItems.findActiveByTrip(tripId);
        Set<UUID> attractionIds = planned.stream().map(ItineraryItem::getAttractionId)
                .filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        List<Attraction> planAttractions = attractionIds.isEmpty() ? List.of() : attractions.findActiveByIds(attractionIds);
        Set<String> tags = new HashSet<>();
        planAttractions.forEach(a -> tags.addAll(a.tagList()));
        Optional<WeatherDto> forecast = trip.getDestination() == null ? Optional.empty()
                : weather.tryForecast(trip.getDestination().lat(), trip.getDestination().lng());
        Set<String> existing = checklists.findByTripIdOrderByCreatedAtAsc(tripId).stream()
                .flatMap(c -> c.getItems().stream()).map(i -> i.getLabel().toLowerCase()).collect(Collectors.toSet());
        return ChecklistSuggester.suggest(new ChecklistSuggester.Input(destCats,
                ChecklistSuggester.attractionCategories(planAttractions), tags, trip.getDayCount(),
                trip.getTravelers(), trip.getTripType(), forecast), existing);
    }

    private static String category(String raw) {
        if (raw == null || raw.isBlank()) return "OTHER";
        String c = raw.trim().toUpperCase();
        if (!ChecklistItem.CATEGORIES.contains(c)) throw ApiException.badRequest("category", "Unknown category");
        return c;
    }

    static ChecklistDto toDto(Checklist c) {
        List<ChecklistItemDto> items = c.getItems().stream().map(ChecklistService::toDto).toList();
        int done = (int) items.stream().filter(ChecklistItemDto::completed).count();
        return new ChecklistDto(c.getId(), c.getTripId(), c.getName(), c.getTemplateKey(), items, done, items.size());
    }

    static ChecklistItemDto toDto(ChecklistItem i) {
        return new ChecklistItemDto(i.getId(), i.getLabel(), i.getCategory(), i.isCompleted(), i.getPosition(),
                i.isSuggested(), i.getReason());
    }
}
