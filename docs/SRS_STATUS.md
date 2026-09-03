# حالة تنفيذ SRS التشجير ومصفوفة التتبّع — Implementation Status & Traceability

> المرجع: **TASHJIR-SRS-2026-08 v1.0** (نسخة موحّدة نهائية).
>
> هذا الملف يوثّق أيُّ بند من الوثيقة منفَّذ وأين (الملف + الاختبار)، وهو المرجع العملي
> لمعرفة «ما الخطوات المتبقية». أساس التقدير أدناه هو **فحص الكود والاختبارات** عند
> الالتزام `arena/01a06855-tashjir` (قبل هذا الفرع مباشرة `main`).
>
> - الاختبارات: **454 ناجحًا | 2 متخطّى** في 40 ملفًّا (Vitest).
> - البناء: `npm run build` ناجح (17 مسارًا مُولَّدًا).
> - الفحص الأنماطي: `tsc --noEmit` نظيف، و`eslint` نظيف (بلا تحذيرات بعد التنظيف).
>
> **تنبيه منهجي:** «منفَّذ في الكود + اختبار وحدة» لا يعني بالضرورة «مقبول بعد فحص
> يدوي من الواجهة». البنود المعتمدة على سلوك واجهة بحت (سحب، مؤشر إدراج، تأكيدات)
> موصى بها بمراجعة قبول يدوية عبر معايير القبول (AC-01..AC-06) — سجلتها في §3.

---

## 1. الحالة العامة

| المحور | الحالة | الدليل الرئيسي |
|---|---|---|
| نموذج البيانات v8 (PH0) | **منفَّذ** | `src/lib/tashjeer/model/v8.ts` + `tests/model-v8.test.ts` |
| الترحيل v7→v8 (DM-18) | **منفَّذ** | `src/lib/tashjeer/migration/migrate-v7-v8.ts` + `tests/migrate-v7-v8.test.ts` |
| سجل التراجع الموحّد (DM-15/FR-ED-13) | **منفَّذ** | `src/lib/tashjeer/history/command-log.ts` + `tests/command-log.test.ts` |
| طبقة القرار والسياسة (PH1) | **منفَّذ** | `src/lib/tashjeer/decision/*` + صفحة `/studio` |
| سياق التحديد الموحّد (PH2) | **منفَّذ** | `src/lib/tashjeer/selection-context.ts` + `tests/selection-context.test.ts` |
| السحب والدمج والحافظة (PH3) | **منفَّذ** | `RelationsPanel.tsx` (سحب/دمج)، `editor-store.ts` (حافظة)، `manual-links.ts` |
| تعدد الاختلافات (PH4) | **منفَّذ** | `editor-store.ts` + `tests/editor-multi-difference.test.ts` |
| الإنشاء الذكي الموحّد (PH5) | **منفَّذ** | `src/lib/tashjeer/smart-create.ts` + `SmartCreateWizard.tsx` + اختباراته |
| التعميم والاستقلال المحلي (PH6) | **منفَّذ** | `global-rule-engine.ts` + `rule-occurrences-store.ts` + `GlobalRuleBuilder.tsx` |
| الوقف/الوصل/ممنوع الوصل (PH7) | **منفَّذ** (جزئي بالواجهة) | `reading-window.ts` + `tests/editor-forbidden-wasl.test.ts` |
| التتبع وحلقة التعلّم (PH8) | **منفَّذ** | صفحة `/tracking` + `tracking-store.ts` + `candidate-rule.ts` |
| الترتيب الصريح وإخفاء اللوحات (PH9) | **منفَّذ** (متناثر) | `DisplayOrderEntry` في v8 + `focusMode/revealedEdge` في المحرر |
| الاحتراف النهائي/Playground (PH10) | **منفَّذ** | `studio/*` + `rule-test-runner`/`profile-compare`/`rule-edit-preview` |

---

## 2. مصفوفة تفصيلية (بند → الملفات المنفِّذة → الاختبارات)

### PH0 — الأساس (DM-01..18، FR-EN-01..04)
| المتطلب | الملفات | الاختبارات |
|---|---|---|
| DM-01..04، DM-06..11، DM-14 (الكيانات: Difference/Variant/Relation/WaqfMark/Correction/EngineRule/EngineConfig… + رتب صريحة + سياق) | `src/lib/tashjeer/model/v8.ts` | `tests/model-v8.test.ts` |
| DM-12 (createBatchId) | `model/v8.ts` + `src/lib/tashjeer/smart-create.ts` | `tests/smart-create.test.ts` |
| DM-13 (تصدير حتمي Git-friendly) | `src/lib/tashjeer/engine-config-store.ts` (تصدير config) | `tests/engine-config-store.test.ts` |
| DM-15 (Undo/Redo) | `src/lib/tashjeer/history/command-log.ts` | `tests/command-log.test.ts` |
| DM-18 (ترحيل v7→v8 + نسخة احتياطية) | `src/lib/tashjeer/migration/migrate-v7-v8.ts` | `tests/migrate-v7-v8.test.ts`، `tests/export-bundle-v6.test.ts` |
| FR-EN-01..03 (فصل/Resolver/Decision API) | `src/lib/tashjeer/decision/{resolver,policy,api,conditions}.ts` | `tests/decision-resolver.test.ts` |
| FR-EN-04 (الثلاثية Engine/Editor/Final) | `src/types/tashjeer.ts` + `manual-correction.ts`/`tracking-store.ts` | `tests/manual-correction.test.ts` |

### PH1 — Engine Studio الأساس (FR-ES-01..06، 10، 14، 16)
| الميزة | الملفات |
|---|---|
| الصفحة | `src/app/(dashboard)/studio/page.tsx` |
| مستكشف القواعد ومنشئها + الحقول | `src/components/studio/{RuleExplorer,RuleBuilder,labels,templates}.tsx` |
| الأولويات والمجموعات + الأنابيب | `src/components/studio/PriorityPipeline.tsx` |
| مصفوفة الدمج | `src/components/studio/MergeMatrixPanel.tsx` |
| ساحة Why؟/الأثر | `src/components/studio/WhyTracePlayground.tsx` |
| تصدير/استيراد config | `src/components/studio/ExportImportPanel.tsx` + `engine-config-store.ts` |
| لوحة المعلومات | `src/components/studio/Dashboard.tsx` |
| سياسة القرار الافتراضية | `src/lib/tashjeer/decision/policy.ts` (`DEFAULT_SYSTEM_PROFILE`) |
| التوثيق | `docs/ENGINE_STUDIO.md` |

### PH2 — التحديد الموحّد والقوائم (FR-ED-01، 02)
- **FR-ED-02 (سياق موحّد):** `src/lib/tashjeer/selection-context.ts`، شريط السياق
  `SelectionBreadcrumb.tsx`، لوحة التفاصيل `PropertiesPanel.tsx`، وبذور التحديد
  `editor-store.ts` (`setSelection`/breadcrumb). الاختبار: `tests/selection-context.test.ts`.
- **FR-ED-01 (قوائم قابلة للتمرير):** حاويات `overflow-y-auto` في لوحات الأوجه/
  العلاقات/الأسطر؛ الرأس Sticky في اللوحات. بند واجهة: يتطلب مراجعة قبول يدوية
  للأداء مع 1000+ عنصر (لم توجد Virtualization).

### PH3 — السحب والحافظة والحذف الجماعي (FR-ED-04..07)
- **FR-ED-04 (سحب لإعادة الترتيب مع تأكيد):** `LineOrderEditor` في
  `src/components/editor/RelationsPanel.tsx` (مقبض سحب، مؤشر إدراج مضيء،
  `window.confirm`، إزاحة المتأثرين). منطق النقل: `src/lib/tashjeer/manual-links.ts`
  (`moveLineToIndex`/`shiftLineInOrder`) + `editor-store.ts` (`moveLineInOrder`).
  الاختبار: `tests/manual-links.test.ts`.
- **FR-ED-05 (دمج بالسحب):** مقبض دمج في `RelationsPanel.tsx` (`commitMerge`).
- **FR-ED-06 (حافظة موحّدة):** `editor-store.ts` (`copySelection/cutSelection/pasteSelection`)
  + `src/hooks/useKeyboardShortcuts.ts` (Ctrl+C/X/V). الاختبار: `tests/editor-manual-actions.test.ts`.
- **FR-ED-07 (تحديد متعدد وحذف جماعي):** `editor-store.ts` + `tests/editor-bulk-actions.test.ts`.

### PH4 — تعدد الاختلافات (FR-ED-03، DM-09)
- `editor-store.ts` يدعم عدة اختلافات لنفس القارئ/الموضع. الاختبار:
  `tests/editor-multi-difference.test.ts` (منفّذ على المدود وعلاقات التنافي).

### PH5 — الإنشاء الذكي الموحّد (FR-ED-08، 09)
- `src/lib/tashjeer/smart-create.ts` + `src/lib/tashjeer/smart-create-store.ts`
  + `src/components/editor/SmartCreateWizard.tsx`. الاختبارات:
  `tests/smart-create.test.ts`، `tests/smart-create-store.test.ts`.

### PH6 — التعميم والاستقلال المحلي (FR-ED-10، DM-08)
- `src/lib/quran-logic/global-rule-engine.ts`، `src/lib/storage/rule-occurrences-store.ts`
  (مع `localOverride`/`occurrenceLog`)، `src/components/editor/GlobalRuleBuilder.tsx`.
  الاختبارات: `tests/global-rule-engine.test.ts`، `tests/rule-occurrences-store.test.ts`.

### PH7 — الوقف/الوصل/الابتداء/ممنوع الوصل (FR-ED-11، DM-06/07/11)
- وصل الآيتين: `src/lib/tashjeer/reading-window.ts` (`tests/reading-window.test.ts`).
- ممنوع الوصل/القراءة: `editor-forbidden-wasl.test.ts`.
- العزل البصري الجزئي والجوانب الداخلية للوقف/الابتداء تُقيَّم بالواجهة
  (RecitationControls) — يُوصى بمراجعة يدوية لمعايير AC-03.

### PH8 — القواعد والتتبع وحلقة التعلّم (FR-ED-15، 16، FR-ES-12، 15)
- `/tracking`: `src/app/(dashboard)/tracking/page.tsx` + `src/lib/storage/tracking-store.ts`.
- القاعدة المرشّحة / Create Rule from Correction: `src/lib/tashjeer/decision/candidate-rule.ts`
  + `src/components/studio/CandidateRulesPanel.tsx`. الاختبار: `tests/candidate-rule.test.ts`.

### PH9 — الترتيب الصريح + إخفاء اللوحات (FR-ED-12، 14)
- `DisplayOrderEntry` معرَّف في `model/v8.ts`؛ وترتيب الأئمة/الرواة/الطرق عبر حقل
  `order` في `catalog.ts` و`reader-symbols.ts`/`ordering.ts`.
- إخفاء/إظهار اللوحات بالحواف + التثبيت: `focusMode`/`revealedEdge` في صفحة
  `src/app/(dashboard)/editor/page.tsx`.
- **ملاحظة:** «displayOrder صريح موحّد على كل الواجهات مع واجهة إعادة تسلسل في
  /admin» لم أرَ تطبيقًا موحّدًا كاملًا يقرأه كل العرض/الترميز؛ يستند العرض الحالي
  إلى `order` في الكتالوج. بند قابل للترميز مستقبلًا لفرض DM-04 في كل المسارات.

### PH10 — Playground/Sandbox/Compare/Dashboard (FR-ES-07..09، 11..13)
- اختبارات قواعد + انحدار: `rule-test-runner.test.ts`، `rule-edit-preview.test.ts`.
- مقارنة ملفات/إصدارات: `profile-compare.ts` + `profile-compare.test.ts`؛ تدقيق:
  `profile-audit.test.ts`؛ مخزن الملفات: `profile-storage.ts` + اختباره.

---

## 3. سيناريوهات القبول (AC-01..AC-06)
| السيناريو | حالة الكود | ملاحظة |
|---|---|---|
| AC-01 حلقة البيانات الكاملة | منفَّذ منطقيًا (المكوّنات أعلاه) | يتطلب مراجعة قبول يدوية كاملة من الواجهة |
| AC-02 حلقة تعليم المحرك | منفَّذ (`candidate-rule` + `/studio`) | يتطلب فحص ربط «أنشئ قاعدة من التصحيح» من المحرر |
| AC-03 الوقف/الوصل | منفَّذ جزئيًا | أعمق فجوة بند الواجهة — توصية PH7 يدويًا |
| AC-04 الحافظة الجزئية | منفَّذ | `editor-manual-actions.test.ts` |
| AC-05 إعادة الترتيب بالسحب | منفَّذ | `manual-links.test.ts` + UI |
| AC-06 التحديد الموحّد | منفَّذ | `selection-context.test.ts` + لوحات المحرر |

---

## 4. الخطوات المتبقية فعليًا

### 4.1 خارج نطاق هذه الوثيقة (بحسب SRS §0.1.5 وREADME «ما لم يُنجز»)
- إدخال المادة العلمية للقراءات وتحقيقها (عمل بشري بحت، والبيانات المرفقة DRAFT).
- الانتقال إلى PostgreSQL وتفعيل Prisma.
- المصادقة والصلاحيات.
- تحرير الطرق (الأزرق/الأصبهاني) وأرقام صفحات مصحف المدينة.
- اختبارات E2E (Playwright).

### 4.2 توصيات تكميلية (تحسينية، غير حاجبة)
- **FR-ED-14:** توحيد `displayOrder` رقمي صريح واحد يقوده كل العرض/الرموز/التصدير
  مع واجهة إعادة تسلسل في `/admin` (حاليًا حقل `order` متناثر عبر `catalog.ts`
  و`reader-symbols.ts`). — أعلى قيمة معماريًا بين ما تبقّى.
- **FR-ED-01:** Virtualization لقوائم 1000+ مشتق إن قيست حاجة أداء فعلية.
- **AC-03/PH7:** إتمام عرض «الجزء المعزول فقط» وعلامات الابتداء الداخلية إن نُقصت
  في واجهة معيّنة.
- مراجعة قبول يدوية شاملة لـ AC-01..AC-06 من الواجهة (الوحدة النمطية لا تُغني عنها).

### 4.3 ما أُنجز في هذه الجلسة (تنظيف الجودة — بلا تغيير سلوك)
- إزالة خمس رموز ميّتة جعلت `eslint` نظيفًا بلا تحذيرات:
  `MarkedFocusButton` (RecitationControls)، `intersectsSegment` (classic-tashjeer)،
  `emptyResult` + متغيّر `blocked` (decision/api)، ومعامل `options` (resolver).
  التحقق: `tsc` نظيف، `eslint` نظيف، **454 اختبارًا ناجحًا كما كانت**.
- إضافة هذا الملف كأداة تتبّع/حالة.

---

## 5. طريقة إعادة التحقق
```bash
npm test            # 454 ناجحًا / 2 متخطّى
npm run typecheck   # tsc --noEmit  نظيف
npx eslint "src/**/*.{ts,tsx}"   # 0 مشكلة
npm run build       # البناء الكامل
```
