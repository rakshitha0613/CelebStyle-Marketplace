import type { Metadata } from "next";
import { Suspense } from "react";
import { Navbar } from "@/components/navbar";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign In — CelebStyle",
  description: "Sign in to your CelebStyle account.",
};

export default function LoginPage() {
  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Welcome back</p>
        <h1 className="mt-3 font-serif text-4xl text-primary">Sign In</h1>
        <p className="mt-2 text-sm text-text/70">
          Access your orders and exclusive celebrity fashion.
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
