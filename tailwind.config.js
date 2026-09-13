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
        mahdy: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0099DD", // Official Primary from Logo
          600: "#0085c2",
          700: "#006fa3",
          800: "#035882",
          900: "#07486b",
          950: "#042d45",
        },
        navy: {
          900: "#0F172A", // Dark top bar from yasbas style
          950: "#0A0F1D",
        },
      },
      fontFamily: {
        cairo: ["var(--font-cairo)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
