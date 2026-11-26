package com.travelmate.budget;

import com.travelmate.budget.BudgetDtos.ExpenseDto;
import com.travelmate.budget.BudgetDtos.ExpenseRequest;
import com.travelmate.common.ApiException;
import com.travelmate.common.Money;
import com.travelmate.trips.TripAccessService;
import com.travelmate.trips.TripAccessService.TripPermission;
import com.travelmate.users.User;
import com.travelmate.users.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class ExpenseService {

    public record CreateResult(ExpenseDto expense, boolean created) {}

    private final ExpenseRepository expenses;
    private final TripAccessService access;
    private final UserRepository users;

    public ExpenseService(ExpenseRepository expenses, TripAccessService access, UserRepository users) {
        this.expenses = expenses;
        this.access = access;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public List<ExpenseDto> list(UUID tripId, UUID userId) {
        access.require(tripId, userId, TripPermission.VIEW);
        Map<UUID, String> names = new HashMap<>();
        return expenses.findActiveByTrip(tripId).stream().map(e -> toDto(e, names)).toList();
    }

    @Transactional
    public CreateResult create(UUID tripId, UUID userId, ExpenseRequest req) {
        var trip = access.require(tripId, userId, TripPermission.ADD_EXPENSE).trip();
        if (req.clientRequestId() != null && !req.clientRequestId().isBlank()) {
            Optional<Expense> existing = expenses.findByTripIdAndClientRequestId(tripId, req.clientRequestId().trim());
            if (existing.isPresent()) return new CreateResult(toDto(existing.get(), new HashMap<>()), false);
        }
        Expense e = new Expense();
        e.setTripId(tripId);
        e.setPaidByUserId(userId);
        e.setClientRequestId(req.clientRequestId() == null || req.clientRequestId().isBlank() ? null : req.clientRequestId().trim());
        apply(e, req, trip.getCurrency());
        expenses.save(e);
        return new CreateResult(toDto(e, new HashMap<>()), true);
    }

    @Transactional
    public ExpenseDto update(UUID expenseId, UUID userId, ExpenseRequest req) {
        Expense e = expenses.findActive(expenseId).orElseThrow(() -> ApiException.notFound("Expense"));
        var trip = access.require(e.getTripId(), userId, TripPermission.ADD_EXPENSE).trip();
        requireEditable(e, userId);
        if (req.version() != null && req.version() != e.getVersion()) {
            throw ApiException.conflict("This expense was changed elsewhere. Reload to see the latest version.");
        }
        apply(e, req, trip.getCurrency());
        e.touch();
        expenses.flush();
        return toDto(e, new HashMap<>());
    }

    @Transactional
    public void delete(UUID expenseId, UUID userId) {
        Expense e = expenses.findActive(expenseId).orElseThrow(() -> ApiException.notFound("Expense"));
        access.require(e.getTripId(), userId, TripPermission.ADD_EXPENSE);
        requireEditable(e, userId);
        e.setDeletedAt(Instant.now());
    }

    /** The payer can edit their expense; trip managers can edit any expense. */
    private void requireEditable(Expense e, UUID userId) {
        if (e.getPaidByUserId().equals(userId)) return;
        access.require(e.getTripId(), userId, TripPermission.MANAGE);
    }

    private static void apply(Expense e, ExpenseRequest req, String tripCurrency) {
        e.setTitle(req.title().trim());
        var amount = Money.parse(req.amount(), "amount");
        if (amount == null || amount.signum() <= 0) throw ApiException.badRequest("amount", "Must be greater than zero");
        e.setAmount(amount);
        e.setCurrency(req.currency() == null || req.currency().isBlank() ? tripCurrency : Money.currency(req.currency()));
        String cat = req.category().trim().toUpperCase();
        if (!TripBudgetCategory.CATEGORIES.contains(cat)) throw ApiException.badRequest("category", "Unknown category");
        e.setCategory(cat);
        e.setDate(req.date());
        e.setNotes(req.notes() == null || req.notes().isBlank() ? null : req.notes().trim());
        e.setPaymentMethod(req.paymentMethod() == null || req.paymentMethod().isBlank() ? null : req.paymentMethod().trim());
    }

    private ExpenseDto toDto(Expense e, Map<UUID, String> names) {
        String name = names.computeIfAbsent(e.getPaidByUserId(),
                id -> users.findById(id).map(User::getDisplayName).orElse("Unknown"));
        return new ExpenseDto(e.getId(), e.getTripId(), e.getTitle(), e.getAmount(), e.getCurrency(), e.getCategory(),
                e.getPaidByUserId(), name, e.getDate(), e.getNotes(), e.getPaymentMethod(), e.getClientRequestId(),
                e.getCreatedAt(), e.getUpdatedAt(), e.getVersion());
    }
}
