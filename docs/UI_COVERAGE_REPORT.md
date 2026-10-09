# UI Coverage Report — 2026-10-09

Counts are conceptual Registry records, not rendered data instances. Static coverage follows the declared TypeScript JSX scanner categories.

| Metric | Result |
|---|---:|
| Total Features (including shared/developer surfaces) | 15 |
| UI Routes | 13 |
| UI Registry records (including retired) | 1779 |
| Active registered UI Elements | 1702 |
| Mapped active UI Elements | 1702 |
| Retired records retained | 77 |
| Panels | 67 |
| Dialogs | 12 |
| Buttons | 406 |
| Inputs (input + select + textarea + checkbox + radio + slider) | 300 |
| Tabs | 27 |
| Menus | 3 |
| Menu items | 11 |
| Active records with generic auto-generated behavior text | 788 (of 1702) |
| `/editor` active records with generic behavior text | 382 (of 905) |
| Missing IDs | 0 |
| Duplicate IDs | 0 |
| Orphan IDs | 0 |
| Invalid Parents | 0 |

## Production Inspector: cause and correction

The previous Inspector was present in the repository and its overlay already scanned real `[data-ui-id]` DOM elements. However, `src/app/layout.tsx` mounted it only when `NODE_ENV === 'development'`, and `UIRegistryInspector.tsx` contained additional development-only early returns. A Vercel Preview is built as production, so the Inspector and its badges were absent there. Existing DOM IDs and a successful Registry validation did not make any IDs visible by themselves.

The Registry was not regenerated. Its record count remains 1779 total: 1702 active and 77 retired. The correction makes the Inspector available on every route via `?uiInspector=1` and the `Alt+Shift+I` shortcut; it is hidden by default. Badges copy the real target's `data-ui-id`, are pointer-transparent, update when dynamic UI is added, and Alt+click opens actual Registry metadata without firing the app action. The details card includes a Copy ID control.

## Verification

- Registry validation: **PASS** (`npm run registry:validate`): 1702/1702 mapped; zero missing, duplicate, orphan, or invalid-parent IDs.
- Vitest: **PASS**, 765 passed, 2 skipped (`npm test`).
- TypeScript: **PASS** (`npm run typecheck`).
- ESLint: **PASS**, zero errors and 23 warnings in existing unrelated files (`npm run lint`).
- Production build: **PASS** (`npm run build`); all 13 App Router routes were generated.
- Production Playwright Inspector suite: **PASS**, 15/15 (`npm run test:e2e:production`) against local `next start`, not `next dev`. It checks all 13 routes in their normal state, verifies badge-to-DOM identity equality on `/editor`, `/studio`, `/quran`, and `/tracking`, tests a real editor button, input and select, checks dynamic search results and a dialog, copies the selected ID, confirms ordinary clicks work, and confirms toggling off removes all Inspector DOM.
- Screenshot from the local production browser run: `test-results/ui-inspector-local-production.png`.
- A broader Playwright run also exercised `editor-ph3.spec.ts`; 5 pointer/touch reorder assertions timed out or missed expected drag-state classes under the available Chromium 153 binary. Those cases do not use the Inspector; the dedicated Inspector E2E suite above passes.
- Prisma postinstall could not fetch its engine from `binaries.prisma.sh` in this network-restricted sandbox and used the repository's fallback. The production build still passed.

## Vercel deployment status

A production-mode local browser run does not prove a remote deployment. The Vercel Preview still needs to be created from the session branch and opened directly; until that remote DOM and screenshot are checked, this report does **not** claim Vercel visual verification.

## Remaining coverage limitations

- The scanner generated generic behavior text for 788 active records overall (including 382 of 905 `/editor` records); some generated names elsewhere may remain code-expression fragments. This fix did not rebuild or renumber those records.
- The source scanner covers its declared JSX syntax categories and checked-in UI sources, but cannot prove every possible runtime state. Playwright verifies the key Inspector states and main routes, not every individual control in all 1702 records.
- Native browser/OS popup surfaces are not independent DOM elements that a page overlay can paint over; the registered select/control in the page is identified. In-page menus, lists, dialogs and dynamic elements are rescanned when they enter the DOM.
- No engine, store, data-model, or editing behavior was changed. The patch is limited to Inspector activation, visual badges, Registry-backed details, tests, and related metadata/docs.
