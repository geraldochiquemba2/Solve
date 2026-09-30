-- Módulo 6 — 4 etapas + último contacto editável.
-- 1) Coluna do último contacto (fonte única do que se mostra na tabela).
-- 2) Preenchimento a partir do histórico já registado (nada se perde).
-- 3) Consolida as etapas em "qualificado" ("Em acompanhamento"):
--    - proposta / negociacao deixam de ser passos próprios;
--    - contacto deixa de ser etapa: quem já foi contactado está em acompanhamento.
--    O enum do Postgregres mantém os valores antigos para não ser uma migração
--    destrutiva; o que muda é o estado real das linhas, e a API passa a
--    normalizar qualquer valor antigo. Nenhum histórico é apagado: a coluna
--    `ultimo_contato_at` continua a dizer quando foi o último contacto.
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "ultimo_contato_at" date;

UPDATE "leads" l
SET "ultimo_contato_at" = sub."ultimo"
FROM (
  SELECT "lead_id", MAX("created_at")::date AS "ultimo"
  FROM "lead_contacts"
  GROUP BY "lead_id"
) sub
WHERE l."id" = sub."lead_id" AND l."ultimo_contato_at" IS NULL;

UPDATE "leads" SET "status" = 'qualificado' WHERE "status" IN ('proposta', 'negociacao', 'contacto');
