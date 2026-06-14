/**
 * Kajabi API helper
 * Kajabi uses a REST API with Bearer token authentication.
 * Docs: https://developers.kajabi.com/
 */

export interface KajabiMember {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  avatar_url?: string;
}

export interface KajabiProduct {
  id: number;
  title: string;
  description?: string;
  thumbnail_url?: string;
  published: boolean;
  created_at: string;
  updated_at: string;
  price?: number;
  slug?: string;
}

export interface KajabiMembership {
  id: number;
  member_id: number;
  product_id: number;
  created_at: string;
  updated_at: string;
  state: string; // "active" | "inactive" | "expired"
}

export interface KajabiOffer {
  id: number;
  title: string;
  price?: number;
  created_at: string;
}

function kajabiHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function kajabiFetch(
  apiKey: string,
  path: string
): Promise<Response> {
  const url = `https://app.kajabi.com/api/v1${path}`;
  const res = await fetch(url, { headers: kajabiHeaders(apiKey) });
  return res;
}

/**
 * Fetch all pages of a paginated Kajabi endpoint.
 * Kajabi uses cursor-based pagination with `page[number]` and `page[size]`.
 */
async function fetchAllPages<T>(
  apiKey: string,
  path: string,
  dataKey: string,
  pageSize = 50
): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const separator = path.includes("?") ? "&" : "?";
    const url = `${path}${separator}page[number]=${page}&page[size]=${pageSize}`;
    const res = await kajabiFetch(apiKey, url);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Kajabi API error ${res.status}: ${text}`);
    }

    const json = await res.json() as Record<string, unknown>;
    const items = (json[dataKey] as T[]) ?? [];
    results.push(...items);

    // Check if there are more pages via meta
    const meta = json.meta as { total_count?: number; page?: number; per_page?: number } | undefined;
    if (meta && meta.total_count !== undefined) {
      const totalFetched = page * pageSize;
      hasMore = totalFetched < meta.total_count;
    } else {
      hasMore = items.length === pageSize;
    }
    page++;
  }

  return results;
}

export function createKajabiClient(apiKey: string) {
  return {
    /**
     * Validate the API key by fetching the site info.
     * Returns school name on success, throws on failure.
     */
    async validateAndGetSite(): Promise<{ schoolName: string }> {
      const res = await kajabiFetch(apiKey, "/site");
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Invalid Kajabi API key (${res.status}): ${text}`);
      }
      const json = await res.json() as { site?: { title?: string; name?: string } };
      const schoolName = json.site?.title ?? json.site?.name ?? "Kajabi School";
      return { schoolName };
    },

    /** Fetch all members (users) from Kajabi */
    async getAllMembers(): Promise<KajabiMember[]> {
      return fetchAllPages<KajabiMember>(apiKey, "/members", "members");
    },

    /** Fetch all products (courses/content) from Kajabi */
    async getAllProducts(): Promise<KajabiProduct[]> {
      return fetchAllPages<KajabiProduct>(apiKey, "/products", "products");
    },

    /** Fetch all memberships (product access grants) from Kajabi */
    async getAllMemberships(): Promise<KajabiMembership[]> {
      return fetchAllPages<KajabiMembership>(apiKey, "/memberships", "memberships");
    },

    /** Fetch all offers from Kajabi */
    async getAllOffers(): Promise<KajabiOffer[]> {
      return fetchAllPages<KajabiOffer>(apiKey, "/offers", "offers");
    },
  };
}
