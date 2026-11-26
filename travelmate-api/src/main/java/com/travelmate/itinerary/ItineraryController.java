package com.travelmate.itinerary;

import com.travelmate.auth.CurrentUser;
import com.travelmate.itinerary.ItineraryDtos.ItemRequest;
import com.travelmate.itinerary.ItineraryDtos.ItineraryDto;
import com.travelmate.itinerary.ItineraryDtos.ItineraryItemDto;
import com.travelmate.itinerary.ItineraryDtos.OrderRequest;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@Tag(name = "Itinerary")
public class ItineraryController {

    private final ItineraryService service;

    public ItineraryController(ItineraryService service) {
        this.service = service;
    }

    @GetMapping("/api/v1/trips/{tripId}/itinerary")
    public ItineraryDto get(@PathVariable UUID tripId) {
        return service.get(tripId, CurrentUser.id());
    }

    @PostMapping("/api/v1/trips/{tripId}/itinerary")
    public ResponseEntity<ItineraryItemDto> create(@PathVariable UUID tripId, @Valid @RequestBody ItemRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(tripId, CurrentUser.id(), req));
    }

    @PutMapping("/api/v1/trips/{tripId}/itinerary/order")
    public ItineraryDto reorder(@PathVariable UUID tripId, @Valid @RequestBody OrderRequest req) {
        return service.reorder(tripId, CurrentUser.id(), req.days());
    }

    @PutMapping("/api/v1/itinerary/{itemId}")
    public ItineraryItemDto update(@PathVariable UUID itemId, @Valid @RequestBody ItemRequest req) {
        return service.update(itemId, CurrentUser.id(), req);
    }

    @DeleteMapping("/api/v1/itinerary/{itemId}")
    public ResponseEntity<Void> delete(@PathVariable UUID itemId) {
        service.delete(itemId, CurrentUser.id());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/v1/itinerary/{itemId}/duplicate")
    public ResponseEntity<ItineraryItemDto> duplicate(@PathVariable UUID itemId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.duplicate(itemId, CurrentUser.id()));
    }
}
