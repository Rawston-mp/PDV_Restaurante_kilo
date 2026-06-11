/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}'
  ],
  corePlugins: {
    preflight: false // avoid resetting existing CSS
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
