import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0F0F0F",
        gold: "#D4AF37",
        background: "#FAF7F2",
        accent: "#A61E4D",
        text: "#1E1E1E",
        secondary: "#E8DCCB",
      },
      boxShadow: {
        luxe: "0 24px 80px rgba(15, 15, 15, 0.18)",
      },
      fontFamily: {
        serif: ["Georgia", "\"Times New Roman\"", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        hero: "linear-gradient(135deg, rgba(15,15,15,0.92), rgba(15,15,15,0.58)), radial-gradient(circle at top, rgba(212,175,55,0.18), transparent 40%)",
      },
    },
  },
  plugins: [
    // scrollbar-hide utility
    function ({ addUtilities }: { addUtilities: (u: Record<string, Record<string, string>>) => void }) {
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
        },
        '.scrollbar-hide::-webkit-scrollbar': {
          display: 'none',
        },
      });
    },
  ],
};

export default config;
