// Central API client — all server-side fetches go through here

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

// ─── Token helpers (client-side only) ────────────────────────────────────────

const ADMIN_TOKEN_KEY    = "celebstyle-admin-token";
const CUSTOMER_TOKEN_KEY = "celebstyle-customer-token";

/** Returns the best available token: admin takes precedence over customer. */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ADMIN_TOKEN_KEY) ?? localStorage.getItem(CUSTOMER_TOKEN_KEY);
}

function storeToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  }
}

function storeCustomerToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
  else localStorage.removeItem(CUSTOMER_TOKEN_KEY);
}

/**
 * Decodes the JWT payload (without verification) to read email and role.
 * Returns null when no valid token is present or the token is locally expired.
 */
export function getCurrentUser(): { email: string; role: string } | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(ADMIN_TOKEN_KEY) ?? localStorage.getItem(CUSTOMER_TOKEN_KEY);
  if (!token) return null;
  try {
    const raw = token.split(".")[1];
    const decoded = atob(raw.replace(/-/g, "+").replace(/_/g, "/"));
    const p = JSON.parse(decoded) as { email?: string; role?: string; exp?: number };
    if (p.exp && p.exp * 1000 < Date.now()) return null;
    if (!p.email || !p.role) return null;
    return { email: p.email, role: p.role };
  } catch {
    return null;
  }
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
): Promise<{ id: string; name: string; email: string; role: string; emailVerified: boolean; createdAt: string }> {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `Registration failed (${res.status})`);
  }
  const data = await res.json() as { data: { id: string; name: string; email: string; role: string; emailVerified: boolean; createdAt: string } };
  return data.data;
}

export async function adminLogin(email: string, password: string): Promise<void> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? "Invalid credentials");
  }
  const data = await res.json() as { data: { accessToken: string; user: { role: string } } };
  const token = data.data?.accessToken;
  if (!token) throw new Error("No access token in response");
  const role = data.data?.user?.role;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    throw new Error("Access denied: administrator role required");
  }
  storeToken(token);
}

export function adminLogout(): void {
  storeToken(null);
}

// ─── Customer auth ────────────────────────────────────────────────────────────

export async function customerLogin(
  email: string,
  password: string,
): Promise<{ email: string; role: string }> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? "Invalid credentials");
  }
  const data = await res.json() as { data: { accessToken: string; user: { email: string; role: string } } };
  const token = data.data?.accessToken;
  if (!token) throw new Error("No access token in response");
  storeCustomerToken(token);
  return data.data.user;
}

export function customerLogout(): void {
  storeCustomerToken(null);
}

// ─── Email verification ───────────────────────────────────────────────────────

export async function verifyEmail(token: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE}/api/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const body = await res.json().catch(() => ({})) as { data?: { message?: string }; message?: string };
  if (!res.ok) throw new Error(body.message ?? `Verification failed (${res.status})`);
  return { message: body.data?.message ?? "Email verified successfully" };
}

export async function resendVerification(email: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE}/api/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const body = await res.json().catch(() => ({})) as { data?: { message?: string }; message?: string };
  if (!res.ok) throw new Error(body.message ?? `Request failed (${res.status})`);
  return { message: body.data?.message ?? "If your email is registered and unverified, a new verification link has been sent" };
}

// ─── Password reset ───────────────────────────────────────────────────────────

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const body = await res.json().catch(() => ({})) as { data?: { message?: string }; message?: string };
  if (!res.ok) throw new Error(body.message ?? `Request failed (${res.status})`);
  return { message: body.data?.message ?? "If the account exists, a password reset link has been sent." };
}

export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
  const res = await fetch(`${BASE}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  const body = await res.json().catch(() => ({})) as { data?: { message?: string }; message?: string };
  if (!res.ok) throw new Error(body.message ?? `Reset failed (${res.status})`);
  return { message: body.data?.message ?? "Password reset successfully." };
}

/** Fetches the full authenticated user profile from /api/auth/me. */
export async function getMe(): Promise<{
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
} | null> {
  try {
    const res = await apiFetch<{ data: { id: string; name: string; email: string; role: string; emailVerified: boolean } }>("/api/auth/me");
    return res.data;
  } catch {
    return null;
  }
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const extraHeaders: Record<string, string> = {};

  // On the client, attach the stored admin JWT so protected write routes work.
  if (typeof window !== "undefined") {
    const token = getStoredToken();
    if (token) extraHeaders["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}), ...extraHeaders },
    cache: "no-store"
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${path} → ${res.status}: ${body}`);
  }
  return res.json();
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  emailVerified: boolean;
  avatar: string | null;
  createdAt: string;
};

export async function getProfile(): Promise<UserProfile | null> {
  try {
    const res = await apiFetch<{ data: UserProfile }>("/api/profile");
    return res.data;
  } catch {
    return null;
  }
}

export async function updateProfile(input: {
  name?: string;
  phone?: string | null;
  avatarUrl?: string | null;
}): Promise<UserProfile | null> {
  try {
    const res = await apiFetch<{ data: UserProfile }>("/api/profile", {
      method: "PUT",
      body: JSON.stringify(input),
    });
    return res.data;
  } catch (err) {
    throw err;
  }
}

// ─── Addresses ────────────────────────────────────────────────────────────────

export type Address = {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
};

export async function getAddresses(): Promise<Address[]> {
  try {
    const res = await apiFetch<{ data: Address[] }>("/api/addresses");
    return res.data;
  } catch {
    return [];
  }
}

export async function createAddress(
  input: Omit<Address, "id" | "isDefaultShipping" | "isDefaultBilling"> & {
    isDefaultShipping?: boolean;
    isDefaultBilling?: boolean;
  }
): Promise<Address> {
  const res = await apiFetch<{ data: Address }>("/api/addresses", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function updateAddress(
  id: string,
  input: Partial<Omit<Address, "id">>
): Promise<Address> {
  const res = await apiFetch<{ data: Address }>(`/api/addresses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function deleteAddress(id: string): Promise<void> {
  await apiFetch(`/api/addresses/${id}`, { method: "DELETE" });
}

// ─── Wishlist ─────────────────────────────────────────────────────────────────

export type WishlistItem = {
  id: string;
  productSlug: string;
  productName: string;
  category: string;
  price: number;
  imageUrl: string;
  celebrityId: string;
  celebrityName: string;
  manufacturerIds: string[];
  isAvailable: boolean;
  addedAt: string;
};

export async function getWishlist(): Promise<WishlistItem[]> {
  try {
    const res = await apiFetch<{ data: WishlistItem[] }>("/api/wishlist");
    return res.data;
  } catch {
    return [];
  }
}

export async function addToWishlist(productSlug: string): Promise<WishlistItem> {
  const res = await apiFetch<{ data: WishlistItem }>("/api/wishlist", {
    method: "POST",
    body: JSON.stringify({ productId: productSlug }),
  });
  return res.data;
}

export async function removeFromWishlist(itemId: string): Promise<void> {
  await apiFetch(`/api/wishlist/${itemId}`, { method: "DELETE" });
}

export async function clearWishlist(): Promise<void> {
  await apiFetch("/api/wishlist", { method: "DELETE" });
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

export async function getOrders(): Promise<Order[] | null> {
  try {
    const res = await apiFetch<{ data: Order[] }>("/api/orders");
    return res.data;
  } catch {
    // 401/403 — endpoint is ADMIN/SUPER_ADMIN only; unauthenticated visitors get null
    return null;
  }
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

export async function simulatePayment(orderNumber: string): Promise<Order> {
  const res = await apiFetch<{ data: { success: boolean; orderId: string; order: Order } }>(
    "/api/payments/simulate",
    { method: "POST", body: JSON.stringify({ orderNumber }) }
  );
  return res.data.order!;
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

export async function getCommissionSummary(): Promise<CommissionSummary | null> {
  try {
    const res = await apiFetch<{ data: CommissionSummary }>("/api/storefronts/metrics/commission");
    return res.data;
  } catch {
    // 401/403 for unauthenticated visitors — financial data is admin-only
    return null;
  }
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  const res = await apiFetch<{ data: Order }>(`/api/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return res.data;
}

// ─── Recommendations ──────────────────────────────────────────────────────────

export type RecommendationItem = {
  productId: string;
  score: number;
  reason: string;
  confidence: number;
  explanation: string;
};

export type RecommendationSection = {
  section?: string;
  type?: string;
  title: string;
  items: RecommendationItem[];
};

export async function getTrending(limit = 8): Promise<RecommendationSection> {
  try {
    const res = await apiFetch<{ data: RecommendationSection }>(
      `/api/recommendations/trending?limit=${limit}`
    );
    return res.data;
  } catch {
    return { title: "Trending Now", items: [] };
  }
}

export async function getNewArrivals(limit = 8): Promise<RecommendationSection> {
  try {
    const res = await apiFetch<{ data: RecommendationSection }>(
      `/api/recommendations/new-arrivals?limit=${limit}`
    );
    return res.data;
  } catch {
    return { title: "New Arrivals", items: [] };
  }
}

export async function getProductRecs(
  productId: string,
  limit = 6
): Promise<RecommendationSection[]> {
  try {
    const res = await apiFetch<{ data: { sections: RecommendationSection[] } }>(
      `/api/recommendations/product/${productId}?limit=${limit}`
    );
    return res.data.sections ?? [];
  } catch {
    return [];
  }
}

export async function getCelebrityRecs(
  celebrityId: string,
  limit = 8
): Promise<RecommendationSection> {
  try {
    const res = await apiFetch<{ data: RecommendationSection }>(
      `/api/recommendations/celebrity/${celebrityId}?limit=${limit}`
    );
    return res.data;
  } catch {
    return { title: "More From This Artist", items: [] };
  }
}
