# Claude entry point — Mongoku Datapass

Read **[docs/CLAUDE_FULL_HANDOFF_2026-09-24.md](docs/CLAUDE_FULL_HANDOFF_2026-09-24.md)** first, then **[docs/CODEX_SUPPORT_2026-09-24.md](docs/CODEX_SUPPORT_2026-09-24.md)**.

Key constraints:

- Mongoku is a generic multi-organization portfolio/Mongo cockpit, **not a FOIL-only app**.
- FOIL is a major consumer, but PM/Core Truth/STUDY/AI Reasoning/IT DEV/FRONT/Work Archive remain external authorities.
- DataPass VS Code is `julian-passebecq/datapass-vscode`; do not confuse it with `ducklabms_code`.
- Mongoku and DataPass VS Code are complementary and should integrate through bounded context, stable IDs and links, not merged authority or duplicated code.
- Preserve the qualified live-DATAPASSCONTROL compatibility adapter; investigate only reproducible defects.
- Finish runtime/UI smoke and qualification before recommending PR #1 merge.
