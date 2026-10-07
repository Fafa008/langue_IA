/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#013C4A", dark: "#012F3A" },
        background: "#F8FAFA",
        surface: "#FFFFFF",
        content: { DEFAULT: "#172126", secondary: "#66757C" },
        border: "#DDE5E7",
        success: "#16A34A",
        error: "#DC2626",
        warning: "#F59E0B",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        h1: ["2.25rem", { lineHeight: "2.625rem", fontWeight: "700" }],
        h2: ["1.75rem", { lineHeight: "2.25rem", fontWeight: "600" }],
        h3: ["1.25rem", { lineHeight: "1.75rem", fontWeight: "600" }],
        h4: ["1rem", { lineHeight: "1.5rem", fontWeight: "500" }],
        body: ["0.875rem", { lineHeight: "1.25rem", fontWeight: "400" }],
        small: ["0.75rem", { lineHeight: "1rem", fontWeight: "400" }],
      },
      borderRadius: { btn: "0.75rem", card: "1rem" },
      boxShadow: { card: "0 2px 12px rgba(1, 60, 74, 0.08)" },
    },
  },
  plugins: [],
};