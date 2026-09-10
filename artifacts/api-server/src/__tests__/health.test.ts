import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

describe("GET /healthz", () => {
  it("should return 200 with status ok", async () => {
    const res = await request(app).get("/healthz");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
  });
});

describe("GET /api/v1/healthz", () => {
  it("should return 200 with status ok", async () => {
    const res = await request(app).get("/api/v1/healthz");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
  });
});

describe("GET /nonexistent", () => {
  it("should return 404 for unknown routes", async () => {
    const res = await request(app).get("/nonexistent");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });
});
