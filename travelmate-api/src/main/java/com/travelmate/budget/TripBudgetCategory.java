package com.travelmate.budget;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "trip_budget_categories")
public class TripBudgetCategory {

    public static final java.util.List<String> CATEGORIES = java.util.List.of("TRANSPORTATION", "ACCOMMODATION",
            "FOOD", "ACTIVITIES", "SHOPPING", "FUEL", "TICKETS", "RENTALS", "OTHER");

    @Embeddable
    public static class Key implements Serializable {
        @Column(name = "trip_id") private UUID tripId;
        @Column(name = "category", length = 20) private String category;

        protected Key() {}

        public Key(UUID tripId, String category) {
            this.tripId = tripId;
            this.category = category;
        }

        public UUID getTripId() { return tripId; }
        public String getCategory() { return category; }

        @Override
        public boolean equals(Object o) {
            return o instanceof Key k && Objects.equals(tripId, k.tripId) && Objects.equals(category, k.category);
        }

        @Override
        public int hashCode() {
            return Objects.hash(tripId, category);
        }
    }

    @EmbeddedId
    private Key id;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    protected TripBudgetCategory() {}

    public TripBudgetCategory(UUID tripId, String category, BigDecimal amount) {
        this.id = new Key(tripId, category);
        this.amount = amount;
    }

    public Key getId() { return id; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
}
