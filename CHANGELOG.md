# Changelog

## Unreleased

## 0.3.2 - 2026-03-25

### Added
- Added experimental `transcript-steering` suggestion mode, including prompt generation, settings UI controls, and A/B testing support.
- Added panel toggles for showing suggestion status and suggester usage in the inline widget.
- Added documentation for the transcript steering redesign and experiment workflow.

### Changed
- Replaced the earlier `transcript-cache` experiment with the new `transcript-steering` approach.
- Improved package keywords to make the extension easier to discover on npm.
- Moved suggester usage tracking from the crowded footer into the suggester panel.

### Fixed
- Fixed repeated rejected suggestions being shown again.
- Fixed transcript steering to use pi's effective compaction-aware session context instead of rebuilding raw branch history.
- Fixed transcript steering fallback behavior for long sessions so message and character counts no longer incorrectly block suggestions on their own.
- Fixed ghost suggestion editor installation so inline ghost suggestions remain available across interactive session lifecycle changes.
- Fixed several suggestion visibility issues around turn-end timing, hidden suggestions, and panel rendering.
