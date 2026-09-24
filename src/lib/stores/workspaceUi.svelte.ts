import { browser } from "$app/environment";
import type { WorkspacePreset } from "$lib/datapass/controlPlane";

export type WorkspaceTab = {
	id: string;
	title: string;
	href: string;
	projectId?: string;
};

export type WorkspaceBookmark = {
	id: string;
	title: string;
	href: string;
};

export type RightPanelMode = "context" | "bookmarks" | "queries" | "settings";

export type WorkspaceInstance = {
	id: string;
	name: string;
	presetId?: string;
	defaultProjectId?: string;
	tabs: WorkspaceTab[];
	bookmarks: WorkspaceBookmark[];
	leftPanelCollapsed: boolean;
	rightPanelOpen: boolean;
	rightPanelMode: RightPanelMode;
};

export type WorkspaceUiSnapshot = {
	version: 1;
	activeInstanceId: string;
	instances: WorkspaceInstance[];
};

export type WorkspaceCheckpoint = {
	id: string;
	title: string;
	note: string;
	createdAt: string;
	snapshot: WorkspaceUiSnapshot;
};

export type WorkspaceCheckpointEvent = {
	id: string;
	action: "save" | "restore" | "delete" | "undo";
	checkpointId: string;
	title: string;
	createdAt: string;
};

type WorkspaceCheckpointStore = {
	version: 1;
	entries: WorkspaceCheckpoint[];
	undo?: WorkspaceCheckpoint;
	history: WorkspaceCheckpointEvent[];
};

const STORAGE_KEY = "datapass-mongo-control.ui.v1";
const CHECKPOINT_STORAGE_KEY = "datapass-mongo-control.checkpoints.v1";
const CHECKPOINT_LIMIT = 20;
const CHECKPOINT_HISTORY_LIMIT = 30;

function makeId(prefix: string) {
	return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

function fromPreset(preset: WorkspacePreset, instanceName?: string): WorkspaceInstance {
	return {
		id: makeId("workspace"),
		name: instanceName || preset.name,
		presetId: preset.id,
		defaultProjectId: preset.defaultProjectId,
		tabs: preset.tabs.map((tab) => ({ ...tab })),
		bookmarks: preset.bookmarks.map((bookmark) => ({ ...bookmark })),
		leftPanelCollapsed: preset.leftPanelCollapsed,
		rightPanelOpen: preset.rightPanelOpen,
		rightPanelMode: preset.rightPanelMode,
	};
}

class WorkspaceUiState {
	hydrated = $state(false);
	activeInstanceId = $state("");
	instances = $state<WorkspaceInstance[]>([]);
	checkpoints = $state<WorkspaceCheckpoint[]>([]);
	checkpointUndo = $state<WorkspaceCheckpoint | undefined>(undefined);
	checkpointHistory = $state<WorkspaceCheckpointEvent[]>([]);

	current(): WorkspaceInstance | undefined {
		return this.instances.find((instance) => instance.id === this.activeInstanceId) ?? this.instances[0];
	}

	hydrate(presets: WorkspacePreset[], currentHref: string, currentTitle: string) {
		if (!browser || this.hydrated) {
			return;
		}

		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				const parsed = JSON.parse(raw) as WorkspaceUiSnapshot;
				if (parsed.version === 1 && Array.isArray(parsed.instances) && parsed.instances.length > 0) {
					this.instances = parsed.instances;
					this.activeInstanceId = parsed.activeInstanceId || parsed.instances[0].id;
				}
			}
		} catch {
			// Invalid local state falls back to a preset.
		}

		if (this.instances.length === 0) {
			const preset = presets[0];
			if (preset) {
				const instance = fromPreset(preset);
				this.instances = [instance];
				this.activeInstanceId = instance.id;
			} else {
				const instance: WorkspaceInstance = {
					id: makeId("workspace"),
					name: "Workspace",
					tabs: [],
					bookmarks: [],
					leftPanelCollapsed: false,
					rightPanelOpen: true,
					rightPanelMode: "context",
				};
				this.instances = [instance];
				this.activeInstanceId = instance.id;
			}
		}

		this.hydrateCheckpoints();
		this.hydrated = true;
		this.ensureTab(currentHref, currentTitle);
		this.persist();
	}

	persist() {
		if (!browser || !this.hydrated) {
			return;
		}
		const snapshot: WorkspaceUiSnapshot = {
			version: 1,
			activeInstanceId: this.activeInstanceId,
			instances: this.instances,
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
	}

	ensureTab(href: string, title: string, projectId?: string) {
		const instance = this.current();
		if (!instance || !href) {
			return;
		}

		const existing = instance.tabs.find((tab) => tab.href === href);
		if (existing) {
			return;
		}

		instance.tabs.push({
			id: makeId("tab"),
			title,
			href,
			projectId,
		});
		this.persist();
	}

	closeTab(tabId: string) {
		const instance = this.current();
		if (!instance) {
			return;
		}
		instance.tabs = instance.tabs.filter((tab) => tab.id !== tabId);
		this.persist();
	}

	setActiveInstance(instanceId: string) {
		if (!this.instances.some((instance) => instance.id === instanceId)) {
			return;
		}
		this.activeInstanceId = instanceId;
		this.persist();
	}

	newInstance(preset?: WorkspacePreset) {
		const instance: WorkspaceInstance = preset
			? fromPreset(preset, preset.name + " " + (this.instances.length + 1))
			: {
					id: makeId("workspace"),
					name: "Blank Workspace " + (this.instances.length + 1),
					tabs: [],
					bookmarks: [],
					leftPanelCollapsed: false,
					rightPanelOpen: true,
					rightPanelMode: "context",
				};
		this.instances.push(instance);
		this.activeInstanceId = instance.id;
		this.persist();
		return instance;
	}

	duplicateCurrent() {
		const current = this.current();
		if (!current) {
			return this.newInstance();
		}
		const instance: WorkspaceInstance = {
			...structuredClone(current),
			id: makeId("workspace"),
			name: current.name + " Copy",
			tabs: current.tabs.map((tab) => ({ ...tab, id: makeId("tab") })),
			bookmarks: current.bookmarks.map((bookmark) => ({ ...bookmark, id: makeId("bookmark") })),
		};
		this.instances.push(instance);
		this.activeInstanceId = instance.id;
		this.persist();
		return instance;
	}

	applyPreset(preset: WorkspacePreset) {
		const instance = this.current();
		if (!instance) {
			return;
		}
		instance.name = preset.name;
		instance.presetId = preset.id;
		instance.defaultProjectId = preset.defaultProjectId;
		instance.tabs = preset.tabs.map((tab) => ({ ...tab, id: makeId("tab") }));
		instance.bookmarks = preset.bookmarks.map((bookmark) => ({ ...bookmark, id: makeId("bookmark") }));
		instance.leftPanelCollapsed = preset.leftPanelCollapsed;
		instance.rightPanelOpen = preset.rightPanelOpen;
		instance.rightPanelMode = preset.rightPanelMode;
		this.persist();
	}

	toggleLeftPanel() {
		const instance = this.current();
		if (!instance) {
			return;
		}
		instance.leftPanelCollapsed = !instance.leftPanelCollapsed;
		this.persist();
	}

	toggleRightPanel() {
		const instance = this.current();
		if (!instance) {
			return;
		}
		instance.rightPanelOpen = !instance.rightPanelOpen;
		this.persist();
	}

	setRightPanelMode(mode: RightPanelMode) {
		const instance = this.current();
		if (!instance) {
			return;
		}
		instance.rightPanelMode = mode;
		instance.rightPanelOpen = true;
		this.persist();
	}

	toggleBookmark(href: string, title: string) {
		const instance = this.current();
		if (!instance) {
			return;
		}
		const existing = instance.bookmarks.find((bookmark) => bookmark.href === href);
		if (existing) {
			instance.bookmarks = instance.bookmarks.filter((bookmark) => bookmark.href !== href);
		} else {
			instance.bookmarks.push({ id: makeId("bookmark"), title, href });
		}
		this.persist();
	}

	private snapshot(): WorkspaceUiSnapshot {
		return structuredClone({
			version: 1,
			activeInstanceId: this.activeInstanceId,
			instances: this.instances,
		});
	}

	private hydrateCheckpoints() {
		if (!browser) {
			return;
		}
		try {
			const raw = localStorage.getItem(CHECKPOINT_STORAGE_KEY);
			if (!raw) {
				return;
			}
			const parsed = JSON.parse(raw) as WorkspaceCheckpointStore;
			if (parsed.version !== 1 || !Array.isArray(parsed.entries)) {
				return;
			}
			this.checkpoints = parsed.entries.slice(0, CHECKPOINT_LIMIT);
			this.checkpointUndo = parsed.undo;
			this.checkpointHistory = Array.isArray(parsed.history) ? parsed.history.slice(0, CHECKPOINT_HISTORY_LIMIT) : [];
		} catch {
			// Invalid checkpoint state is ignored without touching current UI state.
		}
	}

	private persistCheckpoints() {
		if (!browser || !this.hydrated) {
			return;
		}
		const data: WorkspaceCheckpointStore = {
			version: 1,
			entries: this.checkpoints.slice(0, CHECKPOINT_LIMIT),
			undo: this.checkpointUndo,
			history: this.checkpointHistory.slice(0, CHECKPOINT_HISTORY_LIMIT),
		};
		localStorage.setItem(CHECKPOINT_STORAGE_KEY, JSON.stringify(data));
	}

	private checkpointEvent(action: WorkspaceCheckpointEvent["action"], checkpointId: string, title: string) {
		this.checkpointHistory.unshift({
			id: makeId("checkpoint-event"),
			action,
			checkpointId,
			title,
			createdAt: new Date().toISOString(),
		});
		this.checkpointHistory = this.checkpointHistory.slice(0, CHECKPOINT_HISTORY_LIMIT);
	}

	saveCheckpoint(title: string, note = "") {
		const cleanTitle = title.trim();
		if (!cleanTitle) {
			throw new Error("Checkpoint title is required");
		}
		if (this.checkpoints.length >= CHECKPOINT_LIMIT) {
			throw new Error("Workspace checkpoint limit reached. Delete one before saving another.");
		}
		const checkpoint: WorkspaceCheckpoint = {
			id: makeId("checkpoint"),
			title: cleanTitle.slice(0, 120),
			note: note.trim().slice(0, 500),
			createdAt: new Date().toISOString(),
			snapshot: this.snapshot(),
		};
		this.checkpoints.unshift(checkpoint);
		this.checkpointEvent("save", checkpoint.id, checkpoint.title);
		this.persistCheckpoints();
		return checkpoint;
	}

	restoreCheckpoint(id: string) {
		const checkpoint = this.checkpoints.find((entry) => entry.id === id);
		if (!checkpoint) {
			throw new Error("Workspace checkpoint not found");
		}

		this.checkpointUndo = {
			id: makeId("checkpoint-undo"),
			title: "Before last restore",
			note: "Automatic undo point",
			createdAt: new Date().toISOString(),
			snapshot: this.snapshot(),
		};

		this.instances = structuredClone(checkpoint.snapshot.instances);
		this.activeInstanceId = checkpoint.snapshot.activeInstanceId;
		this.checkpointEvent("restore", checkpoint.id, checkpoint.title);
		this.persist();
		this.persistCheckpoints();
	}

	undoCheckpointRestore() {
		if (!this.checkpointUndo) {
			throw new Error("No restore undo point is available");
		}
		const undo = this.checkpointUndo;
		this.instances = structuredClone(undo.snapshot.instances);
		this.activeInstanceId = undo.snapshot.activeInstanceId;
		this.checkpointUndo = undefined;
		this.checkpointEvent("undo", undo.id, undo.title);
		this.persist();
		this.persistCheckpoints();
	}

	deleteCheckpoint(id: string) {
		const checkpoint = this.checkpoints.find((entry) => entry.id === id);
		if (!checkpoint) {
			return;
		}
		this.checkpoints = this.checkpoints.filter((entry) => entry.id !== id);
		this.checkpointEvent("delete", checkpoint.id, checkpoint.title);
		this.persistCheckpoints();
	}

	exportJson(): string {
		return JSON.stringify(
			{
				version: 1,
				activeInstanceId: this.activeInstanceId,
				instances: this.instances,
			} satisfies WorkspaceUiSnapshot,
			null,
			2,
		);
	}

	importJson(text: string) {
		const parsed = JSON.parse(text) as WorkspaceUiSnapshot;
		if (parsed.version !== 1 || !Array.isArray(parsed.instances) || parsed.instances.length === 0) {
			throw new Error("Invalid workspace UI JSON");
		}
		this.instances = parsed.instances;
		this.activeInstanceId = parsed.activeInstanceId || parsed.instances[0].id;
		this.hydrated = true;
		this.persist();
	}
}

export const workspaceUi = new WorkspaceUiState();
