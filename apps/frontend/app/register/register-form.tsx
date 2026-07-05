"use client";

import { useState } from "react";
import Link from "next/link";
import { registerUser } from "@/lib/api";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const INPUT_CLS =
  "w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm text-primary placeholder:text-text/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

export function RegisterForm() {
  const [name, setName]                   = useState("");
  const [email, setEmail]                 = useState("");
  const [password, setPassword]           = useState("");
  const [confirm, setConfirm]             = useState("");
  const [errors, setErrors]               = useState<Record<string, string>>({});
  const [serverError, setServerError]     = useState("");
  const [loading, setLoading]             = useState(false);
  const [success, setSuccess]             = useState(false);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!name.trim())                        next.name     = "Name is required.";
    else if (name.trim().length > 100)      next.name     = "Name must be 100 characters or fewer.";
    if (!email.trim())                       next.email    = "Email is required.";
    else if (!EMAIL_RE.test(email.trim()))   next.email    = "Enter a valid email address.";
    if (!password)                           next.password = "Password is required.";
    else if (password.length < 8)           next.password = "Password must be at least 8 characters.";
    else if (password.length > 128)         next.password = "Password must be 128 characters or fewer.";
    if (!confirm)                            next.confirm  = "Please confirm your password.";
    else if (confirm !== password)          next.confirm  = "Passwords do not match.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    if (!validate()) return;
    setLoading(true);
    try {
      await registerUser(name.trim(), email.trim().toLowerCase(), password);
      setSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed. Please try again.";
      if (msg.toLowerCase().includes("already")) {
        setServerError("An account with this email already exists.");
      } else {
        setServerError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="mt-8 rounded-[28px] border border-black/6 bg-white p-8 shadow-sm">
        <p className="font-serif text-2xl text-primary">Account created</p>
        <p className="mt-3 text-sm text-text/70">
          Check your email to verify your account before signing in.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="inline-flex rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
          >
            Sign In
          </Link>
          <Link
            href="/verify-email"
            className="inline-flex rounded-full border border-black/10 px-6 py-2.5 text-sm font-medium text-primary transition hover:bg-black/5"
          >
            Resend verification email
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5 rounded-[28px] border border-black/6 bg-white p-8 shadow-sm">
      {/* Name */}
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
          autoComplete="name"
          className={INPUT_CLS}
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
      </div>

      {/* Email */}
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className={INPUT_CLS}
        />
        {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
      </div>

      {/* Password */}
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          className={INPUT_CLS}
        />
        {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
      </div>

      {/* Confirm Password */}
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">
          Confirm Password
        </label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Re-enter your password"
          autoComplete="new-password"
          className={INPUT_CLS}
        />
        {errors.confirm && <p className="mt-1 text-xs text-red-600">{errors.confirm}</p>}
      </div>

      {serverError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-primary py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-xs text-text/50">
        Already have an account?{" "}
        <Link href="/login" className="text-accent underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
