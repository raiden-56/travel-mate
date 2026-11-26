import { FlaskConical, Info, Sparkles } from "lucide-react";
import type { ItemStatus, Provenance, TripStatus } from "@/types/api";
import { Badge } from "@/components/ui/misc";
import { titleCase } from "@/lib/utils";

const tripTone: Record<TripStatus, "sage" | "amber" | "forest" | "neutral" | "terracotta"> = {
  PLANNING: "amber",
  UPCOMING: "sage",
  IN_PROGRESS: "forest",
  COMPLETED: "neutral",
  CANCELLED: "terracotta",
};

export function TripStatusChip({ status }: { status: TripStatus }) {
  return <Badge tone={tripTone[status]}>{titleCase(status)}</Badge>;
}

const itemTone: Record<ItemStatus, "sage" | "amber" | "forest" | "neutral" | "terracotta"> = {
  PLANNED: "neutral",
  BOOKED: "sage",
  COMPLETED: "forest",
  SKIPPED: "amber",
  CANCELLED: "terracotta",
};

export function ItemStatusChip({ status }: { status: ItemStatus }) {
  return <Badge tone={itemTone[status]}>{titleCase(status)}</Badge>;
}

/** Shows where integration data came from, and whether it's approximate or simulated. */
export function SourceLabel({ provenance, className }: { provenance: Provenance; className?: string }) {
  const tone = provenance.simulated ? "amber" : provenance.approximate ? "neutral" : "sage";
  return (
    <Badge tone={tone} className={className} title={provenance.note ?? undefined}>
      {provenance.simulated ? <FlaskConical /> : <Info />}
      {provenance.simulated ? "Simulated" : provenance.approximate ? "Approximate" : "Source"} · {provenance.source}
    </Badge>
  );
}

export function SeedBadge() {
  return (
    <Badge tone="neutral" title="Curated sample content for development. Not live data.">
      Curated sample
    </Badge>
  );
}

export function EstimateBadge() {
  return (
    <Badge tone="amber" title="Estimated from typical prices. Not a quote or a confirmed price.">
      Estimate
    </Badge>
  );
}

export function EngineBadge({ label, simulated }: { label: string; simulated: boolean }) {
  return (
    <Badge tone={simulated ? "amber" : "sage"}>
      {simulated ? <FlaskConical /> : <Sparkles />}
      {label}
    </Badge>
  );
}
