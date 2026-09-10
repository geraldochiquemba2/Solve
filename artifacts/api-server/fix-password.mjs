import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const sql = neon("postgresql://neondb_owner:npg_bXxHCos9Z3Nl@ep-rapid-heart-a5mtx2z6-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require");

const hash = await bcrypt.hash("admin123", 10);
console.log("New hash:", hash);

await sql`UPDATE users SET password_hash = ${hash} WHERE email = 'admin@solvecorporate.ao'`;
console.log("Password updated!");

const users = await sql`SELECT email, password_hash FROM users WHERE email = 'admin@solvecorporate.ao'`;
console.log("Updated:", JSON.stringify(users));

process.exit(0);
