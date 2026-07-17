"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { createOrder, simulatePayment, getStoredToken, getCurrentUser, getAddresses, lookupCoupon } from "@/lib/api";
import type { CouponResult } from "@/lib/api";

type CartItem = {
  outfitId: string;
  outfitName: string;
  celebrityId: string;
  celebrityName: string;
  price: number;
  imageUrl: string;
  category: string;
  size: string;
  quantity?: number;
  manufacturerIds: string[];
};

const CART_KEY = "celebstyle-cart";

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(CART_KEY) || "[]") as CartItem[];
  } catch { return []; }
}

const PAYMENT_METHODS = [
  { id: "upi", label: "UPI", icon: "⚡", sub: "Google Pay, PhonePe, Paytm" },
  { id: "card", label: "Credit / Debit Card", icon: "💳", sub: "Visa, Mastercard, RuPay" },
  { id: "netbanking", label: "Net Banking", icon: "🏦", sub: "All major banks" },
  { id: "wallet", label: "Wallet", icon: "👛", sub: "Paytm, MobiKwik, Amazon Pay" },
];

function RazorpayModal({
  total,
  email,
  onPay,
  onClose,
}: {
  total: number;
  email: string;
  onPay: (method: string) => Promise<void>;
  onClose: () => void;
}) {
  const [selectedMethod, setSelectedMethod] = useState("upi");
  const [upiId, setUpiId] = useState("");
  const [paying, setPaying] = useState(false);
  const [step, setStep] = useState<"choose" | "processing" | "success">("choose");

  const handlePay = async () => {
    setPaying(true);
    setStep("processing");
    // Simulate Razorpay gateway delay
    await new Promise((r) => setTimeout(r, 1800));
    try {
      await onPay(selectedMethod);
      setStep("success");
    } catch {
      setPaying(false);
      setStep("choose");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-[28px] bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#072654] px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs">Razorpay Secure</p>
            <p className="text-white font-semibold text-lg">₹{total.toLocaleString("en-IN")}</p>
            <p className="text-white/60 text-xs">{email}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white/40 text-xs">🔒 Secured</span>
            <button onClick={onClose} className="ml-2 text-white/50 hover:text-white text-xl leading-none">×</button>
          </div>
        </div>

        <div className="p-6">
          {step === "choose" && (
            <>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-text/50 mb-3">Select Payment Method</p>
              <div className="space-y-2">
                {PAYMENT_METHODS.map((m) => (
                  <label key={m.id} className={`flex items-center gap-3 rounded-xl border-2 p-3 cursor-pointer transition ${selectedMethod === m.id ? "border-[#072654] bg-[#072654]/5" : "border-black/8 hover:border-black/20"}`}>
                    <input type="radio" name="payment" value={m.id} checked={selectedMethod === m.id} onChange={() => setSelectedMethod(m.id)} className="sr-only" />
                    <span className="text-xl">{m.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-primary">{m.label}</p>
                      <p className="text-xs text-text/50">{m.sub}</p>
                    </div>
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition ${selectedMethod === m.id ? "border-[#072654]" : "border-black/20"}`}>
                      {selectedMethod === m.id && <div className="h-2 w-2 rounded-full bg-[#072654]" />}
                    </div>
                  </label>
                ))}
              </div>
              {selectedMethod === "upi" && (
                <div className="mt-3">
                  <input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="yourname@upi" className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#072654]/20" />
                </div>
              )}
              <button onClick={handlePay} disabled={paying} className="mt-4 w-full rounded-full bg-[#072654] py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition">
                Pay ₹{total.toLocaleString("en-IN")}
              </button>
              <p className="text-center text-xs text-text/30 mt-3">🔒 256-bit SSL encryption · Simulated gateway</p>
            </>
          )}

          {step === "processing" && (
            <div className="text-center py-8 space-y-4">
              <div className="h-12 w-12 rounded-full border-4 border-[#072654]/20 border-t-[#072654] animate-spin mx-auto" />
              <p className="text-primary font-medium">Processing Payment…</p>
              <p className="text-sm text-text/50">Please wait while we confirm with your bank</p>
            </div>
          )}

          {step === "success" && (
            <div className="text-center py-8 space-y-3">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto text-2xl">✓</div>
              <p className="text-primary font-medium">Payment Successful!</p>
              <p className="text-sm text-text/50">Redirecting to your order…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState<CouponResult | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");

  useEffect(() => {
    if (!getStoredToken()) { router.replace("/login?redirect=/checkout"); return; }
    setItems(readCart());
    const user = getCurrentUser();
    if (user?.email) setCustomerEmail(user.email);
    getAddresses().then((addresses) => {
      const def = addresses.find((a) => a.isDefaultShipping);
      if (def) {
        const parts = [`${def.fullName}, ${def.phone}`, def.line1, def.line2, `${def.city}, ${def.state} ${def.pincode}`, def.country].filter(Boolean);
        setAddress(parts.join("\n"));
      }
    });
  }, [router]);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price * (item.quantity ?? 1), 0), [items]);
  const discount = couponResult?.valid ? couponResult.discountRupees : 0;
  const shipping = (subtotal - discount) >= 25000 ? 0 : 499;
  const total = subtotal - discount + shipping;

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError("");
    setCouponResult(null);
    try {
      const result = await lookupCoupon(couponCode.trim(), subtotal);
      setCouponResult(result);
      if (!result.valid) setCouponError(result.message);
    } catch {
      setCouponError("Invalid or expired coupon code");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleProceed = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Backend order items are one unit each — expand quantity>1 lines into
      // repeated entries rather than changing the order API's item shape.
      const expandedItems = items.flatMap((item) =>
        Array.from({ length: item.quantity ?? 1 }, () => {
          const { quantity: _quantity, ...rest } = item;
          return rest;
        })
      );
      const order = await createOrder({ customerName, customerEmail, address, paymentMethod: "Razorpay", items: expandedItems });
      setPendingOrderId(order.id);
      setShowModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setLoading(false);
    }
  };

  const handleModalPay = async (method: string) => {
    if (!pendingOrderId) throw new Error("No order");
    const paid = await simulatePayment(pendingOrderId);
    window.localStorage.removeItem(CART_KEY);
    window.dispatchEvent(new Event("storage"));
    router.push(`/orders/${paid.id}?paid=1`);
  };

  return (
    <main>
      <Navbar />
      {showModal && pendingOrderId && (
        <RazorpayModal
          total={total}
          email={customerEmail}
          onPay={handleModalPay}
          onClose={() => { setShowModal(false); setPendingOrderId(null); }}
        />
      )}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.36em] text-accent">Checkout</p>
            <h1 className="mt-3 font-serif text-5xl text-primary">Complete your order</h1>
          </div>
          <Link href="/cart" className="text-sm font-medium text-accent underline-offset-4 hover:underline">Back to cart</Link>
        </div>

        {items.length === 0 ? (
          <div className="mt-10 rounded-[24px] border border-black/6 bg-white p-12 text-center shadow-sm">
            <p className="font-serif text-2xl text-primary">No items in cart</p>
            <Link href="/search" className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-medium text-background transition hover:opacity-90">Browse looks</Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_360px]">
            <form onSubmit={handleProceed} className="space-y-4 rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.28em] text-accent">Delivery Details</p>
              {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Full Name</label>
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required className="w-full rounded-xl border border-black/10 bg-background px-4 py-3 text-sm text-primary" placeholder="Your name" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Email</label>
                <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} required className="w-full rounded-xl border border-black/10 bg-background px-4 py-3 text-sm text-primary" placeholder="you@example.com" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Delivery Address</label>
                <textarea value={address} onChange={(e) => setAddress(e.target.value)} required rows={4} className="w-full rounded-xl border border-black/10 bg-background px-4 py-3 text-sm text-primary" placeholder="Street, city, state, pincode" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Coupon Code (optional)</label>
                <div className="flex gap-2">
                  <input
                    value={couponCode}
                    onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponResult(null); setCouponError(""); }}
                    placeholder="Enter code"
                    className="flex-1 rounded-xl border border-black/10 bg-background px-4 py-3 text-sm text-primary uppercase tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={couponLoading || !couponCode.trim()}
                    className="rounded-xl bg-secondary px-4 py-3 text-sm font-medium text-primary transition hover:opacity-80 disabled:opacity-40"
                  >
                    {couponLoading ? "..." : "Apply"}
                  </button>
                </div>
                {couponResult?.valid && (
                  <p className="mt-1.5 text-xs text-green-700 font-medium">
                    ✓ {couponResult.message} (−₹{couponResult.discountRupees.toLocaleString("en-IN")})
                  </p>
                )}
                {couponError && <p className="mt-1.5 text-xs text-red-600">{couponError}</p>}
              </div>
              <div className="rounded-xl border border-[#072654]/20 bg-[#072654]/5 px-4 py-3 flex items-center gap-3">
                <span className="text-xl">🔒</span>
                <div>
                  <p className="text-sm font-medium text-primary">Secured by Razorpay</p>
                  <p className="text-xs text-text/50">UPI, Cards, Net Banking, Wallets accepted</p>
                </div>
              </div>
              <button disabled={loading} className="w-full rounded-full bg-primary py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50">
                {loading ? "Creating order…" : `Proceed to Pay ₹${total.toLocaleString("en-IN")}`}
              </button>
            </form>

            <aside className="h-fit rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.28em] text-accent">Order Summary</p>
              <div className="mt-4 space-y-3 text-sm text-text/70">
                <div className="flex justify-between"><span>Items ({items.length})</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-700 font-medium">
                    <span>Coupon ({couponResult?.code})</span>
                    <span>−₹{discount.toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between"><span>Shipping</span><span>{shipping === 0 ? "Free" : `₹${shipping.toLocaleString("en-IN")}`}</span></div>
                <div className="flex justify-between border-t border-black/6 pt-3 text-base font-medium text-primary"><span>Total</span><span>₹{total.toLocaleString("en-IN")}</span></div>
              </div>
              {(subtotal - discount) < 25000 && (
                <p className="mt-3 text-xs text-text/40">
                  Free shipping on orders over ₹25,000 (₹{(25000 - (subtotal - discount)).toLocaleString("en-IN")} away)
                </p>
              )}
              <div className="mt-6 space-y-2">
                {items.map((item) => (
                  <div key={`${item.outfitId}-${item.size}`} className="rounded-2xl border border-black/6 px-4 py-3 flex gap-3">
                    <img src={item.imageUrl} alt="" className="h-12 w-10 rounded-lg object-cover flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{item.outfitName}</p>
                      <p className="text-xs text-text/60">{item.celebrityName} · Size {item.size} · Qty {item.quantity ?? 1}</p>
                      <p className="text-xs font-medium text-primary">₹{(item.price * (item.quantity ?? 1)).toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
