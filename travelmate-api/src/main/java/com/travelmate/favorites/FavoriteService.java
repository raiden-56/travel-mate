package com.travelmate.favorites;

import com.travelmate.common.ApiException;
import com.travelmate.destinations.Attraction;
import com.travelmate.destinations.AttractionRepository;
import com.travelmate.destinations.Destination;
import com.travelmate.destinations.DestinationDtos.AttractionDto;
import com.travelmate.destinations.DestinationDtos.DestinationSummary;
import com.travelmate.destinations.DestinationMapper;
import com.travelmate.destinations.DestinationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class FavoriteService {

    public record FavoriteDto(UUID id, String targetType, UUID targetId, Instant createdAt,
                              DestinationSummary destination, AttractionDto attraction) {}

    public record FavoriteRequest(String targetType, UUID targetId) {}

    public record SaveResult(FavoriteDto favorite, boolean created) {}

    private final FavoriteRepository favorites;
    private final DestinationRepository destinations;
    private final AttractionRepository attractions;
    private final DestinationMapper mapper;

    public FavoriteService(FavoriteRepository favorites, DestinationRepository destinations,
                           AttractionRepository attractions, DestinationMapper mapper) {
        this.favorites = favorites;
        this.destinations = destinations;
        this.attractions = attractions;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public List<FavoriteDto> list(UUID userId) {
        List<Favorite> all = favorites.findByUserIdOrderByCreatedAtDesc(userId);
        Set<UUID> destIds = ids(all, Favorite.DESTINATION);
        Set<UUID> attrIds = ids(all, Favorite.ATTRACTION);
        Map<UUID, Destination> dests = destinations.findAllById(destIds).stream()
                .filter(Destination::isPublished).collect(Collectors.toMap(Destination::getId, Function.identity()));
        Map<UUID, Attraction> attrs = attractions.findActiveByIds(attrIds.isEmpty() ? Set.of(new UUID(0, 0)) : attrIds)
                .stream().collect(Collectors.toMap(Attraction::getId, Function.identity()));
        List<FavoriteDto> out = new ArrayList<>();
        for (Favorite f : all) {
            if (Favorite.DESTINATION.equals(f.getTargetType()) && dests.containsKey(f.getTargetId())) {
                out.add(new FavoriteDto(f.getId(), f.getTargetType(), f.getTargetId(), f.getCreatedAt(),
                        mapper.summary(dests.get(f.getTargetId()), destIds), null));
            } else if (Favorite.ATTRACTION.equals(f.getTargetType()) && attrs.containsKey(f.getTargetId())) {
                out.add(new FavoriteDto(f.getId(), f.getTargetType(), f.getTargetId(), f.getCreatedAt(),
                        null, mapper.attraction(attrs.get(f.getTargetId()), attrIds)));
            }
        }
        return out;
    }

    @Transactional
    public SaveResult save(UUID userId, FavoriteRequest req) {
        String type = req.targetType() == null ? "" : req.targetType().trim().toUpperCase();
        if (req.targetId() == null) throw ApiException.badRequest("targetId", "Required");
        validateTarget(type, req.targetId());
        var existing = favorites.findByUserIdAndTargetTypeAndTargetId(userId, type, req.targetId());
        Favorite f = existing.orElseGet(() -> favorites.save(new Favorite(userId, type, req.targetId())));
        return new SaveResult(toDto(f), existing.isEmpty());
    }

    @Transactional
    public void remove(UUID userId, String targetType, UUID targetId) {
        favorites.findByUserIdAndTargetTypeAndTargetId(userId, targetType.toUpperCase(), targetId)
                .ifPresent(favorites::delete);
    }

    private void validateTarget(String type, UUID id) {
        switch (type) {
            case Favorite.DESTINATION -> destinations.findById(id).filter(Destination::isPublished)
                    .orElseThrow(() -> ApiException.notFound("Destination"));
            case Favorite.ATTRACTION -> attractions.findActive(id)
                    .orElseThrow(() -> ApiException.notFound("Attraction"));
            default -> throw ApiException.badRequest("targetType", "Must be DESTINATION or ATTRACTION");
        }
    }

    private FavoriteDto toDto(Favorite f) {
        if (Favorite.DESTINATION.equals(f.getTargetType())) {
            Destination d = destinations.findById(f.getTargetId()).orElseThrow();
            return new FavoriteDto(f.getId(), f.getTargetType(), f.getTargetId(), f.getCreatedAt(),
                    mapper.summary(d, Set.of(d.getId())), null);
        }
        Attraction a = attractions.findActive(f.getTargetId()).orElseThrow();
        return new FavoriteDto(f.getId(), f.getTargetType(), f.getTargetId(), f.getCreatedAt(),
                null, mapper.attraction(a, Set.of(a.getId())));
    }

    private static Set<UUID> ids(List<Favorite> all, String type) {
        return all.stream().filter(f -> type.equals(f.getTargetType())).map(Favorite::getTargetId)
                .collect(Collectors.toSet());
    }
}
