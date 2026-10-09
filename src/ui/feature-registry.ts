/**
 * Project Feature & UI Identity Registry — feature-level map.
 *
 * Feature IDs are permanent identities. Do not derive them from route order and
 * never recycle one; mark removed concepts retired in this registry instead.
 */

export type RegistryStatus = 'active' | 'deprecated' | 'retired';

export interface FeatureImpactLayer {
  layer: 'UI' | 'Store' | 'Engine' | 'Data Model' | 'Persistence' | 'Tests';
  files: readonly string[];
  uiIds: readonly string[];
  notes: string;
}

export interface FeatureRegistryEntry {
  id: string;
  kind: 'feature';
  name: string;
  route: string;
  purpose: string;
  status: RegistryStatus;
  mainFiles: readonly string[];
  mainComponents: readonly string[];
  stores: readonly string[];
  engineDependencies: readonly string[];
  testFiles: readonly string[];
  impactMap: readonly FeatureImpactLayer[];
}

export const FEATURE_REGISTRY = [
  {
    id: 'A001',
    kind: 'feature',
    name: 'Editor',
    route: '/editor',
    purpose: 'تحرير اختلافات القراءة وأوجهها وعلاقاتها، ثم مراجعة ناتج محرك التشجير وحفظ المستند.',
    status: 'active',
    mainFiles: [
      'src/app/(dashboard)/editor/page.tsx',
      'src/components/editor/EditorToolbar.tsx',
      'src/components/editor/AyahNavigator.tsx',
      'src/components/editor/TashjeerCanvas.tsx',
      'src/components/editor/PropertiesPanel.tsx',
      'src/components/editor/VariantsPanel.tsx',
    ],
    mainComponents: [
      'EditorPage',
      'EditorToolbar',
      'AyahNavigator',
      'TashjeerCanvas',
      'PropertiesPanel',
      'VariantsPanel',
      'SmartCreateWizard',
    ],
    stores: ['src/stores/editor-store.ts', 'src/lib/editor/selection-store.ts'],
    engineDependencies: [
      'src/lib/tashjeer/layout-engine.ts',
      'src/lib/tashjeer/branch-engine.ts',
      'src/lib/tashjeer/smart-create.ts',
      'src/lib/tashjeer/clipboard.ts',
      'src/lib/tashjeer/bulk-operations.ts',
      'src/lib/tashjeer/merge-operations.ts',
      'src/lib/tashjeer/manual-links.ts',
      'src/lib/tashjeer/selection-commands.ts',
    ],
    testFiles: [
      'tests/selection-store.test.ts',
      'tests/editor-manual-actions.test.ts',
      'tests/editor-bulk-actions.test.ts',
      'tests/editor-multi-difference.test.ts',
      'tests/package05-multi-difference.test.ts',
      'tests/package06-wizard.test.ts',
      'tests/package07-acceptance.test.ts',
      'tests/e2e/editor-ph3.spec.ts',
    ],
    impactMap: [
      { layer: 'UI', files: ['src/app/(dashboard)/editor/page.tsx', 'src/components/editor/'], uiIds: ['A020', 'A100', 'A101', 'A107', 'A111', 'A113', 'A114'], notes: 'Page composition, toolbar, navigator, canvas, properties, and difference panel.' },
      { layer: 'Store', files: ['src/stores/editor-store.ts', 'src/lib/editor/selection-store.ts'], uiIds: ['A103', 'A104', 'A129'], notes: 'Shared document state, undo/redo, selection, clipboard, and panel state.' },
      { layer: 'Engine', files: ['src/lib/tashjeer/'], uiIds: ['A111', 'A123', 'A128'], notes: 'Layout, branch generation, smart-create, ordering, relations, merge, and bulk-operation APIs. UI-only changes must not alter these.' },
      { layer: 'Data Model', files: ['src/types/tashjeer.ts', 'src/lib/tashjeer/model/v8.ts'], uiIds: ['A114', 'A121', 'A128'], notes: 'Document, difference/variant, relation, line/segment, and correction records.' },
      { layer: 'Persistence', files: ['src/lib/storage/document-store.ts', 'src/lib/storage/global-rules-store.ts'], uiIds: ['A134', 'A143', 'A144'], notes: 'Local document and global-rule storage; only change when the request explicitly reaches persistence.' },
      { layer: 'Tests', files: ['tests/editor-*.test.ts', 'tests/package0*.test.ts'], uiIds: ['A020', 'A333', 'A421'], notes: 'Regression coverage for editing, bulk operations, wizard, undo/redo, and identity mapping.' },
    ],
  },
  {
    id: 'A002',
    kind: 'feature',
    name: 'Engine Studio',
    route: '/studio',
    purpose: 'واجهة رسومية لسياسات المحرك والقواعد ومصفوفة الدمج والأولويات والتفسير والاختبار والنشر والاستيراد والتصدير.',
    status: 'active',
    mainFiles: ['src/app/(dashboard)/studio/page.tsx', 'src/stores/engine-config-ui-store.ts', 'src/lib/tashjeer/engine-config-store.ts'],
    mainComponents: ['EngineStudioPage', 'Dashboard', 'RuleExplorer', 'RuleBuilder', 'MergeMatrixPanel', 'PriorityPipeline', 'WhyTracePlayground', 'RuleTestsPanel', 'CandidateRulesPanel', 'ProfileComparePanel', 'PublishHistoryPanel', 'ExportImportPanel', 'EngineSettingsPanel', 'RecitationRuleCatalogPanel'],
    stores: ['src/stores/engine-config-ui-store.ts', 'src/lib/tashjeer/engine-config-store.ts', 'src/lib/tashjeer/engine-config-history.ts'],
    engineDependencies: ['src/lib/tashjeer/decision/resolver.ts', 'src/lib/tashjeer/decision/policy.ts', 'src/lib/tashjeer/decision/rule-test-runner.ts', 'src/lib/tashjeer/decision/profile-compare.ts', 'src/lib/tashjeer/decision/profile-audit.ts', 'src/lib/tashjeer/recitation-rule-catalog.ts'],
    testFiles: ['tests/engine-studio-package02.test.ts', 'tests/engine-studio-policy.test.ts', 'tests/candidate-rule.test.ts', 'tests/decision-resolver.test.ts', 'tests/rule-test-runner.test.ts', 'tests/profile-compare.test.ts', 'tests/engine-config-history.test.ts'],
    impactMap: [
      { layer: 'UI', files: ['src/app/(dashboard)/studio/page.tsx', 'src/components/studio/'], uiIds: ['A021', 'A150', 'A155', 'A158', 'A162', 'A163', 'A168'], notes: 'Section navigation and the selected Engine Studio panel.' },
      { layer: 'Store', files: ['src/stores/engine-config-ui-store.ts', 'src/lib/tashjeer/engine-config-store.ts'], uiIds: ['A152', 'A154', 'A161'], notes: 'Draft, selected rule, dirty state, persistence, and version history.' },
      { layer: 'Engine', files: ['src/lib/tashjeer/decision/'], uiIds: ['A160', 'A162', 'A163', 'A164', 'A165'], notes: 'Resolver, policy, rule tests, and profile comparison; do not modify for presentation-only requests.' },
      { layer: 'Data Model', files: ['src/lib/tashjeer/model/v8.ts'], uiIds: ['A158', 'A160', 'A162', 'A163'], notes: 'EngineConfig, EngineRule, merge entries, relations, and profile data.' },
      { layer: 'Persistence', files: ['src/lib/tashjeer/engine-config-store.ts', 'src/lib/tashjeer/engine-config-history.ts'], uiIds: ['A154', 'A168', 'A169'], notes: 'Explicit save/import/reset/rollback flows.' },
      { layer: 'Tests', files: ['tests/engine-studio-*.test.ts', 'tests/decision-*.test.ts'], uiIds: ['A021', 'A160', 'A168', 'A169'], notes: 'Policy decisions, deterministic serialization, rule tests, and profile history.' },
    ],
  },
  {
    id: 'A003',
    kind: 'feature',
    name: 'Quran View',
    route: '/quran',
    purpose: 'قراءة النص العثماني حسب السورة، مع عرض التشجير المحفوظ أو المشتق وروابط التحرير والتصدير.',
    status: 'active',
    mainFiles: ['src/app/(dashboard)/quran/page.tsx', 'src/components/quran/AyahTashjeerView.tsx', 'src/lib/tashjeer/ayah-tashjeer-source.ts'],
    mainComponents: ['QuranPage', 'AyahTashjeerView', 'TashjeerFigure'],
    stores: ['src/lib/storage/document-store.ts', 'src/lib/storage/global-rules-store.ts', 'src/lib/storage/rule-occurrences-store.ts'],
    engineDependencies: ['src/hooks/useAyahTashjeer.ts', 'src/lib/tashjeer/ayah-tashjeer-source.ts', 'src/lib/tashjeer/branch-engine.ts', 'src/lib/tashjeer/classic-tashjeer.ts'],
    testFiles: ['tests/quran-data.test.ts', 'tests/ayah-tashjeer-source.test.ts', 'tests/figure-render.test.ts', 'tests/global-rule-engine.test.ts'],
    impactMap: [
      { layer: 'UI', files: ['src/app/(dashboard)/quran/page.tsx', 'src/components/quran/AyahTashjeerView.tsx'], uiIds: ['A022', 'A180', 'A184', 'A187'], notes: 'Surah search/list, ayah text, and per-ayah tashjeer card.' },
      { layer: 'Store', files: ['src/lib/storage/document-store.ts', 'src/lib/storage/global-rules-store.ts', 'src/lib/storage/rule-occurrences-store.ts'], uiIds: ['A183', 'A188'], notes: 'Saved document and derived global-rule visibility.' },
      { layer: 'Engine', files: ['src/hooks/useAyahTashjeer.ts', 'src/lib/tashjeer/ayah-tashjeer-source.ts'], uiIds: ['A187'], notes: 'Resolve the saved/derived document and render the same figure as the editor.' },
      { layer: 'Data Model', files: ['src/types/tashjeer.ts', 'src/data/quran/index.ts'], uiIds: ['A184', 'A187'], notes: 'Quran ayah keys and persisted tashjeer documents.' },
      { layer: 'Tests', files: ['tests/quran-data.test.ts', 'tests/ayah-tashjeer-source.test.ts', 'tests/figure-render.test.ts'], uiIds: ['A022', 'A187'], notes: 'Data source and renderer parity.' },
    ],
  },
  {
    id: 'A004',
    kind: 'feature',
    name: 'Tracking',
    route: '/tracking',
    purpose: 'مقارنة ما وجده المحرك بما أضافه أو صححه المحرر، مع أثر القرار وروابط العودة إلى موضع التحرير.',
    status: 'active',
    mainFiles: ['src/app/(dashboard)/tracking/page.tsx', 'src/lib/storage/tracking-store.ts'],
    mainComponents: ['TrackingPage', 'TrackingRowCard', 'CorrectionTripletView', 'RowDecisionTrace'],
    stores: ['src/lib/storage/tracking-store.ts', 'src/lib/storage/document-store.ts', 'src/lib/storage/rule-occurrences-store.ts'],
    engineDependencies: ['src/lib/tashjeer/decision/api.ts', 'src/lib/tashjeer/decision/editor-bridge.ts', 'src/lib/tashjeer/decision/resolver.ts'],
    testFiles: ['tests/rule-occurrences-store.test.ts', 'tests/decision-resolver.test.ts', 'tests/decision-editor-bridge.test.ts', 'tests/profile-audit.test.ts'],
    impactMap: [
      { layer: 'UI', files: ['src/app/(dashboard)/tracking/page.tsx'], uiIds: ['A023', 'A200', 'A201', 'A203', 'A204'], notes: 'Category/source filters, summary, row cards, and expanded traces.' },
      { layer: 'Store', files: ['src/lib/storage/tracking-store.ts', 'src/lib/storage/rule-occurrences-store.ts'], uiIds: ['A203', 'A204'], notes: 'Read-only aggregation of editor records and occurrence overrides.' },
      { layer: 'Engine', files: ['src/lib/tashjeer/decision/api.ts', 'src/lib/tashjeer/decision/resolver.ts'], uiIds: ['A206', 'A207'], notes: 'Recomputes decision traces using the same resolver as Studio.' },
      { layer: 'Data Model', files: ['src/types/tashjeer.ts', 'src/lib/tashjeer/model/v8.ts'], uiIds: ['A204'], notes: 'Correction triplets and edit-log events.' },
      { layer: 'Tests', files: ['tests/rule-occurrences-store.test.ts', 'tests/decision-editor-bridge.test.ts'], uiIds: ['A023', 'A206'], notes: 'Tracking derivation and editor/engine classification.' },
    ],
  },
  {
    id: 'A005',
    kind: 'feature',
    name: 'Variant and Rule Index',
    route: '/variants',
    purpose: 'فهرسة الاختلافات والقواعد العامة مع البحث والتصفية وروابط التحرير.',
    status: 'active',
    mainFiles: ['src/app/(dashboard)/variants/page.tsx', 'src/lib/storage/document-store.ts', 'src/lib/storage/global-rules-store.ts'],
    mainComponents: ['VariantsIndexPage', 'RuleOccurrenceReview', 'GlobalRuleMetaEditor', 'StrengthDegreePicker'],
    stores: ['src/lib/storage/document-store.ts', 'src/lib/storage/global-rules-store.ts', 'src/lib/storage/rule-occurrences-store.ts'],
    engineDependencies: ['src/lib/quran-logic/global-rule-engine.ts', 'src/lib/tashjeer/scope.ts', 'src/lib/tashjeer/strength-degrees.ts'],
    testFiles: ['tests/global-rule-engine.test.ts', 'tests/rule-occurrences-store.test.ts', 'tests/strength-degrees.test.ts'],
    impactMap: [
      { layer: 'UI', files: ['src/app/(dashboard)/variants/page.tsx'], uiIds: ['A024', 'A220', 'A221', 'A222', 'A223'], notes: 'Index filters, result list, and general-rule editor.' },
      { layer: 'Store', files: ['src/lib/storage/document-store.ts', 'src/lib/storage/global-rules-store.ts'], uiIds: ['A223'], notes: 'Reads local documents and persists general rules.' },
      { layer: 'Engine', files: ['src/lib/quran-logic/global-rule-engine.ts'], uiIds: ['A222', 'A223'], notes: 'Pattern matching and occurrence derivation.' },
      { layer: 'Tests', files: ['tests/global-rule-engine.test.ts', 'tests/rule-occurrences-store.test.ts'], uiIds: ['A024', 'A223'], notes: 'Matching and local override behavior.' },
    ],
  },
  {
    id: 'A006',
    kind: 'feature',
    name: 'Qiraat Catalog',
    route: '/qiraat',
    purpose: 'استعراض القراءات العشر واختيار قراءة لعرض بياناتها.',
    status: 'active',
    mainFiles: ['src/app/(dashboard)/qiraat/page.tsx', 'src/data/qiraat-data/qiraat.ts'],
    mainComponents: ['QiraatPage', 'QiraatTree'],
    stores: [],
    engineDependencies: ['src/data/qiraat-data/qiraat.ts', 'src/data/qiraat-data/narrator-profiles.ts'],
    testFiles: ['tests/catalog-order.test.ts', 'tests/reader-symbols.test.ts'],
    impactMap: [
      { layer: 'UI', files: ['src/app/(dashboard)/qiraat/page.tsx', 'src/components/visualization/QiraatTree.tsx'], uiIds: ['A025', 'A230', 'A231'], notes: 'Search/selection and selected-reading detail.' },
      { layer: 'Data Model', files: ['src/data/qiraat-data/'], uiIds: ['A231'], notes: 'Read-only canonical qiraat data.' },
      { layer: 'Tests', files: ['tests/catalog-order.test.ts', 'tests/reader-symbols.test.ts'], uiIds: ['A025', 'A231'], notes: 'Ordering and symbols.' },
    ],
  },
  {
    id: 'A007',
    kind: 'feature',
    name: 'Readers Catalog',
    route: '/readers',
    purpose: 'استعراض وإدارة ملفات القراء وإجازاتهم ضمن تنفيذ التخزين الحالي.',
    status: 'active',
    mainFiles: ['src/app/(dashboard)/readers/page.tsx', 'src/types/index.ts'],
    mainComponents: ['ReadersPage'],
    stores: [],
    engineDependencies: ['src/data/qiraat-data/qiraat.ts'],
    testFiles: ['tests/catalog-order.test.ts'],
    impactMap: [
      { layer: 'UI', files: ['src/app/(dashboard)/readers/page.tsx'], uiIds: ['A026', 'A240', 'A241', 'A242'], notes: 'Reader form, selectors, and catalog list.' },
      { layer: 'Data Model', files: ['src/types/index.ts'], uiIds: ['A241', 'A242'], notes: 'Reader profile and transmission types.' },
      { layer: 'Tests', files: ['tests/catalog-order.test.ts'], uiIds: ['A026', 'A242'], notes: 'Catalog ordering used by the current implementation.' },
    ],
  },
  {
    id: 'A008',
    kind: 'feature',
    name: 'Scientific Review',
    route: '/review',
    purpose: 'قائمة المراجعة العلمية المحلية وما يرتبط بها من تحديث حالة أو ملاحظات.',
    status: 'active',
    mainFiles: ['src/app/(dashboard)/review/page.tsx'],
    mainComponents: ['ReviewPage'],
    stores: ['src/lib/storage/document-store.ts'],
    engineDependencies: [],
    testFiles: ['tests/document-store.test.ts'],
    impactMap: [
      { layer: 'UI', files: ['src/app/(dashboard)/review/page.tsx'], uiIds: ['A027', 'A250', 'A251', 'A252'], notes: 'Review filters and review-item actions.' },
      { layer: 'Store', files: ['src/lib/storage/document-store.ts'], uiIds: ['A252'], notes: 'Current review content is derived from local documents.' },
      { layer: 'Tests', files: ['tests/document-store.test.ts'], uiIds: ['A027', 'A252'], notes: 'Persistence-facing behavior.' },
    ],
  },
  {
    id: 'A009',
    kind: 'feature',
    name: 'Transmission Administration',
    route: '/admin',
    purpose: 'إدارة الأئمة والرواة والطرق محليا، مع تبويب قديم يحيل إعدادات المحرك إلى الاستوديو.',
    status: 'active',
    mainFiles: ['src/app/(dashboard)/admin/page.tsx', 'src/lib/transmissions/catalog.ts'],
    mainComponents: ['AdminPage', 'TransmissionManager', 'TransmissionEditor'],
    stores: ['src/lib/transmissions/catalog.ts'],
    engineDependencies: ['src/lib/tashjeer/engine-settings.ts'],
    testFiles: ['tests/catalog-order.test.ts'],
    impactMap: [
      { layer: 'UI', files: ['src/app/(dashboard)/admin/page.tsx'], uiIds: ['A028', 'A260', 'A261', 'A262'], notes: 'Administration tabs, catalog hierarchy, forms, and reorder interactions.' },
      { layer: 'Store', files: ['src/lib/transmissions/catalog.ts'], uiIds: ['A261', 'A262'], notes: 'Local transmission catalog is the active persistence path.' },
      { layer: 'Engine', files: ['src/lib/tashjeer/engine-settings.ts'], uiIds: ['A260'], notes: 'The legacy engine tab links to Studio; it is not a second settings source.' },
      { layer: 'Tests', files: ['tests/catalog-order.test.ts'], uiIds: ['A028', 'A261'], notes: 'Catalog ordering and peer movement.' },
    ],
  },
  {
    id: 'A010',
    kind: 'feature',
    name: 'Settings',
    route: '/settings',
    purpose: 'عرض وإدارة إعدادات مساحة العمل الحالية.',
    status: 'active',
    mainFiles: ['src/app/(dashboard)/settings/page.tsx'],
    mainComponents: ['SettingsPage', 'StrengthDegreesManager'],
    stores: ['src/lib/tashjeer/strength-degrees.ts'],
    engineDependencies: ['src/data/quran/index.ts'],
    testFiles: ['tests/strength-degrees.test.ts'],
    impactMap: [
      { layer: 'UI', files: ['src/app/(dashboard)/settings/page.tsx', 'src/components/settings/StrengthDegreesManager.tsx'], uiIds: ['A029', 'A270', 'A271'], notes: 'Settings form and configurable strength-degree manager.' },
      { layer: 'Store', files: ['src/lib/tashjeer/strength-degrees.ts'], uiIds: ['A271'], notes: 'Strength-degree catalog persistence.' },
      { layer: 'Tests', files: ['tests/strength-degrees.test.ts'], uiIds: ['A029', 'A271'], notes: 'Degree catalog constraints.' },
    ],
  },
  {
    id: 'A011',
    kind: 'feature',
    name: 'Statistics',
    route: '/statistics',
    purpose: 'لوحة قراءة إحصائية للتغطية والمواضع والفئات والرواة والمستندات.',
    status: 'active',
    mainFiles: ['src/app/(dashboard)/statistics/page.tsx'],
    mainComponents: ['StatisticsPage'],
    stores: ['src/lib/storage/document-store.ts'],
    engineDependencies: ['src/data/quran/index.ts'],
    testFiles: ['tests/quran-data.test.ts'],
    impactMap: [
      { layer: 'UI', files: ['src/app/(dashboard)/statistics/page.tsx'], uiIds: ['A030', 'A280'], notes: 'Read-only statistical sections and deep links to review.' },
      { layer: 'Store', files: ['src/lib/storage/document-store.ts'], uiIds: ['A280'], notes: 'Counts local saved documents.' },
      { layer: 'Data Model', files: ['src/data/quran/index.ts'], uiIds: ['A280'], notes: 'Quran totals used for coverage.' },
      { layer: 'Tests', files: ['tests/quran-data.test.ts'], uiIds: ['A030', 'A280'], notes: 'Quran data totals.' },
    ],
  },
  {
    id: 'A012',
    kind: 'feature',
    name: 'Public Landing',
    route: '/',
    purpose: 'صفحة تعريف عامة تعرض قيمة المشروع وروابط الوصول إلى مساحات العمل.',
    status: 'active',
    mainFiles: ['src/app/page.tsx', 'src/components/marketing/PublicHeader.tsx', 'src/components/marketing/PublicFooter.tsx'],
    mainComponents: ['HomePage', 'PublicHeader', 'PublicFooter', 'LandingStory', 'LandingProof'],
    stores: [],
    engineDependencies: ['src/lib/tashjeer/showcase.ts'],
    testFiles: ['tests/landing-showcase.test.ts'],
    impactMap: [
      { layer: 'UI', files: ['src/app/page.tsx', 'src/components/marketing/'], uiIds: ['A031', 'A290', 'A291'], notes: 'Server-rendered marketing surface and its public navigation.' },
      { layer: 'Engine', files: ['src/lib/tashjeer/showcase.ts'], uiIds: ['A290'], notes: 'Produces the sample visualization displayed on the page.' },
      { layer: 'Tests', files: ['tests/landing-showcase.test.ts'], uiIds: ['A031', 'A290'], notes: 'Showcase model remains backed by real project data.' },
    ],
  },
  {
    id: 'A013',
    kind: 'feature',
    name: 'Local Sign-in',
    route: '/login',
    purpose: 'واجهة دخول محلية تحفظ شارة الجلسة في المتصفح ولا ترسل بيانات إلى خادم.',
    status: 'active',
    mainFiles: ['src/app/login/page.tsx', 'src/components/layout/SessionBadge.tsx'],
    mainComponents: ['LoginPage', 'SessionBadge'],
    stores: [],
    engineDependencies: [],
    testFiles: [],
    impactMap: [
      { layer: 'UI', files: ['src/app/login/page.tsx'], uiIds: ['A032', 'A340', 'A341', 'A342'], notes: 'Local-only sign-in form and navigation.' },
      { layer: 'Persistence', files: ['src/app/login/page.tsx'], uiIds: ['A344'], notes: 'The submit action writes the local tashjeer-session value only.' },
    ],
  },
  {
    id: 'A014',
    kind: 'feature',
    name: 'UI ID Inspector',
    route: 'global',
    purpose: 'أداة فحص تعرض معرفات عناصر الواجهة المسجلة وتفاصيل سجلها، متاحة في كل البيئات بما فيها النشر الإنتاجي (Vercel Preview)، دون تغيير سلوك التطبيق.',
    status: 'active',
    mainFiles: ['src/components/dev/UIRegistryInspector.tsx', 'src/ui/ui-registry.ts'],
    mainComponents: ['UIRegistryInspector'],
    stores: [],
    engineDependencies: [],
    testFiles: ['tests/ui-registry.test.ts'],
    impactMap: [
      { layer: 'UI', files: ['src/components/dev/UIRegistryInspector.tsx'], uiIds: ['A410', 'A411', 'A412', 'A2126'], notes: 'Available in every environment including production previews; opt-in via visible toggle, ?uiInspector=1, or Alt+Shift+I; fully removable at runtime.' },
      { layer: 'Tests', files: ['tests/ui-registry.test.ts'], uiIds: ['A410', 'A411', 'A412'], notes: 'Registry metadata and DOM markers are validated together.' },
    ],
  },
  {
    id: 'A015',
    kind: 'feature',
    name: 'Dashboard Workspace Shell',
    route: 'shared-dashboard',
    purpose: 'الغلاف المشترك لمسارات مساحة العمل: التنقل المتجاوب، رابط المصحف، شارة الجلسة، وحاوية التأكيد.',
    status: 'active',
    mainFiles: ['src/app/(dashboard)/layout.tsx', 'src/components/layout/SessionBadge.tsx', 'src/components/ui/ConfirmDialogHost.tsx'],
    mainComponents: ['DashboardLayout', 'SessionBadge', 'ConfirmDialogHost'],
    stores: ['src/lib/ui/confirm-store.ts'],
    engineDependencies: [],
    testFiles: ['tests/confirm-store.test.ts'],
    impactMap: [
      { layer: 'UI', files: ['src/app/(dashboard)/layout.tsx', 'src/components/layout/SessionBadge.tsx'], uiIds: ['A310', 'A311', 'A312', 'A313', 'A314', 'A315', 'A316', 'A317', 'A318', 'A319', 'A320', 'A321', 'A322', 'A323', 'A324', 'A325', 'A326', 'A327'], notes: 'Shared navigation elements render on multiple dashboard routes and responsive breakpoints.' },
      { layer: 'Store', files: ['src/lib/ui/confirm-store.ts'], uiIds: ['A327'], notes: 'Shared confirmation dialog host; consumers own the business operation.' },
      { layer: 'Tests', files: ['tests/confirm-store.test.ts'], uiIds: ['A327'], notes: 'Confirmation queuing and result behavior.' },
    ],
  },
] as const satisfies readonly FeatureRegistryEntry[];

export type FeatureId = (typeof FEATURE_REGISTRY)[number]['id'];

export function getFeatureById(id: string): (typeof FEATURE_REGISTRY)[number] | undefined {
  return FEATURE_REGISTRY.find((feature) => feature.id === id);
}
