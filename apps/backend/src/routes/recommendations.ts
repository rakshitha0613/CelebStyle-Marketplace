/**
 * GET /api/recommendations/* — Recommendation API.
 *
 * Authenticated (requires Bearer token):
 *   GET /home               — 7-section personalised home feed
 *   GET /recently-viewed    — user's recently viewed products
 *   GET /continue-shopping  — viewed / carted but not purchased
 *   GET /cart               — 4-section cart-based recommendations
 *
 * Public:
 *   GET /trending           — global trending products
 *   GET /new-arrivals       — products published in last 30 days
 *   GET /product/:productId — 5-section product-page recommendations
 *   GET /celebrity/:celebrityId — celebrity catalogue recommendations
 *
 * Query params:
 *   limit        — max items per section (default: 8 for sectioned, 20 for flat)
 *   sessionId    — optional session ID for recently-viewed context
 *   productIds   — comma-separated product IDs for cart endpoint
 */

import { Router, type Request, type Response } from "express";
import { requireAuth, optionalAuth } from "../auth/auth.middleware.js";
import {
  getTrendingRecommendations,
  getNewArrivalsRecommendations,
  getCelebrityRecommendations,
  getProductRecommendations,
  getHomeRecommendations,
  getRecentlyViewedProducts,
  getContinueShoppingProducts,
  getCartRecommendations,
} from "../services/recommendation.service.js";

export const recommendationsRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseLimit(query: unknown, defaultVal: number, max = 40): number {
  const n = parseInt(String(query ?? ""), 10);
  return isNaN(n) || n < 1 ? defaultVal : Math.min(n, max);
}

// ── Public: trending ──────────────────────────────────────────────────────────

recommendationsRouter.get(
  "/trending",
  async (req: Request, res: Response): Promise<void> => {
    const limit = parseLimit(req.query["limit"], 20);
    const items = await getTrendingRecommendations(limit);
    res.json({ data: { section: "TRENDING", title: "Trending", items } });
  }
);

// ── Public: new arrivals ──────────────────────────────────────────────────────

recommendationsRouter.get(
  "/new-arrivals",
  async (req: Request, res: Response): Promise<void> => {
    const limit = parseLimit(req.query["limit"], 20);
    const items = await getNewArrivalsRecommendations(limit);
    res.json({ data: { section: "NEW_ARRIVALS", title: "New Arrivals", items } });
  }
);

// ── Public: product-page recommendations ──────────────────────────────────────

recommendationsRouter.get(
  "/product/:productId",
  optionalAuth,
  async (req: Request, res: Response): Promise<void> => {
    const productId = req.params["productId"] as string;
    if (!productId) { res.status(400).json({ error: "productId required" }); return; }

    const limit  = parseLimit(req.query["limit"], 8);
    const result = await getProductRecommendations(productId, limit);

    if (!result) {
      res.status(404).json({ error: "Product not found or not published" });
      return;
    }

    res.json({ data: result });
  }
);

// ── Public: celebrity recommendations ────────────────────────────────────────

recommendationsRouter.get(
  "/celebrity/:celebrityId",
  optionalAuth,
  async (req: Request, res: Response): Promise<void> => {
    const celebrityId = req.params["celebrityId"] as string;
    if (!celebrityId) { res.status(400).json({ error: "celebrityId required" }); return; }

    const limit  = parseLimit(req.query["limit"], 20);
    const result = await getCelebrityRecommendations(celebrityId, limit);

    if (!result) {
      res.status(404).json({ error: "Celebrity not found" });
      return;
    }

    res.json({ data: { section: "CELEBRITY", title: "Celebrity Picks", items: result } });
  }
);

// ── Authenticated: home feed ──────────────────────────────────────────────────

recommendationsRouter.get(
  "/home",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId    = req.user!.id;
    const sessionId = req.query["sessionId"] as string | undefined;
    const limit     = parseLimit(req.query["limit"], 8);

    const result = await getHomeRecommendations(userId, sessionId, limit);
    res.json({ data: result });
  }
);

// ── Authenticated: recently viewed ───────────────────────────────────────────

recommendationsRouter.get(
  "/recently-viewed",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId    = req.user!.id;
    const sessionId = req.query["sessionId"] as string | undefined;
    const limit     = parseLimit(req.query["limit"], 20);

    const items = await getRecentlyViewedProducts(userId, sessionId, limit);
    res.json({ data: { section: "RECENTLY_VIEWED", title: "Recently Viewed", items } });
  }
);

// ── Authenticated: continue shopping ─────────────────────────────────────────

recommendationsRouter.get(
  "/continue-shopping",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const limit  = parseLimit(req.query["limit"], 20);

    const items = await getContinueShoppingProducts(userId, limit);
    res.json({ data: { section: "CONTINUE_SHOPPING", title: "Continue Shopping", items } });
  }
);

// ── Authenticated: cart recommendations ──────────────────────────────────────

recommendationsRouter.get(
  "/cart",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId  = req.user!.id;
    const limit   = parseLimit(req.query["limit"], 8);

    // Client may supply cart product IDs (comma-separated)
    const rawIds        = req.query["productIds"] as string | undefined;
    const cartProductIds = rawIds
      ? rawIds.split(",").map((id) => id.trim()).filter(Boolean)
      : undefined;

    const result = await getCartRecommendations(userId, cartProductIds, limit);
    res.json({ data: result });
  }
);
