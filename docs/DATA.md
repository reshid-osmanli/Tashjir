# توثيق البيانات - Data Documentation

> مصادر بيانات المشروع، وطريقة توليدها، وحدود الاعتماد عليها.

---

## 1. نص المصحف

### المصدر

| البند | القيمة |
|-------|--------|
| الحزمة | `quran-json@3.1.2` |
| الرخصة | CC-BY-4.0 |
| الرسم | عثماني |
| السور | 114 |
| الآيات | 6236 |
| الكلمات | 77,429 |

### التوليد

```bash
npm run data:quran
```

السكربت `scripts/build-quran-data.mjs` يقرأ من `node_modules/quran-json` وينتج `src/data/quran/mushaf.json` (1.3 ميجابايت).

**لماذا نلتزم بالملف في Git؟** لأن المشروع يجب أن يعمل فور `npm install` دون خطوة توليد، والملف صغير نسبيا ومحتواه ثابت لا يتغير.

**التحقق أثناء التوليد:** السكربت يفشل صراحة إن لم يكن عدد الآيات 6236 أو عدد السور 114. لا يمر نص ناقص بصمت.

### التنظيف

النص يُنظَّف من:
- المسافة العربية غير الفاصلة (`U+00A0`)
- علامات اتجاه النص (`U+200E`, `U+200F`)
- المسافات المكررة والطرفية

**لا يُمس أي حرف أو حركة داخل النص.**

---

## 2. طبقة الوصول

الملف: `src/data/quran/index.ts`

### 2.1 حتمية المعرّفات

هذا أهم قرار تصميمي في طبقة البيانات:

```
معرّف الآية  = رقم السورة × 1000 + رقم الآية
معرّف الكلمة = معرّف الآية × 1000 + ترتيب الكلمة
```

مثال: الكلمة الأولى من الفاتحة 4 → `1004001`

**لماذا؟** لأن خط التشجير المحفوظ يشير إلى الكلمة بمعرّفها. لو كانت المعرّفات مولّدة عشوائيا أو مرقّمة تسلسليا من قاعدة بيانات، لانفصل كل عمل محفوظ عن مرجعه عند أي إعادة تحميل أو ترحيل.

بالصيغة الحتمية: المعرّف يُحسب من الموضع، والموضع لا يتغير أبدا.

### 2.2 التحميل الكسول

الكلمات **لا** تُحمَّل مسبقا لكل المصحف (77 ألف كلمة). تُشتق عند الطلب وتُخزَّن في `Map`:

```ts
getAyahWords(2, 255)  // أول نداء: يحسب
getAyahWords(2, 255)  // النداءات التالية: نفس المرجع
```

### 2.3 التطبيع والبحث

| الدالة | الوظيفة |
|--------|---------|
| `stripHarakat` | يزيل الحركات وعلامات الضبط والألف الخنجرية |
| `normalizeForSearch` | + توحيد الهمزات والألف المقصورة والتاء المربوطة |
| `searchQuran` | بحث في المصحف كله بلا تشكيل، مع حد للنتائج |

ملاحظة مهمة: `stripHarakat('مَٰلِكِ')` تعطي `ملك` لا `مالك`، لأن الألف هنا خنجرية (علامة ضبط) لا حرفا مرسوما. هذا سلوك مقصود وموثّق في الاختبارات.

### 2.4 أرقام الصفحات

⚠️ أرقام الصفحات في `SURAHS` **تقريبية** ومحسوبة من توزيع الآيات على 604 صفحة. ليست أرقام مصحف المدينة الرسمية. تُستخدم للعرض فقط ولا يُبنى عليها حكم.

---

## 3. القراء والرواة والطرق

الملف: `src/data/qiraat-data/qiraat.ts`

| الطبقة | العدد | الحالة |
|--------|-------|--------|
| الأئمة العشرة | 10 | كاملة |
| الرواة العشرون | 20 | كاملة |
| الطرق | 40 | بذرة أولية |

الطرق الأربعون بذرة للتشغيل. النموذج (`TransmissionNode` / `TransmissionPath` / `TransmissionPathNode`) مصمَّم ليستوعب 980+ طريقا. انظر `docs/TRANSMISSIONS.md`.

### تمييز الرواة المتشابهين

الدوري راو عن أبي عمرو **وعن** الكسائي. الدالة `getNarratorName` تكشف التكرار وتضيف اسم الإمام تلقائيا:

```ts
getNarratorName('narrator-al-duri-abu-amr')  // "الدوري (أبو عمرو)"
getNarratorName('narrator-al-duri-kisai')    // "الدوري (الكسائي)"
getNarratorName('narrator-hafs')             // "حفص"
```

---

## 4. الاختلافات الأولية

الملف: `src/data/variants/seed-variants.ts`

### ⚠️ تنبيه منهجي

**كل الاختلافات في هذا الملف بحالة `DRAFT` (مسودة).**

هي بذرة أولية لتشغيل المحرر واختباره، **وليست مادة علمية معتمدة**. لا يجوز الاعتماد عليها قبل:

1. مراجعة مختص مجاز.
2. مقابلتها على *النشر في القراءات العشر* و*طيبة النشر*.
3. رفع الحالة إلى `APPROVED` من داخل المشروع.

نصوص الأدلة المرفقة **إشارات إلى مواضع البحث** في المصادر، وليست اقتباسا حرفيا من المنظومة. إدخال النص الحرفي ورقم البيت مهمة المدقّق البشري.

### المواضع المغطاة

| الموضع | الاختلاف | الفئة |
|--------|----------|-------|
| 1:4 | `مَٰلِكِ` / `مَلِكِ` | فرش |
| 1:7 | `عَلَيۡهِمۡ` ضم الهاء | أصول |
| 1:7 | `ٱلضَّآلِّينَ` المد اللازم | مدود |
| 2:3 | `يُؤۡمِنُونَ` إبدال الهمز | همز |
| 2:6 | `ءَأَنذَرۡتَهُمۡ` الهمزتان | همز |
| 2:9 | `يَخۡدَعُونَ` / `يُخَٰدِعُونَ` | فرش |
| 2:9 | `إِلَّآ أَنفُسَهُمۡ` المد المنفصل | مدود |
| 2:10 | `يَكۡذِبُونَ` / `يُكَذِّبُونَ` | فرش |
| 112:4 | `كُفُوًا` ثلاثة أوجه | فرش |

اختيرت لتغطية كل الفئات ولتشمل حالات صعبة: اختلاف بثلاثة أوجه، واختلاف يمتد على كلمتين، وحكم أصولي يقرأ به إمامان.

### التحقق الآلي

اختبارات `tests/branch-engine.test.ts` تفحص:

- كل اختلاف فيه وجه أساس واحد على الأقل.
- كل الاختلافات بحالة مسودة (حراسة على عدم اعتماد بيانات غير مراجعة).
- كل المواضع داخل حدود آياتها الفعلية.

---

## 5. تخزين عمل المستخدم

| المفتاح | المحتوى |
|---------|---------|
| `tashjeer:doc:v2:{ayahKey}` | مستند تشجير آية |
| `tashjeer:doc-index:v2` | فهرس المستندات المحفوظة |
| `tashjeer:reviews:v2` | قرارات المراجعة |
| `tashjeer:readers:v2` | القراء والإجازات |
| `tashjeer:settings:v2` | إعدادات المحرر |
| `tashjeer:global-rules:v1` | القواعد العامة للمصحف كله |
| `tashjeer:rule-occurrences:v1` | استثناءات المواضع + سجل التغييرات |

كل ذلك في `localStorage` في هذه المرحلة. صفحة الإعدادات توفّر تصدير نسخة احتياطية كاملة واستيرادها.

### 5.1 التجاوز المحلي للمواضع (FR-ED-10)

الاستثناء (`RuleOccurrenceOverride`) سطر واحد بمعرّف مركّب مستقر
(`global:<ruleId>:<ayahKey>:<start>:<end>:<charStart>:<charEnd>`) لا يتغير
بالترقيع. حقله `patch` يحمل القيم البديلة لهذا الموضع وحده: العنوان،
النوع، الوصف، المصدر، الحكم المختصر، المد، النطاق، نص الوجه، تسميته،
ملاحظاته، وسبب التجاوز.

- **دمج لا استبدال**: `setLocalOverride` يدمج الحقول المعطاة فوق الترقيع
  القائم، وتمرير `undefined` لحقل يحرّره فيعود مشتقًا من القاعدة الأمّ.
- **الحالة مستقلة عن القيم**: التحرير لا يغيّر محذوفًا ولا معتمدًا،
  و«إلغاء التجاوز» يمحو القيم المخصصة (ترقيعًا ودرجة ورتبة) ويُبقي الحالة.
- **العرض = المشتق + الدمج** (`variantFromGlobalMatch`): لا تُنسخ القاعدة
  إلى آلاف المستندات، وشارة `hasLocalOverride` ترفع على الموضع المتجاوَز.
- **سجل المواضع قبل/بعد**: كل تحرير يسجّل `changes` (الحقل والقيمة قبلها
  وبعدها) مع السبب والتاريخ.
- **الدفعات**: القواعد المُنشأة معًا من المعالج تشترك في `createBatchId`
  وتُدرج برتب صريحة متجاورة (`saveGlobalRuleBatch`)، وتبقى كل قاعدة مستقلة
  في التحرير والحذف اللاحقين.
- **التراجع الموحد**: لقطة التراجع في المحرر ثلاثية (مستند + استثناءات +
  قواعد)، وحذف الأمّ يُلتقط مع استثناءاته (`captureGlobalRuleDeletion`)
  فيُستعاد كاملًا بالتراجع.

⚠️ **تفريغ بيانات المتصفح يمسح كل العمل.** صدّر نسخة احتياطية دوريا حتى تُفعَّل قاعدة البيانات.

---

## 6. الانتقال إلى قاعدة البيانات

الأساس جاهز:

- مخطط Prisma كامل في `prisma/schema.prisma`.
- ملف بذور في `prisma/seed.ts`.
- واجهات `/api/transmissions` تخدم من البيانات الثابتة بنفس شكل الرد المتوقع من قاعدة البيانات.
- مخزن المستندات واجهة مغلقة بأربع دوال.

خطوات التفعيل حين يحين وقتها:

```bash
# 1. اضبط DATABASE_URL في .env
# 2. ولّد العميل وادفع المخطط
npm run db:generate
npm run db:push
npm run db:seed

# 3. استبدل أجسام الدوال الأربع في document-store.ts
# 4. استبدل جسم GET في route.ts بالاستعلام
```

لا يحتاج أي مكوّن في المحرر إلى تعديل.

---

## 7. النموذج الموحّد v8 والترحيل (PH0 — DM-01→DM-18)

المرحلة PH0 أضافت نموذجًا موحّدًا في `src/lib/tashjeer/model/v8.ts` يوسّع النموذج
القائم (انظر `docs/SCHEMA.md` للتفصيل الكامل بأمثلة JSON لكل كيان). يغطي DM-01→DM-18.

### 7.1 DM-01 Difference — الاختلاف كيان من الدرجة الأولى
- **ID مستقل**: بادئة + ULID قصير (مثل `v-2004-11-mt3y24ml-yp45`)، لا يتغير ولا يُعاد استخدامه (P-03).
- **الموضع Locus**: `{ startPosition, endPosition, characterRange?, loci? }` — كلمة أو حرف أو مدى.
- **الفئة**: `USUL | FARSH | MADUD | HAMZ | WAQF | TAJWEED`.
- **سياق الوقف/الوصل (DM-06)**: `context: ALWAYS | WAQF_ONLY | WASL_ONLY`.
- **النطاق**: بنية v7 نفسها `ReadingScope { kind: ALL|ALL_EXCEPT|IMAMS|NARRATORS|PATHS, ... }`.
- **المصدر**: `source: engine|editor` + `modified_by?: editor` + `version` + `createdAt/updatedAt`.
- **الرتبة الصريحة (DM-04)**: `rank` + `orderRank` + `variantOrder[]`.
- **العلاقات**: `relations: Relation[]` بمعرفات فقط.
- **الأوجه**: `variants: Variant[]`.
- **تعدد الموضع (DM-09)**: `occurrenceIndex` (الأول/الثاني…) + `createBatchId?` للتتبع فقط (DM-12).
- **الاشتقاق**: `isGlobalDerived?` + `globalRuleId?` + `engineSnapshot?`.

### 7.2 DM-02 Variant — الوجه كيان مستقل
- `id`, `text`, `label`, `scope`, `isBase?`, `strengthDegreeId?`, `strengthByNarrator?`, `rank` (صريح)، `ruleLabel?`, `maddHarakat?`, `notes?`, `evidences?`, `source`, `modified_by?`, `createdAt/updatedAt`.

### 7.3 DM-03 Relation — علاقة بمعرفات فقط
- `Relation { id, type: MERGE|COMPOSITE|PART_OF|RELATED|MUTUALLY_EXCLUSIVE|MANUAL_LINK, fromId, toId, note?, source, createdAt }` — ممنوع الإشارة إلى موضع مؤقت أو فهرس عرض.

### 7.4 DM-04 رتبة صريحة لكل ما يُعرض
- `Line.order`, `Variant.rank`, `Reader/Narrator/Path.displayOrder`, `Difference.rank/orderRank/variantOrder`.
- **مبدأ**: Display Order ≠ Creation Order ≠ Name Order. الترتيب الافتراضي عند الغياب محدد سلفًا (تحقيق=1، أصول=2، فرش=3…) ولا يعتمد على ترتيب الإدراج.
- يُحسم عبر Decision API `resolveOrder` — انظر `src/lib/tashjeer/ordering.ts`.

### 7.5 DM-05 Source & Correction — ثلاثية المحرك/المحرر/النهائي
- كل كيان `source: engine|editor` + `modified_by?: editor`.
- `Correction { id, targetId, engineResult, editorResult, finalResult, reason?, at, source, promotedToRuleId? }` — Engine=A محفوظة لا تُحذف أبدًا، Final=B.
- يُنشأ في `migrateDocumentToV8` من `engineSnapshot` القديم، وفي `merge-operations.ts` عند تجاوز يدوي لسياسة الدمج.

### 7.6 DM-06 سياق الوقف/الوصل على الاختلاف
- `context: ALWAYS | WAQF_ONLY | WASL_ONLY` — واجهة استخدامه في حزمة 08، لكن الحقل ومنطق قراءته في Resolver مبني الآن (`isContextActive`).

### 7.7 DM-07 WaqfMark — علامة وقف/ابتداء/ممنوع وصل
- `{ id, ayahKey, position, characterIndex?, kind: WAQF|IBTIDA|FORBIDDEN_WASL|WASL, scope: END_OF_AYAH|INTERNAL, connectsToNextAyah?, label?, notes?, source, createdAt }`.

### 7.8 DM-08 GlobalRule و RuleOccurrence مع localOverride
- `GlobalRule` كيان أولي: `id, title, category, pattern (حتمي CHARACTERS|MORPHOLOGY), scope, ruleLabel?, priority, status: DRAFT|ACTIVE|..., version, protected?, createdAt/updatedAt`.
- `RuleOccurrence { id, globalRuleId, ayahKey, locus, confirmed?, modified?, cancelled?, localOverride?: { variantPatch?, cancelled?, note?, by?, at? } }` — تعديل/حذف محلي لا يمس القاعدة ولا بقية المواضع.

### 7.9 DM-09 تعدد الاختلافات لنفس القارئ+الموضع
- المفتاح ليس (قارئ+كلمة) بل معرف مستقل + `occurrenceIndex`.
- لا دمج تلقائي لمجرد تطابق القارئ والموضع. النظام يميز المتنافي (علاقة `MUTUALLY_EXCLUSIVE` يحددها Resolver) من المدمج/المرتبط.
- **مجموعة التعدد** = حدود الموضع (start/end) + مفتاح نطاق القرّاء (اتحاد معرّفات أوجه الاختلاف؛ `ALL` عند الغياب). اختلافان بمفتاح واحد هما «اختلافان لموضع واحد» ويُفهران ١ و٢.
- **الحساب في مكان واحد**: `lib/tashjeer/difference-occurrences.ts` (`differenceOccurrenceKey` · `assignOccurrenceIndices` · `sortLocusDifferences` · `multiDifferenceNotice`) — يستعمله المحرر (لوحة التفاصيل ورسالة الحالة) والترحيل `migrateDocumentToV8` والاختبارات، فالفهرس مشتق اشتقاقًا حتميًا من ترتيب المستند ولا يُخزَّن (لا يتقادم ولا يتصادم؛ التصدير مستقر بايتًا).
- **ترتيب عرض اختلافات الموضع** (قرار محسوم): المصدر (engine ثم editor) ← الرتبة الصريحة (`orderRank`) ← فهرس التعدد ← المعرّف.
- **قرار التنافي/الارتباط عبر Resolver حصرًا** (`resolveLocusRelation` في `decision/editor-bridge.ts`): فئة واحدة في كلمة واحدة = متنافيان (`EXCLUSIVE`، لا يُضربان)؛ فئتان مختلفتان = مرتبطان إن دمجتهما مصفوفة الدمج (`RELATED`، مثل مد+تحقيق) أو مستقلان (`INDEPENDENT`، مثل فرش+مد)؛ وقاعدة `PREVENT_MERGE` بـ`params.exclusive=true` تنفيًا صريحًا بين فئتين.
- **التصحيح اليدوي الموثق**: رابط `DIFFERENCE_TO_DIFFERENCE` (طرفا `RULE` بمعرّفي اختلافين) مع `differenceRelation` = `MUTUALLY_EXCLUSIVE | RELATED` يسبق السياسة في `resolveExclusiveGroups` ومحرك التراكيب؛ وعند مخالفة اقتراح المحرك تُنشأ `Correction` (A=قرار السياسة، B=قرار المحرر، النهائي=B). يُصدَّر إلى v8 كعلاقة بنوع المحرر الصريح، وحذف أحد الطرفين ينظف العلاقة (تنظيف الروابط القائم).
- عند التصدير v8 يظهر كل اختلاف كيانًا مستقلًا في `differences[]` بمعرّفه و`occurrenceIndex`، وإعادة الاستيراد تحفظها كما هي.

### 7.10 DM-10 Line — سطر تشجير برتبة صريحة
- `{ id, order, ayahKey, title, category, readerScope, segments[], compositeFaceRefs[], source, locked?, createdAt, updatedAt }`.
- إعادة الترتيب تغير `order` فقط ولا تمس `id` ولا العلاقات (P-03).

### 7.11 DM-11 RenderRange — نطاق العرض المعزول
- `{ id, ayahKey, fromPosition, toPosition, label? }` — يحدد الجزء المعروض عند تفعيل عرض الجزء المحدد (يستهلك في حزمة 08).

### 7.12 DM-12 createBatchId — تتبع دفعي دون ربط دلالي
- عند الإنشاء الدفعي يوسم كل كيان بمعرف الدفعة لأغراض التتبع والتراجع الجماعي فقط — دون أي ربط دلالي يلغي الاستقلال (P-05). يُتراجع كوحدة واحدة في `CommandLog.transaction`.

### 7.13 DM-13 حتمية التصدير Git-friendly
- ترتيب مفاتيح ثابت محدد سلفًا، معرّفات صريحة، لا طوابع زمنية تتغير بلا سبب، ترتيب عناصر مستقر حسب معرّفاتها/رتبها — Git diff دقيق (`Rule A priority: 80 → 100`).
- `toCanonicalConfig` يرتب القواعد بمعرفها، ومصفوفة الدمج بمفاتيحها، وبلا طوابع متقلبة.
- `toStableV8` يولد معرّفات حتمية للتصحيحات ونطاقات العرض من `ayahKey` و`targetId`.

### 7.14 DM-14 engineConfig كتلة مستقلة
- `{ policies, rules, priorities, relations, contexts, merge-policies, schema-version }` — قابلة للتصدير المنفصل عبر `serializeEngineConfig`.
- مخزن في `tashjeer:engine-config:v1` + سجل إصدارات `tashjeer:engine-config-history:v1`.

### 7.15 DM-15 سجل التراجع الموحد
- `CommandLog` يغطي: نقل، دمج، فصل، حذف فردي/جماعي، لصق، تعميم، إنشاء مجموعة، إعادة ترتيب، تعديل رتبة، وضع/إزالة علامات وقف، تعديلات محلية.
- كل عملية تخزن Snapshot أو Inverse Operation كافية للتراجع الكامل دون فقد.
- الدفعات تُتراجع كوحدة واحدة (`transaction`).

### 7.16 DM-17 تمثيل السطر في الواجهات
- يحمل نطاقه المختصر (رمز الإمام/الراوي/الطريق وفق قاعدة الاختصار) مع أنواع اختلافاته مرتبة برتبها الصريحة.

### 7.17 DM-18 الترحيل v7→v8
`src/lib/tashjeer/migration/migrate-v7-v8.ts` يحوّل `TashjeerDocument` القديم إلى
النموذج الموحّد دون تعديل الأصل (دالة نقية)، ويُولّد نسخة احتياطية (`migrateWithBackup`) قبل
الترحيل (NFR-04). كل معرّف يُحفظ (P-03)، ولا تُفقد بيانات (P-13).
- `Variant` → `Difference` (مع `locus`, `occurrenceIndex`, `relations`, `rank`)
- `Variant.alternatives[]` → `Difference.variants[]` (الوجه الأساسي يُستبعد)
- `TashjeerLink` → `Relation`
- `RecitationBoundary` → `WaqfMark` (`NO_WASL`→`FORBIDDEN_WASL`)
- `Variant.engineSnapshot` → `Correction` + `Difference.engineSnapshot`
- `Variant.origin` → `Difference.source`

### 7.18 FR-EN-01→04 Decision Resolver + Policy Layer
- **Engine Logic** (قياس، تخطيط، ضرب أوجه، توليد أسطر) كود في `lib/tashjeer/` دون تحويلها لإعدادات.
- **Engine Policy** (أولويات، متى يُدمج/يُمنع/يُفصل، سياقات الوقف/الوصل، استثناءات، حل تعارض، ترتيب التنفيذ) في `EngineConfig` الموحد يُقرأ من Profile.
- **Decision Resolver** (`decision/resolver.ts`) — المكان الوحيد الذي يحسم المطابقة والأولوية والخصوصية والتعارض والدمج والتنافي والترتيب، مع Trace قابل للتفسير.
- **Decision API** (`decision/api.ts`): `resolveDifference`, `resolveMerge`, `resolveOrder`, `resolveRelation`, `resolveConnection`, `resolveVariant` — كل استدعاء يعيد النتيجة + القواعد المطابقة والفائزة والمتجاهلة وأسبابها.
- المحركات القائمة `ordering`, `combination-engine`, `classic-tashjeer` تقرأ قراراتها عبر هذه الواجهات (موثق في PROGRESS.md).

### 7.19 NFR-04 الحفظ الآمن
- `atomicWrite` كتابة ذرية للتخزين المحلي.
- `backupBeforeMigration` و `backupBeforeWideOp` قبل الهجرات والعمليات الواسعة.
- `AutoSaveManager` حفظ تلقائي دوري + عند العمليات الخطرة.
- تأكيد كمي ثم تراجع لكل عملية خطرة (P-13).

