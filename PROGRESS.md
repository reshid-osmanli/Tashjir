# سجل تقدم الحزم — Work Package Progress

> يُحدَّث صف الحزمة عند **البدء** وعند **الانتهاء**. إن لم تُكمل الحزمة:
> P0 ثم P1 ثم P2، مع تسجيل المتبقي بمعرفاته وأولويته في عمود «المتبقي».

الحالات: `⬜ لم تبدأ` · `🟡 جارية` · `✅ مكتملة` · `🔶 مكتملة جزئيًا`

| # | الحزمة | المرحلة | الحالة | المتبقي / ملاحظات |
|---|---|---|---|---|
| 01 | النموذج الموحّد v8 + التصدير الحتمي (DM-13/14) | PH0 | ✅ | `src/lib/tashjeer/model/v8.ts`، `engine-config-store.ts` (تسلسل كنسي)، AuditLog في المستند. |
| 02 | Engine Studio: الأولويات + المنشئ + المصفوفة + Why | PH1 | ✅ | `/studio`: `RuleExplorer`، `RuleBuilder`، `MergeMatrixPanel`، `PriorityPipeline`، `WhyTracePlayground`، `resolver.ts`، `api.ts`. |
| 03 | القوائم الطويلة والأداء (NFR-01) | PH2 | ✅ | `useWindowedList` (نافذة عرض + حشوات + قياس فعلي). |
| 04–08 | المحرر/التتبع/الربط الثنائي | PH3–PH9 | ✅ | انظر `docs/EDITOR.md`. |
| 09 | الربط الثنائي مع المحرر (روابط عميقة + لماذا؟) | PH9 | ✅ | `/editor?rule=`، `/studio?rule=`، `WhyTraceDialog`. |
| **11** | **مستكشف القواعد والإصدارات والتدقيق واختبارات القواعد** | **PH10a** | **✅ مكتملة** | البدء والانتهاء: 2026-09-13. FR-ES-07 · FR-ES-08. لا متبقٍ. |
| 12 | Playground/Sandbox/Profiles/Dashboard الاستخدام | PH10b | ⬜ | خارج نطاق الحزمة 11. |

---

## الحزمة 11 — سجل التنفيذ

**بدأت:** 2026-09-13 · **الفرع:** `arena/01a09b2b-tashjir`

### نتائج فحص الافتراضات (§5)

| الافتراض | النتيجة |
|---|---|
| الحزمة 02: `EngineRule` كامل (id, name, category, scope, conditions, actions, priority, groupId, hardness, status, version, testCases) | ✅ موجود في `model/v8.ts` + `dependsOn/overrides/conflictsWith/protected/specificity`. |
| الحزمة 02: `/studio` بالأولويات والمنشئ والمصفوفة وWhy | ✅ موجود (10 أقسام). |
| الحزمة 01: AuditLog في النموذج | ✅ `TashjeerDocumentV8.auditLog` (على مستوى المستند). |
| الحزمة 01: حتمية التصدير (DM-13) | ✅ `toCanonicalConfig` / `serializeEngineConfig` مختبرة. |
| **ناقص**: Audit Trail على مستوى **Engine Studio** (User/Action/Rule/Before/After/Reason/Timestamp) | ❌ → يُنفَّذ في هذه الحزمة (`rule-audit.ts`). |
| **ناقص**: Versioning على مستوى **القاعدة الواحدة** (سجل الإصدارات الموجود على مستوى الملف كله) | ❌ → يُنفَّذ (`rule-versions.ts`). |
| **ناقص**: انتقالات حالة محكومة + وسم `CONFLICTED` التلقائي | ❌ → يُنفَّذ (`rule-status-flow.ts`). |
| **ناقص**: Dependency Graph + Visual Decision Graph | ❌ → يُنفَّذ (`rule-dependencies.ts`، `decision-graph.ts`). |
| **ناقص**: تشغيل Test Cases في `npm test` (اكتشاف الانحدار في CI) | ❌ → يُنفَّذ (`tests/rule-test-suite.test.ts` + حالات على قواعد النظام). |
| `PROGRESS.md` | ❌ غير موجود في المستودع → أُنشئ هنا (هذا الملف). |

### قرارات حُسمت بالأكثر أمانًا (§2.6)

1. **أين يعيش Audit Trail وسلسلة إصدارات القاعدة؟** في مخزنين مخصّصين
   (`tashjeer:rule-audit:v1`، `tashjeer:rule-versions:v1`) **لا** داخل لقطة كل
   إصدار من إصدارات الملف. السبب: تضمين السجل في كل لقطة يجعل التخزين
   تربيعي النمو (٤٠ نسخة × ن سجل) ويكسر مبدأ «الحفظ المطابق لا يُكرَّر».
   ومع ذلك **يدخل السجلان التصدير** عبر حزمة تصدير واحدة حتمية
   (`exportGovernanceBundle`) فيها `config + ruleVersions + auditTrail`،
   والاستيراد يعيدهما (round-trip مختبر).
2. **`EngineConfig.schemaVersion` يبقى 1**: الحقول الجديدة اختيارية
   (`ruleVersions?`، `auditTrail?`) في «حزمة الحوكمة» لا في ملف الإعداد نفسه،
   فلا يُكسر أي ملف مُصدَّر سابق ولا أي اختبار قائم.
3. **User في Audit** = `local-editor` افتراضيًا (بنية المصادقة جاهزة: `actor`).
4. **Deprecate لا يحذف**: إيقاف موثّق + التاريخ كامل.
5. **بلا حد لإصدارات القاعدة**؛ تنبيه حجم بعد ٥٠ إصدارًا (لا حذف تلقائي).
6. **الرسوم بـ SVG داخلي** (بلا مكتبة جديدة): قابل للتنقل والتفاعل وRTL.
7. **`CONFLICTED` تلقائي** عند تعارض غير محسوم بسلم السياسة (السلم يعيد
   «لم يحسم السلم — المرجّح الأول»): تُوسم القواعد المعنية وتُعرض بلون تحذيري،
   والوسم **قابل للتراجع** ولا يمسّ الإصدارات السابقة.
8. **تأكيد القاعدة المحمية** بحوار مخصّص يطلب **سببًا نصيًا إلزاميًا**
   (`reason-confirm-store`) بدل توسيع `confirmAction` القائم (حتى لا يتغيّر
   سلوك ٤٠+ موضع استدعاء مختبر).

### المهام

| المهمة | الأولوية | الحالة | المخرجات |
|---|---|---|---|
| T1 مستكشف القواعد (بحث/تصفية/ترتيب/شجرة/نافذة عرض/روابط) | P0 | ✅ | `rule-explorer-model.ts`، `RuleExplorer.tsx` |
| T2 دورة الحالة والانتقالات المحكمة + الوسم التلقائي | P0 | ✅ | `rule-status-flow.ts`، `RuleMetadataPanel.tsx` (أزرار الانتقال)، `engine-config-ui-store.ts` (`setRuleStatusAction`، `syncConflictTags`) |
| T3 Versioning + الرجوع + فرق الإصدارين | P0 | ✅ | `rule-versions.ts`، `rule-diff.ts`، `RuleMetadataPanel.tsx` (السلسلة والمقارنة والرجوع) |
| T4 Metadata كاملة + Protected + Audit Trail | P0 | ✅ | `rule-audit.ts`، `RuleMetadataPanel.tsx`، `AuditTrailPanel.tsx` |
| T5 Dependency Graph + Visual Decision Graph | P1 | ✅ | `rule-dependencies.ts`، `decision-graph.ts`، `RuleDependencyGraph.tsx`، `DecisionGraphView.tsx` |
| T6 Test Cases + الانحدار الآلي + `npm test` | P0 | ✅ | `rule-test-suite.test.ts`، حالات على قواعد النظام، بوابة الحفظ بالسبب الإلزامي |
| التوثيق | — | ✅ | `docs/ENGINE_STUDIO.md`، `docs/DATA.md` |

### التحقق من معايير القبول (§3)

| # | المعيار | كيف تحقّق | الدليل |
|---|---|---|---|
| ١ | كل القواعد مصنّفة، بحث/تصفية/ترتيب، و٣٠٠+ قاعدة تمرّ بسلاسة | ١١ دلوًا تصنيفيًا (الفئة أولًا ثم النوع احتياطًا)، ٧ مرشّحات، ٧ مفاتيح ترتيب، ونافذة عرض `useWindowedList` | `tests/rule-explorer-model.test.ts` (٢٥، منها أداء على **٥٠٠ قاعدة**) |
| ٢ | تحذير عند تعديل قاعدة مفعّلة، وتأكيد إضافي بسبب إلزامي للمحمية | `buildEditGuard` (تحذير + عداد استخدام + عدد حالات الاختبار)، و`confirmWithReason` | `tests/rule-status-flow.test.ts` (حارس التعديل)، `tests/rule-governance.test.ts` |
| ٣ | ٣ تعديلات ← ٣ إصدارات بأسباب ← رجوع إلى v١ ينشئ v٤ موثّقًا ولا يضيع شيء | `recordVersion` (بلا تكرار عند التطابق) + `rollbackToVersion` (إضافة، لا حذف) + `diffVersions` | `tests/rule-versions.test.ts`، `tests/engine-studio-store.test.ts` (٣ إصدارات ← رجوع ← v٤ بسبب و`rollbackOf`) |
| ٤ | Audit Trail يسجّل كل عملية (قبل/بعد/سبب/وقت)، لوحة قابلة للتصفية، ويدخل التصدير | `createAuditEntry` (يشتق قبل/بعد تلقائيًا)، `filterAuditEntries` + `auditFacets`، `exportGovernanceBundle` | `tests/rule-audit.test.ts`، `tests/engine-governance.test.ts` (جولة تصدير/استيراد كاملة) |
| ٥ | حالة اختبار «لا تدمج فرش+مد» تفشل عند تعديل القاعدة للسماح بالدمج، وإنذار انحدار قبل الحفظ | `decideMerge` صار يقارن القاعدة الصريحة بمصفوفة الدمج عبر سلم السياسة، و`previewRuleEdit` يشغّل الحالات عند كل تغيير في المسودة | `tests/rule-test-suite.test.ts` (كشف الانحدار)، `tests/rule-edit-preview.test.ts` |
| ٦ | `npm test` يشغّل كل TestCases ويفشل عند الانحدار | محمّل CI يشغّل حالات `DEFAULT_SYSTEM_PROFILE` **وكل** `tests/fixtures/engine-profiles/*.json` | `tests/rule-test-suite.test.ts` + `tests/fixtures/engine-profiles/example-minimal.json` |
| ٧ | كل الاختبارات القائمة خضراء + typecheck + build | — | **٦٧٣ ناجحة / ٢ متخطاة (٥٩ ملفًا)**، `tsc --noEmit` نظيف، `next lint` نظيف، `next build` نظيف (`/studio` ‏٤٥٫١ كيلوبايت)، و`/studio` يعيد ٢٠٠ |

### قرارات أُضيفت أثناء التنفيذ

9. **تعادل الأولوية ليس تعارضًا إلا إن تقاطع الشرطان.** كان فرع
   `PRIORITY_TIE` في `findUnresolvedConflicts` يسم كل قاعدتين متناقضتي الأفعال
   بنفس الأولوية والمجموعة، فتظهر إنذارات عن قاعدتين **لا يمكن أن تتقابلا في
   المحرك أصلًا** (قيداهما على نوعَي اختلاف مختلفين). صار الفرع يستعمل نفس حكم
   الفحص القائم (`extractDifferenceType` + `typesOverlap` — أُخرجت للمشاركة بدل
   تكرارها)، والقاعدة الشاملة (بلا قيد نوع) ما تزال تتقاطع مع كل شيء.
   الاختبار التكاملي للوسم التلقائي عُزل على نوع اختلاف «HAMZ» حتى يقيس
   التعارض المقصود وحده، وأُضيف اختبار يثبت أن تعارض قاعدة محرّر مع قاعدة
   نظام مرجعية **يُكشف ولا يُخفى**.
10. **تصحيح لفظ عربي:** حالة `CONFLICTED` كانت معروضة «متعرضة» في
    `components/studio/labels.ts` (خطأ سابق للحزمة)، وصُحّحت إلى «متعارضة»
    لتطابق بقية الواجهة والمستندات.

### ملاحظات التحقق

- المتصفح غير متاح في بيئة التنفيذ (تنزيل Chromium محجوب)، فالتحقق من الواجهة
  تمّ بـ: توليد المكوّنات على الخادم `renderToStaticMarkup`
  (`tests/studio-components-render.test.ts` — ١٤ اختبارًا تحرس النص العربي،
  والأرقام العربية، و`dir="ltr"` للمعرّفات، وSVG الداخلي، وغياب أي مكتبة رسم
  خارجية) + SSR ‏`/studio` = ٢٠٠ + البناء الإنتاجي.
- خارج النطاق (للحزمة ١٢): Playground/Dry-run/Impact/Live Preview،
  Sandbox/Profiles/profile-compare، Dashboard الاستخدام والجودة، وإنشاء/تعديل
  القواعد (منجز في الحزمة ٠٢).
