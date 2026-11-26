package com.travelmate.budget;

import com.travelmate.budget.BudgetDtos.BudgetDto;
import com.travelmate.budget.BudgetDtos.BudgetUpdate;
import com.travelmate.budget.BudgetDtos.CategoryLine;
import com.travelmate.common.ApiException;
import com.travelmate.common.Money;
import com.travelmate.itinerary.ItineraryItem;
import com.travelmate.itinerary.ItineraryItemRepository;
import com.travelmate.trips.Trip;
import com.travelmate.trips.TripAccessService;
import com.travelmate.trips.TripAccessService.TripPermission;
import com.travelmate.trips.TripRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class BudgetService {

    private final TripAccessService access;
    private final TripRepository trips;
    private final TripBudgetCategoryRepository categoryBudgets;
    private final ExpenseRepository expenses;
    private final ItineraryItemRepository items;

    public BudgetService(TripAccessService access, TripRepository trips, TripBudgetCategoryRepository categoryBudgets,
                         ExpenseRepository expenses, ItineraryItemRepository items) {
        this.access = access;
        this.trips = trips;
        this.categoryBudgets = categoryBudgets;
        this.expenses = expenses;
        this.items = items;
    }

    /** Maps an itinerary item category to the budget category it is estimated under. */
    public static String budgetCategoryOf(String itemCategory) {
        return switch (itemCategory) {
            case "HOTEL" -> "ACCOMMODATION";
            case "RESTAURANT" -> "FOOD";
            case "TRANSPORTATION" -> "TRANSPORTATION";
            case "SHOPPING" -> "SHOPPING";
            case "ATTRACTION", "ACTIVITY", "EVENT" -> "ACTIVITIES";
            default -> "OTHER";
        };
    }

    @Transactional(readOnly = true)
    public BudgetDto get(UUID tripId, UUID userId) {
        Trip trip = access.require(tripId, userId, TripPermission.VIEW).trip();
        return compute(trip, categoryBudgets.findByTrip(tripId), expenses.findActiveByTrip(tripId),
                items.findActiveByTrip(tripId));
    }

    @Transactional
    public BudgetDto update(UUID tripId, UUID userId, BudgetUpdate req) {
        Trip trip = access.require(tripId, userId, TripPermission.EDIT).trip();
        trip.setBudgetAmount(Money.parse(req.totalBudget(), "totalBudget"));
        trip.touch();
        categoryBudgets.deleteByTrip(tripId);
        categoryBudgets.flush();
        if (req.categoryBudgets() != null) {
            for (var e : req.categoryBudgets().entrySet()) {
                String cat = e.getKey() == null ? "" : e.getKey().trim().toUpperCase();
                if (!TripBudgetCategory.CATEGORIES.contains(cat)) {
                    throw ApiException.badRequest("categoryBudgets", "Unknown budget category " + e.getKey());
                }
                BigDecimal amount = Money.parse(e.getValue(), "categoryBudgets." + cat);
                if (amount != null) categoryBudgets.save(new TripBudgetCategory(tripId, cat, amount));
            }
        }
        trips.flush();
        return compute(trip, categoryBudgets.findByTrip(tripId), expenses.findActiveByTrip(tripId),
                items.findActiveByTrip(tripId));
    }

    /** Pure computation, public for tests. All arithmetic is BigDecimal with scale 2. */
    public static BudgetDto compute(Trip trip, List<TripBudgetCategory> catBudgets, List<Expense> tripExpenses,
                                    List<ItineraryItem> tripItems) {
        String currency = trip.getCurrency();
        List<String> notes = new ArrayList<>();
        Map<String, BigDecimal> budgetByCat = new HashMap<>();
        catBudgets.forEach(b -> budgetByCat.put(b.getId().getCategory(), Money.of(b.getAmount())));

        Map<String, BigDecimal> spentByCat = new HashMap<>();
        BigDecimal spent = Money.zero();
        int otherCurrency = 0;
        for (Expense e : tripExpenses) {
            if (!currency.equals(e.getCurrency())) { otherCurrency++; continue; }
            spent = spent.add(Money.of(e.getAmount()));
            spentByCat.merge(e.getCategory(), Money.of(e.getAmount()), BigDecimal::add);
        }
        if (otherCurrency > 0) {
            notes.add(otherCurrency + " expense(s) in other currencies are not included in totals; "
                    + "TravelMate does not convert currencies.");
        }

        Map<String, BigDecimal> estByCat = new HashMap<>();
        BigDecimal estimated = Money.zero();
        for (ItineraryItem i : tripItems) {
            if (!i.countsTowardCost() || i.getEstimatedCost() == null || !currency.equals(i.getCurrency())) continue;
            estimated = estimated.add(Money.of(i.getEstimatedCost()));
            estByCat.merge(budgetCategoryOf(i.getCategory()), Money.of(i.getEstimatedCost()), BigDecimal::add);
        }
        notes.add("Itinerary costs are estimates, not confirmed prices.");

        List<CategoryLine> lines = new ArrayList<>();
        for (String cat : TripBudgetCategory.CATEGORIES) {
            lines.add(new CategoryLine(cat, budgetByCat.get(cat), estByCat.getOrDefault(cat, Money.zero()),
                    spentByCat.getOrDefault(cat, Money.zero())));
        }
        BigDecimal total = Money.of(trip.getBudgetAmount());
        BigDecimal perPerson = total == null ? null
                : total.divide(BigDecimal.valueOf(Math.max(1, trip.getTravelers())), 2, RoundingMode.HALF_UP);
        BigDecimal remaining = total == null ? null : total.subtract(spent);
        return new BudgetDto(currency, total, perPerson, trip.getTravelers(), estimated, spent, remaining, lines, notes);
    }
}
