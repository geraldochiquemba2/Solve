import crypto from "crypto";

const CONFIRMED = new Set(["accepted", "success", "successful", "paid", "completed"]);
const REJECTED = new Set(["rejected", "failed", "fail", "cancelled", "canceled", "expired", "error"]);

export function mapWipayStatus(status) {
  const v = String(status ?? "").trim().toLowerCase();
  if (CONFIRMED.has(v)) return "confirmado";
  if (REJECTED.has(v)) return "rejeitado";
  return null;
}

export function verifyWipaySignature(rawBody, signature, token) {
  if (!rawBody || !signature || !token) return false;
  const expected = crypto.createHmac("sha256", token).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(signature), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
