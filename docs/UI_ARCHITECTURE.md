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

Off by default: no badges, overlay, listeners, or Registry JSON. Turn on with **Alt+Shift+I** or `?uiInspector=1`, in any build.

- **Hover** a registered element: only its badge (`A333 · name`) and a temporary blue outline appear. Other elements get nothing.
- **Click the badge** (or **Alt+click** the element) to pin it. The pinned element gets a red marker chosen by type (fill for buttons, ring for fields, bottom bar for tabs, dashed outline for panels), and a details card shows its ID, name, type, page, parent, feature, component, source file, action/handler, and related IDs. Missing data shows as unavailable, never as an invented value.
- The badge click never runs the element's action. A badge event is consumed in the capture phase.
- **Alt+Shift+Enter** pins the hovered or keyboard-focused element. **Escape** clears the pin only; the editor's own Escape still runs.
- Badges and markers are a fixed, pointer-transparent overlay outside the layout. The Inspector never changes application DOM, styles, or data.
- Navigating to another page, or turning the Inspector off, removes every badge, outline, and marker.

Placement and hover-bridging rules live in `src/components/dev/inspector-geometry.ts` and are unit-tested in `tests/ui-inspector-geometry.test.ts`. Browser behavior is tested in `tests/e2e/ui-inspector.spec.ts` against the production build.

## Verification

`npm run registry:validate` scans JSX with the TypeScript parser, resolves bindings, checks missing IDs, duplicates, orphan IDs, parent cycles, retired reuse and existing logic/test files. `tests/ui-source-coverage.test.ts` rejects new intrinsic controls, icon actions, editable fields and drag/drop targets without IDs. Forwarding wrappers are declared in `scripts/ui-source-audit.ts`; their actual DOM binding and call-site identity must both be verified. Add wrappers explicitly rather than relying on an ancestor's ID.

Static coverage is exhaustive for the scanner's declared control categories, including unopened JSX branches; it is not mathematical proof of every possible runtime state. Browser smoke tests complement it. Do not equate repeated template DOM instances with duplicate conceptual identities.
