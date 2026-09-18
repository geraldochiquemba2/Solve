-- Tabela para receber leads da landing Fit90 antes de empurrar ao CRM
CREATE TABLE IF NOT EXISTS fit90_leads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  company     TEXT,
  source      TEXT DEFAULT 'fit90_landing',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Estado do push ao CRM
  pushed      BOOLEAN NOT NULL DEFAULT false,
  pushed_at   TIMESTAMPTZ,
  crm_lead_id TEXT,
  error       TEXT
);

-- Backfill idempotente para tabelas já existentes (schema antigo do quiz Fit90):
-- id sem default, phone/answers obrigatórios — a edge function só envia
-- name/email/phone/company/source/notes, por isso estes pontos têm de estar OK.
ALTER TABLE fit90_leads ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE fit90_leads ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE fit90_leads ADD COLUMN IF NOT EXISTS pushed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE fit90_leads ADD COLUMN IF NOT EXISTS pushed_at TIMESTAMPTZ;
ALTER TABLE fit90_leads ADD COLUMN IF NOT EXISTS crm_lead_id TEXT;
ALTER TABLE fit90_leads ADD COLUMN IF NOT EXISTS error TEXT;

DO $$
BEGIN
  ALTER TABLE fit90_leads ALTER COLUMN id SET DEFAULT gen_random_uuid();
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'fit90_leads' AND column_name = 'answers') THEN
    -- Alargar a origem permitida: schema antigo (quiz) + nova landing Fit90
    ALTER TABLE fit90_leads DROP CONSTRAINT IF EXISTS fit90_leads_source_check;
    ALTER TABLE fit90_leads ADD CONSTRAINT fit90_leads_source_check
      CHECK (source IN ('bruno_samora_landing', 'fit90_landing'));
    ALTER TABLE fit90_leads ALTER COLUMN answers DROP NOT NULL;
    ALTER TABLE fit90_leads ALTER COLUMN phone DROP NOT NULL;
  END IF;
END $$;

-- Index para sabermos rapidamente o que ainda não foi empurrado
CREATE INDEX IF NOT EXISTS idx_fit90_leads_pending
  ON fit90_leads (created_at)
  WHERE pushed = false;

-- RLS: a service role (edge function) tem acesso total;
-- a anonymous key só pode inserir (landing page)
ALTER TABLE fit90_leads ENABLE ROW LEVEL SECURITY;

-- Anónimo (landing page): só INSERT
CREATE POLICY "fit90_leads_insert_anon"
  ON fit90_leads
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Service role (edge function): SELECT + UPDATE (para marcar pushed)
CREATE POLICY "fit90_leads_service_all"
  ON fit90_leads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
