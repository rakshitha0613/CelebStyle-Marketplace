"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import {
  getStoredToken,
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from "@/lib/api";
import type { Address } from "@/lib/api";

type FormState = {
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefaultShipping: boolean;
};

const EMPTY_FORM: FormState = {
  label: "",
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  isDefaultShipping: false,
};

const INPUT_CLS =
  "w-full rounded-xl border border-black/10 bg-background px-4 py-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/30";

function formFromAddress(a: Address): FormState {
  return {
    label: a.label ?? "",
    fullName: a.fullName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2 ?? "",
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    country: a.country,
    isDefaultShipping: a.isDefaultShipping,
  };
}

function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.fullName.trim()) errors.fullName = "Full name is required.";
  if (!form.phone.trim()) errors.phone = "Phone is required.";
  else if (!/^\+?[\d\s\-()\\.]{7,20}$/.test(form.phone.trim()))
    errors.phone = "Enter a valid phone number.";
  if (!form.line1.trim()) errors.line1 = "Address line 1 is required.";
  if (!form.city.trim()) errors.city = "City is required.";
  if (!form.state.trim()) errors.state = "State is required.";
  if (!form.pincode.trim()) errors.pincode = "PIN code is required.";
  else if (!/^\d{6}$/.test(form.pincode.trim()))
    errors.pincode = "PIN code must be 6 digits.";
  return errors;
}

export default function AddressesPage() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!getStoredToken()) {
      router.replace("/login?redirect=/addresses");
      return;
    }
    getAddresses().then((data) => {
      setAddresses(data);
      setLoading(false);
    });
  }, [router]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFieldErrors({});
    setApiError("");
    setShowForm(true);
  };

  const openEdit = (address: Address) => {
    setForm(formFromAddress(address));
    setEditingId(address.id);
    setFieldErrors({});
    setApiError("");
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFieldErrors({});
    setApiError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    setApiError("");
    try {
      if (editingId) {
        const updated = await updateAddress(editingId, {
          label: form.label.trim() || null,
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          line1: form.line1.trim(),
          line2: form.line2.trim() || null,
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode.trim(),
          country: form.country.trim() || "India",
          isDefaultShipping: form.isDefaultShipping,
        });
        setAddresses((prev) => {
          const list = prev.map((a) =>
            form.isDefaultShipping ? { ...a, isDefaultShipping: false } : a
          );
          return list.map((a) => (a.id === editingId ? updated : a));
        });
      } else {
        const created = await createAddress({
          label: form.label.trim() || null,
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          line1: form.line1.trim(),
          line2: form.line2.trim() || null,
          city: form.city.trim(),
          state: form.state.trim(),
          pincode: form.pincode.trim(),
          country: form.country.trim() || "India",
          isDefaultShipping: form.isDefaultShipping,
        });
        setAddresses((prev) => {
          const list = form.isDefaultShipping
            ? prev.map((a) => ({ ...a, isDefaultShipping: false }))
            : prev;
          return [...list, created];
        });
      }
      cancelForm();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to save address.");
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (address: Address) => {
    if (address.isDefaultShipping) return;
    try {
      const updated = await updateAddress(address.id, { isDefaultShipping: true });
      setAddresses((prev) =>
        prev.map((a) =>
          a.id === updated.id
            ? updated
            : { ...a, isDefaultShipping: false }
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to set default.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this address?")) return;
    setDeletingId(id);
    try {
      await deleteAddress(id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete address.");
    } finally {
      setDeletingId(null);
    }
  };

  const field = (key: keyof FormState) => ({
    value: String(form[key]),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Account</p>
        <h1 className="mt-3 font-serif text-5xl text-primary">Address Book</h1>

        {loading ? (
          <div className="mt-16 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-primary" />
          </div>
        ) : (
          <>
            {/* Address list */}
            <div className="mt-10 space-y-4">
              {addresses.length === 0 && !showForm && (
                <div className="rounded-[24px] border border-black/6 bg-white p-10 text-center shadow-sm">
                  <p className="font-serif text-xl text-primary">No saved addresses</p>
                  <p className="mt-2 text-sm text-text/60">
                    Add an address to speed up checkout.
                  </p>
                </div>
              )}
              {addresses.map((address) => (
                <div
                  key={address.id}
                  className={`rounded-[24px] border bg-white p-6 shadow-sm ${
                    address.isDefaultShipping
                      ? "border-accent/40"
                      : "border-black/6"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5 text-sm">
                      {address.label && (
                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent mb-1">
                          {address.label}
                        </p>
                      )}
                      <p className="font-medium text-primary">{address.fullName}</p>
                      <p className="text-text/70">{address.phone}</p>
                      <p className="text-text/70">
                        {address.line1}
                        {address.line2 ? `, ${address.line2}` : ""}
                      </p>
                      <p className="text-text/70">
                        {address.city}, {address.state} {address.pincode}
                      </p>
                      <p className="text-text/70">{address.country}</p>
                      {address.isDefaultShipping && (
                        <span className="inline-block mt-2 rounded-full bg-accent/10 px-3 py-0.5 text-xs font-medium text-accent">
                          Default shipping
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <button
                        onClick={() => openEdit(address)}
                        className="rounded-full border border-black/10 px-4 py-1.5 text-xs font-medium text-primary transition hover:bg-black/5"
                      >
                        Edit
                      </button>
                      {!address.isDefaultShipping && (
                        <button
                          onClick={() => handleSetDefault(address)}
                          className="rounded-full border border-black/10 px-4 py-1.5 text-xs font-medium text-primary transition hover:bg-black/5"
                        >
                          Set default
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(address.id)}
                        disabled={deletingId === address.id}
                        className="rounded-full border border-red-200 px-4 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingId === address.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add button */}
            {!showForm && (
              <button
                onClick={openAdd}
                className="mt-6 w-full rounded-full border border-black/10 py-3 text-sm font-medium text-primary transition hover:bg-black/5"
              >
                + Add New Address
              </button>
            )}

            {/* Address form */}
            {showForm && (
              <form
                onSubmit={handleSubmit}
                noValidate
                className="mt-6 space-y-4 rounded-[28px] border border-black/6 bg-white p-8 shadow-sm"
              >
                <p className="text-xs uppercase tracking-[0.28em] text-accent">
                  {editingId ? "Edit Address" : "New Address"}
                </p>

                {apiError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {apiError}
                  </div>
                )}

                <Field label="Label" error={fieldErrors.label} hint="e.g. Home, Office (optional)">
                  <input type="text" {...field("label")} placeholder="Home" className={INPUT_CLS} />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full Name" error={fieldErrors.fullName} required>
                    <input type="text" {...field("fullName")} placeholder="Rakshitha Rachu" className={INPUT_CLS} />
                  </Field>
                  <Field label="Phone" error={fieldErrors.phone} required>
                    <input type="tel" {...field("phone")} placeholder="+91 98765 43210" className={INPUT_CLS} />
                  </Field>
                </div>

                <Field label="Address Line 1" error={fieldErrors.line1} required>
                  <input type="text" {...field("line1")} placeholder="Street, building, floor" className={INPUT_CLS} />
                </Field>

                <Field label="Address Line 2" error={fieldErrors.line2}>
                  <input type="text" {...field("line2")} placeholder="Apartment, suite (optional)" className={INPUT_CLS} />
                </Field>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="City" error={fieldErrors.city} required>
                    <input type="text" {...field("city")} placeholder="Mumbai" className={INPUT_CLS} />
                  </Field>
                  <Field label="State" error={fieldErrors.state} required>
                    <input type="text" {...field("state")} placeholder="Maharashtra" className={INPUT_CLS} />
                  </Field>
                  <Field label="PIN Code" error={fieldErrors.pincode} required>
                    <input type="text" {...field("pincode")} placeholder="400001" maxLength={6} className={INPUT_CLS} />
                  </Field>
                </div>

                <Field label="Country" error={fieldErrors.country}>
                  <input type="text" {...field("country")} placeholder="India" className={INPUT_CLS} />
                </Field>

                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={form.isDefaultShipping}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isDefaultShipping: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-black/20 accent-primary"
                  />
                  <span className="text-sm text-text/70">Set as default shipping address</span>
                </label>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : editingId ? "Save Changes" : "Add Address"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="rounded-full border border-black/10 px-6 py-2.5 text-sm font-medium text-primary transition hover:bg-black/5"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function Field({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-text/40">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
