<script lang="ts">
	import type { ReportResult } from "$lib/datapass/reporting";

	let { data } = $props();
	const report = $derived(data.report as ReportResult);
	const section = $derived(report.sections[0]);
	const rows = $derived(section?.rows ?? []);

	function text(row: Record<string, unknown>, key: string): string {
		const value = row[key];
		return value == null ? "" : String(value);
	}

	function storageStatus(row: Record<string, unknown>): string {
		if (text(row, "storageStatus")) return text(row, "storageStatus");
		if (text(row, "objectKey") || text(row, "durableExternalCopy")) return "EXTERNAL_OBJECT";
		if (text(row, "binaryPersistence") || text(row, "downloadRef")) return "LOCAL_REF_ONLY";
		return "NOT_CONFIGURED";
	}

	function size(row: Record<string, unknown>): string {
		const value = Number(row.byteSize ?? 0);
		if (!value) return "—";
		if (value < 1024) return value + " B";
		if (value < 1024 * 1024) return Math.round(value / 1024) + " KB";
		return (value / 1024 / 1024).toFixed(1) + " MB";
	}
</script>

<section class="space-y-6">
	<div>
		<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">FOIL Work Archive</p>
		<h1 class="mt-2 text-3xl font-semibold tracking-tight">Documents & artifacts</h1>
		<p class="mt-2 max-w-4xl text-sm leading-6 text-[var(--text-muted)]">
			Metadata/provenance browser only. Large PDF/PPTX/PNG/XLSX/ZIP assets belong in future provider-neutral object storage, not MongoDB.
		</p>
	</div>

	{#if section && !section.trace.resolved}
		<div class="rounded-xl border border-dashed border-[var(--border-color)] p-5 text-sm text-[var(--text-muted)]">{section.trace.message}</div>
	{/if}

	<div class="grid gap-4 xl:grid-cols-2">
		{#each rows as row}
			<article class="rounded-xl border border-[var(--border-color)] p-5">
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{text(row, "artifactType") || "artifact"}</p>
						<h2 class="mt-1 text-sm font-semibold">{text(row, "fileName") || text(row, "_id")}</h2>
						<p class="mt-1 text-[11px] text-[var(--text-muted)]">{text(row, "project")} · {text(row, "technology")}</p>
					</div>
					<span class="rounded-full border border-[var(--border-color)] px-2 py-0.5 text-[10px]">{storageStatus(row)}</span>
				</div>
				<div class="mt-4 grid grid-cols-2 gap-2 text-[10px]">
					<div class="rounded bg-[var(--hover-background)] p-2"><span class="text-[var(--text-muted)]">Type</span><p class="mt-1">{text(row, "mediaType") || "—"}</p></div>
					<div class="rounded bg-[var(--hover-background)] p-2"><span class="text-[var(--text-muted)]">Size</span><p class="mt-1">{size(row)}</p></div>
					<div class="rounded bg-[var(--hover-background)] p-2"><span class="text-[var(--text-muted)]">Created</span><p class="mt-1">{text(row, "createdAt") || "—"}</p></div>
					<div class="rounded bg-[var(--hover-background)] p-2"><span class="text-[var(--text-muted)]">Status</span><p class="mt-1">{text(row, "status") || "—"}</p></div>
				</div>
				{#if text(row, "storageProvider") || text(row, "bucket") || text(row, "objectKey")}
					<div class="mt-3 rounded-lg bg-[var(--hover-background)] p-3 text-[10px]">
						<p>Storage: {text(row, "storageProvider") || "S3-compatible / provider neutral"}</p>
						<p class="mt-1">{text(row, "bucket") || "—"} / {text(row, "objectKey") || "—"}</p>
						{#if text(row, "versionId")}<p class="mt-1">Version: {text(row, "versionId")}</p>{/if}
					</div>
				{/if}
				{#if text(row, "repository")}
					<p class="mt-3 text-[10px] text-[var(--text-muted)]">{text(row, "repository")} · {text(row, "branch")} · {text(row, "commit")}</p>
				{/if}
				<div class="mt-3 text-[10px] text-[var(--text-muted)]">
					<p>Authority: {text(row, "authority") || "FOIL Work Archive"}</p>
					{#if text(row, "downloadRef")}<p>Download ref: {text(row, "downloadRef")}</p>{/if}
					{#if text(row, "previewRef")}<p>Preview ref: {text(row, "previewRef")}</p>{/if}
					{#if text(row, "textExtractionRef")}<p>Text extraction: {text(row, "textExtractionRef")}</p>{/if}
				</div>
				{#if text(row, "sha256")}
					<p class="mt-2 break-all font-mono text-[9px] text-[var(--text-muted)]">sha256 {text(row, "sha256")}</p>
				{/if}
			</article>
		{:else}
			<div class="rounded-xl border border-dashed border-[var(--border-color)] p-6 text-sm text-[var(--text-muted)]">No artifact metadata returned.</div>
		{/each}
	</div>
</section>
