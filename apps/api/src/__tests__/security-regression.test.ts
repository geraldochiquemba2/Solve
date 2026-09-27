import { describe, it, expect, beforeAll, afterAll } from "vitest";
import net from "net";
import request from "supertest";

// Regressão de segurança: o redirect /api/* -> /api/v1/* e os headers CORS dos
// streams foram endurecidos. Estes testes existem para garantir que o
// endurecimento NÃO alterou o comportamento das rotas legítimas.
//
// Os casos de ataque são enviados por socket cru porque qualquer cliente HTTP
// normaliza o path antes de o enviar (o supertest transformava "//evil.com" em
// "/evil.com" e "https://evil.com" em URL inválida) — só os bytes crus
// alcançam de facto a lógica de redirect.

let app: typeof import("../app").default;
let resolveAllowedOrigin: typeof import("../lib/cors").resolveAllowedOrigin;
let server: ReturnType<typeof app.listen>;
let port: number;

beforeAll(async () => {
  // A allowlist é lida no carregamento do módulo — tem de estar definida
  // ANTES de qualquer import dinâmico.
  process.env.CORS_ORIGIN = "http://localhost:5173,https://crm.exemplo.ao";
  resolveAllowedOrigin = (await import("../lib/cors")).resolveAllowedOrigin;
  app = (await import("../app")).default;

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  port = (server.address() as net.AddressInfo).port;
});

afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** Envia a linha de request tal e qual, sem normalizar o path. */
function rawGet(rawPath: string, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; location?: string; raw: string }>((resolve, reject) => {
    const hs = Object.entries(headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\r\n");
    const sock = net.connect(port, "127.0.0.1", () => {
      sock.write(
        `GET ${rawPath} HTTP/1.1\r\nHost: 127.0.0.1\r\n${hs}\r\nConnection: close\r\n\r\n`
      );
    });
    let buf = "";
    sock.setTimeout(5000, () => {
      sock.destroy();
      reject(new Error(`timeout em ${rawPath}`));
    });
    sock.on("data", (d) => (buf += d.toString("latin1")));
    sock.on("end", () => {
      const head = buf.split("\r\n\r\n")[0] ?? "";
      const status = Number.parseInt(head.split(" ")[1] ?? "0", 10);
      const m = /^[Ll]ocation:[ \t]*(.*)$/m.exec(head);
      resolve({ status, location: m?.[1]?.trim(), raw: buf });
    });
    sock.on("error", reject);
  });
}

describe("redirect /api/* -> /api/v1/* (rotas legítimas, via supertest)", () => {
  // Rotas reais do CRM: o destino tem de ser EXATAMENTE o de antes da correção.
  const intactas: Array<[string, string]> = [
    ["/api/", "/api/v1/"],
    ["/api/leads", "/api/v1/leads"],
    ["/api/customers", "/api/v1/customers"],
    ["/api/payments", "/api/v1/payments"],
    ["/api/dashboard", "/api/v1/dashboard"],
    ["/api/plans", "/api/v1/plans"],
    ["/api/users", "/api/v1/users"],
    ["/api/cademi/entregas", "/api/v1/cademi/entregas"],
    ["/api/solve-access/stream", "/api/v1/solve-access/stream"],
    ["/api/webhooks/ekwanza", "/api/v1/webhooks/ekwanza"],
    ["/api/leads/123", "/api/v1/leads/123"],
    ["/api/portal", "/api/v1/portal"],
  ];

  it.each(intactas)("mantem %s -> %s", async (entrada, esperado) => {
    const res = await request(app).get(entrada);
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe(esperado);
  });

  it("preserva escapes percent-encoded (nao duplica a codificacao)", async () => {
    const res = await request(app).get("/api/buscar/a%20b");
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe("/api/v1/buscar/a%20b");
    // A regressão seria %2520 (dupla codificação).
    expect(res.headers.location).not.toContain("%2520");
  });

  it("nao redireciona o que ja esta versionado", async () => {
    const res = await request(app).get("/api/v1/leads");
    expect(res.status).toBe(401);
    expect(res.headers.location).toBeUndefined();
  });
});

describe("redirect /api/* -> /api/v1/* (ataques, bytes crus)", () => {
  // Todos têm de cair no destino seguro, nunca fora da origem.
  const evil: Array<[string, string]> = [
    ["/api//evil.com", "protocol-relative"],
    ["/api/https://evil.com", "esquema absoluto"],
    ["/api/\\evil.com", "barra invertida"],
    ["/api/a:b", "separador de autoridade"],
    ["/api/a@b", "userinfo"],
    ["/api/%00leads", "null byte escapado"],
    ["/api/leads%09x", "tab escapada"],
    ["/api/leads%0d%0aX-Evil:%201", "CRLF escapado"],
    ["/api/<script>", "caracteres de markup"],
  ];

  it.each(evil)("neutraliza %s (%s)", async (entrada) => {
    const res = await rawGet(entrada);
    expect(res.status).toBe(301);
    expect(res.location).toBe("/api/v1/");
  });

  it("rejeita um espaco literal na request line (erro de protocolo, sem redirect)", async () => {
    const res = await rawGet("/api/leads q");
    expect(res.status).toBe(400);
    expect(res.location).toBeUndefined();
  });

  it("nunca injeta um segundo header via CRLF", async () => {
    const res = await rawGet("/api/leads%0d%0aX-Injected:%20sim");
    expect(res.raw.toLowerCase()).not.toContain("x-injected:");
  });

  it("mantem o destino dentro de /api/v1 em travessia de path", async () => {
    for (const p of ["/api/../..", "/api/%2e%2e/%2e%2e/x", "/api/a/b/../c", "/api/.."]) {
      const res = await rawGet(p);
      if (res.status === 301) {
        expect(res.location).toMatch(/^\/api\/v1(\/|$)/);
      }
    }
  });

  it("nunca produz Location com esquema ou authority externa", async () => {
    for (const p of ["/api//evil.com", "/api/https://evil.com", "/api/\\evil.com", "/api/a:b"]) {
      const res = await rawGet(p);
      const loc = res.location ?? "";
      expect(loc.startsWith("/api/v1")).toBe(true);
      expect(loc).not.toMatch(/^[a-z][a-z0-9+.-]*:/i);
      expect(loc.slice("/api/v1".length)).not.toContain("//");
    }
  });
});

describe("resolveAllowedOrigin", () => {
  const mk = (origin?: string) => ({ headers: origin ? { origin } : {} }) as never;

  it("reflete apenas origens da allowlist", () => {
    expect(resolveAllowedOrigin(mk("http://localhost:5173"))).toBe("http://localhost:5173");
    expect(resolveAllowedOrigin(mk("https://crm.exemplo.ao"))).toBe("https://crm.exemplo.ao");
  });

  it("rejeita origem fora da allowlist, incluindo prefixo enganador", () => {
    expect(resolveAllowedOrigin(mk("https://evil.example"))).toBeNull();
    expect(resolveAllowedOrigin(mk("http://localhost:5173.evil.com"))).toBeNull();
    expect(resolveAllowedOrigin(mk("http://localhost:5174"))).toBeNull();
  });

  it("rejeita ausencia de Origin", () => {
    expect(resolveAllowedOrigin(mk(undefined))).toBeNull();
  });

  it("nunca devolve wildcard", () => {
    for (const o of ["http://localhost:5173", "https://evil.example", "null"]) {
      expect(resolveAllowedOrigin(mk(o))).not.toBe("*");
    }
  });
});

describe("respostas da API nunca levam CORS wildcard", () => {
  it("nao devolve Access-Control-Allow-Origin: * sem Origin", async () => {
    const res = await request(app).get("/api/v1/leads");
    expect(res.status).toBe(401);
    expect(res.headers["access-control-allow-origin"]).not.toBe("*");
  });

  it("nao devolve Access-Control-Allow-Origin: * com origem nao permitida", async () => {
    const res = await request(app).get("/api/v1/leads").set("Origin", "https://evil.example");
    expect(res.headers["access-control-allow-origin"]).not.toBe("*");
  });

  it("nao devolve wildcard no preflight de origem nao permitida", async () => {
    const res = await request(app)
      .options("/api/v1/leads")
      .set("Origin", "https://evil.example")
      .set("Access-Control-Request-Method", "GET");
    expect(res.headers["access-control-allow-origin"] ?? "").not.toBe("*");
  });
});
