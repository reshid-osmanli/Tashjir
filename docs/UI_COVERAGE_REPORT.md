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
- Browser verification (this pass): Chromium via `@sparticuz/chromium` with bundled libraries. All 13 production routes return 200 with no page errors, every visible interactive control on load carries `data-ui-id`, Playwright `tests/e2e/ui-registry.spec.ts` passes 14/14, and the development UI Inspector toggles and shows details. `tashjir.vercel.app` was not reachable from the sandbox, so production DOM was not inspected directly. *(Correction, 2026-10-09: the public production domain is readable from the sandbox. Only the SSO-protected preview aliases are not.)*

## Scope and limitations

The complete checked-in UI sources were inventoried, including conditional JSX, repeated controls, nested menus and shared layouts. Existing identities were preserved where they still denote a specific concept. Previously grouped actions were split (review approve/revise/reject, line move up/down); inappropriate/decorative or redundant template numbers remain as permanent retired records.

The source scanner guarantees coverage for its listed syntax categories; it does not prove all possible browser states. Regression test references represent ownership boundaries, not dedicated behavior tests for every control. Some shared compound controls intentionally use one template per control role across contexts. Parent hierarchy is conceptual and may differ from runtime nesting. Browser validation remains outstanding: **do not describe the whole task as fully verified/completed** until browser smoke and the general failing test are resolved or explicitly accepted.

No engine, store or hook behavior was changed. Changes concern UI identity metadata/bindings, developer tooling, validation, documentation and verification commands.

## Update 2026-10-09: UI ID Inspector on the production build

Cause: the Inspector was mounted only when `process.env.NODE_ENV === 'development'` (`src/app/layout.tsx`). Production builds, including the Vercel build, therefore contained no badges. The IDs were in the DOM (374 `data-ui-id` nodes on `/editor` in a production build) but nothing displayed them.

Fix: the Inspector is mounted on every build and stays inert until switched on with `?uiInspector=1` or Alt+Shift+I. Its registry data loads on first activation, in a separate chunk. Ordinary pages do not download the 2.6 MB registry. Details are in `docs/UI_ARCHITECTURE.md`, section "Inspector".

Registry changes. No ID was changed or removed.
- Added A2126 (UI ID Copy Button) and A2127 (UI ID Inspector Click Mode).
- Corrected the six existing Inspector records A410, A411, A412, A730, A731 and A732. Their names and descriptions had been code fragments, for example the A730 name. Their parent links now follow the real DOM. A731 changed from `button` to `control` because the badge is no longer interactive.
- Active counts after the change: registered 1704 (was 1702), buttons 408 (was 407), controls 176 (was 175). Retired 77 is unchanged. Missing, duplicate, orphan and invalid-parent counts are all 0.

Verification in this pass (sandbox; Chromium 153 through `@sparticuz/chromium`):
- `npm run registry:validate`: PASS (1704 registered, 0 missing, 0 duplicate, 0 orphan, 0 invalid parents).
- `npx vitest run`: 783 passed, 2 skipped (68 files passed, 1 skipped). Includes `tests/ui-inspector.test.ts` (18 tests) and the registry and source-coverage tests.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: 0 errors, 23 warnings. None of the warnings are in the changed files.
- `npm run build`: PASS, 17 routes generated. The registry JSON is in its own lazy chunk and is not in any editor or shared chunk.
- Playwright on the production build (`next start`): `tests/e2e/ui-inspector.spec.ts` 4/4 PASS, `tests/e2e/ui-registry.spec.ts` 13/13 PASS.
- Full Playwright suite on the production build: 19 passed, 5 failed. The 5 failures are in `tests/e2e/editor-ph3.spec.ts` (drag, touch and bulk-delete gestures). The same 5 fail on the pre-change commit `7f44096`, so they predate this work. They were not touched here and are not claimed as fixed.
- Inspector off: against a build of the pre-change commit `7f44096`, with the clock frozen, the DOM is identical on all 13 routes. Screenshots match on repeated samples. Isolated frames differ only where the unmodified build also varies between runs.

Vercel: the SSO-protected preview cannot be opened from the sandbox, so no visual check on Vercel is claimed here. The pull request and the commit status hold the preview deployment reference.

