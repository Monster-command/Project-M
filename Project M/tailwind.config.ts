import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)", panel: "var(--panel)", panel2: "var(--panel2)",
        border: "var(--border)", ink: "var(--ink)", muted: "var(--muted)",
        faint: "var(--faint)", accent: "var(--accent)",
        up: "#22c55e", down: "#ef4444",
      },
      fontFamily: { sans: ["var(--font-sans)"] },
    },
  },
  plugins: [],
};
export default config;
