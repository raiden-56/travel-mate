package com.travelmate.budget;

import com.travelmate.auth.CurrentUser;
import com.travelmate.budget.BudgetDtos.BudgetDto;
import com.travelmate.budget.BudgetDtos.BudgetUpdate;
import com.travelmate.budget.BudgetDtos.ExpenseDto;
import com.travelmate.budget.BudgetDtos.ExpenseRequest;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@Tag(name = "Budget & expenses")
public class BudgetController {

    private final BudgetService budgets;
    private final ExpenseService expenses;

    public BudgetController(BudgetService budgets, ExpenseService expenses) {
        this.budgets = budgets;
        this.expenses = expenses;
    }

    @GetMapping("/api/v1/trips/{tripId}/budget")
    public BudgetDto budget(@PathVariable UUID tripId) {
        return budgets.get(tripId, CurrentUser.id());
    }

    @PutMapping("/api/v1/trips/{tripId}/budget")
    public BudgetDto updateBudget(@PathVariable UUID tripId, @RequestBody BudgetUpdate req) {
        return budgets.update(tripId, CurrentUser.id(), req);
    }

    @GetMapping("/api/v1/trips/{tripId}/expenses")
    public List<ExpenseDto> list(@PathVariable UUID tripId) {
        return expenses.list(tripId, CurrentUser.id());
    }

    @PostMapping("/api/v1/trips/{tripId}/expenses")
    public ResponseEntity<ExpenseDto> create(@PathVariable UUID tripId, @Valid @RequestBody ExpenseRequest req) {
        var result = expenses.create(tripId, CurrentUser.id(), req);
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(result.expense());
    }

    @PutMapping("/api/v1/expenses/{id}")
    public ExpenseDto update(@PathVariable UUID id, @Valid @RequestBody ExpenseRequest req) {
        return expenses.update(id, CurrentUser.id(), req);
    }

    @DeleteMapping("/api/v1/expenses/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        expenses.delete(id, CurrentUser.id());
        return ResponseEntity.noContent().build();
    }
}
