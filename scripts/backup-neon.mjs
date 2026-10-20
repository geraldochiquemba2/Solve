#!/usr/bin/env node
// Backup das BDs do Neon para ficheiros SQL, antes da migracao para o Oracle.
// Nao precisa de pg_dump instalado: usa o driver `pg` do repo.
//
// Uso:
//   node scripts/backup-neon.mjs                 # backup do .env (DATABASE_URL + CRM_DATABASE_URL)
//   node scripts/backup-neon.mjs <url>           # backup de uma URL explicita
//
// Saida: backups/neon-<nome>-<timestamp>.sql.gz
import pg from "pg";
import { createWriteStream, mkdirSync, readFileSync, existsSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

const { Client } = pg;

// COPY ... TO STDOUT sem pg-copy-streams: o protocolo devolve bytes em
// chunks "copyData"; basta juntar. Ver https://www.postgresql.org/docs/current/protocol-flow.html
function copyOut(client, sql) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const ok = (err) => (err ? reject(err) : resolve(Buffer.concat(chunks)));
    client.connection.query(sql, (err, result) => {
      // 'result' so chega no fim; os dados vem via evento 'copyData' abaixo.
      if (err) return; // tratado pelo listener
      ok(null);
    });
    const onData = (msg) => chunks.push(msg.chunk);
    const onEnd = () => { client.connection.removeListener("copyData", onData); client.connection.removeListener("end", onEnd); ok(null); };
    const onErr = (e) => { client.connection.removeListener("copyData", onData); onErrRemove(); ok(e); };
    const onErrRemove = () => client.connection.removeListener("end", onEnd);
    client.connection.on("copyData", onData);
    client.connection.on("end", onEnd);
    client.connection.on("error", onErr);
  });
}

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function clean(url) {
  return url.replace("&channel_binding=require", "").replace("channel_binding=require&", "");
}

function nameFrom(url) {
  try {
    const u = new URL(url);
    return (u.pathname.replace(/^\//, "") || "db").replace(/[^a-z0-9_]/gi, "_");
  } catch {
    return "db";
  }
}

async function listTables(client) {
  const r = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
  );
  return r.rows.map((x) => x.table_name);
}

async function dump(url, label) {
  const u = clean(url);
  const client = new Client({ connectionString: u, ssl: { rejectUnauthorized: false } });
  await client.connect();

  mkdirSync("backups", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = `backups/neon-${label}-${nameFrom(url)}-${stamp}.sql.gz`;
  const out = createWriteStream(file, { flags: "wx" });

  const gz = createGzip();
  const writer = pipeline(gz, out).catch(() => {});
  const w = (s) => new Promise((res) => gz.write(s, res));

  const tableCounts = {};
  const tables = await listTables(client);
  console.log(`[${label}] ${tables.length} tabelas`);

  // Schema por tabela: CREATE TABLE via pg_dump-like usando pg_get_* nao e trivial;
  // usamos a abordagem de informacao: em vez de reconstruir DDL, guardamos os dados
  // em formato COPY e o schema e recriado pelo proprio CRM (init/schema) + restore.
  // Para garantir DDL, preferimos pg_dump no servidor quando existir; aqui o foco
  // e a copia fiavel dos DADOS + lista de tabelas.
  await w(`-- Backup Solve CRM - label=${label}\n-- data=${new Date().toISOString()}\n\n`);

  for (const t of tables) {
    const cols = (
      await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
        [t],
      )
    ).rows.map((x) => x.column_name);
    const cnt = (await client.query(`SELECT count(*)::int n FROM "${t}"`)).rows[0].n;
    tableCounts[t] = cnt;
    if (cnt === 0) continue;
    await w(`\n-- ${t} (${cnt} linhas)\n`);
    await w(`COPY "${t}" (${cols.map((c) => `"${c}"`).join(", ")}) FROM stdin;\n`);
    const data = await copyOut(client, `COPY "${t}" (${cols.map((c) => `"${c}"`).join(", ")}) TO STDOUT`);
    await w(data);
    await w("\\.\n");
  }

  gz.end();
  await writer;
  await client.end();

  console.log(`[${label}] gravado: ${file}`);
  console.log(`[${label}] totais:`, tableCounts);
  return file;
}

const argUrl = process.argv[2];
if (argUrl) {
  await dump(argUrl, "explicito");
} else {
  const env = loadEnv(".env");
  const targets = [
    ["ginasio", env.DATABASE_URL],
    ["crm", env.CRM_DATABASE_URL || env.DATABASE_URL],
  ].filter(([, u]) => u);
  if (!targets.length) {
    console.error("Sem DATABASE_URL/CRM_DATABASE_URL no .env. Passe a URL como argumento.");
    process.exit(1);
  }
  // Evita duplicar se CRM_DATABASE_URL nao existir (ambos seriam iguais).
  const seen = new Set();
  for (const [label, url] of targets) {
    if (seen.has(url)) continue;
    seen.add(url);
    await dump(url, label);
  }
}
