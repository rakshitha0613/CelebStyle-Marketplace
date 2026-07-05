import type { Metadata } from "next";
import { Suspense } from "react";
import { Navbar } from "@/components/navbar";
import { VerifyEmailClient } from "./verify-email-client";

export const metadata: Metadata = {
  title: "Verify Email — CelebStyle",
  description: "Verify your CelebStyle email address.",
};

export default function VerifyEmailPage() {
  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Account Security</p>
        <h1 className="mt-3 font-serif text-4xl text-primary">Email Verification</h1>
        <Suspense>
          <VerifyEmailClient />
        </Suspense>
      </section>
    </main>
  );
}
