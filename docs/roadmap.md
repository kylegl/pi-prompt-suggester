# Roadmap

## Phase 0: Foundation
- [x] Repo scaffold
- [x] Vision and architecture docs
- [x] Define `seed.json` schema
- [x] Define session/branch-aware runtime state schema

## Phase 1: Async Seeding MVP
- [x] Background seeding runner (non-blocking)
- [x] Repo signal discovery for seeding
- [x] Persist seed with key-file hashes + source commit
- [x] Staleness check on `session_start`
- [x] `/autoprompter reseed` command (async)

## Phase 2: Turn-time Suggestion MVP
- [x] Hook `agent_end` completion processing
- [x] Deterministic fast-path: error/aborted -> `continue`
- [x] Prompt-generator meta prompt runner (plain text output)
- [x] Handle `[no suggestion]`
- [x] Prefill editor via `ctx.ui.setEditorText` when safe

## Phase 3: Continuous Reseeding + Steering
- [x] Run staleness checker after every agent completion
- [x] Trigger async reseed with reason + changed files (+ optional git diff summary)
- [x] Capture suggestion vs actual user prompt
- [x] Classify `accepted_exact | accepted_edited | changed_course`
- [x] Feed recent accepted/changed examples into prompt generation

## Phase 4: Tuning Loop
- [ ] Local replay harness
- [ ] Inspect rejected-example patterns
- [ ] Tune context windows and thresholds
- [ ] Iterate prompt wording and context formatting

## Phase 5: UX Quality
- [ ] Ghost suggestion rendering in custom editor
- [ ] Tab accept behavior
- [x] Minimal visual indicators and controls
