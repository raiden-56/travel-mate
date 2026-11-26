package com.travelmate.checklist;

import com.travelmate.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "checklist_items")
public class ChecklistItem extends BaseEntity {

    public static final java.util.Set<String> CATEGORIES = java.util.Set.of("CLOTHING", "DOCUMENTS", "ELECTRONICS",
            "MEDICINES", "TOILETRIES", "FOOD", "SAFETY", "ADVENTURE", "ESSENTIALS", "OTHER");

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "checklist_id")
    private Checklist checklist;

    @Column(nullable = false, length = 200) private String label;
    @Column(nullable = false, length = 20) private String category;
    @Column(nullable = false) private boolean completed;
    @Column(nullable = false) private int position;
    @Column(nullable = false) private boolean suggested;
    @Column(length = 300) private String reason;

    protected ChecklistItem() {}

    ChecklistItem(Checklist checklist, String label, String category, int position, boolean suggested, String reason) {
        this.checklist = checklist;
        this.label = label;
        this.category = category;
        this.position = position;
        this.suggested = suggested;
        this.reason = reason;
    }

    public Checklist getChecklist() { return checklist; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public boolean isCompleted() { return completed; }
    public void setCompleted(boolean completed) { this.completed = completed; }
    public int getPosition() { return position; }
    public boolean isSuggested() { return suggested; }
    public String getReason() { return reason; }
}
