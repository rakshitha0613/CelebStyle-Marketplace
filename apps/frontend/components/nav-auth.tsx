"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCurrentUser, adminLogout, customerLogout } from "@/lib/api";

export function NavAuth() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; role: string } | null | "loading">("loading");

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  const handleLogout = () => {
    adminLogout();
    customerLogout();
    setUser(null);
    router.push("/");
    router.refresh();
  };

  // Avoid hydration mismatch — render nothing until client has read localStorage
  if (user === "loading") return null;

  if (!user) {
    return (
      <>
        <Link href="/register">Register</Link>
        <Link href="/login">Login</Link>
      </>
    );
  }

  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  return (
    <>
      <Link href="/orders">Orders</Link>
      <Link href="/profile">Profile</Link>
      {isAdmin && <Link href="/admin">Admin CMS</Link>}
      <button
        onClick={handleLogout}
        className="text-sm font-medium text-text transition hover:text-accent"
      >
        Logout
      </button>
    </>
  );
}
