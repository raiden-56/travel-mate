package com.travelmate.destinations;

import com.travelmate.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "destination_images")
public class DestinationImage extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "destination_id")
    private Destination destination;

    @Column(nullable = false, length = 1000)
    private String url;

    @Column(length = 300)
    private String credit;

    @Column(nullable = false, length = 300)
    private String alt;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    protected DestinationImage() {}

    public DestinationImage(Destination destination, String url, String credit, String alt, int sortOrder) {
        this.destination = destination;
        this.url = url;
        this.credit = credit;
        this.alt = alt;
        this.sortOrder = sortOrder;
    }

    public String getUrl() { return url; }
    public String getCredit() { return credit; }
    public String getAlt() { return alt; }
    public int getSortOrder() { return sortOrder; }
}
