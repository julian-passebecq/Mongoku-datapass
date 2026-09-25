import { env } from "$env/dynamic/private";
import { logger } from "$lib/server/logger";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { reconcileEnvHosts, type PersistedHost } from "./hostReconciliation";

export interface Host {
	path: string;
	_id: string;
}

/** MONGOKU_DEFAULT_HOST is set explicitly: it is authoritative over the persisted list on every start. */
const EXPLICIT_DEFAULT_HOSTS = env.MONGOKU_DISABLE_DEFAULT_HOSTS !== "true" && !!env.MONGOKU_DEFAULT_HOST;
const DEFAULT_HOSTS =
	env.MONGOKU_DISABLE_DEFAULT_HOSTS === "true"
		? []
		: env.MONGOKU_DEFAULT_HOST
			? env.MONGOKU_DEFAULT_HOST.split(";")
			: ["localhost:27017"];
const DATABASE_FILE = env.MONGOKU_DATABASE_FILE || path.join(os.homedir(), ".mongoku.db");

export class HostsManager {
	private _hosts: Map<string, string> = new Map(); // path -> _id
	private _envPaths: Set<string> = new Set(); // paths that came from MONGOKU_DEFAULT_HOST

	async load() {
		let first = false;
		try {
			await fs.promises.stat(DATABASE_FILE);
		} catch {
			first = true;
		}

		const persisted = first ? [] : await this._readFile();
		let hosts = persisted;

		if (EXPLICIT_DEFAULT_HOSTS) {
			const result = reconcileEnvHosts(persisted, DEFAULT_HOSTS, () => this._generateId());
			hosts = result.hosts;
			// Server keys only: host lists, never credentials.
			if (result.replaced.length > 0) {
				logger.log(`MONGOKU_DEFAULT_HOST replaced persisted connection(s) for: ${result.replaced.join(", ")}`);
			}
			if (result.removed.length > 0) {
				logger.log(`Dropped connection(s) no longer in MONGOKU_DEFAULT_HOST: ${result.removed.join(", ")}`);
			}
		} else if (persisted.length === 0) {
			// Initialize with default hosts
			hosts = DEFAULT_HOSTS.map((hostPath) => ({ path: hostPath, _id: this._generateId() }));
		}

		this._setHosts(hosts);
		if (first || JSON.stringify(hosts) !== JSON.stringify(persisted)) {
			await this._saveToFile();
		}
	}

	private async _readFile(): Promise<PersistedHost[]> {
		const content = await fs.promises.readFile(DATABASE_FILE, "utf8");
		const lines = content
			.trim()
			.split("\n")
			.filter((line) => line.trim());

		const hosts: PersistedHost[] = [];
		for (const line of lines) {
			const host = JSON.parse(line);
			if (host && typeof host.path === "string") {
				hosts.push({
					path: host.path,
					// Use existing _id if available, generate new one if not
					_id: host._id || this._generateId(),
					...(host.source === "env" ? { source: "env" as const } : {}),
				});
			}
		}
		return hosts;
	}

	private _setHosts(hosts: PersistedHost[]) {
		this._hosts = new Map(hosts.map((host) => [host.path, host._id]));
		this._envPaths = new Set(hosts.filter((host) => host.source === "env").map((host) => host.path));
	}

	private async _saveToFile(): Promise<void> {
		const lines = Array.from(this._hosts).map(([hostPath, id]) =>
			JSON.stringify({ path: hostPath, _id: id, ...(this._envPaths.has(hostPath) ? { source: "env" } : {}) }),
		);
		await fs.promises.writeFile(DATABASE_FILE, lines.join("\n") + "\n", "utf8");
	}

	private _generateId(): string {
		// Generate a NeDB-compatible ID (16 characters, alphanumeric)
		const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		let result = "";
		for (let i = 0; i < 16; i++) {
			result += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return result;
	}

	async getHosts(): Promise<Host[]> {
		return Array.from(this._hosts).map(([hostPath, id]) => ({ path: hostPath, _id: id }));
	}

	getHost(name: string): string | undefined {
		return this._hosts.get(name);
	}

	async add(hostPath: string): Promise<string> {
		// Use existing ID if host already exists, generate new one if not
		let id = this._hosts.get(hostPath);
		if (!id) {
			id = this._generateId();
			this._hosts.set(hostPath, id);
		}
		await this._saveToFile();
		return id;
	}

	async removeById(id: string): Promise<void> {
		for (const [hostPath, hostId] of this._hosts) {
			if (hostId === id) {
				// An env host removed here comes back on the next start while MONGOKU_DEFAULT_HOST lists it.
				this._hosts.delete(hostPath);
				this._envPaths.delete(hostPath);
				break;
			}
		}
		await this._saveToFile();
	}
}
