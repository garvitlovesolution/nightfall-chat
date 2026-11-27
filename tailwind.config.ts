import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#09090b",
        card: "#18181b",
        card2: "#1f1f24",
        line: "#2a2a31",
        violet: { 400: "#a78bfa", 500: "#8b5cf6", 600: "#7c3aed" },
        neon: { pink: "#f472b6", violet: "#a855f7" },
      },
      boxShadow: { glow: "0 0 24px rgba(168,85,247,.35)" },
      keyframes: {
        blink: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.2" } },
        slidein: { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        fadein: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        blink: "blink 1s infinite",
        slidein: "slidein .25s ease-out",
        fadein: "fadein .25s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
