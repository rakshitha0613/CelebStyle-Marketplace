/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  // All images are served from /public/assets/ — no external domains needed.
  images: {
    remotePatterns: [],
  },

  // Reversible dev flag (Phase 6 of the Virtual Try-On pilot): set
  // TRYON_PILOT_MODE=true (no NEXT_PUBLIC_ prefix needed) to restrict /try-on
  // to the 10 TRYON_PILOT_OUTFITS. Mapped here to a client-visible env var
  // since TryOnClient reads it in the browser.
  env: {
    NEXT_PUBLIC_TRYON_PILOT_MODE: process.env.TRYON_PILOT_MODE ?? "",
  },

  webpack(config) {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false };
    config.module.rules.push({ test: /\.wasm$/, type: "asset/resource" });
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
