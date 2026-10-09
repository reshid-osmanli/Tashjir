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

Development only: floating **UI Inspector**, or **Alt+Shift+I**. Click a badge to view metadata. **Alt+click the actual control** to inspect nested HTML/SVG controls without running their action. Normal clicks retain their original behavior. Escape closes details; toggle disables inspection. Portals and conditional dialogs are discovered when opened. The root layout does not mount Inspector in production.

## Verification

`npm run registry:validate` scans JSX with the TypeScript parser, resolves bindings, checks missing IDs, duplicates, orphan IDs, parent cycles, retired reuse and existing logic/test files. `tests/ui-source-coverage.test.ts` rejects new intrinsic controls, icon actions, editable fields and drag/drop targets without IDs. Forwarding wrappers are declared in `scripts/ui-source-audit.ts`; their actual DOM binding and call-site identity must both be verified. Add wrappers explicitly rather than relying on an ancestor's ID.

Static coverage is exhaustive for the scanner's declared control categories, including unopened JSX branches; it is not mathematical proof of every possible runtime state. Browser smoke tests complement it. Do not equate repeated template DOM instances with duplicate conceptual identities.
