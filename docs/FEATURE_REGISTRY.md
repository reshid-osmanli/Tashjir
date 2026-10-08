# Feature Registry and Change Impact Map

Feature definitions live in `src/ui/feature-registry.ts`. This document is generated from that source and checked by `tests/ui-registry.test.ts`; do not hand-edit it. UI definitions and exact element locations are in [UI_REGISTRY.md](./UI_REGISTRY.md).

## At a glance

| Feature ID | Feature | Route/surface | Purpose | Status |
|---|---|---|---|---|
| A001 | Editor | `/editor` | تحرير اختلافات القراءة وأوجهها وعلاقاتها، ثم مراجعة ناتج محرك التشجير وحفظ المستند. | active |
| A002 | Engine Studio | `/studio` | واجهة رسومية لسياسات المحرك والقواعد ومصفوفة الدمج والأولويات والتفسير والاختبار والنشر والاستيراد والتصدير. | active |
| A003 | Quran View | `/quran` | قراءة النص العثماني حسب السورة، مع عرض التشجير المحفوظ أو المشتق وروابط التحرير والتصدير. | active |
| A004 | Tracking | `/tracking` | مقارنة ما وجده المحرك بما أضافه أو صححه المحرر، مع أثر القرار وروابط العودة إلى موضع التحرير. | active |
| A005 | Variant and Rule Index | `/variants` | فهرسة الاختلافات والقواعد العامة مع البحث والتصفية وروابط التحرير. | active |
| A006 | Qiraat Catalog | `/qiraat` | استعراض القراءات العشر واختيار قراءة لعرض بياناتها. | active |
| A007 | Readers Catalog | `/readers` | استعراض وإدارة ملفات القراء وإجازاتهم ضمن تنفيذ التخزين الحالي. | active |
| A008 | Scientific Review | `/review` | قائمة المراجعة العلمية المحلية وما يرتبط بها من تحديث حالة أو ملاحظات. | active |
| A009 | Transmission Administration | `/admin` | إدارة الأئمة والرواة والطرق محليا، مع تبويب قديم يحيل إعدادات المحرك إلى الاستوديو. | active |
| A010 | Settings | `/settings` | عرض وإدارة إعدادات مساحة العمل الحالية. | active |
| A011 | Statistics | `/statistics` | لوحة قراءة إحصائية للتغطية والمواضع والفئات والرواة والمستندات. | active |
| A012 | Public Landing | `/` | صفحة تعريف عامة تعرض قيمة المشروع وروابط الوصول إلى مساحات العمل. | active |
| A013 | Local Sign-in | `/login` | واجهة دخول محلية تحفظ شارة الجلسة في المتصفح ولا ترسل بيانات إلى خادم. | active |
| A014 | Developer UI Inspector | `development-only` | أداة تطوير فقط تعرض معرفات DOM المسجلة وتفاصيل السجل دون تغيير سلوك التطبيق. | active |
| A015 | Dashboard Workspace Shell | `shared-dashboard` | الغلاف المشترك لمسارات مساحة العمل: التنقل المتجاوب، رابط المصحف، شارة الجلسة، وحاوية التأكيد. | active |

## Feature details

## A001 — Editor

- **Route/surface:** `/editor`
- **Status:** `active`
- **Purpose:** تحرير اختلافات القراءة وأوجهها وعلاقاتها، ثم مراجعة ناتج محرك التشجير وحفظ المستند.
- **Important child UI IDs:** `A020`, `A100`, `A111`, `A130`, `A112`, `A101`, `A102`, `A103`, `A104`, `A105`, `A106`, `A135`, `A136`, `A137`, `A107`, `A108`, `A109`, `A110`, `A113`, `A128`, `A123`, `A124`, `A125`, `A126`, `A127`, `A129`, `A139`, `A114`, `A115`, `A116`, `A117`, `A118`, `A121`, `A122`, `A119`, `A333`, `A140`, `A141`, `A144`, `A143`, `A142`, `A145`, `A421`, `A131`, `A132`, `A133`, `A134`
- **Main files:** `src/app/(dashboard)/editor/page.tsx`, `src/components/editor/EditorToolbar.tsx`, `src/components/editor/AyahNavigator.tsx`, `src/components/editor/TashjeerCanvas.tsx`, `src/components/editor/PropertiesPanel.tsx`, `src/components/editor/VariantsPanel.tsx`
- **Main components:** `EditorPage`, `EditorToolbar`, `AyahNavigator`, `TashjeerCanvas`, `PropertiesPanel`, `VariantsPanel`, `SmartCreateWizard`
- **Stores/persistence owners:** `src/stores/editor-store.ts`, `src/lib/editor/selection-store.ts`
- **Engine/data dependencies:** `src/lib/tashjeer/layout-engine.ts`, `src/lib/tashjeer/branch-engine.ts`, `src/lib/tashjeer/smart-create.ts`, `src/lib/tashjeer/clipboard.ts`, `src/lib/tashjeer/bulk-operations.ts`, `src/lib/tashjeer/merge-operations.ts`, `src/lib/tashjeer/manual-links.ts`, `src/lib/tashjeer/selection-commands.ts`
- **Regression tests:** `tests/selection-store.test.ts`, `tests/editor-manual-actions.test.ts`, `tests/editor-bulk-actions.test.ts`, `tests/editor-multi-difference.test.ts`, `tests/package05-multi-difference.test.ts`, `tests/package06-wizard.test.ts`, `tests/package07-acceptance.test.ts`, `tests/e2e/editor-ph3.spec.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A020`, `A100`, `A101`, `A107`, `A111`, `A113`, `A114` | `src/app/(dashboard)/editor/page.tsx`, `src/components/editor/` | Page composition, toolbar, navigator, canvas, properties, and difference panel. |
| Store | `A103`, `A104`, `A129` | `src/stores/editor-store.ts`, `src/lib/editor/selection-store.ts` | Shared document state, undo/redo, selection, clipboard, and panel state. |
| Engine | `A111`, `A123`, `A128` | `src/lib/tashjeer/` | Layout, branch generation, smart-create, ordering, relations, merge, and bulk-operation APIs. UI-only changes must not alter these. |
| Data Model | `A114`, `A121`, `A128` | `src/types/tashjeer.ts`, `src/lib/tashjeer/model/v8.ts` | Document, difference/variant, relation, line/segment, and correction records. |
| Persistence | `A134`, `A143`, `A144` | `src/lib/storage/document-store.ts`, `src/lib/storage/global-rules-store.ts` | Local document and global-rule storage; only change when the request explicitly reaches persistence. |
| Tests | `A020`, `A333`, `A421` | `tests/editor-*.test.ts`, `tests/package0*.test.ts` | Regression coverage for editing, bulk operations, wizard, undo/redo, and identity mapping. |

## A002 — Engine Studio

- **Route/surface:** `/studio`
- **Status:** `active`
- **Purpose:** واجهة رسومية لسياسات المحرك والقواعد ومصفوفة الدمج والأولويات والتفسير والاختبار والنشر والاستيراد والتصدير.
- **Important child UI IDs:** `A021`, `A150`, `A151`, `A152`, `A153`, `A154`, `A155`, `A156`, `A157`, `A158`, `A159`, `A160`, `A161`, `A162`, `A163`, `A164`, `A165`, `A166`, `A167`, `A168`, `A169`, `A170`, `A171`
- **Main files:** `src/app/(dashboard)/studio/page.tsx`, `src/stores/engine-config-ui-store.ts`, `src/lib/tashjeer/engine-config-store.ts`
- **Main components:** `EngineStudioPage`, `Dashboard`, `RuleExplorer`, `RuleBuilder`, `MergeMatrixPanel`, `PriorityPipeline`, `WhyTracePlayground`, `RuleTestsPanel`, `CandidateRulesPanel`, `ProfileComparePanel`, `PublishHistoryPanel`, `ExportImportPanel`, `EngineSettingsPanel`, `RecitationRuleCatalogPanel`
- **Stores/persistence owners:** `src/stores/engine-config-ui-store.ts`, `src/lib/tashjeer/engine-config-store.ts`, `src/lib/tashjeer/engine-config-history.ts`
- **Engine/data dependencies:** `src/lib/tashjeer/decision/resolver.ts`, `src/lib/tashjeer/decision/policy.ts`, `src/lib/tashjeer/decision/rule-test-runner.ts`, `src/lib/tashjeer/decision/profile-compare.ts`, `src/lib/tashjeer/decision/profile-audit.ts`, `src/lib/tashjeer/recitation-rule-catalog.ts`
- **Regression tests:** `tests/engine-studio-package02.test.ts`, `tests/engine-studio-policy.test.ts`, `tests/candidate-rule.test.ts`, `tests/decision-resolver.test.ts`, `tests/rule-test-runner.test.ts`, `tests/profile-compare.test.ts`, `tests/engine-config-history.test.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A021`, `A150`, `A155`, `A158`, `A162`, `A163`, `A168` | `src/app/(dashboard)/studio/page.tsx`, `src/components/studio/` | Section navigation and the selected Engine Studio panel. |
| Store | `A152`, `A154`, `A161` | `src/stores/engine-config-ui-store.ts`, `src/lib/tashjeer/engine-config-store.ts` | Draft, selected rule, dirty state, persistence, and version history. |
| Engine | `A160`, `A162`, `A163`, `A164`, `A165` | `src/lib/tashjeer/decision/` | Resolver, policy, rule tests, and profile comparison; do not modify for presentation-only requests. |
| Data Model | `A158`, `A160`, `A162`, `A163` | `src/lib/tashjeer/model/v8.ts` | EngineConfig, EngineRule, merge entries, relations, and profile data. |
| Persistence | `A154`, `A168`, `A169` | `src/lib/tashjeer/engine-config-store.ts`, `src/lib/tashjeer/engine-config-history.ts` | Explicit save/import/reset/rollback flows. |
| Tests | `A021`, `A160`, `A168`, `A169` | `tests/engine-studio-*.test.ts`, `tests/decision-*.test.ts` | Policy decisions, deterministic serialization, rule tests, and profile history. |

## A003 — Quran View

- **Route/surface:** `/quran`
- **Status:** `active`
- **Purpose:** قراءة النص العثماني حسب السورة، مع عرض التشجير المحفوظ أو المشتق وروابط التحرير والتصدير.
- **Important child UI IDs:** `A022`, `A180`, `A181`, `A182`, `A183`, `A184`, `A185`, `A186`, `A187`, `A188`, `A189`
- **Main files:** `src/app/(dashboard)/quran/page.tsx`, `src/components/quran/AyahTashjeerView.tsx`, `src/lib/tashjeer/ayah-tashjeer-source.ts`
- **Main components:** `QuranPage`, `AyahTashjeerView`, `TashjeerFigure`
- **Stores/persistence owners:** `src/lib/storage/document-store.ts`, `src/lib/storage/global-rules-store.ts`, `src/lib/storage/rule-occurrences-store.ts`
- **Engine/data dependencies:** `src/hooks/useAyahTashjeer.ts`, `src/lib/tashjeer/ayah-tashjeer-source.ts`, `src/lib/tashjeer/branch-engine.ts`, `src/lib/tashjeer/classic-tashjeer.ts`
- **Regression tests:** `tests/quran-data.test.ts`, `tests/ayah-tashjeer-source.test.ts`, `tests/figure-render.test.ts`, `tests/global-rule-engine.test.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A022`, `A180`, `A184`, `A187` | `src/app/(dashboard)/quran/page.tsx`, `src/components/quran/AyahTashjeerView.tsx` | Surah search/list, ayah text, and per-ayah tashjeer card. |
| Store | `A183`, `A188` | `src/lib/storage/document-store.ts`, `src/lib/storage/global-rules-store.ts`, `src/lib/storage/rule-occurrences-store.ts` | Saved document and derived global-rule visibility. |
| Engine | `A187` | `src/hooks/useAyahTashjeer.ts`, `src/lib/tashjeer/ayah-tashjeer-source.ts` | Resolve the saved/derived document and render the same figure as the editor. |
| Data Model | `A184`, `A187` | `src/types/tashjeer.ts`, `src/data/quran/index.ts` | Quran ayah keys and persisted tashjeer documents. |
| Tests | `A022`, `A187` | `tests/quran-data.test.ts`, `tests/ayah-tashjeer-source.test.ts`, `tests/figure-render.test.ts` | Data source and renderer parity. |

## A004 — Tracking

- **Route/surface:** `/tracking`
- **Status:** `active`
- **Purpose:** مقارنة ما وجده المحرك بما أضافه أو صححه المحرر، مع أثر القرار وروابط العودة إلى موضع التحرير.
- **Important child UI IDs:** `A023`, `A200`, `A201`, `A202`, `A203`, `A204`, `A205`, `A206`, `A207`, `A208`
- **Main files:** `src/app/(dashboard)/tracking/page.tsx`, `src/lib/storage/tracking-store.ts`
- **Main components:** `TrackingPage`, `TrackingRowCard`, `CorrectionTripletView`, `RowDecisionTrace`
- **Stores/persistence owners:** `src/lib/storage/tracking-store.ts`, `src/lib/storage/document-store.ts`, `src/lib/storage/rule-occurrences-store.ts`
- **Engine/data dependencies:** `src/lib/tashjeer/decision/api.ts`, `src/lib/tashjeer/decision/editor-bridge.ts`, `src/lib/tashjeer/decision/resolver.ts`
- **Regression tests:** `tests/rule-occurrences-store.test.ts`, `tests/decision-resolver.test.ts`, `tests/decision-editor-bridge.test.ts`, `tests/profile-audit.test.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A023`, `A200`, `A201`, `A203`, `A204` | `src/app/(dashboard)/tracking/page.tsx` | Category/source filters, summary, row cards, and expanded traces. |
| Store | `A203`, `A204` | `src/lib/storage/tracking-store.ts`, `src/lib/storage/rule-occurrences-store.ts` | Read-only aggregation of editor records and occurrence overrides. |
| Engine | `A206`, `A207` | `src/lib/tashjeer/decision/api.ts`, `src/lib/tashjeer/decision/resolver.ts` | Recomputes decision traces using the same resolver as Studio. |
| Data Model | `A204` | `src/types/tashjeer.ts`, `src/lib/tashjeer/model/v8.ts` | Correction triplets and edit-log events. |
| Tests | `A023`, `A206` | `tests/rule-occurrences-store.test.ts`, `tests/decision-editor-bridge.test.ts` | Tracking derivation and editor/engine classification. |

## A005 — Variant and Rule Index

- **Route/surface:** `/variants`
- **Status:** `active`
- **Purpose:** فهرسة الاختلافات والقواعد العامة مع البحث والتصفية وروابط التحرير.
- **Important child UI IDs:** `A024`, `A220`, `A221`, `A222`, `A223`
- **Main files:** `src/app/(dashboard)/variants/page.tsx`, `src/lib/storage/document-store.ts`, `src/lib/storage/global-rules-store.ts`
- **Main components:** `VariantsIndexPage`, `RuleOccurrenceReview`, `GlobalRuleMetaEditor`, `StrengthDegreePicker`
- **Stores/persistence owners:** `src/lib/storage/document-store.ts`, `src/lib/storage/global-rules-store.ts`, `src/lib/storage/rule-occurrences-store.ts`
- **Engine/data dependencies:** `src/lib/quran-logic/global-rule-engine.ts`, `src/lib/tashjeer/scope.ts`, `src/lib/tashjeer/strength-degrees.ts`
- **Regression tests:** `tests/global-rule-engine.test.ts`, `tests/rule-occurrences-store.test.ts`, `tests/strength-degrees.test.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A024`, `A220`, `A221`, `A222`, `A223` | `src/app/(dashboard)/variants/page.tsx` | Index filters, result list, and general-rule editor. |
| Store | `A223` | `src/lib/storage/document-store.ts`, `src/lib/storage/global-rules-store.ts` | Reads local documents and persists general rules. |
| Engine | `A222`, `A223` | `src/lib/quran-logic/global-rule-engine.ts` | Pattern matching and occurrence derivation. |
| Tests | `A024`, `A223` | `tests/global-rule-engine.test.ts`, `tests/rule-occurrences-store.test.ts` | Matching and local override behavior. |

## A006 — Qiraat Catalog

- **Route/surface:** `/qiraat`
- **Status:** `active`
- **Purpose:** استعراض القراءات العشر واختيار قراءة لعرض بياناتها.
- **Important child UI IDs:** `A025`, `A230`, `A231`, `A232`
- **Main files:** `src/app/(dashboard)/qiraat/page.tsx`, `src/data/qiraat-data/qiraat.ts`
- **Main components:** `QiraatPage`, `QiraatTree`
- **Stores/persistence owners:** —
- **Engine/data dependencies:** `src/data/qiraat-data/qiraat.ts`, `src/data/qiraat-data/narrator-profiles.ts`
- **Regression tests:** `tests/catalog-order.test.ts`, `tests/reader-symbols.test.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A025`, `A230`, `A231` | `src/app/(dashboard)/qiraat/page.tsx`, `src/components/visualization/QiraatTree.tsx` | Search/selection and selected-reading detail. |
| Data Model | `A231` | `src/data/qiraat-data/` | Read-only canonical qiraat data. |
| Tests | `A025`, `A231` | `tests/catalog-order.test.ts`, `tests/reader-symbols.test.ts` | Ordering and symbols. |

## A007 — Readers Catalog

- **Route/surface:** `/readers`
- **Status:** `active`
- **Purpose:** استعراض وإدارة ملفات القراء وإجازاتهم ضمن تنفيذ التخزين الحالي.
- **Important child UI IDs:** `A026`, `A240`, `A242`, `A243`, `A241`
- **Main files:** `src/app/(dashboard)/readers/page.tsx`, `src/types/index.ts`
- **Main components:** `ReadersPage`
- **Stores/persistence owners:** —
- **Engine/data dependencies:** `src/data/qiraat-data/qiraat.ts`
- **Regression tests:** `tests/catalog-order.test.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A026`, `A240`, `A241`, `A242` | `src/app/(dashboard)/readers/page.tsx` | Reader form, selectors, and catalog list. |
| Data Model | `A241`, `A242` | `src/types/index.ts` | Reader profile and transmission types. |
| Tests | `A026`, `A242` | `tests/catalog-order.test.ts` | Catalog ordering used by the current implementation. |

## A008 — Scientific Review

- **Route/surface:** `/review`
- **Status:** `active`
- **Purpose:** قائمة المراجعة العلمية المحلية وما يرتبط بها من تحديث حالة أو ملاحظات.
- **Important child UI IDs:** `A027`, `A250`, `A251`, `A252`, `A253`, `A254`
- **Main files:** `src/app/(dashboard)/review/page.tsx`
- **Main components:** `ReviewPage`
- **Stores/persistence owners:** `src/lib/storage/document-store.ts`
- **Engine/data dependencies:** —
- **Regression tests:** `tests/document-store.test.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A027`, `A250`, `A251`, `A252` | `src/app/(dashboard)/review/page.tsx` | Review filters and review-item actions. |
| Store | `A252` | `src/lib/storage/document-store.ts` | Current review content is derived from local documents. |
| Tests | `A027`, `A252` | `tests/document-store.test.ts` | Persistence-facing behavior. |

## A009 — Transmission Administration

- **Route/surface:** `/admin`
- **Status:** `active`
- **Purpose:** إدارة الأئمة والرواة والطرق محليا، مع تبويب قديم يحيل إعدادات المحرك إلى الاستوديو.
- **Important child UI IDs:** `A028`, `A260`, `A261`, `A263`, `A262`
- **Main files:** `src/app/(dashboard)/admin/page.tsx`, `src/lib/transmissions/catalog.ts`
- **Main components:** `AdminPage`, `TransmissionManager`, `TransmissionEditor`
- **Stores/persistence owners:** `src/lib/transmissions/catalog.ts`
- **Engine/data dependencies:** `src/lib/tashjeer/engine-settings.ts`
- **Regression tests:** `tests/catalog-order.test.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A028`, `A260`, `A261`, `A262` | `src/app/(dashboard)/admin/page.tsx` | Administration tabs, catalog hierarchy, forms, and reorder interactions. |
| Store | `A261`, `A262` | `src/lib/transmissions/catalog.ts` | Local transmission catalog is the active persistence path. |
| Engine | `A260` | `src/lib/tashjeer/engine-settings.ts` | The legacy engine tab links to Studio; it is not a second settings source. |
| Tests | `A028`, `A261` | `tests/catalog-order.test.ts` | Catalog ordering and peer movement. |

## A010 — Settings

- **Route/surface:** `/settings`
- **Status:** `active`
- **Purpose:** عرض وإدارة إعدادات مساحة العمل الحالية.
- **Important child UI IDs:** `A029`, `A270`, `A271`, `A272`
- **Main files:** `src/app/(dashboard)/settings/page.tsx`
- **Main components:** `SettingsPage`, `StrengthDegreesManager`
- **Stores/persistence owners:** `src/lib/tashjeer/strength-degrees.ts`
- **Engine/data dependencies:** `src/data/quran/index.ts`
- **Regression tests:** `tests/strength-degrees.test.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A029`, `A270`, `A271` | `src/app/(dashboard)/settings/page.tsx`, `src/components/settings/StrengthDegreesManager.tsx` | Settings form and configurable strength-degree manager. |
| Store | `A271` | `src/lib/tashjeer/strength-degrees.ts` | Strength-degree catalog persistence. |
| Tests | `A029`, `A271` | `tests/strength-degrees.test.ts` | Degree catalog constraints. |

## A011 — Statistics

- **Route/surface:** `/statistics`
- **Status:** `active`
- **Purpose:** لوحة قراءة إحصائية للتغطية والمواضع والفئات والرواة والمستندات.
- **Important child UI IDs:** `A030`, `A280`
- **Main files:** `src/app/(dashboard)/statistics/page.tsx`
- **Main components:** `StatisticsPage`
- **Stores/persistence owners:** `src/lib/storage/document-store.ts`
- **Engine/data dependencies:** `src/data/quran/index.ts`
- **Regression tests:** `tests/quran-data.test.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A030`, `A280` | `src/app/(dashboard)/statistics/page.tsx` | Read-only statistical sections and deep links to review. |
| Store | `A280` | `src/lib/storage/document-store.ts` | Counts local saved documents. |
| Data Model | `A280` | `src/data/quran/index.ts` | Quran totals used for coverage. |
| Tests | `A030`, `A280` | `tests/quran-data.test.ts` | Quran data totals. |

## A012 — Public Landing

- **Route/surface:** `/`
- **Status:** `active`
- **Purpose:** صفحة تعريف عامة تعرض قيمة المشروع وروابط الوصول إلى مساحات العمل.
- **Important child UI IDs:** `A031`, `A290`, `A291`
- **Main files:** `src/app/page.tsx`, `src/components/marketing/PublicHeader.tsx`, `src/components/marketing/PublicFooter.tsx`
- **Main components:** `HomePage`, `PublicHeader`, `PublicFooter`, `LandingStory`, `LandingProof`
- **Stores/persistence owners:** —
- **Engine/data dependencies:** `src/lib/tashjeer/showcase.ts`
- **Regression tests:** `tests/landing-showcase.test.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A031`, `A290`, `A291` | `src/app/page.tsx`, `src/components/marketing/` | Server-rendered marketing surface and its public navigation. |
| Engine | `A290` | `src/lib/tashjeer/showcase.ts` | Produces the sample visualization displayed on the page. |
| Tests | `A031`, `A290` | `tests/landing-showcase.test.ts` | Showcase model remains backed by real project data. |

## A013 — Local Sign-in

- **Route/surface:** `/login`
- **Status:** `active`
- **Purpose:** واجهة دخول محلية تحفظ شارة الجلسة في المتصفح ولا ترسل بيانات إلى خادم.
- **Important child UI IDs:** `A032`, `A340`, `A341`, `A342`, `A343`, `A344`
- **Main files:** `src/app/login/page.tsx`, `src/components/layout/SessionBadge.tsx`
- **Main components:** `LoginPage`, `SessionBadge`
- **Stores/persistence owners:** —
- **Engine/data dependencies:** —
- **Regression tests:** —

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A032`, `A340`, `A341`, `A342` | `src/app/login/page.tsx` | Local-only sign-in form and navigation. |
| Persistence | `A344` | `src/app/login/page.tsx` | The submit action writes the local tashjeer-session value only. |

## A014 — Developer UI Inspector

- **Route/surface:** `development-only`
- **Status:** `active`
- **Purpose:** أداة تطوير فقط تعرض معرفات DOM المسجلة وتفاصيل السجل دون تغيير سلوك التطبيق.
- **Important child UI IDs:** `A410`, `A411`, `A412`
- **Main files:** `src/components/dev/UIRegistryInspector.tsx`, `src/ui/ui-registry.ts`
- **Main components:** `UIRegistryInspector`
- **Stores/persistence owners:** —
- **Engine/data dependencies:** —
- **Regression tests:** `tests/ui-registry.test.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A410`, `A411`, `A412` | `src/components/dev/UIRegistryInspector.tsx` | Development-only overlay; returns no UI in production. |
| Tests | `A410`, `A411`, `A412` | `tests/ui-registry.test.ts` | Registry metadata and DOM markers are validated together. |

## A015 — Dashboard Workspace Shell

- **Route/surface:** `shared-dashboard`
- **Status:** `active`
- **Purpose:** الغلاف المشترك لمسارات مساحة العمل: التنقل المتجاوب، رابط المصحف، شارة الجلسة، وحاوية التأكيد.
- **Important child UI IDs:** `A310`, `A311`, `A312`, `A314`, `A315`, `A316`, `A317`, `A318`, `A319`, `A320`, `A321`, `A322`, `A323`, `A324`, `A313`, `A325`, `A326`, `A327`, `A328`
- **Main files:** `src/app/(dashboard)/layout.tsx`, `src/components/layout/SessionBadge.tsx`, `src/components/ui/ConfirmDialogHost.tsx`
- **Main components:** `DashboardLayout`, `SessionBadge`, `ConfirmDialogHost`
- **Stores/persistence owners:** `src/lib/ui/confirm-store.ts`
- **Engine/data dependencies:** —
- **Regression tests:** `tests/confirm-store.test.ts`

### Change impact map

| Layer | UI IDs | Files / systems | Notes |
|---|---|---|---|
| UI | `A310`, `A311`, `A312`, `A313`, `A314`, `A315`, `A316`, `A317`, `A318`, `A319`, `A320`, `A321`, `A322`, `A323`, `A324`, `A325`, `A326`, `A327` | `src/app/(dashboard)/layout.tsx`, `src/components/layout/SessionBadge.tsx` | Shared navigation elements render on multiple dashboard routes and responsive breakpoints. |
| Store | `A327` | `src/lib/ui/confirm-store.ts` | Shared confirmation dialog host; consumers own the business operation. |
| Tests | `A327` | `tests/confirm-store.test.ts` | Confirmation queuing and result behavior. |

## Reading the impact map

The dependency path is **UI ID → owning store/persistence → engine/data model → regression tests**. A UI-only request must remain at its exact UI ID unless the feature behavior proves another layer is necessary; if it does, explain the dependency and keep the change minimal. File/function names are ordinary code references, never UI IDs.
