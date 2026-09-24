import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

// SEGURANÇA Set/2026: sem segredos hardcoded. Uso pontual:
//   CRM_DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... node fix-password.mjs
const DATABASE_URL = process.env.CRM_DATABASE_URL || process.env.DATABASE_URL || "";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@solvecorporate.ao";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

if (!DATABASE_URL || !ADMIN_PASSWORD) {
  console.error("CRM_DATABASE_URL (ou DATABASE_URL) e ADMIN_PASSWORD são obrigatórios.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);

await sql`UPDATE users SET password_hash = ${hash} WHERE email = ${ADMIN_EMAIL}`;
console.log(`Password atualizada para ${ADMIN_EMAIL}.`);

process.exit(0);
