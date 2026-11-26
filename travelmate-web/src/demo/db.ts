import seed from "./seed.json";
import type {
  AuditLogRow,
  CategoryDto,
  ChecklistItemDto,
  ChecklistTemplate,
  DestinationDetail,
  ExpenseDto,
  FavoriteTarget,
  ItineraryItemDto,
  PlanProposal,
  TravelStyle,
  TripDto,
} from "@/types/api";

export type DemoDestination = Omit<DestinationDetail, "similar" | "saved"> & { deletedAt?: string | null };

export type DemoUser = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  salt: string;
  roles: string[];
  status: "ACTIVE" | "SUSPENDED";
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  profile: {
    avatarUrl: string | null;
    homeCity: string | null;
    bio: string | null;
    preferredCurrency: string;
    travelStyles: TravelStyle[];
  };
};

/** Stored trip: the editable fields of TripDto plus ownership; derived fields are computed on read. */
export type DemoTrip = Pick<
  TripDto,
  | "id"
  | "name"
  | "destinationName"
  | "startLocation"
  | "startDate"
  | "endDate"
  | "dayCount"
  | "travelers"
  | "tripType"
  | "budgetAmount"
  | "currency"
  | "coverImageUrl"
  | "description"
  | "visibility"
  | "status"
  | "archived"
  | "version"
  | "createdAt"
  | "updatedAt"
> & {
  ownerId: string;
  destinationSlug: string | null;
  categoryBudgets: Record<string, string>;
  deletedAt: string | null;
};

export type DemoChecklist = { id: string; tripId: string; name: string; templateKey: string | null; items: ChecklistItemDto[] };
export type DemoFavorite = { id: string; userId: string; targetType: FavoriteTarget; targetId: string; createdAt: string };
export type DemoProposal = PlanProposal & { ownerId: string };

export type DemoDB = {
  version: 1;
  users: DemoUser[];
  destinations: DemoDestination[];
  categories: CategoryDto[];
  templates: ChecklistTemplate[];
  popular: string[];
  favorites: DemoFavorite[];
  trips: DemoTrip[];
  items: ItineraryItemDto[];
  expenses: ExpenseDto[];
  checklists: DemoChecklist[];
  proposals: DemoProposal[];
  audit: AuditLogRow[];
  sessionUserId: string | null;
};

const STORAGE_KEY = "tm-demo-v1";

export function freshDb(): DemoDB {
  const s = structuredClone(seed) as unknown as {
    destinations: DemoDestination[];
    categories: CategoryDto[];
    templates: ChecklistTemplate[];
    popular: string[];
  };
  return {
    version: 1,
    users: [],
    destinations: s.destinations.map((d) => ({ ...d, deletedAt: null })),
    categories: s.categories,
    templates: s.templates,
    popular: s.popular,
    favorites: [],
    trips: [],
    items: [],
    expenses: [],
    checklists: [],
    proposals: [],
    audit: [],
    sessionUserId: null,
  };
}

let memory: DemoDB | null = null;

/** Loads the demo database from this browser's storage (or memory when storage is unavailable). */
export function loadDb(): DemoDB {
  if (memory) return memory;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoDB;
      if (parsed.version === 1) {
        memory = parsed;
        return parsed;
      }
    }
  } catch {
    /* storage blocked or corrupt — start fresh */
  }
  memory = freshDb();
  return memory;
}

export function saveDb(db: DemoDB): void {
  memory = db;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* storage full or blocked — keep working in memory for this tab */
  }
}

export function resetDb(): void {
  memory = null;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
