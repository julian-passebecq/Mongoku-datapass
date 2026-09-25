import { mongoHostKey } from "$lib/utils/mongoUri";

export interface PersistedHost {
	path: string;
	_id: string;
	/** Set when the entry came from MONGOKU_DEFAULT_HOST, so a later env change can drop it. */
	source?: "env";
}

export interface HostReconciliation {
	hosts: PersistedHost[];
	/** Server keys (host lists, never credentials) whose persisted URI was replaced by the env one. */
	replaced: string[];
	/** Server keys previously added from the env and no longer listed there. */
	removed: string[];
	/** Server keys newly added from the env. */
	added: string[];
}

/** The server a host path points to (its host list), without credentials or options. */
export function hostKeyOf(hostPath: string): string {
	const url = hostPath.startsWith("mongodb") ? hostPath : `mongodb://${hostPath}`;
	try {
		return mongoHostKey(url) || hostPath;
	} catch {
		return hostPath;
	}
}

/**
 * Makes an explicit MONGOKU_DEFAULT_HOST authoritative over the persisted host list, which
 * otherwise wins forever once it exists (a changed password or a new server in .env was ignored):
 * - env hosts missing from the file are added and marked `source: "env"`;
 * - entries added from the env earlier but no longer listed there are dropped;
 * - any other persisted entry for the same server as an env host is replaced by the env URI,
 *   keeping its `_id`, so an old credential for that server is never connected again.
 * Hosts added from the UI for other servers are kept.
 */
export function reconcileEnvHosts(
	persisted: PersistedHost[],
	envHosts: string[],
	newId: () => string,
): HostReconciliation {
	const envByKey = new Map<string, string>();
	for (const raw of envHosts) {
		const path = raw.trim();
		const key = path ? hostKeyOf(path) : "";
		if (key && !envByKey.has(key)) {
			envByKey.set(key, path);
		}
	}

	const hosts: PersistedHost[] = [];
	const emitted = new Set<string>();
	const reusableIds = new Map<string, string>();
	const replaced = new Set<string>();
	const removed = new Set<string>();

	for (const host of persisted) {
		const key = hostKeyOf(host.path);
		const envPath = envByKey.get(key);
		if (envPath !== undefined) {
			if (host.path === envPath && !emitted.has(key)) {
				hosts.push({ path: host.path, _id: host._id, source: "env" });
				emitted.add(key);
			} else if (host.path !== envPath) {
				replaced.add(key);
				if (!reusableIds.has(key)) {
					reusableIds.set(key, host._id);
				}
			}
			continue;
		}
		if (host.source === "env") {
			removed.add(key);
			continue;
		}
		hosts.push(host);
	}

	const added: string[] = [];
	for (const [key, path] of envByKey) {
		if (emitted.has(key)) {
			continue;
		}
		const reused = reusableIds.get(key);
		hosts.push({ path, _id: reused ?? newId(), source: "env" });
		if (!reused) {
			added.push(key);
		}
	}

	return { hosts, replaced: [...replaced], removed: [...removed], added };
}
