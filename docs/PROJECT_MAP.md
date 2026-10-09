# Tashjir Project Map

This map is generated from `src/ui/feature-registry.ts`; exact interactive-element identities are in [UI_REGISTRY.md](./UI_REGISTRY.md), and change procedure is in [CHANGE_PROTOCOL.md](./CHANGE_PROTOCOL.md). Do not hand-edit generated sections.

## Current routes and cross-cutting surfaces

| Feature ID | Feature | Route/surface | Primary files |
|---|---|---|---|
| A001 | Editor | `/editor` | `src/app/(dashboard)/editor/page.tsx`, `src/components/editor/EditorToolbar.tsx`, `src/components/editor/AyahNavigator.tsx`, `src/components/editor/TashjeerCanvas.tsx`, `src/components/editor/PropertiesPanel.tsx`, `src/components/editor/VariantsPanel.tsx` |
| A002 | Engine Studio | `/studio` | `src/app/(dashboard)/studio/page.tsx`, `src/stores/engine-config-ui-store.ts`, `src/lib/tashjeer/engine-config-store.ts` |
| A003 | Quran View | `/quran` | `src/app/(dashboard)/quran/page.tsx`, `src/components/quran/AyahTashjeerView.tsx`, `src/lib/tashjeer/ayah-tashjeer-source.ts` |
| A004 | Tracking | `/tracking` | `src/app/(dashboard)/tracking/page.tsx`, `src/lib/storage/tracking-store.ts` |
| A005 | Variant and Rule Index | `/variants` | `src/app/(dashboard)/variants/page.tsx`, `src/lib/storage/document-store.ts`, `src/lib/storage/global-rules-store.ts` |
| A006 | Qiraat Catalog | `/qiraat` | `src/app/(dashboard)/qiraat/page.tsx`, `src/data/qiraat-data/qiraat.ts` |
| A007 | Readers Catalog | `/readers` | `src/app/(dashboard)/readers/page.tsx`, `src/types/index.ts` |
| A008 | Scientific Review | `/review` | `src/app/(dashboard)/review/page.tsx` |
| A009 | Transmission Administration | `/admin` | `src/app/(dashboard)/admin/page.tsx`, `src/lib/transmissions/catalog.ts` |
| A010 | Settings | `/settings` | `src/app/(dashboard)/settings/page.tsx` |
| A011 | Statistics | `/statistics` | `src/app/(dashboard)/statistics/page.tsx` |
| A012 | Public Landing | `/` | `src/app/page.tsx`, `src/components/marketing/PublicHeader.tsx`, `src/components/marketing/PublicFooter.tsx` |
| A013 | Local Sign-in | `/login` | `src/app/login/page.tsx`, `src/components/layout/SessionBadge.tsx` |
| A014 | Developer UI Inspector | `shared-dashboard` | `src/components/dev/UIRegistryInspector.tsx`, `src/ui/ui-registry.ts` |
| A015 | Dashboard Workspace Shell | `shared-dashboard` | `src/app/(dashboard)/layout.tsx`, `src/components/layout/SessionBadge.tsx`, `src/components/ui/ConfirmDialogHost.tsx` |

## Architecture and ownership

- **Route/UI layer:** App Router pages and components own presentation and user interaction; registered UI IDs are stable handles, not React keys.
- **State and persistence:** Stores/catalogs listed per feature own the current persisted state. A presentation-only change must not create another state owner.
- **Engine and data:** Listed engine dependencies are the existing behavior owners. UI work must call them rather than duplicating their rules.
- **Verification:** Feature test files and registry-wide validation are the expected regression boundary; inspect the feature's impact map before changing a lower layer.

## Feature map and impact layers

## A001 — Editor

- **Current route/surface:** `/editor` (active)
- **Entry and primary files:** `src/app/(dashboard)/editor/page.tsx`, `src/components/editor/EditorToolbar.tsx`, `src/components/editor/AyahNavigator.tsx`, `src/components/editor/TashjeerCanvas.tsx`, `src/components/editor/PropertiesPanel.tsx`, `src/components/editor/VariantsPanel.tsx`
- **Components:** `EditorPage`, `EditorToolbar`, `AyahNavigator`, `TashjeerCanvas`, `PropertiesPanel`, `VariantsPanel`, `SmartCreateWizard`
- **State/persistence owners:** `src/stores/editor-store.ts`, `src/lib/editor/selection-store.ts`
- **Engine and data dependencies:** `src/lib/tashjeer/layout-engine.ts`, `src/lib/tashjeer/branch-engine.ts`, `src/lib/tashjeer/smart-create.ts`, `src/lib/tashjeer/clipboard.ts`, `src/lib/tashjeer/bulk-operations.ts`, `src/lib/tashjeer/merge-operations.ts`, `src/lib/tashjeer/manual-links.ts`, `src/lib/tashjeer/selection-commands.ts`
- **Focused tests:** `tests/selection-store.test.ts`, `tests/editor-manual-actions.test.ts`, `tests/editor-bulk-actions.test.ts`, `tests/editor-multi-difference.test.ts`, `tests/package05-multi-difference.test.ts`, `tests/package06-wizard.test.ts`, `tests/package07-acceptance.test.ts`, `tests/e2e/editor-ph3.spec.ts`

| Layer | UI identities | Owning files/systems |
|---|---|---|
| UI | `A020`, `A100`, `A101`, `A107`, `A111`, `A113`, `A114` | `src/app/(dashboard)/editor/page.tsx`, `src/components/editor/` |
| Store | `A103`, `A104`, `A129` | `src/stores/editor-store.ts`, `src/lib/editor/selection-store.ts` |
| Engine | `A111`, `A123`, `A128` | `src/lib/tashjeer/` |
| Data Model | `A114`, `A121`, `A128` | `src/types/tashjeer.ts`, `src/lib/tashjeer/model/v8.ts` |
| Persistence | `A134`, `A143`, `A144` | `src/lib/storage/document-store.ts`, `src/lib/storage/global-rules-store.ts` |
| Tests | `A020`, `A333`, `A421` | `tests/editor-*.test.ts`, `tests/package0*.test.ts` |

## A002 — Engine Studio

- **Current route/surface:** `/studio` (active)
- **Entry and primary files:** `src/app/(dashboard)/studio/page.tsx`, `src/stores/engine-config-ui-store.ts`, `src/lib/tashjeer/engine-config-store.ts`
- **Components:** `EngineStudioPage`, `Dashboard`, `RuleExplorer`, `RuleBuilder`, `MergeMatrixPanel`, `PriorityPipeline`, `WhyTracePlayground`, `RuleTestsPanel`, `CandidateRulesPanel`, `ProfileComparePanel`, `PublishHistoryPanel`, `ExportImportPanel`, `EngineSettingsPanel`, `RecitationRuleCatalogPanel`
- **State/persistence owners:** `src/stores/engine-config-ui-store.ts`, `src/lib/tashjeer/engine-config-store.ts`, `src/lib/tashjeer/engine-config-history.ts`
- **Engine and data dependencies:** `src/lib/tashjeer/decision/resolver.ts`, `src/lib/tashjeer/decision/policy.ts`, `src/lib/tashjeer/decision/rule-test-runner.ts`, `src/lib/tashjeer/decision/profile-compare.ts`, `src/lib/tashjeer/decision/profile-audit.ts`, `src/lib/tashjeer/recitation-rule-catalog.ts`
- **Focused tests:** `tests/engine-studio-package02.test.ts`, `tests/engine-studio-policy.test.ts`, `tests/candidate-rule.test.ts`, `tests/decision-resolver.test.ts`, `tests/rule-test-runner.test.ts`, `tests/profile-compare.test.ts`, `tests/engine-config-history.test.ts`

| Layer | UI identities | Owning files/systems |
|---|---|---|
| UI | `A021`, `A150`, `A155`, `A158`, `A162`, `A163`, `A168` | `src/app/(dashboard)/studio/page.tsx`, `src/components/studio/` |
| Store | `A152`, `A154`, `A161` | `src/stores/engine-config-ui-store.ts`, `src/lib/tashjeer/engine-config-store.ts` |
| Engine | `A160`, `A162`, `A163`, `A164`, `A165` | `src/lib/tashjeer/decision/` |
| Data Model | `A158`, `A160`, `A162`, `A163` | `src/lib/tashjeer/model/v8.ts` |
| Persistence | `A154`, `A168`, `A169` | `src/lib/tashjeer/engine-config-store.ts`, `src/lib/tashjeer/engine-config-history.ts` |
| Tests | `A021`, `A160`, `A168`, `A169` | `tests/engine-studio-*.test.ts`, `tests/decision-*.test.ts` |

## A003 — Quran View

- **Current route/surface:** `/quran` (active)
- **Entry and primary files:** `src/app/(dashboard)/quran/page.tsx`, `src/components/quran/AyahTashjeerView.tsx`, `src/lib/tashjeer/ayah-tashjeer-source.ts`
- **Components:** `QuranPage`, `AyahTashjeerView`, `TashjeerFigure`
- **State/persistence owners:** `src/lib/storage/document-store.ts`, `src/lib/storage/global-rules-store.ts`, `src/lib/storage/rule-occurrences-store.ts`
- **Engine and data dependencies:** `src/hooks/useAyahTashjeer.ts`, `src/lib/tashjeer/ayah-tashjeer-source.ts`, `src/lib/tashjeer/branch-engine.ts`, `src/lib/tashjeer/classic-tashjeer.ts`
- **Focused tests:** `tests/quran-data.test.ts`, `tests/ayah-tashjeer-source.test.ts`, `tests/figure-render.test.ts`, `tests/global-rule-engine.test.ts`

| Layer | UI identities | Owning files/systems |
|---|---|---|
| UI | `A022`, `A180`, `A184`, `A187` | `src/app/(dashboard)/quran/page.tsx`, `src/components/quran/AyahTashjeerView.tsx` |
| Store | `A183`, `A188` | `src/lib/storage/document-store.ts`, `src/lib/storage/global-rules-store.ts`, `src/lib/storage/rule-occurrences-store.ts` |
| Engine | `A187` | `src/hooks/useAyahTashjeer.ts`, `src/lib/tashjeer/ayah-tashjeer-source.ts` |
| Data Model | `A184`, `A187` | `src/types/tashjeer.ts`, `src/data/quran/index.ts` |
| Tests | `A022`, `A187` | `tests/quran-data.test.ts`, `tests/ayah-tashjeer-source.test.ts`, `tests/figure-render.test.ts` |

## A004 — Tracking

- **Current route/surface:** `/tracking` (active)
- **Entry and primary files:** `src/app/(dashboard)/tracking/page.tsx`, `src/lib/storage/tracking-store.ts`
- **Components:** `TrackingPage`, `TrackingRowCard`, `CorrectionTripletView`, `RowDecisionTrace`
- **State/persistence owners:** `src/lib/storage/tracking-store.ts`, `src/lib/storage/document-store.ts`, `src/lib/storage/rule-occurrences-store.ts`
- **Engine and data dependencies:** `src/lib/tashjeer/decision/api.ts`, `src/lib/tashjeer/decision/editor-bridge.ts`, `src/lib/tashjeer/decision/resolver.ts`
- **Focused tests:** `tests/rule-occurrences-store.test.ts`, `tests/decision-resolver.test.ts`, `tests/decision-editor-bridge.test.ts`, `tests/profile-audit.test.ts`

| Layer | UI identities | Owning files/systems |
|---|---|---|
| UI | `A023`, `A200`, `A201`, `A203`, `A204` | `src/app/(dashboard)/tracking/page.tsx` |
| Store | `A203`, `A204` | `src/lib/storage/tracking-store.ts`, `src/lib/storage/rule-occurrences-store.ts` |
| Engine | `A206`, `A207` | `src/lib/tashjeer/decision/api.ts`, `src/lib/tashjeer/decision/resolver.ts` |
| Data Model | `A204` | `src/types/tashjeer.ts`, `src/lib/tashjeer/model/v8.ts` |
| Tests | `A023`, `A206` | `tests/rule-occurrences-store.test.ts`, `tests/decision-editor-bridge.test.ts` |

## A005 — Variant and Rule Index

- **Current route/surface:** `/variants` (active)
- **Entry and primary files:** `src/app/(dashboard)/variants/page.tsx`, `src/lib/storage/document-store.ts`, `src/lib/storage/global-rules-store.ts`
- **Components:** `VariantsIndexPage`, `RuleOccurrenceReview`, `GlobalRuleMetaEditor`, `StrengthDegreePicker`
- **State/persistence owners:** `src/lib/storage/document-store.ts`, `src/lib/storage/global-rules-store.ts`, `src/lib/storage/rule-occurrences-store.ts`
- **Engine and data dependencies:** `src/lib/quran-logic/global-rule-engine.ts`, `src/lib/tashjeer/scope.ts`, `src/lib/tashjeer/strength-degrees.ts`
- **Focused tests:** `tests/global-rule-engine.test.ts`, `tests/rule-occurrences-store.test.ts`, `tests/strength-degrees.test.ts`

| Layer | UI identities | Owning files/systems |
|---|---|---|
| UI | `A024`, `A220`, `A221`, `A222`, `A223` | `src/app/(dashboard)/variants/page.tsx` |
| Store | `A223` | `src/lib/storage/document-store.ts`, `src/lib/storage/global-rules-store.ts` |
| Engine | `A222`, `A223` | `src/lib/quran-logic/global-rule-engine.ts` |
| Tests | `A024`, `A223` | `tests/global-rule-engine.test.ts`, `tests/rule-occurrences-store.test.ts` |

## A006 — Qiraat Catalog

- **Current route/surface:** `/qiraat` (active)
- **Entry and primary files:** `src/app/(dashboard)/qiraat/page.tsx`, `src/data/qiraat-data/qiraat.ts`
- **Components:** `QiraatPage`, `QiraatTree`
- **State/persistence owners:** —
- **Engine and data dependencies:** `src/data/qiraat-data/qiraat.ts`, `src/data/qiraat-data/narrator-profiles.ts`
- **Focused tests:** `tests/catalog-order.test.ts`, `tests/reader-symbols.test.ts`

| Layer | UI identities | Owning files/systems |
|---|---|---|
| UI | `A025`, `A230`, `A231` | `src/app/(dashboard)/qiraat/page.tsx`, `src/components/visualization/QiraatTree.tsx` |
| Data Model | `A231` | `src/data/qiraat-data/` |
| Tests | `A025`, `A231` | `tests/catalog-order.test.ts`, `tests/reader-symbols.test.ts` |

## A007 — Readers Catalog

- **Current route/surface:** `/readers` (active)
- **Entry and primary files:** `src/app/(dashboard)/readers/page.tsx`, `src/types/index.ts`
- **Components:** `ReadersPage`
- **State/persistence owners:** —
- **Engine and data dependencies:** `src/data/qiraat-data/qiraat.ts`
- **Focused tests:** `tests/catalog-order.test.ts`

| Layer | UI identities | Owning files/systems |
|---|---|---|
| UI | `A026`, `A240`, `A241`, `A242` | `src/app/(dashboard)/readers/page.tsx` |
| Data Model | `A241`, `A242` | `src/types/index.ts` |
| Tests | `A026`, `A242` | `tests/catalog-order.test.ts` |

## A008 — Scientific Review

- **Current route/surface:** `/review` (active)
- **Entry and primary files:** `src/app/(dashboard)/review/page.tsx`
- **Components:** `ReviewPage`
- **State/persistence owners:** `src/lib/storage/document-store.ts`
- **Engine and data dependencies:** —
- **Focused tests:** `tests/document-store.test.ts`

| Layer | UI identities | Owning files/systems |
|---|---|---|
| UI | `A027`, `A250`, `A251`, `A252` | `src/app/(dashboard)/review/page.tsx` |
| Store | `A252` | `src/lib/storage/document-store.ts` |
| Tests | `A027`, `A252` | `tests/document-store.test.ts` |

## A009 — Transmission Administration

- **Current route/surface:** `/admin` (active)
- **Entry and primary files:** `src/app/(dashboard)/admin/page.tsx`, `src/lib/transmissions/catalog.ts`
- **Components:** `AdminPage`, `TransmissionManager`, `TransmissionEditor`
- **State/persistence owners:** `src/lib/transmissions/catalog.ts`
- **Engine and data dependencies:** `src/lib/tashjeer/engine-settings.ts`
- **Focused tests:** `tests/catalog-order.test.ts`

| Layer | UI identities | Owning files/systems |
|---|---|---|
| UI | `A028`, `A260`, `A261`, `A262` | `src/app/(dashboard)/admin/page.tsx` |
| Store | `A261`, `A262` | `src/lib/transmissions/catalog.ts` |
| Engine | `A260` | `src/lib/tashjeer/engine-settings.ts` |
| Tests | `A028`, `A261` | `tests/catalog-order.test.ts` |

## A010 — Settings

- **Current route/surface:** `/settings` (active)
- **Entry and primary files:** `src/app/(dashboard)/settings/page.tsx`
- **Components:** `SettingsPage`, `StrengthDegreesManager`
- **State/persistence owners:** `src/lib/tashjeer/strength-degrees.ts`
- **Engine and data dependencies:** `src/data/quran/index.ts`
- **Focused tests:** `tests/strength-degrees.test.ts`

| Layer | UI identities | Owning files/systems |
|---|---|---|
| UI | `A029`, `A270`, `A271` | `src/app/(dashboard)/settings/page.tsx`, `src/components/settings/StrengthDegreesManager.tsx` |
| Store | `A271` | `src/lib/tashjeer/strength-degrees.ts` |
| Tests | `A029`, `A271` | `tests/strength-degrees.test.ts` |

## A011 — Statistics

- **Current route/surface:** `/statistics` (active)
- **Entry and primary files:** `src/app/(dashboard)/statistics/page.tsx`
- **Components:** `StatisticsPage`
- **State/persistence owners:** `src/lib/storage/document-store.ts`
- **Engine and data dependencies:** `src/data/quran/index.ts`
- **Focused tests:** `tests/quran-data.test.ts`

| Layer | UI identities | Owning files/systems |
|---|---|---|
| UI | `A030`, `A280` | `src/app/(dashboard)/statistics/page.tsx` |
| Store | `A280` | `src/lib/storage/document-store.ts` |
| Data Model | `A280` | `src/data/quran/index.ts` |
| Tests | `A030`, `A280` | `tests/quran-data.test.ts` |

## A012 — Public Landing

- **Current route/surface:** `/` (active)
- **Entry and primary files:** `src/app/page.tsx`, `src/components/marketing/PublicHeader.tsx`, `src/components/marketing/PublicFooter.tsx`
- **Components:** `HomePage`, `PublicHeader`, `PublicFooter`, `LandingStory`, `LandingProof`
- **State/persistence owners:** —
- **Engine and data dependencies:** `src/lib/tashjeer/showcase.ts`
- **Focused tests:** `tests/landing-showcase.test.ts`

| Layer | UI identities | Owning files/systems |
|---|---|---|
| UI | `A031`, `A290`, `A291` | `src/app/page.tsx`, `src/components/marketing/` |
| Engine | `A290` | `src/lib/tashjeer/showcase.ts` |
| Tests | `A031`, `A290` | `tests/landing-showcase.test.ts` |

## A013 — Local Sign-in

- **Current route/surface:** `/login` (active)
- **Entry and primary files:** `src/app/login/page.tsx`, `src/components/layout/SessionBadge.tsx`
- **Components:** `LoginPage`, `SessionBadge`
- **State/persistence owners:** —
- **Engine and data dependencies:** —
- **Focused tests:** —

| Layer | UI identities | Owning files/systems |
|---|---|---|
| UI | `A032`, `A340`, `A341`, `A342` | `src/app/login/page.tsx` |
| Persistence | `A344` | `src/app/login/page.tsx` |

## A014 — Developer UI Inspector

- **Current route/surface:** `shared-dashboard` (active)
- **Entry and primary files:** `src/components/dev/UIRegistryInspector.tsx`, `src/ui/ui-registry.ts`
- **Components:** `UIRegistryInspector`
- **State/persistence owners:** —
- **Engine and data dependencies:** —
- **Focused tests:** `tests/ui-registry.test.ts`, `tests/e2e/ui-inspector-overlay.spec.ts`

| Layer | UI identities | Owning files/systems |
|---|---|---|
| UI | `A410`, `A411`, `A412`, `A2126` | `src/components/dev/UIRegistryInspector.tsx` |
| Tests | `A410`, `A411`, `A412`, `A2126` | `tests/ui-registry.test.ts`, `tests/e2e/ui-inspector-overlay.spec.ts` |

## A015 — Dashboard Workspace Shell

- **Current route/surface:** `shared-dashboard` (active)
- **Entry and primary files:** `src/app/(dashboard)/layout.tsx`, `src/components/layout/SessionBadge.tsx`, `src/components/ui/ConfirmDialogHost.tsx`
- **Components:** `DashboardLayout`, `SessionBadge`, `ConfirmDialogHost`
- **State/persistence owners:** `src/lib/ui/confirm-store.ts`
- **Engine and data dependencies:** —
- **Focused tests:** `tests/confirm-store.test.ts`

| Layer | UI identities | Owning files/systems |
|---|---|---|
| UI | `A310`, `A311`, `A312`, `A313`, `A314`, `A315`, `A316`, `A317`, `A318`, `A319`, `A320`, `A321`, `A322`, `A323`, `A324`, `A325`, `A326`, `A327` | `src/app/(dashboard)/layout.tsx`, `src/components/layout/SessionBadge.tsx` |
| Store | `A327` | `src/lib/ui/confirm-store.ts` |
| Tests | `A327` | `tests/confirm-store.test.ts` |

## Global source of truth

- Machine-readable feature definitions: `src/ui/feature-registry.ts`.
- Machine-readable UI definitions: `src/ui/ui-registry.ts`.
- DOM binding validator: `src/ui/registry-validation.ts`.
- Human-readable generated registry: [UI_REGISTRY.md](./UI_REGISTRY.md) and [FEATURE_REGISTRY.md](./FEATURE_REGISTRY.md).
