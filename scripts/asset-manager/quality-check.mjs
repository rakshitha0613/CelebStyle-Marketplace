/**
 * Heuristic low-quality detector for bulk-tier (Pollinations) output.
 *
 * There is no vision-aesthetic-scoring API in scope (free/local tooling
 * only), so this is explicitly a heuristic, not a judgment of beauty: it
 * catches the same failure signature as the old gradient placeholders —
 * a near-flat, near-solid image — which is the classic symptom of a
 * blank/failed/degenerate generation. False positives are expected and
 * acceptable; flagged images are queued for review/upgrade, never
 * auto-deleted or auto-hidden.
 */

const STDDEV_FLAT_THRESHOLD = 8; // per-channel stdev below this ~= near-solid color

/**
 * @param {Buffer} buffer decoded/re-encoded image buffer
 * @returns {Promise<{ flagged: boolean, reason: string|null, stddev: number|null }>}
 */
export async function checkQuality(buffer) {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    return { flagged: false, reason: "sharp-unavailable", stddev: null };
  }

  try {
    const stats = await sharp(buffer).stats();
    const avgStddev =
      stats.channels.reduce((sum, c) => sum + c.stdev, 0) / stats.channels.length;

    if (avgStddev < STDDEV_FLAT_THRESHOLD) {
      return { flagged: true, reason: "auto-flagged-low-variance", stddev: avgStddev };
    }
    return { flagged: false, reason: null, stddev: avgStddev };
  } catch {
    return { flagged: true, reason: "auto-flagged-decode-failure", stddev: null };
  }
}
