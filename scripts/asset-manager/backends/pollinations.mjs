/**
 * Pollinations.ai FLUX backend — free, no API key, no billing.
 * Used for every bulk-tier slot (and as the automatic fallback for
 * hero-tier slots when Replicate has no credit).
 */

export const BACKEND_NAME = "pollinations";
export const MODEL_NAME = "flux (pollinations)";

function url(prompt, seed, width, height) {
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?seed=${seed}&width=${width}&height=${height}&model=flux&nologo=true`;
}

const RETRY_LIMIT = 4;
const RETRY_BASE_DELAY_MS = 4000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetches a raw image buffer from Pollinations for the given prompt/seed.
 * Retries on 429 (the free anonymous tier rate-limits aggressively) with
 * exponential backoff.
 * @returns {Promise<Buffer>}
 */
export async function generate(prompt, seed, width = 1024, height = 1280) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRY_LIMIT; attempt++) {
    try {
      const res = await fetch(url(prompt, seed, width, height), {
        signal: AbortSignal.timeout(60_000),
        headers: { "User-Agent": "CelebStyle-AssetManager/1.0" },
      });
      if (res.status === 429) {
        lastErr = new Error(`Pollinations HTTP 429`);
      } else if (!res.ok) {
        throw new Error(`Pollinations HTTP ${res.status}`);
      } else {
        const arrayBuffer = await res.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }
    } catch (err) {
      lastErr = err;
    }
    if (attempt < RETRY_LIMIT) {
      await sleep(RETRY_BASE_DELAY_MS * (attempt + 1));
    }
  }
  throw lastErr;
}
