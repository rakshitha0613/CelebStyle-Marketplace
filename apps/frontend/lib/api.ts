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
    trackingCode: string | null;
    routingStatus: string;
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

export type CouponResult = {
  valid: boolean;
  code: string;
  type: string;
  discountRupees: number;
  message: string;
};

export async function lookupCoupon(code: string, subtotal: number): Promise<CouponResult> {
  const qs = new URLSearchParams({ code, subtotal: String(subtotal) });
  const res = await apiFetch<{ data: CouponResult }>(`/api/checkout/coupon/lookup?${qs}`);
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

// ─── AR Session Analytics ─────────────────────────────────────────────────────

export type ARSessionPayload = {
  productId: string;
  durationSeconds: number;
  wasAddedToCart: boolean;
  deviceType?: string;
  platform?: string;
  screenshotUrl?: string;
};

/**
 * Fire-and-forget: log a completed AR try-on session to the backend.
 * Never throws — analytics must not affect the AR experience.
 */
export async function logARSession(payload: ARSessionPayload): Promise<void> {
  try {
    await apiFetch("/api/ar/session", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch {
    // Intentionally swallowed — analytics are non-blocking
  }
}

// ─── Community ────────────────────────────────────────────────────────────────

export type CommunityPost = {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  caption: string;
  imageUrl: string | null;
  outfitId: string | null;
  outfitName: string | null;
  tags: string[];
  likeCount: number;
  liked: boolean;
  commentCount: number;
  shares: number;
  reportCount: number;
  status: "ACTIVE" | "HIDDEN" | "DELETED";
  contestEntry: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CommunityComment = {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  body: string;
  likes: string[];
  createdAt: string;
};

export async function getCommunityFeed(params?: {
  limit?: number;
  offset?: number;
  tag?: string;
  userId?: string;
}): Promise<{ posts: CommunityPost[]; total: number; offset: number; limit: number }> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  if (params?.tag) qs.set("tag", params.tag);
  if (params?.userId) qs.set("userId", params.userId);
  const query = qs.toString() ? `?${qs}` : "";
  const res = await apiFetch<{ data: { posts: CommunityPost[]; total: number; offset: number; limit: number } }>(
    `/api/community/posts${query}`
  );
  return res.data;
}

export async function getTrendingPosts(limit = 10): Promise<CommunityPost[]> {
  try {
    const res = await apiFetch<{ data: CommunityPost[] }>(
      `/api/community/posts/trending?limit=${limit}`
    );
    return res.data;
  } catch {
    return [];
  }
}

export async function getContestPosts(limit = 20): Promise<CommunityPost[]> {
  try {
    const res = await apiFetch<{ data: CommunityPost[] }>(
      `/api/community/posts/contest?limit=${limit}`
    );
    return res.data;
  } catch {
    return [];
  }
}

export async function createCommunityPost(body: {
  caption: string;
  imageUrl?: string;
  outfitId?: string;
  outfitName?: string;
  tags?: string[];
  contestEntry?: boolean;
}): Promise<CommunityPost> {
  const res = await apiFetch<{ data: CommunityPost }>("/api/community/posts", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function likeCommunityPost(postId: string): Promise<{ liked: boolean; likeCount: number }> {
  const res = await apiFetch<{ data: { liked: boolean; likeCount: number } }>(
    `/api/community/posts/${postId}/like`,
    { method: "POST" }
  );
  return res.data;
}

export async function getPostComments(postId: string): Promise<CommunityComment[]> {
  try {
    const res = await apiFetch<{ data: { comments: CommunityComment[] } }>(
      `/api/community/posts/${postId}/comments`
    );
    return res.data.comments;
  } catch {
    return [];
  }
}

export async function addComment(postId: string, body: string): Promise<CommunityComment> {
  const res = await apiFetch<{ data: CommunityComment }>(
    `/api/community/posts/${postId}/comments`,
    { method: "POST", body: JSON.stringify({ body }) }
  );
  return res.data;
}

export async function shareCommunityPost(postId: string): Promise<void> {
  try {
    await apiFetch(`/api/community/posts/${postId}/share`, { method: "POST" });
  } catch { /* fire-and-forget */ }
}

export async function reportCommunityPost(postId: string, reason: string): Promise<void> {
  await apiFetch(`/api/community/posts/${postId}/report`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function deleteCommunityPost(postId: string): Promise<void> {
  await apiFetch(`/api/community/posts/${postId}`, { method: "DELETE" });
}

// ── Fan Ratings ───────────────────────────────────────────────────────────────

export type FanRating = {
  id: string;
  userId: string;
  userName: string;
  celebrityId: string;
  rating: number;
  review: string | null;
  createdAt: string;
};

export async function getFanRatings(celebrityId: string): Promise<{
  ratings: FanRating[];
  average: number | null;
  count: number;
}> {
  try {
    const res = await apiFetch<{ data: { ratings: FanRating[]; average: number | null; count: number } }>(
      `/api/community/fan-ratings/${celebrityId}`
    );
    return res.data;
  } catch {
    return { ratings: [], average: null, count: 0 };
  }
}

export async function submitFanRating(
  celebrityId: string,
  rating: number,
  review?: string
): Promise<FanRating> {
  const res = await apiFetch<{ data: FanRating }>(
    `/api/community/fan-ratings/${celebrityId}`,
    { method: "POST", body: JSON.stringify({ rating, review }) }
  );
  return res.data;
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export type Review = {
  id: string;
  userId: string;
  userName: string;
  outfitId: string;
  orderId: string | null;
  rating: number;
  title: string;
  body: string;
  verified: boolean;
  images: string[];
  helpfulCount: number;
  helpful: boolean;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  updatedAt: string;
};

export async function getOutfitReviews(outfitId: string): Promise<{
  reviews: Review[];
  total: number;
  average: number | null;
}> {
  try {
    const res = await apiFetch<{ data: { reviews: Review[]; total: number; average: number | null } }>(
      `/api/reviews/outfit/${outfitId}`
    );
    return res.data;
  } catch {
    return { reviews: [], total: 0, average: null };
  }
}

export async function submitReview(body: {
  outfitId: string;
  orderId?: string;
  rating: number;
  title?: string;
  body: string;
}): Promise<Review> {
  const res = await apiFetch<{ data: Review }>("/api/reviews", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function markReviewHelpful(reviewId: string): Promise<{ helpful: boolean; helpfulCount: number }> {
  const res = await apiFetch<{ data: { helpful: boolean; helpfulCount: number } }>(
    `/api/reviews/${reviewId}/helpful`,
    { method: "POST" }
  );
  return res.data;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type AppNotification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  read: boolean;
  createdAt: string;
};

export type PriceAlert = {
  id: string;
  outfitId: string;
  outfitName: string;
  targetPrice: number;
  currentPrice: number;
  active: boolean;
  createdAt: string;
};

export type CelebrityAlert = {
  id: string;
  celebrityId: string;
  celebrityName: string;
  active: boolean;
  createdAt: string;
};

export async function getNotifications(params?: { unread?: boolean; limit?: number; offset?: number }): Promise<{
  notifications: AppNotification[];
  total: number;
  unreadCount: number;
}> {
  try {
    const qs = new URLSearchParams();
    if (params?.unread) qs.set("unread", "true");
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const query = qs.toString() ? `?${qs}` : "";
    const res = await apiFetch<{ data: { notifications: AppNotification[]; total: number; unreadCount: number } }>(
      `/api/notifications${query}`
    );
    return res.data;
  } catch {
    return { notifications: [], total: 0, unreadCount: 0 };
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiFetch("/api/notifications/read-all", { method: "POST" });
}

export async function getPriceAlerts(): Promise<PriceAlert[]> {
  try {
    const res = await apiFetch<{ data: PriceAlert[] }>("/api/notifications/price-alerts");
    return res.data;
  } catch {
    return [];
  }
}

export async function createPriceAlert(
  outfitId: string,
  outfitName: string,
  targetPrice: number,
  currentPrice: number
): Promise<PriceAlert> {
  const res = await apiFetch<{ data: PriceAlert }>("/api/notifications/price-alerts", {
    method: "POST",
    body: JSON.stringify({ outfitId, outfitName, targetPrice, currentPrice }),
  });
  return res.data;
}

export async function deletePriceAlert(id: string): Promise<void> {
  await apiFetch(`/api/notifications/price-alerts/${id}`, { method: "DELETE" });
}

export async function getCelebrityAlerts(): Promise<CelebrityAlert[]> {
  try {
    const res = await apiFetch<{ data: CelebrityAlert[] }>("/api/notifications/celebrity-alerts");
    return res.data;
  } catch {
    return [];
  }
}

export async function followCelebrity(
  celebrityId: string,
  celebrityName: string
): Promise<CelebrityAlert> {
  const res = await apiFetch<{ data: CelebrityAlert }>("/api/notifications/celebrity-alerts", {
    method: "POST",
    body: JSON.stringify({ celebrityId, celebrityName }),
  });
  return res.data;
}

export async function unfollowCelebrity(alertId: string): Promise<void> {
  await apiFetch(`/api/notifications/celebrity-alerts/${alertId}`, { method: "DELETE" });
}

// ─── Size Profile ─────────────────────────────────────────────────────────────

export type SizeProfile = {
  id: string;
  height: number | null;
  weight: number | null;
  chest: number | null;
  waist: number | null;
  hips: number | null;
  inseam: number | null;
  shoulder: number | null;
  topSize: string | null;
  bottomSize: string | null;
  dressSize: string | null;
  shoeSize: string | null;
  fitPreference: "SLIM" | "REGULAR" | "RELAXED" | null;
  notes: string | null;
  updatedAt: string;
};

export async function getSizeProfile(): Promise<SizeProfile | null> {
  try {
    const res = await apiFetch<{ data: SizeProfile | null }>("/api/profile/size");
    return res.data;
  } catch {
    return null;
  }
}

export async function saveSizeProfile(data: Partial<Omit<SizeProfile, "id" | "updatedAt">>): Promise<SizeProfile> {
  const res = await apiFetch<{ data: SizeProfile }>("/api/profile/size", {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.data;
}

// ─── Saved Looks ──────────────────────────────────────────────────────────────

export type SavedLook = {
  id: string;
  outfitId: string;
  outfitName: string;
  imageUrl: string | null;
  screenshotUrl: string | null;
  notes: string | null;
  savedAt: string;
};

export async function getSavedLooks(): Promise<SavedLook[]> {
  try {
    const res = await apiFetch<{ data: SavedLook[] }>("/api/profile/saved-looks");
    return res.data;
  } catch {
    return [];
  }
}

export async function saveLook(body: {
  outfitId: string;
  outfitName: string;
  imageUrl?: string;
  screenshotUrl?: string;
  notes?: string;
}): Promise<SavedLook> {
  const res = await apiFetch<{ data: SavedLook }>("/api/profile/saved-looks", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function deleteSavedLook(id: string): Promise<void> {
  await apiFetch(`/api/profile/saved-looks/${id}`, { method: "DELETE" });
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export type Invoice = {
  id: string;
  orderId: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  items: Array<{ name: string; quantity: number; price: number; subtotal: number }>;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  status: string;
  issuedAt: string;
};

export async function getInvoiceForOrder(orderId: string): Promise<Invoice | null> {
  try {
    const res = await apiFetch<{ data: Invoice }>(`/api/invoices/order/${orderId}`);
    return res.data;
  } catch {
    return null;
  }
}

// ─── Returns ──────────────────────────────────────────────────────────────────

export type ReturnRequest = {
  id: string;
  orderId: string;
  userId: string;
  reason: string;
  description: string | null;
  status: string;
  items: Array<{ orderItemId: string; quantity: number; reason?: string }>;
  createdAt: string;
  updatedAt: string;
};

export async function getMyReturns(): Promise<ReturnRequest[]> {
  try {
    const res = await apiFetch<{ data: ReturnRequest[] }>("/api/returns");
    return res.data;
  } catch {
    return [];
  }
}

export async function createReturn(body: {
  orderId: string;
  reason: string;
  description?: string;
  items: Array<{ orderItemId: string; quantity: number; reason?: string }>;
}): Promise<ReturnRequest> {
  const res = await apiFetch<{ data: ReturnRequest }>("/api/returns", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

// ─── Settlements ──────────────────────────────────────────────────────────────

export type Settlement = {
  id: string;
  manufacturerId: string;
  manufacturerName: string;
  period: string;
  grossRevenue: number;
  platformFee: number;
  netAmount: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
};

export async function getSettlements(): Promise<Settlement[]> {
  try {
    const res = await apiFetch<{ data: Settlement[] }>("/api/settlements");
    return res.data;
  } catch {
    return [];
  }
}

// ─── Blog ─────────────────────────────────────────────────────────────────────

type BlogPostRaw = {
  id: string;
  slug: string;
  authorId: string;
  author?: { name: string; profile?: { avatarUrl?: string | null } | null };
  celebrityId: string | null;
  title: string;
  summary: string;
  body: string;
  coverImage: string | null;
  tags: string[];
  outfitIds?: string[];
  productIds?: string[];
  isPublished?: boolean;
  published?: boolean;
  viewCount?: number;
  views?: number;
  createdAt: string;
  updatedAt: string;
};

export type BlogPost = {
  id: string;
  slug: string;
  authorId: string;
  authorName: string;
  author?: { name: string; profile?: { avatarUrl?: string | null } | null };
  celebrityId: string | null;
  title: string;
  summary: string;
  body: string;
  coverImage: string | null;
  tags: string[];
  outfitIds: string[];
  published: boolean;
  views: number;
  createdAt: string;
  updatedAt: string;
};

function normalizeBlogPost(raw: BlogPostRaw): BlogPost {
  return {
    ...raw,
    authorName: raw.author?.name ?? "",
    outfitIds: raw.outfitIds ?? raw.productIds ?? [],
    published: raw.isPublished ?? raw.published ?? false,
    views: raw.viewCount ?? raw.views ?? 0,
  };
}

export async function getBlogPosts(params?: {
  tag?: string;
  celebrityId?: string;
  search?: string;
  limit?: number;
}): Promise<{ posts: BlogPost[]; total: number }> {
  try {
    const qs = new URLSearchParams();
    if (params?.tag) qs.set("tag", params.tag);
    if (params?.celebrityId) qs.set("celebrityId", params.celebrityId);
    if (params?.search) qs.set("search", params.search);
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString() ? `?${qs}` : "";
    const res = await apiFetch<{ data: { posts: BlogPostRaw[]; total: number } }>(`/api/blog${query}`);
    return { posts: res.data.posts.map(normalizeBlogPost), total: res.data.total };
  } catch {
    return { posts: [], total: 0 };
  }
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  try {
    const res = await apiFetch<{ data: BlogPostRaw }>(`/api/blog/${slug}`);
    return normalizeBlogPost(res.data);
  } catch {
    return null;
  }
}

// ─── Storefront Analytics ─────────────────────────────────────────────────────

export type StorefrontAnalytics = {
  celebrityId: string;
  totalViews: number;
  uniqueVisitors: number;
  conversions: number;
  conversionRate: number;
  monthly: Array<{ month: string; views: number; conversions: number }>;
  topOutfits: Array<{ outfitId: string; views: number }>;
};

export type StorefrontPayout = {
  id: string;
  period: string;
  gross: number;
  commission: number;
  status: string;
  paidAt: string | null;
};

export async function getStorefrontAnalytics(celebrityId: string): Promise<StorefrontAnalytics | null> {
  try {
    const res = await apiFetch<{ data: StorefrontAnalytics }>(`/api/storefronts/${celebrityId}/analytics`);
    return res.data;
  } catch {
    return null;
  }
}

export async function getStorefrontPayouts(celebrityId: string): Promise<{
  payouts: StorefrontPayout[];
  summary: CommissionSummary;
} | null> {
  try {
    const res = await apiFetch<{ data: { payouts: StorefrontPayout[]; summary: CommissionSummary } }>(
      `/api/storefronts/${celebrityId}/payouts`
    );
    return res.data;
  } catch {
    return null;
  }
}

export async function trackStorefrontView(celebrityId: string, outfitId?: string): Promise<void> {
  try {
    await apiFetch(`/api/storefronts/${celebrityId}/track`, {
      method: "POST",
      body: JSON.stringify({ outfitId }),
    });
  } catch { /* fire and forget */ }
}

// ─── Wishlist Privacy ─────────────────────────────────────────────────────────

export async function getWishlistPrivacy(): Promise<{ isPublic: boolean }> {
  try {
    const res = await apiFetch<{ data: { isPublic: boolean } }>("/api/wishlist/privacy");
    return res.data;
  } catch {
    return { isPublic: false };
  }
}

export async function setWishlistPrivacy(isPublic: boolean): Promise<{ isPublic: boolean }> {
  const res = await apiFetch<{ data: { isPublic: boolean } }>("/api/wishlist/privacy", {
    method: "PATCH",
    body: JSON.stringify({ isPublic }),
  });
  return res.data;
}

// ─── Special Orders ───────────────────────────────────────────────────────────

export type BulkOrderItem = {
  outfitId: string;
  outfitName: string;
  quantity: number;
  size: string;
  pricePerUnit: number;
};

export type BulkOrder = {
  id: string;
  userId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  deliveryAddress: string;
  items: BulkOrderItem[];
  totalUnits: number;
  subtotal: number;
  discountRate: number;
  discountedTotal: number;
  notes: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type WeddingOrderItem = {
  outfitId: string;
  outfitName: string;
  quantity: number;
  size: string;
  customFabric: string | null;
  customColour: string | null;
  customNotes: string | null;
  pricePerUnit: number;
};

export type WeddingOrder = {
  id: string;
  brideName: string;
  groomName: string;
  weddingDate: string;
  venue: string;
  contactEmail: string;
  contactPhone: string;
  deliveryAddress: string;
  items: WeddingOrderItem[];
  subtotal: number;
  rushFee: number;
  total: number;
  stylistNote: string | null;
  status: string;
  createdAt: string;
};

export type CustomizationRequest = {
  id: string;
  outfitId: string;
  outfitName: string;
  customFabric: string | null;
  customColour: string | null;
  embroidery: boolean;
  embroideryText: string | null;
  measurements: Record<string, number>;
  additionalNotes: string | null;
  estimatedPrice: number;
  status: string;
  quoteAmount: number | null;
  createdAt: string;
  updatedAt: string;
};

export async function getMyBulkOrders(): Promise<BulkOrder[]> {
  try {
    const res = await apiFetch<{ data: BulkOrder[] }>("/api/special-orders/bulk");
    return res.data;
  } catch {
    return [];
  }
}

export async function createBulkOrder(body: {
  companyName?: string;
  contactName?: string;
  contactEmail: string;
  contactPhone?: string;
  deliveryAddress: string;
  items: BulkOrderItem[];
  notes?: string;
}): Promise<BulkOrder> {
  const res = await apiFetch<{ data: BulkOrder }>("/api/special-orders/bulk", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function getMyWeddingOrders(): Promise<WeddingOrder[]> {
  try {
    const res = await apiFetch<{ data: WeddingOrder[] }>("/api/special-orders/wedding");
    return res.data;
  } catch {
    return [];
  }
}

export async function createWeddingOrder(body: {
  brideName?: string;
  groomName?: string;
  weddingDate: string;
  venue?: string;
  contactEmail: string;
  contactPhone?: string;
  deliveryAddress: string;
  items: WeddingOrderItem[];
  stylistNote?: string;
}): Promise<WeddingOrder> {
  const res = await apiFetch<{ data: WeddingOrder }>("/api/special-orders/wedding", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function getMyCustomizations(): Promise<CustomizationRequest[]> {
  try {
    const res = await apiFetch<{ data: CustomizationRequest[] }>("/api/special-orders/customizations");
    return res.data;
  } catch {
    return [];
  }
}

export async function createCustomization(body: {
  outfitId: string;
  outfitName?: string;
  customFabric?: string;
  customColour?: string;
  embroidery?: boolean;
  embroideryText?: string;
  measurements?: Record<string, number>;
  additionalNotes?: string;
  estimatedPrice?: number;
}): Promise<CustomizationRequest> {
  const res = await apiFetch<{ data: CustomizationRequest }>("/api/special-orders/customizations", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

// ─── Refunds ──────────────────────────────────────────────────────────────────

export type Refund = {
  id: string;
  returnId: string;
  orderId: string;
  amount: number;
  reason: string;
  status: string;
  processedAt: string | null;
  createdAt: string;
};

export async function getMyRefunds(): Promise<Refund[]> {
  try {
    const res = await apiFetch<{ data: Refund[] }>("/api/refunds");
    return res.data;
  } catch {
    return [];
  }
}

// ── Admin reports ─────────────────────────────────────────────────────────────

export type SettlementReport = {
  totalSettlements: number;
  totalPlatformFee: number;
  totalCelebCommission: number;
  totalManufacturerShare: number;
  totalGross: number;
  byStatus: Record<string, { count: number; amount: number }>;
};

export type CommissionReport = {
  totalGross: number;
  totalPlatformFee: number;
  totalCelebCommission: number;
  totalManufacturerShare: number;
  byCelebrity: { celebrityId: string; gross: number; commission: number }[];
};

export async function getSettlementReport(params?: { from?: string; to?: string }): Promise<SettlementReport | null> {
  try {
    const qs = params ? "?" + new URLSearchParams(Object.entries(params).filter(([, v]) => v) as string[][]).toString() : "";
    const res = await apiFetch<{ data: SettlementReport }>(`/api/settlements/report${qs}`);
    return res.data;
  } catch {
    return null;
  }
}

export async function getCommissionReport(params?: { from?: string; to?: string }): Promise<CommissionReport | null> {
  try {
    const qs = params ? "?" + new URLSearchParams(Object.entries(params).filter(([, v]) => v) as string[][]).toString() : "";
    const res = await apiFetch<{ data: CommissionReport }>(`/api/commissions/report${qs}`);
    return res.data;
  } catch {
    return null;
  }
}

// ── Cloudinary (simulated) image upload ───────────────────────────────────────

export type UploadResult = {
  secure_url: string;
  public_id: string;
  format: string;
  resource_type: string;
  simulated: boolean;
};

export async function uploadImageUrl(url: string): Promise<UploadResult> {
  const res = await apiFetch<{ data: UploadResult }>("/api/upload", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
  return res.data;
}

export async function uploadImageBase64(base64: string, filename?: string): Promise<UploadResult> {
  const res = await apiFetch<{ data: UploadResult }>("/api/upload", {
    method: "POST",
    body: JSON.stringify({ base64, filename }),
  });
  return res.data;
}
