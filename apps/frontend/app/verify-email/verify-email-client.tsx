"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { verifyEmail, resendVerification } from "@/lib/api";

type Phase =
  | { kind: "verifying" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string }
  | { kind: "resend" }
  | { kind: "resend_sent" };

export function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const didRun = useRef(false);

  const [phase, setPhase] = useState<Phase>(
    token ? { kind: "verifying" } : { kind: "resend" }
  );

  // Auto-submit when a token is present in the URL
  useEffect(() => {
    if (!token || didRun.current) return;
    didRun.current = true;

    verifyEmail(token)
      .then(({ message }) => setPhase({ kind: "success", message }))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Verification failed.";
        setPhase({ kind: "error", message: msg });
      });
  }, [token]);

  if (phase.kind === "verifying") {
    return (
      <div className="mt-8 flex flex-col items-center gap-4 rounded-[28px] border border-black/6 bg-white p-10 shadow-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-primary" />
        <p className="text-sm text-text/60">Verifying your email…</p>
      </div>
    );
  }

  if (phase.kind === "success") {
    return (
      <div className="mt-8 rounded-[28px] border border-green-200 bg-green-50 p-8 shadow-sm">
        <p className="text-base font-medium text-green-800">{phase.message}</p>
        <p className="mt-2 text-sm text-green-700">
          You can now sign in to your account.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-medium text-background transition hover:opacity-90"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (phase.kind === "error") {
    return (
      <div className="mt-8 space-y-4">
        <div className="rounded-[28px] border border-red-200 bg-red-50 p-8 shadow-sm">
          <p className="text-base font-medium text-red-800">Verification failed</p>
          <p className="mt-2 text-sm text-red-700">{phase.message}</p>
          <p className="mt-2 text-sm text-red-700">
            The link may have expired (links are valid for 24 hours) or already been used.
          </p>
        </div>
        <button
          onClick={() => setPhase({ kind: "resend" })}
          className="w-full rounded-full border border-black/10 py-3 text-sm font-medium text-primary transition hover:bg-black/5"
        >
          Request a new verification link
        </button>
      </div>
    );
  }

  if (phase.kind === "resend_sent") {
    return (
      <div className="mt-8 rounded-[28px] border border-green-200 bg-green-50 p-8 shadow-sm">
        <p className="text-base font-medium text-green-800">Check your inbox</p>
        <p className="mt-2 text-sm text-green-700">
          If your email is registered and unverified, a new verification link has been sent.
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

  // phase.kind === "resend"
  return <ResendForm onSent={() => setPhase({ kind: "resend_sent" })} />;
}

function ResendForm({ onSent }: { onSent: () => void }) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [apiError, setApiError] = useState("");
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
      await resendVerification(email.trim().toLowerCase());
      onSent();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Request failed. Please try again.");
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
        Enter your email address to receive a new verification link.
      </p>

      {apiError && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {apiError}
        </div>
      )}

      <div className="mt-5">
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
        {loading ? "Sending…" : "Send Verification Link"}
      </button>
    </form>
  );
}
