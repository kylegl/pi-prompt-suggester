# Architecture Decisions Made During Implementation

This file records implementation decisions that were **not explicitly specified by the user beforehand** but were chosen to get `pi-autoprompter` working end-to-end.

The user explicitly confirmed one of the major corrections during implementation:
- steering state should be session/branch-aware.

Everything below is the remaining tally of concrete implementation decisions made to finish the system.

## 1) Repo intent seed is project-global, steering state is session/branch-local

- **Decision:** keep the seed in `.pi/autoprompter/seed.json`, but store steering/suggestion runtime state in pi custom session entries.
- **Why:** seed belongs to the repo; steering history and last suggestion belong to a specific session branch.

## 2) Suggestion generation is driven from `agent_end`, not `turn_end`

- **Decision:** generate the next-prompt suggestion when the full agent completion ends.
- **Why:** `turn_end` can fire multiple times for a single user prompt; `agent_end` better matches “assistant is done, user is about to type again”.

## 3) Reseeding remains async and non-blocking

- **Decision:** reseeding is queued in the background and never blocks session startup or prompt flow.
- **Why:** this preserves interactive responsiveness.

## 4) Only one reseed job may run at a time

- **Decision:** reseed jobs use a single-process queue with `pending` trigger coalescing.
- **Why:** avoids duplicate work and file churn while still honoring freshness.

## 5) Seeder safety is achieved by architecture, not by a read-only worker agent

- **Decision:** seed generation is implemented as local file discovery + direct model call, not as a separate tool-using agent session.
- **Why:** this makes seeding effectively read-only without needing a sandboxed worker.

## 6) Seed invalidation includes config/prompt/generator versioning

- **Decision:** the seed stores `configFingerprint`, `generatorVersion`, `seederPromptVersion`, and `suggestionPromptVersion`.
- **Why:** changing the policy or prompt contracts should invalidate stale seeds even if files did not change.

## 7) Staleness checks consider both hashed key files and configured high-signal globs

- **Decision:** staleness is triggered by:
  - changed stored key-file hashes,
  - config/generator version changes,
  - git/working-tree changes touching configured high-signal globs.
- **Why:** this catches both explicit key-file drift and important new repo changes outside the previous seed’s exact file set.

## 8) Repository context collection is a first-class service

- **Decision:** add `RepositoryContextBuilder` to gather repo tree, candidate files, previous-seed context, and optional git diff context.
- **Why:** seed quality depends heavily on how repo signals are collected and bounded.

## 9) Conversation signal extraction is a first-class service

- **Decision:** add `conversation-signals.ts` to build the suggestion-time context from assistant output, recent user prompts, tool signals, touched files, and unresolved questions.
- **Why:** the suggestion model needs richer structured context than raw assistant text alone.

## 10) Suggestion UI uses guarded prefill with widget fallback

- **Decision:** only prefill the editor when the agent is idle, no pending messages exist, and the editor is empty (configurable). Otherwise the suggestion is shown in a widget below the editor.
- **Why:** avoids clobbering user text while still surfacing the suggestion.

## 11) Stale suggestion suppression uses a runtime epoch

- **Decision:** a generation epoch is bumped on session restores, agent completions, and user input; suggestion UI updates are dropped if they belong to an older epoch.
- **Why:** prevents late-arriving model results from overwriting newer user state.

## 12) Manual controls are exposed under one slash command

- **Decision:** `/autoprompter` supports `status`, `reseed`, and `clear`.
- **Why:** this is enough operational control for v1 without creating a wider command surface.

## 13) The active pi model is reused for seed and suggestion generation

- **Decision:** the extension currently uses the active session model for both seeding and suggestion calls.
- **Why:** this keeps configuration simple for v1. Model specialization can be added later.

## 14) The fast-path on failed/aborted completions is hardcoded to `continue`

- **Decision:** when the latest assistant completion ends in `error` or `aborted`, the extension skips the model call and suggests `continue`.
- **Why:** it is cheap, deterministic, and matches the repo’s intended behavior.

## 15) Session restore re-shows a persisted suggestion when possible

- **Decision:** if branch-local state contains an unconsumed suggestion, `session_start` / `session_tree` / `session_fork` / `session_switch` attempt to surface it again.
- **Why:** persisted suggestions should remain useful across resume/navigation when they are still relevant.

## 16) Runtime queue state is in-memory, not durably persisted

- **Decision:** running/pending reseed state is process-local and not written to disk.
- **Why:** queue state is ephemeral and should not survive crashes as if it were truth.

## 17) Package metadata follows pi package guidance for core imports

- **Decision:** `@mariozechner/pi-ai`, `@mariozechner/pi-agent-core`, and `@mariozechner/pi-coding-agent` are declared as peer dependencies, with matching dev dependencies for local typechecking.
- **Why:** this aligns with pi’s extension/package documentation.

## 18) Status output is rendered as a custom session message

- **Decision:** `/autoprompter status` emits a display-only custom message rather than only a transient notification.
- **Why:** status is easier to inspect in the conversation pane and survives long enough to be useful.

## 19) `state.json` remains implemented only as a generic file store, but is not the primary runtime state mechanism

- **Decision:** the file-backed `JsonStateStore` remains in the codebase, but the live extension uses the session-aware store.
- **Why:** the original scaffold included it, but pi-native session/branch semantics are the right source of truth for steering state.

## 20) Current UX scope stops short of ghost text and Tab-accept

- **Decision:** the shipped implementation uses safe prefill + widget/status UI, not a custom ghost-text editor yet.
- **Why:** it delivers a working end-to-end autoprompter now while leaving richer editor UX for a later phase.
