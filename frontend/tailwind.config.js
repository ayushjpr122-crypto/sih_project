/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        harbour: {
          950: "#0A1628",
          900: "#0B1F3A",
          800: "#12294D",
          700: "#1B3A66",
        },
        ocean: {
          700: "#0E5E7A",
          600: "#0E7C8C",
          500: "#1B6FA8",
          100: "#D9EAF3",
          50: "#EFF6FA",
        },
        signal: {
          buy: "#0E7A4D",
          wait: "#B45309",
          watch: "#1B6FA8",
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', '"IBM Plex Sans"', "system-ui", "sans-serif"],
        body: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(10,22,40,.06), 0 8px 24px -12px rgba(10,22,40,.18)",
        final: "0 24px 60px -20px rgba(11,31,58,.55)",
      },
    },
  },
  plugins: [],
};
