import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        quiz: {
          red: "#e21b3c",
          blue: "#1368ce",
          yellow: "#d89e00",
          green: "#26890c",
        },
      },
      fontFamily: {
        display: ["ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out",
        "pulse-ring": "pulse-ring 1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
