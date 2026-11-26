package com.travelmate.budget;

import com.travelmate.itinerary.ItineraryItem;
import com.travelmate.trips.Trip;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class BudgetPrecisionTest {

    private static Expense expense(String amount, String currency, String category) {
        Expense e = new Expense();
        e.setTripId(UUID.randomUUID());
        e.setAmount(new BigDecimal(amount));
        e.setCurrency(currency);
        e.setCategory(category);
        e.setDate(LocalDate.of(2027, 1, 1));
        e.setPaidByUserId(UUID.randomUUID());
        return e;
    }

    private static Trip trip(String budget, int travelers) {
        Trip t = new Trip();
        t.setBudgetAmount(budget == null ? null : new BigDecimal(budget));
        t.setTravelers(travelers);
        t.setCurrency("INR");
        return t;
    }

    @Test
    void sumsWithoutFloatingPointDrift() {
        // 0.1 + 0.2 in binary floating point is 0.30000000000000004; decimals must stay exact.
        List<Expense> list = new ArrayList<>();
        for (int i = 0; i < 1000; i++) list.add(expense(i % 2 == 0 ? "0.10" : "0.20", "INR", "FOOD"));
        var dto = BudgetService.compute(trip("1000.00", 1), List.of(), list, List.of());
        assertThat(dto.spent()).isEqualByComparingTo("150.00");
        assertThat(dto.spent().scale()).isEqualTo(2);
        assertThat(dto.remaining()).isEqualByComparingTo("850.00");
    }

    @Test
    void perPersonBudgetRoundsHalfUpToTwoPlaces() {
        var dto = BudgetService.compute(trip("100.00", 3), List.of(), List.of(), List.of());
        assertThat(dto.perPersonBudget()).isEqualTo(new BigDecimal("33.33"));
        var dto2 = BudgetService.compute(trip("20000.00", 3), List.of(), List.of(), List.of());
        assertThat(dto2.perPersonBudget()).isEqualTo(new BigDecimal("6666.67"));
    }

    @Test
    void otherCurrencyExpensesAreExcludedWithANote() {
        var dto = BudgetService.compute(trip("5000.00", 2), List.of(),
                List.of(expense("1000.00", "INR", "FOOD"), expense("50.00", "USD", "FOOD")), List.of());
        assertThat(dto.spent()).isEqualByComparingTo("1000.00");
        assertThat(dto.notes()).anyMatch(n -> n.contains("other currencies"));
    }

    @Test
    void itineraryEstimatesMapToBudgetCategories() {
        ItineraryItem hotel = new ItineraryItem();
        hotel.setCategory("HOTEL");
        hotel.setCurrency("INR");
        hotel.setEstimatedCost(new BigDecimal("3500.00"));
        ItineraryItem lunch = new ItineraryItem();
        lunch.setCategory("RESTAURANT");
        lunch.setCurrency("INR");
        lunch.setEstimatedCost(new BigDecimal("1200.50"));
        var dto = BudgetService.compute(trip(null, 2), List.of(new TripBudgetCategory(UUID.randomUUID(), "FOOD",
                new BigDecimal("2000"))), List.of(), List.of(hotel, lunch));
        assertThat(dto.estimatedItineraryCost()).isEqualByComparingTo("4700.50");
        assertThat(dto.remaining()).isNull();
        var food = dto.byCategory().stream().filter(l -> l.category().equals("FOOD")).findFirst().orElseThrow();
        assertThat(food.estimated()).isEqualByComparingTo("1200.50");
        assertThat(food.budget()).isEqualByComparingTo("2000.00");
        var stay = dto.byCategory().stream().filter(l -> l.category().equals("ACCOMMODATION")).findFirst().orElseThrow();
        assertThat(stay.estimated()).isEqualByComparingTo("3500.00");
    }
}
