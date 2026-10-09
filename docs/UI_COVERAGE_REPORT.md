# UI Coverage Report — 2026-10-09

Counts are active conceptual records, not rendered data instances. Static coverage follows the declared TypeScript JSX scanner categories.

| Metric | Result |
|---|---:|
| Total Features (including shared/developer surfaces) | 15 |
| UI Routes | 13 |
| Panels | 67 |
| Dialogs | 12 |
| Buttons | 408 |
| Inputs (input + select + textarea + checkbox + radio + slider) | 300 |
| Tabs | 27 |
| Menus | 3 |
| Menu items | 11 |
| Registered UI Elements | 1703 |
| Mapped UI Elements | 1703 |
| Retired records retained | 77 |
| Active records with generic auto-generated behavior text | 788 (of 1703) |
| `/editor` active records with generic behavior text | 382 (of 905) |
| Missing IDs | 0 |
| Duplicate IDs | 0 |
| Orphan IDs | 0 |
| Invalid Parents | 0 |

## Verification (2026-10-09 pass — UI ID Inspector on production builds)

- Registry Validation: **PASS** (`npm run registry:validate`).
- Registry tests: **PASS**, 21 tests across two files.
- General tests: **PASS**, 765 passed, 0 failed, 2 skipped.
- Typecheck: **PASS**.
- Lint: **PASS**, zero errors, 23 pre-existing warnings (none in the changed inspector files).
- Production Build: **PASS** (all routes generated).
- Playwright against a **production server** (`next build && next start`, no dev server): `tests/e2e/ui-registry.spec.ts` 14/14, new `tests/e2e/ui-inspector.spec.ts` **8/8** — visible toggle, real ID badge over button A116 and input A110, registry details from real records, clipboard copy, badges over dynamically opened dialog A421, non-blocking interaction, full removal on OFF, and badge presence on `/studio`, `/quran`, `/tracking`, `/variants`, `/settings`; zero page errors everywhere.
- `tests/e2e/editor-ph3.spec.ts`: 2/7 pass. The 5 failures are **pre-existing and unrelated to the inspector**: they fail identically on the pristine baseline commit `7f44096` (verified by stashing the change and rebuilding) and in both dev and production servers. These drag/long-press/pointer-capture tests had never been executed before (the browser download was unreachable in earlier passes); first run happened in this pass. `tashjir.vercel.app` remains unreachable from the sandbox, so the deployed Vercel DOM was not inspected directly — production behavior was verified against a local `next start` build of the same commit.

## Root cause fixed this pass (why nothing was visible on Vercel)

The UI Registry and its 1702 records were real, but the inspector that renders them was triple-gated to development: `src/app/layout.tsx` mounted `UIRegistryInspector` only when `NODE_ENV === 'development'`, and the component itself returned `null` and disabled every effect outside development. Vercel Preview deploys a production build, so the tool never rendered — registry size and test counts could not change that. The fix mounts the inspector unconditionally and activates it via a visible toggle, `?uiInspector=1`, or Alt+Shift+I; no engine, store, or editor behavior was touched. One new record (A2126, inspector copy button) was appended; the six existing inspector records (A410–A412, A730–A732) were updated in place; no IDs changed and the registry was not regenerated.

## Known gaps (not hidden)

- Behavior text: the scanner generated many records with boilerplate behavior ("لا يضيف السجل سلوكًا جديدًا" / "يعرض المحتوى/القيمة"). The 17 `EditorToolbar` records were rewritten from source; 382 `/editor` records and 788 records overall remain generic. Some generated names are expression fragments or option labels built from code expressions rather than user-facing names.
- `tests/e2e/editor-ph3.spec.ts`: 5 pre-existing failures (line-order drag/long-press/touch/merge/bulk-delete flows) reproduced identically on the baseline commit in this environment; they were never run before this pass. They are unrelated to the inspector (verified on the baseline build) and remain open as a separate work item.
- `tashjir.vercel.app` was not reachable from the sandbox; production verification ran against a local production build of the same commit.

## Scope and limitations

The complete checked-in UI sources were inventoried, including conditional JSX, repeated controls, nested menus and shared layouts. Existing identities were preserved where they still denote a specific concept. Previously grouped actions were split (review approve/revise/reject, line move up/down); inappropriate/decorative or redundant template numbers remain as permanent retired records.

The source scanner guarantees coverage for its listed syntax categories; it does not prove all possible browser states. Regression test references represent ownership boundaries, not dedicated behavior tests for every control. Some shared compound controls intentionally use one template per control role across contexts. Parent hierarchy is conceptual and may differ from runtime nesting.

No engine, store or hook behavior was changed. Changes concern the inspector tooling, its registry records, e2e verification, and documentation.
