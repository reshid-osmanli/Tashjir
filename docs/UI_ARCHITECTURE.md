# UI Identity Architecture

## Audit of the current repository

App Router has 13 UI routes: `/`, `/login`, `/editor`, `/studio`, `/quran`, `/tracking`, `/variants`, `/qiraat`, `/readers`, `/review`, `/admin`, `/settings`, `/statistics`. API transmission routes are backend endpoints, not screens. Shared dashboard layout, confirmation host, public navigation and development Inspector are inventoried too.

## Source of truth

`src/ui/ui-registry.records.json` is the checked-in identity ledger, exposed with types and lookup functions by `src/ui/ui-registry.ts`. `feature-registry.ts` owns feature metadata. No runtime ID allocation occurs. JSX identity tables contain bindings, not independent metadata. Documentation is generated from the ledger.

Every active record has a functional DOM binding, a conceptual parent, owning feature, component and source file. `actions` records event expressions; `stores` and `logicFiles` record the existing ownership/dependency boundary. `testFiles` indicates regression coverage to run, **not a claim that each button has a dedicated behavior test**. Some current context-menu commands are no-ops; metadata says so rather than changing their implementation.

The hierarchy is conceptual, not a DOM path. Shared controls can render in several workspaces; their canonical parent remains stable. Use source component and instance ancestry to locate a concrete render. Moving a control changes `parentId` and any source/route metadata, never its ID.

## Templates and finite controls

Dynamic data rows use one template identity; domain keys go in `data-ui-instance`. A template may appear many times. Distinct finite tabs/options/actions have independent IDs and checked-in key-to-ID tables. IDs do not encode feature, parent, list position or Arabic text. Tombstones remain in the ledger permanently.

## Inspector

The **UI ID Inspector** ships in every build, including the production build served by Vercel, and is off until switched on:

- **Turn on:** open the page with `?uiInspector=1` (for example `https://tashjir.vercel.app/editor?uiInspector=1`), or press **Alt+Shift+I**. The shortcut matches the physical `I` key, so it also works where Option+Shift+I produces another character. `?uiInspector=0` turns it off.
- **Turn off:** click **UI ID Inspector · ON** at the bottom edge, press Alt+Shift+I again, or open the page with `?uiInspector=0`.
- **Memory:** the state is kept for the browser tab (sessionStorage) and mirrored in the URL, so a reload reproduces what is on screen.

While on, every visible element that carries a `data-ui-id` shows a badge whose text is that real registry ID, placed above its top-left corner (or just inside it when there is no room). Badges use `pointer-events: none`, so they never take a click. Badge colour follows the registry kind: action, field, choice, container, or not in registry.

Clicks have two modes, switched with the **Clicks: inspect / use editor** button:

- **Inspect (default):** a click selects the element and opens its registry record without running its action. Pointer, drag and context events outside the inspector are consumed, so no handler runs.
- **Use editor:** clicks behave normally while the badges stay visible. **Alt+click** inspects in either mode.

The details card shows the registry record: ID, name, kind, status, route, parent ID with its name, feature ID with its name, component, source file, recorded action or handler, related IDs, stores, logic files, tests, shortcuts, dependencies, code references, purpose, behaviour and constraints. It also shows the real DOM ancestor chain and the page path. **Copy ID** copies the selected ID. Escape or **Close** clears the selection.

Implementation: `src/app/layout.tsx` mounts `UIRegistryInspector` unconditionally. That loader renders nothing and adds one keydown listener until the inspector is on. It then loads `UIRegistryInspectorPanel` on demand. The panel loads the 2.6 MB registry on first activation through a dynamic import, so ordinary pages do not download it. The pure rules (activation parsing, badge placement, families and detail rows) live in `ui-inspector-activation.ts` and `ui-inspector-model.ts` and are covered by `tests/ui-inspector.test.ts`. The browser contract is in `tests/e2e/ui-inspector.spec.ts`, which runs against the production build as well as dev.

Portals and conditional dialogs are discovered when they open. Their badges disappear when they close. Escape closes the details card.

## Verification

`npm run registry:validate` scans JSX with the TypeScript parser, resolves bindings, checks missing IDs, duplicates, orphan IDs, parent cycles, retired reuse and existing logic/test files. `tests/ui-source-coverage.test.ts` rejects new intrinsic controls, icon actions, editable fields and drag/drop targets without IDs. Forwarding wrappers are declared in `scripts/ui-source-audit.ts`; their actual DOM binding and call-site identity must both be verified. Add wrappers explicitly rather than relying on an ancestor's ID.

Static coverage is exhaustive for the scanner's declared control categories, including unopened JSX branches; it is not mathematical proof of every possible runtime state. Browser smoke tests complement it. Do not equate repeated template DOM instances with duplicate conceptual identities.
