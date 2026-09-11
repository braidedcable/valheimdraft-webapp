import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// GitHub Pages project site serves from /<repo-name>/, not the domain root.
export default defineConfig({
  plugins: [svelte()],
  base: '/valheimdraft-webapp/',
})
