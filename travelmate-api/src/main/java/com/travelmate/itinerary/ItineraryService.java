package com.travelmate.itinerary;

import com.travelmate.common.ApiException;
import com.travelmate.common.Money;
import com.travelmate.destinations.Attraction;
import com.travelmate.destinations.AttractionRepository;
import com.travelmate.itinerary.ItineraryDtos.DayOrder;
import com.travelmate.itinerary.ItineraryDtos.ItemRequest;
import com.travelmate.itinerary.ItineraryDtos.ItineraryDay;
import com.travelmate.itinerary.ItineraryDtos.ItineraryDto;
import com.travelmate.itinerary.ItineraryDtos.ItineraryItemDto;
import com.travelmate.trips.Trip;
import com.travelmate.trips.TripAccessService;
import com.travelmate.trips.TripAccessService.TripPermission;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ItineraryService {

    private final ItineraryItemRepository items;
    private final TripAccessService access;
    private final AttractionRepository attractions;

    public ItineraryService(ItineraryItemRepository items, TripAccessService access, AttractionRepository attractions) {
        this.items = items;
        this.access = access;
        this.attractions = attractions;
    }

    @Transactional(readOnly = true)
    public ItineraryDto get(UUID tripId, UUID userId) {
        Trip trip = access.require(tripId, userId, TripPermission.VIEW).trip();
        return build(trip, items.findActiveByTrip(tripId));
    }

    @Transactional
    public ItineraryItemDto create(UUID tripId, UUID userId, ItemRequest req) {
        Trip trip = access.require(tripId, userId, TripPermission.EDIT).trip();
        ItineraryItem item = new ItineraryItem();
        item.setTripId(tripId);
        item.setCurrency(trip.getCurrency());
        apply(item, req);
        int day = req.dayNumber();
        if (req.position() == null) {
            item.setPosition(items.maxPosition(tripId, day) + 1);
        } else {
            shiftForInsert(tripId, day, req.position());
            item.setPosition(req.position());
        }
        items.save(item);
        return toDto(item, trip);
    }

    @Transactional
    public ItineraryItemDto update(UUID itemId, UUID userId, ItemRequest req) {
        ItineraryItem item = items.findActive(itemId).orElseThrow(() -> ApiException.notFound("Itinerary item"));
        Trip trip = access.require(item.getTripId(), userId, TripPermission.EDIT).trip();
        if (req.version() == null) throw ApiException.badRequest("version", "Required for updates");
        if (req.version() != item.getVersion()) {
            throw ApiException.conflict("This item was changed elsewhere. Reload to see the latest version.");
        }
        int oldDay = item.getDayNumber();
        apply(item, req);
        if (oldDay != item.getDayNumber()) {
            item.setPosition(items.maxPosition(item.getTripId(), item.getDayNumber()) + 1);
        } else if (req.position() != null) {
            item.setPosition(req.position());
        }
        item.touch();
        items.flush();
        return toDto(item, trip);
    }

    @Transactional
    public void delete(UUID itemId, UUID userId) {
        ItineraryItem item = items.findActive(itemId).orElseThrow(() -> ApiException.notFound("Itinerary item"));
        access.require(item.getTripId(), userId, TripPermission.EDIT);
        item.setDeletedAt(Instant.now());
    }

    @Transactional
    public ItineraryItemDto duplicate(UUID itemId, UUID userId) {
        ItineraryItem source = items.findActive(itemId).orElseThrow(() -> ApiException.notFound("Itinerary item"));
        Trip trip = access.require(source.getTripId(), userId, TripPermission.EDIT).trip();
        shiftForInsert(source.getTripId(), source.getDayNumber(), source.getPosition() + 1);
        ItineraryItem copy = new ItineraryItem().copyFrom(source);
        copy.setPosition(source.getPosition() + 1);
        copy.setSource("USER");
        items.save(copy);
        return toDto(copy, trip);
    }

    /** Applies a full ordering for the listed days atomically: moves between days and reorders. */
    @Transactional
    public ItineraryDto reorder(UUID tripId, UUID userId, List<DayOrder> days) {
        Trip trip = access.require(tripId, userId, TripPermission.EDIT).trip();
        List<ItineraryItem> all = items.findActiveByTrip(tripId);
        Map<UUID, ItineraryItem> byId = all.stream().collect(Collectors.toMap(ItineraryItem::getId, Function.identity()));
        Set<UUID> seen = new HashSet<>();
        for (DayOrder d : days) {
            for (UUID id : d.itemIds()) {
                if (!byId.containsKey(id)) throw ApiException.badRequest("itemIds", "Unknown item " + id);
                if (!seen.add(id)) throw ApiException.badRequest("itemIds", "Item listed twice: " + id);
            }
        }
        for (DayOrder d : days) {
            int pos = 0;
            for (UUID id : d.itemIds()) {
                ItineraryItem item = byId.get(id);
                item.setDayNumber(d.dayNumber());
                item.setPosition(pos++);
                item.touch();
            }
        }
        items.flush();
        return build(trip, items.findActiveByTrip(tripId));
    }

    private void shiftForInsert(UUID tripId, int day, int fromPosition) {
        for (ItineraryItem other : items.findActiveByTrip(tripId)) {
            if (other.getDayNumber() == day && other.getPosition() >= fromPosition) {
                other.setPosition(other.getPosition() + 1);
            }
        }
    }

    private void apply(ItineraryItem item, ItemRequest req) {
        item.setDayNumber(req.dayNumber());
        item.setTitle(req.title().trim());
        item.setDescription(blankToNull(req.description()));
        item.setCategory(oneOf(req.category(), ItineraryItem.CATEGORIES, "CUSTOM", "category"));
        item.setStatus(oneOf(req.status(), ItineraryItem.STATUSES, item.getStatus() == null ? "PLANNED" : item.getStatus(), "status"));
        item.setPriority(oneOf(req.priority(), ItineraryItem.PRIORITIES, "MEDIUM", "priority"));
        item.setLocationName(blankToNull(req.locationName()));
        if ((req.latitude() == null) != (req.longitude() == null)) {
            throw ApiException.badRequest("latitude", "Provide both latitude and longitude, or neither");
        }
        item.setLatitude(coord(req.latitude()));
        item.setLongitude(coord(req.longitude()));
        item.setAttractionId(null);
        if (req.attractionId() != null) {
            Attraction a = attractions.findActive(req.attractionId())
                    .orElseThrow(() -> ApiException.badRequest("attractionId", "Unknown attraction"));
            item.setAttractionId(a.getId());
            if (item.getLatitude() == null) {
                item.setLatitude(a.getLatitude());
                item.setLongitude(a.getLongitude());
            }
            if (item.getLocationName() == null) item.setLocationName(a.getName());
        }
        item.setStartTime(req.startTime());
        item.setEndTime(req.endTime());
        item.setDurationMinutes(req.durationMinutes());
        if (req.durationMinutes() == null && req.startTime() != null && req.endTime() != null
                && req.endTime().isAfter(req.startTime())) {
            item.setDurationMinutes((int) java.time.Duration.between(req.startTime(), req.endTime()).toMinutes());
        }
        item.setEstimatedCost(Money.parse(req.estimatedCost(), "estimatedCost"));
        if (req.currency() != null && !req.currency().isBlank()) item.setCurrency(Money.currency(req.currency()));
        item.setCostIsEstimate(req.costIsEstimate() == null || req.costIsEstimate());
        item.setNotes(blankToNull(req.notes()));
        item.setBookingReference(blankToNull(req.bookingReference()));
        item.setTransportMode(blankToNull(req.transportMode()));
        if (req.locked() != null) item.setLocked(req.locked());
    }

    public ItineraryDto build(Trip trip, List<ItineraryItem> all) {
        int maxDay = Math.max(trip.getDayCount(), all.stream().mapToInt(ItineraryItem::getDayNumber).max().orElse(1));
        Map<Integer, List<ItineraryItem>> byDay = new HashMap<>();
        for (ItineraryItem i : all) byDay.computeIfAbsent(i.getDayNumber(), k -> new ArrayList<>()).add(i);
        List<ItineraryDay> days = new ArrayList<>();
        BigDecimal total = Money.zero();
        for (int d = 1; d <= maxDay; d++) {
            List<ItineraryItem> dayItems = byDay.getOrDefault(d, List.of()).stream()
                    .sorted(Comparator.comparingInt(ItineraryItem::getPosition)
                            .thenComparing(i -> i.getStartTime() == null ? java.time.LocalTime.MAX : i.getStartTime()))
                    .toList();
            BigDecimal dayCost = cost(dayItems, trip.getCurrency());
            total = total.add(dayCost);
            days.add(new ItineraryDay(d, trip.dateOfDay(d), dayItems.stream().map(i -> toDto(i, trip)).toList(), dayCost));
        }
        var warnings = ItineraryValidator.validate(
                new ItineraryValidator.Context(trip.getDayCount(), trip.getBudgetAmount(), trip.getCurrency()), all);
        return new ItineraryDto(trip.getId(), trip.getDayCount(), days, warnings, total, trip.getCurrency());
    }

    static BigDecimal cost(List<ItineraryItem> list, String currency) {
        return list.stream().filter(ItineraryItem::countsTowardCost)
                .filter(i -> i.getEstimatedCost() != null && currency.equals(i.getCurrency()))
                .map(ItineraryItem::getEstimatedCost).reduce(Money.zero(), BigDecimal::add);
    }

    public ItineraryItemDto toDto(ItineraryItem i, Trip trip) {
        return new ItineraryItemDto(i.getId(), i.getTripId(), i.getDayNumber(), i.getPosition(),
                trip.dateOfDay(i.getDayNumber()), i.getTitle(), i.getDescription(), i.getCategory(), i.getStatus(),
                i.getPriority(), i.getLocationName(),
                i.getLatitude() == null ? null : i.getLatitude().doubleValue(),
                i.getLongitude() == null ? null : i.getLongitude().doubleValue(),
                i.getStartTime(), i.getEndTime(), i.getDurationMinutes(), i.getEstimatedCost(), i.getCurrency(),
                i.isCostIsEstimate(), i.getNotes(), i.getBookingReference(), i.getTransportMode(),
                i.getAttractionId(), i.isLocked(), i.getSource(), i.getAiReason(), i.getVersion(),
                i.getCreatedAt(), i.getUpdatedAt());
    }

    private static BigDecimal coord(Double v) {
        return v == null ? null : BigDecimal.valueOf(v).setScale(6, RoundingMode.HALF_UP);
    }

    private static String oneOf(String value, Set<String> allowed, String fallback, String field) {
        if (value == null || value.isBlank()) return fallback;
        String v = value.trim().toUpperCase();
        if (!allowed.contains(v)) throw ApiException.badRequest(field, "Unknown " + field);
        return v;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
