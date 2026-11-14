/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./newtab.html",
    "./field-manager.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  corePlugins: {
    // The converted UI keeps the legacy stylesheet, which already provides
    // its own resets. Preflight would override form-control fonts and other
    // UA defaults the original design relied on.
    preflight: false,
  },
  theme: {
    extend: {},
  },
  plugins: [],
}