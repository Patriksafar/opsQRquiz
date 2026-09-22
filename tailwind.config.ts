import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Operations Checkpoint palette. Each token is `hsl(<channels> / alpha)`
        // so Tailwind's `/50` opacity modifiers keep working.
        canvas: {
          top: "hsl(var(--canvas-top) / <alpha-value>)",
          bottom: "hsl(var(--canvas-bottom) / <alpha-value>)",
        },
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: {
          DEFAULT: "hsl(var(--foreground) / <alpha-value>)",
          muted: "hsl(var(--foreground-muted) / <alpha-value>)",
          subtle: "hsl(var(--foreground-subtle) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          elevated: "hsl(var(--card-elevated) / <alpha-value>)",
          border: "hsl(var(--card-border) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
          "foreground-muted": "hsl(var(--card-foreground-muted) / <alpha-value>)",
          "foreground-subtle": "hsl(var(--card-foreground-subtle) / <alpha-value>)",
        },
        brand: {
          DEFAULT: "hsl(var(--brand) / <alpha-value>)",
          hover: "hsl(var(--brand-hover) / <alpha-value>)",
          foreground: "hsl(var(--brand-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        line: {
          DEFAULT: "hsl(var(--border) / <alpha-value>)",
          canvas: "hsl(var(--border-on-canvas) / <alpha-value>)",
        },
        success: "hsl(var(--success) / <alpha-value>)",
        warning: "hsl(var(--warning) / <alpha-value>)",
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        info: "hsl(var(--info) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-montserrat)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-poppins)", "var(--font-montserrat)", "ui-sans-serif", "sans-serif"],
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "pulse-ring": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.35s ease-out both",
        "pulse-ring": "pulse-ring 1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
