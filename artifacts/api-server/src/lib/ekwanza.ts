import crypto from "node:crypto";
import { logger } from "./logger";

const EKWANZA_API_URL = process.env.EKWANZA_API_URL || "https://gwy-api-tst.appypay.co.ao/v2.0";
const EKWANZA_AUTH_URL = process.env.EKWANZA_AUTH_URL || "https://login.microsoftonline.com/auth.appypay.co.ao/oauth2/token";
const EKWANZA_CLIENT_ID = process.env.EKWANZA_CLIENT_ID || "";
const EKWANZA_CLIENT_SECRET = process.env.EKWANZA_CLIENT_SECRET || "";
const EKWANZA_RESOURCE = process.env.EKWANZA_RESOURCE || "";
const EKWANZA_NOTIFICATION_TOKEN = process.env.EKWANZA_NOTIFICATION_TOKEN || "";
const EKWANZA_API_KEY = process.env.EKWANZA_API_KEY || "";
const EKWANZA_MERCHANT_ID = process.env.EKWANZA_MERCHANT_ID || "";
const EKWANZA_ACCOUNT_NUMBER = process.env.EKWANZA_ACCOUNT_NUMBER || "";
const EKWANZA_MERCHANT_REGISTER_NUMBER = process.env.EKWANZA_MERCHANT_REGISTER_NUMBER || "";
const EKWANZA_GPO_PAYMENT_METHOD = process.env.EKWANZA_GPO_PAYMENT_METHOD || "";
const EKWANZA_REF_PAYMENT_METHOD = process.env.EKWANZA_REF_PAYMENT_METHOD || "";

class EkwanzaClient {
  private baseUrl: string;
  private notificationToken: string;
  private apiKey: string;
  private merchantId: string;
  private accountNumber: string;
  private merchantRegisterNumber: string;
  private gpoPaymentMethod: string;
  private refPaymentMethod: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.baseUrl = EKWANZA_API_URL;
    this.notificationToken = EKWANZA_NOTIFICATION_TOKEN;
    this.apiKey = EKWANZA_API_KEY;
    this.merchantId = EKWANZA_MERCHANT_ID;
    this.accountNumber = EKWANZA_ACCOUNT_NUMBER;
    this.merchantRegisterNumber = EKWANZA_MERCHANT_REGISTER_NUMBER;
    this.gpoPaymentMethod = EKWANZA_GPO_PAYMENT_METHOD;
    this.refPaymentMethod = EKWANZA_REF_PAYMENT_METHOD;
  }

  // OAuth2 Token Exchange for GPO charges
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: EKWANZA_CLIENT_ID,
      client_secret: EKWANZA_CLIENT_SECRET,
      resource: EKWANZA_RESOURCE,
    });

    const response = await fetch(EKWANZA_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ status: response.status, error }, "É-kwanza OAuth2 token error");
      throw new EkwanzaError("Failed to get access token", response.status, error);
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this.accessToken;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      ...((options.headers as Record<string, string>) || {}),
    };

    logger.debug({ url, method: options.method || "GET" }, "É-kwanza API request");

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error({ status: response.status, body: errorBody }, "É-kwanza API error");
      throw new EkwanzaError(`É-kwanza API error: ${response.status}`, response.status, errorBody);
    }

    return response.json() as Promise<T>;
  }

  private async requestWithAuth<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken();
    return this.request<T>(path, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  }

  generateSignature(fields: string[], apiKey: string): string {
    const data = fields.join("");
    return crypto.createHmac("sha256", apiKey).update(data).digest("hex");
  }

  verifySignature(fields: string[], apiKey: string, expectedSignature: string): boolean {
    const computed = this.generateSignature(fields, apiKey);
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(expectedSignature));
  }

  // Ticket API (using notification token)
  async createPaymentCode(amount: number, referenceCode: string, mobileNumber: string): Promise<CreatePaymentCodeResponse> {
    const params = new URLSearchParams({
      amount: String(amount),
      referenceCode,
      mobileNumber,
    });
    return this.request<CreatePaymentCodeResponse>(
      `/ticket/${this.notificationToken}?${params.toString()}`,
      { method: "POST" },
    );
  }

  async getPaymentStatus(ticketCode: string): Promise<PaymentStatusResponse> {
    return this.request<PaymentStatusResponse>(`/ticket/${this.notificationToken}/${ticketCode}`);
  }

  // Send to Customer (eMoney wallet)
  async sendToCustomer(mobileNumber: string, amount: number, operationCode: string): Promise<SendToCustomerResponse> {
    const timestamp = new Date().toISOString();
    const signature = this.generateSignature(
      [timestamp, mobileNumber, this.notificationToken, operationCode],
      this.apiKey,
    );
    return this.request<SendToCustomerResponse>("/Operations/SendToCustomer", {
      method: "POST",
      body: JSON.stringify({
        data: { mobileNumber, token: this.notificationToken, amount, operationCode },
        meta: { timestamp, signature },
      }),
    });
  }

  // Send via KWiK (IBAN)
  async sendKWiKToCustomer(iban: string, amount: number, operationCode: string): Promise<SendToCustomerResponse> {
    const timestamp = new Date().toISOString();
    const signature = this.generateSignature(
      [timestamp, iban, this.notificationToken, operationCode],
      this.apiKey,
    );
    return this.request<SendToCustomerResponse>("/Operations/SendKWiKToCustomer", {
      method: "POST",
      body: JSON.stringify({
        data: { iban, token: this.notificationToken, amount, operationCode },
        meta: { timestamp, signature },
      }),
    });
  }

  async getKWiKStatus(externalReferenceId: string): Promise<KWiKStatusResponse> {
    return this.request<KWiKStatusResponse>(
      `/Operations/SendKWiKToCustomerStatus?externalReferenceId=${externalReferenceId}`,
    );
  }

  // GPO Charges (Multicaixa Express / EMIS)
  async createGPOCharge(amount: number, description: string, merchantTransactionId: string, phoneNumber?: string): Promise<GPOChargeResponse> {
    const paymentMethod = phoneNumber
      ? `GPO_${this.gpoPaymentMethod}`
      : `REF_${this.refPaymentMethod}`;
    const callbackUrl = process.env.EKWANZA_CALLBACK_URL || "";
    const body: Record<string, unknown> = {
      amount,
      currency: "AOA",
      description,
      merchantTransactionId,
      paymentMethod,
      notificationUrl: callbackUrl,
      options: {
        MerchantIdentifier: this.accountNumber,
        ApiKey: this.apiKey,
      },
    };
    if (phoneNumber) {
      body.paymentInfo = { phoneNumber };
    }

    const gpoUrl = process.env.EKWANZA_GPO_URL || "https://gwy-api-tst.appypay.co.ao/v2.0";
    const token = await this.getAccessToken();
    const url = `${gpoUrl}/charges`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Authorization: `Bearer ${token}`,
    };

    logger.debug({ url, method: "POST" }, "É-kwanza GPO charge request");

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as GPOChargeResponse;
    if (!response.ok) {
      logger.error({ status: response.status, body: data }, "É-kwanza GPO error");
      throw new EkwanzaError(`É-kwanza GPO error: ${response.status}`, response.status, JSON.stringify(data));
    }

    return data;
  }

  verifyCallback(body: CallbackPayload): boolean {
    const { merchantTransactionId, ekwanzaTransactionId, operationStatus } = body;
    // Basic validation - in production, verify signature from headers
    if (!merchantTransactionId || !ekwanzaTransactionId) {
      return false;
    }
    return true;
  }
}

export class EkwanzaError extends Error {
  status: number;
  body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "EkwanzaError";
    this.status = status;
    this.body = body;
  }
}

export interface CreatePaymentCodeResponse { Code: string; QRCode: string; Status: number; ExpirationDate?: string; }
export interface PaymentStatusResponse { Amount: string; Code: string; CreationDate: string; ExpirationDate: string; Status: number; }
export interface SendToCustomerResponse { ekzOperationCode: string; ekzTransactionCode: string; status: number; }
export interface KWiKStatusResponse { ekzOperationCode: string; ekzTransactionCode: string; status: number; OperationStatus: string; }
export interface GPOChargeResponse { id: string; status: string; [key: string]: unknown; }
export interface CallbackPayload { merchantTransactionId: string; ekwanzaTransactionId: number; operationStatus: number; operationData: { amount: number; merchantIdentifier: string; referenceType: string; }; }

export const ekwanzaClient = new EkwanzaClient();
