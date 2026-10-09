# بروتوكول التغيير وربط الهوية

هذا البروتوكول جزء من **Project Feature & UI Identity Registry**. مصدر التعريف الآلي الوحيد هو `src/ui/feature-registry.ts` و`src/ui/ui-registry.ts`. ملفا `UI_REGISTRY.md` و`FEATURE_REGISTRY.md` و`PROJECT_MAP.md` وثائق مولّدة؛ لا تعدّلها يدويًا.

## قبل أي تعديل

1. **افحص HEAD الفعلي.** اقرأ مكوّن الصفحة والـ component والـ store/engine المعنيين والاختبارات. لا تستخدم README أو وثيقة قديمة بدل الكود الجاري.
2. **حدّد الهوية أولًا.** ابحث في `UI_REGISTRY` عن الـ ID المطلوب، ثم تحقّق من الاسم والميزة والأب والمسار والملف والسلوك. لا تخمّن ID من الذاكرة أو من أرقام مجاورة.
3. **تتبّع الأثر.** اتبع `parentId` و`dependencies` و`relatedIds` وخريطة الطبقات في `FEATURE_REGISTRY`. ميّز بين UI، Store، Engine، Data Model، Persistence، Tests.
4. **سجّل خط الأساس.** شغّل الاختبار/النوع/الفحص المتاح قبل التعديل، وسجّل الإخفاقات السابقة كما هي. لا تصلح عطلًا خارج النطاق تلقائيًا.
5. **اكتب نطاقًا أدنى.** حدّد ما سيتغير وما لن يتغير قبل التنفيذ. تعديل العرض وحده لا يبرر تغيير النص أو UX أو state management أو business logic أو نموذج البيانات أو قواعد المحرك أو architecture.

## قواعد الهوية الدائمة

- كل Feature أو UI identity له معرّف عالمي ثابت بصيغة `A001`، `A002`، …؛ الرقم لا يستمد من ترتيب القائمة أو النص العربي أو ترتيب React.
- قبل تخصيص ID، ابحث في السجل والشفرة ودفتر `RETIRED_UI_IDS`. لا تنقل ID من عنصر إلى آخر ولا تعِد استعمال ID متقاعد.
- تغيير الاسم أو النص أو الموقع أو التصميم لا يغير الهوية ما دام المفهوم والسلوك الأساسيان للعنصر هما نفسيهما.
- أضف سجلًا وصفيًا كاملًا: `kind`, `name`, `featureId`, `parentId`, `route`, `component`, `sourceFile`, `description`, `status`, `behavior`, `constraints`, `dependencies`, `relatedIds`, `codeReferences`.
- `codeReferences` لأسماء الدوال/المتغيرات/المفاهيم البرمجية؛ ليست UI IDs. لا تمنح A-ID لكل دالة أو عنصر HTML زخرفي.
- اربط العنصر الفعلي بـ`data-ui-id="Axxx"`. إذا تكرر قالب صف/تحكم وكان تتبع نسخة بعينها مفيدًا، أضف `data-ui-instance` بمفتاح المجال الثابت، لا بترتيب العرض. الربط الديناميكي مسموح فقط بمصدر قيم ثابت ومتحقق منه، وتبقى قيمة ID نفسها من السجل.
- عند إزالة مفهوم، احذف العلامة من DOM، غيّر الحالة إلى `retired`، وألحق ID بـ`RETIRED_UI_IDS`. لا تمسح أثره التاريخي ولا تعِد استعماله.

## أثناء التنفيذ

- اتبع مسار التنفيذ الحالي. إذا ظهر أن التغيير يمس store أو engine أو data model، أثبت الضرورة من السلوك الفعلي، وسّع النطاق المعلن بأقل قدر، ثم أضف اختبارًا يغطيه.
- لا تنشئ مصدر حقيقة ثانيًا، ولا تكرر منطق resolver أو engine في طبقة العرض.
- لا تنقل أو تعِد تسمية ملفات لمجرد التفضيل. حافظ على RTL والعربية، ولا تجعل ID تابعًا للنص العربي.
- عند إضافة نقطة تحكم مهمة، حدّث سجلها وعلامة DOM وخريطة الأثر والاختبار/الوثائق ذات الصلة في التغيير نفسه.
- لا تستخدم `data-ui-id` على أكثر من مفهوم مختلف. تكرار ID مسموح فقط لنسخ العنصر المفاهيمي نفسه، مع `data-ui-instance` عند الحاجة.

## بعد التنفيذ والتحقق

1. حدّث التوثيق المولّد: `npm run registry:docs`.
2. شغّل `npm test -- tests/ui-registry.test.ts`، ثم الاختبارات المتأثرة.
3. شغّل `npm run typecheck`, `npm run lint`, `npm run build` والاختبارات العامة المتاحة. قارن النتيجة بخط الأساس، وميّز الإخفاق القديم عن الجديد بدليل لا بافتراض.
4. افحص أن كل route ID مربوط بالصفحة الصحيحة، وأن جميع العلامات المسجلة موجودة في ملفها، ولا توجد علامة orphan أو متقاعدة، ولا إحالة أب/اعتماد غير صالحة.
5. اختبر المسارات التي طلبها المستخدم في runtime قدر الإمكان، وسجّل أخطاء الصفحة/المتصفح أو قيود بيئة الاختبار بوضوح.
6. راجع `git diff` للتأكد من minimal scope ومن عدم تغير business logic أو النصوص أو السلوك بلا ضرورة موثقة.

## تصنيف ملاحظات التدقيق

- **P0 — حرج:** فقد/فساد بيانات واسع، خرق خصوصية/أمان، أو منع إطلاق فوري.
- **P1 — مرتفع:** تعطل مسار أساسي أو قرار محرك/بيانات غير صحيح على نطاق جوهري.
- **P2 — متوسط:** عطل موثق في وظيفة مهمة مع بديل أو نطاق محدود.
- **P3 — منخفض:** مشكلة UI/قابلية استخدام أو توثيق لها أثر محدود.
- **P4 — ملاحظة:** تحسين/تنظيف أو فجوة غير مانعة، دون أثر وظيفي مباشر مثبت.

لا تصنف الملاحظة كعيب مثبت ما لم يمكن إعادة إنتاجها أو ربطها بكود/اختبار. افصل الدين التقني الموجود قبل التغيير عن الانحدار الذي أدخله التغيير.

## أوامر مرجعية

```bash
npm run registry:docs
npm test -- tests/ui-registry.test.ts
npm test
npm run typecheck
npm run lint
npm run build
```

## Exact-ID change contract

Run `npm run registry:lookup -- A333` first. The ledger is `src/ui/ui-registry.records.json`, exposed by `ui-registry.ts`. For replacement of the same conceptual control, retain its ID and update kind/action metadata. For a genuinely new concept, retire the old ID and allocate a never-used number after checking both ledgers. Never rerun a bulk allocation script or renumber records.

Before changing an ID, report:

```text
Requested: A333
Directly affected: A333
Required dependency changes: [files/IDs with concrete reason, or none]
Unaffected: [neighboring/relevant IDs]
```

Update event/store/test metadata when implementation changes. A new meaningful control needs its own record and actual DOM attribute in the same patch. Run `npm run registry:validate`, regenerate docs, run targeted tests, typecheck, lint, build and smoke tests. The scanner's wrapper list must be updated when introducing a forwarding control. Retired records remain permanently; do not delete their historical ownership metadata.
