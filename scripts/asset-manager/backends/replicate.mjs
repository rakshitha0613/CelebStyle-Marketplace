/**
 * Replicate (flux-1.1-pro-ultra) backend — paid, used only for hero-tier
 * slots (celebrity portraits, outfit hero images, collection covers).
 *
 * 402 handling: the caller (slots runner) tracks an in-process
 * "outOfCredit" flag once OutOfCreditError is thrown once — every
 * subsequent hero-tier task in that run should skip straight to the
 * Pollinations fallback instead of retrying against Replicate.
 *
 * NOTE: on some Windows/corporate-network setups, Node's TLS verification
 * fails against api.replicate.com ("unable to verify the first
 * certificate") unless the process is started with `node --use-system-ca`.
 * If every call fails with that error, that's the fix, not a code bug.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { ROOT } from "../manifest.mjs";

export const BACKEND_NAME = "replicate";
export const MODEL_NAME = "black-forest-labs/flux-1.1-pro-ultra";
const REPLICATE_MODEL_PATH = "black-forest-labs/flux-1.1-pro-ultra";

export class OutOfCreditError extends Error {
  constructor(message) {
    super(message);
    this.name = "OutOfCreditError";
  }
}

export function getReplicateToken() {
  if (process.env.REPLICATE_API_TOKEN) return process.env.REPLICATE_API_TOKEN;
  const envPath = join(ROOT, "apps", "backend", ".env");
  if (!existsSync(envPath)) return null;
  const text = readFileSync(envPath, "utf8");
  const match = text.match(/^REPLICATE_API_TOKEN="?([^"\n]+)"?/m);
  return match ? match[1] : null;
}

const RATE_LIMIT_RETRY_LIMIT = 3;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function createPrediction(token, prompt, seed) {
  for (let attempt = 0; attempt <= RATE_LIMIT_RETRY_LIMIT; attempt++) {
    const res = await fetch(`https://api.replicate.com/v1/models/${REPLICATE_MODEL_PATH}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio: "4:5",
          raw: true,
          output_format: "png",
          seed,
          safety_tolerance: 2,
        },
      }),
    });
    const json = await res.json();
    if (res.status === 402) {
      throw new OutOfCreditError(json?.detail || "Insufficient Replicate credit");
    }
    // Unpaid-account rate limit (6/min, burst 1) — retry after the server-given delay.
    if (res.status === 429) {
      if (attempt < RATE_LIMIT_RETRY_LIMIT) {
        const retryAfterSec = Number(json?.retry_after) || 10;
        await sleep((retryAfterSec + 1) * 1000);
        continue;
      }
      // Persistent throttling after retries means the same thing in practice
      // as no credit: "reduced rate limit until you add a payment method."
      // Treat it as OutOfCreditError so the caller flips to Pollinations for
      // the rest of the run instead of burning ~30s of retries per slot.
      throw new OutOfCreditError(json?.detail || "Replicate rate-limited persistently (no payment method on file)");
    }
    if (!res.ok) {
      throw new Error(`Replicate error ${res.status}: ${JSON.stringify(json)}`);
    }
    return json;
  }
}

async function pollPrediction(prediction) {
  let p = prediction;
  while (p.status !== "succeeded" && p.status !== "failed" && p.status !== "canceled") {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(p.urls.get, {
      headers: { Authorization: `Bearer ${getReplicateToken()}` },
    });
    p = await res.json();
  }
  return p;
}

/**
 * Generates a hero-tier image via Replicate Ultra.
 * @returns {Promise<Buffer>}
 * @throws {OutOfCreditError} when the account has no credit
 */
export async function generate(prompt, seed) {
  const token = getReplicateToken();
  if (!token) throw new OutOfCreditError("REPLICATE_API_TOKEN not configured");

  const created = await createPrediction(token, prompt, seed);
  const done = await pollPrediction(created);
  if (done.status !== "succeeded") {
    throw new Error(`Replicate prediction ${done.status}: ${done.error || "unknown error"}`);
  }
  const imageUrl = Array.isArray(done.output) ? done.output[0] : done.output;
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Replicate output download failed: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
