import nodeAdapter from "@sveltejs/adapter-node";
import vercelAdapter from "@sveltejs/adapter-vercel";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

const isVercel = process.env.VERCEL === "1";

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: isVercel
			? vercelAdapter({
					runtime: "nodejs22.x",
				})
			: nodeAdapter({
					out: "build",
					envPrefix: "MONGOKU_SERVER_",
				}),
		paths: {
			base: process.env.BASE_PATH || "",
		},
		experimental: {
			remoteFunctions: true,
		},
		alias: {
			$api: "src/api",
		},
	},

	compilerOptions: {
		experimental: {
			async: true,
		},
	},
};

export default config;
