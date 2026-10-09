# UI Coverage Report — 2026-10-08

Counts are active conceptual records, not rendered data instances. Static coverage follows the declared TypeScript JSX scanner categories.

| Metric | Result |
|---|---:|
| Total Features (including shared/developer surfaces) | 15 |
| UI Routes | 13 |
| Panels | 67 |
| Dialogs | 12 |
| Buttons | 407 |
| Inputs (input + select + textarea + checkbox + radio + slider) | 300 |
| Tabs | 27 |
| Menus | 3 |
| Menu items | 11 |
| Registered UI Elements | 1702 |
| Mapped UI Elements | 1702 |
| Retired records retained | 77 |
| Missing IDs | 0 |
| Duplicate IDs | 0 |
| Orphan IDs | 0 |
| Invalid Parents | 0 |

## Verification

- Registry Validation: **PASS** (`npm run registry:validate`).
- Registry tests: **PASS**, 21 tests across two files.
- General tests: **FAIL**, 763 passed, 1 failed, 2 skipped. The failing assertion is `tests/engine-studio-package02.test.ts:376`: expected one export diff line, received two. Reproduced in isolation. The engine/store implementation and this test were not modified; do not claim the entire suite passes.
- Typecheck: **PASS**.
- Lint: **PASS**, zero errors, 23 warnings. Fixed the obsolete `next lint` command to run ESLint directly, ignored generated Next files, and resolved validator escaping errors.
- Production Build: **PASS** (all routes generated).
- HTTP smoke: **PASS** for all 13 routes (200 and identity markers in HTML).
- Browser smoke and Inspector interaction: **BLOCKED**, browser could not launch because `libnspr4.so` is absent. The 14 Playwright attempts failed before rendering pages; these are not successful browser verification. Tests are checked in for an environment with Chromium dependencies.
- Prisma postinstall: engine download blocked by restricted network; installation continued using the existing offline fallback. Build succeeded nevertheless.

## Scope and limitations

The complete checked-in UI sources were inventoried, including conditional JSX, repeated controls, nested menus and shared layouts. Existing identities were preserved where they still denote a specific concept. Previously grouped actions were split (review approve/revise/reject, line move up/down); inappropriate/decorative or redundant template numbers remain as permanent retired records.

The source scanner guarantees coverage for its listed syntax categories; it does not prove all possible browser states. Regression test references represent ownership boundaries, not dedicated behavior tests for every control. Some shared compound controls intentionally use one template per control role across contexts. Parent hierarchy is conceptual and may differ from runtime nesting. Browser validation remains outstanding: **do not describe the whole task as fully verified/completed** until browser smoke and the general failing test are resolved or explicitly accepted.

No engine, store or hook behavior was changed. Changes concern UI identity metadata/bindings, developer tooling, validation, documentation and verification commands.
