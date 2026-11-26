package com.travelmate.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.travelmate.ai.PlanDtos.ApplyRequest;
import com.travelmate.ai.PlanDtos.EngineInfo;
import com.travelmate.ai.PlanDtos.PlanProposal;
import com.travelmate.ai.PlanDtos.PlanRequest;
import com.travelmate.ai.PlanDtos.ProposedDay;
import com.travelmate.ai.PlanDtos.ProposedItem;
import com.travelmate.ai.PlannerModel.Context;
import com.travelmate.ai.PlannerModel.Draft;
import com.travelmate.ai.PlannerModel.EngineFailure;
import com.travelmate.ai.PlannerModel.ExistingItem;
import com.travelmate.auth.RateLimiter;
import com.travelmate.common.ApiException;
import com.travelmate.common.Money;
import com.travelmate.config.AppProperties;
import com.travelmate.destinations.Attraction;
import com.travelmate.destinations.AttractionRepository;
import com.travelmate.destinations.Destination;
import com.travelmate.destinations.DestinationRepository;
import com.travelmate.itinerary.ItineraryItem;
import com.travelmate.itinerary.ItineraryItemRepository;
import com.travelmate.trips.Trip;
import com.travelmate.trips.TripAccessService;
import com.travelmate.trips.TripAccessService.TripPermission;
import com.travelmate.trips.TripDtos;
import com.travelmate.trips.TripDtos.TripDto;
import com.travelmate.trips.TripDtos.TripUpsert;
import com.travelmate.trips.TripRepository;
import com.travelmate.trips.TripService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class PlannerService {

    private static final Set<String> PACES = Set.of("RELAXED", "BALANCED", "PACKED");
    private static final Set<String> TRANSPORTS = Set.of("ROAD_TRIP", "BUS", "TRAIN", "FLIGHT", "MIXED");
    private static final Set<String> STAYS = Set.of("BUDGET", "MIDRANGE", "LUXURY", "HOSTEL", "HOMESTAY", "CAMPING");

    private final DeterministicPlannerEngine deterministic;
    private final AnthropicPlannerEngine anthropic;
    private final DestinationRepository destinations;
    private final AttractionRepository attractions;
    private final TripAccessService access;
    private final TripRepository trips;
    private final TripService tripService;
    private final ItineraryItemRepository items;
    private final AiPlanProposalRepository proposals;
    private final ObjectMapper mapper;
    private final RateLimiter rateLimiter;
    private final AppProperties props;

    public PlannerService(DeterministicPlannerEngine deterministic, AnthropicPlannerEngine anthropic,
                          DestinationRepository destinations, AttractionRepository attractions,
                          TripAccessService access, TripRepository trips, TripService tripService,
                          ItineraryItemRepository items, AiPlanProposalRepository proposals, ObjectMapper mapper,
                          RateLimiter rateLimiter, AppProperties props) {
        this.deterministic = deterministic;
        this.anthropic = anthropic;
        this.destinations = destinations;
        this.attractions = attractions;
        this.access = access;
        this.trips = trips;
        this.tripService = tripService;
        this.items = items;
        this.proposals = proposals;
        this.mapper = mapper;
        this.rateLimiter = rateLimiter;
        this.props = props;
    }

    public EngineInfo status() {
        return anthropic.isConfigured() ? anthropic.info() : deterministic.info();
    }

    public PlanProposal generate(UUID userId, PlanRequest raw) {
        limit(userId);
        PlanRequest req = normalize(raw);
        Destination destination = resolveDestination(req);
        String destName = destination != null ? destination.getName()
                : (req.destinationName() == null || req.destinationName().isBlank() ? null : req.destinationName().trim());
        if (destName == null) throw ApiException.badRequest("destinationSlug", "Choose a destination");
        Context ctx = context(destination, destName, req.startDate(), req.currency());

        List<String> extraWarnings = new ArrayList<>();
        EngineInfo engine;
        Draft draft;
        if (anthropic.isConfigured()) {
            try {
                draft = anthropic.generate(req, ctx);
                engine = anthropic.info();
            } catch (EngineFailure e) {
                extraWarnings.add("The AI planner was unavailable, so the offline planner made this plan.");
                draft = deterministic.generate(req, ctx);
                engine = deterministic.info();
            }
        } else {
            draft = deterministic.generate(req, ctx);
            engine = deterministic.info();
        }
        return persist(userId, null, engine, req, ctx, draft, extraWarnings);
    }

    public PlanProposal modify(UUID userId, UUID tripId, String instruction) {
        limit(userId);
        Trip trip = access.require(tripId, userId, TripPermission.EDIT).trip();
        List<ItineraryItem> current = items.findActiveByTrip(tripId);
        Destination destination = trip.getDestination() == null ? null
                : destinations.findByIdAndDeletedAtIsNull(trip.getDestination().getId()).orElse(null);
        Context ctx = context(destination, trip.getDestinationName(), trip.getStartDate(), trip.getCurrency());
        PlanRequest baseline = baseline(trip, current, destination);
        List<ExistingItem> existing = current.stream().map(ExistingItem::of).toList();

        List<String> extraWarnings = new ArrayList<>();
        EngineInfo engine;
        Draft draft;
        if (anthropic.isConfigured()) {
            try {
                draft = anthropic.modify(instruction, baseline, ctx, existing);
                engine = anthropic.info();
            } catch (EngineFailure e) {
                extraWarnings.add("The AI planner was unavailable, so the offline planner made these changes.");
                draft = deterministic.modify(instruction, baseline, ctx, existing);
                engine = deterministic.info();
            }
        } else {
            draft = deterministic.modify(instruction, baseline, ctx, existing);
            engine = deterministic.info();
        }
        draft = ensureProtectedKept(draft, existing, ctx.currency(), extraWarnings);
        PlanRequest effective = baseline.withDays(Math.max(1, draft.days().size()));
        return persist(userId, tripId, engine, effective, ctx, draft, extraWarnings);
    }

    @Transactional
    public TripDto apply(UUID userId, UUID proposalId, ApplyRequest req) {
        AiPlanProposal stored = proposals.findByIdAndUserId(proposalId, userId)
                .orElseThrow(() -> ApiException.notFound("Proposal"));
        PlanProposal proposal = read(stored);
        boolean hasTrip = req != null && req.tripId() != null;
        boolean newTrip = req != null && req.trip() != null;
        if (hasTrip == newTrip) throw ApiException.badRequest("tripId", "Send either tripId or trip");
        if (stored.getTripId() != null && !stored.getTripId().equals(req.tripId())) {
            throw ApiException.badRequest("tripId", "This proposal was made for a different trip");
        }
        String source = "anthropic".equals(proposal.engine().id()) ? "AI" : "PLANNER";
        int proposedDays = proposal.days().size();
        UUID tripId;
        if (newTrip) {
            TripUpsert t = req.trip();
            boolean datesGiven = t.startDate() != null && t.endDate() != null;
            TripUpsert upsert = new TripUpsert(t.name(),
                    t.destinationSlug() != null ? t.destinationSlug() : proposal.request().destinationSlug(),
                    t.destinationName() != null ? t.destinationName() : proposal.request().destinationName(),
                    t.startLocation() != null ? t.startLocation() : proposal.request().startLocation(),
                    t.startDate() != null ? t.startDate() : proposal.request().startDate(),
                    datesGiven ? t.endDate() : null,
                    datesGiven ? t.dayCount() : Integer.valueOf(proposedDays),
                    t.travelers() != null ? t.travelers() : proposal.request().travelers(),
                    t.tripType() != null ? t.tripType() : firstStyle(proposal.request()),
                    t.budgetAmount() != null ? t.budgetAmount() : proposal.request().budget(),
                    t.currency() != null ? t.currency() : proposal.currency(),
                    t.coverImageUrl(), t.description(), t.visibility(), null);
            tripId = tripService.create(userId, upsert).id();
            for (ProposedDay d : proposal.days()) {
                for (ProposedItem p : d.items()) items.save(newItem(tripId, p, source));
            }
        } else {
            tripId = req.tripId();
            Trip trip = access.require(tripId, userId, TripPermission.EDIT).trip();
            Map<UUID, ItineraryItem> existing = items.findActiveByTrip(tripId).stream()
                    .collect(Collectors.toMap(ItineraryItem::getId, Function.identity()));
            Set<UUID> keep = new HashSet<>();
            for (ProposedDay d : proposal.days()) {
                for (ProposedItem p : d.items()) {
                    ItineraryItem src = p.sourceItemId() == null ? null : existing.get(p.sourceItemId());
                    if (src != null) {
                        keep.add(src.getId());
                        if (src.isProtected()) continue;
                        src.setDayNumber(p.dayNumber());
                        src.setPosition(p.position());
                        src.setStartTime(p.startTime());
                        src.setEndTime(p.endTime());
                        src.touch();
                    } else {
                        items.save(newItem(tripId, p, source));
                    }
                }
            }
            Instant now = Instant.now();
            existing.values().stream().filter(i -> !keep.contains(i.getId()) && !i.isProtected())
                    .forEach(i -> i.setDeletedAt(now));
            if (proposedDays != trip.getDayCount() && proposedDays >= 1 && proposedDays <= 60) {
                trip.setDayCount(proposedDays);
                if (trip.getStartDate() != null) trip.setEndDate(trip.getStartDate().plusDays(proposedDays - 1L));
                trip.touch();
            }
        }
        stored.markApplied(Instant.now());
        trips.flush();
        return tripService.get(tripId, userId);
    }

    // ───────────── helpers ─────────────

    private ItineraryItem newItem(UUID tripId, ProposedItem p, String source) {
        ItineraryItem i = new ItineraryItem();
        i.setTripId(tripId);
        i.setDayNumber(Math.max(1, p.dayNumber()));
        i.setPosition(p.position());
        i.setTitle(p.title() == null || p.title().isBlank() ? "Untitled stop" : trim(p.title(), 200));
        i.setDescription(p.description() == null ? null : trim(p.description(), 2000));
        i.setCategory(ItineraryItem.CATEGORIES.contains(p.category()) ? p.category() : "CUSTOM");
        i.setLocationName(p.locationName() == null ? null : trim(p.locationName(), 200));
        if (p.latitude() != null && p.longitude() != null) {
            i.setLatitude(BigDecimal.valueOf(p.latitude()).setScale(6, RoundingMode.HALF_UP));
            i.setLongitude(BigDecimal.valueOf(p.longitude()).setScale(6, RoundingMode.HALF_UP));
        }
        i.setStartTime(p.startTime());
        i.setEndTime(p.endTime());
        i.setDurationMinutes(p.durationMinutes());
        i.setEstimatedCost(p.estimatedCost());
        i.setCurrency(p.currency() == null ? Money.DEFAULT_CURRENCY : p.currency());
        i.setCostIsEstimate(true);
        i.setAttractionId(p.attractionId() == null ? null
                : attractions.findActive(p.attractionId()).map(Attraction::getId).orElse(null));
        i.setSource(source);
        i.setAiReason(p.reason() == null ? null : trim(p.reason(), 1000));
        return i;
    }

    private Draft ensureProtectedKept(Draft draft, List<ExistingItem> existing, String currency, List<String> warnings) {
        Set<UUID> present = new HashSet<>();
        draft.days().forEach(d -> d.items().forEach(i -> { if (i.sourceItemId() != null) present.add(i.sourceItemId()); }));
        List<ExistingItem> missing = existing.stream().filter(e -> e.isProtected() && !present.contains(e.id())).toList();
        if (missing.isEmpty()) return draft;
        int maxDay = Math.max(draft.days().size(), missing.stream().mapToInt(ExistingItem::dayNumber).max().orElse(1));
        List<ProposedDay> days = new ArrayList<>();
        for (int d = 1; d <= maxDay; d++) {
            final int day = d;
            ProposedDay base = d <= draft.days().size() ? draft.days().get(d - 1) : new ProposedDay(d, null, "Day " + d, List.of());
            List<ProposedItem> list = new ArrayList<>(base.items());
            missing.stream().filter(e -> e.dayNumber() == day)
                    .forEach(e -> list.add(DeterministicPlannerEngine.carry(e, day, true, currency).withPosition(list.size())));
            days.add(new ProposedDay(base.dayNumber(), base.date(), base.title(), list));
        }
        missing.forEach(e -> warnings.add("\"" + e.title() + "\" is locked or booked and was kept."));
        return new Draft(draft.summary(), days, draft.tips(), draft.assumptions(), draft.warnings());
    }

    private PlanProposal persist(UUID userId, UUID tripId, EngineInfo engine, PlanRequest req, Context ctx, Draft draft,
                                 List<String> extraWarnings) {
        String currency = ctx.currency();
        BigDecimal total = ItineraryComposer.total(draft.days(), currency);
        BigDecimal budget = parseBudget(req.budget());
        String status = budget == null ? "UNKNOWN" : total.compareTo(budget) > 0 ? "OVER" : "WITHIN";
        List<String> warnings = new ArrayList<>(extraWarnings);
        warnings.addAll(draft.warnings());
        if ("OVER".equals(status)) {
            warnings.add("The estimate (" + currency + " " + total.toPlainString() + ") is above your budget of "
                    + currency + " " + budget.toPlainString() + ". Try \"make this trip cheaper\".");
        }
        AiPlanProposal stored = proposals.save(new AiPlanProposal(userId, tripId, engine.id(), "{}"));
        PlanProposal proposal = new PlanProposal(stored.getId(), engine, req, tripId, draft.summary(), draft.days(),
                total, currency, status, draft.tips(), draft.assumptions(), warnings, stored.getCreatedAt());
        try {
            stored.setPayload(mapper.writeValueAsString(proposal));
        } catch (Exception e) {
            throw new IllegalStateException("Could not serialise proposal", e);
        }
        proposals.save(stored);
        return proposal;
    }

    private PlanProposal read(AiPlanProposal stored) {
        try {
            return mapper.readValue(stored.getPayload(), PlanProposal.class);
        } catch (Exception e) {
            throw new IllegalStateException("Stored proposal is unreadable", e);
        }
    }

    private Context context(Destination destination, String name, java.time.LocalDate start, String currency) {
        List<Attraction> catalogue = destination == null ? List.of() : attractions.findActiveByDestination(destination.getId());
        return new Context(destination, name, catalogue, start, currency == null ? Money.DEFAULT_CURRENCY : currency);
    }

    private Destination resolveDestination(PlanRequest req) {
        if (req.destinationSlug() != null && !req.destinationSlug().isBlank()) {
            return destinations.findBySlugAndDeletedAtIsNull(req.destinationSlug().trim()).filter(Destination::isPublished)
                    .orElseThrow(() -> ApiException.badRequest("destinationSlug", "Unknown destination"));
        }
        if (req.destinationName() != null && !req.destinationName().isBlank()) {
            String n = req.destinationName().trim().toLowerCase(Locale.ROOT);
            return destinations.findAllPublished().stream()
                    .filter(d -> d.getName().toLowerCase(Locale.ROOT).equals(n) || d.getSlug().equals(n))
                    .findFirst().orElse(null);
        }
        return null;
    }

    private PlanRequest baseline(Trip trip, List<ItineraryItem> current, Destination destination) {
        long activities = current.stream().filter(i -> ItineraryComposer.isActivityCategory(i.getCategory())).count();
        double perDay = activities / (double) Math.max(1, trip.getDayCount());
        String pace = perDay <= 2 ? "RELAXED" : perDay >= 4 ? "PACKED" : "BALANCED";
        String stay = current.stream().filter(i -> "HOTEL".equals(i.getCategory())).map(ItineraryItem::getTitle)
                .map(t -> t.toLowerCase(Locale.ROOT)).findFirst().map(t -> t.contains("luxury") ? "LUXURY"
                        : t.contains("budget") ? "BUDGET" : t.contains("hostel") ? "HOSTEL"
                        : t.contains("homestay") ? "HOMESTAY" : t.contains("camping") ? "CAMPING" : "MIDRANGE")
                .orElse(null);
        return new PlanRequest(trip.getStartLocation(), destination == null ? null : destination.getSlug(),
                trip.getDestinationName(), trip.getStartDate(), false, Math.min(14, trip.getDayCount()),
                Math.min(20, trip.getTravelers()),
                trip.getBudgetAmount() == null ? null : trip.getBudgetAmount().toPlainString(), trip.getCurrency(),
                null, stay, trip.getTripType() == null ? List.of() : List.of(trip.getTripType()), List.of(), pace,
                null, null);
    }

    private PlanRequest normalize(PlanRequest r) {
        List<String> styles = r.styles() == null ? List.of() : r.styles().stream().map(s -> s.trim().toUpperCase(Locale.ROOT)).distinct().toList();
        for (String s : styles) if (!TripDtos.TRAVEL_STYLES.contains(s)) throw ApiException.badRequest("styles", "Unknown style " + s);
        String pace = r.pace() == null || r.pace().isBlank() ? "BALANCED" : r.pace().trim().toUpperCase(Locale.ROOT);
        if (!PACES.contains(pace)) throw ApiException.badRequest("pace", "Unknown pace");
        String transport = upperOrNull(r.transport());
        if (transport != null && !TRANSPORTS.contains(transport)) throw ApiException.badRequest("transport", "Unknown transport");
        String stay = upperOrNull(r.accommodation());
        if (stay != null && !STAYS.contains(stay)) throw ApiException.badRequest("accommodation", "Unknown accommodation");
        BigDecimal budget = Money.parse(r.budget(), "budget");
        return new PlanRequest(trimOrNull(r.startLocation()), trimOrNull(r.destinationSlug()), trimOrNull(r.destinationName()),
                r.startDate(), r.flexibleDates() != null && r.flexibleDates(), r.days(), r.travelers(),
                budget == null ? null : budget.toPlainString(), Money.currency(r.currency()), transport, stay, styles,
                r.interests() == null ? List.of() : r.interests().stream().map(String::trim).filter(s -> !s.isEmpty()).toList(),
                pace, trimOrNull(r.dietary()), trimOrNull(r.accessibility()));
    }

    private void limit(UUID userId) {
        var cfg = props.rateLimit();
        if (!rateLimiter.tryAcquire("ai:" + userId, cfg.aiPerWindow(), cfg.aiWindow())) throw ApiException.rateLimited();
    }

    private static BigDecimal parseBudget(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return new BigDecimal(raw).setScale(2, RoundingMode.HALF_UP);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String firstStyle(PlanRequest r) {
        return Optional.ofNullable(r.styles()).filter(l -> !l.isEmpty()).map(l -> l.get(0)).orElse(null);
    }

    private static String upperOrNull(String s) {
        return s == null || s.isBlank() ? null : s.trim().toUpperCase(Locale.ROOT);
    }

    private static String trimOrNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String trim(String s, int max) {
        String t = s.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }
}
