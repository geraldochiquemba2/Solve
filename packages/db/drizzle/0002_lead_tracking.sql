ALTER TABLE "leads" ADD COLUMN "whatsapp" varchar(50);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "produto_interesse" varchar(255);--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "proximo_contato" date;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "motivo_perda" varchar(255);--> statement-breakpoint
CREATE TABLE "lead_contacts" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,"lead_id" uuid NOT NULL,"staff_id" uuid,"staff_name" varchar(255),"canal" varchar(20) NOT NULL,"resultado" varchar(50) NOT NULL,"proximo_passo" varchar(50),"proximo_contato" date,"observacao" text,"created_at" timestamp NOT NULL DEFAULT now(), CONSTRAINT "lead_contacts_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE cascade ON UPDATE no action, CONSTRAINT "lead_contacts_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action);--> statement-breakpoint
CREATE INDEX "lead_contacts_lead_idx" ON "lead_contacts" USING btree ("lead_id");
