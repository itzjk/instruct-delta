# Alternatives checked before implementation

Checked October 28, 2026 (America/New_York). GitHub API measurements were read at 01:00:15-01:00:18 UTC on October 29.

| Source | Observed scope | API measurement |
| --- | --- | --- |
| [agents-md-scope](https://github.com/KanadeK/agents-md-scope) | Browser explorer for instruction coverage at a selected path in one imported snapshot | 1 star |
| [source-agents](https://github.com/iannuttall/source-agents) | Scans and fixes instruction sourcing, including symlinks | 123 stars |
| [ai-rules-sync](https://github.com/PanisHandsome/ai-rules-sync) | Generates, converts, and synchronizes agent rules | 101 stars |

These repositories' README pages were opened before implementation. None describes the requested two-revision report: changed AGENTS.md and CLAUDE.md files, their directory coverage in both committed trees, and gained/lost/retained path sets.

Additional web searches used these queries:

- `"AGENTS.md" "blast radius" git diff`
- `"AGENTS.md" "coverage" "base" "head" diff tool`
- `"CLAUDE.md" instruction impact diff revisions tool`
- `github "agent instructions" "diff" "coverage"`
- `github "AGENTS.md" "blast radius" CLI`
- `github "instruction" "coverage" "two" "revisions"`

Results included general code impact graphs, instruction maintenance tools, and studies of instruction changes. No equivalent dedicated two-revision directory-coverage CLI was identified in this bounded search. This is a scoped search result, not a claim that no equivalent exists anywhere. Competitor code, assets, and branding were not used.

[Claude Code issue #31005](https://github.com/anthropics/claude-code/issues/31005) was open when checked through the GitHub API, with 430 thumbs-up reactions, 583 total reactions, and 37 comments. It concerns instruction interoperability; those reactions are not votes for instruct-delta. The issue is evidence of shared instruction workflows, not proof of this CLI's market demand.

The [proposed repository](https://github.com/itzjk/instruct-delta) returned HTTP 404 through the GitHub API during the same check. That observation does not reserve the name.
