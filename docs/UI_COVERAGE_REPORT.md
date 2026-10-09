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

- The session branch was pushed; GitHub's Vercel status for commit `92d2f2f788e7fc92e958b49d86d39442f8feedc3` reported **Deployment has completed** (2026-10-09 11:04 UTC). Vercel's check details are at [the deployment dashboard](https://vercel.com/reshid-osmanlis-projects/tashjir/DNqtF6CDZtgEGaWyhtaX35NnvXLC).
- The branch preview URL used for the direct attempt is [the editor with Inspector enabled](https://tashjir-git-arena-cd26d510-tashjir-reshid-osmanlis-projects.vercel.app/editor?uiInspector=1). In this sandbox, the Vercel page fetch redirected to Vercel sign-in and Playwright's direct request ended with `net::ERR_CONNECTION_CLOSED`; the Vercel connector is not available in this session. Therefore the deployed DOM could not be inspected and a screenshot of the deployed build could not be captured.
- `test-results/ui-inspector-local-production.png` is a real browser screenshot from the local **production build**, not from Vercel. This distinction is intentional; remote visual verification is still outstanding.

## Interactive Inspector revision (pin-and-inspect)

The earlier Inspector drew a badge on every visible registered element at once, which made the page unreadable. It now works on demand:

- Only the element under the pointer or keyboard focus shows a badge and a temporary outline. Only the pinned element keeps one.
- Clicking a badge pins the exact element. The pinned element is marked red with a temporary overlay (no change to application DOM or styles), and details open.
- The badge click is consumed before the element sees it, so a delete button's badge pins it without deleting anything.
- Escape clears the pin. Toggling off, or navigating to another page, removes all Inspector layers.
- The details card is pointer-transparent except its own Copy and Clear buttons, so it never blocks hovering other elements.

Registry changes (documented, append-only): the new control `A2126` "Clear Inspector Selection Button" was added under `A412`. The behavior text of `A411`, `A412`, and `A731` was updated because the old text described all-at-once badges. Docs were regenerated with `npm run registry:docs`. No existing ID number was changed or reused.

Verification at this revision:

- Vitest: **PASS**, 774 passed, 2 skipped (9 new geometry tests).
- TypeScript: **PASS**. ESLint: **PASS**, zero errors (23 pre-existing warnings).
- Production build: **PASS**.
- Production Playwright: `tests/e2e/ui-inspector.spec.ts` **20/20** and `tests/e2e/ui-registry.spec.ts` **13/13**, against `next start`. They cover the 14 required behaviors, keyboard use, the delete-badge case (variant data byte-identical, no confirmation opened), and a control run showing the uninspected delete button does open the confirmation.
- Pre-existing, unrelated: `tests/e2e/editor-ph3.spec.ts` has 5 failing drag/pointer assertions before and after this change. This change does not touch those paths.
- Browser: Chromium 153 binary from the `@sparticuz/chromium` npm package, because Playwright's CDN is not reachable from this sandbox.

## Remaining coverage limitations

- The scanner generated generic behavior text for 788 active records overall (including 382 of 905 `/editor` records); some generated names elsewhere may remain code-expression fragments. This fix did not rebuild or renumber those records.
- The source scanner covers its declared JSX syntax categories and checked-in UI sources, but cannot prove every possible runtime state. Playwright verifies the key Inspector states and main routes, not every individual control in all 1702 records.
- Native browser/OS popup surfaces are not independent DOM elements that a page overlay can paint over; the registered select/control in the page is identified. In-page menus, lists, dialogs and dynamic elements are rescanned when they enter the DOM.
- No engine, store, data-model, or editing behavior was changed. The patch is limited to Inspector activation, visual badges, Registry-backed details, tests, and related metadata/docs.
