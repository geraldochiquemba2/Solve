import { logger } from "./logger";

const CADEMI_API_URL = process.env.CADEMI_API_URL || "";
const CADEMI_API_KEY = process.env.CADEMI_API_KEY || "";

export interface CademiUser {
  id: number;
  nome: string;
  email: string;
  doc: string;
  celular: string | null;
  login_auto: string;
  gratis: boolean;
  criado_em: string;
  ultimo_acesso_em: string | null;
}

export interface CademiProduct {
  id: number;
  ordem: number;
  nome: string;
  vitrine?: { id: number; nome: string };
}

export interface CademiAccess {
  produto: { id: number; nome: string; oferta_url: string | null };
  duracao: string | null;
  duracao_tipo: string;
  comecou_em: string;
  encerra_em: string | null;
  encerrado: boolean;
}

export interface CademiTag {
  id: number;
  nome: string;
}

interface CademiApiResponse<T> {
  success: boolean;
  code?: number;
  data?: T;
  error?: string;
  msg?: string;
}

class CademiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = CADEMI_API_URL.replace(/\/$/, "");
    this.apiKey = CADEMI_API_KEY;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<CademiApiResponse<T>> {
    if (!this.baseUrl || !this.apiKey) {
      return { success: false, error: "Cademi não configurado. Configure CADEMI_API_URL e CADEMI_API_KEY no .env" };
    }

    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = (await response.json()) as CademiApiResponse<T>;

      if (!response.ok) {
        return { success: false, error: data.msg || `HTTP ${response.status}` };
      }

      return data;
    } catch (err) {
      logger.error({ err, path }, "Cademi: Request falhou");
      return { success: false, error: (err as Error).message };
    }
  }

  async isConfigured(): Promise<boolean> {
    return !!(this.baseUrl && this.apiKey);
  }

  async healthCheck(): Promise<{ connected: boolean; message: string }> {
    try {
      if (!this.baseUrl || !this.apiKey) {
        return { connected: false, message: "Cademi não configurado. Configure CADEMI_API_URL e CADEMI_API_KEY no .env" };
      }
      const result = await this.request<{ produto: CademiProduct[] }>("GET", "/api/v1/produto");
      if (result.success) {
        return { connected: true, message: "Conexão Cademi operacional" };
      }
      return { connected: false, message: result.error || "Erro ao conectar Cademi" };
    } catch (err) {
      return { connected: false, message: (err as Error).message };
    }
  }

  async getUsers(): Promise<CademiApiResponse<{ usuario: CademiUser[] }>> {
    return this.request("GET", "/api/v1/usuario");
  }

  async getUser(identifier: string): Promise<CademiApiResponse<{ usuario: CademiUser }>> {
    return this.request("GET", `/api/v1/usuario/${identifier}`);
  }

  async updateUser(id: number, data: { nome?: string; email?: string; doc?: string; celular?: string }): Promise<CademiApiResponse<{ usuario: CademiUser }>> {
    return this.request("POST", `/api/v1/usuario/update/${id}`, data);
  }

  async deleteUser(identifier: string): Promise<CademiApiResponse<unknown>> {
    return this.request("DELETE", `/api/v1/usuario/${identifier}`);
  }

  async getUserAccess(identifier: string): Promise<CademiApiResponse<{ usuario: CademiUser; acesso: CademiAccess[] }>> {
    return this.request("GET", `/api/v1/usuario/acesso/${identifier}`);
  }

  async getUserProgress(identifier: string, produtoId: number): Promise<CademiApiResponse<{ progresso: unknown }>> {
    return this.request("GET", `/api/v1/usuario/progresso_por_produto/${identifier}/${produtoId}`);
  }

  async getUsersByTag(tagId: number): Promise<CademiApiResponse<{ usuario: CademiUser[] }>> {
    return this.request("GET", `/api/v1/usuario/lista_por_tag/${tagId}`);
  }

  async addTag(usuarioId: number, tagId: number): Promise<CademiApiResponse<unknown>> {
    return this.request("POST", "/api/v1/usuario/adicionar_tag", { usuario_id: usuarioId, tag_id: tagId });
  }

  async removeTag(usuarioId: number, tagId: number): Promise<CademiApiResponse<unknown>> {
    return this.request("POST", "/api/v1/usuario/remover_tag", { usuario_id: usuarioId, tag_id: tagId });
  }

  async getProducts(): Promise<CademiApiResponse<{ produto: CademiProduct[] }>> {
    return this.request("GET", "/api/v1/produto");
  }

  async getProduct(id: number): Promise<CademiApiResponse<{ produto: CademiProduct }>> {
    return this.request("GET", `/api/v1/produto/${id}`);
  }

  async sendDelivery(payload: unknown): Promise<CademiApiResponse<unknown>> {
    return this.request("POST", "/api/v1/entrega/enviar", payload);
  }
}

export const cademi = new CademiClient();
