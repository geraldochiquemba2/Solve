-- Avisos internos da equipa (sino do CRM).
-- Uma linha por destinatário: cada pessoa marca a sua como lida sem afectar
-- os restantes. `lead_id` amarra o aviso à lead (apagada a lead, apagado o aviso).
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL,
  title      VARCHAR(200) NOT NULL,
  body       TEXT,
  lead_id    UUID REFERENCES leads (id) ON DELETE CASCADE,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications (user_id, created_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON notifications (user_id) WHERE read_at IS NULL;
--> statement-breakpoint
-- A lead guarda o responsável (owner_id) para o escopo de visibilidade:
-- uma lead com responsável só é vista pelo responsável e pela gestão.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users (id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS leads_owner_id_idx ON leads (owner_id);
