/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#080c10",
        surface: "#0e1318",
        card: "#131920",
        border: "#1e2832",
        accent: "#00d4ff",
        green: "#00e676",
        yellow: "#ffd600",
        red: "#ff4444",
        muted: "#5a6880",
        text: "#c9d6e3",
      },
      fontFamily: {
        display: ["'Bebas Neue'", "sans-serif"],
        body: ["'DM Sans'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
