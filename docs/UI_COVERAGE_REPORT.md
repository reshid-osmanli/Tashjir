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
| Active records with generic auto-generated behavior text | 788 (of 1702) |
| `/editor` active records with generic behavior text | 382 (of 905) |
| Missing IDs | 0 |
| Duplicate IDs | 0 |
| Orphan IDs | 0 |
| Invalid Parents | 0 |

## Verification

- Registry Validation: **PASS** (`npm run registry:validate`).
- Registry tests: **PASS**, 21 tests across two files.
- General tests: **PASS**, 765 passed, 0 failed, 2 skipped. The former failure in `tests/engine-studio-package02.test.ts` (AC-5) was a stale expectation: `docs/ENGINE_STUDIO.md` specifies that a priority collision shifts the collided chain by one and reports one diff line per shifted rule. The test now checks a free-priority change (one line) and a collision chain (two lines). The engine was not changed.
- Typecheck: **PASS**.
- Lint: **PASS**, zero errors, 23 warnings. Fixed the obsolete `next lint` command to run ESLint directly, ignored generated Next files, and resolved validator escaping errors.
- Production Build: **PASS** (all routes generated).
- HTTP smoke: **PASS** for all 13 routes (200 and identity markers in HTML).
- Browser smoke and Inspector interaction: **PASS** in this pass. Playwright `tests/e2e/ui-registry.spec.ts` runs 14/14 with a Chromium binary (`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`) that bundles its own libraries; the official Playwright browser download is not reachable from the sandbox.
- Prisma postinstall: engine download blocked by restricted network; installation continued using the existing offline fallback. Build succeeded nevertheless.

## Known gaps (not hidden)

- Behavior text: the scanner generated many records with boilerplate behavior ("لا يضيف السجل سلوكًا جديدًا" / "يعرض المحتوى/القيمة"). The 17 `EditorToolbar` records were rewritten from source; 382 `/editor` records and 788 records overall remain generic. Some generated names are expression fragments (e.g. A730) or option labels built from code expressions (e.g. `formatPercent(...)`) rather than user-facing names.
- Browser verification (this pass): Chromium via `@sparticuz/chromium` with bundled libraries. All 13 production routes return 200 with no page errors, every visible interactive control on load carries `data-ui-id`, Playwright `tests/e2e/ui-registry.spec.ts` passes 14/14, and the development UI Inspector toggles and shows details. `tashjir.vercel.app` was not reachable from the sandbox, so production DOM was not inspected directly.

## Scope and limitations

The complete checked-in UI sources were inventoried, including conditional JSX, repeated controls, nested menus and shared layouts. Existing identities were preserved where they still denote a specific concept. Previously grouped actions were split (review approve/revise/reject, line move up/down); inappropriate/decorative or redundant template numbers remain as permanent retired records.

The source scanner guarantees coverage for its listed syntax categories; it does not prove all possible browser states. Regression test references represent ownership boundaries, not dedicated behavior tests for every control. Some shared compound controls intentionally use one template per control role across contexts. Parent hierarchy is conceptual and may differ from runtime nesting. Browser validation remains outstanding: **do not describe the whole task as fully verified/completed** until browser smoke and the general failing test are resolved or explicitly accepted.

No engine, store or hook behavior was changed. Changes concern UI identity metadata/bindings, developer tooling, validation, documentation and verification commands.
