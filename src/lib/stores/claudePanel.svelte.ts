import { browser } from "$app/environment";

// A per-browser preference, kept out of the workspace snapshot so checkpoints and UI-state JSON are unchanged.
const STORAGE_KEY = "datapass-mongo-control.claude-panel.v1";

class ClaudePanelFlag {
	/** Off by default: the Claude panel only exists once Julian turns it on in Settings. */
	enabled = $state(false);
	private hydrated = false;

	hydrate() {
		if (!browser || this.hydrated) {
			return;
		}
		this.hydrated = true;
		try {
			this.enabled = localStorage.getItem(STORAGE_KEY) === "on";
		} catch {
			// Storage blocked (private mode, policy): the flag stays off.
		}
	}

	setEnabled(value: boolean) {
		this.enabled = value;
		if (!browser) {
			return;
		}
		try {
			if (value) {
				localStorage.setItem(STORAGE_KEY, "on");
			} else {
				localStorage.removeItem(STORAGE_KEY);
			}
		} catch {
			// The choice still applies to this page view.
		}
	}
}

export const claudePanelFlag = new ClaudePanelFlag();
