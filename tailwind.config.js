/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cimbra: {
          dark: "#1C2B39",
          amber: "#C9922B",
        },
      },
    },
  },
  plugins: [],
};
