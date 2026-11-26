package com.travelmate.search;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/search")
@Tag(name = "Search")
public class SearchController {

    private final SearchService service;

    public SearchController(SearchService service) {
        this.service = service;
    }

    @GetMapping
    public SearchService.SearchResults search(@RequestParam(required = false) String q,
                                              @RequestParam(required = false) String types) {
        return service.search(q, types);
    }

    @GetMapping("/suggest")
    public List<SearchService.Suggestion> suggest(@RequestParam(required = false) String q) {
        return service.suggest(q);
    }

    @GetMapping("/popular")
    public List<String> popular() {
        return service.popular();
    }
}
