import type { ResolvedPathname } from "$app/types";

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Error {
			message: string;
			code?: number | string;
		}
		interface Locals {
			requestId: string;
			user?: {
				sub?: string;
				name?: string;
				email?: string;
			};
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

// Workspace tabs, bookmarks and filters build runtime query-string paths.
// Keep SvelteKit's native resolve() at runtime while allowing those validated
// app-internal strings through the generated route typing.
declare module "$app/paths" {
	export function resolve(path: string): ResolvedPathname;
}

export {};
