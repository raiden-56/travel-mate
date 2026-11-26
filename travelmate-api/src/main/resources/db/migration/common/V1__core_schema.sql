-- TravelMate core schema (Phase 1).
-- Portable SQL: runs on PostgreSQL 16 and on H2 in PostgreSQL mode.
-- PostgreSQL-only features (PostGIS, trigram indexes) live in db/migration/postgresql.

-- ───────────── Identity & access ─────────────
CREATE TABLE permissions (
    name        VARCHAR(60)  PRIMARY KEY,
    description VARCHAR(200) NOT NULL
);

CREATE TABLE roles (
    name        VARCHAR(40)  PRIMARY KEY,
    description VARCHAR(200) NOT NULL
);

CREATE TABLE role_permissions (
    role_name       VARCHAR(40) NOT NULL REFERENCES roles (name),
    permission_name VARCHAR(60) NOT NULL REFERENCES permissions (name),
    PRIMARY KEY (role_name, permission_name)
);

CREATE TABLE users (
    id             UUID         PRIMARY KEY,
    email          VARCHAR(254) NOT NULL,
    password_hash  VARCHAR(100) NOT NULL,
    display_name   VARCHAR(60)  NOT NULL,
    avatar_url     VARCHAR(1000),
    email_verified BOOLEAN      NOT NULL DEFAULT FALSE,
    status         VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    last_login_at  TIMESTAMP WITH TIME ZONE,
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    version        BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT ck_users_status CHECK (status IN ('ACTIVE', 'SUSPENDED'))
);

CREATE TABLE user_roles (
    user_id   UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role_name VARCHAR(40) NOT NULL REFERENCES roles (name),
    PRIMARY KEY (user_id, role_name)
);

CREATE TABLE user_profiles (
    user_id            UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    home_city          VARCHAR(120),
    bio                VARCHAR(1000),
    preferred_currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    travel_styles      VARCHAR(500),
    created_at         TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at         TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE refresh_tokens (
    id          UUID        PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    family_id   UUID        NOT NULL,
    token_hash  VARCHAR(64) NOT NULL,
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at  TIMESTAMP WITH TIME ZONE,
    replaced_by UUID,
    user_agent  VARCHAR(300),
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_refresh_tokens_hash UNIQUE (token_hash)
);
CREATE INDEX ix_refresh_tokens_family ON refresh_tokens (family_id);
CREATE INDEX ix_refresh_tokens_user ON refresh_tokens (user_id);

CREATE TABLE user_tokens (
    id         UUID        PRIMARY KEY,
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    purpose    VARCHAR(20) NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at    TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_user_tokens_hash UNIQUE (token_hash),
    CONSTRAINT ck_user_tokens_purpose CHECK (purpose IN ('PASSWORD_RESET', 'EMAIL_VERIFY'))
);

CREATE TABLE audit_logs (
    id          UUID         PRIMARY KEY,
    actor_id    UUID,
    actor_email VARCHAR(254),
    action      VARCHAR(80)  NOT NULL,
    target_type VARCHAR(40),
    target_id   VARCHAR(64),
    details     VARCHAR(2000),
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX ix_audit_logs_created ON audit_logs (created_at);

-- ───────────── Destinations ─────────────
CREATE TABLE destination_categories (
    id         UUID        PRIMARY KEY,
    slug       VARCHAR(60) NOT NULL,
    name       VARCHAR(80) NOT NULL,
    sort_order INT         NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_destination_categories_slug UNIQUE (slug)
);

CREATE TABLE destinations (
    id                   UUID          PRIMARY KEY,
    slug                 VARCHAR(120)  NOT NULL,
    name                 VARCHAR(120)  NOT NULL,
    region               VARCHAR(120)  NOT NULL,
    state                VARCHAR(120)  NOT NULL,
    country              VARCHAR(120)  NOT NULL,
    latitude             NUMERIC(9, 6) NOT NULL,
    longitude            NUMERIC(9, 6) NOT NULL,
    summary              VARCHAR(500)  NOT NULL,
    description          VARCHAR(8000) NOT NULL,
    hero_image_url       VARCHAR(1000),
    hero_image_credit    VARCHAR(300),
    best_time_to_visit   VARCHAR(1000),
    recommended_days_min INT           NOT NULL DEFAULT 1,
    recommended_days_max INT           NOT NULL DEFAULT 3,
    budget_per_day_min   NUMERIC(12, 2) NOT NULL DEFAULT 0,
    budget_per_day_max   NUMERIC(12, 2) NOT NULL DEFAULT 0,
    currency             VARCHAR(3)    NOT NULL DEFAULT 'INR',
    how_to_reach         VARCHAR(4000),
    local_transport      VARCHAR(2000),
    travel_tips          VARCHAR(4000),
    safety_info          VARCHAR(2000),
    faqs                 VARCHAR(8000),
    status               VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
    featured             BOOLEAN       NOT NULL DEFAULT FALSE,
    seo_title            VARCHAR(160),
    seo_description      VARCHAR(320),
    is_seed_data         BOOLEAN       NOT NULL DEFAULT FALSE,
    popularity           INT           NOT NULL DEFAULT 0,
    deleted_at           TIMESTAMP WITH TIME ZONE,
    created_at           TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at           TIMESTAMP WITH TIME ZONE NOT NULL,
    version              BIGINT        NOT NULL DEFAULT 0,
    CONSTRAINT uq_destinations_slug UNIQUE (slug),
    CONSTRAINT ck_destinations_status CHECK (status IN ('DRAFT', 'PUBLISHED')),
    CONSTRAINT ck_destinations_days CHECK (recommended_days_min >= 1 AND recommended_days_max >= recommended_days_min),
    CONSTRAINT ck_destinations_lat CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT ck_destinations_lng CHECK (longitude BETWEEN -180 AND 180)
);
CREATE INDEX ix_destinations_status ON destinations (status, deleted_at);

CREATE TABLE destination_category_map (
    destination_id UUID NOT NULL REFERENCES destinations (id) ON DELETE CASCADE,
    category_id    UUID NOT NULL REFERENCES destination_categories (id) ON DELETE CASCADE,
    PRIMARY KEY (destination_id, category_id)
);

CREATE TABLE destination_images (
    id             UUID          PRIMARY KEY,
    destination_id UUID          NOT NULL REFERENCES destinations (id) ON DELETE CASCADE,
    url            VARCHAR(1000) NOT NULL,
    credit         VARCHAR(300),
    alt            VARCHAR(300)  NOT NULL,
    sort_order     INT           NOT NULL DEFAULT 0,
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at     TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX ix_destination_images_dest ON destination_images (destination_id);

CREATE TABLE attractions (
    id                       UUID           PRIMARY KEY,
    destination_id           UUID           NOT NULL REFERENCES destinations (id) ON DELETE CASCADE,
    slug                     VARCHAR(120)   NOT NULL,
    name                     VARCHAR(160)   NOT NULL,
    category                 VARCHAR(20)    NOT NULL,
    description              VARCHAR(4000)  NOT NULL,
    latitude                 NUMERIC(9, 6)  NOT NULL,
    longitude                NUMERIC(9, 6)  NOT NULL,
    typical_duration_minutes INT            NOT NULL DEFAULT 60,
    cost_min                 NUMERIC(12, 2) NOT NULL DEFAULT 0,
    cost_max                 NUMERIC(12, 2) NOT NULL DEFAULT 0,
    currency                 VARCHAR(3)     NOT NULL DEFAULT 'INR',
    cost_note                VARCHAR(300),
    best_time_of_day         VARCHAR(10)    NOT NULL DEFAULT 'ANY',
    opening_hours_note       VARCHAR(300),
    opening_hours_verified   BOOLEAN        NOT NULL DEFAULT FALSE,
    tags                     VARCHAR(500),
    family_friendly          BOOLEAN        NOT NULL DEFAULT TRUE,
    accessibility_note       VARCHAR(500),
    is_seed_data             BOOLEAN        NOT NULL DEFAULT FALSE,
    deleted_at               TIMESTAMP WITH TIME ZONE,
    created_at               TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at               TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_attractions_slug UNIQUE (destination_id, slug),
    CONSTRAINT ck_attractions_cost CHECK (cost_min >= 0 AND cost_max >= cost_min),
    CONSTRAINT ck_attractions_duration CHECK (typical_duration_minutes BETWEEN 5 AND 1440),
    CONSTRAINT ck_attractions_time CHECK (best_time_of_day IN ('MORNING', 'AFTERNOON', 'EVENING', 'ANY'))
);
CREATE INDEX ix_attractions_destination ON attractions (destination_id);

CREATE TABLE favorites (
    id          UUID        PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL,
    target_id   UUID        NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_favorites UNIQUE (user_id, target_type, target_id),
    CONSTRAINT ck_favorites_type CHECK (target_type IN ('DESTINATION', 'ATTRACTION'))
);

CREATE TABLE search_queries (
    id         UUID         PRIMARY KEY,
    query      VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX ix_search_queries_created ON search_queries (created_at);

-- ───────────── Trips ─────────────
CREATE TABLE trips (
    id               UUID           PRIMARY KEY,
    owner_id         UUID           NOT NULL REFERENCES users (id),
    name             VARCHAR(120)   NOT NULL,
    destination_id   UUID           REFERENCES destinations (id),
    destination_name VARCHAR(120)   NOT NULL,
    start_location   VARCHAR(120),
    start_date       DATE,
    end_date         DATE,
    day_count        INT            NOT NULL,
    travelers        INT            NOT NULL DEFAULT 1,
    trip_type        VARCHAR(20),
    budget_amount    NUMERIC(12, 2),
    currency         VARCHAR(3)     NOT NULL DEFAULT 'INR',
    cover_image_url  VARCHAR(1000),
    description      VARCHAR(2000),
    visibility       VARCHAR(20)    NOT NULL DEFAULT 'PRIVATE',
    status           VARCHAR(20)    NOT NULL DEFAULT 'PLANNING',
    archived         BOOLEAN        NOT NULL DEFAULT FALSE,
    deleted_at       TIMESTAMP WITH TIME ZONE,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL,
    version          BIGINT         NOT NULL DEFAULT 0,
    CONSTRAINT ck_trips_days CHECK (day_count BETWEEN 1 AND 60),
    CONSTRAINT ck_trips_travelers CHECK (travelers BETWEEN 1 AND 50),
    CONSTRAINT ck_trips_dates CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date),
    CONSTRAINT ck_trips_status CHECK (status IN ('PLANNING', 'UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    CONSTRAINT ck_trips_visibility CHECK (visibility IN ('PRIVATE', 'SHARED_LINK')),
    CONSTRAINT ck_trips_budget CHECK (budget_amount IS NULL OR budget_amount >= 0)
);
CREATE INDEX ix_trips_owner ON trips (owner_id, deleted_at);

CREATE TABLE trip_members (
    id         UUID        PRIMARY KEY,
    trip_id    UUID        NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role       VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_trip_members UNIQUE (trip_id, user_id),
    CONSTRAINT ck_trip_members_role CHECK (role IN ('OWNER', 'CO_PLANNER', 'TRAVELER', 'VIEWER'))
);
CREATE INDEX ix_trip_members_user ON trip_members (user_id);

CREATE TABLE trip_budget_categories (
    trip_id  UUID           NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    category VARCHAR(20)    NOT NULL,
    amount   NUMERIC(12, 2) NOT NULL,
    PRIMARY KEY (trip_id, category),
    CONSTRAINT ck_trip_budget_amount CHECK (amount >= 0)
);

CREATE TABLE itinerary_items (
    id                UUID           PRIMARY KEY,
    trip_id           UUID           NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    day_number        INT            NOT NULL,
    position          INT            NOT NULL DEFAULT 0,
    title             VARCHAR(200)   NOT NULL,
    description       VARCHAR(2000),
    category          VARCHAR(20)    NOT NULL,
    status            VARCHAR(20)    NOT NULL DEFAULT 'PLANNED',
    priority          VARCHAR(10)    NOT NULL DEFAULT 'MEDIUM',
    location_name     VARCHAR(200),
    latitude          NUMERIC(9, 6),
    longitude         NUMERIC(9, 6),
    start_time        TIME,
    end_time          TIME,
    duration_minutes  INT,
    estimated_cost    NUMERIC(12, 2),
    currency          VARCHAR(3)     NOT NULL DEFAULT 'INR',
    cost_is_estimate  BOOLEAN        NOT NULL DEFAULT TRUE,
    notes             VARCHAR(2000),
    booking_reference VARCHAR(120),
    transport_mode    VARCHAR(40),
    attraction_id     UUID           REFERENCES attractions (id) ON DELETE SET NULL,
    locked            BOOLEAN        NOT NULL DEFAULT FALSE,
    source            VARCHAR(10)    NOT NULL DEFAULT 'USER',
    ai_reason         VARCHAR(1000),
    deleted_at        TIMESTAMP WITH TIME ZONE,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at        TIMESTAMP WITH TIME ZONE NOT NULL,
    version           BIGINT         NOT NULL DEFAULT 0,
    CONSTRAINT ck_items_day CHECK (day_number >= 1),
    CONSTRAINT ck_items_cost CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
    CONSTRAINT ck_items_duration CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
    CONSTRAINT ck_items_status CHECK (status IN ('PLANNED', 'BOOKED', 'COMPLETED', 'SKIPPED', 'CANCELLED')),
    CONSTRAINT ck_items_source CHECK (source IN ('USER', 'AI', 'PLANNER'))
);
CREATE INDEX ix_items_trip ON itinerary_items (trip_id, deleted_at, day_number, position);

-- ───────────── Budget ─────────────
CREATE TABLE expenses (
    id                UUID           PRIMARY KEY,
    trip_id           UUID           NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    title             VARCHAR(160)   NOT NULL,
    amount            NUMERIC(12, 2) NOT NULL,
    currency          VARCHAR(3)     NOT NULL,
    category          VARCHAR(20)    NOT NULL,
    paid_by_user_id   UUID           NOT NULL REFERENCES users (id),
    expense_date      DATE           NOT NULL,
    notes             VARCHAR(1000),
    payment_method    VARCHAR(40),
    client_request_id VARCHAR(64),
    deleted_at        TIMESTAMP WITH TIME ZONE,
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at        TIMESTAMP WITH TIME ZONE NOT NULL,
    version           BIGINT         NOT NULL DEFAULT 0,
    CONSTRAINT uq_expenses_client_request UNIQUE (trip_id, client_request_id),
    CONSTRAINT ck_expenses_amount CHECK (amount > 0)
);
CREATE INDEX ix_expenses_trip ON expenses (trip_id, deleted_at);

-- ───────────── Checklists ─────────────
CREATE TABLE checklists (
    id           UUID         PRIMARY KEY,
    trip_id      UUID         NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    name         VARCHAR(120) NOT NULL,
    template_key VARCHAR(40),
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX ix_checklists_trip ON checklists (trip_id);

CREATE TABLE checklist_items (
    id           UUID         PRIMARY KEY,
    checklist_id UUID         NOT NULL REFERENCES checklists (id) ON DELETE CASCADE,
    label        VARCHAR(200) NOT NULL,
    category     VARCHAR(20)  NOT NULL,
    completed    BOOLEAN      NOT NULL DEFAULT FALSE,
    position     INT          NOT NULL DEFAULT 0,
    suggested    BOOLEAN      NOT NULL DEFAULT FALSE,
    reason       VARCHAR(300),
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX ix_checklist_items_list ON checklist_items (checklist_id);

-- ───────────── AI ─────────────
CREATE TABLE ai_plan_proposals (
    id         UUID            PRIMARY KEY,
    user_id    UUID            NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    trip_id    UUID            REFERENCES trips (id) ON DELETE CASCADE,
    engine     VARCHAR(20)     NOT NULL,
    payload    VARCHAR(1000000) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX ix_ai_proposals_user ON ai_plan_proposals (user_id, created_at);
