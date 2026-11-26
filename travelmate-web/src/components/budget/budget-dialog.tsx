"use client";

import * as React from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUpdateBudget } from "@/features/budget/hooks";
import { errorMessage } from "@/lib/api-client";
import { isMoney } from "@/lib/money";
import { titleCase } from "@/lib/utils";
import { BUDGET_CATEGORIES, type BudgetCategory, type BudgetDto } from "@/types/api";

export function BudgetDialog({ tripId, budget, open, onOpenChange }: { tripId: string; budget: BudgetDto; open: boolean; onOpenChange: (o: boolean) => void }) {
  const update = useUpdateBudget(tripId);
  const [total, setTotal] = React.useState("");
  const [cats, setCats] = React.useState<Partial<Record<BudgetCategory, string>>>({});
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setTotal(budget.totalBudget ?? "");
    setCats(Object.fromEntries(budget.byCategory.filter((c) => c.budget).map((c) => [c.category, c.budget!])));
    setError(null);
  }, [open, budget]);

  const save = () => {
    const values = [total, ...Object.values(cats)].filter((v): v is string => !!v);
    if (values.some((v) => !isMoney(v) || v.startsWith("-"))) {
      setError("Use plain amounts like 20000 or 1500.50");
      return;
    }
    const categoryBudgets = Object.fromEntries(Object.entries(cats).filter(([, v]) => v)) as Partial<Record<BudgetCategory, string>>;
    update.mutate(
      { totalBudget: total || null, categoryBudgets },
      { onSuccess: () => { toast.success("Budget saved"); onOpenChange(false); }, onError: (e) => toast.error(errorMessage(e)) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Set budget" description={`Amounts in ${budget.currency}. Category budgets are optional.`} variant="sheet">
        <div className="space-y-4">
          <Field label="Total trip budget" htmlFor="total" hint={`For all ${budget.travelers} traveler${budget.travelers === 1 ? "" : "s"}`}>
            <Input id="total" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="20000" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {BUDGET_CATEGORIES.map((c) => (
              <Field key={c} label={titleCase(c)} htmlFor={`cat-${c}`} optional>
                <Input id={`cat-${c}`} inputMode="decimal" value={cats[c] ?? ""} onChange={(e) => setCats((s) => ({ ...s, [c]: e.target.value }))} />
              </Field>
            ))}
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button loading={update.isPending} onClick={save}>Save budget</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
