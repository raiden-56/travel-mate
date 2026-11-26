"use client";

import Link from "next/link";
import { useAdminStats } from "@/features/admin/hooks";
import { ErrorState, PageHeader } from "@/components/common/states";
import { Card, Skeleton } from "@/components/ui/misc";

export default function AdminDashboard() {
  const stats = useAdminStats();
  const s = stats.data;
  const tiles = s
    ? [
        { label: "Total users", value: s.totalUsers, href: "/admin/users" },
        { label: "Active users (30 days)", value: s.activeUsers30d },
        { label: "New users (7 days)", value: s.newUsers7d },
        { label: "Trips", value: s.totalTrips },
        { label: "Upcoming trips", value: s.upcomingTrips },
        { label: "Completed trips", value: s.completedTrips },
        { label: "Published destinations", value: s.destinationsPublished, href: "/admin/destinations?status=PUBLISHED" },
        { label: "Draft destinations", value: s.destinationsDraft, href: "/admin/destinations?status=DRAFT" },
      ]
    : [];

  return (
    <>
      <PageHeader title="Dashboard" description="Platform health at a glance. Bookings, revenue and providers arrive with the marketplace (Phase 3)." />
      {stats.isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : stats.isError ? (
        <ErrorState error={stats.error} onRetry={() => stats.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {tiles.map((t) => {
            const body = (
              <Card className="h-full p-5 transition-shadow hover:shadow-[var(--shadow-lift)]">
                <p className="text-xs text-ink-muted">{t.label}</p>
                <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{t.value.toLocaleString("en-IN")}</p>
              </Card>
            );
            return t.href ? <Link key={t.label} href={t.href}>{body}</Link> : <div key={t.label}>{body}</div>;
          })}
        </div>
      )}
    </>
  );
}
