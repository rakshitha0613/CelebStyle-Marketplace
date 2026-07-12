import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { AdminLoginForm } from "./admin-login-form";

export const metadata: Metadata = {
  title: "Admin Portal — CelebStyle",
  description: "Sign in to the CelebStyle admin portal.",
};

export default function AdminLoginPage() {
  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <p className="text-xs uppercase tracking-[0.36em] text-indigo-600">Admin Portal</p>
        </div>
        <h1 className="mt-3 font-serif text-4xl text-primary">Admin Sign In</h1>
        <p className="mt-2 text-sm text-text/70">
          Restricted access. Administrator credentials required.
        </p>
        <AdminLoginForm />
      </section>
    </main>
  );
}
