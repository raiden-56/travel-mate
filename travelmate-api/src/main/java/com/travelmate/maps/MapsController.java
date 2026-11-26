package com.travelmate.maps;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/maps")
@Tag(name = "Maps")
public class MapsController {

    private final RouteService routes;

    public MapsController(RouteService routes) {
        this.routes = routes;
    }

    @PostMapping("/route")
    public MapDtos.RouteResult route(@Valid @RequestBody MapDtos.RouteRequest req) {
        return routes.route(req.points());
    }

    @PostMapping("/optimize")
    public MapDtos.OptimizeResult optimize(@Valid @RequestBody MapDtos.OptimizeRequest req) {
        return routes.optimize(req.points(), req.keepFirst() == null || req.keepFirst(),
                req.keepLast() != null && req.keepLast());
    }
}
