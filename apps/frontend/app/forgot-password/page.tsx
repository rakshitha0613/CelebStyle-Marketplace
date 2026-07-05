import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot Password — CelebStyle",
  description: "Reset your CelebStyle account password.",
};

export default function ForgotPasswordPage() {
  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Account Recovery</p>
        <h1 className="mt-3 font-serif text-4xl text-primary">Forgot Password</h1>
        <p className="mt-2 text-sm text-text/70">
          Enter your email and we&apos;ll send a reset link if an account exists.
        </p>
        <ForgotPasswordForm />
      </section>
    </main>
  );
}
