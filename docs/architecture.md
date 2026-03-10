# Architecture (Implemented)

## Overview

`pi-autoprompter` has four main runtime pieces:

1. **Suggestion pipeline** — runs on `agent_end`
2. **Async seed manager** — background, non-blocking reseeding
3. **Steering tracker** — branch-aware accepted vs changed history
4. **UI sink** — safe editor prefill with widget fallback

The system keeps the deterministic core small and relies on model quality plus structured context.

---

## 1) Seed storage vs runtime state

### Project-global
Stored in:
- `./.pi/autoprompter/seed.json`

This contains:
- durable project intent summary
- key file hashes
- source commit
- seed/generator/config metadata

### Session/branch-local
Stored as pi custom session entries (`autoprompter-state`).

This contains:
- last shown suggestion
- steering history (`accepted_exact | accepted_edited | changed_course`)

This design matches pi’s tree-structured sessions and survives `/tree`, `/fork`, and resume behavior correctly.

---

## 2) Async seed manager

### Requirements
- Never block session startup.
- Run at most one reseed job at a time.
- Re-run once if a new reseed trigger arrives while a reseed is already running.

### Trigger points
- `session_start`
- `session_tree`
- `session_fork`
- `session_switch`
- `agent_end`
- manual `/autoprompter reseed`

### Staleness rules
The seed is considered stale when:
- it is missing,
- a stored key-file hash changed,
- configured high-signal files changed,
- config fingerprint changed,
- generator or prompt versions changed.

### Seeder safety
Seeding is implemented as:
- local repo signal collection,
- followed by a direct model call,
- followed by local seed persistence.

No separate tool-using seeder agent is used, so the implementation is effectively read-only.

---

## 3) Suggestion pipeline

### Trigger
- `agent_end`

### Why `agent_end`
A user prompt may span multiple internal turns. Suggesting only after the full completion avoids premature editor changes.

### Inputs
- latest assistant completion text
- completion status (`success | error | aborted`)
- recent user prompts from the current branch
- extracted tool signals and touched files
- unresolved question lines from the assistant output
- intent seed
- recent accepted steering examples
- recent changed steering examples

### Fast path
If the completion status is `error` or `aborted`, the system suggests:

```text
continue
```

### Model path
All successful completions use the prompt-generator meta prompt and return either:
- one suggestion string, or
- `[no suggestion]`

---

## 4) Steering tracker

For each shown suggestion, the next real user `input` event is compared against it.

Stored fields:
- `suggestedPrompt`
- `actualUserPrompt`
- `classification`
- `similarity`
- `timestamp`

Steering is recorded only for real user-originated input, not extension-generated input.

---

## 5) UI strategy

### Safe prefill policy
The extension prefills the editor only if:
- UI is available,
- the agent is idle,
- there are no pending queued messages,
- the editor is empty (by default).

### Fallback
If prefill would overwrite text, the suggestion is shown in a widget below the editor and a footer status is set.

### Stale update suppression
A runtime epoch is bumped whenever session/user state changes. Late suggestion results are dropped if they target an older epoch.

---

## 6) Main modules

### Application services
- `StalenessChecker`
- `PromptContextBuilder`
- `SuggestionEngine`
- `SteeringClassifier`
- `RepositoryContextBuilder`
- `conversation-signals.ts`

### Orchestrators
- `SessionStartOrchestrator`
- `TurnEndOrchestrator` (used for `agent_end` completion handling)
- `UserSubmitOrchestrator`
- `ReseedRunner`

### Infrastructure
- `JsonSeedStore`
- `SessionStateStore`
- `PiModelClient`
- `PiSuggestionSink`
- `GitClient`
- `Sha256FileHash`
- `InMemoryTaskQueue`

---

## 7) Operational commands

- `/autoprompter status`
- `/autoprompter reseed`
- `/autoprompter clear`

---

## 8) Known future work

- custom ghost-text editor / Tab-accept UX
- replay/eval harness
- separate model selection for seeding vs suggestion
- richer touched-file inference from bash activity
