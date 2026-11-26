package com.travelmate.destinations;

import com.travelmate.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "destination_categories")
public class DestinationCategory extends BaseEntity {

    @Column(nullable = false, length = 60)
    private String slug;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    public String getSlug() { return slug; }
    public String getName() { return name; }
    public int getSortOrder() { return sortOrder; }
}
