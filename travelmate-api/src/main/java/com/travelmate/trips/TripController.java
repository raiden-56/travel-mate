package com.travelmate.trips;

import com.travelmate.auth.CurrentUser;
import com.travelmate.trips.TripDtos.StatusRequest;
import com.travelmate.trips.TripDtos.TripDto;
import com.travelmate.trips.TripDtos.TripUpsert;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/trips")
@Tag(name = "Trips")
public class TripController {

    private final TripService service;

    public TripController(TripService service) {
        this.service = service;
    }

    @GetMapping
    public List<TripDto> list(@RequestParam(required = false) String status,
                              @RequestParam(defaultValue = "false") boolean archived) {
        return service.list(CurrentUser.id(), status, archived);
    }

    @PostMapping
    public ResponseEntity<TripDto> create(@Valid @RequestBody TripUpsert req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(CurrentUser.id(), req));
    }

    @GetMapping("/{id}")
    public TripDto get(@PathVariable UUID id) {
        return service.get(id, CurrentUser.id());
    }

    @PutMapping("/{id}")
    public TripDto update(@PathVariable UUID id, @Valid @RequestBody TripUpsert req) {
        return service.update(id, CurrentUser.id(), req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id, CurrentUser.id());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<TripDto> duplicate(@PathVariable UUID id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.duplicate(id, CurrentUser.id()));
    }

    @PostMapping("/{id}/status")
    public TripDto status(@PathVariable UUID id, @Valid @RequestBody StatusRequest req) {
        return service.changeStatus(id, CurrentUser.id(), req.status());
    }

    @PostMapping("/{id}/archive")
    public TripDto archive(@PathVariable UUID id) {
        return service.setArchived(id, CurrentUser.id(), true);
    }

    @PostMapping("/{id}/unarchive")
    public TripDto unarchive(@PathVariable UUID id) {
        return service.setArchived(id, CurrentUser.id(), false);
    }
}
