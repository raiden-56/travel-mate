"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSaveExpense } from "@/features/budget/hooks";
import { errorMessage } from "@/lib/api-client";
import { toIsoDate } from "@/lib/dates";
import { newClientId, titleCase } from "@/lib/utils";
import { BUDGET_CATEGORIES, type ExpenseDto } from "@/types/api";

const schema = z.object({
  title: z.string().trim().min(1, "What was it for?").max(160),
  amount: z.string().trim().regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter an amount like 450 or 450.50").refine((v) => Number(v) > 0, "Amount must be more than zero"),
  currency: z.string().length(3),
  category: z.enum(BUDGET_CATEGORIES),
  date: z.string().min(1, "Pick a date"),
  paymentMethod: z.string().max(40).optional(),
  notes: z.string().max(1000).optional(),
});
type Values = z.infer<typeof schema>;

export function ExpenseDialog({
  tripId,
  currency,
  open,
  onOpenChange,
  expense,
}: {
  tripId: string;
  currency: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  expense: ExpenseDto | null;
}) {
  const save = useSaveExpense(tripId);
  // One idempotency key per dialog session, so a double-submit or retry can't create duplicates.
  const requestId = React.useRef(newClientId());
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const { errors } = form.formState;

  React.useEffect(() => {
    if (!open) return;
    requestId.current = newClientId();
    form.reset({
      title: expense?.title ?? "",
      amount: expense?.amount ?? "",
      currency: expense?.currency ?? currency,
      category: expense?.category ?? "FOOD",
      date: expense?.date ?? toIsoDate(new Date()),
      paymentMethod: expense?.paymentMethod ?? "",
      notes: expense?.notes ?? "",
    });
  }, [open, expense, currency, form]);

  const submit = form.handleSubmit((v) =>
    save.mutate(
      {
        id: expense?.id,
        ...v,
        paymentMethod: v.paymentMethod || null,
        notes: v.notes || null,
        clientRequestId: expense ? undefined : requestId.current,
        version: expense?.version,
      },
      {
        onSuccess: () => {
          toast.success(expense ? "Expense updated" : "Expense added");
          onOpenChange(false);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    ),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={expense ? "Edit expense" : "Add expense"} variant="sheet">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Title" htmlFor="title" error={errors.title?.message}>
            <Input id="title" placeholder="Dinner at the beach shack" {...form.register("title")} />
          </Field>
          <div className="grid grid-cols-[1fr_96px] gap-3">
            <Field label="Amount" htmlFor="amount" error={errors.amount?.message}>
              <Input id="amount" inputMode="decimal" {...form.register("amount")} />
            </Field>
            <Field label="Currency" htmlFor="currency">
              <Select id="currency" {...form.register("currency")}>
                {Array.from(new Set([currency, "INR", "USD", "EUR"])).map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" htmlFor="category">
              <Select id="category" {...form.register("category")}>
                {BUDGET_CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
              </Select>
            </Field>
            <Field label="Date" htmlFor="date" error={errors.date?.message}>
              <Input id="date" type="date" {...form.register("date")} />
            </Field>
          </div>
          <Field label="Paid with" htmlFor="paymentMethod" optional>
            <Input id="paymentMethod" placeholder="UPI, cash, card…" {...form.register("paymentMethod")} />
          </Field>
          <Field label="Notes" htmlFor="notes" optional>
            <Textarea id="notes" rows={2} {...form.register("notes")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>{expense ? "Save" : "Add expense"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
