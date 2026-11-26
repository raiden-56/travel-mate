// DTO types mirrored from docs/API.md. Change the contract first, then this file.

export type Money = string; // decimal string with 2 places, e.g. "12500.00"

export type PageResponse<T> = {
  items: T[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
};

export type ApiProblem = {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  code?: string;
  errors?: { field: string; message: string }[];
};

export type Provenance = { source: string; approximate: boolean; simulated: boolean; note?: string };

// ---------- users ----------
export type UserDto = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  status: "ACTIVE" | "SUSPENDED";
  roles: string[];
  permissions: string[];
  createdAt: string;
};
export type AuthResponse = { accessToken: string; expiresIn: number; user: UserDto };

export const TRAVEL_STYLES = [
  "RELAXED",
  "ADVENTURE",
  "BUDGET",
  "LUXURY",
  "NATURE",
  "FOOD",
  "PHOTOGRAPHY",
  "FAMILY",
  "COUPLE",
  "BACKPACKING",
  "CULTURAL",
  "ROAD_TRIP",
] as const;
export type TravelStyle = (typeof TRAVEL_STYLES)[number];

export type ProfileDto = {
  displayName: string;
  avatarUrl: string | null;
  homeCity: string | null;
  bio: string | null;
  preferredCurrency: string;
  travelStyles: TravelStyle[];
};

export type ProfileStats = {
  tripsTotal: number;
  tripsUpcoming: number;
  tripsCompleted: number;
  destinationsVisited: number;
  totalTravelDays: number;
  savedPlaces: number;
  spending: { currency: string; amount: Money }[];
};

// ---------- destinations ----------
export type CategoryDto = { slug: string; name: string };

export type DestinationSummary = {
  id: string;
  slug: string;
  name: string;
  region: string;
  state: string;
  country: string;
  summary: string;
  heroImageUrl: string | null;
  heroImageCredit: string | null;
  latitude: number;
  longitude: number;
  categories: CategoryDto[];
  recommendedDaysMin: number;
  recommendedDaysMax: number;
  budgetPerDayMin: Money;
  budgetPerDayMax: Money;
  currency: string;
  featured: boolean;
  seedData: boolean;
  saved: boolean;
};

export type AttractionCategory =
  | "BEACH"
  | "TEMPLE"
  | "WATERFALL"
  | "FORT"
  | "VIEWPOINT"
  | "MUSEUM"
  | "ADVENTURE"
  | "NATURE"
  | "WILDLIFE"
  | "MARKET"
  | "ISLAND"
  | "HERITAGE"
  | "RESTAURANT"
  | "CAFE"
  | "OTHER";

export const ATTRACTION_CATEGORIES: AttractionCategory[] = [
  "BEACH", "TEMPLE", "WATERFALL", "FORT", "VIEWPOINT", "MUSEUM", "ADVENTURE", "NATURE",
  "WILDLIFE", "MARKET", "ISLAND", "HERITAGE", "RESTAURANT", "CAFE", "OTHER",
];

export type TimeOfDay = "MORNING" | "AFTERNOON" | "EVENING" | "ANY";

export type AttractionDto = {
  id: string;
  slug: string;
  destinationId: string;
  destinationSlug: string;
  name: string;
  category: AttractionCategory;
  description: string;
  latitude: number;
  longitude: number;
  typicalDurationMinutes: number;
  costMin: Money;
  costMax: Money;
  currency: string;
  costNote: string | null;
  bestTimeOfDay: TimeOfDay;
  openingHoursNote: string | null;
  openingHoursVerified: boolean;
  tags: string[];
  familyFriendly: boolean;
  accessibilityNote: string | null;
  seedData: boolean;
  saved: boolean;
};

export type GalleryImage = { url: string; credit: string | null; alt: string };

export type DestinationDetail = DestinationSummary & {
  description: string;
  bestTimeToVisit: string;
  howToReach: string;
  localTransport: string;
  travelTips: string[];
  safetyInfo: string;
  faqs: { question: string; answer: string }[];
  gallery: GalleryImage[];
  attractions: AttractionDto[];
  similar: DestinationSummary[];
  seoTitle: string | null;
  seoDescription: string | null;
  status: "DRAFT" | "PUBLISHED";
  updatedAt: string;
};

export type WeatherDto = {
  provenance: Provenance;
  timezone: string;
  current: {
    time: string;
    temperatureC: number;
    apparentC: number;
    precipitationMm: number;
    windKph: number;
    weatherCode: number;
    description: string;
  } | null;
  daily: {
    date: string;
    minC: number;
    maxC: number;
    precipitationProbability: number | null;
    precipitationMm: number;
    weatherCode: number;
    description: string;
  }[];
};

// ---------- search ----------
export type SearchResult = { destinations: DestinationSummary[]; attractions: AttractionDto[] };
export type Suggestion = {
  type: "DESTINATION" | "ATTRACTION" | "CATEGORY";
  label: string;
  sublabel: string | null;
  slug: string;
  destinationSlug: string | null;
};

// ---------- favorites ----------
export type FavoriteTarget = "DESTINATION" | "ATTRACTION";
export type FavoriteDto = {
  id: string;
  targetType: FavoriteTarget;
  targetId: string;
  createdAt: string;
  destination: DestinationSummary | null;
  attraction: AttractionDto | null;
};

// ---------- trips ----------
export type TripStatus = "PLANNING" | "UPCOMING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type TripRole = "OWNER" | "CO_PLANNER" | "TRAVELER" | "VIEWER";

export type TripDto = {
  id: string;
  name: string;
  destination: DestinationSummary | null;
  destinationName: string;
  startLocation: string | null;
  startDate: string | null;
  endDate: string | null;
  dayCount: number;
  travelers: number;
  tripType: TravelStyle | null;
  budgetAmount: Money | null;
  currency: string;
  coverImageUrl: string | null;
  description: string | null;
  visibility: "PRIVATE" | "SHARED_LINK";
  status: TripStatus;
  archived: boolean;
  myRole: TripRole;
  itemCount: number;
  estimatedCost: Money;
  spentAmount: Money;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type TripUpsert = {
  name: string;
  destinationSlug?: string | null;
  destinationName: string;
  startLocation?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  dayCount: number;
  travelers: number;
  tripType?: TravelStyle | null;
  budgetAmount?: Money | null;
  currency?: string;
  coverImageUrl?: string | null;
  description?: string | null;
  visibility?: "PRIVATE" | "SHARED_LINK";
  version?: number;
};

// ---------- itinerary ----------
export const ITEM_CATEGORIES = [
  "ATTRACTION",
  "RESTAURANT",
  "HOTEL",
  "ACTIVITY",
  "TRANSPORTATION",
  "SHOPPING",
  "REST",
  "EVENT",
  "CUSTOM",
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];
export const ITEM_STATUSES = ["PLANNED", "BOOKED", "COMPLETED", "SKIPPED", "CANCELLED"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];
export type Priority = "LOW" | "MEDIUM" | "HIGH";

export type ItineraryItemDto = {
  id: string;
  tripId: string;
  dayNumber: number;
  position: number;
  date: string | null;
  title: string;
  description: string | null;
  category: ItemCategory;
  status: ItemStatus;
  priority: Priority;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  estimatedCost: Money | null;
  currency: string;
  costIsEstimate: boolean;
  notes: string | null;
  bookingReference: string | null;
  transportMode: string | null;
  attractionId: string | null;
  locked: boolean;
  source: "USER" | "AI" | "PLANNER";
  aiReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ItineraryItemInput = Partial<
  Pick<
    ItineraryItemDto,
    | "title"
    | "description"
    | "category"
    | "status"
    | "priority"
    | "locationName"
    | "latitude"
    | "longitude"
    | "startTime"
    | "endTime"
    | "durationMinutes"
    | "estimatedCost"
    | "currency"
    | "notes"
    | "bookingReference"
    | "transportMode"
    | "attractionId"
    | "locked"
    | "position"
    | "dayNumber"
    | "version"
  >
>;

export type WarningCode =
  | "OVERLAP"
  | "TIGHT_TRANSFER"
  | "LONG_TRANSFER"
  | "UNREALISTIC_DURATION"
  | "OUTSIDE_HOURS"
  | "OVER_BUDGET"
  | "DAY_OVERLOADED"
  | "OUT_OF_RANGE_DAY";

export type ItineraryWarning = {
  code: WarningCode;
  severity: "INFO" | "WARNING";
  message: string;
  dayNumber: number | null;
  itemIds: string[];
};

export type ItineraryDay = {
  dayNumber: number;
  date: string | null;
  items: ItineraryItemDto[];
  estimatedCost: Money;
};

export type ItineraryDto = {
  tripId: string;
  dayCount: number;
  days: ItineraryDay[];
  warnings: ItineraryWarning[];
  estimatedTotal: Money;
  currency: string;
};

// ---------- AI planner ----------
export type Pace = "RELAXED" | "BALANCED" | "PACKED";
export type Transport = "ROAD_TRIP" | "BUS" | "TRAIN" | "FLIGHT" | "MIXED";
export type Accommodation = "BUDGET" | "MIDRANGE" | "LUXURY" | "HOSTEL" | "HOMESTAY" | "CAMPING";

export type PlanRequest = {
  startLocation?: string;
  destinationSlug?: string;
  destinationName?: string;
  startDate?: string;
  flexibleDates?: boolean;
  days: number;
  travelers: number;
  budget?: Money;
  currency?: string;
  transport?: Transport;
  accommodation?: Accommodation;
  styles: TravelStyle[];
  interests: string[];
  pace: Pace;
  dietary?: string;
  accessibility?: string;
};

export type ProposedItem = {
  dayNumber: number;
  position: number;
  title: string;
  description: string;
  category: ItemCategory;
  attractionId: string | null;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  estimatedCost: Money | null;
  currency: string;
  reason: string;
  alternatives: string[];
  locked: boolean;
  /** Existing itinerary item this proposal carries over (modify proposals); updated in place on apply. */
  sourceItemId: string | null;
};

export type EngineInfo = {
  id: "anthropic" | "deterministic";
  label: string;
  model: string | null;
  simulated: boolean;
};

export type PlanProposal = {
  id: string;
  engine: EngineInfo;
  request: PlanRequest;
  tripId: string | null;
  summary: string;
  days: { dayNumber: number; date: string | null; title: string; items: ProposedItem[] }[];
  estimatedTotal: Money;
  currency: string;
  budgetStatus: "WITHIN" | "OVER" | "UNKNOWN";
  tips: string[];
  assumptions: string[];
  warnings: string[];
  createdAt: string;
};

// ---------- maps ----------
export type LatLng = { lat: number; lng: number };
export type RouteResult = {
  provenance: Provenance;
  distanceKm: number;
  durationMinutes: number | null;
  geometry: [number, number][];
  legs: { distanceKm: number; durationMinutes: number | null }[];
};
export type OptimizeResult = {
  provenance: Provenance;
  order: number[];
  distanceKmBefore: number;
  distanceKmAfter: number;
};

// ---------- budget ----------
export const BUDGET_CATEGORIES = [
  "TRANSPORTATION",
  "ACCOMMODATION",
  "FOOD",
  "ACTIVITIES",
  "SHOPPING",
  "FUEL",
  "TICKETS",
  "RENTALS",
  "OTHER",
] as const;
export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

export type BudgetDto = {
  currency: string;
  totalBudget: Money | null;
  perPersonBudget: Money | null;
  travelers: number;
  estimatedItineraryCost: Money;
  spent: Money;
  remaining: Money | null;
  byCategory: { category: BudgetCategory; budget: Money | null; estimated: Money; spent: Money }[];
  /** Server-provided caveats, e.g. other-currency expenses excluded from totals. */
  notes: string[];
};

export type ExpenseDto = {
  id: string;
  tripId: string;
  title: string;
  amount: Money;
  currency: string;
  category: BudgetCategory;
  paidByUserId: string;
  paidByName: string;
  date: string;
  notes: string | null;
  paymentMethod: string | null;
  clientRequestId: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type ExpenseInput = {
  title: string;
  amount: Money;
  currency?: string;
  category: BudgetCategory;
  date: string;
  notes?: string | null;
  paymentMethod?: string | null;
  clientRequestId?: string;
  version?: number;
};

// ---------- checklist ----------
export const CHECKLIST_CATEGORIES = [
  "CLOTHING",
  "DOCUMENTS",
  "ELECTRONICS",
  "MEDICINES",
  "TOILETRIES",
  "FOOD",
  "SAFETY",
  "ADVENTURE",
  "ESSENTIALS",
  "OTHER",
] as const;
export type ChecklistCategory = (typeof CHECKLIST_CATEGORIES)[number];

export type ChecklistItemDto = {
  id: string;
  label: string;
  category: ChecklistCategory;
  completed: boolean;
  position: number;
  suggested: boolean;
  reason: string | null;
};
export type ChecklistDto = {
  id: string;
  tripId: string;
  name: string;
  templateKey: string | null;
  items: ChecklistItemDto[];
  completedCount: number;
  totalCount: number;
};
export type ChecklistTemplate = {
  key: string;
  name: string;
  description: string;
  items: { label: string; category: ChecklistCategory }[];
};
export type ChecklistSuggestion = {
  provenance: Provenance;
  items: { label: string; category: ChecklistCategory; reason: string }[];
};

// ---------- admin ----------
export type AdminStats = {
  totalUsers: number;
  activeUsers30d: number;
  newUsers7d: number;
  totalTrips: number;
  upcomingTrips: number;
  completedTrips: number;
  destinationsPublished: number;
  destinationsDraft: number;
};
export type AdminDestinationRow = DestinationSummary & { status: "DRAFT" | "PUBLISHED"; updatedAt: string };
export type AdminUserRow = UserDto & { tripCount: number; lastLoginAt: string | null };
export type AuditLogRow = {
  id: string;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: string | null;
  createdAt: string;
};

export type DestinationUpsert = {
  slug: string;
  name: string;
  region: string;
  state: string;
  country: string;
  summary: string;
  description: string;
  heroImageUrl: string | null;
  heroImageCredit: string | null;
  latitude: number;
  longitude: number;
  categorySlugs: string[];
  recommendedDaysMin: number;
  recommendedDaysMax: number;
  budgetPerDayMin: Money;
  budgetPerDayMax: Money;
  currency: string;
  bestTimeToVisit: string;
  howToReach: string;
  localTransport: string;
  travelTips: string[];
  safetyInfo: string;
  faqs: { question: string; answer: string }[];
  gallery: GalleryImage[];
  featured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type AttractionUpsert = Omit<
  AttractionDto,
  "id" | "destinationId" | "destinationSlug" | "seedData" | "saved"
>;
