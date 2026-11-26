package com.travelmate.budget;

import com.travelmate.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "expenses")
public class Expense extends BaseEntity {

    @Column(name = "trip_id", nullable = false) private UUID tripId;
    @Column(nullable = false, length = 160) private String title;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal amount;
    @Column(nullable = false, length = 3) private String currency;
    @Column(nullable = false, length = 20) private String category;
    @Column(name = "paid_by_user_id", nullable = false) private UUID paidByUserId;
    @Column(name = "expense_date", nullable = false) private LocalDate date;
    @Column(length = 1000) private String notes;
    @Column(name = "payment_method", length = 40) private String paymentMethod;
    @Column(name = "client_request_id", length = 64) private String clientRequestId;
    @Column(name = "deleted_at") private Instant deletedAt;
    @Version private long version;

    public UUID getTripId() { return tripId; }
    public void setTripId(UUID tripId) { this.tripId = tripId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public UUID getPaidByUserId() { return paidByUserId; }
    public void setPaidByUserId(UUID paidByUserId) { this.paidByUserId = paidByUserId; }
    public LocalDate getDate() { return date; }
    public void setDate(LocalDate date) { this.date = date; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
    public String getClientRequestId() { return clientRequestId; }
    public void setClientRequestId(String clientRequestId) { this.clientRequestId = clientRequestId; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
    public long getVersion() { return version; }
}
