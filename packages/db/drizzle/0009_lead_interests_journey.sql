-- Interesses múltiplos por lead + jornada WhatsApp do membro.

-- A mesma campanha pode trazer produtos diferentes: (lead_id, source) deixa de
-- ser único. A deduplicação fina é garantida pela aplicação.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'lead_campaigns'::regclass
       AND contype = 'u'
       AND pg_get_constraintdef(oid) LIKE '%(lead_id, source)%'
  LOOP
    EXECUTE format('ALTER TABLE lead_campaigns DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE "lead_campaigns" DROP CONSTRAINT IF EXISTS "lead_campaigns_lead_id_source_unique";
ALTER TABLE "lead_campaigns" DROP CONSTRAINT IF EXISTS "lead_campaigns_lead_id_source_key";

CREATE INDEX IF NOT EXISTS "lead_campaigns_lead_idx" ON "lead_campaigns" ("lead_id");

CREATE TABLE IF NOT EXISTS "member_journey_steps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "step_key" varchar(60) NOT NULL UNIQUE,
  "name" varchar(120) NOT NULL,
  "delay_hours" integer DEFAULT 0 NOT NULL,
  "message" text NOT NULL,
  "template_name" varchar(120),
  "language" varchar(20) DEFAULT 'pt_PT' NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "member_journey_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "step_id" uuid NOT NULL REFERENCES "member_journey_steps"("id") ON DELETE CASCADE,
  "due_at" timestamp with time zone DEFAULT now() NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "whatsapp_message_id" varchar(200),
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "member_journey_runs_lead_step_unique" UNIQUE ("lead_id", "step_id")
);

CREATE INDEX IF NOT EXISTS "member_journey_runs_pending_idx" ON "member_journey_runs" ("status", "due_at");
CREATE INDEX IF NOT EXISTS "member_journey_runs_lead_idx" ON "member_journey_runs" ("lead_id");

INSERT INTO "member_journey_steps" ("step_key", "name", "delay_hours", "position", "message") VALUES
  ('boas_vindas', 'Boas-vindas', 0, 10,
   'Olá {{nome}}! 👋 Recebemos o teu contacto. Em breve a nossa equipa fala contigo para te apresentar a melhor solução para ti.'),
  ('conhecer_objetivo', 'Conhecer o objetivo', 24, 20,
   'Olá {{nome}}! Para te ajudarmos melhor: qual é o teu objetivo principal connosco? Responde a esta mensagem e a equipa continua o acompanhamento.'),
  ('beneficios', 'Apresentar benefícios', 72, 30,
   '{{nome}}, sabias que podes acompanhar planos, pagamentos e treinos num só lugar? Se quiseres, marcamos uma visita para te mostrar tudo.'),
  ('oferta', 'Condição especial', 120, 40,
   '{{nome}}, preparámos uma condição especial para começares esta semana. Queres que te envie os detalhes?'),
  ('ultima_chamada', 'Última chamada', 168, 50,
   '{{nome}}, não queremos que fiques sem resposta. Se ainda tiveres interesse, responde a esta mensagem e falamos hoje.')
ON CONFLICT ("step_key") DO NOTHING;
