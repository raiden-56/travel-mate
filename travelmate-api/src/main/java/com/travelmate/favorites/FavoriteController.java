package com.travelmate.favorites;

import com.travelmate.auth.CurrentUser;
import com.travelmate.favorites.FavoriteService.FavoriteDto;
import com.travelmate.favorites.FavoriteService.FavoriteRequest;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/favorites")
@Tag(name = "Favorites")
public class FavoriteController {

    private final FavoriteService service;

    public FavoriteController(FavoriteService service) {
        this.service = service;
    }

    @GetMapping
    public List<FavoriteDto> list() {
        return service.list(CurrentUser.id());
    }

    @PostMapping
    public ResponseEntity<FavoriteDto> save(@RequestBody FavoriteRequest req) {
        var result = service.save(CurrentUser.id(), req);
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(result.favorite());
    }

    @DeleteMapping("/{targetType}/{targetId}")
    public ResponseEntity<Void> remove(@PathVariable String targetType, @PathVariable UUID targetId) {
        service.remove(CurrentUser.id(), targetType, targetId);
        return ResponseEntity.noContent().build();
    }
}
