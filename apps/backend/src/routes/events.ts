/**
 * POST /api/events — Analytics event ingestion.
 *
 * Accepts a single event or an array of events (batch).
 * Auth is optional — events can be anonymous (sessionId-only).
 * Returns 202 Accepted immediately; heavy processing is deferred to workers.
 *
 * Session tracking:
 *   If sessionId is provided and the session does not yet exist in AnalyticsSession,
 *   it is created with the supplied context. Subsequent events update the eventCount.
 */

import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";
import { cacheService } from "../lib/cache.service.js";
import { optionalAuth } from "../auth/auth.middleware.js";
import { invalidateUserCFCache } from "../services/collaborative-filtering.service.js";
import { invalidateRankingCache } from "../services/ranking.service.js";
import { invalidateUserRecommendationsCache } from "../services/recommendation.service.js";
import { randomUUID } from "node:crypto";

export const eventsRouter = Router();

// ── Valid event types ─────────────────────────────────────────────────────────

const VALID_TYPES = new Set([
  "PAGE_VIEW",
  "PRODUCT_VIEW",
  "SEARCH",
  "ADD_TO_CART",
  "REMOVE_FROM_CART",
  "CHECKOUT_START",
  "PURCHASE",
  "ADD_TO_WISHLIST",
  "REMOVE_FROM_WISHLIST",
  "SHARE",
  "REVIEW_SUBMIT",
  "TRY_ON",
  "AR_SESSION",
  "RECOMMENDATION_CLICK",
  "FILTER_APPLY",
  "SCROLL_DEPTH",
  "SESSION_END",
]);

// ── Types ─────────────────────────────────────────────────────────────────────

interface EventPayload {
  type:        string;
  sessionId?:  string;
  productId?:  string;
  orderId?:    string;
  searchQuery?: string;
  page?:       string;
  referrer?:   string;
  userAgent?:  string;
  properties?: Record<string, unknown>;
  // Session context (used on first event in a session to create AnalyticsSession)
  device?:      string;
  browser?:     string;
  country?:     string;
  state?:       string;
  city?:        string;
  utmSource?:   string;
  utmMedium?:   string;
  utmCampaign?: string;
}

// ── Session upsert ────────────────────────────────────────────────────────────

async function upsertSession(payload: EventPayload, userId?: string): Promise<string> {
  const sessionId = payload.sessionId ?? randomUUID();

  const existing = await prisma.analyticsSession.findUnique({ where: { id: sessionId } });

  if (!existing) {
    await prisma.analyticsSession.create({
      data: {
        id:          sessionId,
        userId:      userId ?? null,
        device:      payload.device      ?? null,
        browser:     payload.browser     ?? null,
        country:     payload.country     ?? null,
        state:       payload.state       ?? null,
        city:        payload.city        ?? null,
        referrer:    payload.referrer    ?? null,
        utmSource:   payload.utmSource   ?? null,
        utmMedium:   payload.utmMedium   ?? null,
        utmCampaign: payload.utmCampaign ?? null,
        firstPage:   payload.page        ?? null,
        eventCount:  1,
      },
    });
  } else {
    await prisma.analyticsSession.update({
      where: { id: sessionId },
      data:  { eventCount: { increment: 1 } },
    });
  }

  return sessionId;
}

// ── Store a single event ──────────────────────────────────────────────────────

async function storeEvent(payload: EventPayload, userId?: string, ipAddress?: string): Promise<void> {
  const sessionId = await upsertSession(payload, userId);

  await prisma.analyticsEvent.create({
    data: {
      type:        payload.type as any,
      userId:      userId      ?? null,
      sessionId,
      productId:   payload.productId   ?? null,
      orderId:     payload.orderId     ?? null,
      searchQuery: payload.searchQuery ?? null,
      page:        payload.page        ?? null,
      referrer:    payload.referrer    ?? null,
      userAgent:   payload.userAgent   ?? null,
      ipAddress:   ipAddress           ?? null,
      properties:  (payload.properties ?? undefined) as any,
    },
  });

  // Update recently-viewed cache on PRODUCT_VIEW; also track co-views
  if (payload.type === "PRODUCT_VIEW" && payload.productId) {
    const recentlyViewed = cacheService.getRecentlyViewed(sessionId);
    // Increment co-view count for up to 3 recently-viewed products in this session
    const coViewTargets = recentlyViewed.filter((id) => id !== payload.productId).slice(0, 3);
    for (const otherId of coViewTargets) {
      const [a, b] = payload.productId < otherId
        ? [payload.productId, otherId]
        : [otherId, payload.productId];
      await prisma.coviewedPair.upsert({
        where:  { productAId_productBId: { productAId: a, productBId: b } },
        update: { coviewCount: { increment: 1 } },
        create: { productAId: a, productBId: b, coviewCount: 1 },
      });
    }
    cacheService.addRecentlyViewed(sessionId, payload.productId);
  }

  // Invalidate user feature cache on engagement events (lazy recompute later)
  if (userId && ["PURCHASE", "ADD_TO_WISHLIST", "ADD_TO_CART", "REMOVE_FROM_CART"].includes(payload.type)) {
    cacheService.invalidateUserFeatures(userId);
  }

  // Invalidate CF, ranking, and recommendation caches on high-signal events
  if (userId && ["PURCHASE", "ADD_TO_WISHLIST", "ADD_TO_CART"].includes(payload.type)) {
    invalidateUserCFCache(userId);
    invalidateRankingCache(userId);
    invalidateUserRecommendationsCache(userId);
  }
}

// ── POST /api/events ──────────────────────────────────────────────────────────

eventsRouter.post(
  "/",
  optionalAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId    = req.user?.id;
    const ipAddress = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
      ?? req.socket.remoteAddress;

    const body = req.body as EventPayload | EventPayload[];
    const payloads = Array.isArray(body) ? body : [body];

    // Validate all types before storing anything
    const invalid = payloads.filter((p) => !VALID_TYPES.has(p?.type));
    if (invalid.length > 0 || payloads.length === 0) {
      res.status(400).json({
        error: "Invalid or missing event type",
        invalid: invalid.map((p) => p?.type),
      });
      return;
    }

    // Store events sequentially (session upsert has side effects)
    let stored = 0;
    for (const payload of payloads) {
      await storeEvent(payload, userId, ipAddress);
      stored++;
    }

    res.status(202).json({ data: { stored } });
  }
);

// ── GET /api/events/session/:sessionId ───────────────────────────────────────
// Returns session metadata + recently viewed products

eventsRouter.get(
  "/session/:sessionId",
  optionalAuth,
  async (req: Request, res: Response): Promise<void> => {
    const sessionId = req.params["sessionId"] as string;

    const session = await prisma.analyticsSession.findUnique({ where: { id: sessionId } });

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const recentlyViewed = cacheService.getRecentlyViewed(sessionId);

    res.json({ data: { session, recentlyViewed } });
  }
);
