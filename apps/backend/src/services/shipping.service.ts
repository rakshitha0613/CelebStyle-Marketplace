import { prisma } from "../lib/prisma.js";
import { Money } from "../lib/money.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ShippingSnapshot = {
  rate: number;
  isFree: boolean;
  freeShippingThreshold: number;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  zone: string;
  calculatedAt: string;
};

export type ShippingQuote = {
  ratePaise: number;
  isFree: boolean;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  zone: string;
  snapshot: ShippingSnapshot;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const FREE_SHIPPING_THRESHOLD_PAISE = Money.toPaise(25_000); // ₹25,000
const STANDARD_RATE_PAISE           = Money.toPaise(499);    // ₹499
const STANDARD_DAYS_MIN             = 7;
const STANDARD_DAYS_MAX             = 10;

// ── Service ───────────────────────────────────────────────────────────────────

export const shippingService = {
  /**
   * Calculate shipping quote for the given subtotal and optional delivery pincode.
   * Attempts a ShippingZone lookup by state; falls back to standard rates.
   */
  async calculate(subtotalPaise: number, pincode?: string): Promise<ShippingQuote> {
    const isFree = subtotalPaise >= FREE_SHIPPING_THRESHOLD_PAISE;
    let ratePaise = isFree ? 0 : STANDARD_RATE_PAISE;
    let daysMin = STANDARD_DAYS_MIN;
    let daysMax = STANDARD_DAYS_MAX;
    let zone = "standard";

    // Best-effort ShippingZone lookup via active ShippingRate records
    if (!isFree) {
      try {
        const rates = await prisma.shippingRate.findMany({
          where:   { isActive: true, minOrderAmount: { lte: subtotalPaise } },
          orderBy: { minOrderAmount: "desc" },
          take:    1,
          select:  {
            baseRate:              true,
            estimatedDaysMin:      true,
            estimatedDaysMax:      true,
            freeShippingThreshold: true,
            zone:                  { select: { name: true } },
          },
        });
        if (rates.length > 0) {
          const r = rates[0];
          const freeAt = r.freeShippingThreshold;
          if (freeAt !== null && subtotalPaise >= freeAt) {
            ratePaise = 0;
          } else {
            ratePaise = r.baseRate;
          }
          daysMin = r.estimatedDaysMin;
          daysMax = r.estimatedDaysMax;
          zone    = r.zone.name;
        }
      } catch {
        // ShippingRate table may be empty — fall through to defaults
      }
    }

    const snapshot: ShippingSnapshot = {
      rate:                   ratePaise,
      isFree,
      freeShippingThreshold:  FREE_SHIPPING_THRESHOLD_PAISE,
      estimatedDaysMin:       daysMin,
      estimatedDaysMax:       daysMax,
      zone,
      calculatedAt:           new Date().toISOString(),
    };

    return { ratePaise, isFree, estimatedDaysMin: daysMin, estimatedDaysMax: daysMax, zone, snapshot };
  },
};
