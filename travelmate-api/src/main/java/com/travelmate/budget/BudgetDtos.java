package com.travelmate.budget;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class BudgetDtos {

    private BudgetDtos() {}

    public record CategoryLine(String category, BigDecimal budget, BigDecimal estimated, BigDecimal spent) {}

    public record BudgetDto(String currency, BigDecimal totalBudget, BigDecimal perPersonBudget, int travelers,
                            BigDecimal estimatedItineraryCost, BigDecimal spent, BigDecimal remaining,
                            List<CategoryLine> byCategory, List<String> notes) {}

    public record BudgetUpdate(String totalBudget, Map<String, String> categoryBudgets) {}

    public record ExpenseDto(UUID id, UUID tripId, String title, BigDecimal amount, String currency, String category,
                             UUID paidByUserId, String paidByName, LocalDate date, String notes,
                             String paymentMethod, String clientRequestId, Instant createdAt, Instant updatedAt,
                             long version) {}

    public record ExpenseRequest(
            @NotBlank @Size(max = 160) String title,
            @NotBlank String amount,
            @Size(max = 3) String currency,
            @NotBlank String category,
            @NotNull LocalDate date,
            @Size(max = 1000) String notes,
            @Size(max = 40) String paymentMethod,
            @Size(max = 64) String clientRequestId,
            Long version) {}
}
