"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { ProposalView } from "@/components/ai/proposal-view";
import { useApplyProposal, useModifyPlan } from "@/features/ai-planner/hooks";
import { errorMessage } from "@/lib/api-client";
import type { PlanProposal } from "@/types/api";

const quick = [
  "Make this trip cheaper",
  "Make it less hectic",
  "Add more adventure",
  "Add a waterfall",
  "Optimize the route",
  "Make it family-friendly",
  "Add one day",
];

export function ModifyPanel({ tripId }: { tripId: string }) {
  const [instruction, setInstruction] = React.useState("");
  const [proposal, setProposal] = React.useState<PlanProposal | null>(null);
  const modify = useModifyPlan();
  const apply = useApplyProposal();

  const ask = (text: string) => {
    const v = text.trim();
    if (!v) return;
    modify.mutate(
      { tripId, instruction: v },
      { onSuccess: setProposal, onError: (e) => toast.error(errorMessage(e)) },
    );
  };

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold">
        <Sparkles className="size-4 text-terracotta" /> Ask the planner to change this
      </h2>
      <p className="mt-0.5 text-[12.5px] text-ink-muted">You&apos;ll see the proposed plan before anything changes. Kept and booked activities stay put.</p>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          ask(instruction);
        }}
      >
        <Textarea
          rows={1}
          value={instruction}
          maxLength={500}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="e.g. Keep the total under ₹15,000 and add a beach sunset"
          className="min-h-10 resize-none"
          aria-label="Change request"
        />
        <Button type="submit" loading={modify.isPending} disabled={!instruction.trim()}>
          Propose changes
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {quick.map((q) => (
          <button
            key={q}
            disabled={modify.isPending}
            onClick={() => {
              setInstruction(q);
              ask(q);
            }}
            className="rounded-full bg-surface-muted px-3 py-1 text-[12.5px] text-ink-muted hover:bg-sage-soft hover:text-forest disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      <Dialog open={!!proposal} onOpenChange={(o) => !o && setProposal(null)}>
        <DialogContent title="Proposed changes" description={`“${instruction}”`} wide>
          {proposal && <ProposalView proposal={proposal} />}
          <DialogFooter className="sticky bottom-0 -mx-5 -mb-4 border-t border-line bg-surface px-5 py-3">
            <Button variant="secondary" onClick={() => setProposal(null)}>Discard</Button>
            <Button
              loading={apply.isPending}
              onClick={() =>
                proposal &&
                apply.mutate(
                  { proposalId: proposal.id, tripId },
                  {
                    onSuccess: () => {
                      toast.success("Itinerary updated");
                      setProposal(null);
                      setInstruction("");
                    },
                    onError: (e) => toast.error(errorMessage(e)),
                  },
                )
              }
            >
              Apply to itinerary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
