package com.travelmate.admin;

import com.travelmate.admin.AdminDtos.AdminStats;
import com.travelmate.admin.AdminDtos.AdminUserRow;
import com.travelmate.admin.AdminDtos.AttractionUpsert;
import com.travelmate.admin.AdminDtos.DestinationUpsert;
import com.travelmate.admin.AdminDtos.ReasonRequest;
import com.travelmate.audit.AuditService;
import com.travelmate.auth.CurrentUser;
import com.travelmate.common.PageResponse;
import com.travelmate.destinations.DestinationDtos.AdminDestinationRow;
import com.travelmate.destinations.DestinationDtos.AttractionDto;
import com.travelmate.destinations.DestinationDtos.DestinationDetail;
import com.travelmate.users.UserDto;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** Admin portal API. Every endpoint is permission-checked on the server. */
@RestController
@RequestMapping("/api/v1/admin")
@Tag(name = "Admin")
@PreAuthorize("hasAuthority('admin:access')")
public class AdminController {

    private final AdminDestinationService destinations;
    private final AdminUserService users;
    private final AuditService audit;

    public AdminController(AdminDestinationService destinations, AdminUserService users, AuditService audit) {
        this.destinations = destinations;
        this.users = users;
        this.audit = audit;
    }

    @GetMapping("/stats")
    public AdminStats stats() {
        return users.stats();
    }

    // ───── destinations ─────

    @GetMapping("/destinations")
    @PreAuthorize("hasAuthority('destination:write')")
    public PageResponse<AdminDestinationRow> listDestinations(@RequestParam(required = false) String q,
                                                              @RequestParam(required = false) String status,
                                                              @RequestParam(required = false) Integer page,
                                                              @RequestParam(required = false) Integer size) {
        return destinations.list(q, status, page, size);
    }

    @GetMapping("/destinations/{id}")
    @PreAuthorize("hasAuthority('destination:write')")
    public DestinationDetail getDestination(@PathVariable UUID id) {
        return destinations.get(id);
    }

    @PostMapping("/destinations")
    @PreAuthorize("hasAuthority('destination:write')")
    public ResponseEntity<DestinationDetail> createDestination(@Valid @RequestBody DestinationUpsert req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(destinations.create(req));
    }

    @PutMapping("/destinations/{id}")
    @PreAuthorize("hasAuthority('destination:write')")
    public DestinationDetail updateDestination(@PathVariable UUID id, @Valid @RequestBody DestinationUpsert req) {
        return destinations.update(id, req);
    }

    @DeleteMapping("/destinations/{id}")
    @PreAuthorize("hasAuthority('destination:write')")
    public ResponseEntity<Void> deleteDestination(@PathVariable UUID id) {
        destinations.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/destinations/{id}/publish")
    @PreAuthorize("hasAuthority('destination:publish')")
    public DestinationDetail publish(@PathVariable UUID id) {
        return destinations.setPublished(id, true);
    }

    @PostMapping("/destinations/{id}/unpublish")
    @PreAuthorize("hasAuthority('destination:publish')")
    public DestinationDetail unpublish(@PathVariable UUID id) {
        return destinations.setPublished(id, false);
    }

    @PostMapping("/destinations/{id}/attractions")
    @PreAuthorize("hasAuthority('destination:write')")
    public ResponseEntity<AttractionDto> createAttraction(@PathVariable UUID id, @Valid @RequestBody AttractionUpsert req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(destinations.createAttraction(id, req));
    }

    @PutMapping("/attractions/{id}")
    @PreAuthorize("hasAuthority('destination:write')")
    public AttractionDto updateAttraction(@PathVariable UUID id, @Valid @RequestBody AttractionUpsert req) {
        return destinations.updateAttraction(id, req);
    }

    @DeleteMapping("/attractions/{id}")
    @PreAuthorize("hasAuthority('destination:write')")
    public ResponseEntity<Void> deleteAttraction(@PathVariable UUID id) {
        destinations.deleteAttraction(id);
        return ResponseEntity.noContent().build();
    }

    // ───── users ─────

    @GetMapping("/users")
    @PreAuthorize("hasAuthority('user:read')")
    public PageResponse<AdminUserRow> listUsers(@RequestParam(required = false) String q,
                                                @RequestParam(required = false) String status,
                                                @RequestParam(required = false) Integer page,
                                                @RequestParam(required = false) Integer size) {
        return users.list(q, status, page, size);
    }

    @PostMapping("/users/{id}/suspend")
    @PreAuthorize("hasAuthority('user:manage')")
    public UserDto suspend(@PathVariable UUID id, @Valid @RequestBody(required = false) ReasonRequest req) {
        return users.setSuspended(CurrentUser.require(), id, true, req == null ? null : req.reason());
    }

    @PostMapping("/users/{id}/reactivate")
    @PreAuthorize("hasAuthority('user:manage')")
    public UserDto reactivate(@PathVariable UUID id, @Valid @RequestBody(required = false) ReasonRequest req) {
        return users.setSuspended(CurrentUser.require(), id, false, req == null ? null : req.reason());
    }

    // ───── audit ─────

    @GetMapping("/audit-logs")
    @PreAuthorize("hasAuthority('audit:read')")
    public PageResponse<AuditService.AuditLogDto> auditLogs(@RequestParam(required = false) Integer page,
                                                            @RequestParam(required = false) Integer size) {
        return audit.list(PageResponse.clampPage(page), PageResponse.clampSize(size));
    }
}
