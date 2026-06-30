// Central API client — all server-side fetches go through here

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store"
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${path} → ${res.status}: ${body}`);
  }
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type Celebrity = {
  id: string;
  name: string;
  industry: string;
  bio: string;
  profileImage: string;
  bannerImage: string;
  styleTags: string[];
};

export type Outfit = {
  id: string;
  celebrityId: string;
  celebrityName: string;
  movieName: string;
  occasion: string;
  category: string;
  colorPalette: string;
  price: number;
  imageUrl: string;
  images?: string[];
  description: string;
  year?: number;
  characterName?: string;
  manufacturerIds?: string[];
};

export type Manufacturer = {
  id: string;
  name: string;
  location: string;
  rating: number;
  contactEmail: string;
  verified: boolean;
  specialties: string[];
};

export type OrderStatus = "placed" | "production started" | "shipped" | "delivered";
export type PaymentStatus = "pending" | "paid";

export type OrderItem = {
  outfitId: string;
  outfitName: string;
  celebrityId: string;
  celebrityName: string;
  category: string;
  price: number;
  size: string;
  imageUrl: string;
  manufacturerIds: string[];
};

export type Order = {
  id: string;
  customerName: string;
  customerEmail: string;
  address: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  status: OrderStatus;
  commission: {
    platformFee: number;
    celebrityCommission: number;
    manufacturerShare: number;
  };
  routing: Array<{
    outfitId: string;
    manufacturerId: string | null;
    manufacturerName: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type Storefront = {
  celebrityId: string;
  displayName: string;
  bannerImage: string;
  featuredOutfitIds: string[];
  message: string;
  verified: boolean;
};

export type CommissionSummary = {
  orders: number;
  gross: number;
  platformFee: number;
  celebrityCommission: number;
  manufacturerShare: number;
  paid: number;
};

// ─── Celebrities ──────────────────────────────────────────────────────────────

export async function getCelebrities(params?: { industry?: string; search?: string }): Promise<Celebrity[]> {
  const qs = new URLSearchParams();
  if (params?.industry) qs.set("industry", params.industry);
  if (params?.search) qs.set("search", params.search);
  const query = qs.toString() ? `?${qs}` : "";
  const res = await apiFetch<{ data: Celebrity[] }>(`/api/celebrities${query}`);
  return res.data;
}

export async function getCelebrity(id: string): Promise<Celebrity | null> {
  try {
    const res = await apiFetch<{ data: Celebrity }>(`/api/celebrities/${id}`);
    return res.data;
  } catch {
    return null;
  }
}

export async function createCelebrity(body: Omit<Celebrity, "id">): Promise<Celebrity> {
  const res = await apiFetch<{ data: Celebrity }>("/api/celebrities", { method: "POST", body: JSON.stringify(body) });
  return res.data;
}

export async function updateCelebrity(id: string, body: Partial<Celebrity>): Promise<Celebrity> {
  const res = await apiFetch<{ data: Celebrity }>(`/api/celebrities/${id}`, { method: "PUT", body: JSON.stringify(body) });
  return res.data;
}

export async function deleteCelebrity(id: string): Promise<void> {
  await apiFetch(`/api/celebrities/${id}`, { method: "DELETE" });
}

// ─── Outfits ──────────────────────────────────────────────────────────────────

export async function getOutfits(params?: {
  celebrityId?: string;
  occasion?: string;
  category?: string;
  search?: string;
  year?: string;
}): Promise<Outfit[]> {
  const qs = new URLSearchParams();
  if (params?.celebrityId) qs.set("celebrityId", params.celebrityId);
  if (params?.occasion) qs.set("occasion", params.occasion);
  if (params?.category) qs.set("category", params.category);
  if (params?.search) qs.set("search", params.search);
  if (params?.year) qs.set("year", params.year);
  const query = qs.toString() ? `?${qs}` : "";
  const res = await apiFetch<{ data: Outfit[] }>(`/api/outfits${query}`);
  return res.data;
}

export async function getOutfit(id: string): Promise<Outfit | null> {
  try {
    const res = await apiFetch<{ data: Outfit }>(`/api/outfits/${id}`);
    return res.data;
  } catch {
    return null;
  }
}

export async function createOutfit(body: Omit<Outfit, "id" | "celebrityName">): Promise<Outfit> {
  const res = await apiFetch<{ data: Outfit }>("/api/outfits", { method: "POST", body: JSON.stringify(body) });
  return res.data;
}

export async function updateOutfit(id: string, body: Partial<Outfit>): Promise<Outfit> {
  const res = await apiFetch<{ data: Outfit }>(`/api/outfits/${id}`, { method: "PUT", body: JSON.stringify(body) });
  return res.data;
}

export async function deleteOutfit(id: string): Promise<void> {
  await apiFetch(`/api/outfits/${id}`, { method: "DELETE" });
}

// ─── Manufacturers ────────────────────────────────────────────────────────────

export async function getManufacturers(): Promise<Manufacturer[]> {
  const res = await apiFetch<{ data: Manufacturer[] }>("/api/manufacturers");
  return res.data;
}

export async function createManufacturer(body: Omit<Manufacturer, "id">): Promise<Manufacturer> {
  const res = await apiFetch<{ data: Manufacturer }>("/api/manufacturers", { method: "POST", body: JSON.stringify(body) });
  return res.data;
}

export async function updateManufacturer(id: string, body: Partial<Manufacturer>): Promise<Manufacturer> {
  const res = await apiFetch<{ data: Manufacturer }>(`/api/manufacturers/${id}`, { method: "PUT", body: JSON.stringify(body) });
  return res.data;
}

export async function deleteManufacturer(id: string): Promise<void> {
  await apiFetch(`/api/manufacturers/${id}`, { method: "DELETE" });
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export async function getOrders(): Promise<Order[]> {
  const res = await apiFetch<{ data: Order[] }>("/api/orders");
  return res.data;
}

export async function getOrder(id: string): Promise<Order | null> {
  try {
    const res = await apiFetch<{ data: Order }>(`/api/orders/${id}`);
    return res.data;
  } catch {
    return null;
  }
}

export async function createOrder(body: {
  customerName: string;
  customerEmail: string;
  address: string;
  paymentMethod?: string;
  items: Array<{
    outfitId: string;
    outfitName: string;
    celebrityId: string;
    celebrityName: string;
    category: string;
    price: number;
    size: string;
    imageUrl: string;
    manufacturerIds: string[];
  }>;
}): Promise<Order> {
  const res = await apiFetch<{ data: Order }>("/api/orders", { method: "POST", body: JSON.stringify(body) });
  return res.data;
}

export async function payOrder(id: string): Promise<Order> {
  const res = await apiFetch<{ data: Order }>(`/api/orders/${id}/pay`, { method: "POST" });
  return res.data;
}

// ─── Storefronts ─────────────────────────────────────────────────────────────

export async function getStorefronts(): Promise<Storefront[]> {
  const res = await apiFetch<{ data: Storefront[] }>("/api/storefronts");
  return res.data;
}

export async function getStorefront(celebrityId: string): Promise<Storefront | null> {
  try {
    const res = await apiFetch<{ data: Storefront }>(`/api/storefronts/${celebrityId}`);
    return res.data;
  } catch {
    return null;
  }
}

export async function saveStorefront(body: Storefront): Promise<Storefront> {
  const res = await apiFetch<{ data: Storefront }>("/api/storefronts", { method: "POST", body: JSON.stringify(body) });
  return res.data;
}

export async function getCommissionSummary(): Promise<CommissionSummary> {
  const res = await apiFetch<{ data: CommissionSummary }>("/api/storefronts/metrics/commission");
  return res.data;
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  const res = await apiFetch<{ data: Order }>(`/api/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return res.data;
}
