import adapter from '@sveltejs/adapter-static'; // Ganti adapter-auto jadi adapter-static
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
    preprocess: vitePreprocess(),
    kit: {
        adapter: adapter({
            fallback: 'index.html' // Penting buat Single Page App (SPA)
        })
    }
};

export default config;