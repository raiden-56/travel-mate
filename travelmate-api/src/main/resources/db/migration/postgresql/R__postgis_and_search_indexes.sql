-- PostgreSQL-only enhancements (runs only with the `postgres` profile).
-- Repeatable and idempotent: safe to re-run whenever this file changes.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Geography columns derived from portable lat/lng, kept in sync by PostgreSQL.
ALTER TABLE destinations ADD COLUMN IF NOT EXISTS geog geography(Point, 4326)
    GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude::double precision, latitude::double precision), 4326)::geography) STORED;
ALTER TABLE attractions ADD COLUMN IF NOT EXISTS geog geography(Point, 4326)
    GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude::double precision, latitude::double precision), 4326)::geography) STORED;

CREATE INDEX IF NOT EXISTS ix_destinations_geog ON destinations USING GIST (geog);
CREATE INDEX IF NOT EXISTS ix_attractions_geog ON attractions USING GIST (geog);

-- Trigram indexes for fuzzy name search.
CREATE INDEX IF NOT EXISTS ix_destinations_name_trgm ON destinations USING GIN (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_attractions_name_trgm ON attractions USING GIN (lower(name) gin_trgm_ops);
