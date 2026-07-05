"use client";

import { useState } from "react";
import Link from "next/link";
import { forgotPassword } from "@/lib/api";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [apiError, setApiError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    setApiError("");

    if (!email.trim()) {
      setEmailError("Email is required.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setEmailError("Enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="mt-8 rounded-[28px] border border-green-200 bg-green-50 p-8 shadow-sm">
        <p className="text-base font-medium text-green-800">Check your inbox</p>
        <p className="mt-2 text-sm text-green-700">
          If an account with that email exists, a password reset link has been sent. The link
          expires in 1 hour.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm text-accent underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

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
        {emailError && <p className="mt-1 text-xs text-red-600">{emailError}</p>}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full rounded-full bg-primary py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Sending…" : "Send Reset Link"}
      </button>

      <p className="mt-5 text-center text-xs text-text/60">
        Remember your password?{" "}
        <Link href="/login" className="text-accent underline-offset-4 hover:underline">
          Sign In
        </Link>
      </p>
    </form>
  );
}
