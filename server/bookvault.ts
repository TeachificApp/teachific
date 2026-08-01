/**
 * BookVault API v3 helper
 * Docs: https://help.bookvault.app/api-setup
 *
 * All exported functions accept an optional `apiKey` parameter.
 * When provided, it takes precedence over the global env var.
 */
import { ENV } from "./_core/env";

const BASE_URL = "https://api.bookvault.app/v3";

export interface BookvaultCountry {
  ISO_Code: string;
}

export interface BookvaultAddress {
  Addressee: string;
  Company?: string;
  Address1: string;
  Address2?: string;
  Address3?: string;
  Town: string;
  County?: string;
  Postcode: string;
  Country: BookvaultCountry;
  TelNumber?: string;
  Email: string;
}

export interface BookvaultOrderLine {
  Quantity: number;
  ISBN?: string;
  TransientRequest?: Record<string, unknown>;
}

export interface BookvaultCreateOrderPayload {
  DocRef: string;
  CustomerRef?: string;
  Address: BookvaultAddress;
  ProductionLevel?: string;
  DispatchRequest?: {
    RequestedService?: string;
    /** Pin to a specific fulfillment partner (e.g. 1 = US hub). 0 = auto-select. */
    PartnerID?: number;
    /** Array of specific service IDs to restrict to. */
    RequestedServID?: number[];
  };
  OrderLines: BookvaultOrderLine[];
}

export interface BookvaultAccount {
  Name?: string;
  CompanyName?: string;
  Email?: string;
  [key: string]: unknown;
}

export interface BookvaultTitle {
  ISBN?: string;
  Title?: string;
  Subtitle?: string;
  Author?: string;
  [key: string]: unknown;
}

export interface BookvaultOrderResult {
  DocRef?: string;
  PodRef?: string;
  Status?: string;
  [key: string]: unknown;
}

/** Resolve the API key: org key takes precedence over env var */
function resolveApiKey(apiKey?: string | null): string {
  const raw = (apiKey ?? process.env.BOOKVAULT_API_KEY ?? ENV.bookvaultApiKey ?? "").trim();
  if (!raw) throw new Error("Bookvault API key is not configured for this organisation");
  return raw.startsWith("bv_") ? raw : `bv_${raw}`;
}

function authHeader(apiKey?: string | null): string {
  return `basic ${resolveApiKey(apiKey)}`;
}

export function isBookvaultConfigured(apiKey?: string | null): boolean {
  return Boolean((apiKey ?? process.env.BOOKVAULT_API_KEY ?? ENV.bookvaultApiKey ?? "").trim());
}

async function parseResponseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function extractError(body: unknown, status: number, path: string): string {
  if (typeof body === "string" && body.trim()) return body.trim();
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    const message =
      (typeof obj.message === "string" && obj.message) ||
      (typeof obj.Message === "string" && obj.Message) ||
      (typeof obj.error === "string" && obj.error) ||
      (typeof obj.Error === "string" && obj.Error);
    if (message) return message;
  }
  return `BookVault API error ${status} for ${path}`;
}

async function bookvaultFetch<T>(
  path: string,
  options: RequestInit = {},
  apiKey?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: authHeader(apiKey),
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const body = await parseResponseBody(res);

  if (!res.ok) {
    throw new Error(extractError(body, res.status, path));
  }
  if (typeof body === "string") {
    if (body.toLowerCase().includes("invalid token")) {
      throw new Error("Invalid BookVault API key");
    }
    throw new Error(body);
  }

  return body as T;
}

/** Verify API credentials by loading account details */
export async function testConnection(apiKey?: string | null): Promise<{ connected: true; account: BookvaultAccount }> {
  const account = await bookvaultFetch<BookvaultAccount>("/Account", {}, apiKey);
  return { connected: true, account };
}

/** List titles available on the BookVault account */
export async function listTitles(apiKey?: string | null): Promise<BookvaultTitle[]> {
  const result = await bookvaultFetch<BookvaultTitle[] | { Titles?: BookvaultTitle[] }>("/Titles", {}, apiKey);
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && Array.isArray(result.Titles)) {
    return result.Titles;
  }
  return [];
}

/** Look up a single title by ISBN */
export async function getTitleByIsbn(isbn: string, apiKey?: string | null): Promise<BookvaultTitle | null> {
  const normalized = isbn.replace(/[^0-9X]/gi, "");
  try {
    const result = await bookvaultFetch<BookvaultTitle>(
      `/Title?ISBN=${encodeURIComponent(normalized)}`,
      {},
      apiKey,
    );
    return result ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not found|404/i.test(message)) return null;
    throw err;
  }
}

/** Submit a print order to BookVault */
export async function createOrder(payload: BookvaultCreateOrderPayload, apiKey?: string | null): Promise<BookvaultOrderResult> {
  const body: BookvaultCreateOrderPayload = {
    ...payload,
    ProductionLevel: payload.ProductionLevel ?? ENV.bookvaultProductionLevel,
    DispatchRequest: payload.DispatchRequest ?? {
      RequestedService: ENV.bookvaultDispatchService,
    },
  };

  return bookvaultFetch<BookvaultOrderResult>("/Order", {
    method: "POST",
    body: JSON.stringify(body),
  }, apiKey);
}

/** Fetch an existing order by our DocRef or BookVault PodRef */
export async function getOrder(params: { docRef?: string; podRef?: string }, apiKey?: string | null): Promise<BookvaultOrderResult | null> {
  const search = new URLSearchParams();
  if (params.docRef) search.set("DocRef", params.docRef);
  if (params.podRef) search.set("PodRef", params.podRef);
  if (!search.toString()) throw new Error("docRef or podRef is required");

  try {
    return await bookvaultFetch<BookvaultOrderResult>(`/Order?${search.toString()}`, {}, apiKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not found|404/i.test(message)) return null;
    throw err;
  }
}

export function buildDocRef(orderId: number): string {
  return `teachific-ppo-${orderId}`;
}

export function normalizeIsbn(isbn: string | null | undefined): string {
  return (isbn ?? "").replace(/[^0-9X]/gi, "");
}
