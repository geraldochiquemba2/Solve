import crypto from "node:crypto";
import { logger } from "./logger";

// Credenciais do WhatsApp - configurar no .env
// Formatos suportados:
// - API Oficial Meta (Graph API): requiere Business Manager + Phone Number ID
// - BSPs (Business Solution Providers): 360dialog, Twilio, Wati, etc.
// - API Direta: alguns provedores oferecem endpoint direto

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || "https://graph.facebook.com/v17.0";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || "";
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY || ""; // Para BSPs/tailwind

class WhatsAppClient {
  private baseUrl: string;
  private token: string;
  private phoneNumberId: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = WHATSAPP_API_URL;
    this.token = WHATSAPP_TOKEN;
    this.phoneNumberId = WHATSAPP_PHONE_NUMBER_ID;
    this.apiKey = WHATSAPP_API_KEY;
  }

  // Enviar mensagem de texto simples
  async sendText(
    to: string,
    text: string,
    previewUrl?: boolean
  ): Promise<any> {
    const params = new URLSearchParams({
      messaging_product: "whatsapp",
      to,
      body: text,
      ...(previewUrl !== undefined && { preview_url: previewUrl.toString() }),
    });

    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    };

    return fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ messaging_product: "whatsapp", ...this._getMessageBody(text) }),
    });
  }

  // Enviar modelo/template message (requer aprovação)
  async sendTemplate(
    to: string,
    templateName: string,
    templateVariables: string[],
    languageCode: string = "pt_BR"
  ): Promise<any> {
    const params = new URLSearchParams({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template_name: templateName,
      language_code: languageCode,
    });

    // Adicionar variáveis do template
    templateVariables.forEach((variable, index) => {
      params.append(`template_variable_${index + 1}`, variable);
    });

    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    };

    return fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
        },
        components: [
          {
            type: "body",
            parameters: templateVariables.map((variable) => ({
              type: "text",
              text: variable,
            })),
          },
        ],
      }),
    });
  }

  // Obter status da mensagem
  async getMessageStatus(messageId: string): Promise<any> {
    const url = `${this.baseUrl}/${this.phoneNumberId}/messages/${messageId}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    };

    return fetch(url, { method: "GET", headers });
  }

  // Lista de mensagens recebidas
  async getMessages(
    status?: string,
    page?: number,
    limit?: number
  ): Promise<any> {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    if (page) params.append("page", page.toString());
    if (limit) params.append("limit", limit.toString());

    const url = `${this.baseUrl}/${this.phoneNumberId}/messages?${params.toString()}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    };

    return fetch(url, { method: "GET", headers });
  }

  private _getMessageBody(text: string) {
    // Retorna o corpo no formato esperado pelos diferentes provedores
    return {
      text,
    };
  }

  // Função para inicializar com credenciais reais
  configure(options: { token?: string; phoneNumberId?: string; apiKey?: string }) {
    if (options.token) this.token = options.token;
    if (options.phoneNumberId) this.phoneNumberId = options.phoneNumberId;
    if (options.apiKey) this.apiKey = options.apiKey;
  }
}

export class WhatsAppError extends Error {
  constructor(message: string, status?: number) {
    super(message);
    this.name = "WhatsAppError";
  }
}

// Singleton instance - será inicializado com config reais
export const whatsappClient = new WhatsAppClient();

// Types
export interface WhatsAppMessage {
  to: string;
  type: "text" | "template";
  text?: string;
  template_name?: string;
  template_variables?: string[];
  language_code?: string;
}

// Status da mensagem WhatsApp
export enum WhatsAppMessageStatus {
  PENDING = "pending",
  SENT = "sent",
  DELIVERED = "delivered",
  READ = "read",
  FAILED = "failed",
}

// Webhook event types
export enum WhatsAppWebhookEvent {
  MESSAGE = "message",
  STATUS = "status",
  CALL = "call",
  PROFILE_CHANGE = "profile_change",
}

// Webhook message types
export enum WhatsAppMessageType {
  TEXT = "text",
  IMAGE = "image",
  VIDEO = "video",
  AUDIO = "audio",
  DOCUMENT = "document",
  INTERACTIVE = "interactive",
}

// Webhook status types
export enum WhatsAppMessageStatusType {
  DEFAULT = "default",
  OPTED_IN = "opted_in",
  RECIPIENT_BLOCKED = "recipient_blocked",
  message_invalid = "message_invalid",
  message_failed = "message_failed",
}