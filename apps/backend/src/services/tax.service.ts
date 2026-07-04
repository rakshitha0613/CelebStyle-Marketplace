import { Money } from "../lib/money.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TaxBreakdown = {
  cgstPercent: number;
  sgstPercent: number;
  igstPercent: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTaxAmount: number;
  taxableAmount: number;
  isInterState: boolean;
  calculatedAt: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

// India GST: apparel ≤ ₹999 → 5%, apparel ≥ ₹1000 → 12%
// For simplicity: one rate per order. Use the weighted average or the predominant rate.
// Since CelebStyle sells premium fashion (≥ ₹1000), we apply 12% GST universally.

const GST_RATE_HIGH    = 12; // 12% for premium fashion (≥ ₹1000/item)
const GST_RATE_LOW     = 5;  // 5% for budget fashion (< ₹1000/item)
const THRESHOLD_PAISE  = Money.toPaise(1000); // ₹1000

// ── Service ───────────────────────────────────────────────────────────────────

export const taxService = {
  /**
   * Calculate GST breakdown for a taxable amount (subtotal after discounts).
   *
   * India rules:
   *   - intra-state: CGST + SGST (each at half the GST rate)
   *   - inter-state: IGST (full GST rate)
   *
   * We default to intra-state (Maharashtra seller).
   * Buyers in Maharashtra → CGST+SGST; others → IGST.
   * If buyerState is not provided, defaults to intra-state.
   *
   * Item-level rate logic:
   *   - Average unit price < ₹1000 → 5% GST
   *   - Average unit price ≥ ₹1000 → 12% GST
   */
  calculate(
    taxableAmountPaise: number,
    buyerState?: string,
    avgUnitPricePaise?: number
  ): TaxBreakdown {
    const sellerState   = "Maharashtra";
    const isInterState  = buyerState !== undefined && buyerState.trim() !== "" && buyerState.trim() !== sellerState;
    const gstRate       = avgUnitPricePaise !== undefined && avgUnitPricePaise < THRESHOLD_PAISE
      ? GST_RATE_LOW
      : GST_RATE_HIGH;

    const totalTaxAmount = Money.percentOf(taxableAmountPaise, gstRate);
    const now            = new Date().toISOString();

    if (isInterState) {
      return {
        cgstPercent:    0,
        sgstPercent:    0,
        igstPercent:    gstRate,
        cgstAmount:     0,
        sgstAmount:     0,
        igstAmount:     totalTaxAmount,
        totalTaxAmount,
        taxableAmount:  taxableAmountPaise,
        isInterState:   true,
        calculatedAt:   now,
      };
    }

    const halfRate    = gstRate / 2;
    const halfAmount  = Math.floor(totalTaxAmount / 2);
    const otherHalf   = totalTaxAmount - halfAmount; // handles odd paise

    return {
      cgstPercent:   halfRate,
      sgstPercent:   halfRate,
      igstPercent:   0,
      cgstAmount:    halfAmount,
      sgstAmount:    otherHalf,
      igstAmount:    0,
      totalTaxAmount,
      taxableAmount: taxableAmountPaise,
      isInterState:  false,
      calculatedAt:  now,
    };
  },
};
