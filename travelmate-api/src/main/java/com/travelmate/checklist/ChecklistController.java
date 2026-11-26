package com.travelmate.checklist;

import com.travelmate.auth.CurrentUser;
import com.travelmate.checklist.ChecklistService.ChecklistDto;
import com.travelmate.checklist.ChecklistService.ChecklistItemDto;
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

import java.util.List;
import java.util.UUID;

@RestController
@Tag(name = "Checklist")
public class ChecklistController {

    private final ChecklistService service;

    public ChecklistController(ChecklistService service) {
        this.service = service;
    }

    @GetMapping("/api/v1/checklist-templates")
    public List<ChecklistTemplates.Template> templates() {
        return ChecklistTemplates.ALL;
    }

    @GetMapping("/api/v1/trips/{tripId}/checklists")
    public List<ChecklistDto> list(@PathVariable UUID tripId) {
        return service.list(tripId, CurrentUser.id());
    }

    @PostMapping("/api/v1/trips/{tripId}/checklists")
    public ResponseEntity<ChecklistDto> create(@PathVariable UUID tripId,
                                               @Valid @RequestBody ChecklistService.CreateChecklist req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(tripId, CurrentUser.id(), req));
    }

    @PostMapping("/api/v1/trips/{tripId}/checklists/suggest")
    public ChecklistSuggester.Result suggest(@PathVariable UUID tripId) {
        return service.suggest(tripId, CurrentUser.id());
    }

    @DeleteMapping("/api/v1/checklists/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id, CurrentUser.id());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/v1/checklists/{id}/items")
    public ResponseEntity<ChecklistItemDto> addItem(@PathVariable UUID id,
                                                    @Valid @RequestBody ChecklistService.CreateItem req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.addItem(id, CurrentUser.id(), req));
    }

    @PutMapping("/api/v1/checklist-items/{id}")
    public ChecklistItemDto updateItem(@PathVariable UUID id, @Valid @RequestBody ChecklistService.UpdateItem req) {
        return service.updateItem(id, CurrentUser.id(), req);
    }

    @DeleteMapping("/api/v1/checklist-items/{id}")
    public ResponseEntity<Void> deleteItem(@PathVariable UUID id) {
        service.deleteItem(id, CurrentUser.id());
        return ResponseEntity.noContent().build();
    }
}
