"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { createOrder, payOrder } from "@/lib/api";

type CartItem = {
  outfitId: string;
  outfitName: string;
  celebrityId: string;
  celebrityName: string;
  price: number;
  imageUrl: string;
  category: string;
  size: string;
  manufacturerIds: string[];
};

const CART_KEY = "celebstyle-cart";

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(CART_KEY) || "[]") as CartItem[];
  } catch {
    return [];
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Razorpay Demo");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setItems(readCart());
  }, []);

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.price, 0), [items]);
  const shipping = subtotal >= 25000 ? 0 : 499;
  const total = subtotal + shipping;

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const order = await createOrder({
        customerName,
        customerEmail,
        address,
        paymentMethod,
        items
      });
      const paid = await payOrder(order.id);
      window.localStorage.removeItem(CART_KEY);
      window.dispatchEvent(new Event("storage"));
      router.push(`/orders/${paid.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.36em] text-accent">Checkout</p>
            <h1 className="mt-3 font-serif text-5xl text-primary">Complete your order</h1>
          </div>
          <Link href="/cart" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
            Back to cart
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="mt-10 rounded-[24px] border border-black/6 bg-white p-12 text-center shadow-sm">
            <p className="font-serif text-2xl text-primary">No items in cart</p>
            <Link href="/search" className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-medium text-background transition hover:opacity-90">
              Browse looks
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_360px]">
            <form onSubmit={handlePay} className="space-y-4 rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.28em] text-accent">Customer Details</p>
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
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">Payment Method</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full rounded-xl border border-black/10 bg-background px-4 py-3 text-sm text-primary">
                  <option value="Razorpay Demo">Razorpay Demo</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Credit / Debit Card</option>
                  <option value="Net Banking">Net Banking</option>
                </select>
              </div>
              <button disabled={loading} className="w-full rounded-full bg-primary py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50">
                {loading ? "Processing payment..." : "Pay with Razorpay Demo"}
              </button>
            </form>

            <aside className="h-fit rounded-[24px] border border-black/6 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.28em] text-accent">Order Summary</p>
              <div className="mt-4 space-y-3 text-sm text-text/70">
                <div className="flex justify-between"><span>Items</span><span>{items.length}</span></div>
                <div className="flex justify-between"><span>Subtotal</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div>
                <div className="flex justify-between"><span>Shipping</span><span>{shipping === 0 ? "Free" : `₹${shipping.toLocaleString("en-IN")}`}</span></div>
                <div className="flex justify-between border-t border-black/6 pt-3 text-base font-medium text-primary"><span>Total</span><span>₹{total.toLocaleString("en-IN")}</span></div>
              </div>
              <div className="mt-6 space-y-2">
                {items.map((item) => (
                  <div key={`${item.outfitId}-${item.size}`} className="rounded-2xl border border-black/6 px-4 py-3 text-sm">
                    <p className="font-medium text-primary">{item.outfitName}</p>
                    <p className="text-text/60">{item.celebrityName} · Size {item.size}</p>
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
