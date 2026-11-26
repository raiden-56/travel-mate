package com.travelmate.checklist;

import com.travelmate.common.BaseEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "checklists")
public class Checklist extends BaseEntity {

    @Column(name = "trip_id", nullable = false) private UUID tripId;
    @Column(nullable = false, length = 120) private String name;
    @Column(name = "template_key", length = 40) private String templateKey;

    @OneToMany(mappedBy = "checklist", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC, createdAt ASC")
    private List<ChecklistItem> items = new ArrayList<>();

    protected Checklist() {}

    public Checklist(UUID tripId, String name, String templateKey) {
        this.tripId = tripId;
        this.name = name;
        this.templateKey = templateKey;
    }

    public ChecklistItem addItem(String label, String category, boolean suggested, String reason) {
        ChecklistItem item = new ChecklistItem(this, label, category, items.size(), suggested, reason);
        items.add(item);
        return item;
    }

    public UUID getTripId() { return tripId; }
    public String getName() { return name; }
    public String getTemplateKey() { return templateKey; }
    public List<ChecklistItem> getItems() { return items; }
}
