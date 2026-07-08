import { getStoredToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export async function apiFetchAdmin<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Admin API ${path} → ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

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

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  deletedAt: string | null;
  lastLoginAt: string | null;
  profile: { avatarUrl: string | null } | null;
  _count: { orders: number; reviews: number };
};

export type AdminStats = {
  totalUsers: number;
  activeUsers: number;
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  totalProducts: number;
  totalCelebrities: number;
  totalManufacturers: number;
  totalStorefronts: number;
  totalReviews: number;
  pendingReviews: number;
  communityPosts: number;
  totalCoupons: number;
  activeCoupons: number;
  totalReturns: number;
  pendingReturns: number;
};

export type AdminOrder = {
  id: string;
  orderNumber: string;
  customerEmail: string;
  shippingName: string;
  total: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
};

export type AdminProduct = {
  id: string;
  slug: string;
  movieName: string;
  category: string;
  imageUrl: string;
  basePrice: number;
  orderCount: number;
};

export type LowStockItem = {
  id: string;
  quantity: number;
  lowStockThreshold: number;
  product: { id: string; movieName: string; imageUrl: string };
  variant: { size: string; color: string | null };
  warehouse: { name: string };
};

export type AdminStorefront = {
  id: string;
  celebrityId: string;
  displayName: string;
  bannerImage: string;
  message: string;
  verified: boolean;
  isPublished: boolean;
  commissionRate: number;
  createdAt: string;
  celebrity: { id: string; name: string; slug: string };
};

export type AuditLog = {
  id: string;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  createdAt: string;
  ipAddress: string | null;
};

export type SystemSetting = {
  id: string;
  key: string;
  value: string;
  description: string | null;
  isPublic: boolean;
  updatedAt: string;
};

export type AdminReturn = {
  id: string;
  orderId: string;
  reason: string;
  status: string;
  description: string | null;
  refundAmount: number | null;
  requestedAt: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
  order: { orderNumber: string; total: number };
};

export type AdminSettlement = {
  id: string;
  orderId: string;
  platformFee: number;
  celebrityCommission: number;
  manufacturerShare: number;
  netCelebrityAmount: number;
  netManufacturerAmount: number;
  status: string;
  settledAt: string | null;
  createdAt: string;
  order: { orderNumber: string; customerEmail: string; total: number };
};

export type AdminInventoryItem = {
  id: string;
  quantity: number;
  lowStockThreshold: number;
  reservedQuantity: number;
  product: { id: string; movieName: string; imageUrl: string; basePrice: number };
  variant: { id: string; size: string; color: string | null; sku: string };
  warehouse: { id: string; name: string; city: string };
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getAdminStats(): Promise<{
  stats: AdminStats;
  ordersByStatus: { status: string; count: number }[];
  recentOrders: AdminOrder[];
  topProducts: AdminProduct[];
  lowStockItems: LowStockItem[];
}> {
  const res = await apiFetchAdmin<{ data: {
    stats: AdminStats;
    ordersByStatus: { status: string; count: number }[];
    recentOrders: AdminOrder[];
    topProducts: AdminProduct[];
    lowStockItems: LowStockItem[];
  } }>("/api/admin/stats");
  return res.data;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getAdminUsers(params?: {
  page?: number; limit?: number; search?: string; role?: string; status?: string;
}): Promise<{ users: AdminUser[]; total: number; page: number; limit: number }> {
  const qs = new URLSearchParams();
  if (params?.page)   qs.set("page",   String(params.page));
  if (params?.limit)  qs.set("limit",  String(params.limit));
  if (params?.search) qs.set("search", params.search);
  if (params?.role)   qs.set("role",   params.role);
  if (params?.status) qs.set("status", params.status);
  const query = qs.toString() ? `?${qs}` : "";
  const res = await apiFetchAdmin<{ data: { users: AdminUser[]; total: number; page: number; limit: number } }>(
    `/api/admin/users${query}`
  );
  return res.data;
}

export async function getAdminUser(id: string): Promise<AdminUser & {
  phone: string | null;
  profile: { avatarUrl: string | null; bio: string | null } | null;
  _count: { orders: number; reviews: number; communityPosts: number };
}> {
  const res = await apiFetchAdmin<{ data: AdminUser & {
    phone: string | null;
    profile: { avatarUrl: string | null; bio: string | null } | null;
    _count: { orders: number; reviews: number; communityPosts: number };
  } }>(`/api/admin/users/${id}`);
  return res.data;
}

export async function updateAdminUser(id: string, body: { name?: string; role?: string; isActive?: boolean }): Promise<AdminUser> {
  const res = await apiFetchAdmin<{ data: AdminUser }>(`/api/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function deleteAdminUser(id: string): Promise<void> {
  await apiFetchAdmin(`/api/admin/users/${id}`, { method: "DELETE" });
}

export async function resetAdminUserPassword(id: string): Promise<{ email: string; tempPassword: string }> {
  const res = await apiFetchAdmin<{ data: { email: string; tempPassword: string } }>(
    `/api/admin/users/${id}/reset-password`,
    { method: "POST" }
  );
  return res.data;
}

export async function getAdminUserOrders(id: string): Promise<Array<{
  id: string; orderNumber: string; total: number; status: string; paymentStatus: string; createdAt: string; _count: { items: number };
}>> {
  const res = await apiFetchAdmin<{ data: Array<{
    id: string; orderNumber: string; total: number; status: string; paymentStatus: string; createdAt: string; _count: { items: number };
  }> }>(`/api/admin/users/${id}/orders`);
  return res.data;
}

export async function getAdminUserAddresses(id: string): Promise<Array<{
  id: string; label: string | null; fullName: string; line1: string; city: string; state: string; pincode: string;
}>> {
  const res = await apiFetchAdmin<{ data: Array<{
    id: string; label: string | null; fullName: string; line1: string; city: string; state: string; pincode: string;
  }> }>(`/api/admin/users/${id}/addresses`);
  return res.data;
}

// ─── Orders (admin) ───────────────────────────────────────────────────────────

export async function getAdminOrders(params?: {
  page?: number; limit?: number; search?: string; status?: string;
}): Promise<{ data: AdminOrder[]; total?: number }> {
  const qs = new URLSearchParams();
  if (params?.page)   qs.set("page",   String(params.page));
  if (params?.limit)  qs.set("limit",  String(params.limit));
  if (params?.search) qs.set("search", params.search);
  if (params?.status) qs.set("status", params.status);
  const query = qs.toString() ? `?${qs}` : "";
  const res = await apiFetchAdmin<{ data: AdminOrder[] }>(`/api/orders${query}`);
  return res;
}

// ─── Storefronts (admin) ──────────────────────────────────────────────────────

export async function getAdminStorefronts(): Promise<AdminStorefront[]> {
  const res = await apiFetchAdmin<{ data: AdminStorefront[] }>("/api/admin/storefronts");
  return res.data;
}

export async function updateAdminStorefront(id: string, body: { isPublished?: boolean; verified?: boolean }): Promise<AdminStorefront> {
  const res = await apiFetchAdmin<{ data: AdminStorefront }>(`/api/admin/storefronts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return res.data;
}

// ─── Returns (admin) ──────────────────────────────────────────────────────────

export async function getAdminReturns(params?: { status?: string; limit?: number; offset?: number }): Promise<AdminReturn[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.limit)  qs.set("limit",  String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  const query = qs.toString() ? `?${qs}` : "";
  const res = await apiFetchAdmin<{ data: AdminReturn[] }>(`/api/returns${query}`);
  return res.data;
}

export async function approveAdminReturn(id: string): Promise<void> {
  await apiFetchAdmin(`/api/returns/${id}/approve`, { method: "PATCH" });
}

export async function rejectAdminReturn(id: string, reason?: string): Promise<void> {
  await apiFetchAdmin(`/api/returns/${id}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
}

export async function completeAdminReturn(id: string, refundAmount: number): Promise<void> {
  await apiFetchAdmin(`/api/returns/${id}/complete`, {
    method: "PATCH",
    body: JSON.stringify({ refundAmount }),
  });
}

// ─── Settlements (admin) ──────────────────────────────────────────────────────

export async function getAdminSettlements(params?: { status?: string; limit?: number }): Promise<AdminSettlement[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.limit)  qs.set("limit",  String(params.limit));
  const query = qs.toString() ? `?${qs}` : "";
  const res = await apiFetchAdmin<{ data: AdminSettlement[] }>(`/api/settlements${query}`);
  return res.data;
}

export async function payAdminSettlement(id: string): Promise<void> {
  await apiFetchAdmin(`/api/settlements/${id}/pay`, { method: "PATCH" });
}

// ─── Inventory (admin) ────────────────────────────────────────────────────────

export async function getAdminInventory(params?: { productId?: string; warehouseId?: string; lowStock?: boolean }): Promise<AdminInventoryItem[]> {
  const qs = new URLSearchParams();
  if (params?.productId)   qs.set("productId",   params.productId);
  if (params?.warehouseId) qs.set("warehouseId", params.warehouseId);
  if (params?.lowStock)    qs.set("lowStock",     "true");
  const query = qs.toString() ? `?${qs}` : "";
  const res = await apiFetchAdmin<{ data: AdminInventoryItem[] }>(`/api/inventory/admin${query}`);
  return res.data;
}

export async function adjustAdminInventory(variantId: string, warehouseId: string, delta: number, reason?: string): Promise<void> {
  await apiFetchAdmin("/api/inventory/adjust", {
    method: "POST",
    body: JSON.stringify({ variantId, warehouseId, quantity: delta, reason }),
  });
}

// ─── Blog (admin) ─────────────────────────────────────────────────────────────

export async function createAdminBlogPost(body: {
  title: string;
  summary: string;
  body: string;
  tags?: string[];
  coverImage?: string;
  celebrityId?: string;
  isPublished?: boolean;
}): Promise<{ id: string; slug: string; title: string }> {
  const res = await apiFetchAdmin<{ data: { id: string; slug: string; title: string } }>("/api/blog", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function updateAdminBlogPost(id: string, body: Partial<{
  title: string;
  summary: string;
  body: string;
  tags: string[];
  coverImage: string;
  isPublished: boolean;
}>): Promise<{ id: string; slug: string; title: string }> {
  const res = await apiFetchAdmin<{ data: { id: string; slug: string; title: string } }>(`/api/blog/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function deleteAdminBlogPost(id: string): Promise<void> {
  await apiFetchAdmin(`/api/blog/${id}`, { method: "DELETE" });
}

// ─── Reviews (admin) ──────────────────────────────────────────────────────────

export async function getAdminReviews(params?: { status?: string; limit?: number }): Promise<Array<{
  id: string;
  rating: number;
  title: string | null;
  body: string;
  isApproved: boolean;
  isVerifiedPurchase: boolean;
  createdAt: string;
  user: { id: string; name: string; email: string };
  product: { id: string; movieName: string; imageUrl: string };
}>> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString() ? `?${qs}` : "";
  const res = await apiFetchAdmin<{ data: Array<{
    id: string;
    rating: number;
    title: string | null;
    body: string;
    isApproved: boolean;
    isVerifiedPurchase: boolean;
    createdAt: string;
    user: { id: string; name: string; email: string };
    product: { id: string; movieName: string; imageUrl: string };
  }> }>(`/api/reviews/pending${query}`);
  return res.data;
}

export async function approveAdminReview(id: string): Promise<void> {
  await apiFetchAdmin(`/api/reviews/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "APPROVED" }),
  });
}

export async function rejectAdminReview(id: string): Promise<void> {
  await apiFetchAdmin(`/api/reviews/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "REJECTED" }),
  });
}

export async function deleteAdminReview(id: string): Promise<void> {
  await apiFetchAdmin(`/api/reviews/${id}`, { method: "DELETE" });
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export async function getAdminAuditLogs(params?: {
  page?: number; limit?: number; action?: string; resourceType?: string;
}): Promise<{ logs: AuditLog[]; total: number; page: number; limit: number }> {
  const qs = new URLSearchParams();
  if (params?.page)         qs.set("page",         String(params.page));
  if (params?.limit)        qs.set("limit",        String(params.limit));
  if (params?.action)       qs.set("action",       params.action);
  if (params?.resourceType) qs.set("resourceType", params.resourceType);
  const query = qs.toString() ? `?${qs}` : "";
  const res = await apiFetchAdmin<{ data: { logs: AuditLog[]; total: number; page: number; limit: number } }>(
    `/api/admin/audit-logs${query}`
  );
  return res.data;
}

// ─── System Settings ──────────────────────────────────────────────────────────

export async function getAdminSettings(): Promise<SystemSetting[]> {
  const res = await apiFetchAdmin<{ data: SystemSetting[] }>("/api/admin/settings");
  return res.data;
}

export async function upsertAdminSetting(key: string, value: string, description?: string): Promise<SystemSetting> {
  const res = await apiFetchAdmin<{ data: SystemSetting }>("/api/admin/settings", {
    method: "PATCH",
    body: JSON.stringify({ key, value, description }),
  });
  return res.data;
}

export async function deleteAdminSetting(key: string): Promise<void> {
  await apiFetchAdmin(`/api/admin/settings/${encodeURIComponent(key)}`, { method: "DELETE" });
}

// ─── Notification Broadcast ───────────────────────────────────────────────────

export async function broadcastNotification(body: {
  title: string;
  body: string;
  type?: string;
  roles?: string[];
  actionUrl?: string;
}): Promise<{ sentCount: number }> {
  const res = await apiFetchAdmin<{ data: { sentCount: number } }>("/api/admin/notifications/broadcast", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return res.data;
}

// ─── Inventory admin list (uses existing route) ───────────────────────────────

export async function getInventoryForProduct(productId: string): Promise<AdminInventoryItem[]> {
  const res = await apiFetchAdmin<{ data: AdminInventoryItem[] }>(`/api/inventory/product/${productId}`);
  return res.data;
}

export async function adjustInventory(variantId: string, warehouseId: string, quantity: number, reason?: string): Promise<void> {
  await apiFetchAdmin("/api/inventory/adjust", {
    method: "POST",
    body: JSON.stringify({ variantId, warehouseId, quantity, reason }),
  });
}
