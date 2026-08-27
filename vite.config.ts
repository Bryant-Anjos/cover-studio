import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative asset URLs so the build works both at a custom domain root
  // (capa.briam.cloud) and at the GitHub Pages project path
  // (bryant-anjos.github.io/cover-studio/). Safe here because the app has no
  // client-side routing.
  base: './',
  plugins: [react()],
  server: { port: 5180, open: true },
})
