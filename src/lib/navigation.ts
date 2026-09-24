import { base } from "$app/paths";

/**
 * Resolve an app-internal href that may contain dynamic query parameters.
 * SvelteKit's generated resolve() typing is intentionally strict for known routes;
 * workspace/bookmark routes are runtime strings, so keep base-path handling here.
 */
export function appPath(href: string): string {
	if (!href.startsWith("/")) {
		return href;
	}
	return base + href;
}
