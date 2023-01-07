/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial":
          "radial-gradient( circle at 50% 50%,var(--background) 20%,transparent 20.5%,transparent 49.5%,var(--background) 50%)",
      },
    },
  },
  plugins: [],
};
