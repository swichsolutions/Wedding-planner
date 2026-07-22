-- Ipsum (Georgian Wedding Platform) — local dev database setup
-- Run ONCE as the postgres superuser. Creates a dedicated low-privilege
-- app login role and an owned database. Safe to re-run (guards included).

-- 1. Dedicated application login role (low privilege)
DO
$$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ipsum_app') THEN
      CREATE ROLE ipsum_app WITH LOGIN PASSWORD 'IpsumDev!2026_a7f3';
   END IF;
END
$$;

-- 2. Application database, owned by the app role
SELECT 'CREATE DATABASE ipsum_dev OWNER ipsum_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ipsum_dev')\gexec

-- 3. Make sure the app role can use the public schema in the new DB
\connect ipsum_dev
GRANT ALL ON SCHEMA public TO ipsum_app;
