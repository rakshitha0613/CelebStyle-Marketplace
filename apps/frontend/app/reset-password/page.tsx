import type { Metadata } from "next";
import { Suspense } from "react";
import { Navbar } from "@/components/navbar";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Reset Password — CelebStyle",
  description: "Set a new password for your CelebStyle account.",
};

export default function ResetPasswordPage() {
  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Account Security</p>
        <h1 className="mt-3 font-serif text-4xl text-primary">Reset Password</h1>
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </section>
    </main>
  );
}
