-- PostgreSQL init script — runs once on first container start.
-- Prisma migrations handle the full schema; this only ensures extensions exist.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
