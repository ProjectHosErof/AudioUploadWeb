# ui-ux-pro-max — source and review notes

Vendored from <https://github.com/nextlevelbuilder/ui-ux-pro-max-skill>
(MIT, see `UI-UX-PRO-MAX-LICENSE`) at commit
`28b3b8dee8c976df4fa3e94aed4e092ad43fcb03` (2026-10-26), path
`.claude/skills/ui-ux-pro-max/`.

**Why it's here:** UI/UX review and design guidance for `phe-landing-page`
(React + Tailwind): accessibility, forms, interaction, typography and color, backed
by a local, searchable dataset (119 UX guidelines, stack-specific rules for
`react` and `html-tailwind`, and more). Use it alongside the project's own design
direction (Illuminated Codex). Treat the skill's palettes and styles as reference,
not as replacements for the existing tokens in `phe-landing-page/src/index.css`.

## What's included

- `SKILL.md` and `references/`: instructions and the full rule set.
- `scripts/*.py`: the local search tool (`search.py`, plus `core.py`,
  `design_system.py`, `reasoning_contract.py` and `validate_data.py`).
- `data/`: the CSV/JSON knowledge base (about 3.3 MB).

## Review before vendoring

- **Scripts use the Python standard library only.** No network access
  (`urllib.parse` is used only to parse strings), no `subprocess`/`os.system`,
  no `eval`/`exec`, nothing reading secrets or home-directory files. They read
  `data/` relative to the script's own location.
- **The only file writes** happen in `--design-system --persist` mode, which
  writes `design-system/<slugified-name>/` under `--output-dir`. It never
  overwrites without `--force`.
- **All text and data files** were scanned for hidden/bidi Unicode (none),
  prompt-injection phrasing (none; the "password" matches are UX guidance such as
  "allow password managers") and unexpected endpoints. The URLs referenced are
  documentation sites (Google Fonts, MDN, React, Tailwind, Microsoft Learn, …),
  and nothing fetches them.
- Smoke-tested after install: `--domain ux` and `--stack react` searches return
  results and write no files.

## Local changes from upstream

- **`SKILL.md` script paths.** Upstream invokes
  `"${CLAUDE_PLUGIN_ROOT}/.claude/skills/ui-ux-pro-max/scripts/search.py"`,
  which only resolves when installed as a plugin. Here it's a project skill, so
  the paths are
  `"$(git rev-parse --show-toplevel)/.claude/skills/ui-ux-pro-max/scripts/search.py"`,
  using `python3`. No other file is modified.
- **Not vendored:** `scripts/tests/` (upstream's 13-file developer test suite,
  not used by the skill), and everything outside the skill directory (CLI,
  docs, gallery, screenshots, translated READMEs).

## Updating

1. Clone upstream into a temporary directory and check out the new commit.
2. Diff `.claude/skills/ui-ux-pro-max/` against this copy, and **read every
   changed script** for new imports (network, subprocess) and new write paths.
3. Re-scan text and data for hidden Unicode and injection phrasing.
4. Copy across, re-apply the path change above, update the commit hash here,
   and smoke-test one `--domain` search.
