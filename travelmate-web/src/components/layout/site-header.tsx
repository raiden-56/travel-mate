"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Heart,
  Home,
  LogOut,
  Map,
  Moon,
  Plus,
  Search,
  Shield,
  Sparkles,
  Sun,
  User,
} from "lucide-react";
import { useAuthStore, hasPermission } from "@/lib/auth-store";
import { useLogout } from "@/features/auth/hooks";
import { currentTheme, setTheme } from "@/lib/local-prefs";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Kbd } from "@/components/ui/misc";
import { SearchDialog } from "./search-dialog";
import { cn, initials } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 font-display text-[17px] font-bold tracking-tight", className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--forest)" />
        <path d="M7 21.5c3.5-1 6-4.5 9-9.5 2 3.6 4.5 7.6 9 9.5" fill="none" stroke="var(--amber)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="21.5" cy="10" r="2.2" fill="var(--canvas)" />
      </svg>
      <span>TravelMate</span>
    </Link>
  );
}

const appLinks = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/trips", label: "My Trips", icon: Map },
  { href: "/planner", label: "TravelMate AI", icon: Sparkles },
  { href: "/saved", label: "Saved", icon: Heart },
];

function isActive(rawPathname: string, href: string) {
  // Static export uses trailing slashes (/home/); compare without them.
  const pathname = rawPathname.replace(/(.)\/$/, "$1");
  if (href === "/home") return pathname === "/home";
  return pathname === href || pathname.startsWith(`${href}/`) || (href === "/explore" && (pathname.startsWith("/destinations") || pathname.startsWith("/search")));
}

function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const [theme, setThemeState] = React.useState<"light" | "dark">("light");
  React.useEffect(() => setThemeState(currentTheme()), []);
  if (!user) return null;

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button
          className="grid size-9 place-items-center overflow-hidden rounded-full bg-sage text-[13px] font-semibold text-white ring-offset-2 ring-offset-canvas hover:ring-2 hover:ring-sage/40"
          aria-label="Account menu"
        >
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            initials(user.displayName)
          )}
        </button>
      </DropdownTrigger>
      <DropdownContent className="w-60">
        <DropdownLabel>
          <span className="block truncate text-sm font-medium text-ink">{user.displayName}</span>
          <span className="block truncate">{user.email}</span>
        </DropdownLabel>
        <DropdownSeparator />
        <DropdownItem asChild>
          <Link href="/profile">
            <User /> Profile
          </Link>
        </DropdownItem>
        {hasPermission(user, "admin:access") && (
          <DropdownItem asChild>
            <Link href="/admin">
              <Shield /> Admin portal
            </Link>
          </DropdownItem>
        )}
        <DropdownItem
          onSelect={(e) => {
            e.preventDefault();
            const next = theme === "dark" ? "light" : "dark";
            setTheme(next);
            setThemeState(next);
          }}
        >
          {theme === "dark" ? <Sun /> : <Moon />} {theme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem onSelect={() => logout.mutate()}>
          <LogOut /> Sign out
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}

export function SiteHeader({ variant = "solid" }: { variant?: "solid" | "overlay" }) {
  const status = useAuthStore((s) => s.status);
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const authed = status === "authenticated";
  const overlay = variant === "overlay";

  return (
    <>
      <header
        className={cn(
          "z-40 w-full",
          overlay
            ? "absolute inset-x-0 top-0 bg-transparent text-white"
            : "sticky top-0 border-b border-line/70 bg-canvas/90 backdrop-blur",
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Logo className={overlay ? "text-white" : undefined} />

          <nav aria-label="Main" className="ml-4 hidden items-center gap-1 lg:flex">
            {(authed ? appLinks : appLinks.filter((l) => ["/explore", "/planner"].includes(l.href))).map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(pathname, l.href) ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  overlay ? "text-white/85 hover:text-white" : "text-ink-muted hover:text-ink",
                  isActive(pathname, l.href) && (overlay ? "text-white" : "bg-surface text-ink shadow-[var(--shadow-soft)]"),
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className={cn(
                "flex h-9 items-center gap-2 rounded-md px-2.5 text-sm transition-colors sm:w-56 sm:justify-between sm:px-3",
                overlay ? "bg-white/15 text-white hover:bg-white/25" : "border border-line bg-surface text-ink-muted hover:text-ink",
              )}
              aria-label="Search"
            >
              <span className="flex items-center gap-2">
                <Search className="size-4" aria-hidden />
                <span className="hidden sm:inline">Search places</span>
              </span>
              <span className="hidden sm:inline">
                <Kbd>Ctrl K</Kbd>
              </span>
            </button>

            {authed ? (
              <>
                <Button size="sm" asChild className="hidden sm:inline-flex">
                  <Link href="/trips/new">
                    <Plus /> New trip
                  </Link>
                </Button>
                <UserMenu />
              </>
            ) : status === "anonymous" ? (
              <>
                <Button variant={overlay ? "ghost" : "ghost"} size="sm" asChild className={overlay ? "text-white hover:bg-white/15" : undefined}>
                  <Link href={`/login${pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : ""}`}>Sign in</Link>
                </Button>
                <Button size="sm" variant={overlay ? "secondary" : "primary"} asChild className="hidden sm:inline-flex">
                  <Link href="/register">Get started</Link>
                </Button>
              </>
            ) : (
              <div className="size-9" aria-hidden />
            )}
          </div>
        </div>
      </header>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}

/** Thumb-reachable navigation on small screens for signed-in travelers. */
export function MobileTabBar() {
  const status = useAuthStore((s) => s.status);
  const pathname = usePathname();
  if (status !== "authenticated") return null;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {appLinks.map((l) => {
          const active = isActive(pathname, l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-medium",
                  active ? "text-forest" : "text-ink-muted",
                )}
              >
                <l.icon className={cn("size-5", active && "text-sage")} aria-hidden />
                {l.label === "TravelMate AI" ? "Plan" : l.label === "My Trips" ? "Trips" : l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 text-sm text-ink-muted sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <Logo className="text-ink" />
          <p className="mt-2 max-w-xs">Your entire journey. One place.</p>
        </div>
        <div className="flex gap-10">
          <ul className="space-y-2">
            <li className="font-medium text-ink">Discover</li>
            <li><Link href="/explore" className="hover:text-ink">Explore destinations</Link></li>
            <li><Link href="/explore?category=beaches" className="hover:text-ink">Beaches</Link></li>
            <li><Link href="/explore?category=waterfalls" className="hover:text-ink">Waterfalls</Link></li>
          </ul>
          <ul className="space-y-2">
            <li className="font-medium text-ink">Plan</li>
            <li><Link href="/planner" className="hover:text-ink">AI trip planner</Link></li>
            <li><Link href="/trips" className="hover:text-ink">My trips</Link></li>
          </ul>
        </div>
      </div>
      <p className="mx-auto max-w-7xl px-4 pb-8 text-xs text-ink-muted sm:px-6">
        Destination photos from Wikimedia Commons, credited on each page. Map data © OpenStreetMap contributors.
        Costs shown are estimates, not quotes.
      </p>
    </footer>
  );
}
