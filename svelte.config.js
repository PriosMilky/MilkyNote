import adapter from '@sveltejs/adapter-static'; // Ganti adapter-auto jadi adapter-static
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		// Tambahkan ini:
		prerender: {
			handleHttpError: ({ path, message }) => {
				// Abaikan jika hanya favicon yang hilang
				if (path === '/favicon.png') return;
				throw new Error(message);
			}
		}
	}
};

export default config;