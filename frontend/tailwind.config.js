/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Gesso reference HTML — source of truth (warm canvas, not pale blue)
        mist: "#F3EDE0",
        canvas: "#F3EDE0",
        paper: "#FFFFFF",
        elevated: "#F5F5F5",
        recessed: "#E9E4D7",
        line: "#E3DAC3",
        divider: "rgba(0,0,0,0.06)",
        ink: {
          DEFAULT: "#1A1A1A",
          soft: "#6E6A60",
        },
        oxide: "#8F5251",
        gesso: {
          canvas: "#F3EDE0",
          surface: "#FFFFFF",
          elevated: "#F5F5F5",
          recessed: "#E9E4D7",
          fg: "#1A1A1A",
          muted: "#6E6A60",
          accent: "#2A6E8C",
          accent2: "#406993",
          primary: "#8F5251",
          data1: "#145D7A",
          data2: "#317493",
          data3: "#4A8CAB",
        },
        harbour: {
          950: "#1A1A1A",
          900: "#2B2A26",
          800: "#3A3833",
          700: "#2A6E8C",
        },
        ocean: {
          700: "#2A6E8C",
          600: "#317493",
          500: "#406993",
          100: "#DCE5EA",
          50: "#F0EFE9",
        },
        signal: {
          buy: "#0E7A4D",
          wait: "#B45309",
          watch: "#1B6FA8",
        },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', '"Space Grotesk"', "system-ui", "sans-serif"],
        body: ['"Schibsted Grotesk"', '"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(26,26,26,.05)",
        final: "0 16px 40px -20px rgba(26,26,26,.35)",
      },
      borderRadius: {
        gesso: "2px",
      },
      maxWidth: {
        ops: "1280px",
      },
    },
  },
  plugins: [],
};
