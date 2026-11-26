"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useBudget, useDeleteExpense, useExpenses } from "@/features/budget/hooks";
import { BudgetDialog } from "@/components/budget/budget-dialog";
import { ExpenseDialog } from "@/components/budget/expense-dialog";
import { EmptyState, ErrorState } from "@/components/common/states";
import { EstimateBadge } from "@/components/common/labels";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, Progress, Skeleton } from "@/components/ui/misc";
import { errorMessage } from "@/lib/api-client";
import { formatDate } from "@/lib/dates";
import { formatMoney, percentOf, toMinor } from "@/lib/money";
import { titleCase } from "@/lib/utils";
import type { ExpenseDto } from "@/types/api";

function Stat({ label, value, sub }: { label: React.ReactNode; value: string; sub?: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-xs text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold tabular-nums">{value}</p>
      {sub && <div className="mt-1 text-xs text-ink-muted">{sub}</div>}
    </Card>
  );
}

export default function BudgetPage() {
  const { id } = useParams<{ id: string }>();
  const budget = useBudget(id);
  const expenses = useExpenses(id);
  const del = useDeleteExpense(id);
  const [budgetOpen, setBudgetOpen] = React.useState(false);
  const [expenseDialog, setExpenseDialog] = React.useState<{ open: boolean; expense: ExpenseDto | null }>({ open: false, expense: null });
  const [toDelete, setToDelete] = React.useState<ExpenseDto | null>(null);

  if (budget.isLoading) return <div className="grid gap-4 sm:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  if (budget.isError || !budget.data) return <ErrorState error={budget.error} onRetry={() => budget.refetch()} />;

  const b = budget.data;
  const cur = b.currency;
  const spentPct = percentOf(b.spent, b.totalBudget);
  const otherCurrency = (expenses.data ?? []).filter((e) => e.currency !== cur);
  const maxBar = b.byCategory.reduce((m, c) => {
    const v = [c.budget, c.estimated, c.spent].map((x) => toMinor(x)).reduce((a, x) => (x > a ? x : a), 0n);
    return v > m ? v : m;
  }, 0n);
  const width = (v: string | null) => (maxBar > 0n && v ? Number((toMinor(v) * 1000n) / maxBar) / 10 : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold">Budget & expenses</h2>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setBudgetOpen(true)}><Pencil /> {b.totalBudget ? "Edit budget" : "Set budget"}</Button>
          <Button size="sm" onClick={() => setExpenseDialog({ open: true, expense: null })}><Plus /> Add expense</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Budget" value={b.totalBudget ? formatMoney(b.totalBudget, cur, { noDecimals: true }) : "Not set"} sub={b.perPersonBudget ? `${formatMoney(b.perPersonBudget, cur, { noDecimals: true })} per person` : undefined} />
        <Stat label={<>Planned <EstimateBadge /></>} value={formatMoney(b.estimatedItineraryCost, cur, { noDecimals: true })} sub="From itinerary activities" />
        <Stat label="Spent" value={formatMoney(b.spent, cur)} sub={b.totalBudget ? <Progress value={spentPct} tone={spentPct > 100 ? "danger" : spentPct > 85 ? "amber" : "sage"} label="Budget used" /> : undefined} />
        <Stat
          label="Remaining"
          value={b.remaining != null ? formatMoney(b.remaining, cur) : "—"}
          sub={b.remaining != null && b.remaining.startsWith("-") ? <span className="text-danger">Over budget</span> : undefined}
        />
      </div>

      <Card className="p-5">
        <h3 className="font-display text-base font-semibold">By category</h3>
        <div className="mt-1 flex flex-wrap gap-4 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-line" /> Budget</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-amber" /> Planned (est.)</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-sage" /> Spent</span>
        </div>
        <ul className="mt-4 space-y-4">
          {b.byCategory
            .filter((c) => c.budget || c.estimated !== "0.00" || c.spent !== "0.00")
            .map((c) => (
              <li key={c.category} className="grid grid-cols-[110px_1fr] items-center gap-3 sm:grid-cols-[140px_1fr_120px]">
                <span className="text-sm">{titleCase(c.category)}</span>
                <div className="space-y-1" aria-hidden>
                  {c.budget && <div className="h-1.5 rounded-full bg-line" style={{ width: `${width(c.budget)}%` }} />}
                  <div className="h-1.5 rounded-full bg-amber" style={{ width: `${width(c.estimated)}%` }} />
                  <div className="h-1.5 rounded-full bg-sage" style={{ width: `${width(c.spent)}%` }} />
                </div>
                <span className="col-span-2 text-right text-xs tabular-nums text-ink-muted sm:col-span-1">
                  {formatMoney(c.spent, cur, { noDecimals: true })}
                  {c.budget && <> / {formatMoney(c.budget, cur, { noDecimals: true })}</>}
                </span>
              </li>
            ))}
        </ul>
        {b.byCategory.every((c) => !c.budget && c.estimated === "0.00" && c.spent === "0.00") && (
          <p className="mt-4 text-sm text-ink-muted">Add expenses or plan activities with costs to see a breakdown.</p>
        )}
      </Card>

      <section>
        <h3 className="mb-3 font-display text-base font-semibold">Expenses</h3>
        {b.notes.length > 0 ? (
          <ul className="mb-3 space-y-1 rounded-md bg-amber-soft px-3 py-2 text-[13px]">
            {b.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        ) : otherCurrency.length > 0 ? (
          <p className="mb-3 rounded-md bg-amber-soft px-3 py-2 text-[13px]">
            {otherCurrency.length} expense{otherCurrency.length === 1 ? " is" : "s are"} in another currency and not included in the totals above.
          </p>
        ) : null}
        {expenses.isLoading ? (
          <Skeleton className="h-40" />
        ) : expenses.isError ? (
          <ErrorState error={expenses.error} onRetry={() => expenses.refetch()} />
        ) : expenses.data?.length === 0 ? (
          <EmptyState icon={<Receipt />} title="No expenses yet" description="Log spending as you go to see where the money went." action={<Button size="sm" onClick={() => setExpenseDialog({ open: true, expense: null })}><Plus /> Add expense</Button>} />
        ) : (
          <ul className="divide-y divide-line rounded-lg bg-surface shadow-[var(--shadow-soft)]">
            {expenses.data?.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.title}</p>
                  <p className="text-xs text-ink-muted">
                    {titleCase(e.category)} · {formatDate(e.date)} · paid by {e.paidByName}
                    {e.paymentMethod && <> · {e.paymentMethod}</>}
                  </p>
                </div>
                <span className="font-medium tabular-nums">{formatMoney(e.amount, e.currency)}</span>
                <button onClick={() => setExpenseDialog({ open: true, expense: e })} className="rounded p-1.5 text-ink-muted hover:bg-surface-muted hover:text-ink" aria-label={`Edit ${e.title}`}><Pencil className="size-4" /></button>
                <button onClick={() => setToDelete(e)} className="rounded p-1.5 text-ink-muted hover:bg-surface-muted hover:text-danger" aria-label={`Delete ${e.title}`}><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <BudgetDialog tripId={id} budget={b} open={budgetOpen} onOpenChange={setBudgetOpen} />
      <ExpenseDialog tripId={id} currency={cur} open={expenseDialog.open} expense={expenseDialog.expense} onOpenChange={(open) => setExpenseDialog((s) => ({ ...s, open }))} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this expense?"
        description={`“${toDelete?.title}” (${toDelete ? formatMoney(toDelete.amount, toDelete.currency) : ""}) will be removed from this trip.`}
        confirmLabel="Delete"
        destructive
        loading={del.isPending}
        onConfirm={() => toDelete && del.mutate(toDelete.id, { onSuccess: () => { toast.success("Expense deleted"); setToDelete(null); }, onError: (e) => toast.error(errorMessage(e)) })}
      />
    </div>
  );
}
