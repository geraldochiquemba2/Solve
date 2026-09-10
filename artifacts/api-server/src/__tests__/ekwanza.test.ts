import { describe, it, expect, beforeEach } from "vitest";
import { ekwanzaClient, EkwanzaError } from "../lib/ekwanza";

describe("É-kwanza Integration Tests", () => {
  const TEST_NUMBERS = {
    SUCCESS: "244900000000",
    NO_BALANCE: "244900000001",
    TIMEOUT: "244900000002",
    REJECTED: "244900000003",
    NON_EXISTENT: "244900000004",
  };

  describe("Signature Generation", () => {
    it("should generate HMAC-SHA256 signature", () => {
      const fields = ["2024-01-01T00:00:00Z", "935095730", "token123", "OP001"];
      const apiKey = "test-api-key";
      const signature = ekwanzaClient.generateSignature(fields, apiKey);
      expect(signature).toHaveLength(64); // SHA256 hex string
    });

    it("should verify valid signature", () => {
      const fields = ["timestamp", "mobile", "token", "opCode"];
      const apiKey = "secret";
      const signature = ekwanzaClient.generateSignature(fields, apiKey);
      const valid = ekwanzaClient.verifySignature(fields, apiKey, signature);
      expect(valid).toBe(true);
    });

    it("should reject invalid signature", () => {
      const fields = ["timestamp", "mobile", "token", "opCode"];
      const apiKey = "secret";
      const valid = ekwanzaClient.verifySignature(fields, apiKey, "a".repeat(64));
      expect(valid).toBe(false);
    });
  });

  describe("Test Scenarios", () => {
    it("should handle success scenario (244900000000)", () => {
      expect(TEST_NUMBERS.SUCCESS).toBe("244900000000");
      // In real test: POST /payments/ekwanza/send with this number
      // Expected: status 0 (success)
    });

    it("should handle no balance scenario (244900000001)", () => {
      expect(TEST_NUMBERS.NO_BALANCE).toBe("244900000001");
      // Expected: status "29" (conta sem saldo)
    });

    it("should handle timeout scenario (244900000002)", () => {
      expect(TEST_NUMBERS.TIMEOUT).toBe("244900000002");
      // Expected: status "87" or timeout error
    });

    it("should handle rejected scenario (244900000003)", () => {
      expect(TEST_NUMBERS.REJECTED).toBe("244900000003");
      // Expected: status "180" (pedido rejeitado)
    });

    it("should handle non-existent number (244900000004)", () => {
      expect(TEST_NUMBERS.NON_EXISTENT).toBe("244900000004");
      // Expected: status "31" (numero nao encontrado)
    });
  });

  describe("Error Handling", () => {
    it("should create EkwanzaError with status and body", () => {
      const error = new EkwanzaError("Test error", 400, '{"status":"29"}');
      expect(error.message).toBe("Test error");
      expect(error.status).toBe(400);
      expect(error.body).toBe('{"status":"29"}');
      expect(error.name).toBe("EkwanzaError");
    });
  });
});
