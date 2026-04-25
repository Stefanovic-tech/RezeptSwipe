import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#fff5ed",
          100: "#ffe5cc",
          200: "#ffc9a0",
          300: "#ffa46a",
          400: "#ff7e3b",
          500: "#f25c12",
          600: "#d24806",
          700: "#a83806",
          800: "#7d2a08",
          900: "#5a1e05",
        },
      },
      keyframes: {
        pop: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        pop: "pop 200ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
