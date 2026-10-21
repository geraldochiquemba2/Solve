-- Remocao da integracao ginasio (Solve Access / OVG).
-- As tabelas e colunas abaixo deixam de ser usadas pelo CRM.

DROP TABLE IF EXISTS "acessos" CASCADE;
DROP TABLE IF EXISTS "clientes" CASCADE;
DROP TABLE IF EXISTS "terminais" CASCADE;
DROP TABLE IF EXISTS "ovg_members" CASCADE;
DROP TABLE IF EXISTS "sync_log" CASCADE;
DROP TABLE IF EXISTS "solve_access_logs" CASCADE;

ALTER TABLE "customers" DROP COLUMN IF EXISTS "ovg_id";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "ovg_id";
ALTER TABLE "plans" DROP COLUMN IF EXISTS "ovg_plan_id";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "ovg_synced";
ALTER TABLE "checkins" DROP COLUMN IF EXISTS "ovg_checkin_id";
ALTER TABLE "access" DROP COLUMN IF EXISTS "ovg_access_id";
