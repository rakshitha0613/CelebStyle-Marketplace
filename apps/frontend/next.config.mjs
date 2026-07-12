/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  // All images are served from /public/assets/ — no external domains needed.
  images: {
    remotePatterns: [],
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
