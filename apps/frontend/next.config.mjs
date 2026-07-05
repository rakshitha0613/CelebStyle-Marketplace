/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output bundles the minimal server for Docker
  output: "standalone",

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "image.thum.io" },
    ],
  },
  webpack(config) {
    // Allow WASM imports (required by @mediapipe/tasks-vision)
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false };
    config.module.rules.push({ test: /\.wasm$/, type: "asset/resource" });
    // TypeScript ESM files use .js extensions in imports; remap to .ts/.tsx for webpack
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
