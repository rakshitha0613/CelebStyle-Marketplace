import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CelebStyle",
  description: "Celebrity Fashion Replica Marketplace — wear what your icon wears.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
