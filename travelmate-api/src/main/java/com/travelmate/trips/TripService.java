package com.travelmate.trips;

import com.travelmate.budget.Expense;
import com.travelmate.budget.ExpenseRepository;
import com.travelmate.common.ApiException;
import com.travelmate.common.Money;
import com.travelmate.destinations.Destination;
import com.travelmate.destinations.DestinationMapper;
import com.travelmate.destinations.DestinationRepository;
import com.travelmate.itinerary.ItineraryItem;
import com.travelmate.itinerary.ItineraryItemRepository;
import com.travelmate.trips.TripAccessService.Access;
import com.travelmate.trips.TripAccessService.TripPermission;
import com.travelmate.trips.TripDtos.TripDto;
import com.travelmate.trips.TripDtos.TripUpsert;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class TripService {

    private final TripRepository trips;
    private final TripMemberRepository members;
    private final TripAccessService access;
    private final DestinationRepository destinations;
    private final DestinationMapper destinationMapper;
    private final ItineraryItemRepository items;
    private final ExpenseRepository expenses;

    public TripService(TripRepository trips, TripMemberRepository members, TripAccessService access,
                       DestinationRepository destinations, DestinationMapper destinationMapper,
                       ItineraryItemRepository items, ExpenseRepository expenses) {
        this.trips = trips;
        this.members = members;
        this.access = access;
        this.destinations = destinations;
        this.destinationMapper = destinationMapper;
        this.items = items;
        this.expenses = expenses;
    }

    @Transactional(readOnly = true)
    public List<TripDto> list(UUID userId, String status, boolean archived) {
        if (status != null && !status.isBlank() && !TripStatus.ALL.contains(status)) {
            throw ApiException.badRequest("status", "Unknown status");
        }
        List<Trip> list = trips.findForMember(userId, status == null || status.isBlank() ? null : status, archived);
        if (list.isEmpty()) return List.of();
        Set<UUID> ids = list.stream().map(Trip::getId).collect(Collectors.toSet());
        Map<UUID, List<ItineraryItem>> itemsByTrip = items.findActiveByTrips(ids).stream()
                .collect(Collectors.groupingBy(ItineraryItem::getTripId));
        Map<UUID, List<Expense>> expensesByTrip = expenses.findActiveByTrips(ids).stream()
                .collect(Collectors.groupingBy(Expense::getTripId));
        LocalDate today = LocalDate.now();
        return list.stream()
                .sorted(Comparator.comparing((Trip t) -> rank(t, today))
                        .thenComparing(t -> t.getStartDate() == null ? LocalDate.MAX : t.getStartDate())
                        .thenComparing(Trip::getUpdatedAt, Comparator.reverseOrder()))
                .map(t -> toDto(t, roleOf(t, userId),
                        itemsByTrip.getOrDefault(t.getId(), List.of()),
                        expensesByTrip.getOrDefault(t.getId(), List.of())))
                .toList();
    }

    /** Upcoming and in-progress trips first, then planning, then finished ones. */
    private static int rank(Trip t, LocalDate today) {
        return switch (t.getStatus()) {
            case TripStatus.IN_PROGRESS -> 0;
            case TripStatus.UPCOMING -> 1;
            case TripStatus.PLANNING -> t.getStartDate() != null && !t.getStartDate().isBefore(today) ? 1 : 2;
            case TripStatus.COMPLETED -> 3;
            default -> 4;
        };
    }

    private String roleOf(Trip t, UUID userId) {
        return members.findByTripIdAndUserId(t.getId(), userId).map(TripMember::getRole).orElse(TripMember.VIEWER);
    }

    @Transactional
    public TripDto create(UUID userId, TripUpsert req) {
        Trip trip = new Trip();
        trip.setOwnerId(userId);
        apply(trip, req);
        trips.save(trip);
        members.save(new TripMember(trip.getId(), userId, TripMember.OWNER));
        return toDto(trip, TripMember.OWNER, List.of(), List.of());
    }

    @Transactional(readOnly = true)
    public TripDto get(UUID tripId, UUID userId) {
        Access a = access.require(tripId, userId, TripPermission.VIEW);
        return toDto(a.trip(), a.role());
    }

    @Transactional
    public TripDto update(UUID tripId, UUID userId, TripUpsert req) {
        Access a = access.require(tripId, userId, TripPermission.EDIT);
        Trip trip = a.trip();
        if (req.version() == null) throw ApiException.badRequest("version", "Required for updates");
        if (req.version() != trip.getVersion()) {
            throw ApiException.conflict("This trip was changed elsewhere. Reload to see the latest version.");
        }
        apply(trip, req);
        trip.touch();
        trips.flush();
        return toDto(trip, a.role());
    }

    @Transactional
    public void delete(UUID tripId, UUID userId) {
        Trip trip = access.require(tripId, userId, TripPermission.MANAGE).trip();
        trip.setDeletedAt(Instant.now());
    }

    @Transactional
    public TripDto duplicate(UUID tripId, UUID userId) {
        Trip source = access.require(tripId, userId, TripPermission.VIEW).trip();
        Trip copy = new Trip();
        copy.setOwnerId(userId);
        copy.setName(truncate("Copy of " + source.getName(), 120));
        copy.setDestination(source.getDestination());
        copy.setDestinationName(source.getDestinationName());
        copy.setStartLocation(source.getStartLocation());
        copy.setStartDate(source.getStartDate());
        copy.setEndDate(source.getEndDate());
        copy.setDayCount(source.getDayCount());
        copy.setTravelers(source.getTravelers());
        copy.setTripType(source.getTripType());
        copy.setBudgetAmount(source.getBudgetAmount());
        copy.setCurrency(source.getCurrency());
        copy.setCoverImageUrl(source.getCoverImageUrl());
        copy.setDescription(source.getDescription());
        trips.save(copy);
        members.save(new TripMember(copy.getId(), userId, TripMember.OWNER));
        List<ItineraryItem> copiedItems = items.findActiveByTrip(source.getId()).stream()
                .map(i -> {
                    ItineraryItem c = new ItineraryItem().copyFrom(i);
                    c.setTripId(copy.getId());
                    c.setBookingReference(null);
                    return c;
                }).toList();
        items.saveAll(copiedItems);
        return toDto(copy, TripMember.OWNER, copiedItems, List.of());
    }

    @Transactional
    public TripDto changeStatus(UUID tripId, UUID userId, String status) {
        Access a = access.require(tripId, userId, TripPermission.MANAGE);
        Trip trip = a.trip();
        if (!TripStatus.ALL.contains(status)) throw ApiException.badRequest("status", "Unknown status");
        if (status.equals(trip.getStatus())) return toDto(trip, a.role());
        if (!TripStatus.canTransition(trip.getStatus(), status)) {
            throw ApiException.badRequest("status", "A trip cannot move from " + trip.getStatus() + " to " + status);
        }
        if ((TripStatus.UPCOMING.equals(status) || TripStatus.IN_PROGRESS.equals(status))
                && (trip.getStartDate() == null || trip.getEndDate() == null)) {
            throw ApiException.badRequest("status", "Add travel dates before marking the trip " + status.toLowerCase().replace('_', ' '));
        }
        trip.setStatus(status);
        trip.touch();
        trips.flush();
        return toDto(trip, a.role());
    }

    @Transactional
    public TripDto setArchived(UUID tripId, UUID userId, boolean archived) {
        Access a = access.require(tripId, userId, TripPermission.MANAGE);
        a.trip().setArchived(archived);
        a.trip().touch();
        trips.flush();
        return toDto(a.trip(), a.role());
    }

    private void apply(Trip trip, TripUpsert req) {
        trip.setName(req.name().trim());
        Destination destination = null;
        if (req.destinationSlug() != null && !req.destinationSlug().isBlank()) {
            destination = destinations.findBySlugAndDeletedAtIsNull(req.destinationSlug().trim())
                    .filter(Destination::isPublished)
                    .orElseThrow(() -> ApiException.badRequest("destinationSlug", "Unknown destination"));
        }
        trip.setDestination(destination);
        String destName = req.destinationName() != null && !req.destinationName().isBlank()
                ? req.destinationName().trim() : destination != null ? destination.getName() : null;
        if (destName == null) throw ApiException.badRequest("destinationName", "Enter where you are going");
        trip.setDestinationName(destName);
        trip.setStartLocation(blankToNull(req.startLocation()));

        LocalDate start = req.startDate();
        LocalDate end = req.endDate();
        if (start != null && end != null) {
            if (end.isBefore(start)) throw ApiException.badRequest("endDate", "End date must be on or after the start date");
            long days = ChronoUnit.DAYS.between(start, end) + 1;
            if (days > 60) throw ApiException.badRequest("endDate", "Trips can be at most 60 days long");
            trip.setDayCount((int) days);
        } else if (start != null && req.dayCount() != null) {
            end = start.plusDays(req.dayCount() - 1L);
            trip.setDayCount(req.dayCount());
        } else {
            if (end != null) throw ApiException.badRequest("startDate", "Add a start date");
            trip.setDayCount(req.dayCount() == null ? 1 : req.dayCount());
        }
        trip.setStartDate(start);
        trip.setEndDate(end);
        trip.setTravelers(req.travelers() == null ? 1 : req.travelers());
        if (req.tripType() != null && !req.tripType().isBlank()) {
            if (!TripDtos.TRAVEL_STYLES.contains(req.tripType())) throw ApiException.badRequest("tripType", "Unknown trip type");
            trip.setTripType(req.tripType());
        } else {
            trip.setTripType(null);
        }
        trip.setBudgetAmount(Money.parse(req.budgetAmount(), "budgetAmount"));
        trip.setCurrency(Money.currency(req.currency()));
        trip.setCoverImageUrl(blankToNull(req.coverImageUrl()) != null ? req.coverImageUrl().trim()
                : destination != null ? destination.getHeroImageUrl() : null);
        if (trip.getCoverImageUrl() != null && !trip.getCoverImageUrl().startsWith("https://")) {
            throw ApiException.badRequest("coverImageUrl", "Use an https:// image URL");
        }
        trip.setDescription(blankToNull(req.description()));
        String visibility = req.visibility() == null || req.visibility().isBlank() ? "PRIVATE" : req.visibility();
        if (!Set.of("PRIVATE", "SHARED_LINK").contains(visibility)) throw ApiException.badRequest("visibility", "Unknown visibility");
        trip.setVisibility(visibility);
    }

    public TripDto toDto(Trip trip, String role) {
        return toDto(trip, role, items.findActiveByTrip(trip.getId()), expenses.findActiveByTrip(trip.getId()));
    }

    private TripDto toDto(Trip t, String role, List<ItineraryItem> tripItems, List<Expense> tripExpenses) {
        BigDecimal estimated = tripItems.stream()
                .filter(ItineraryItem::countsTowardCost)
                .filter(i -> i.getEstimatedCost() != null && t.getCurrency().equals(i.getCurrency()))
                .map(ItineraryItem::getEstimatedCost).reduce(Money.zero(), BigDecimal::add);
        BigDecimal spent = tripExpenses.stream().filter(e -> t.getCurrency().equals(e.getCurrency()))
                .map(Expense::getAmount).reduce(Money.zero(), BigDecimal::add);
        return new TripDto(t.getId(), t.getName(),
                t.getDestination() == null ? null : destinationMapper.summary(t.getDestination(), Set.of()),
                t.getDestinationName(), t.getStartLocation(), t.getStartDate(), t.getEndDate(), t.getDayCount(),
                t.getTravelers(), t.getTripType(), t.getBudgetAmount(), t.getCurrency(), t.getCoverImageUrl(),
                t.getDescription(), t.getVisibility(), t.getStatus(), t.isArchived(), role, tripItems.size(),
                estimated, spent, t.getVersion(), t.getCreatedAt(), t.getUpdatedAt());
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }
}
