import { prisma } from "../lib/prisma.js";
import { Money } from "../lib/money.js";
import { CommerceNotFoundError } from "../lib/commerce.errors.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CouponValidationResult = {
  valid: boolean;
  couponId: string;
  code: string;
  type: string;
  discountPaise: number;
  message: string;
  snapshot: CouponSnapshot;
};

export type CouponSnapshot = {
  code: string;
  type: string;
  value: number;
  discountApplied: number;
  validatedAt: string;
};

type CartItem = { productId: string; quantity: number; totalPricePaise: number };

// ── Service ───────────────────────────────────────────────────────────────────

export const couponService = {
  /**
   * Validate a coupon for the current cart without consuming it.
   * Returns a validation result including the computed discount in paise.
   *
   * - PERCENTAGE coupons: value = integer percent (e.g. 10 = 10%)
   * - FIXED_AMOUNT coupons: value = paise
   * - FREE_SHIPPING: discount equals the shipping amount passed in
   * - FIRST_ORDER: blocked if user already has a paid order
   */
  async validate(
    code: string,
    userId: string,
    subtotalPaise: number,
    shippingPaise: number,
    items: CartItem[]
  ): Promise<CouponValidationResult> {
    const coupon = await prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (!coupon) throw new CommerceNotFoundError(`Coupon "${code}" not found`);

    const now = new Date();

    const invalid = (reason: string): CouponValidationResult => ({
      valid:         false,
      couponId:      coupon.id,
      code:          coupon.code,
      type:          coupon.type,
      discountPaise: 0,
      message:       reason,
      snapshot:      {
        code:            coupon.code,
        type:            coupon.type,
        value:           coupon.value,
        discountApplied: 0,
        validatedAt:     now.toISOString(),
      },
    });

    if (!coupon.isActive) return invalid("This coupon is not active");
    if (coupon.startsAt > now) return invalid("This coupon is not yet valid");
    if (coupon.expiresAt && coupon.expiresAt < now) return invalid("This coupon has expired");

    // Usage limit check
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return invalid("This coupon has reached its usage limit");
    }

    // Per-user usage limit
    const userUsageCount = await prisma.couponUsage.count({
      where: { couponId: coupon.id, userId },
    });
    if (userUsageCount >= coupon.usageLimitPerUser) {
      return invalid("You have already used this coupon the maximum number of times");
    }

    // Minimum order amount
    if (subtotalPaise < coupon.minOrderAmount) {
      const minRupees = Money.toRupees(coupon.minOrderAmount);
      return invalid(`Minimum order amount of ${Money.format(coupon.minOrderAmount)} (₹${minRupees.toFixed(0)}) required`);
    }

    // First-order coupon: check if user has any completed orders
    if (coupon.type === "FIRST_ORDER") {
      const priorOrders = await prisma.order.count({
        where: {
          userId,
          status: { notIn: ["AWAITING_PAYMENT", "CANCELLED"] },
        },
      });
      if (priorOrders > 0) return invalid("This coupon is valid for first-time orders only");
    }

    // Eligible product check
    if (coupon.applicableProductIds.length > 0) {
      const eligible = items.some((i) => coupon.applicableProductIds.includes(i.productId));
      if (!eligible) return invalid("This coupon is not applicable to the items in your cart");
    }

    // Calculate discount
    let discountPaise = 0;
    switch (coupon.type) {
      case "PERCENTAGE": {
        const raw = Money.percentOf(subtotalPaise, coupon.value);
        discountPaise = coupon.maxDiscountAmount !== null
          ? Math.min(raw, coupon.maxDiscountAmount)
          : raw;
        break;
      }
      case "FIXED_AMOUNT":
        discountPaise = Math.min(coupon.value, subtotalPaise);
        break;
      case "FREE_SHIPPING":
        discountPaise = shippingPaise;
        break;
      case "FIRST_ORDER": {
        const raw = Money.percentOf(subtotalPaise, coupon.value);
        discountPaise = coupon.maxDiscountAmount !== null
          ? Math.min(raw, coupon.maxDiscountAmount)
          : raw;
        break;
      }
      case "BUY_X_GET_Y":
        // Simplified: treat as percentage discount equal to value
        discountPaise = Money.percentOf(subtotalPaise, coupon.value);
        break;
    }

    return {
      valid:         true,
      couponId:      coupon.id,
      code:          coupon.code,
      type:          coupon.type,
      discountPaise,
      message:       `Coupon applied: ${Money.format(discountPaise)} off`,
      snapshot: {
        code:            coupon.code,
        type:            coupon.type,
        value:           coupon.value,
        discountApplied: discountPaise,
        validatedAt:     now.toISOString(),
      },
    };
  },
};
