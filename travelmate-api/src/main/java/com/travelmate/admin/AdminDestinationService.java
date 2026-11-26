package com.travelmate.admin;

import com.travelmate.admin.AdminDtos.AttractionUpsert;
import com.travelmate.admin.AdminDtos.DestinationUpsert;
import com.travelmate.audit.AuditService;
import com.travelmate.common.ApiException;
import com.travelmate.common.Money;
import com.travelmate.common.PageResponse;
import com.travelmate.common.Slugs;
import com.travelmate.destinations.Attraction;
import com.travelmate.destinations.AttractionRepository;
import com.travelmate.destinations.Destination;
import com.travelmate.destinations.DestinationCategory;
import com.travelmate.destinations.DestinationCategoryRepository;
import com.travelmate.destinations.DestinationDtos.AdminDestinationRow;
import com.travelmate.destinations.DestinationDtos.AttractionDto;
import com.travelmate.destinations.DestinationDtos.DestinationDetail;
import com.travelmate.destinations.DestinationDtos.GalleryImage;
import com.travelmate.destinations.DestinationImage;
import com.travelmate.destinations.DestinationMapper;
import com.travelmate.destinations.DestinationRepository;
import com.travelmate.destinations.DestinationService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class AdminDestinationService {

    private final DestinationRepository destinations;
    private final DestinationCategoryRepository categories;
    private final AttractionRepository attractions;
    private final DestinationMapper mapper;
    private final DestinationService destinationService;
    private final AuditService audit;

    public AdminDestinationService(DestinationRepository destinations, DestinationCategoryRepository categories,
                                   AttractionRepository attractions, DestinationMapper mapper,
                                   DestinationService destinationService, AuditService audit) {
        this.destinations = destinations;
        this.categories = categories;
        this.attractions = attractions;
        this.mapper = mapper;
        this.destinationService = destinationService;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminDestinationRow> list(String q, String status, Integer page, Integer size) {
        if (status != null && !status.isBlank() && !Set.of("DRAFT", "PUBLISHED").contains(status)) {
            throw ApiException.badRequest("status", "Unknown status");
        }
        var result = destinations.searchAdmin(DestinationService.likePattern(q),
                status == null || status.isBlank() ? null : status,
                PageRequest.of(PageResponse.clampPage(page), PageResponse.clampSize(size), Sort.by(Sort.Direction.DESC, "updatedAt")));
        return PageResponse.of(result, d -> new AdminDestinationRow(mapper.summary(d, Set.of()), d.getStatus(), d.getUpdatedAt()));
    }

    @Transactional(readOnly = true)
    public DestinationDetail get(UUID id) {
        return detail(load(id));
    }

    @Transactional
    public DestinationDetail create(DestinationUpsert req) {
        Destination d = new Destination();
        d.setStatus("DRAFT");
        String slug = req.slug() == null || req.slug().isBlank() ? Slugs.slugify(req.name()) : Slugs.slugify(req.slug());
        if (slug.isEmpty()) throw ApiException.badRequest("slug", "Could not build a URL slug from the name");
        if (destinations.existsBySlug(slug)) throw ApiException.conflict("A destination with slug \"" + slug + "\" already exists");
        d.setSlug(slug);
        apply(d, req);
        destinations.save(d);
        audit.record("destination.create", "DESTINATION", d.getId(), d.getSlug());
        return detail(d);
    }

    @Transactional
    public DestinationDetail update(UUID id, DestinationUpsert req) {
        Destination d = load(id);
        if (req.slug() != null && !req.slug().isBlank()) {
            String slug = Slugs.slugify(req.slug());
            if (!slug.equals(d.getSlug()) && destinations.existsBySlug(slug)) {
                throw ApiException.conflict("A destination with slug \"" + slug + "\" already exists");
            }
            d.setSlug(slug);
        }
        apply(d, req);
        d.touch();
        destinations.flush();
        audit.record("destination.update", "DESTINATION", d.getId(), d.getSlug());
        return detail(d);
    }

    @Transactional
    public void delete(UUID id) {
        Destination d = load(id);
        d.setDeletedAt(Instant.now());
        d.setStatus("DRAFT");
        audit.record("destination.delete", "DESTINATION", d.getId(), d.getSlug());
    }

    @Transactional
    public DestinationDetail setPublished(UUID id, boolean published) {
        Destination d = load(id);
        if (published) {
            if (d.getHeroImageUrl() == null) throw ApiException.badRequest("heroImageUrl", "Add a hero image before publishing");
            if (attractions.findActiveByDestination(d.getId()).isEmpty()) {
                throw ApiException.badRequest("attractions", "Add at least one attraction before publishing");
            }
        }
        d.setStatus(published ? "PUBLISHED" : "DRAFT");
        d.touch();
        destinations.flush();
        audit.record(published ? "destination.publish" : "destination.unpublish", "DESTINATION", d.getId(), d.getSlug());
        return detail(d);
    }

    @Transactional
    public AttractionDto createAttraction(UUID destinationId, AttractionUpsert req) {
        Destination d = load(destinationId);
        Attraction a = new Attraction();
        a.setDestination(d);
        String slug = req.slug() == null || req.slug().isBlank() ? Slugs.slugify(req.name()) : Slugs.slugify(req.slug());
        if (attractions.existsByDestinationIdAndSlug(d.getId(), slug)) {
            throw ApiException.conflict("An attraction with slug \"" + slug + "\" already exists here");
        }
        a.setSlug(slug);
        apply(a, req);
        attractions.save(a);
        audit.record("attraction.create", "ATTRACTION", a.getId(), d.getSlug() + "/" + slug);
        return mapper.attraction(a, Set.of());
    }

    @Transactional
    public AttractionDto updateAttraction(UUID id, AttractionUpsert req) {
        Attraction a = attractions.findActive(id).orElseThrow(() -> ApiException.notFound("Attraction"));
        if (req.slug() != null && !req.slug().isBlank()) {
            String slug = Slugs.slugify(req.slug());
            if (!slug.equals(a.getSlug()) && attractions.existsByDestinationIdAndSlug(a.getDestination().getId(), slug)) {
                throw ApiException.conflict("An attraction with slug \"" + slug + "\" already exists here");
            }
            a.setSlug(slug);
        }
        apply(a, req);
        a.touch();
        audit.record("attraction.update", "ATTRACTION", a.getId(), a.getSlug());
        return mapper.attraction(a, Set.of());
    }

    @Transactional
    public void deleteAttraction(UUID id) {
        Attraction a = attractions.findActive(id).orElseThrow(() -> ApiException.notFound("Attraction"));
        a.setDeletedAt(Instant.now());
        audit.record("attraction.delete", "ATTRACTION", a.getId(), a.getSlug());
    }

    private Destination load(UUID id) {
        return destinations.findByIdAndDeletedAtIsNull(id).orElseThrow(() -> ApiException.notFound("Destination"));
    }

    private DestinationDetail detail(Destination d) {
        return mapper.detail(d, attractions.findActiveByDestination(d.getId()), destinationService.similar(d), Set.of(), Set.of());
    }

    private void apply(Destination d, DestinationUpsert req) {
        if (req.recommendedDaysMax() < req.recommendedDaysMin()) {
            throw ApiException.badRequest("recommendedDaysMax", "Must be at least the minimum");
        }
        BigDecimal bmin = Money.orZero(Money.parse(req.budgetPerDayMin(), "budgetPerDayMin"));
        BigDecimal bmax = Money.orZero(Money.parse(req.budgetPerDayMax(), "budgetPerDayMax"));
        if (bmax.compareTo(bmin) < 0) throw ApiException.badRequest("budgetPerDayMax", "Must be at least the minimum");
        d.setName(req.name().trim());
        d.setRegion(req.region().trim());
        d.setState(req.state().trim());
        d.setCountry(req.country().trim());
        d.setLatitude(coord(req.latitude()));
        d.setLongitude(coord(req.longitude()));
        d.setSummary(req.summary().trim());
        d.setDescription(req.description().trim());
        d.setHeroImageUrl(httpsOrNull(req.heroImageUrl(), "heroImageUrl"));
        d.setHeroImageCredit(blank(req.heroImageCredit()));
        d.setBestTimeToVisit(blank(req.bestTimeToVisit()));
        d.setRecommendedDaysMin(req.recommendedDaysMin());
        d.setRecommendedDaysMax(req.recommendedDaysMax());
        d.setBudgetPerDayMin(bmin);
        d.setBudgetPerDayMax(bmax);
        d.setCurrency(Money.currency(req.currency()));
        d.setHowToReach(blank(req.howToReach()));
        d.setLocalTransport(blank(req.localTransport()));
        d.setTravelTips(req.travelTips() == null || req.travelTips().isEmpty() ? null
                : String.join("|", req.travelTips().stream().map(t -> t.replace("|", "/").trim()).filter(t -> !t.isEmpty()).toList()));
        d.setSafetyInfo(blank(req.safetyInfo()));
        d.setFaqs(mapper.writeFaqs(req.faqs()));
        d.setFeatured(Boolean.TRUE.equals(req.featured()));
        d.setSeoTitle(blank(req.seoTitle()));
        d.setSeoDescription(blank(req.seoDescription()));
        if (req.categorySlugs() != null) {
            List<DestinationCategory> cats = categories.findBySlugIn(req.categorySlugs());
            if (cats.size() != new HashSet<>(req.categorySlugs()).size()) {
                throw ApiException.badRequest("categorySlugs", "Unknown category in list");
            }
            d.getCategories().clear();
            d.getCategories().addAll(cats);
        }
        if (req.gallery() != null) {
            d.getImages().clear();
            int i = 0;
            for (GalleryImage g : req.gallery()) {
                String url = httpsOrNull(g.url(), "gallery");
                if (url == null) continue;
                d.getImages().add(new DestinationImage(d, url, blank(g.credit()), g.alt() == null || g.alt().isBlank() ? d.getName() : g.alt().trim(), i++));
            }
        }
    }

    private static void apply(Attraction a, AttractionUpsert req) {
        String cat = req.category().trim().toUpperCase();
        if (!Attraction.CATEGORIES.contains(cat)) throw ApiException.badRequest("category", "Unknown category");
        String time = req.bestTimeOfDay() == null || req.bestTimeOfDay().isBlank() ? "ANY" : req.bestTimeOfDay().trim().toUpperCase();
        if (!Attraction.TIMES.contains(time)) throw ApiException.badRequest("bestTimeOfDay", "Unknown time of day");
        BigDecimal min = Money.orZero(Money.parse(req.costMin(), "costMin"));
        BigDecimal max = Money.orZero(Money.parse(req.costMax(), "costMax"));
        if (max.compareTo(min) < 0) throw ApiException.badRequest("costMax", "Must be at least the minimum");
        a.setName(req.name().trim());
        a.setCategory(cat);
        a.setDescription(req.description().trim());
        a.setLatitude(coord(req.latitude()));
        a.setLongitude(coord(req.longitude()));
        a.setTypicalDurationMinutes(req.typicalDurationMinutes());
        a.setCostMin(min);
        a.setCostMax(max);
        a.setCurrency(Money.currency(req.currency()));
        a.setCostNote(blank(req.costNote()));
        a.setBestTimeOfDay(time);
        a.setOpeningHoursNote(blank(req.openingHoursNote()));
        a.setOpeningHoursVerified(Boolean.TRUE.equals(req.openingHoursVerified()));
        a.setTags(req.tags() == null || req.tags().isEmpty() ? null
                : String.join(",", req.tags().stream().map(t -> Slugs.slugify(t)).filter(t -> !t.isEmpty()).distinct().toList()));
        a.setFamilyFriendly(req.familyFriendly() == null || req.familyFriendly());
        a.setAccessibilityNote(blank(req.accessibilityNote()));
    }

    private static BigDecimal coord(Double v) {
        return BigDecimal.valueOf(v).setScale(6, RoundingMode.HALF_UP);
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String httpsOrNull(String s, String field) {
        String v = blank(s);
        if (v != null && !v.startsWith("https://")) throw ApiException.badRequest(field, "Use an https:// image URL");
        return v;
    }
}
