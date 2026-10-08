# Project Feature & UI Identity Registry

هذا هو المرجع الرسمي لهويات الميزات والعناصر المهمة في Tashjir. تعريف كل ID ومعلوماته في `src/ui/feature-registry.ts` أو `src/ui/ui-registry.ts`؛ ملف التوثيق هذا مولّد من المصدرين بواسطة `npm run registry:docs`. الاختبارات تقارن التوثيق بالمصدر وتفشل عند الانحراف.

## قواعد الهوية

- الصيغة الدائمة: `A001`، `A002`، ... ويقبل المدقق لاحقا أرقاما أطول من ثلاثة خانات. المعرفات يدوية وثابتة؛ لا تعتمد على ترتيب العرض أو ترتيب React أو النص العربي.
- كل ID عالمي بين سجل الميزات وسجل الواجهة. لا يُعاد استخدام ID محذوف: انقل سجله إلى حالة `retired` وأضفه إلى `RETIRED_UI_IDS`، ولا تحذف أثره التاريخي.
- `data-ui-id` يربط identity الفعلية بعنصر DOM. عناصر الصفوف/الأزرار المتكررة قد تشترك في هوية الدور/القالب؛ استخدم `data-ui-instance` بقيمة مفتاح المجال عند الحاجة لتحديد نسخة بعينها.
- Feature IDs تصف نطاق النظام. Route/UI IDs تصف سطح الصفحة أو التحكم المهم. لا تحول أسماء المتغيرات أو الدوال الداخلية إلى A IDs؛ تظهر تلك في `codeReferences` فقط.
- `status` هو `active`, `deprecated` أو `retired`. العنصر retired لا يبقى على DOM ولا يمكن إعادة استعمال معرفه.
- السجل نطاقه عناصر/نقاط تحكم ذات معنى، لا كل `div` أو عنصر HTML زخرفي. أي عنصر مهم جديد يحتاج ID وسجلا وعلامة DOM واختبارا.

## شجرة المشروع

- **A001** — Editor (feature, active) — `/editor`
  - **A020** — Editor Route (route, active) — `/editor`
    - **A100** — Editor Canvas Workspace (shell, active)
      - **A111** — Tashjeer Canvas (panel, active)
        - **A130** — Selection Context Menu (menu, active)
      - **A112** — Selection Breadcrumb (panel, active)
    - **A101** — Editor Toolbar (toolbar, active)
      - **A102** — Editor Tool Palette (control, active)
      - **A103** — Undo Action Button (button, active)
      - **A104** — Redo Action Button (button, active)
      - **A105** — Editor Operation History Menu (menu, active)
      - **A106** — Unified Clipboard Menu (menu, active)
      - **A135** — Export Editor Document Button (button, active)
      - **A136** — Save Editor Document Button (button, active)
      - **A137** — Canvas Zoom Preset Selector (select, active)
    - **A107** — Ayah Navigator (panel, active)
      - **A108** — Surah Selector (select, active)
      - **A109** — Ayah Selector (select, active)
      - **A110** — Quran Text Search Input (input, active)
    - **A113** — Editor Properties Panel (panel, active)
      - **A128** — Relations Panel (panel, active)
        - **A123** — Line Order Editor (list, active)
          - **A124** — Line Reorder Row (list-item, active)
            - **A125** — Line Merge Handle (drag-handle, active)
            - **A126** — Line Rank Input (input, active)
            - **A127** — Line Move Controls (control, active)
      - **A129** — Selected Element Details Panel (panel, active)
      - **A139** — Recitation and Layout Controls (panel, active)
    - **A114** — Differences and Variants Panel (panel, active)
      - **A115** — Open Rules Index Button (button, active)
      - **A116** — Open Smart Create Button (button, active)
      - **A117** — Differences Search Input (input, active)
      - **A118** — Differences List (list, active)
        - **A121** — Variant Faces List (list, active)
          - **A122** — Bulk Face Selection Checkbox (checkbox, active)
      - **A119** — Difference Multi-selection Actions (toolbar, active)
        - **A333** — Delete Selected Differences Button (button, active)
      - **A140** — Rules and Differences Index Dialog (dialog, active)
        - **A141** — Rule Occurrence Review Dialog (dialog, active)
          - **A144** — Local Override Editor (dialog, active)
        - **A143** — Global Rule Metadata Editor (dialog, active)
      - **A142** — Global Rule Builder Dialog (dialog, active)
      - **A145** — Quick Create Template Controls (control, active)
      - **A421** — Smart Create Wizard Dialog (dialog, active)
    - **A131** — Keyboard Shortcuts Dialog (dialog, active)
    - **A132** — Focus Mode Toggle (button, active)
    - **A133** — Editor Status Bar (section, active)
    - **A134** — Document Import File Input (input, active)
- **A002** — Engine Studio (feature, active) — `/studio`
  - **A021** — Engine Studio Route (route, active) — `/studio`
    - **A150** — Engine Studio Workspace (shell, active)
      - **A151** — Engine Studio Header (section, active)
        - **A152** — Reset Engine Configuration Button (button, active)
        - **A153** — Review Before Publish Button (button, active)
        - **A154** — Save Engine Configuration Button (button, active)
      - **A155** — Engine Studio Sections Navigation (navigation, active)
      - **A156** — Engine Studio Dashboard (panel, active)
      - **A157** — Recitation Rule Catalog Panel (panel, active)
      - **A158** — Engine Rule Explorer (panel, active)
        - **A159** — Engine Rule Search Input (input, active)
        - **A160** — Create Engine Rule Button (button, active)
      - **A161** — Engine Rule Builder Form (form, active)
      - **A162** — Selected Engine Rule Actions (panel, active)
      - **A163** — Merge Matrix Panel (panel, active)
      - **A164** — Priority Pipeline Panel (panel, active)
      - **A165** — Why and Decision Trace Playground (panel, active)
      - **A166** — Engine Rule Tests Panel (panel, active)
      - **A167** — Candidate Rules Panel (panel, active)
      - **A168** — Engine Profile Compare Panel (panel, active)
      - **A169** — Publish Gate and Engine History Panel (panel, active)
      - **A170** — Engine Export Import Panel (panel, active)
      - **A171** — Engine Behavior Settings Panel (panel, active)
- **A003** — Quran View (feature, active) — `/quran`
  - **A022** — Quran Route (route, active) — `/quran`
    - **A180** — Surah Search Input (input, active)
    - **A181** — Surah Navigation List (list, active)
    - **A182** — Current Surah Reader (section, active)
      - **A183** — Toggle Saved Tashjeer Visibility (button, active)
      - **A184** — Quran Ayah Row (list-item, active)
        - **A185** — Open Quran Ayah in Editor Link (navigation, active)
        - **A186** — Export Quran Ayah JSON Button (button, active)
        - **A187** — Saved Ayah Tashjeer Card (card, active)
          - **A188** — Toggle Ayah Tashjeer Card Button (button, active)
          - **A189** — Open Tashjeer Card in Editor Link (navigation, active)
- **A004** — Tracking (feature, active) — `/tracking`
  - **A023** — Tracking Route (route, active) — `/tracking`
    - **A200** — Tracking Category Filters (filter, active)
    - **A201** — Tracking Source Filters (filter, active)
    - **A202** — Tracking Summary Cards (panel, active)
    - **A203** — Tracking Results List (list, active)
      - **A204** — Tracking Result Card (list-item, active)
        - **A205** — Toggle Tracking Difference Details (button, active)
        - **A206** — Toggle Decision Trace Details (button, active)
        - **A207** — Propose Rule from Correction Link (navigation, active)
        - **A208** — Open Tracking Row in Editor Link (navigation, active)
- **A005** — Variant and Rule Index (feature, active) — `/variants`
  - **A024** — Variant Index Route (route, active) — `/variants`
    - **A220** — Variant Index Workspace (panel, active)
      - **A221** — Variant Index Search and Filters (filter, active)
      - **A222** — Cross-document Variant Results (list, active)
    - **A223** — General Rule Editor Dialog (dialog, active)
- **A006** — Qiraat Catalog (feature, active) — `/qiraat`
  - **A025** — Qiraat Catalog Route (route, active) — `/qiraat`
    - **A230** — Qiraat Search Input (input, active)
    - **A231** — Qiraat Selection List (list, active)
    - **A232** — Selected Qiraat Details (panel, active)
- **A007** — Readers Catalog (feature, active) — `/readers`
  - **A026** — Readers Route (route, active) — `/readers`
    - **A240** — Reader Profile Form (form, active)
      - **A242** — Reader Transmission Selector (select, active)
      - **A243** — Submit Reader Profile Form (button, active)
    - **A241** — Readers Catalog List (list, active)
- **A008** — Scientific Review (feature, active) — `/review`
  - **A027** — Review Route (route, active) — `/review`
    - **A250** — Scientific Review Workspace (shell, active)
      - **A251** — Review Queue Filters (filter, active)
      - **A252** — Scientific Review Queue (list, active)
        - **A253** — Review Notes Input (input, active)
        - **A254** — Review Status Action (action, active)
- **A009** — Transmission Administration (feature, active) — `/admin`
  - **A028** — Administration Route (route, active) — `/admin`
    - **A260** — Administration Tabs (navigation, active)
    - **A261** — Transmission Catalog and Reorder List (list, active)
      - **A263** — Transmission Reorder Control (drag-handle, active)
    - **A262** — Transmission Catalog Editor Form (form, active)
- **A010** — Settings (feature, active) — `/settings`
  - **A029** — Settings Route (route, active) — `/settings`
    - **A270** — Settings Workspace (panel, active)
      - **A271** — Strength Degrees Manager (panel, active)
      - **A272** — Reset Settings Action (action, active)
- **A011** — Statistics (feature, active) — `/statistics`
  - **A030** — Statistics Route (route, active) — `/statistics`
    - **A280** — Statistics Dashboard (panel, active)
- **A012** — Public Landing (feature, active) — `/`
  - **A031** — Public Home Route (route, active) — `/`
    - **A290** — Public Landing Content (section, active)
    - **A291** — Public Site Navigation (navigation, active)
- **A013** — Local Sign-in (feature, active) — `/login`
  - **A032** — Local Sign-in Route (route, active) — `/login`
    - **A340** — Local Sign-in Surface (shell, active)
      - **A341** — Local Sign-in Form (form, active)
        - **A342** — Sign-in Email Input (input, active)
        - **A343** — Sign-in Password Input (input, active)
        - **A344** — Local Sign-in Submit Button (button, active)
- **A014** — Developer UI Inspector (feature, active) — `development-only`
  - **A410** — Developer Registry Inspector Toggle (inspector, active)
  - **A411** — Developer UI ID Overlay (inspector, active)
  - **A412** — Developer Registry Details Card (inspector, active)
- **A015** — Dashboard Workspace Shell (feature, active) — `shared-dashboard`
  - **A310** — Dashboard Layout Shell (shell, active)
    - **A311** — Desktop Sidebar Navigation (navigation, active)
      - **A312** — Dashboard Home Link (navigation, active)
      - **A314** — Editor Navigation Link (navigation, active)
      - **A315** — Studio Navigation Link (navigation, active)
      - **A316** — Variant Index Navigation Link (navigation, active)
      - **A317** — Tracking Navigation Link (navigation, active)
      - **A318** — Quran Navigation Link (navigation, active)
      - **A319** — Qiraat Navigation Link (navigation, active)
      - **A320** — Readers Navigation Link (navigation, active)
      - **A321** — Review Navigation Link (navigation, active)
      - **A322** — Statistics Navigation Link (navigation, active)
      - **A323** — Administration Navigation Link (navigation, active)
      - **A324** — Settings Navigation Link (navigation, active)
    - **A313** — Mobile Workspace Navigation (navigation, active)
    - **A325** — Quran Quick Link in Workspace Header (navigation, active)
    - **A326** — Local Session Badge (control, active)
    - **A327** — Shared Confirmation Dialog Host (dialog, active)
    - **A328** — Workspace Brand Home Link (navigation, active)

## فهرس UI المختصر

| ID | Type | Name | Parent | Route | Component | File | Status |
|---|---|---|---|---|---|---|---|
| A020 | route | Editor Route | A001 | `/editor` | `EditorPage` | `src/app/(dashboard)/editor/page.tsx` | active |
| A021 | route | Engine Studio Route | A002 | `/studio` | `EngineStudioPage` | `src/app/(dashboard)/studio/page.tsx` | active |
| A022 | route | Quran Route | A003 | `/quran` | `QuranPage` | `src/app/(dashboard)/quran/page.tsx` | active |
| A023 | route | Tracking Route | A004 | `/tracking` | `TrackingPage` | `src/app/(dashboard)/tracking/page.tsx` | active |
| A024 | route | Variant Index Route | A005 | `/variants` | `VariantsIndexPage` | `src/app/(dashboard)/variants/page.tsx` | active |
| A025 | route | Qiraat Catalog Route | A006 | `/qiraat` | `QiraatPage` | `src/app/(dashboard)/qiraat/page.tsx` | active |
| A026 | route | Readers Route | A007 | `/readers` | `ReadersPage` | `src/app/(dashboard)/readers/page.tsx` | active |
| A027 | route | Review Route | A008 | `/review` | `ReviewPage` | `src/app/(dashboard)/review/page.tsx` | active |
| A028 | route | Administration Route | A009 | `/admin` | `AdminPage` | `src/app/(dashboard)/admin/page.tsx` | active |
| A029 | route | Settings Route | A010 | `/settings` | `SettingsPage` | `src/app/(dashboard)/settings/page.tsx` | active |
| A030 | route | Statistics Route | A011 | `/statistics` | `StatisticsPage` | `src/app/(dashboard)/statistics/page.tsx` | active |
| A031 | route | Public Home Route | A012 | `/` | `HomePage` | `src/app/page.tsx` | active |
| A032 | route | Local Sign-in Route | A013 | `/login` | `LoginPage` | `src/app/login/page.tsx` | active |
| A100 | shell | Editor Canvas Workspace | A020 | `/editor` | `EditorPage` | `src/app/(dashboard)/editor/page.tsx` | active |
| A101 | toolbar | Editor Toolbar | A020 | `/editor` | `EditorToolbar` | `src/components/editor/EditorToolbar.tsx` | active |
| A102 | control | Editor Tool Palette | A101 | `/editor` | `EditorToolbar` | `src/components/editor/EditorToolbar.tsx` | active |
| A103 | button | Undo Action Button | A101 | `/editor` | `EditorToolbar` | `src/components/editor/EditorToolbar.tsx` | active |
| A104 | button | Redo Action Button | A101 | `/editor` | `EditorToolbar` | `src/components/editor/EditorToolbar.tsx` | active |
| A105 | menu | Editor Operation History Menu | A101 | `/editor` | `HistoryControls` | `src/components/editor/HistoryControls.tsx` | active |
| A106 | menu | Unified Clipboard Menu | A101 | `/editor` | `ClipboardControls` | `src/components/editor/ClipboardControls.tsx` | active |
| A107 | panel | Ayah Navigator | A020 | `/editor` | `AyahNavigator` | `src/components/editor/AyahNavigator.tsx` | active |
| A108 | select | Surah Selector | A107 | `/editor` | `AyahNavigator` | `src/components/editor/AyahNavigator.tsx` | active |
| A109 | select | Ayah Selector | A107 | `/editor` | `AyahNavigator` | `src/components/editor/AyahNavigator.tsx` | active |
| A110 | input | Quran Text Search Input | A107 | `/editor` | `AyahNavigator` | `src/components/editor/AyahNavigator.tsx` | active |
| A111 | panel | Tashjeer Canvas | A100 | `/editor` | `TashjeerCanvas` | `src/components/editor/TashjeerCanvas.tsx` | active |
| A112 | panel | Selection Breadcrumb | A100 | `/editor` | `SelectionBreadcrumb` | `src/components/editor/SelectionBreadcrumb.tsx` | active |
| A113 | panel | Editor Properties Panel | A020 | `/editor` | `PropertiesPanel` | `src/components/editor/PropertiesPanel.tsx` | active |
| A114 | panel | Differences and Variants Panel | A020 | `/editor` | `VariantsPanel` | `src/components/editor/VariantsPanel.tsx` | active |
| A115 | button | Open Rules Index Button | A114 | `/editor` | `VariantsPanel` | `src/components/editor/VariantsPanel.tsx` | active |
| A116 | button | Open Smart Create Button | A114 | `/editor` | `VariantsPanel` | `src/components/editor/VariantsPanel.tsx` | active |
| A117 | input | Differences Search Input | A114 | `/editor` | `VariantsPanel` | `src/components/editor/VariantsPanel.tsx` | active |
| A118 | list | Differences List | A114 | `/editor` | `VariantsPanel` | `src/components/editor/VariantsPanel.tsx` | active |
| A119 | toolbar | Difference Multi-selection Actions | A114 | `/editor` | `VariantsPanel` | `src/components/editor/VariantsPanel.tsx` | active |
| A333 | button | Delete Selected Differences Button | A119 | `/editor` | `VariantsPanel` | `src/components/editor/VariantsPanel.tsx` | active |
| A121 | list | Variant Faces List | A118 | `/editor` | `VariantsPanel` | `src/components/editor/VariantsPanel.tsx` | active |
| A122 | checkbox | Bulk Face Selection Checkbox | A121 | `/editor` | `VariantsPanel` | `src/components/editor/VariantsPanel.tsx` | active |
| A123 | list | Line Order Editor | A128 | `/editor` | `LineOrderEditor` | `src/components/editor/LineOrderEditor.tsx` | active |
| A124 | list-item | Line Reorder Row | A123 | `/editor` | `LineOrderEditor` | `src/components/editor/LineOrderEditor.tsx` | active |
| A125 | drag-handle | Line Merge Handle | A124 | `/editor` | `LineOrderEditor` | `src/components/editor/LineOrderEditor.tsx` | active |
| A126 | input | Line Rank Input | A124 | `/editor` | `LineOrderEditor` | `src/components/editor/LineOrderEditor.tsx` | active |
| A127 | control | Line Move Controls | A124 | `/editor` | `LineOrderEditor` | `src/components/editor/LineOrderEditor.tsx` | active |
| A128 | panel | Relations Panel | A113 | `/editor` | `RelationsPanel` | `src/components/editor/RelationsPanel.tsx` | active |
| A129 | panel | Selected Element Details Panel | A113 | `/editor` | `SelectionDetailsPanel` | `src/components/editor/SelectionDetailsPanel.tsx` | active |
| A130 | menu | Selection Context Menu | A111 | `/editor` | `SelectionContextMenu` | `src/components/editor/SelectionContextMenu.tsx` | active |
| A131 | dialog | Keyboard Shortcuts Dialog | A020 | `/editor` | `ShortcutsDialog` | `src/components/editor/ShortcutsDialog.tsx` | active |
| A132 | button | Focus Mode Toggle | A020 | `/editor` | `EditorPage` | `src/app/(dashboard)/editor/page.tsx` | active |
| A133 | section | Editor Status Bar | A020 | `/editor` | `StatusBar` | `src/app/(dashboard)/editor/page.tsx` | active |
| A134 | input | Document Import File Input | A020 | `/editor` | `EditorPage` | `src/app/(dashboard)/editor/page.tsx` | active |
| A135 | button | Export Editor Document Button | A101 | `/editor` | `EditorToolbar` | `src/components/editor/EditorToolbar.tsx` | active |
| A136 | button | Save Editor Document Button | A101 | `/editor` | `EditorToolbar` | `src/components/editor/EditorToolbar.tsx` | active |
| A137 | select | Canvas Zoom Preset Selector | A101 | `/editor` | `EditorToolbar` | `src/components/editor/EditorToolbar.tsx` | active |
| A139 | panel | Recitation and Layout Controls | A113 | `/editor` | `RecitationControls` | `src/components/editor/RecitationControls.tsx` | active |
| A140 | dialog | Rules and Differences Index Dialog | A114 | `/editor` | `RulesIndexDialog` | `src/components/editor/RulesIndexDialog.tsx` | active |
| A141 | dialog | Rule Occurrence Review Dialog | A140 | `/editor` | `RuleOccurrenceReview` | `src/components/editor/RuleOccurrenceReview.tsx` | active |
| A142 | dialog | Global Rule Builder Dialog | A114 | `/editor` | `GlobalRuleBuilder` | `src/components/editor/GlobalRuleBuilder.tsx` | active |
| A143 | dialog | Global Rule Metadata Editor | A140 | `/editor` | `GlobalRuleMetaEditor` | `src/components/editor/GlobalRuleMetaEditor.tsx` | active |
| A144 | dialog | Local Override Editor | A141 | `/editor` | `LocalOverrideEditor` | `src/components/editor/LocalOverrideEditor.tsx` | active |
| A145 | control | Quick Create Template Controls | A114 | `/editor` | `VariantsPanel` | `src/components/editor/VariantsPanel.tsx` | active |
| A421 | dialog | Smart Create Wizard Dialog | A114 | `/editor` | `SmartCreateWizard` | `src/components/editor/SmartCreateWizard.tsx` | active |
| A150 | shell | Engine Studio Workspace | A021 | `/studio` | `EngineStudioPage` | `src/app/(dashboard)/studio/page.tsx` | active |
| A151 | section | Engine Studio Header | A150 | `/studio` | `EngineStudioPage` | `src/app/(dashboard)/studio/page.tsx` | active |
| A152 | button | Reset Engine Configuration Button | A151 | `/studio` | `EngineStudioPage` | `src/app/(dashboard)/studio/page.tsx` | active |
| A153 | button | Review Before Publish Button | A151 | `/studio` | `EngineStudioPage` | `src/app/(dashboard)/studio/page.tsx` | active |
| A154 | button | Save Engine Configuration Button | A151 | `/studio` | `EngineStudioPage` | `src/app/(dashboard)/studio/page.tsx` | active |
| A155 | navigation | Engine Studio Sections Navigation | A150 | `/studio` | `EngineStudioPage` | `src/app/(dashboard)/studio/page.tsx` | active |
| A156 | panel | Engine Studio Dashboard | A150 | `/studio` | `Dashboard` | `src/components/studio/Dashboard.tsx` | active |
| A157 | panel | Recitation Rule Catalog Panel | A150 | `/studio` | `RecitationRuleCatalogPanel` | `src/components/studio/RecitationRuleCatalogPanel.tsx` | active |
| A158 | panel | Engine Rule Explorer | A150 | `/studio` | `RuleExplorer` | `src/components/studio/RuleExplorer.tsx` | active |
| A159 | input | Engine Rule Search Input | A158 | `/studio` | `RuleExplorer` | `src/components/studio/RuleExplorer.tsx` | active |
| A160 | button | Create Engine Rule Button | A158 | `/studio` | `RuleExplorer` | `src/components/studio/RuleExplorer.tsx` | active |
| A161 | form | Engine Rule Builder Form | A150 | `/studio` | `RuleBuilder` | `src/components/studio/RuleBuilder.tsx` | active |
| A162 | panel | Selected Engine Rule Actions | A150 | `/studio` | `SelectedRuleActions` | `src/app/(dashboard)/studio/page.tsx` | active |
| A163 | panel | Merge Matrix Panel | A150 | `/studio` | `MergeMatrixPanel` | `src/components/studio/MergeMatrixPanel.tsx` | active |
| A164 | panel | Priority Pipeline Panel | A150 | `/studio` | `PriorityPipeline` | `src/components/studio/PriorityPipeline.tsx` | active |
| A165 | panel | Why and Decision Trace Playground | A150 | `/studio` | `WhyTracePlayground` | `src/components/studio/WhyTracePlayground.tsx` | active |
| A166 | panel | Engine Rule Tests Panel | A150 | `/studio` | `RuleTestsPanel` | `src/components/studio/RuleTestsPanel.tsx` | active |
| A167 | panel | Candidate Rules Panel | A150 | `/studio` | `CandidateRulesPanel` | `src/components/studio/CandidateRulesPanel.tsx` | active |
| A168 | panel | Engine Profile Compare Panel | A150 | `/studio` | `ProfileComparePanel` | `src/components/studio/ProfileComparePanel.tsx` | active |
| A169 | panel | Publish Gate and Engine History Panel | A150 | `/studio` | `PublishHistoryPanel` | `src/components/studio/PublishHistoryPanel.tsx` | active |
| A170 | panel | Engine Export Import Panel | A150 | `/studio` | `ExportImportPanel` | `src/components/studio/ExportImportPanel.tsx` | active |
| A171 | panel | Engine Behavior Settings Panel | A150 | `/studio` | `EngineSettingsPanel` | `src/components/studio/EngineSettingsPanel.tsx` | active |
| A180 | input | Surah Search Input | A022 | `/quran` | `QuranPage` | `src/app/(dashboard)/quran/page.tsx` | active |
| A181 | list | Surah Navigation List | A022 | `/quran` | `QuranPage` | `src/app/(dashboard)/quran/page.tsx` | active |
| A182 | section | Current Surah Reader | A022 | `/quran` | `QuranPage` | `src/app/(dashboard)/quran/page.tsx` | active |
| A183 | button | Toggle Saved Tashjeer Visibility | A182 | `/quran` | `QuranPage` | `src/app/(dashboard)/quran/page.tsx` | active |
| A184 | list-item | Quran Ayah Row | A182 | `/quran` | `QuranPage` | `src/app/(dashboard)/quran/page.tsx` | active |
| A185 | navigation | Open Quran Ayah in Editor Link | A184 | `/quran` | `QuranPage` | `src/app/(dashboard)/quran/page.tsx` | active |
| A186 | button | Export Quran Ayah JSON Button | A184 | `/quran` | `QuranPage` | `src/app/(dashboard)/quran/page.tsx` | active |
| A187 | card | Saved Ayah Tashjeer Card | A184 | `/quran` | `AyahTashjeerView` | `src/components/quran/AyahTashjeerView.tsx` | active |
| A188 | button | Toggle Ayah Tashjeer Card Button | A187 | `/quran` | `AyahTashjeerView` | `src/components/quran/AyahTashjeerView.tsx` | active |
| A189 | navigation | Open Tashjeer Card in Editor Link | A187 | `/quran` | `AyahTashjeerView` | `src/components/quran/AyahTashjeerView.tsx` | active |
| A200 | filter | Tracking Category Filters | A023 | `/tracking` | `TrackingPage` | `src/app/(dashboard)/tracking/page.tsx` | active |
| A201 | filter | Tracking Source Filters | A023 | `/tracking` | `TrackingPage` | `src/app/(dashboard)/tracking/page.tsx` | active |
| A202 | panel | Tracking Summary Cards | A023 | `/tracking` | `TrackingPage` | `src/app/(dashboard)/tracking/page.tsx` | active |
| A203 | list | Tracking Results List | A023 | `/tracking` | `TrackingPage` | `src/app/(dashboard)/tracking/page.tsx` | active |
| A204 | list-item | Tracking Result Card | A203 | `/tracking` | `TrackingRowCard` | `src/app/(dashboard)/tracking/page.tsx` | active |
| A205 | button | Toggle Tracking Difference Details | A204 | `/tracking` | `TrackingRowCard` | `src/app/(dashboard)/tracking/page.tsx` | active |
| A206 | button | Toggle Decision Trace Details | A204 | `/tracking` | `RowDecisionTrace` | `src/app/(dashboard)/tracking/page.tsx` | active |
| A207 | navigation | Propose Rule from Correction Link | A204 | `/tracking` | `CorrectionTripletView` | `src/app/(dashboard)/tracking/page.tsx` | active |
| A208 | navigation | Open Tracking Row in Editor Link | A204 | `/tracking` | `TrackingRowCard` | `src/app/(dashboard)/tracking/page.tsx` | active |
| A220 | panel | Variant Index Workspace | A024 | `/variants` | `VariantsIndexPage` | `src/app/(dashboard)/variants/page.tsx` | active |
| A221 | filter | Variant Index Search and Filters | A220 | `/variants` | `VariantsIndexPage` | `src/app/(dashboard)/variants/page.tsx` | active |
| A222 | list | Cross-document Variant Results | A220 | `/variants` | `VariantsIndexPage` | `src/app/(dashboard)/variants/page.tsx` | active |
| A223 | dialog | General Rule Editor Dialog | A024 | `/variants` | `GlobalRuleDialog` | `src/app/(dashboard)/variants/page.tsx` | active |
| A230 | input | Qiraat Search Input | A025 | `/qiraat` | `QiraatPage` | `src/app/(dashboard)/qiraat/page.tsx` | active |
| A231 | list | Qiraat Selection List | A025 | `/qiraat` | `QiraatPage` | `src/app/(dashboard)/qiraat/page.tsx` | active |
| A232 | panel | Selected Qiraat Details | A025 | `/qiraat` | `QiraatPage` | `src/app/(dashboard)/qiraat/page.tsx` | active |
| A240 | form | Reader Profile Form | A026 | `/readers` | `ReadersPage` | `src/app/(dashboard)/readers/page.tsx` | active |
| A241 | list | Readers Catalog List | A026 | `/readers` | `ReadersPage` | `src/app/(dashboard)/readers/page.tsx` | active |
| A242 | select | Reader Transmission Selector | A240 | `/readers` | `ReadersPage` | `src/app/(dashboard)/readers/page.tsx` | active |
| A243 | button | Submit Reader Profile Form | A240 | `/readers` | `ReadersPage` | `src/app/(dashboard)/readers/page.tsx` | active |
| A250 | shell | Scientific Review Workspace | A027 | `/review` | `ReviewPage` | `src/app/(dashboard)/review/page.tsx` | active |
| A251 | filter | Review Queue Filters | A250 | `/review` | `ReviewPage` | `src/app/(dashboard)/review/page.tsx` | active |
| A252 | list | Scientific Review Queue | A250 | `/review` | `ReviewPage` | `src/app/(dashboard)/review/page.tsx` | active |
| A253 | input | Review Notes Input | A252 | `/review` | `ReviewPage` | `src/app/(dashboard)/review/page.tsx` | active |
| A254 | action | Review Status Action | A252 | `/review` | `ReviewPage` | `src/app/(dashboard)/review/page.tsx` | active |
| A260 | navigation | Administration Tabs | A028 | `/admin` | `AdminPage` | `src/app/(dashboard)/admin/page.tsx` | active |
| A261 | list | Transmission Catalog and Reorder List | A028 | `/admin` | `TransmissionManager` | `src/app/(dashboard)/admin/page.tsx` | active |
| A262 | form | Transmission Catalog Editor Form | A028 | `/admin` | `TransmissionEditor` | `src/app/(dashboard)/admin/page.tsx` | active |
| A263 | drag-handle | Transmission Reorder Control | A261 | `/admin` | `TransmissionManager` | `src/app/(dashboard)/admin/page.tsx` | active |
| A270 | panel | Settings Workspace | A029 | `/settings` | `SettingsPage` | `src/app/(dashboard)/settings/page.tsx` | active |
| A271 | panel | Strength Degrees Manager | A270 | `/settings` | `StrengthDegreesManager` | `src/components/settings/StrengthDegreesManager.tsx` | active |
| A272 | action | Reset Settings Action | A270 | `/settings` | `SettingsPage` | `src/app/(dashboard)/settings/page.tsx` | active |
| A280 | panel | Statistics Dashboard | A030 | `/statistics` | `StatisticsPage` | `src/app/(dashboard)/statistics/page.tsx` | active |
| A290 | section | Public Landing Content | A031 | `/` | `HomePage` | `src/app/page.tsx` | active |
| A291 | navigation | Public Site Navigation | A031 | `/` | `PublicHeader` | `src/components/marketing/PublicHeader.tsx` | active |
| A340 | shell | Local Sign-in Surface | A032 | `/login` | `LoginPage` | `src/app/login/page.tsx` | active |
| A341 | form | Local Sign-in Form | A340 | `/login` | `LoginPage` | `src/app/login/page.tsx` | active |
| A342 | input | Sign-in Email Input | A341 | `/login` | `LoginPage` | `src/app/login/page.tsx` | active |
| A343 | input | Sign-in Password Input | A341 | `/login` | `LoginPage` | `src/app/login/page.tsx` | active |
| A344 | button | Local Sign-in Submit Button | A341 | `/login` | `LoginPage` | `src/app/login/page.tsx` | active |
| A310 | shell | Dashboard Layout Shell | A015 | `shared-dashboard` | `DashboardLayout` | `src/app/(dashboard)/layout.tsx` | active |
| A311 | navigation | Desktop Sidebar Navigation | A310 | `shared-dashboard` | `DashboardLayout` | `src/app/(dashboard)/layout.tsx` | active |
| A312 | navigation | Dashboard Home Link | A311 | `shared-dashboard` | `DashboardLayout` | `src/app/(dashboard)/layout.tsx` | active |
| A313 | navigation | Mobile Workspace Navigation | A310 | `shared-dashboard` | `DashboardLayout` | `src/app/(dashboard)/layout.tsx` | active |
| A314 | navigation | Editor Navigation Link | A311 | `shared-dashboard` | `DashboardLayout` | `src/app/(dashboard)/layout.tsx` | active |
| A315 | navigation | Studio Navigation Link | A311 | `shared-dashboard` | `DashboardLayout` | `src/app/(dashboard)/layout.tsx` | active |
| A316 | navigation | Variant Index Navigation Link | A311 | `shared-dashboard` | `DashboardLayout` | `src/app/(dashboard)/layout.tsx` | active |
| A317 | navigation | Tracking Navigation Link | A311 | `shared-dashboard` | `DashboardLayout` | `src/app/(dashboard)/layout.tsx` | active |
| A318 | navigation | Quran Navigation Link | A311 | `shared-dashboard` | `DashboardLayout` | `src/app/(dashboard)/layout.tsx` | active |
| A319 | navigation | Qiraat Navigation Link | A311 | `shared-dashboard` | `DashboardLayout` | `src/app/(dashboard)/layout.tsx` | active |
| A320 | navigation | Readers Navigation Link | A311 | `shared-dashboard` | `DashboardLayout` | `src/app/(dashboard)/layout.tsx` | active |
| A321 | navigation | Review Navigation Link | A311 | `shared-dashboard` | `DashboardLayout` | `src/app/(dashboard)/layout.tsx` | active |
| A322 | navigation | Statistics Navigation Link | A311 | `shared-dashboard` | `DashboardLayout` | `src/app/(dashboard)/layout.tsx` | active |
| A323 | navigation | Administration Navigation Link | A311 | `shared-dashboard` | `DashboardLayout` | `src/app/(dashboard)/layout.tsx` | active |
| A324 | navigation | Settings Navigation Link | A311 | `shared-dashboard` | `DashboardLayout` | `src/app/(dashboard)/layout.tsx` | active |
| A325 | navigation | Quran Quick Link in Workspace Header | A310 | `shared-dashboard` | `DashboardLayout` | `src/app/(dashboard)/layout.tsx` | active |
| A326 | control | Local Session Badge | A310 | `shared-dashboard` | `SessionBadge` | `src/components/layout/SessionBadge.tsx` | active |
| A327 | dialog | Shared Confirmation Dialog Host | A310 | `shared-dashboard` | `ConfirmDialogHost` | `src/components/ui/ConfirmDialogHost.tsx` | active |
| A328 | navigation | Workspace Brand Home Link | A310 | `shared-dashboard` | `DashboardLayout` | `src/app/(dashboard)/layout.tsx` | active |
| A410 | inspector | Developer Registry Inspector Toggle | A014 | `development-only` | `UIRegistryInspector` | `src/components/dev/UIRegistryInspector.tsx` | active |
| A411 | inspector | Developer UI ID Overlay | A014 | `development-only` | `UIRegistryInspector` | `src/components/dev/UIRegistryInspector.tsx` | active |
| A412 | inspector | Developer Registry Details Card | A014 | `development-only` | `UIRegistryInspector` | `src/components/dev/UIRegistryInspector.tsx` | active |

## السجلات الكاملة

<details>
<summary><strong>A020 — Editor Route</strong></summary>

- **Type:** `route`
- **Feature:** A001 — Editor
- **Parent:** A001
- **Route:** `/editor`
- **Component:** `EditorPage`
- **Source:** `src/app/(dashboard)/editor/page.tsx`
- **Purpose:** صفحة تحرير المستند والاختلافات.
- **Behavior:** تفتح المستند المحلي وتعرض أدوات التحرير والرسم.
- **Constraints:** تغيير المعرف لا يتم عند نقل المسار أو إعادة تصميم الصفحة؛ يظل A001 هوية الميزة.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A100`, `A101`, `A107`, `A111`, `A113`, `A114`
- **Code references (not UI IDs):** `useEditorStore`, `useKeyboardShortcuts`

</details>

<details>
<summary><strong>A021 — Engine Studio Route</strong></summary>

- **Type:** `route`
- **Feature:** A002 — Engine Studio
- **Parent:** A002
- **Route:** `/studio`
- **Component:** `EngineStudioPage`
- **Source:** `src/app/(dashboard)/studio/page.tsx`
- **Purpose:** صفحة سياسات وإعدادات المحرك.
- **Behavior:** تدير أقسام استوديو المحرك من ملف الإعداد النشط.
- **Constraints:** لا تكرر منطق resolver داخل الصفحة.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A150`, `A155`, `A158`, `A163`, `A169`
- **Code references (not UI IDs):** `useEngineStudioStore`, `executionOrderImpact`

</details>

<details>
<summary><strong>A022 — Quran Route</strong></summary>

- **Type:** `route`
- **Feature:** A003 — Quran View
- **Parent:** A003
- **Route:** `/quran`
- **Component:** `QuranPage`
- **Source:** `src/app/(dashboard)/quran/page.tsx`
- **Purpose:** قارئ المصحف وعرض التشجير النهائي.
- **Behavior:** يعرض السورة المختارة وآياتها وما حُفظ أو اشتُق لها من تشجير.
- **Constraints:** لا يغيّر المستند عند العرض؛ التعديل يتم عبر رابط المحرر.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A180`, `A182`, `A187`
- **Code references (not UI IDs):** `listDocuments`, `surahAyahsWithTashjeer`

</details>

<details>
<summary><strong>A023 — Tracking Route</strong></summary>

- **Type:** `route`
- **Feature:** A004 — Tracking
- **Parent:** A004
- **Route:** `/tracking`
- **Component:** `TrackingPage`
- **Source:** `src/app/(dashboard)/tracking/page.tsx`
- **Purpose:** صفحة تتبع المصدر والتصحيح وقرار المحرك.
- **Behavior:** تجمع بيانات المستندات والتجاوزات وتتيح التصفية وفتح الأثر.
- **Constraints:** واجهة قراءة؛ لا تُعدّل مستندات المستخدم مباشرة.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A200`, `A201`, `A203`, `A204`
- **Code references (not UI IDs):** `readTrackingRows`, `trackingSummary`, `resolveDifference`

</details>

<details>
<summary><strong>A024 — Variant Index Route</strong></summary>

- **Type:** `route`
- **Feature:** A005 — Variant and Rule Index
- **Parent:** A005
- **Route:** `/variants`
- **Component:** `VariantsIndexPage`
- **Source:** `src/app/(dashboard)/variants/page.tsx`
- **Purpose:** فهرس الاختلافات والقواعد العامة.
- **Behavior:** يصفّي السجلات ويتيح تحرير البيانات المسجلة أو فتحها في المحرر.
- **Constraints:** لا تُنسخ القواعد العامة إلى مستند الآية عند العرض.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A220`, `A221`, `A222`, `A223`
- **Code references (not UI IDs):** `readGlobalRules`, `describeGlobalPattern`

</details>

<details>
<summary><strong>A025 — Qiraat Catalog Route</strong></summary>

- **Type:** `route`
- **Feature:** A006 — Qiraat Catalog
- **Parent:** A006
- **Route:** `/qiraat`
- **Component:** `QiraatPage`
- **Source:** `src/app/(dashboard)/qiraat/page.tsx`
- **Purpose:** استعراض القراءات العشر.
- **Behavior:** يبحث في قائمة القراءات ويعرض تفاصيل القراءة المحددة.
- **Constraints:** مصدر القراءة هو بيانات المشروع الحالية.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A230`, `A231`, `A232`
- **Code references (not UI IDs):** `src/data/qiraat-data/qiraat.ts`

</details>

<details>
<summary><strong>A026 — Readers Route</strong></summary>

- **Type:** `route`
- **Feature:** A007 — Readers Catalog
- **Parent:** A007
- **Route:** `/readers`
- **Component:** `ReadersPage`
- **Source:** `src/app/(dashboard)/readers/page.tsx`
- **Purpose:** صفحة ملفات القراء وإدارتها.
- **Behavior:** تعرض نموذج الملف وقائمة القراء وإجراءات الصفحة.
- **Constraints:** لا تفترض وجود backend؛ اربط التغيير بالتنفيذ الموجود فقط.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A240`, `A241`, `A242`
- **Code references (not UI IDs):** `ReadersPage`

</details>

<details>
<summary><strong>A027 — Review Route</strong></summary>

- **Type:** `route`
- **Feature:** A008 — Scientific Review
- **Parent:** A008
- **Route:** `/review`
- **Component:** `ReviewPage`
- **Source:** `src/app/(dashboard)/review/page.tsx`
- **Purpose:** قائمة المراجعة العلمية.
- **Behavior:** تعرض السجلات القابلة للمراجعة وإجراءات حالتها.
- **Constraints:** حافظ على بيانات المصدر وحالات المراجعة الحالية.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A250`, `A251`, `A252`
- **Code references (not UI IDs):** `document-store`

</details>

<details>
<summary><strong>A028 — Administration Route</strong></summary>

- **Type:** `route`
- **Feature:** A009 — Transmission Administration
- **Parent:** A009
- **Route:** `/admin`
- **Component:** `AdminPage`
- **Source:** `src/app/(dashboard)/admin/page.tsx`
- **Purpose:** إدارة كتالوج القراء والرواة والطرق.
- **Behavior:** تبدّل بين كتالوج الإرسال وتبويب قديم يحيل إعداد المحرك إلى Studio.
- **Constraints:** تبويب إعدادات المحرك هنا رابط توافق قديم وليس مصدرا مستقلا.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A260`, `A261`, `A262`
- **Code references (not UI IDs):** `readTransmissionCatalog`, `saveTransmissionCatalog`

</details>

<details>
<summary><strong>A029 — Settings Route</strong></summary>

- **Type:** `route`
- **Feature:** A010 — Settings
- **Parent:** A010
- **Route:** `/settings`
- **Component:** `SettingsPage`
- **Source:** `src/app/(dashboard)/settings/page.tsx`
- **Purpose:** صفحة إعدادات مساحة العمل.
- **Behavior:** تعرض خيارات الإعداد وإدارة درجات القوة.
- **Constraints:** لا تغيّر إعدادات المحرك من هذه الصفحة إلا عبر مصدرها المعتمد.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A270`, `A271`
- **Code references (not UI IDs):** `StrengthDegreesManager`

</details>

<details>
<summary><strong>A030 — Statistics Route</strong></summary>

- **Type:** `route`
- **Feature:** A011 — Statistics
- **Parent:** A011
- **Route:** `/statistics`
- **Component:** `StatisticsPage`
- **Source:** `src/app/(dashboard)/statistics/page.tsx`
- **Purpose:** لوحة الإحصاءات والتغطية.
- **Behavior:** تعرض أعدادا مشتقة وروابط مراجعة ذات صلة.
- **Constraints:** عرض للقراءة فقط؛ الأرقام مشتقة من ملفات البيانات الحالية.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A280`
- **Code references (not UI IDs):** `listDocuments`, `TOTAL_AYAHS`

</details>

<details>
<summary><strong>A031 — Public Home Route</strong></summary>

- **Type:** `route`
- **Feature:** A012 — Public Landing
- **Parent:** A012
- **Route:** `/`
- **Component:** `HomePage`
- **Source:** `src/app/page.tsx`
- **Purpose:** صفحة المشروع العامة.
- **Behavior:** تعرض قصة المنتج وبيانات العرض الحقيقية وروابط الانتقال.
- **Constraints:** المخطط التجريبي مبني من بيانات المشروع عبر buildShowcase.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A290`, `A291`
- **Code references (not UI IDs):** `buildShowcase`

</details>

<details>
<summary><strong>A032 — Local Sign-in Route</strong></summary>

- **Type:** `route`
- **Feature:** A013 — Local Sign-in
- **Parent:** A013
- **Route:** `/login`
- **Component:** `LoginPage`
- **Source:** `src/app/login/page.tsx`
- **Purpose:** نموذج الدخول المحلي.
- **Behavior:** يتحقق من الحقول ويحفظ جلسة في localStorage ثم ينتقل إلى المحرر.
- **Constraints:** لا يرسل البريد أو كلمة المرور إلى خدمة خارجية.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A340`, `A341`, `A342`, `A344`
- **Code references (not UI IDs):** `localStorage.setItem("tashjeer-session")`

</details>

<details>
<summary><strong>A100 — Editor Canvas Workspace</strong></summary>

- **Type:** `shell`
- **Feature:** A001 — Editor
- **Parent:** A020
- **Route:** `/editor`
- **Component:** `EditorPage`
- **Source:** `src/app/(dashboard)/editor/page.tsx`
- **Purpose:** منطقة العمل المركزية التي تعرض نص الآية ورسم التشجير ومساحة التفاعل.
- **Behavior:** تحتوي لوحة TashjeerCanvas داخل السطح المركزي للمحرر.
- **Constraints:** تغييرات العرض لا تغيّر state أو المحرك من تلقاء نفسها.
- **Status:** `active`
- **Dependencies:** `A111`
- **Related UI IDs:** `A107`, `A113`, `A114`
- **Code references (not UI IDs):** `TashjeerCanvas`, `useEditorStore`

</details>

<details>
<summary><strong>A101 — Editor Toolbar</strong></summary>

- **Type:** `toolbar`
- **Feature:** A001 — Editor
- **Parent:** A020
- **Route:** `/editor`
- **Component:** `EditorToolbar`
- **Source:** `src/components/editor/EditorToolbar.tsx`
- **Purpose:** أدوات التحديد والعرض والحفظ والتصدير والتحكم باللوحات.
- **Behavior:** يغيّر أداة التحرير أو خيارات العرض وينفذ الحفظ وأوامر المستند.
- **Constraints:** أزرار العرض منفصلة عن business logic للمحرك.
- **Status:** `active`
- **Dependencies:** `A103`, `A104`, `A135`, `A136`
- **Related UI IDs:** `A102`, `A137`
- **Code references (not UI IDs):** `useEditorStore`, `saveEngineSettings`

</details>

<details>
<summary><strong>A102 — Editor Tool Palette</strong></summary>

- **Type:** `control`
- **Feature:** A001 — Editor
- **Parent:** A101
- **Route:** `/editor`
- **Component:** `EditorToolbar`
- **Source:** `src/components/editor/EditorToolbar.tsx`
- **Purpose:** أزرار تحديد وتعليم ومسح المواضع.
- **Behavior:** تعيّن الأداة الحالية أو نمط تعليم الكلمات/الحروف.
- **Constraints:** لا ينشئ العنصر سجلا حتى تنفّذ عملية الإنشاء من واجهتها المختصة.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A116`, `A111`
- **Code references (not UI IDs):** `setTool`, `setMarkingMode`

</details>

<details>
<summary><strong>A103 — Undo Action Button</strong></summary>

- **Type:** `button`
- **Feature:** A001 — Editor
- **Parent:** A101
- **Route:** `/editor`
- **Component:** `EditorToolbar`
- **Source:** `src/components/editor/EditorToolbar.tsx`
- **Purpose:** زر التراجع عن آخر عملية مستند.
- **Behavior:** يستدعي undo من editor-store عند توفر سجل سابق.
- **Constraints:** يحافظ على مكدس التراجع الموحد؛ لا ينشئ سجلا موازيا.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A104`, `A105`
- **Code references (not UI IDs):** `undo`, `canUndo`

</details>

<details>
<summary><strong>A104 — Redo Action Button</strong></summary>

- **Type:** `button`
- **Feature:** A001 — Editor
- **Parent:** A101
- **Route:** `/editor`
- **Component:** `EditorToolbar`
- **Source:** `src/components/editor/EditorToolbar.tsx`
- **Purpose:** زر إعادة العملية التي تم التراجع عنها.
- **Behavior:** يستدعي redo من editor-store عند توفر سجل مستقبلي.
- **Constraints:** يحافظ على مكدس التراجع الموحد؛ لا ينشئ سجلا موازيا.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A103`, `A105`
- **Code references (not UI IDs):** `redo`, `canRedo`

</details>

<details>
<summary><strong>A105 — Editor Operation History Menu</strong></summary>

- **Type:** `menu`
- **Feature:** A001 — Editor
- **Parent:** A101
- **Route:** `/editor`
- **Component:** `HistoryControls`
- **Source:** `src/components/editor/HistoryControls.tsx`
- **Purpose:** قائمة الحالات المحفوظة في تاريخ المستند.
- **Behavior:** تعرض snapshots وتتيح القفز بينها بعد تأكيد.
- **Constraints:** تعيد استعمال تاريخ editor-store ولا تملك سجل أوامر منفصلا.
- **Status:** `active`
- **Dependencies:** `A103`, `A104`
- **Related UI IDs:** `A101`
- **Code references (not UI IDs):** `past`, `future`, `confirmAction`

</details>

<details>
<summary><strong>A106 — Unified Clipboard Menu</strong></summary>

- **Type:** `menu`
- **Feature:** A001 — Editor
- **Parent:** A101
- **Route:** `/editor`
- **Component:** `ClipboardControls`
- **Source:** `src/components/editor/ClipboardControls.tsx`
- **Purpose:** قائمة الحافظة الموحدة للنسخ والقص واللصق والعلاقات المعلقة.
- **Behavior:** تنفذ عمليات clipboard الموجودة في editor-store.
- **Constraints:** لا تغير قواعد clone/relate أو معرفات البيانات عند تعديل مظهر القائمة.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A114`, `A121`, `A128`
- **Code references (not UI IDs):** `copySelection`, `cutSelection`, `requestPasteSelection`

</details>

<details>
<summary><strong>A107 — Ayah Navigator</strong></summary>

- **Type:** `panel`
- **Feature:** A001 — Editor
- **Parent:** A020
- **Route:** `/editor`
- **Component:** `AyahNavigator`
- **Source:** `src/components/editor/AyahNavigator.tsx`
- **Purpose:** مستعرض السورة والآية والبحث في نص المصحف.
- **Behavior:** ينقل المستند المفتوح إلى الموضع المختار أو نتيجة البحث.
- **Constraints:** لا يغيّر محتوى المستند عند التنقل.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A108`, `A109`, `A110`, `A111`
- **Code references (not UI IDs):** `onNavigate`, `searchQuran`

</details>

<details>
<summary><strong>A108 — Surah Selector</strong></summary>

- **Type:** `select`
- **Feature:** A001 — Editor
- **Parent:** A107
- **Route:** `/editor`
- **Component:** `AyahNavigator`
- **Source:** `src/components/editor/AyahNavigator.tsx`
- **Purpose:** قائمة اختيار السورة في محرر الآية.
- **Behavior:** ينتقل إلى الآية الأولى من السورة المختارة.
- **Constraints:** المعنى مرتبط باختيار سورة لا بنص الخيار الحالي.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A109`
- **Code references (not UI IDs):** `makeAyahKey`

</details>

<details>
<summary><strong>A109 — Ayah Selector</strong></summary>

- **Type:** `select`
- **Feature:** A001 — Editor
- **Parent:** A107
- **Route:** `/editor`
- **Component:** `AyahNavigator`
- **Source:** `src/components/editor/AyahNavigator.tsx`
- **Purpose:** قائمة اختيار رقم الآية.
- **Behavior:** ينتقل إلى الآية المختارة ضمن السورة الحالية.
- **Constraints:** لا تعيد تهيئة بيانات آية أخرى غير المحددة.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A108`
- **Code references (not UI IDs):** `makeAyahKey`, `onNavigate`

</details>

<details>
<summary><strong>A110 — Quran Text Search Input</strong></summary>

- **Type:** `input`
- **Feature:** A001 — Editor
- **Parent:** A107
- **Route:** `/editor`
- **Component:** `AyahNavigator`
- **Source:** `src/components/editor/AyahNavigator.tsx`
- **Purpose:** حقل بحث نص المصحف للانتقال إلى آية مطابقة.
- **Behavior:** يعرض اقتراحات بحث ثم يفتح الآية المختارة.
- **Constraints:** البحث تنقل فقط، ولا يعدل نص المصحف.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A107`, `A111`
- **Code references (not UI IDs):** `searchQuran`

</details>

<details>
<summary><strong>A111 — Tashjeer Canvas</strong></summary>

- **Type:** `panel`
- **Feature:** A001 — Editor
- **Parent:** A100
- **Route:** `/editor`
- **Component:** `TashjeerCanvas`
- **Source:** `src/components/editor/TashjeerCanvas.tsx`
- **Purpose:** لوحة SVG لنص الآية وخطوط التشجير والتحديد.
- **Behavior:** تعرض ناتج التشجير وتدعم اختيار الكلمات والحروف والأسطر.
- **Constraints:** الرسم مشتق من المستند والمحرك؛ لا تجعل تغيير الواجهة يعدل منطق التوليد.
- **Status:** `active`
- **Dependencies:** `A113`, `A114`
- **Related UI IDs:** `A112`, `A130`
- **Code references (not UI IDs):** `useAyahTashjeer`, `TashjeerFigure`

</details>

<details>
<summary><strong>A112 — Selection Breadcrumb</strong></summary>

- **Type:** `panel`
- **Feature:** A001 — Editor
- **Parent:** A100
- **Route:** `/editor`
- **Component:** `SelectionBreadcrumb`
- **Source:** `src/components/editor/SelectionBreadcrumb.tsx`
- **Purpose:** سلسلة سياق العنصر المحدد عبر الآية والسطر والاختلاف والوجه.
- **Behavior:** تعرض التحديد الموحد الحالي وتتيح الانتقال بين سياقه.
- **Constraints:** قراءة من selection-store؛ لا تستحدث selection state محلية.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A129`, `A130`
- **Code references (not UI IDs):** `useEditorStore`, `selection-store`

</details>

<details>
<summary><strong>A113 — Editor Properties Panel</strong></summary>

- **Type:** `panel`
- **Feature:** A001 — Editor
- **Parent:** A020
- **Route:** `/editor`
- **Component:** `PropertiesPanel`
- **Source:** `src/components/editor/PropertiesPanel.tsx`
- **Purpose:** تفاصيل المستند والاختلاف والوجه، الترتيب وإعدادات القراءة.
- **Behavior:** يحرر خصائص الكيان المحدد عبر editor-store والمكونات الفرعية.
- **Constraints:** كل تغيير إلى البيانات يجب أن يبقى محكوما بسلوك العمليات الحالية والتراجع.
- **Status:** `active`
- **Dependencies:** `A129`, `A123`, `A128`
- **Related UI IDs:** `A111`, `A114`
- **Code references (not UI IDs):** `useEditorStore`, `setDocumentStatus`

</details>

<details>
<summary><strong>A114 — Differences and Variants Panel</strong></summary>

- **Type:** `panel`
- **Feature:** A001 — Editor
- **Parent:** A020
- **Route:** `/editor`
- **Component:** `VariantsPanel`
- **Source:** `src/components/editor/VariantsPanel.tsx`
- **Purpose:** لوحة اختلافات الآية والأوجه والقواعد العامة وأدوات الإنشاء.
- **Behavior:** تحدد الاختلافات والأوجه وتتيح إنشاءها أو تحريرها أو حذفها وتعميمها.
- **Constraints:** لا تستبدل اختلافا قائما عند إنشاء اختلاف ثانٍ؛ تبقى العلاقات ونموذج البيانات كما هما.
- **Status:** `active`
- **Dependencies:** `A117`, `A118`, `A119`, `A121`, `A421`
- **Related UI IDs:** `A115`, `A116`, `A333`, `A140`, `A143`
- **Code references (not UI IDs):** `requestDeleteItems`, `setMultiSelection`, `applySmartCreateBatch`

</details>

<details>
<summary><strong>A115 — Open Rules Index Button</strong></summary>

- **Type:** `button`
- **Feature:** A001 — Editor
- **Parent:** A114
- **Route:** `/editor`
- **Component:** `VariantsPanel`
- **Source:** `src/components/editor/VariantsPanel.tsx`
- **Purpose:** يفتح فهرس القواعد والاختلافات الكامل داخل المحرر.
- **Behavior:** يفتح RulesIndexDialog دون تغيير سجل البيانات.
- **Constraints:** فتح الفهرس لا يغير تحديد المستخدم إلا عبر إجراء صريح.
- **Status:** `active`
- **Dependencies:** `A140`
- **Related UI IDs:** `A114`
- **Code references (not UI IDs):** `setShowRulesIndex`

</details>

<details>
<summary><strong>A116 — Open Smart Create Button</strong></summary>

- **Type:** `button`
- **Feature:** A001 — Editor
- **Parent:** A114
- **Route:** `/editor`
- **Component:** `VariantsPanel`
- **Source:** `src/components/editor/VariantsPanel.tsx`
- **Purpose:** يفتح معالج الإنشاء الذكي من لوحة الاختلافات.
- **Behavior:** يعرض المعالج الموحد ويبدأ من التحديد الحالي أو يسمح بالتحديد داخل المعالج.
- **Constraints:** زر الفتح لا ينشئ اختلافا بمفرده.
- **Status:** `active`
- **Dependencies:** `A421`
- **Related UI IDs:** `A102`, `A114`
- **Code references (not UI IDs):** `setShowSmartWizard`

</details>

<details>
<summary><strong>A117 — Differences Search Input</strong></summary>

- **Type:** `input`
- **Feature:** A001 — Editor
- **Parent:** A114
- **Route:** `/editor`
- **Component:** `VariantsPanel`
- **Source:** `src/components/editor/VariantsPanel.tsx`
- **Purpose:** بحث فوري في اختلافات الآية المعروضة.
- **Behavior:** يصفّي قائمة الاختلافات بحسب نصها وفئتها وحالتها ومصدرها.
- **Constraints:** التصفية لا تحذف ولا تعدل بيانات.
- **Status:** `active`
- **Dependencies:** `A118`
- **Related UI IDs:** `A119`
- **Code references (not UI IDs):** `listSearch`, `visibleVariants`

</details>

<details>
<summary><strong>A118 — Differences List</strong></summary>

- **Type:** `list`
- **Feature:** A001 — Editor
- **Parent:** A114
- **Route:** `/editor`
- **Component:** `VariantsPanel`
- **Source:** `src/components/editor/VariantsPanel.tsx`
- **Purpose:** قائمة الاختلافات والوجوه للآية المفتوحة.
- **Behavior:** تدعم التحديد الموحد والمتعدد والتمرير الافتراضي.
- **Constraints:** ترتيب العرض لا يعرّف هوية الاختلافات ولا يغير رتبتها المحفوظة.
- **Status:** `active`
- **Dependencies:** `A117`
- **Related UI IDs:** `A119`, `A121`, `A333`
- **Code references (not UI IDs):** `ScrollableList`, `useEditorStore`

</details>

<details>
<summary><strong>A119 — Difference Multi-selection Actions</strong></summary>

- **Type:** `toolbar`
- **Feature:** A001 — Editor
- **Parent:** A114
- **Route:** `/editor`
- **Component:** `VariantsPanel`
- **Source:** `src/components/editor/VariantsPanel.tsx`
- **Purpose:** شريط عمليات التحديد المتعدد للاختلافات.
- **Behavior:** يعرض عدد المحدد ويوفر حذف المحدد والنسخ وإلغاء التحديد.
- **Constraints:** الحذف الكمي يبقى مؤكدا وقابلا للتراجع كعملية واحدة.
- **Status:** `active`
- **Dependencies:** `A333`
- **Related UI IDs:** `A118`, `A106`
- **Code references (not UI IDs):** `setMultiSelection`, `requestDeleteItems`

</details>

<details>
<summary><strong>A333 — Delete Selected Differences Button</strong></summary>

- **Type:** `button`
- **Feature:** A001 — Editor
- **Parent:** A119
- **Route:** `/editor`
- **Component:** `VariantsPanel`
- **Source:** `src/components/editor/VariantsPanel.tsx`
- **Purpose:** يحذف الاختلافات المحددة من قائمة الآية بعد عرض التأكيد الكمي.
- **Behavior:** يستدعي requestDeleteItems بنوع DIFFERENCE ومعرفات التحديد الحالية.
- **Constraints:** لا يحذف أوجها أو علاقات أو اختلافات أخرى غير مشمولة بالمعرفات؛ التأكيد والتراجع الحاليان محفوظان.
- **Status:** `active`
- **Dependencies:** `A119`, `A327`
- **Related UI IDs:** `A118`, `A114`
- **Code references (not UI IDs):** `requestDeleteItems`, `editor-store.deleteVariants`

</details>

<details>
<summary><strong>A121 — Variant Faces List</strong></summary>

- **Type:** `list`
- **Feature:** A001 — Editor
- **Parent:** A118
- **Route:** `/editor`
- **Component:** `VariantsPanel`
- **Source:** `src/components/editor/VariantsPanel.tsx`
- **Purpose:** قائمة أوجه الاختلاف المحدد.
- **Behavior:** تدعم اختيار الوجه وتحديد عدة أوجه للعمليات الجماعية.
- **Constraints:** الوجه الأساسي/المصحف ليس وجها قابلا للحذف الجماعي.
- **Status:** `active`
- **Dependencies:** `A122`
- **Related UI IDs:** `A106`, `A333`
- **Code references (not UI IDs):** `alternative.isBase`, `selectedAlternativeId`

</details>

<details>
<summary><strong>A122 — Bulk Face Selection Checkbox</strong></summary>

- **Type:** `checkbox`
- **Feature:** A001 — Editor
- **Parent:** A121
- **Route:** `/editor`
- **Component:** `VariantsPanel`
- **Source:** `src/components/editor/VariantsPanel.tsx`
- **Purpose:** مربع تحديد الوجه لعمليات الأوجه الجماعية.
- **Behavior:** يضيف/يزيل معرف الوجه إلى التحديد المتعدد.
- **Constraints:** لكل وجه نسخة؛ استخدم alternative.id كـ data-ui-instance. لا يحذف الوجه بمجرد وضع العلامة؛ التنفيذ يحتاج عملية الحذف المؤكدة.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A121`
- **Code references (not UI IDs):** `setMultiSelection`, `FACE`, `alternative.id`

</details>

<details>
<summary><strong>A123 — Line Order Editor</strong></summary>

- **Type:** `list`
- **Feature:** A001 — Editor
- **Parent:** A128
- **Route:** `/editor`
- **Component:** `LineOrderEditor`
- **Source:** `src/components/editor/LineOrderEditor.tsx`
- **Purpose:** قائمة ترتيب أسطر التشجير بالسحب والتأكيد.
- **Behavior:** تتيح النقل والدمج والرتبة الرقمية ضمن أوامر المحرر.
- **Constraints:** لا يتغير الترتيب قبل التأكيد؛ IDs والروابط محفوظة خلال النقل.
- **Status:** `active`
- **Dependencies:** `A124`, `A125`, `A126`, `A127`
- **Related UI IDs:** `A111`, `A129`
- **Code references (not UI IDs):** `moveLineToIndex`, `planLineInsertion`, `confirmAction`

</details>

<details>
<summary><strong>A124 — Line Reorder Row</strong></summary>

- **Type:** `list-item`
- **Feature:** A001 — Editor
- **Parent:** A123
- **Route:** `/editor`
- **Component:** `LineOrderEditor`
- **Source:** `src/components/editor/LineOrderEditor.tsx`
- **Purpose:** صف سطر التشجير القابل للسحب أو التحديد بلوحة المفاتيح.
- **Behavior:** يدعم long press والسحب وShift/Ctrl selection وAlt+Arrow.
- **Constraints:** معرف السطر مصدر الهوية؛ index وموضع العرض ليسا معرفا ثابتا.
- **Status:** `active`
- **Dependencies:** `A125`, `A126`, `A127`
- **Related UI IDs:** `A123`
- **Code references (not UI IDs):** `data-order-line-id`, `onPointerDown`, `moveLineToIndex`

</details>

<details>
<summary><strong>A125 — Line Merge Handle</strong></summary>

- **Type:** `drag-handle`
- **Feature:** A001 — Editor
- **Parent:** A124
- **Route:** `/editor`
- **Component:** `LineOrderEditor`
- **Source:** `src/components/editor/LineOrderEditor.tsx`
- **Purpose:** مقبض دمج سطر مع سطر آخر.
- **Behavior:** يبدأ إيماءة الدمج ويمررها عبر بوابة السياسة والتأكيد الموجودين.
- **Constraints:** لا يدمج مباشرة عند pointer down؛ الإلغاء لا يغير المستند.
- **Status:** `active`
- **Dependencies:** `A123`
- **Related UI IDs:** `A124`
- **Code references (not UI IDs):** `down`, `MERGE`, `confirmAction`

</details>

<details>
<summary><strong>A126 — Line Rank Input</strong></summary>

- **Type:** `input`
- **Feature:** A001 — Editor
- **Parent:** A124
- **Route:** `/editor`
- **Component:** `LineOrderEditor`
- **Source:** `src/components/editor/LineOrderEditor.tsx`
- **Purpose:** حقل الرتبة الصريحة لسطر التشجير.
- **Behavior:** يطلب نقل السطر إلى الرتبة المدخلة بعد التحقق والتأكيد.
- **Constraints:** القيمة خارج النطاق أو غير الصحيحة لا تطبق؛ الرتبة لا تستبدل هوية السطر.
- **Status:** `active`
- **Dependencies:** `A123`
- **Related UI IDs:** `A124`
- **Code references (not UI IDs):** `RankInput`, `confirmOrder`

</details>

<details>
<summary><strong>A127 — Line Move Controls</strong></summary>

- **Type:** `control`
- **Feature:** A001 — Editor
- **Parent:** A124
- **Route:** `/editor`
- **Component:** `LineOrderEditor`
- **Source:** `src/components/editor/LineOrderEditor.tsx`
- **Purpose:** أزرار نقل السطر لأعلى أو لأسفل.
- **Behavior:** تطلب نقل السطر بموضع واحد عبر إجراء الترتيب المؤكد.
- **Constraints:** تبقى معطلة عند حدود القائمة ولا تغير العلاقات أو معرف السطر.
- **Status:** `active`
- **Dependencies:** `A123`
- **Related UI IDs:** `A124`, `A126`
- **Code references (not UI IDs):** `confirmOrder`, `moveLineToIndex`

</details>

<details>
<summary><strong>A128 — Relations Panel</strong></summary>

- **Type:** `panel`
- **Feature:** A001 — Editor
- **Parent:** A113
- **Route:** `/editor`
- **Component:** `RelationsPanel`
- **Source:** `src/components/editor/RelationsPanel.tsx`
- **Purpose:** إدارة علاقات الوجوه والاختلافات والأسطر.
- **Behavior:** يعرض العلاقات ويطلب إنشاء/فك روابط عبر API المخزن وقرار السياسة.
- **Constraints:** لا تنشئ علاقة أو تصحيحا يدويا عند تعديل presentation فقط.
- **Status:** `active`
- **Dependencies:** `A327`
- **Related UI IDs:** `A129`, `A111`
- **Code references (not UI IDs):** `requestAddLink`, `manualDifferenceRelationsOf`, `resolveLocusRelation`

</details>

<details>
<summary><strong>A129 — Selected Element Details Panel</strong></summary>

- **Type:** `panel`
- **Feature:** A001 — Editor
- **Parent:** A113
- **Route:** `/editor`
- **Component:** `SelectionDetailsPanel`
- **Source:** `src/components/editor/SelectionDetailsPanel.tsx`
- **Purpose:** تفاصيل العنصر المحدد وسياقه وأوامر النسخ والتحديد.
- **Behavior:** يعرض الحالة الموحدة ويتيح إجراءات مشتركة للعنصر النشط.
- **Constraints:** لا ينشئ selection state محلية؛ يقرأ المصدر الموحد.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A112`, `A128`, `A130`
- **Code references (not UI IDs):** `useEditorStore`, `selection-store`

</details>

<details>
<summary><strong>A130 — Selection Context Menu</strong></summary>

- **Type:** `menu`
- **Feature:** A001 — Editor
- **Parent:** A111
- **Route:** `/editor`
- **Component:** `SelectionContextMenu`
- **Source:** `src/components/editor/SelectionContextMenu.tsx`
- **Purpose:** قائمة سياقية للأوامر المتاحة على العنصر النشط.
- **Behavior:** تدير copy/cut/paste/delete/edit ونحوها عبر إجراءات المحرر القائمة.
- **Constraints:** تظهر الأوامر بحسب نوع التحديد وصلاحيتها؛ لا تغير ترتيب أو بيانات غير محددة.
- **Status:** `active`
- **Dependencies:** `A129`, `A106`
- **Related UI IDs:** `A111`, `A128`
- **Code references (not UI IDs):** `SelectionCommand`, `deleteActive`

</details>

<details>
<summary><strong>A131 — Keyboard Shortcuts Dialog</strong></summary>

- **Type:** `dialog`
- **Feature:** A001 — Editor
- **Parent:** A020
- **Route:** `/editor`
- **Component:** `ShortcutsDialog`
- **Source:** `src/components/editor/ShortcutsDialog.tsx`
- **Purpose:** نافذة اختصارات المحرر.
- **Behavior:** تعرض الاختصارات وتغلق بطلب المستخدم.
- **Constraints:** نافذة معلوماتية لا تغير المستند.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A101`
- **Code references (not UI IDs):** `onClose`

</details>

<details>
<summary><strong>A132 — Focus Mode Toggle</strong></summary>

- **Type:** `button`
- **Feature:** A001 — Editor
- **Parent:** A020
- **Route:** `/editor`
- **Component:** `EditorPage`
- **Source:** `src/app/(dashboard)/editor/page.tsx`
- **Purpose:** زر إخفاء/إظهار الأشرطة واللوحات في وضع التركيز.
- **Behavior:** يبدل focusMode ويكشف الحواف عند مرور المؤشر.
- **Constraints:** لا يغير محتوى المستند ولا إعدادات المحرك.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A101`, `A107`, `A113`, `A114`
- **Code references (not UI IDs):** `focusMode`, `setFocusMode`

</details>

<details>
<summary><strong>A133 — Editor Status Bar</strong></summary>

- **Type:** `section`
- **Feature:** A001 — Editor
- **Parent:** A020
- **Route:** `/editor`
- **Component:** `StatusBar`
- **Source:** `src/app/(dashboard)/editor/page.tsx`
- **Purpose:** شريط موضع الآية والأداة وحالة الحفظ.
- **Behavior:** يعرض الحالة الحالية للمستند دون تنفيذ تعديل.
- **Constraints:** معلومات مشتقة؛ لا تصبح مصدرا إضافيا للحقيقة.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A101`, `A107`
- **Code references (not UI IDs):** `formatAyahRef`, `isDirty`

</details>

<details>
<summary><strong>A134 — Document Import File Input</strong></summary>

- **Type:** `input`
- **Feature:** A001 — Editor
- **Parent:** A020
- **Route:** `/editor`
- **Component:** `EditorPage`
- **Source:** `src/app/(dashboard)/editor/page.tsx`
- **Purpose:** منتقي ملف JSON المخفي لاستيراد مستندات التشجير.
- **Behavior:** يمرر الملف إلى importDocuments ثم يفتح أول مستند مستورد عند توافره.
- **Constraints:** يقبل application/json فقط؛ لا تحذف معالجة أخطاء الاستيراد.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A135`, `A136`
- **Code references (not UI IDs):** `importDocuments`, `describeImportResult`

</details>

<details>
<summary><strong>A135 — Export Editor Document Button</strong></summary>

- **Type:** `button`
- **Feature:** A001 — Editor
- **Parent:** A101
- **Route:** `/editor`
- **Component:** `EditorToolbar`
- **Source:** `src/components/editor/EditorToolbar.tsx`
- **Purpose:** يصدر مستند الآية إلى ملف JSON.
- **Behavior:** ينفذ callback التصدير الحالي للمستند المفتوح.
- **Constraints:** التصدير يبقى حتميا وفقا لتنسيق المستند ولا يغير الحالة.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A134`
- **Code references (not UI IDs):** `exportDocument`, `onExport`

</details>

<details>
<summary><strong>A136 — Save Editor Document Button</strong></summary>

- **Type:** `button`
- **Feature:** A001 — Editor
- **Parent:** A101
- **Route:** `/editor`
- **Component:** `EditorToolbar`
- **Source:** `src/components/editor/EditorToolbar.tsx`
- **Purpose:** يحفظ مستند المحرر المفتوح.
- **Behavior:** يستدعي save من editor-store ويعرض حالة dirty الحالية.
- **Constraints:** لا تغيّر صيغة التخزين أو حدود المستند من تعديل زر فقط.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A105`, `A134`
- **Code references (not UI IDs):** `save`, `isDirty`

</details>

<details>
<summary><strong>A137 — Canvas Zoom Preset Selector</strong></summary>

- **Type:** `select`
- **Feature:** A001 — Editor
- **Parent:** A101
- **Route:** `/editor`
- **Component:** `EditorToolbar`
- **Source:** `src/components/editor/EditorToolbar.tsx`
- **Purpose:** اختيار مستوى تكبير لوحة التشجير.
- **Behavior:** يعيّن zoom لأحد المستويات المتاحة.
- **Constraints:** تحكم عرض فقط؛ لا يؤثر على نموذج البيانات.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A111`
- **Code references (not UI IDs):** `ZOOM_PRESETS`, `setZoom`

</details>

<details>
<summary><strong>A139 — Recitation and Layout Controls</strong></summary>

- **Type:** `panel`
- **Feature:** A001 — Editor
- **Parent:** A113
- **Route:** `/editor`
- **Component:** `RecitationControls`
- **Source:** `src/components/editor/RecitationControls.tsx`
- **Purpose:** مجموعات تحكم قراءة وترتيب/تكوين التشجير المرتبطة بلوحة الخصائص.
- **Behavior:** تعدل خيارات القراءة أو يدوية الترتيب عبر المخزن الحالي.
- **Constraints:** تغييرات ترتيب الأسطر تظل صريحة وقابلة للتراجع.
- **Status:** `active`
- **Dependencies:** `A123`
- **Related UI IDs:** `A111`, `A113`
- **Code references (not UI IDs):** `useEditorStore`, `TashjeerOrderControls`

</details>

<details>
<summary><strong>A140 — Rules and Differences Index Dialog</strong></summary>

- **Type:** `dialog`
- **Feature:** A001 — Editor
- **Parent:** A114
- **Route:** `/editor`
- **Component:** `RulesIndexDialog`
- **Source:** `src/components/editor/RulesIndexDialog.tsx`
- **Purpose:** فهرس قواعد المصحف والاختلافات العامة والمحلية.
- **Behavior:** يبحث ويصفّي ويتيح مراجعة مواضع القاعدة وبياناتها.
- **Constraints:** قراءة الفهرس لا تنشئ تغييرا قبل إجراء تحرير صريح.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A115`, `A141`, `A143`, `A144`
- **Code references (not UI IDs):** `readIndexRows`, `RuleOccurrenceReview`, `GlobalRuleMetaEditor`

</details>

<details>
<summary><strong>A141 — Rule Occurrence Review Dialog</strong></summary>

- **Type:** `dialog`
- **Feature:** A001 — Editor
- **Parent:** A140
- **Route:** `/editor`
- **Component:** `RuleOccurrenceReview`
- **Source:** `src/components/editor/RuleOccurrenceReview.tsx`
- **Purpose:** مراجعة مواضع القاعدة العامة في المصحف.
- **Behavior:** يعرض المطابقات ويسمح بمراجعة موضعية وتسجيل تجاوزات محلية.
- **Constraints:** الموضع المستثنى أو المعدل لا يغير القاعدة الأم.
- **Status:** `active`
- **Dependencies:** `A327`
- **Related UI IDs:** `A140`, `A144`
- **Code references (not UI IDs):** `useRuleOccurrences`, `occurrenceOverrides`

</details>

<details>
<summary><strong>A142 — Global Rule Builder Dialog</strong></summary>

- **Type:** `dialog`
- **Feature:** A001 — Editor
- **Parent:** A114
- **Route:** `/editor`
- **Component:** `GlobalRuleBuilder`
- **Source:** `src/components/editor/GlobalRuleBuilder.tsx`
- **Purpose:** إنشاء قاعدة عامة نمطية أو نحوية.
- **Behavior:** يبني قاعدة معاينة ثم يحفظها في مخزن القواعد العامة عبر المسار الحالي.
- **Constraints:** لا تنشئ نسخا مشتقة داخل مستندات الآيات؛ المعاينة لا تطبق التغيير.
- **Status:** `active`
- **Dependencies:** `A327`
- **Related UI IDs:** `A114`, `A140`
- **Code references (not UI IDs):** `saveGlobalRule`, `findGlobalRuleMatches`

</details>

<details>
<summary><strong>A143 — Global Rule Metadata Editor</strong></summary>

- **Type:** `dialog`
- **Feature:** A001 — Editor
- **Parent:** A140
- **Route:** `/editor`
- **Component:** `GlobalRuleMetaEditor`
- **Source:** `src/components/editor/GlobalRuleMetaEditor.tsx`
- **Purpose:** تعديل بيانات القاعدة العامة ونطاقها ودرجاتها.
- **Behavior:** يحفظ تعديل قاعدة محددة مع حماية التجاوزات المحلية.
- **Constraints:** لا يبدل هوية القاعدة لمجرد تغيير عنوانها أو حقولها.
- **Status:** `active`
- **Dependencies:** `A327`
- **Related UI IDs:** `A140`, `A141`
- **Code references (not UI IDs):** `saveGlobalRule`, `pruneStrengthMap`

</details>

<details>
<summary><strong>A144 — Local Override Editor</strong></summary>

- **Type:** `dialog`
- **Feature:** A001 — Editor
- **Parent:** A141
- **Route:** `/editor`
- **Component:** `LocalOverrideEditor`
- **Source:** `src/components/editor/LocalOverrideEditor.tsx`
- **Purpose:** تحرير استثناء أو تجاوز محلي لموضع قاعدة عامة.
- **Behavior:** يحفظ override للموضع وحده.
- **Constraints:** يظل global rule قائما ولا تتسرب الحقول المحلية إلى المواضع الأخرى.
- **Status:** `active`
- **Dependencies:** `A327`
- **Related UI IDs:** `A141`, `A143`
- **Code references (not UI IDs):** `localOverride`, `rule-occurrences-store`

</details>

<details>
<summary><strong>A145 — Quick Create Template Controls</strong></summary>

- **Type:** `control`
- **Feature:** A001 — Editor
- **Parent:** A114
- **Route:** `/editor`
- **Component:** `VariantsPanel`
- **Source:** `src/components/editor/VariantsPanel.tsx`
- **Purpose:** مجموعة القوالب الجاهزة/المحفوظة للإنشاء السريع.
- **Behavior:** تمرر إعداد القالب إلى مسار smart-create الحالي.
- **Constraints:** القالب لا يغير قواعد الإنشاء أو عدد عمليات التراجع.
- **Status:** `active`
- **Dependencies:** `A421`
- **Related UI IDs:** `A116`
- **Code references (not UI IDs):** `QUICK_CREATE_TEMPLATES`, `handleQuickCreate`

</details>

<details>
<summary><strong>A421 — Smart Create Wizard Dialog</strong></summary>

- **Type:** `dialog`
- **Feature:** A001 — Editor
- **Parent:** A114
- **Route:** `/editor`
- **Component:** `SmartCreateWizard`
- **Source:** `src/components/editor/SmartCreateWizard.tsx`
- **Purpose:** معالج إنشاء موحد متعدد الخطوات للاختلافات والأوجه والنطاق والعلاقات والتعميم.
- **Behavior:** يبني دفعة ذرية من مدخلات المستخدم ثم يطبقها عبر مسار المخزن القائم.
- **Constraints:** لا تغير منطق smart-create أو نموذج البيانات في طلب يخص واجهة المعالج فقط؛ كل علاقة/تعميم يحتاج مساره الصريح.
- **Status:** `active`
- **Dependencies:** `A116`, `A145`
- **Related UI IDs:** `A111`, `A114`, `A142`
- **Code references (not UI IDs):** `buildSmartCreateBatch`, `buildSmartCreateMultiTargetBatch`, `applySmartCreateBatch`

</details>

<details>
<summary><strong>A150 — Engine Studio Workspace</strong></summary>

- **Type:** `shell`
- **Feature:** A002 — Engine Studio
- **Parent:** A021
- **Route:** `/studio`
- **Component:** `EngineStudioPage`
- **Source:** `src/app/(dashboard)/studio/page.tsx`
- **Purpose:** مساحة أقسام إعداد سياسات المحرك.
- **Behavior:** تبدل اللوحة النشطة داخل الاستوديو مع الاحتفاظ بحالة الملف.
- **Constraints:** لا يعدل المحرك قبل الإجراء الصريح المناسب.
- **Status:** `active`
- **Dependencies:** `A155`
- **Related UI IDs:** `A151`, `A158`, `A163`, `A169`
- **Code references (not UI IDs):** `useEngineStudioStore`

</details>

<details>
<summary><strong>A151 — Engine Studio Header</strong></summary>

- **Type:** `section`
- **Feature:** A002 — Engine Studio
- **Parent:** A150
- **Route:** `/studio`
- **Component:** `EngineStudioPage`
- **Source:** `src/app/(dashboard)/studio/page.tsx`
- **Purpose:** عنوان الملف ومؤشر التعديلات وأوامر إعادة الضبط/المراجعة/الحفظ.
- **Behavior:** يعرض حالة الملف ويشغل الأوامر العامة للاستوديو.
- **Constraints:** الحفظ مشروط بـ dirty؛ إعادة الضبط تمر عبر التأكيد الحالي.
- **Status:** `active`
- **Dependencies:** `A152`, `A153`, `A154`
- **Related UI IDs:** `A169`
- **Code references (not UI IDs):** `dirty`, `persist`, `resetToDefault`

</details>

<details>
<summary><strong>A152 — Reset Engine Configuration Button</strong></summary>

- **Type:** `button`
- **Feature:** A002 — Engine Studio
- **Parent:** A151
- **Route:** `/studio`
- **Component:** `EngineStudioPage`
- **Source:** `src/app/(dashboard)/studio/page.tsx`
- **Purpose:** يعيد إعداد المحرك إلى سياسات النظام الافتراضية.
- **Behavior:** يعرض تأكيدا كميا ثم يستدعي resetToDefault.
- **Constraints:** لا ينفذ إعادة الضبط قبل موافقة المستخدم.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A154`, `A327`
- **Code references (not UI IDs):** `resetToDefault`, `confirmAction`

</details>

<details>
<summary><strong>A153 — Review Before Publish Button</strong></summary>

- **Type:** `button`
- **Feature:** A002 — Engine Studio
- **Parent:** A151
- **Route:** `/studio`
- **Component:** `EngineStudioPage`
- **Source:** `src/app/(dashboard)/studio/page.tsx`
- **Purpose:** يفتح بوابة مراجعة النشر عند وجود تغييرات.
- **Behavior:** ينقل إلى قسم النشر والسجل.
- **Constraints:** لا ينشر أو يحفظ بمفرده.
- **Status:** `active`
- **Dependencies:** `A169`
- **Related UI IDs:** `A154`
- **Code references (not UI IDs):** `setSection("publish")`

</details>

<details>
<summary><strong>A154 — Save Engine Configuration Button</strong></summary>

- **Type:** `button`
- **Feature:** A002 — Engine Studio
- **Parent:** A151
- **Route:** `/studio`
- **Component:** `EngineStudioPage`
- **Source:** `src/app/(dashboard)/studio/page.tsx`
- **Purpose:** يحفظ إعداد المحرك الحالي.
- **Behavior:** يستدعي persist عند وجود تغييرات غير محفوظة.
- **Constraints:** لا تغير شكل ملف التصدير أو سياسة resolver من تعديل واجهة الزر.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A151`, `A169`
- **Code references (not UI IDs):** `persist`, `engine-config-store`

</details>

<details>
<summary><strong>A155 — Engine Studio Sections Navigation</strong></summary>

- **Type:** `navigation`
- **Feature:** A002 — Engine Studio
- **Parent:** A150
- **Route:** `/studio`
- **Component:** `EngineStudioPage`
- **Source:** `src/app/(dashboard)/studio/page.tsx`
- **Purpose:** قائمة أقسام الاستوديو الاثني عشر.
- **Behavior:** تحدد لوحة العمل الحالية وتدعم deep links المدعومة.
- **Constraints:** معرفات الأقسام الداخلية ليست UI IDs ولا تتغير هوية القسم بسبب إعادة ترتيب عرضه.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A156`, `A157`, `A158`, `A163`, `A164`, `A165`, `A166`, `A167`, `A168`, `A169`, `A170`, `A171`
- **Code references (not UI IDs):** `SECTIONS`, `readDeepLink`

</details>

<details>
<summary><strong>A156 — Engine Studio Dashboard</strong></summary>

- **Type:** `panel`
- **Feature:** A002 — Engine Studio
- **Parent:** A150
- **Route:** `/studio`
- **Component:** `Dashboard`
- **Source:** `src/components/studio/Dashboard.tsx`
- **Purpose:** لوحة ملخص إعداد المحرك وحالة التدقيق.
- **Behavior:** تعرض أعداد القواعد ومشكلات الفحص للقراءة.
- **Constraints:** لا تحفظ أو تعدل ملف المحرك.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A155`
- **Code references (not UI IDs):** `auditProfile`

</details>

<details>
<summary><strong>A157 — Recitation Rule Catalog Panel</strong></summary>

- **Type:** `panel`
- **Feature:** A002 — Engine Studio
- **Parent:** A150
- **Route:** `/studio`
- **Component:** `RecitationRuleCatalogPanel`
- **Source:** `src/components/studio/RecitationRuleCatalogPanel.tsx`
- **Purpose:** مكتبة قواعد قرائية/معجمية قابلة للإدارة.
- **Behavior:** تعرض القواعد والمرشحات ونماذج التحرير.
- **Constraints:** بيانات المكتبة لا تعني تفعيل قاعدة قرار إلا عبر المسار الموثق.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A155`
- **Code references (not UI IDs):** `recitation-rule-catalog.ts`

</details>

<details>
<summary><strong>A158 — Engine Rule Explorer</strong></summary>

- **Type:** `panel`
- **Feature:** A002 — Engine Studio
- **Parent:** A150
- **Route:** `/studio`
- **Component:** `RuleExplorer`
- **Source:** `src/components/studio/RuleExplorer.tsx`
- **Purpose:** قائمة استكشاف قواعد المحرك مع مرشحات.
- **Behavior:** تبحث وتصفّي وترتب القواعد وتحدد القاعدة المطلوب تحريرها.
- **Constraints:** المرشحات تغيّر العرض فقط ولا تحذف قواعد.
- **Status:** `active`
- **Dependencies:** `A159`, `A160`
- **Related UI IDs:** `A161`, `A162`
- **Code references (not UI IDs):** `onSelect`, `onCreate`

</details>

<details>
<summary><strong>A159 — Engine Rule Search Input</strong></summary>

- **Type:** `input`
- **Feature:** A002 — Engine Studio
- **Parent:** A158
- **Route:** `/studio`
- **Component:** `RuleExplorer`
- **Source:** `src/components/studio/RuleExplorer.tsx`
- **Purpose:** حقل بحث قواعد المحرك.
- **Behavior:** يصفّي القائمة بالاسم أو محتوى القاعدة.
- **Constraints:** البحث لا يغير ملف المحرك.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A158`
- **Code references (not UI IDs):** `query`, `setQuery`

</details>

<details>
<summary><strong>A160 — Create Engine Rule Button</strong></summary>

- **Type:** `button`
- **Feature:** A002 — Engine Studio
- **Parent:** A158
- **Route:** `/studio`
- **Component:** `RuleExplorer`
- **Source:** `src/components/studio/RuleExplorer.tsx`
- **Purpose:** يبدأ مسودة قاعدة محرك جديدة.
- **Behavior:** ينقل الصفحة إلى وضع منشئ قاعدة فارغ.
- **Constraints:** لا يضيف القاعدة إلى الإعداد قبل الحفظ الصريح.
- **Status:** `active`
- **Dependencies:** `A161`
- **Related UI IDs:** `A158`
- **Code references (not UI IDs):** `onCreate`, `setCreatingNew`

</details>

<details>
<summary><strong>A161 — Engine Rule Builder Form</strong></summary>

- **Type:** `form`
- **Feature:** A002 — Engine Studio
- **Parent:** A150
- **Route:** `/studio`
- **Component:** `RuleBuilder`
- **Source:** `src/components/studio/RuleBuilder.tsx`
- **Purpose:** نموذج إنشاء أو تحرير قاعدة محرك.
- **Behavior:** يتحقق من الحقول ويسلم القاعدة إلى onSave أو يلغي المسودة.
- **Constraints:** الشروط والإجراءات والسياسة لا تتغير بمجرد إعادة ترتيب عناصر النموذج.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A158`, `A160`
- **Code references (not UI IDs):** `onSave`, `EngineRule`

</details>

<details>
<summary><strong>A162 — Selected Engine Rule Actions</strong></summary>

- **Type:** `panel`
- **Feature:** A002 — Engine Studio
- **Parent:** A150
- **Route:** `/studio`
- **Component:** `SelectedRuleActions`
- **Source:** `src/app/(dashboard)/studio/page.tsx`
- **Purpose:** إجراءات سريعة على القاعدة المحددة: أولوية، حالة، حذف.
- **Behavior:** يستدعي عمليات store المرتبطة بالقاعدة المحددة.
- **Constraints:** الحذف يظل مؤكدا ويأخذ الاعتماديات الحالية في الحسبان.
- **Status:** `active`
- **Dependencies:** `A327`
- **Related UI IDs:** `A158`, `A161`
- **Code references (not UI IDs):** `setRulePriorityAction`, `setRuleStatusAction`, `removeRule`

</details>

<details>
<summary><strong>A163 — Merge Matrix Panel</strong></summary>

- **Type:** `panel`
- **Feature:** A002 — Engine Studio
- **Parent:** A150
- **Route:** `/studio`
- **Component:** `MergeMatrixPanel`
- **Source:** `src/components/studio/MergeMatrixPanel.tsx`
- **Purpose:** مصفوفة قواعد الدمج والعلاقات بين الأنواع.
- **Behavior:** تتيح إضافة/تعديل/حذف سياسات الدمج والعلاقة.
- **Constraints:** القرار الفعلي يظل عبر Decision Resolver الموحد.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A164`, `A165`
- **Code references (not UI IDs):** `onAdd`, `onUpdate`, `onRemove`

</details>

<details>
<summary><strong>A164 — Priority Pipeline Panel</strong></summary>

- **Type:** `panel`
- **Feature:** A002 — Engine Studio
- **Parent:** A150
- **Route:** `/studio`
- **Component:** `PriorityPipeline`
- **Source:** `src/components/studio/PriorityPipeline.tsx`
- **Purpose:** ترتيب مراحل التنفيذ ومجموعات الأولوية.
- **Behavior:** يدير ترتيب مراحل التنفيذ وسياسة حل التعارض والأولويات.
- **Constraints:** تغيير ترتيب التنفيذ يمر بتقدير أثر وتأكيد.
- **Status:** `active`
- **Dependencies:** `A327`
- **Related UI IDs:** `A162`, `A165`
- **Code references (not UI IDs):** `executionOrderImpact`, `handleExecutionOrderChange`

</details>

<details>
<summary><strong>A165 — Why and Decision Trace Playground</strong></summary>

- **Type:** `panel`
- **Feature:** A002 — Engine Studio
- **Parent:** A150
- **Route:** `/studio`
- **Component:** `WhyTracePlayground`
- **Source:** `src/components/studio/WhyTracePlayground.tsx`
- **Purpose:** محاكاة تفسير قرار الدمج وأثر القواعد.
- **Behavior:** يعرض القرار والـ trace لمدخلات تجريبية.
- **Constraints:** المحاكاة لا تحفظ ملف المحرك.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A163`, `A164`
- **Code references (not UI IDs):** `resolveDifference`, `trace`

</details>

<details>
<summary><strong>A166 — Engine Rule Tests Panel</strong></summary>

- **Type:** `panel`
- **Feature:** A002 — Engine Studio
- **Parent:** A150
- **Route:** `/studio`
- **Component:** `RuleTestsPanel`
- **Source:** `src/components/studio/RuleTestsPanel.tsx`
- **Purpose:** تشغيل وعرض اختبارات قواعد ملف المحرك.
- **Behavior:** يشغل runProfileTests على الإعداد المعروض.
- **Constraints:** نتائج الاختبار تشخيصية ولا تعدل الإعداد.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A164`, `A168`
- **Code references (not UI IDs):** `runProfileTests`

</details>

<details>
<summary><strong>A167 — Candidate Rules Panel</strong></summary>

- **Type:** `panel`
- **Feature:** A002 — Engine Studio
- **Parent:** A150
- **Route:** `/studio`
- **Component:** `CandidateRulesPanel`
- **Source:** `src/components/studio/CandidateRulesPanel.tsx`
- **Purpose:** اقتراح قاعدة مرشحة من تصحيح موثق.
- **Behavior:** ينشئ draft candidate ويتيح تبنيها صراحة.
- **Constraints:** لا تتحول القاعدة إلى فاعلة تلقائيا.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A161`, `A168`
- **Code references (not UI IDs):** `proposeCandidateRule`, `onAdopt`

</details>

<details>
<summary><strong>A168 — Engine Profile Compare Panel</strong></summary>

- **Type:** `panel`
- **Feature:** A002 — Engine Studio
- **Parent:** A150
- **Route:** `/studio`
- **Component:** `ProfileComparePanel`
- **Source:** `src/components/studio/ProfileComparePanel.tsx`
- **Purpose:** مقارنة الملف الحالي بملف النظام الافتراضي.
- **Behavior:** يعرض الفروقات والتصنيف وسلامة الاعتماد.
- **Constraints:** لا يعدل الملفات ولا يقرر اعتمادا تلقائيا.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A166`, `A169`
- **Code references (not UI IDs):** `compareProfiles`, `isSafeToAdopt`

</details>

<details>
<summary><strong>A169 — Publish Gate and Engine History Panel</strong></summary>

- **Type:** `panel`
- **Feature:** A002 — Engine Studio
- **Parent:** A150
- **Route:** `/studio`
- **Component:** `PublishHistoryPanel`
- **Source:** `src/components/studio/PublishHistoryPanel.tsx`
- **Purpose:** بوابة مراجعة التغييرات والسجل والاسترجاع.
- **Behavior:** يعرض dry-run ونسخ الإعداد ويسمح بالنشر/الإلغاء/الاسترجاع المؤكد.
- **Constraints:** الاسترجاع لا يتم دون تأكيد واضح؛ يحافظ على سجل الإصدارات.
- **Status:** `active`
- **Dependencies:** `A327`
- **Related UI IDs:** `A153`, `A154`, `A168`
- **Code references (not UI IDs):** `diffEngineConfigs`, `onPublish`, `onRollback`

</details>

<details>
<summary><strong>A170 — Engine Export Import Panel</strong></summary>

- **Type:** `panel`
- **Feature:** A002 — Engine Studio
- **Parent:** A150
- **Route:** `/studio`
- **Component:** `ExportImportPanel`
- **Source:** `src/components/studio/ExportImportPanel.tsx`
- **Purpose:** تصدير واستيراد ملف إعداد المحرك مع معاينة التحقق.
- **Behavior:** ينشئ JSON حتميا ويعاين الاستيراد قبل التطبيق.
- **Constraints:** لا تطبق الاستيراد قبل المعاينة الصالحة والإجراء الصريح.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A154`, `A169`
- **Code references (not UI IDs):** `onExport`, `onPreviewImport`, `onImport`

</details>

<details>
<summary><strong>A171 — Engine Behavior Settings Panel</strong></summary>

- **Type:** `panel`
- **Feature:** A002 — Engine Studio
- **Parent:** A150
- **Route:** `/studio`
- **Component:** `EngineSettingsPanel`
- **Source:** `src/components/studio/EngineSettingsPanel.tsx`
- **Purpose:** خيارات العرض والترتيب لتكوين محرك التشجير.
- **Behavior:** يعدل إعداداته محليا ويحفظها بإجراء صريح.
- **Constraints:** هو مصدر إعدادات العرض المعتمد؛ لا تنشئ نسخة ثانية في admin.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A154`
- **Code references (not UI IDs):** `saveEngineSettings`, `resetEngineSettings`

</details>

<details>
<summary><strong>A180 — Surah Search Input</strong></summary>

- **Type:** `input`
- **Feature:** A003 — Quran View
- **Parent:** A022
- **Route:** `/quran`
- **Component:** `QuranPage`
- **Source:** `src/app/(dashboard)/quran/page.tsx`
- **Purpose:** بحث في أسماء السور.
- **Behavior:** يصفّي فهرس السور دون تغيير السورة الحالية حتى الاختيار.
- **Constraints:** لا يغير نص المصحف أو بياناته.
- **Status:** `active`
- **Dependencies:** `A181`
- **Related UI IDs:** `A181`
- **Code references (not UI IDs):** `searchSurahs`, `query`

</details>

<details>
<summary><strong>A181 — Surah Navigation List</strong></summary>

- **Type:** `list`
- **Feature:** A003 — Quran View
- **Parent:** A022
- **Route:** `/quran`
- **Component:** `QuranPage`
- **Source:** `src/app/(dashboard)/quran/page.tsx`
- **Purpose:** قائمة اختيار السورة.
- **Behavior:** تحدد السورة النشطة وتحدث محتوى منطقة القراءة.
- **Constraints:** تسلسل القائمة لا يمثل ID للسورة؛ معرفات البيانات هي المصدر.
- **Status:** `active`
- **Dependencies:** `A180`
- **Related UI IDs:** `A182`
- **Code references (not UI IDs):** `setSurahNumber`, `SURAHS`

</details>

<details>
<summary><strong>A182 — Current Surah Reader</strong></summary>

- **Type:** `section`
- **Feature:** A003 — Quran View
- **Parent:** A022
- **Route:** `/quran`
- **Component:** `QuranPage`
- **Source:** `src/app/(dashboard)/quran/page.tsx`
- **Purpose:** قسم نص السورة الحالية وآياتها.
- **Behavior:** يرسم الآيات وربط التشجير المحفوظ/المشتق.
- **Constraints:** النص للقراءة؛ لا تعدل محتوى المصحف من هذا السطح.
- **Status:** `active`
- **Dependencies:** `A183`, `A184`, `A187`
- **Related UI IDs:** `A181`
- **Code references (not UI IDs):** `getSurahAyahs`, `AyahTashjeerView`

</details>

<details>
<summary><strong>A183 — Toggle Saved Tashjeer Visibility</strong></summary>

- **Type:** `button`
- **Feature:** A003 — Quran View
- **Parent:** A182
- **Route:** `/quran`
- **Component:** `QuranPage`
- **Source:** `src/app/(dashboard)/quran/page.tsx`
- **Purpose:** زر عرض/إخفاء التشجير أسفل الآيات.
- **Behavior:** يبدل showTashjeer في واجهة المصحف.
- **Constraints:** يغير الرؤية فقط ولا يحذف التشجير المحفوظ.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A187`
- **Code references (not UI IDs):** `setShowTashjeer`

</details>

<details>
<summary><strong>A184 — Quran Ayah Row</strong></summary>

- **Type:** `list-item`
- **Feature:** A003 — Quran View
- **Parent:** A182
- **Route:** `/quran`
- **Component:** `QuranPage`
- **Source:** `src/app/(dashboard)/quran/page.tsx`
- **Purpose:** عنصر الآية في قائمة السورة.
- **Behavior:** يعرض نص الآية ورقمها وروابط أدواتها وبطاقة التشجير عند وجودها.
- **Constraints:** نسخة قائمة ديناميكية؛ الآية تميزها ayahKey لا index العرض.
- **Status:** `active`
- **Dependencies:** `A185`, `A186`, `A187`
- **Related UI IDs:** `A182`
- **Code references (not UI IDs):** `ayah.key`, `getSurahAyahs`

</details>

<details>
<summary><strong>A185 — Open Quran Ayah in Editor Link</strong></summary>

- **Type:** `navigation`
- **Feature:** A003 — Quran View
- **Parent:** A184
- **Route:** `/quran`
- **Component:** `QuranPage`
- **Source:** `src/app/(dashboard)/quran/page.tsx`
- **Purpose:** رابط نقل الآية المحددة إلى محرر التشجير.
- **Behavior:** يفتح /editor مع ayahKey للآية.
- **Constraints:** لا يفتح آية افتراضية مختلفة ولا يغير المستند من قارئ المصحف.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A020`, `A184`
- **Code references (not UI IDs):** `href=/editor?ayah=`

</details>

<details>
<summary><strong>A186 — Export Quran Ayah JSON Button</strong></summary>

- **Type:** `button`
- **Feature:** A003 — Quran View
- **Parent:** A184
- **Route:** `/quran`
- **Component:** `QuranPage`
- **Source:** `src/app/(dashboard)/quran/page.tsx`
- **Purpose:** تصدير ملف JSON للمستند المرتبط بالآية.
- **Behavior:** ينزل الملف الناتج عن exportAyahDocument.
- **Constraints:** التصدير لا يحفظ أو يعدل بيانات الآية.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A184`
- **Code references (not UI IDs):** `exportAyahJson`, `exportAyahDocument`

</details>

<details>
<summary><strong>A187 — Saved Ayah Tashjeer Card</strong></summary>

- **Type:** `card`
- **Feature:** A003 — Quran View
- **Parent:** A184
- **Route:** `/quran`
- **Component:** `AyahTashjeerView`
- **Source:** `src/components/quran/AyahTashjeerView.tsx`
- **Purpose:** بطاقة تشجير الآية المحفوظ أو المشتق من قاعدة عامة.
- **Behavior:** تعرض الحالة والخطوط والبيانات الوصفية وروابط الإجراءات.
- **Constraints:** تعتمد على نفس hook والمحرك المستخدمين في المحرر؛ لا تنشئ مستندا محفوظا للعرض المشتق.
- **Status:** `active`
- **Dependencies:** `A188`, `A189`
- **Related UI IDs:** `A111`, `A022`
- **Code references (not UI IDs):** `resolveAyahDocument`, `useAyahTashjeer`, `TashjeerFigure`

</details>

<details>
<summary><strong>A188 — Toggle Ayah Tashjeer Card Button</strong></summary>

- **Type:** `button`
- **Feature:** A003 — Quran View
- **Parent:** A187
- **Route:** `/quran`
- **Component:** `AyahTashjeerView`
- **Source:** `src/components/quran/AyahTashjeerView.tsx`
- **Purpose:** طي أو إظهار رسم التشجير داخل البطاقة.
- **Behavior:** يبدل open داخل البطاقة.
- **Constraints:** لا يحذف المستند أو يغير إعداداته.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A187`
- **Code references (not UI IDs):** `setOpen`

</details>

<details>
<summary><strong>A189 — Open Tashjeer Card in Editor Link</strong></summary>

- **Type:** `navigation`
- **Feature:** A003 — Quran View
- **Parent:** A187
- **Route:** `/quran`
- **Component:** `AyahTashjeerView`
- **Source:** `src/components/quran/AyahTashjeerView.tsx`
- **Purpose:** يفتح الآية الحالية مباشرة في المحرر.
- **Behavior:** ينقل إلى /editor?ayah=<ayahKey>.
- **Constraints:** تنقل فقط؛ لا يغير حالة المستند.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A020`, `A187`
- **Code references (not UI IDs):** `href=/editor?ayahKey`

</details>

<details>
<summary><strong>A200 — Tracking Category Filters</strong></summary>

- **Type:** `filter`
- **Feature:** A004 — Tracking
- **Parent:** A023
- **Route:** `/tracking`
- **Component:** `TrackingPage`
- **Source:** `src/app/(dashboard)/tracking/page.tsx`
- **Purpose:** مرشحات فئة الاختلاف.
- **Behavior:** تختار فئة واحدة أو الكل وتعيد حساب الصفوف الظاهرة.
- **Constraints:** تصفية عرض فقط؛ لا تحفظ أو تحذف سجلات.
- **Status:** `active`
- **Dependencies:** `A203`
- **Related UI IDs:** `A201`
- **Code references (not UI IDs):** `setCategory`, `categoriesWithData`

</details>

<details>
<summary><strong>A201 — Tracking Source Filters</strong></summary>

- **Type:** `filter`
- **Feature:** A004 — Tracking
- **Parent:** A023
- **Route:** `/tracking`
- **Component:** `TrackingPage`
- **Source:** `src/app/(dashboard)/tracking/page.tsx`
- **Purpose:** مرشحات المصدر: الكل، المحرك، المحرر، المعدل يدويا.
- **Behavior:** تختار مصدر الصفوف الظاهرة.
- **Constraints:** لا تغير قيم المصدر المسجلة.
- **Status:** `active`
- **Dependencies:** `A203`
- **Related UI IDs:** `A200`
- **Code references (not UI IDs):** `SOURCE_FILTERS`, `setSource`

</details>

<details>
<summary><strong>A202 — Tracking Summary Cards</strong></summary>

- **Type:** `panel`
- **Feature:** A004 — Tracking
- **Parent:** A023
- **Route:** `/tracking`
- **Component:** `TrackingPage`
- **Source:** `src/app/(dashboard)/tracking/page.tsx`
- **Purpose:** بطاقات أعداد المواضع حسب المصدر والتعديل.
- **Behavior:** تعرض trackingSummary من الصفوف المحسوبة.
- **Constraints:** معلومات مشتقة؛ ليست controls لتعديل البيانات.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A203`
- **Code references (not UI IDs):** `trackingSummary`, `SummaryCard`

</details>

<details>
<summary><strong>A203 — Tracking Results List</strong></summary>

- **Type:** `list`
- **Feature:** A004 — Tracking
- **Parent:** A023
- **Route:** `/tracking`
- **Component:** `TrackingPage`
- **Source:** `src/app/(dashboard)/tracking/page.tsx`
- **Purpose:** قائمة عناصر تتبع الاختلافات.
- **Behavior:** تعرض الصفوف المطابقة للفئة والمصدر المختارين.
- **Constraints:** هوية الصف مشتقة من row.id وليس ترتيب القائمة.
- **Status:** `active`
- **Dependencies:** `A204`
- **Related UI IDs:** `A200`, `A201`
- **Code references (not UI IDs):** `visible`, `TrackingRowCard`

</details>

<details>
<summary><strong>A204 — Tracking Result Card</strong></summary>

- **Type:** `list-item`
- **Feature:** A004 — Tracking
- **Parent:** A203
- **Route:** `/tracking`
- **Component:** `TrackingRowCard`
- **Source:** `src/app/(dashboard)/tracking/page.tsx`
- **Purpose:** بطاقة موضع تتبع مع حالة المصدر والفروق وسجل التعديل.
- **Behavior:** تفتح التفاصيل أو الانتقال إلى المحرر.
- **Constraints:** بطاقات متعددة؛ استخدم row.id كـ data-ui-instance عند التعامل مع سجل بعينه.
- **Status:** `active`
- **Dependencies:** `A205`, `A206`, `A207`, `A208`
- **Related UI IDs:** `A023`
- **Code references (not UI IDs):** `TrackingRow`, `row.id`

</details>

<details>
<summary><strong>A205 — Toggle Tracking Difference Details</strong></summary>

- **Type:** `button`
- **Feature:** A004 — Tracking
- **Parent:** A204
- **Route:** `/tracking`
- **Component:** `TrackingRowCard`
- **Source:** `src/app/(dashboard)/tracking/page.tsx`
- **Purpose:** توسيع أو طي سجل الفروق والتصحيح.
- **Behavior:** يبدل حالة البطاقة الموسعة.
- **Constraints:** عرض التفاصيل لا يكتب تغييرا على السجل.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A204`
- **Code references (not UI IDs):** `onToggle`, `expanded`

</details>

<details>
<summary><strong>A206 — Toggle Decision Trace Details</strong></summary>

- **Type:** `button`
- **Feature:** A004 — Tracking
- **Parent:** A204
- **Route:** `/tracking`
- **Component:** `RowDecisionTrace`
- **Source:** `src/app/(dashboard)/tracking/page.tsx`
- **Purpose:** إظهار/إخفاء أثر قرار المحرك للصف.
- **Behavior:** يعرض trace من resolver على الإعداد الحالي.
- **Constraints:** إعادة الحساب للشرح فقط؛ لا تغير السياسة أو الإعداد.
- **Status:** `active`
- **Dependencies:** `A021`
- **Related UI IDs:** `A204`
- **Code references (not UI IDs):** `resolveDifference`, `result.trace`

</details>

<details>
<summary><strong>A207 — Propose Rule from Correction Link</strong></summary>

- **Type:** `navigation`
- **Feature:** A004 — Tracking
- **Parent:** A204
- **Route:** `/tracking`
- **Component:** `CorrectionTripletView`
- **Source:** `src/app/(dashboard)/tracking/page.tsx`
- **Purpose:** ينقل التصحيح إلى قسم اقتراح قاعدة في الاستوديو.
- **Behavior:** يبني deep link مع سياق التصحيح الحالي.
- **Constraints:** يظل اقتراحا مسودة؛ لا يعتمد قاعدة تلقائيا.
- **Status:** `active`
- **Dependencies:** `A021`
- **Related UI IDs:** `A204`, `A167`
- **Code references (not UI IDs):** `candidateHref`, `CorrectionTripletView`

</details>

<details>
<summary><strong>A208 — Open Tracking Row in Editor Link</strong></summary>

- **Type:** `navigation`
- **Feature:** A004 — Tracking
- **Parent:** A204
- **Route:** `/tracking`
- **Component:** `TrackingRowCard`
- **Source:** `src/app/(dashboard)/tracking/page.tsx`
- **Purpose:** فتح موضع الصف في محرر الآية.
- **Behavior:** ينقل إلى المحرر مع ayahKey وvariantId للصف.
- **Constraints:** تنقل فقط؛ لا تعدل السجل.
- **Status:** `active`
- **Dependencies:** `A020`
- **Related UI IDs:** `A204`
- **Code references (not UI IDs):** `row.ayahKey`, `row.variantId`

</details>

<details>
<summary><strong>A220 — Variant Index Workspace</strong></summary>

- **Type:** `panel`
- **Feature:** A005 — Variant and Rule Index
- **Parent:** A024
- **Route:** `/variants`
- **Component:** `VariantsIndexPage`
- **Source:** `src/app/(dashboard)/variants/page.tsx`
- **Purpose:** سطح الفهرس والبحث ونتائج الاختلافات والقواعد العامة.
- **Behavior:** يجمع مرشحات القائمة وروابط فتح السجل في المحرر.
- **Constraints:** البحث لا يعدل العناصر.
- **Status:** `active`
- **Dependencies:** `A221`, `A222`
- **Related UI IDs:** `A223`
- **Code references (not UI IDs):** `visible`, `readIndexRows`

</details>

<details>
<summary><strong>A221 — Variant Index Search and Filters</strong></summary>

- **Type:** `filter`
- **Feature:** A005 — Variant and Rule Index
- **Parent:** A220
- **Route:** `/variants`
- **Component:** `VariantsIndexPage`
- **Source:** `src/app/(dashboard)/variants/page.tsx`
- **Purpose:** حقل البحث ومرشحات نوع/حالة الفهرس.
- **Behavior:** تحدد النتائج الظاهرة في الفهرس.
- **Constraints:** تصفية فقط؛ لا تحفظ تغييرا على قاعدة أو اختلاف.
- **Status:** `active`
- **Dependencies:** `A222`
- **Related UI IDs:** `A220`
- **Code references (not UI IDs):** `query`, `setQuery`, `visible`

</details>

<details>
<summary><strong>A222 — Cross-document Variant Results</strong></summary>

- **Type:** `list`
- **Feature:** A005 — Variant and Rule Index
- **Parent:** A220
- **Route:** `/variants`
- **Component:** `VariantsIndexPage`
- **Source:** `src/app/(dashboard)/variants/page.tsx`
- **Purpose:** قائمة الاختلافات والقواعد عبر المستندات.
- **Behavior:** تعرض السجلات وتوفر روابط التحرير والمراجعة.
- **Constraints:** ترتيب الصفوف ليس هوية السجل؛ استخدم مفتاح العنصر الحالي.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A221`, `A223`
- **Code references (not UI IDs):** `visible.map`

</details>

<details>
<summary><strong>A223 — General Rule Editor Dialog</strong></summary>

- **Type:** `dialog`
- **Feature:** A005 — Variant and Rule Index
- **Parent:** A024
- **Route:** `/variants`
- **Component:** `GlobalRuleDialog`
- **Source:** `src/app/(dashboard)/variants/page.tsx`
- **Purpose:** نافذة إنشاء/تحرير قاعدة عامة للمصحف.
- **Behavior:** تحرير حقول القاعدة وحفظها صراحة.
- **Constraints:** تعديل القاعدة الأم لا يلغي الحماية والتجاوزات المحلية.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A220`, `A327`
- **Code references (not UI IDs):** `save`, `GlobalRuleDialog`

</details>

<details>
<summary><strong>A230 — Qiraat Search Input</strong></summary>

- **Type:** `input`
- **Feature:** A006 — Qiraat Catalog
- **Parent:** A025
- **Route:** `/qiraat`
- **Component:** `QiraatPage`
- **Source:** `src/app/(dashboard)/qiraat/page.tsx`
- **Purpose:** بحث في أسماء القراءات أو بيانات قائمتها.
- **Behavior:** يصفّي قائمة القراءات المعروضة.
- **Constraints:** لا يعدل بيانات القراءات.
- **Status:** `active`
- **Dependencies:** `A231`
- **Related UI IDs:** `A231`
- **Code references (not UI IDs):** `search`, `setSearch`

</details>

<details>
<summary><strong>A231 — Qiraat Selection List</strong></summary>

- **Type:** `list`
- **Feature:** A006 — Qiraat Catalog
- **Parent:** A025
- **Route:** `/qiraat`
- **Component:** `QiraatPage`
- **Source:** `src/app/(dashboard)/qiraat/page.tsx`
- **Purpose:** قائمة القراءات للاختيار.
- **Behavior:** تحدد القراءة التي تعرض تفاصيلها.
- **Constraints:** الترتيب العلمي مأخوذ من البيانات المعتمدة.
- **Status:** `active`
- **Dependencies:** `A230`, `A232`
- **Related UI IDs:** `A232`
- **Code references (not UI IDs):** `qiraat data`, `selectedQiraah`

</details>

<details>
<summary><strong>A232 — Selected Qiraat Details</strong></summary>

- **Type:** `panel`
- **Feature:** A006 — Qiraat Catalog
- **Parent:** A025
- **Route:** `/qiraat`
- **Component:** `QiraatPage`
- **Source:** `src/app/(dashboard)/qiraat/page.tsx`
- **Purpose:** بطاقة معلومات القراءة المختارة.
- **Behavior:** تعرض الإمام والرواة وخصائص البيانات الحالية.
- **Constraints:** قراءة فقط؛ لا تخلط بينها وبين إدارة الكتالوج في /admin.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A231`
- **Code references (not UI IDs):** `selectedQiraah`

</details>

<details>
<summary><strong>A240 — Reader Profile Form</strong></summary>

- **Type:** `form`
- **Feature:** A007 — Readers Catalog
- **Parent:** A026
- **Route:** `/readers`
- **Component:** `ReadersPage`
- **Source:** `src/app/(dashboard)/readers/page.tsx`
- **Purpose:** نموذج إدخال أو تعديل ملف قارئ.
- **Behavior:** يتحقق من الحقول ويرسل النموذج وفق الإجراء الحالي.
- **Constraints:** لا تفترض صلاحية API غير موجودة في التنفيذ الحالي.
- **Status:** `active`
- **Dependencies:** `A242`, `A243`
- **Related UI IDs:** `A241`
- **Code references (not UI IDs):** `handleSubmit`

</details>

<details>
<summary><strong>A241 — Readers Catalog List</strong></summary>

- **Type:** `list`
- **Feature:** A007 — Readers Catalog
- **Parent:** A026
- **Route:** `/readers`
- **Component:** `ReadersPage`
- **Source:** `src/app/(dashboard)/readers/page.tsx`
- **Purpose:** قائمة ملفات القراء.
- **Behavior:** تختار سجلا وتعرض إجراءاته الحالية.
- **Constraints:** المعرف من سجل القارئ لا من موضع القائمة.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A240`
- **Code references (not UI IDs):** `readers.map`

</details>

<details>
<summary><strong>A242 — Reader Transmission Selector</strong></summary>

- **Type:** `select`
- **Feature:** A007 — Readers Catalog
- **Parent:** A240
- **Route:** `/readers`
- **Component:** `ReadersPage`
- **Source:** `src/app/(dashboard)/readers/page.tsx`
- **Purpose:** اختيار صلة القراءة/الرواية في النموذج.
- **Behavior:** يحدّث قيمة حقل التصنيف المحدد.
- **Constraints:** القيم تأتي من الكتالوج الحالي.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A240`
- **Code references (not UI IDs):** `setFormData`

</details>

<details>
<summary><strong>A243 — Submit Reader Profile Form</strong></summary>

- **Type:** `button`
- **Feature:** A007 — Readers Catalog
- **Parent:** A240
- **Route:** `/readers`
- **Component:** `ReadersPage`
- **Source:** `src/app/(dashboard)/readers/page.tsx`
- **Purpose:** إرسال نموذج ملف القارئ.
- **Behavior:** ينفذ handleSubmit للتحقق والحفظ وفق الحالة الحالية.
- **Constraints:** لا ترسل أو تحذف بيانات إضافية غير حقول النموذج.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A240`
- **Code references (not UI IDs):** `handleSubmit`

</details>

<details>
<summary><strong>A250 — Scientific Review Workspace</strong></summary>

- **Type:** `shell`
- **Feature:** A008 — Scientific Review
- **Parent:** A027
- **Route:** `/review`
- **Component:** `ReviewPage`
- **Source:** `src/app/(dashboard)/review/page.tsx`
- **Purpose:** واجهة قائمة مراجعة السجلات العلمية.
- **Behavior:** تجمع عناصر المراجعة والفلاتر وأدوات التحديث.
- **Constraints:** تحافظ على مرجع المستند وسياق الآية.
- **Status:** `active`
- **Dependencies:** `A251`, `A252`
- **Related UI IDs:** `A027`
- **Code references (not UI IDs):** `ReviewPage`

</details>

<details>
<summary><strong>A251 — Review Queue Filters</strong></summary>

- **Type:** `filter`
- **Feature:** A008 — Scientific Review
- **Parent:** A250
- **Route:** `/review`
- **Component:** `ReviewPage`
- **Source:** `src/app/(dashboard)/review/page.tsx`
- **Purpose:** مرشحات حالة/بحث قائمة المراجعة.
- **Behavior:** تغيّر عناصر القائمة الظاهرة.
- **Constraints:** تصفية فقط؛ لا تغير status.
- **Status:** `active`
- **Dependencies:** `A252`
- **Related UI IDs:** `A250`
- **Code references (not UI IDs):** `query`, `status`

</details>

<details>
<summary><strong>A252 — Scientific Review Queue</strong></summary>

- **Type:** `list`
- **Feature:** A008 — Scientific Review
- **Parent:** A250
- **Route:** `/review`
- **Component:** `ReviewPage`
- **Source:** `src/app/(dashboard)/review/page.tsx`
- **Purpose:** قائمة السجلات المخصصة للمراجعة.
- **Behavior:** تتيح عرض التفاصيل والتحديث عبر إجراءات المراجعة الحالية.
- **Constraints:** لا تُسقط أو تستبدل حالات المراجعة خارج الإجراء المحدد.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A251`
- **Code references (not UI IDs):** `review items`

</details>

<details>
<summary><strong>A253 — Review Notes Input</strong></summary>

- **Type:** `input`
- **Feature:** A008 — Scientific Review
- **Parent:** A252
- **Route:** `/review`
- **Component:** `ReviewPage`
- **Source:** `src/app/(dashboard)/review/page.tsx`
- **Purpose:** حقل الملاحظات في عنصر المراجعة.
- **Behavior:** يسجل نص المراجعة المرتبط بالعنصر المحدد.
- **Constraints:** النص ملاحظة مراجعة ولا يغير محتوى الوجه القرائي.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A252`
- **Code references (not UI IDs):** `textarea`, `review note`

</details>

<details>
<summary><strong>A254 — Review Status Action</strong></summary>

- **Type:** `action`
- **Feature:** A008 — Scientific Review
- **Parent:** A252
- **Route:** `/review`
- **Component:** `ReviewPage`
- **Source:** `src/app/(dashboard)/review/page.tsx`
- **Purpose:** إجراء تحديث حالة المراجعة.
- **Behavior:** يحدث حالة العنصر وفق أحد الخيارات المتاحة.
- **Constraints:** لا يغير الترتيب أو إعداد المحرك.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A252`
- **Code references (not UI IDs):** `status action`

</details>

<details>
<summary><strong>A260 — Administration Tabs</strong></summary>

- **Type:** `navigation`
- **Feature:** A009 — Transmission Administration
- **Parent:** A028
- **Route:** `/admin`
- **Component:** `AdminPage`
- **Source:** `src/app/(dashboard)/admin/page.tsx`
- **Purpose:** تبويبا كتالوج القراءات وإعدادات المحرك القديمة.
- **Behavior:** يبدل content tab؛ إعداد المحرك يحيل إلى Studio.
- **Constraints:** يحافظ على توافق المسار القديم دون إنشاء مصدر إعداد ثان.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A261`, `A262`, `A021`
- **Code references (not UI IDs):** `TABS`, `setTab`

</details>

<details>
<summary><strong>A261 — Transmission Catalog and Reorder List</strong></summary>

- **Type:** `list`
- **Feature:** A009 — Transmission Administration
- **Parent:** A028
- **Route:** `/admin`
- **Component:** `TransmissionManager`
- **Source:** `src/app/(dashboard)/admin/page.tsx`
- **Purpose:** قائمة الأئمة والرواة والطرق القابلة للترتيب.
- **Behavior:** تعرض التسلسل وتدعم السحب وإجراءات التحرير/الحذف.
- **Constraints:** النقل داخل مجموعة peer فقط؛ لا تغير IDs للقراء أو الرواة أو الطرق.
- **Status:** `active`
- **Dependencies:** `A262`, `A263`, `A327`
- **Related UI IDs:** `A260`
- **Code references (not UI IDs):** `movePeer`, `replacePeers`, `dropOn`

</details>

<details>
<summary><strong>A262 — Transmission Catalog Editor Form</strong></summary>

- **Type:** `form`
- **Feature:** A009 — Transmission Administration
- **Parent:** A028
- **Route:** `/admin`
- **Component:** `TransmissionEditor`
- **Source:** `src/app/(dashboard)/admin/page.tsx`
- **Purpose:** نموذج إنشاء/تعديل إمام أو راوٍ أو طريق.
- **Behavior:** يحفظ الكيان المحدد ضمن الكتالوج المحلي.
- **Constraints:** الحذف المتسلسل يظل مؤكدا ويعرض عدد الكيانات التابعة.
- **Status:** `active`
- **Dependencies:** `A327`
- **Related UI IDs:** `A261`
- **Code references (not UI IDs):** `onSubmit`, `saveTransmissionCatalog`

</details>

<details>
<summary><strong>A263 — Transmission Reorder Control</strong></summary>

- **Type:** `drag-handle`
- **Feature:** A009 — Transmission Administration
- **Parent:** A261
- **Route:** `/admin`
- **Component:** `TransmissionManager`
- **Source:** `src/app/(dashboard)/admin/page.tsx`
- **Purpose:** سطح السحب لإعادة ترتيب الإمام أو الراوي أو الطريق.
- **Behavior:** ينقل peer ضمن مجموعته ويعيد ترتيبه صراحة.
- **Constraints:** لا يغير هوية السجل أو العلاقات الهرمية.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A261`
- **Code references (not UI IDs):** `dragProps`, `dropOn`, `movePeer`

</details>

<details>
<summary><strong>A270 — Settings Workspace</strong></summary>

- **Type:** `panel`
- **Feature:** A010 — Settings
- **Parent:** A029
- **Route:** `/settings`
- **Component:** `SettingsPage`
- **Source:** `src/app/(dashboard)/settings/page.tsx`
- **Purpose:** محتوى خيارات مساحة العمل.
- **Behavior:** يعرض إعدادات المستخدم الحالي ومكونات الإدارة.
- **Constraints:** تغيير القسم لا ينشئ طبقة إعداد جديدة.
- **Status:** `active`
- **Dependencies:** `A271`
- **Related UI IDs:** `A029`
- **Code references (not UI IDs):** `SettingsPage`

</details>

<details>
<summary><strong>A271 — Strength Degrees Manager</strong></summary>

- **Type:** `panel`
- **Feature:** A010 — Settings
- **Parent:** A270
- **Route:** `/settings`
- **Component:** `StrengthDegreesManager`
- **Source:** `src/components/settings/StrengthDegreesManager.tsx`
- **Purpose:** قائمة درجات قوة الوجه وإدارتها.
- **Behavior:** تضيف/تعدل/تعيد ترتيب/تحذف درجات من الكتالوج الحالي.
- **Constraints:** حافظ على معرفات الدرجات المستخدمة في المستندات.
- **Status:** `active`
- **Dependencies:** `A327`
- **Related UI IDs:** `A270`
- **Code references (not UI IDs):** `useStrengthDegrees`, `strength-degrees`

</details>

<details>
<summary><strong>A272 — Reset Settings Action</strong></summary>

- **Type:** `action`
- **Feature:** A010 — Settings
- **Parent:** A270
- **Route:** `/settings`
- **Component:** `SettingsPage`
- **Source:** `src/app/(dashboard)/settings/page.tsx`
- **Purpose:** إجراء إعادة الإعدادات إلى الحالة الافتراضية.
- **Behavior:** يمر عبر إجراء الصفحة الحالي ورسالة التأكيد عند الحاجة.
- **Constraints:** لا يحذف مستندات المستخدم أو ملفات المحرك.
- **Status:** `active`
- **Dependencies:** `A327`
- **Related UI IDs:** `A270`
- **Code references (not UI IDs):** `reset`

</details>

<details>
<summary><strong>A280 — Statistics Dashboard</strong></summary>

- **Type:** `panel`
- **Feature:** A011 — Statistics
- **Parent:** A030
- **Route:** `/statistics`
- **Component:** `StatisticsPage`
- **Source:** `src/app/(dashboard)/statistics/page.tsx`
- **Purpose:** ملخص التغطية والثغرات وتوزيع الفئات والرواة والمستندات.
- **Behavior:** يعرض المقاييس المستخرجة وروابط الصفحات ذات الصلة.
- **Constraints:** عرض قراءة فقط؛ لا تستخدم العدادات كمصدر للبيانات.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A030`, `A027`
- **Code references (not UI IDs):** `StatisticsPage`

</details>

<details>
<summary><strong>A290 — Public Landing Content</strong></summary>

- **Type:** `section`
- **Feature:** A012 — Public Landing
- **Parent:** A031
- **Route:** `/`
- **Component:** `HomePage`
- **Source:** `src/app/page.tsx`
- **Purpose:** المحتوى الرئيسي للصفحة العامة ومثال التشجير.
- **Behavior:** يعرض أقسام التسويق وعرضا مبنيا من showcase.
- **Constraints:** لا تغير المثال إلى mock data.
- **Status:** `active`
- **Dependencies:** `A291`
- **Related UI IDs:** `A020`, `A022`
- **Code references (not UI IDs):** `buildShowcase`

</details>

<details>
<summary><strong>A291 — Public Site Navigation</strong></summary>

- **Type:** `navigation`
- **Feature:** A012 — Public Landing
- **Parent:** A031
- **Route:** `/`
- **Component:** `PublicHeader`
- **Source:** `src/components/marketing/PublicHeader.tsx`
- **Purpose:** روابط التنقل الرئيسية في الموقع العام.
- **Behavior:** ينقل إلى الصفحات العامة ومساحات العمل.
- **Constraints:** الروابط وجهات تنقل؛ لا تغير دلالتها عبر تعديل النص فقط.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A020`, `A022`, `A023`
- **Code references (not UI IDs):** `NAV_ITEMS`

</details>

<details>
<summary><strong>A340 — Local Sign-in Surface</strong></summary>

- **Type:** `shell`
- **Feature:** A013 — Local Sign-in
- **Parent:** A032
- **Route:** `/login`
- **Component:** `LoginPage`
- **Source:** `src/app/login/page.tsx`
- **Purpose:** سطح نموذج الدخول المحلي.
- **Behavior:** يحيط بالحقول ورسالة التحقق وروابط العودة.
- **Constraints:** لا يضيف جلسة خادمية أو تدفق مصادقة خارجي.
- **Status:** `active`
- **Dependencies:** `A341`
- **Related UI IDs:** `A020`
- **Code references (not UI IDs):** `handleSubmit`

</details>

<details>
<summary><strong>A341 — Local Sign-in Form</strong></summary>

- **Type:** `form`
- **Feature:** A013 — Local Sign-in
- **Parent:** A340
- **Route:** `/login`
- **Component:** `LoginPage`
- **Source:** `src/app/login/page.tsx`
- **Purpose:** نموذج البريد وكلمة المرور المحلي.
- **Behavior:** يتحقق محليا ثم يحفظ بيانات الجلسة المحلية وينتقل للمحرر.
- **Constraints:** يبقى التنبيه واضحا بأن البيانات لا ترسل لخادم.
- **Status:** `active`
- **Dependencies:** `A342`, `A343`, `A344`
- **Related UI IDs:** `A032`
- **Code references (not UI IDs):** `handleSubmit`, `localStorage`

</details>

<details>
<summary><strong>A342 — Sign-in Email Input</strong></summary>

- **Type:** `input`
- **Feature:** A013 — Local Sign-in
- **Parent:** A341
- **Route:** `/login`
- **Component:** `LoginPage`
- **Source:** `src/app/login/page.tsx`
- **Purpose:** حقل البريد الإلكتروني.
- **Behavior:** يخزن قيمة email في حالة النموذج.
- **Constraints:** لا تحفظ كلمة المرور ضمن الجلسة.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A341`
- **Code references (not UI IDs):** `setEmail`

</details>

<details>
<summary><strong>A343 — Sign-in Password Input</strong></summary>

- **Type:** `input`
- **Feature:** A013 — Local Sign-in
- **Parent:** A341
- **Route:** `/login`
- **Component:** `LoginPage`
- **Source:** `src/app/login/page.tsx`
- **Purpose:** حقل كلمة المرور المحلي.
- **Behavior:** يستخدم للتحقق المحلي من طول الإدخال.
- **Constraints:** لا تُرسل القيمة إلى أي API ولا تحفظها في localStorage.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A341`
- **Code references (not UI IDs):** `setPassword`

</details>

<details>
<summary><strong>A344 — Local Sign-in Submit Button</strong></summary>

- **Type:** `button`
- **Feature:** A013 — Local Sign-in
- **Parent:** A341
- **Route:** `/login`
- **Component:** `LoginPage`
- **Source:** `src/app/login/page.tsx`
- **Purpose:** زر إرسال نموذج الدخول المحلي.
- **Behavior:** يشغل التحقق وحفظ الجلسة في المتصفح.
- **Constraints:** لا يقدم مصادقة خادمية ولا يرسل بيانات اعتماد.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A341`
- **Code references (not UI IDs):** `handleSubmit`, `localStorage.setItem`

</details>

<details>
<summary><strong>A310 — Dashboard Layout Shell</strong></summary>

- **Type:** `shell`
- **Feature:** A015 — Dashboard Workspace Shell
- **Parent:** A015
- **Route:** `shared-dashboard`
- **Component:** `DashboardLayout`
- **Source:** `src/app/(dashboard)/layout.tsx`
- **Purpose:** غلاف التنقل المشترك لصفحات مساحة العمل.
- **Behavior:** يرسم Sidebar/Topbar والتنقل المتجاوب ومحتوى route الحالي.
- **Constraints:** تعديلات الغلاف مشتركة الأثر على جميع dashboard routes.
- **Status:** `active`
- **Dependencies:** `A311`, `A313`, `A325`, `A326`, `A327`, `A328`
- **Related UI IDs:** `A020`, `A021`, `A022`, `A023`
- **Code references (not UI IDs):** `DashboardLayout`

</details>

<details>
<summary><strong>A311 — Desktop Sidebar Navigation</strong></summary>

- **Type:** `navigation`
- **Feature:** A015 — Dashboard Workspace Shell
- **Parent:** A310
- **Route:** `shared-dashboard`
- **Component:** `DashboardLayout`
- **Source:** `src/app/(dashboard)/layout.tsx`
- **Purpose:** قائمة التنقل الجانبية لسطح المكتب.
- **Behavior:** تفتح مسارات مساحة العمل المتاحة.
- **Constraints:** تعرض في breakpoint الكبير فقط؛ الوجهات ثابتة من NAV_GROUPS.
- **Status:** `active`
- **Dependencies:** `A314`, `A315`, `A316`, `A317`, `A318`, `A319`, `A320`, `A321`, `A327`, `A323`, `A324`
- **Related UI IDs:** `A313`
- **Code references (not UI IDs):** `NAV_GROUPS`

</details>

<details>
<summary><strong>A312 — Dashboard Home Link</strong></summary>

- **Type:** `navigation`
- **Feature:** A015 — Dashboard Workspace Shell
- **Parent:** A311
- **Route:** `shared-dashboard`
- **Component:** `DashboardLayout`
- **Source:** `src/app/(dashboard)/layout.tsx`
- **Purpose:** رابط العودة إلى الصفحة الرئيسية من القائمة الجانبية.
- **Behavior:** ينقل المستخدم إلى /.
- **Constraints:** لا يعدل حالة صفحة أو مستند.
- **Status:** `active`
- **Dependencies:** `A031`
- **Related UI IDs:** `A311`
- **Code references (not UI IDs):** `href=/`

</details>

<details>
<summary><strong>A313 — Mobile Workspace Navigation</strong></summary>

- **Type:** `navigation`
- **Feature:** A015 — Dashboard Workspace Shell
- **Parent:** A310
- **Route:** `shared-dashboard`
- **Component:** `DashboardLayout`
- **Source:** `src/app/(dashboard)/layout.tsx`
- **Purpose:** قائمة التنقل الأفقية على الشاشات الصغيرة.
- **Behavior:** تتيح فتح المسارات نفسها المعروضة في Sidebar.
- **Constraints:** تصميم responsive لنفس وجهات NAV_GROUPS؛ لا تنشئ route IDs بديلة.
- **Status:** `active`
- **Dependencies:** `A314`, `A315`, `A316`, `A317`, `A318`, `A319`, `A320`, `A321`, `A327`, `A323`, `A324`
- **Related UI IDs:** `A311`
- **Code references (not UI IDs):** `NAV_GROUPS.flatMap`

</details>

<details>
<summary><strong>A314 — Editor Navigation Link</strong></summary>

- **Type:** `navigation`
- **Feature:** A015 — Dashboard Workspace Shell
- **Parent:** A311
- **Route:** `shared-dashboard`
- **Component:** `DashboardLayout`
- **Source:** `src/app/(dashboard)/layout.tsx`
- **Purpose:** رابط التنقل إلى المحرر.
- **Behavior:** يفتح /editor.
- **Constraints:** قد يظهر عنصر responsive مكرر بذات UI ID؛ استخدم route كوجهة.
- **Status:** `active`
- **Dependencies:** `A020`
- **Related UI IDs:** `A311`, `A313`
- **Code references (not UI IDs):** `href=/editor`

</details>

<details>
<summary><strong>A315 — Studio Navigation Link</strong></summary>

- **Type:** `navigation`
- **Feature:** A015 — Dashboard Workspace Shell
- **Parent:** A311
- **Route:** `shared-dashboard`
- **Component:** `DashboardLayout`
- **Source:** `src/app/(dashboard)/layout.tsx`
- **Purpose:** رابط التنقل إلى استوديو المحرك.
- **Behavior:** يفتح /studio.
- **Constraints:** لا يعدل إعداد المحرك.
- **Status:** `active`
- **Dependencies:** `A021`
- **Related UI IDs:** `A311`, `A313`
- **Code references (not UI IDs):** `href=/studio`

</details>

<details>
<summary><strong>A316 — Variant Index Navigation Link</strong></summary>

- **Type:** `navigation`
- **Feature:** A015 — Dashboard Workspace Shell
- **Parent:** A311
- **Route:** `shared-dashboard`
- **Component:** `DashboardLayout`
- **Source:** `src/app/(dashboard)/layout.tsx`
- **Purpose:** رابط فهرس الاختلافات.
- **Behavior:** يفتح /variants.
- **Constraints:** تنقل فقط.
- **Status:** `active`
- **Dependencies:** `A024`
- **Related UI IDs:** `A311`, `A313`
- **Code references (not UI IDs):** `href=/variants`

</details>

<details>
<summary><strong>A317 — Tracking Navigation Link</strong></summary>

- **Type:** `navigation`
- **Feature:** A015 — Dashboard Workspace Shell
- **Parent:** A311
- **Route:** `shared-dashboard`
- **Component:** `DashboardLayout`
- **Source:** `src/app/(dashboard)/layout.tsx`
- **Purpose:** رابط التتبع.
- **Behavior:** يفتح /tracking.
- **Constraints:** تنقل فقط.
- **Status:** `active`
- **Dependencies:** `A023`
- **Related UI IDs:** `A311`, `A313`
- **Code references (not UI IDs):** `href=/tracking`

</details>

<details>
<summary><strong>A318 — Quran Navigation Link</strong></summary>

- **Type:** `navigation`
- **Feature:** A015 — Dashboard Workspace Shell
- **Parent:** A311
- **Route:** `shared-dashboard`
- **Component:** `DashboardLayout`
- **Source:** `src/app/(dashboard)/layout.tsx`
- **Purpose:** رابط المصحف في مجموعة المعرفة.
- **Behavior:** يفتح /quran.
- **Constraints:** لا يحمل تغييرا في المستند.
- **Status:** `active`
- **Dependencies:** `A022`
- **Related UI IDs:** `A311`, `A313`
- **Code references (not UI IDs):** `href=/quran`

</details>

<details>
<summary><strong>A319 — Qiraat Navigation Link</strong></summary>

- **Type:** `navigation`
- **Feature:** A015 — Dashboard Workspace Shell
- **Parent:** A311
- **Route:** `shared-dashboard`
- **Component:** `DashboardLayout`
- **Source:** `src/app/(dashboard)/layout.tsx`
- **Purpose:** رابط القراءات.
- **Behavior:** يفتح /qiraat.
- **Constraints:** تنقل فقط.
- **Status:** `active`
- **Dependencies:** `A025`
- **Related UI IDs:** `A311`, `A313`
- **Code references (not UI IDs):** `href=/qiraat`

</details>

<details>
<summary><strong>A320 — Readers Navigation Link</strong></summary>

- **Type:** `navigation`
- **Feature:** A015 — Dashboard Workspace Shell
- **Parent:** A311
- **Route:** `shared-dashboard`
- **Component:** `DashboardLayout`
- **Source:** `src/app/(dashboard)/layout.tsx`
- **Purpose:** رابط القراء والرواة.
- **Behavior:** يفتح /readers.
- **Constraints:** تنقل فقط.
- **Status:** `active`
- **Dependencies:** `A026`
- **Related UI IDs:** `A311`, `A313`
- **Code references (not UI IDs):** `href=/readers`

</details>

<details>
<summary><strong>A321 — Review Navigation Link</strong></summary>

- **Type:** `navigation`
- **Feature:** A015 — Dashboard Workspace Shell
- **Parent:** A311
- **Route:** `shared-dashboard`
- **Component:** `DashboardLayout`
- **Source:** `src/app/(dashboard)/layout.tsx`
- **Purpose:** رابط المراجعة العلمية.
- **Behavior:** يفتح /review.
- **Constraints:** تنقل فقط.
- **Status:** `active`
- **Dependencies:** `A027`
- **Related UI IDs:** `A311`, `A313`
- **Code references (not UI IDs):** `href=/review`

</details>

<details>
<summary><strong>A322 — Statistics Navigation Link</strong></summary>

- **Type:** `navigation`
- **Feature:** A015 — Dashboard Workspace Shell
- **Parent:** A311
- **Route:** `shared-dashboard`
- **Component:** `DashboardLayout`
- **Source:** `src/app/(dashboard)/layout.tsx`
- **Purpose:** رابط الإحصاءات.
- **Behavior:** يفتح /statistics.
- **Constraints:** تنقل فقط.
- **Status:** `active`
- **Dependencies:** `A030`
- **Related UI IDs:** `A311`, `A313`
- **Code references (not UI IDs):** `href=/statistics`

</details>

<details>
<summary><strong>A323 — Administration Navigation Link</strong></summary>

- **Type:** `navigation`
- **Feature:** A015 — Dashboard Workspace Shell
- **Parent:** A311
- **Route:** `shared-dashboard`
- **Component:** `DashboardLayout`
- **Source:** `src/app/(dashboard)/layout.tsx`
- **Purpose:** رابط لوحة الإدارة.
- **Behavior:** يفتح /admin.
- **Constraints:** تنقل فقط.
- **Status:** `active`
- **Dependencies:** `A028`
- **Related UI IDs:** `A311`, `A313`
- **Code references (not UI IDs):** `href=/admin`

</details>

<details>
<summary><strong>A324 — Settings Navigation Link</strong></summary>

- **Type:** `navigation`
- **Feature:** A015 — Dashboard Workspace Shell
- **Parent:** A311
- **Route:** `shared-dashboard`
- **Component:** `DashboardLayout`
- **Source:** `src/app/(dashboard)/layout.tsx`
- **Purpose:** رابط الإعدادات.
- **Behavior:** يفتح /settings.
- **Constraints:** تنقل فقط.
- **Status:** `active`
- **Dependencies:** `A029`
- **Related UI IDs:** `A311`, `A313`
- **Code references (not UI IDs):** `href=/settings`

</details>

<details>
<summary><strong>A325 — Quran Quick Link in Workspace Header</strong></summary>

- **Type:** `navigation`
- **Feature:** A015 — Dashboard Workspace Shell
- **Parent:** A310
- **Route:** `shared-dashboard`
- **Component:** `DashboardLayout`
- **Source:** `src/app/(dashboard)/layout.tsx`
- **Purpose:** رابط سريع إلى المصحف في رأس مساحة العمل.
- **Behavior:** يفتح /quran.
- **Constraints:** لا يتغير مصدر تشجير المصحف.
- **Status:** `active`
- **Dependencies:** `A022`
- **Related UI IDs:** `A318`
- **Code references (not UI IDs):** `href=/quran`

</details>

<details>
<summary><strong>A326 — Local Session Badge</strong></summary>

- **Type:** `control`
- **Feature:** A015 — Dashboard Workspace Shell
- **Parent:** A310
- **Route:** `shared-dashboard`
- **Component:** `SessionBadge`
- **Source:** `src/components/layout/SessionBadge.tsx`
- **Purpose:** شارة حالة الجلسة المحلية.
- **Behavior:** تعرض الدخول المحلي أو اسم المستخدم المحلي وروابطه.
- **Constraints:** لا توحِ بمصادقة خادمية غير موجودة.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A032`
- **Code references (not UI IDs):** `SessionBadge`

</details>

<details>
<summary><strong>A327 — Shared Confirmation Dialog Host</strong></summary>

- **Type:** `dialog`
- **Feature:** A015 — Dashboard Workspace Shell
- **Parent:** A310
- **Route:** `shared-dashboard`
- **Component:** `ConfirmDialogHost`
- **Source:** `src/components/ui/ConfirmDialogHost.tsx`
- **Purpose:** مضيف الحوارات المشتركة للتأكيد الكمي والعمليات الحساسة.
- **Behavior:** يعرض طلب confirmAction الحالي ويرجع قرار المستخدم إلى المستدعي.
- **Constraints:** لا ينفذ business operation بنفسه؛ تبقى عواقب العملية عند المكون المستدعي.
- **Status:** `active`
- **Dependencies:** —
- **Related UI IDs:** `A333`, `A152`, `A169`, `A261`
- **Code references (not UI IDs):** `confirm-store`, `confirmAction`

</details>

<details>
<summary><strong>A328 — Workspace Brand Home Link</strong></summary>

- **Type:** `navigation`
- **Feature:** A015 — Dashboard Workspace Shell
- **Parent:** A310
- **Route:** `shared-dashboard`
- **Component:** `DashboardLayout`
- **Source:** `src/app/(dashboard)/layout.tsx`
- **Purpose:** رابط شعار مساحة العمل للعودة إلى الصفحة الرئيسية.
- **Behavior:** ينقل من الشعار المكتبي أو شعار الجوال إلى /.
- **Constraints:** نسختان responsive للمفهوم نفسه؛ ميّزهما بـ data-ui-instance=desktop-brand/mobile-brand.
- **Status:** `active`
- **Dependencies:** `A031`
- **Related UI IDs:** `A310`, `A312`
- **Code references (not UI IDs):** `TashjirMark`, `href=/`

</details>

<details>
<summary><strong>A410 — Developer Registry Inspector Toggle</strong></summary>

- **Type:** `inspector`
- **Feature:** A014 — Developer UI Inspector
- **Parent:** A014
- **Route:** `development-only`
- **Component:** `UIRegistryInspector`
- **Source:** `src/components/dev/UIRegistryInspector.tsx`
- **Purpose:** زر تفعيل/إيقاف واجهة الفحص.
- **Behavior:** يفتح طبقة إظهار معرفات DOM ويمكن تفعيله باختصار Alt+Shift+I.
- **Constraints:** لا يظهر إلا عند NODE_ENV=development ولا يغيّر حالة التطبيق.
- **Status:** `active`
- **Dependencies:** `A411`, `A412`
- **Related UI IDs:** `A014`
- **Code references (not UI IDs):** `process.env.NODE_ENV`, `Alt+Shift+I`

</details>

<details>
<summary><strong>A411 — Developer UI ID Overlay</strong></summary>

- **Type:** `inspector`
- **Feature:** A014 — Developer UI Inspector
- **Parent:** A014
- **Route:** `development-only`
- **Component:** `UIRegistryInspector`
- **Source:** `src/components/dev/UIRegistryInspector.tsx`
- **Purpose:** طبقة شارات مواضع عناصر data-ui-id.
- **Behavior:** تحدد عناصر DOM المسجلة وتعرض معرف كل منها فوق مكانها.
- **Constraints:** تستثني عناصر inspector نفسها ولا تعترض أحداث عنصر التطبيق الأصلي.
- **Status:** `active`
- **Dependencies:** `A410`
- **Related UI IDs:** `A412`
- **Code references (not UI IDs):** `document.querySelectorAll([data-ui-id])`

</details>

<details>
<summary><strong>A412 — Developer Registry Details Card</strong></summary>

- **Type:** `inspector`
- **Feature:** A014 — Developer UI Inspector
- **Parent:** A014
- **Route:** `development-only`
- **Component:** `UIRegistryInspector`
- **Source:** `src/components/dev/UIRegistryInspector.tsx`
- **Purpose:** بطاقة تفاصيل عنصر Registry المحدد.
- **Behavior:** تعرض النوع والميزة والأب والمسار والمكون والملف والغرض والسلوك والقيود والاعتماديات.
- **Constraints:** مصدر التفاصيل هو سجل TypeScript؛ لا يقرأ أو يغير business state.
- **Status:** `active`
- **Dependencies:** `A410`
- **Related UI IDs:** `A411`
- **Code references (not UI IDs):** `getUIIdentity`, `getFeatureById`

</details>

## دفتر المعرفات المتقاعدة

- لا توجد معرفات متقاعدة عند تأسيس السجل؛ لا تحذف هذا القسم ولا تعِد استخدام أي ID يُتقاعد مستقبلا.

## التحقق

- `npm test -- tests/ui-registry.test.ts` يفحص uniqueness/format/hierarchy/references/DOM markers/unknown IDs/retired IDs وتطابق الوثائق.
- عناصر الـ UI ذات الحالة `active` أو `deprecated` يجب أن تحمل `data-ui-id="Axxx"` في الملف المسجل. فحص جميع ملفات المصدر يكشف أي علامة بلا تعريف.
- وضع Inspector: Development فقط، زر عائم أو الاختصار `Alt+Shift+I`. لا يعرض السجل للمستخدم النهائي في الإنتاج.
