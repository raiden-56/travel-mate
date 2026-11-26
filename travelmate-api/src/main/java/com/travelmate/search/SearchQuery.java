package com.travelmate.search;

import com.travelmate.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/** Anonymous record of a search term, used only to compute popular searches. */
@Entity
@Table(name = "search_queries")
public class SearchQuery extends BaseEntity {

    @Column(nullable = false, length = 100)
    private String query;

    protected SearchQuery() {}

    public SearchQuery(String query) {
        this.query = query;
    }

    public String getQuery() { return query; }
}
