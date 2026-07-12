"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { adminLogin, getCurrentUser } from "@/lib/api";

type FieldErrors = { email?: string; password?: string };

export function AdminLoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!email.trim()) next.email = "Email is required.";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) next.email = "Enter a valid email.";
    if (!password) next.password = "Password is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError("");
    setAccessDenied(false);
    if (!validate()) return;
    setLoading(true);
    try {
      await adminLogin(email, password);
      const user = getCurrentUser();
      if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
        setAccessDenied(true);
        // Clear stored token — non-admin shouldn't stay logged in here
        localStorage.removeItem("celebstyle-admin-token");
        localStorage.removeItem("celebstyle-customer-token");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (accessDenied) {
    return (
      <div className="mt-8 rounded-[28px] border border-red-100 bg-white p-8 shadow-sm text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h2 className="mt-4 font-serif text-xl text-primary">Access Denied</h2>
        <p className="mt-2 text-sm text-text/70">
          This account does not have administrator privileges.
          Only ADMIN and SUPER_ADMIN roles can access the admin portal.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={() => { setAccessDenied(false); setEmail(""); setPassword(""); }}
            className="w-full rounded-full bg-indigo-600 py-3 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            Try a different account
          </button>
          <Link
            href="/"
            className="w-full rounded-full border border-black/10 py-3 text-center text-sm text-text/60 transition hover:bg-secondary hover:text-primary"
          >
            Back to homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-8 rounded-[28px] border border-indigo-100 bg-white p-8 shadow-sm"
    >
      {apiError && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {apiError}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">
            Admin Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            className="w-full rounded-xl border border-black/10 bg-background px-4 py-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
            placeholder="admin@celebstyle.com"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600">{errors.email}</p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-xl border border-black/10 bg-background px-4 py-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-600">{errors.password}</p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full rounded-full bg-indigo-600 py-3 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Sign In to Admin Portal"}
      </button>

      <div className="mt-5 text-center text-xs text-text/50">
        Not an admin?{" "}
        <Link href="/login" className="text-indigo-600 underline-offset-4 hover:underline">
          User login
        </Link>
      </div>
    </form>
  );
}
