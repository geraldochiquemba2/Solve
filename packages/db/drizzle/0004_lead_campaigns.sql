-- Migração aditiva: campanhas/interesses de cada lead.
-- Um cliente pode demonstrar interesse em várias campanhas sem ser outros clientes:
-- a lead é única (identificada por email/whatsapp/telefone) e cada nova campanha da
-- mesma pessoa é registada aqui, preservando o histórico e sem apagar nada.
-- Compatível com dados existentes: apenas adiciona uma tabela; não altera linhas.
-- Aplicar com: drizzle-kit push (o schema em src/schema/index.ts é a fonte de verdade).

CREATE TABLE IF NOT EXISTS "lead_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lead_id" uuid NOT NULL,
  "source" varchar(100) NOT NULL,
  "produto_interesse" varchar(255),
  "external_id" varchar(100),
  "created_at" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "lead_campaigns" ADD CONSTRAINT "lead_campaigns_lead_id_leads_id_fk"
  FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX IF NOT EXISTS "lead_campaigns_lead_id_source_unique"
  ON "lead_campaigns" ("lead_id", "source");