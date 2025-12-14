/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        main: {
          DEFAULT: "hsl(var(--main))",
          foreground: "hsl(var(--main-foreground))",
        },
        "secondary-background": "hsl(var(--secondary-background))",
      },
      borderRadius: {
        base: "var(--radius)",
      },
      boxShadow: {
        shadow: "var(--shadow)",
      },
      translate: {
        boxShadowX: "var(--shadow-x)",
        boxShadowY: "var(--shadow-y)",
        reverseBoxShadowX: "var(--reverse-shadow-x)",
        reverseBoxShadowY: "var(--reverse-shadow-y)",
      },
      fontWeight: {
        base: "var(--font-weight)",
        heading: "var(--font-heading-weight)",
      },
    },
  },
  plugins: [],
};
