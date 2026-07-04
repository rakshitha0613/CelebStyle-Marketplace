// Integer paise arithmetic — never use floating-point for money.
// 100 paise = ₹1. All amounts stored in the DB are integers in paise.
//
// NOTE: Existing Product.basePrice and Order fields are stored in rupees (pre-Sprint 4
// data). When converting those values for new commerce flows, always call toPaise().

export const Money = {
  toPaise(rupees: number): number {
    return Math.round(rupees * 100);
  },

  toRupees(paise: number): number {
    return paise / 100;
  },

  format(paise: number): string {
    return `₹${(paise / 100).toFixed(2)}`;
  },

  add(...amounts: number[]): number {
    return amounts.reduce((sum, a) => sum + a, 0);
  },

  multiply(paise: number, quantity: number): number {
    return paise * quantity;
  },

  percentOf(paise: number, percent: number): number {
    return Math.round((paise * percent) / 100);
  },
} as const;
