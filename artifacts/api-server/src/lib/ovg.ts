import { logger } from "./logger";

const OVG_API_URL = process.env.OVG_API_URL || "https://samorafitstudio.onvirtualgym.com";
const OVG_USERNAME = process.env.OVG_USERNAME || "";
const OVG_PASSWORD = process.env.OVG_PASSWORD || "";
const OVG_CLUB_CODE = process.env.OVG_CLUB_CODE || "LUA";

interface OVGToken {
  token: string;
  expiresAt: number;
}

export interface OVGMember {
  customer_number: number;
  name: string;
  status: string;
  sex: string;
  birth_date: string;
  entry_date: string;
  last_entry: string;
  job: string;
  nif: string;
  mobile_number: string;
  email: string;
  city: string;
  country: string;
  rfid_cod: string;
  unique_id: string;
  club_cod: string;
}

export interface OVGLead {
  lead_number: number;
  name: string;
  sex: string;
  birth_date: string;
  entry_date: string;
  job: string;
  nif: string;
  mobile_number: string;
  email: string;
  city: string;
  country: string;
  unique_id: string;
  club_cod: string;
  caption_lead_url: string;
}

interface OVGApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

class OVGClient {
  private token: OVGToken | null = null;
  private baseUrl: string;
  private username: string;
  private password: string;
  private clubCode: string;

  constructor() {
    this.baseUrl = OVG_API_URL;
    this.username = OVG_USERNAME;
    this.password = OVG_PASSWORD;
    this.clubCode = OVG_CLUB_CODE;
  }

  private async ensureToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now()) {
      return this.token.token;
    }
    return this.login();
  }

  async login(): Promise<string> {
    logger.info("OVG: A autenticar...");

    const response = await fetch(`${this.baseUrl}/APIControlAccess`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
      }),
    });

    const body = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      throw new Error((body.message as string) || `HTTP ${response.status}`);
    }

    const token = body.token as string || body.Token as string || body.access_token as string;
    if (!token) {
      throw new Error("OVG: Resposta sem token");
    }

    this.token = {
      token,
      expiresAt: Date.now() + 50 * 60 * 1000,
    };

    logger.info("OVG: Autenticação bem-sucedida");
    return this.token.token;
  }

  private async request<T>(
    path: string,
    options: RequestInit & { skipAuth?: boolean; retries?: number } = {},
  ): Promise<OVGApiResponse<T>> {
    const { skipAuth = false, retries = 3, ...fetchOptions } = options;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(fetchOptions.headers as Record<string, string> || {}),
    };

    if (!skipAuth) {
      const token = await this.ensureToken();
      headers["Authorization"] = `Bearer ${token}`;
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const url = `${this.baseUrl}${path}`;
        logger.debug({ url, attempt }, "OVG: Request");

        const response = await fetch(url, {
          ...fetchOptions,
          headers,
        });

        const text = await response.text();
        let body: Record<string, unknown>;
        try {
          body = JSON.parse(text) as Record<string, unknown>;
        } catch {
          body = { raw: text };
        }

        if (!response.ok) {
          if (response.status === 401 && attempt < retries) {
            logger.warn("OVG: Token expirado, a renovar...");
            this.token = null;
            continue;
          }

          return {
            success: false,
            error: (body.message as string) || (body.error as string) || `HTTP ${response.status}`,
          };
        }

        return { success: true, data: body as unknown as T };
      } catch (err) {
        lastError = err as Error;
        logger.warn({ err, attempt }, "OVG: Request falhou");

        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || "OVG: Máximo de tentativas excedido",
    };
  }

  async getMembers(): Promise<OVGApiResponse<OVGMember[]>> {
    const result = await this.request<{ success: number; clients_data: OVGMember[] }>(`/ListOfCustomersDataDetailed/${this.clubCode}`);
    if (result.success && result.data?.clients_data) {
      return { success: true, data: result.data.clients_data };
    }
    return { success: false, error: result.error || "Resposta sem dados" };
  }

  async getMember(customerNumber: string): Promise<OVGApiResponse<OVGMember>> {
    const result = await this.request<{ success: number; client_data: OVGMember }>(`/CustomerDataDetailed/${customerNumber}`);
    if (result.success && result.data?.client_data) {
      return { success: true, data: result.data.client_data };
    }
    return { success: false, error: result.error || "Membro não encontrado" };
  }

  async createOrUpdateMember(member: Partial<OVGMember>): Promise<OVGApiResponse<unknown>> {
    return this.request("/NewClient", {
      method: "POST",
      body: JSON.stringify({ ...member, club_cod: this.clubCode }),
    });
  }

  async updateMemberStatus(customerNumber: string, status: string): Promise<OVGApiResponse<unknown>> {
    return this.request("/UpdateClientStatus", {
      method: "POST",
      body: JSON.stringify({ customer_number: customerNumber, status, club_cod: this.clubCode }),
    });
  }

  async getLeads(): Promise<OVGApiResponse<OVGLead[]>> {
    return this.request(`/ListOfLeads/${this.clubCode}`);
  }

  async createOrUpdateLead(lead: Partial<OVGLead>): Promise<OVGApiResponse<unknown>> {
    return this.request("/NewLead", {
      method: "POST",
      body: JSON.stringify({ ...lead, club_cod: this.clubCode }),
    });
  }

  async registerAccess(customerNumber: string, entryDate: string, entryType: "entry" | "exit"): Promise<OVGApiResponse<unknown>> {
    return this.request("/NewClientAccess", {
      method: "POST",
      body: JSON.stringify({ customer_number: customerNumber, entry_date: entryDate, entry_type: entryType, club_cod: this.clubCode }),
    });
  }

  async checkHealth(): Promise<{ connected: boolean; message: string; details?: string }> {
    try {
      await this.login();
      return { connected: true, message: "Conexão OVG operacional" };
    } catch (err) {
      const error = err as Error;
      let details = "";
      if (error.message.includes("ENOTFOUND") || error.message.includes("resolve")) {
        details = `O URL ${this.baseUrl} não existe. Contacte o suporte OVG para obter o nome correcto do ginásio.`;
      }
      return { connected: false, message: error.message, details };
    }
  }
}

export const ovgClient = new OVGClient();
