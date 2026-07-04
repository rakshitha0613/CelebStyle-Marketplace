/**
 * EmbeddingService — generates dense vector representations of product text.
 *
 * Two providers:
 *   "openai"        — OpenAI text-embedding-3-small (1536-dim), requires OPENAI_API_KEY
 *   "deterministic" — FNV-1a bag-of-words hash projection (1536-dim), no external API
 *
 * The deterministic provider is the default and is always available as a fallback,
 * ensuring the recommendation pipeline never hard-depends on a third-party API.
 */

export const EMBEDDING_DIMS = 1536;

// ── Deterministic provider ────────────────────────────────────────────────────

// FNV-1a 32-bit hash — stable across runs, no seed needed
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function tokenize(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]}__${words[i + 1]}`);
  }
  return [...words, ...bigrams];
}

function l2normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return norm === 0 ? vec : vec.map((v) => v / norm);
}

function deterministicEmbed(text: string): number[] {
  const tokens = tokenize(text);
  const vec = new Array<number>(EMBEDDING_DIMS).fill(0);

  for (const token of tokens) {
    const bucket = fnv1a(token) % EMBEDDING_DIMS;
    // Use a second hash for the sign to decorrelate collisions
    const sign = fnv1a(token + "\x01") % 2 === 0 ? 1 : -1;
    vec[bucket] += sign;
  }

  return l2normalize(vec);
}

// ── OpenAI provider ───────────────────────────────────────────────────────────

async function openAIEmbed(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)");
    throw new Error(`OpenAI embeddings API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { data: [{ embedding: number[] }] };
  return data.data[0].embedding;
}

// ── Product text builder ──────────────────────────────────────────────────────

export interface ProductTextInput {
  category:       string;
  occasion:       string;
  colorPalette?:  string;
  movieName?:     string;
  characterName?: string;
  fabricDetails?: string;
  description?:   string;
  celebrity?: {
    name?:    string;
    profile?: { styleTags?: string[] };
  };
  tags?: Array<{ tag: { name: string } }>;
}

function buildProductText(p: ProductTextInput): string {
  return [
    p.celebrity?.name ?? "",
    p.category,
    p.occasion,
    p.colorPalette ?? "",
    p.movieName ?? "",
    p.characterName ?? "",
    p.fabricDetails ?? "",
    p.description ?? "",
    ...(p.celebrity?.profile?.styleTags ?? []),
    ...(p.tags?.map((t) => t.tag.name) ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

// ── Singleton service ─────────────────────────────────────────────────────────

const openAIKey = process.env.OPENAI_API_KEY;

type EmbeddingProvider = "openai" | "deterministic";

export const embeddingService = {
  provider:     (openAIKey ? "openai" : "deterministic") as EmbeddingProvider,
  dimensions:   EMBEDDING_DIMS,
  modelVersion: openAIKey ? "openai-text-embedding-3-small-v1" : "v1-deterministic",

  async embed(text: string): Promise<number[]> {
    if (openAIKey) {
      try {
        return await openAIEmbed(text, openAIKey);
      } catch (err) {
        console.warn("[EmbeddingService] OpenAI unavailable, falling back to deterministic:", (err as Error).message);
        return deterministicEmbed(text);
      }
    }
    return deterministicEmbed(text);
  },

  // In-memory cosine similarity (for testing and pre-flight checks)
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) throw new Error("Dimension mismatch");
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot   += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  },

  productText: buildProductText,
};
