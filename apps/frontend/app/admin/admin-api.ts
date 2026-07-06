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

// Re-export community post type for use in tabs
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
