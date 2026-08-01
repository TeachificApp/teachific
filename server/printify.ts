/**
 * Printify API v1 helper
 * Docs: https://developers.printify.com/
 *
 * All exported functions accept an optional `apiKey` parameter.
 * When provided, it takes precedence over the global env var.
 */
import { ENV } from "./_core/env";

const BASE_URL = "https://api.printify.com/v1";
const USER_AGENT = process.env.PRINTIFY_USER_AGENT ?? "Teachific/1.0";

export interface PrintifyShop {
  id: number;
  title: string;
  sales_channel: string;
}

export interface PrintifyVariant {
  id: number;
  sku: string | null;
  price: number;
  is_enabled: boolean;
  title: string;
}

export interface PrintifyProductSummary {
  id: string;
  title: string;
  description: string;
  tags: string[];
  imageUrl: string | null;
  visible: boolean;
  shopId: number;
  variantCount: number;
  defaultVariantId: number | null;
  priceCents: number | null;
}

export interface PrintifyProductDetail extends PrintifyProductSummary {
  variants: PrintifyVariant[];
}

export interface PrintifyOrderAddress {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  address1: string;
  address2?: string;
  city: string;
  zip: string;
}

export interface PrintifyCreateOrderPayload {
  external_id: string;
  line_items: Array<{
    product_id: string;
    variant_id: number;
    quantity: number;
  }>;
  shipping_method: number;
  address_to: PrintifyOrderAddress;
  send_shipping_notification?: boolean;
}

export interface PrintifyOrderResult {
  id: string;
  status?: string;
  external_id?: string;
}

interface PaginatedResponse<T> {
  current_page: number;
  last_page?: number;
  per_page?: number;
  total?: number;
  data: T[];
  next_page_url?: string | null;
}

/** Resolve the API token: org key takes precedence over env var */
function resolveToken(apiKey?: string | null): string {
  const token = (apiKey ?? process.env.PRINTIFY_API_TOKEN ?? ENV.printifyApiToken ?? "").trim();
  if (!token) throw new Error("Printify API key is not configured for this organisation");
  return token;
}

export function isPrintifyConfigured(apiKey?: string | null): boolean {
  return Boolean((apiKey ?? process.env.PRINTIFY_API_TOKEN ?? ENV.printifyApiToken ?? "").trim());
}

export function getDefaultPrintifyShopId(): number | null {
  const raw = (process.env.PRINTIFY_DEFAULT_SHOP_ID ?? ENV.printifyDefaultShopId ?? "").trim();
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) ? id : null;
}

async function printifyFetch<T>(path: string, options: RequestInit = {}, apiKey?: string | null): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${resolveToken(apiKey)}`,
    "User-Agent": USER_AGENT,
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "error" in body && String((body as { error: unknown }).error)) ||
      (body && typeof body === "object" && "message" in body && String((body as { message: unknown }).message)) ||
      (typeof body === "string" ? body : `Printify API error ${res.status} for ${path}`);
    throw new Error(message);
  }

  return body as T;
}

export async function listShops(apiKey?: string | null): Promise<PrintifyShop[]> {
  const result = await printifyFetch<PrintifyShop[] | PaginatedResponse<PrintifyShop>>("/shops.json", {}, apiKey);
  if (Array.isArray(result)) return result;
  return result.data ?? [];
}

export async function testConnection(apiKey?: string | null): Promise<{ shops: PrintifyShop[] }> {
  const shops = await listShops(apiKey);
  return { shops };
}

function mapProductSummary(shopId: number, raw: Record<string, unknown>): PrintifyProductSummary {
  const variants = (raw.variants as PrintifyVariant[] | undefined) ?? [];
  const enabled = variants.filter((v) => v.is_enabled);
  const defaultVariant = enabled[0] ?? variants[0] ?? null;
  const images = (raw.images as Array<{ src?: string; is_default?: boolean }> | undefined) ?? [];
  const defaultImage = images.find((i) => i.is_default) ?? images[0];

  return {
    id: String(raw.id),
    title: String(raw.title ?? "Untitled"),
    description: String(raw.description ?? ""),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    imageUrl: defaultImage?.src ?? null,
    visible: Boolean(raw.visible),
    shopId,
    variantCount: variants.length,
    defaultVariantId: defaultVariant?.id ?? null,
    priceCents: defaultVariant?.price ?? null,
  };
}

export async function listProducts(
  shopId: number,
  page = 1,
  limit = 50,
  apiKey?: string | null,
): Promise<{ products: PrintifyProductSummary[]; currentPage: number; lastPage: number; total: number }> {
  const result = await printifyFetch<PaginatedResponse<Record<string, unknown>>>(
    `/shops/${shopId}/products.json?page=${page}&limit=${limit}`,
    {},
    apiKey,
  );
  const products = (result.data ?? []).map((p) => mapProductSummary(shopId, p));
  return {
    products,
    currentPage: result.current_page ?? page,
    lastPage: result.last_page ?? page,
    total: result.total ?? products.length,
  };
}

export async function getProduct(shopId: number, productId: string, apiKey?: string | null): Promise<PrintifyProductDetail | null> {
  try {
    const raw = await printifyFetch<Record<string, unknown>>(
      `/shops/${shopId}/products/${productId}.json`,
      {},
      apiKey,
    );
    const summary = mapProductSummary(shopId, raw);
    return {
      ...summary,
      variants: (raw.variants as PrintifyVariant[] | undefined) ?? [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not found|404/i.test(message)) return null;
    throw err;
  }
}

export async function createOrder(
  shopId: number,
  payload: PrintifyCreateOrderPayload,
  apiKey?: string | null,
): Promise<PrintifyOrderResult> {
  return printifyFetch<PrintifyOrderResult>(`/shops/${shopId}/orders.json`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, apiKey);
}

export async function getOrder(shopId: number, orderId: string, apiKey?: string | null): Promise<Record<string, unknown>> {
  return printifyFetch<Record<string, unknown>>(`/shops/${shopId}/orders/${orderId}.json`, {}, apiKey);
}

export async function listOrders(
  shopId: number,
  page = 1,
  limit = 20,
  apiKey?: string | null,
): Promise<PaginatedResponse<Record<string, unknown>>> {
  return printifyFetch<PaginatedResponse<Record<string, unknown>>>(
    `/shops/${shopId}/orders.json?page=${page}&limit=${limit}`,
    {},
    apiKey,
  );
}

export function splitFullName(name: string | null | undefined): { first: string; last: string } {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return { first: "Customer", last: "." };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first: parts[0]!, last: "." };
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}
