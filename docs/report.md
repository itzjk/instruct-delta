# Report contract, version 1

`--json` writes one complete JSON object followed by a newline. Errors go to stderr with exit code 1 and no partial JSON. Success, including no instruction changes, returns 0. `docs/schema.json` defines the structural schema. Compatible additive fields may be introduced within version 1; consumers should ignore unknown fields.

`revisions.base` and `revisions.head` contain the supplied `ref`, resolved `commit`, and resolved `tree` object IDs. Commit IDs may be SHA-1 or SHA-256, depending on the repository. Annotated tags are peeled. Refs identify commits, not arbitrary tree objects or working-tree paths. There is no implicit merge-base calculation.

`changes` is ordered by the after path, falling back to the before path for deletions. Each entry has a `status` of `added`, `modified`, `renamed`, or `deleted`. A mode or type change at the same path is `modified`. Rename pairing uses Git's 50% similarity detection, with no rename candidate limit. Renames into a recognized filename are additions; renames out are deletions. Ambiguous pairing of identical files follows Git's choice.

`before` and `after` describe the instruction in the corresponding revision or are null when absent. They include `path`, `directory` (`.` for the root), `oid`, `mode`, and `kind`. Coverage includes the instruction itself and all tracked entries recursively under its directory, including dotfiles and other instruction files. A `submodule` entry named AGENTS.md or CLAUDE.md is not an instruction file.

`coverage.base` and `coverage.head` each have `count` and `entries`. Each entry has `path`, `mode`, `oid`, and `kind`: `file`, `symlink`, or `submodule`. Symlink targets are not read; the object ID identifies the link blob. No content from an instruction or source file is included. Regular files with modes `100644` and `100755`, symlinks (`120000`), and submodules (`160000`) are supported. Other leaf modes cause an explicit error.

`delta.gained`, `delta.lost`, and `delta.retained` each have `count` and sorted `paths`. These are set difference and intersection operations on paths, not content or file identities. A retained path can change contents, mode, or type. A moved source file is a lost path plus a gained path.

`summary.changedInstructions` counts change records. `baseCovered` and `headCovered` count unique covered paths across changed instructions in each tree. The summary's gained, lost, and retained sets compare these unions, not the sum of per-instruction deltas. An overlap can therefore mask one instruction's coverage loss in the summary; the per-instruction record still exposes it. When no instructions change, all summary counts are zero and all lists are empty, even if unchanged instructions cover the repository.

All path lists use locale-independent JavaScript string order (UTF-16 code units). Entries use that same order. Paths retain exact valid UTF-8 spelling; invalid UTF-8 input fails. Human output JSON-quotes paths to escape tabs, newlines, and control characters. Human lists default to ten paths per tree per changed instruction, with explicit omitted counts. `--limit` never truncates JSON.

Reads use object IDs after resolving refs, so subsequent branch movement cannot mix trees within a report. Replace objects are disabled. No hooks, external diff tools, textconv, or model calls run. Lazy fetching is disabled; fetch incomplete history before using the CLI. Git and filesystem access remain local. Git object output above 256 MiB fails rather than returning a partial report.
