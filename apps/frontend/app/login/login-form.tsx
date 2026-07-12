"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { customerLogin } from "@/lib/api";

type FieldErrors = { email?: string; password?: string };

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState("");
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
    if (!validate()) return;
    setLoading(true);
    try {
      const user = await customerLogin(email, password);
      const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
      router.push(isAdmin ? "/admin" : redirect);
      router.refresh();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-8 rounded-[28px] border border-black/6 bg-white p-8 shadow-sm"
    >
      {apiError && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {apiError}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full rounded-xl border border-black/10 bg-background px-4 py-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
            placeholder="you@example.com"
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
            className="w-full rounded-xl border border-black/10 bg-background px-4 py-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
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
        className="mt-6 w-full rounded-full bg-primary py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Sign In"}
      </button>

      <div className="mt-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-black/8" />
        <span className="text-[11px] font-medium uppercase tracking-widest text-text/35">or</span>
        <div className="h-px flex-1 bg-black/8" />
      </div>

      <Link
        href="/admin/login"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-black/10 py-3 text-sm font-medium text-text/60 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        Admin Login
      </Link>

      <div className="mt-5 flex items-center justify-between text-xs text-text/60">
        <span>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-accent underline-offset-4 hover:underline">
            Register
          </Link>
        </span>
        <Link href="/forgot-password" className="text-accent underline-offset-4 hover:underline">
          Forgot password?
        </Link>
      </div>
    </form>
  );
}
