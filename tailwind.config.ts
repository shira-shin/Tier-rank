import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "var(--surface-bg)",
          strong: "var(--surface-strong-bg)",
        },
        text: {
          muted: "var(--text-muted)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
