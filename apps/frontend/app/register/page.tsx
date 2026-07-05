import { Navbar } from "@/components/navbar";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Register — CelebStyle" };

export default function RegisterPage() {
  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <p className="text-xs uppercase tracking-[0.36em] text-accent">Create Account</p>
        <h1 className="mt-3 font-serif text-4xl text-primary">Register</h1>
        <p className="mt-2 text-sm text-text/70">
          Join CelebStyle to access exclusive celebrity fashion.
        </p>
        <RegisterForm />
      </section>
    </main>
  );
}
