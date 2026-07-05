"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/lib/api";

type FieldErrors = { password?: string; confirm?: string };

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="mt-8 rounded-[28px] border border-red-200 bg-red-50 p-8 shadow-sm">
        <p className="text-base font-medium text-red-800">Invalid reset link</p>
        <p className="mt-2 text-sm text-red-700">
          This link is missing a reset token. Please request a new password reset.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
        >
          Request Reset Link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="mt-8 rounded-[28px] border border-green-200 bg-green-50 p-8 shadow-sm">
        <p className="text-base font-medium text-green-800">Password reset successfully</p>
        <p className="mt-2 text-sm text-green-700">
          Your password has been updated. All existing sessions have been signed out for security.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
        >
          Sign In with New Password
        </Link>
      </div>
    );
  }

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!password) next.password = "Password is required.";
    else if (password.length < 8) next.password = "Password must be at least 8 characters.";
    else if (password.length > 128) next.password = "Password must be 128 characters or fewer.";
    if (!confirm) next.confirm = "Please confirm your password.";
    else if (password && confirm !== password) next.confirm = "Passwords do not match.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError("");
    if (!validate()) return;

    setLoading(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Reset failed. Please try again.";
      setApiError(msg);
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
      <p className="text-sm text-text/70">
        Choose a new password for your account. The link expires in 1 hour.
      </p>

      {apiError && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {apiError}
          {(apiError.toLowerCase().includes("expired") ||
            apiError.toLowerCase().includes("invalid")) && (
            <span>
              {" "}
              <Link href="/forgot-password" className="font-medium underline underline-offset-4">
                Request a new link
              </Link>
            </span>
          )}
        </div>
      )}

      <div className="mt-5 space-y-4">
        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">
            New Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-xl border border-black/10 bg-background px-4 py-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
            placeholder="At least 8 characters"
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-600">{errors.password}</p>
          )}
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-text/60">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="w-full rounded-xl border border-black/10 bg-background px-4 py-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
            placeholder="Repeat your password"
          />
          {errors.confirm && (
            <p className="mt-1 text-xs text-red-600">{errors.confirm}</p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full rounded-full bg-primary py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Resetting password…" : "Reset Password"}
      </button>
    </form>
  );
}
