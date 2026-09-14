# توثيق API - API Documentation

## نظرة عامة

API المشروع مبني باستخدام Next.js API Routes، لكن **طبقة القرار المركزية** هي الأساس في الحزمة 01 (PH0).

> التخزين المحلي هو مصدر التنفيذ الحالي في المتصفح؛ الواجهات النقية التالية هي عقدة القرار التي تستعملها الصفحات والاختبارات قبل نقل التخزين إلى API دائم. لا تملك أي ميزة تنفيذًا خاصًا لقرارات الدمج/الترتيب/التنافي — كل شيء يمر عبر Decision API (P-07).

---

## Decision API الموحدة (FR-EN-03) — الحزمة 01

> الملف: `src/lib/tashjeer/decision/api.ts` + `resolver.ts` + `policy.ts`
> كل استدعاء يعيد: النتيجة + القواعد المطابقة والفائزة والمتجاهلة وأسبابها + Trace قابل للتفسير.

### التواقيع

```ts
// يحسم إن كان الموضع يستوجب إنشاء اختلاف
function resolveDifference(
  ctx: DecisionContext,
  profile?: EngineConfig
): DecisionResult<{ create: boolean; reason: string }>

// يحسم دمج عنصرين (فئتين/نوعين)
function resolveMerge(
  a: string, // نوع أول: FARSH, MADD, TAHQIQ...
  b: string, // نوع ثاني
  profile?: EngineConfig,
  ctx?: DecisionContext
): DecisionResult<{ merge: boolean; reason: string; priority: number }>

// يحسم تنافي وجهين (لا يُضربان إن كانا متنافيين)
function resolveRelationExclusion(
  a: string,
  b: string,
  profile?: EngineConfig
): DecisionResult<{ exclusive: boolean; reason: string }>

// يحسم أي وجه يفوز في موضع (بالقوة ثم بالسياسات)
function resolveVariant(
  candidates: Array<{ id: string; strengthRank?: number }>,
  ctx: DecisionContext,
  profile?: EngineConfig
): DecisionResult<{ winnerId?: string; orderedIds: string[] }>

// يحسم ترتيب عناصر بمراعاة الرتبة الصريحة ثم سياسات ORDERING (DM-04)
function resolveOrder(
  items: Array<{ id: string; explicitOrder?: number }>,
  profile?: EngineConfig,
  ctx?: DecisionContext
): DecisionResult<{ orderedIds: string[] }>

// يتحقق من صحة علاقة بين كيانين وفق قواعد RELATION/EXCEPTION
function resolveRelation(
  fromId: string,
  toId: string,
  type: string, // MERGE | REFERENCE | ...
  profile?: EngineConfig,
  ctx?: DecisionContext
): DecisionResult<{ valid: boolean; reason: string }>

// يتحقق من السماح بالوصل بين حدّين (DM-07، FR-ED-11)
function resolveConnection(
  forbidden: boolean, // هل توجد علامة FORBIDDEN_WASL؟
  profile?: EngineConfig
): DecisionResult<{ allowed: boolean; reason: string }>

// بنية النتيجة الموحدة
interface DecisionResult<T> {
  decision: T;
  appliedRules: EngineRule[];               // الفائزة/المطبقة
  skippedRules: Array<{ rule: EngineRule; reason: string }>; // المتجاهلة
  trace: DecisionTraceStep[];               // أثر قابل للتفسير
}
interface DecisionTraceStep {
  stage: string; // INPUT | MATCH | MERGE | CONFLICT | RULE_WON | FINAL ...
  ruleId?: string;
  message: string;
  status: 'applied' | 'skipped' | 'won' | 'lost' | 'blocked' | 'info';
  priority?: number;
}
```

### أمثلة استخدام

```ts
import { resolveMerge, resolveOrder } from '@/lib/tashjeer/decision/api';
import { DEFAULT_SYSTEM_PROFILE } from '@/lib/tashjeer/decision/policy';

// هل ندمج فرش مع مد؟
const merge = resolveMerge('FARSH', 'MADD', DEFAULT_SYSTEM_PROFILE);
console.log(merge.decision.merge); // false — مستقلان
console.log(merge.trace); // [{ stage: 'MERGE', message: 'مصفوفة الدمج: لا تدمج — مستقلان', ... }]

// ترتيب برتبة صريحة (DM-04)
const order = resolveOrder([
  { id: 'diff-b', explicitOrder: 2 },
  { id: 'diff-a', explicitOrder: 1 },
]);
console.log(order.decision.orderedIds); // ['diff-a', 'diff-b']
```

### فصل المنطق عن السياسة (FR-EN-01)

- **Engine Logic** (قياس، تخطيط، ضرب أوجه، توليد أسطر، ملء مسارات) يبقى كودًا في `lib/tashjeer/` دون تحويلها لإعدادات.
- **Engine Policy** (الأولويات، متى يُدمج/يُمنع/يُفصل، سياقات الوقف/الوصل، الاستثناءات، حل التعارض، ترتيب التنفيذ) في `EngineConfig` الموحد يُقرأ من Profile المفعّل.
- **السياسات الافتراضية** في `decision/policy.ts` تطابق سلوك المحرك الحالي حرفيًا — لا تغيير ناتج بعد الحزمة 01 (يتحقق باختبارات الانحدار).

### تصدير/استيراد إعداد المحرك (DM-14، FR-ES-14)

- `serializeEngineConfig(config)` يصدر حزمة حتمية منظمة (`policies`، `rules`، `priorities`، `relations`، `contexts`، `merge-policies`، `schema-version`) مرتّبة بالمعرّفات، بلا طوابع زمنية؛ تغيير `priority` يغيّر سطر القيمة فقط.
- `toCanonicalConfig(config)` متاح للتكاملات التي تحتاج الشكل المسطح الداخلي (Git-friendly DM-13).
- `validateEngineConfig(value)` يفحص الإصدار، الحقول، المعرّفات المكررة ومجموعات الأولوية.
- `importEngineConfigText(text)` يحلل ويفحص ويطبّع دون الكتابة إلى التخزين؛ صفحة `/studio` تعرض المعاينة ثم تطبق الاستيراد كمسودة غير محفوظة.
- `saveEngineConfig(config)` هو مسار الحفظ الوحيد لملف السياسة.
- `toExportBundle(config)` يحول المسطح إلى حزمة منظمة للـ Git.

إعدادات الرسم والترتيب القديمة (`engine-settings.ts`) لها واجهة تحرير واحدة في `/studio?section=settings`؛ تبويب `/admin` القديم يعيد توجيه المستخدم إليها ولا يملك نسخة ثانية.

### عمليات ملف المحرك النقيّة (FR-ES-01/04/05)

كل عمليات الاستوديو دوال نقيّة في `src/lib/tashjeer/engine-config-store.ts` —
الواجهة (Zustand) تنقلها فقط، ولا قرار يُحسم خارجها (P-07):

```ts
// يثبّت أولوية قاعدة صراحةً. يُزاح فقط ما يتصادم بالرقم الجديد في المجموعة
// نفسها (سلسلة +1): لا إزاحة شاملة، فيبقى diff التصدير سطرًا واحدًا (DM-13).
function setRulePriority(config: EngineConfig, ruleId: string, priority: number): EngineConfig

// نفس الإزاحة مع تقرير «من زُيحت» لإشعار المستخدم (FR-ES-01):
function applyPriorityShift(
  rules: EngineRule[],
  ruleId: string,
  nextPriority: number
): { rules: EngineRule[]; shifts: Array<{ ruleId: string; ruleName: string; from: number; to: number }> }

// إضافة/تعديل/حذف صف مصفوفة الدمج — القرار التالٍ يقرأ الصف الجديد ويذكره في الأثر:
function addMergeMatrixEntry(config: EngineConfig, entry: MergeMatrixEntry): EngineConfig
function updateMergeMatrixEntry(config: EngineConfig, index: number, patch: Partial<MergeMatrixEntry>): EngineConfig
function removeMergeMatrixEntry(config: EngineConfig, index: number): EngineConfig

// ضبط سلم حل التعارض وترتيب التنفيذ (FR-ES-04/06):
function setConflictPolicy(config: EngineConfig, policy: ConflictPolicyStep[]): EngineConfig
function setExecutionOrder(config: EngineConfig, order: string[]): EngineConfig
```

وحدات قياس الأثر في `decision/resolver.ts` (تُستعمل في تحذير ما قبل حفظ ترتيب
المراحل — FR-ES-04):

```ts
// مرحلة التنفيذ التابعة لإجراء القاعدة (BLOCK_RESULT ← BLOCKING،
// OVERRIDE_RESULT ← EXCEPTIONS، MERGE/PREVENT_MERGE ← MERGE، ...):
function executionStageOf(rule: EngineRule): string

// الأثر المبدئي لتبديل ترتيب المراحل: المراحل التي تغيّر موضعها + القواعد
// التي إجراءاتها فيها. تُعرض مع نتائج runProfileTests على الترتيب الجديد:
function executionOrderImpact(
  config: EngineConfig,
  nextOrder: string[]
): { changedStages: string[]; affectedRules: EngineRule[] }
```

### الحفظ الآمن وتصدير حتمي (NFR-04، DM-13)

- `atomicWrite(key, value)` كتابة ذرية للتخزين المحلي.
- `backupBeforeMigration(doc)` و`backupBeforeWideOp(payload)` قبل الهجرات والعمليات الواسعة.
- `AutoSaveManager` حفظ تلقائي دوري + عند العمليات الخطرة.
- `stableStringify(value)` تصدير حتمي بترتيب مفاتيح ثابت — نفس البيانات ← نفس البايتات.

### سجل التراجع الموحد (DM-15)

- `CommandLog` في `src/lib/tashjeer/history/command-log.ts`:
  - `record(label, kind, doFn, undoFn)` — يسجل أمرًا منفردًا.
  - `transaction(label, fn)` — يجمع عدة أوامر في دفعة واحدة تُتراجع كوحدة.
  - `undo() / redo() / jumpTo(depth) / history() / clear()`
- `editor-store` يلتقط لقطة ثلاثية (مستند + استثناءات + قواعد) عبر `captureHistoryEntry` / `restoreHistoryEntry`.

### الترحيل v7→v8 (DM-18)

- `migrateDocumentToV8(doc)` — دالة نقية، تحفظ كل معرف (P-03)، تحسب `occurrenceIndex` (DM-09)، تحول `NO_WASL`→`FORBIDDEN_WASL`.
- `migrateWithBackup(doc)` — مع نسخة احتياطية.
- `importDocuments(json, overwrite)` — ترحيل تلقائي مع تقرير `migrated[]` و`warnings[]` ونسخ احتياطية بمفتاح `tashjeer:backup:`.

---

## نقاط النهاية (Endpoints)

### 1. المصحف (Quran)

#### جلب جميع السور
```
GET /api/quran
```

**الرد:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "الفاتحة",
      "nameArabic": "الفاتحة",
      "ayahsCount": 7,
      "revelationType": "مكية"
    }
  ]
}
```

#### جلب سورة محددة
```
GET /api/quran/[surahId]
```

**الرد:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "الفاتحة",
    "ayahs": [
      {
        "id": 1,
        "number": 1,
        "text": "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
        "words": [
          {
            "id": 1,
            "position": 1,
            "text": "بِسْمِ",
            "plainText": "بسم"
          }
        ]
      }
    ]
  }
}
```

#### جلب آية محددة
```
GET /api/quran/[surahId]/[ayahId]
```

**الرد:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "surahId": 1,
    "number": 1,
    "text": "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
    "words": [...],
    "tashjeerLines": [...]
  }
}
```

---

### 2. التشجير (Tashjeer)

#### جلب تشجير آية
```
GET /api/tashjeer/[ayahId]
```

**الرد:**
```json
{
  "success": true,
  "data": {
    "ayahId": 1,
    "lines": [
      {
        "id": "line-1",
        "type": "usul",
        "qiraahOrder": 1,
        "nodes": [
          {
            "wordId": 1,
            "position": "top",
            "x": 100,
            "y": 50
          }
        ],
        "style": {
          "color": "#22c55e",
          "strokeWidth": 2
        }
      }
    ]
  }
}
```

#### حفظ تشجير
```
POST /api/tashjeer/save
```

**الجسم:**
```json
{
  "ayahId": 1,
  "lines": [
    {
      "type": "usul",
      "qiraahOrder": 1,
      "nodes": [...]
    }
  ]
}
```

**الرد:**
```json
{
  "success": true,
  "message": "تم الحفظ بنجاح"
}
```

#### تحديث تشجير
```
PUT /api/tashjeer/[lineId]
```

#### حذف تشجير
```
DELETE /api/tashjeer/[lineId]
```

---

### 3. القراءات (Qiraat)

#### جلب جميع القراءات
```
GET /api/qiraat
```

**الرد:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "نافع",
      "narrator": "قالون",
      "tier": "RAVI",
      "orderInTayyibah": 1,
      "turuq": [
        {
          "id": 1,
          "name": "الأزرق"
        },
        {
          "id": 2,
          "name": "الأصبهاني"
        }
      ]
    }
  ]
}
```

#### جلب قراءات كلمة
```
GET /api/qiraat/word/[wordId]
```

**الرد:**
```json
{
  "success": true,
  "data": [
    {
      "qiraahId": 1,
      "qiraahName": "قالون",
      "text": "بِسْمِ",
      "differences": null,
      "category": "USUL"
    }
  ]
}
```

---

### 4. الأدلة (Evidence)

#### جلب أدلة كلمة
```
GET /api/evidence/[wordId]
```

**الرد:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "source": "NASHR",
      "text": "والدليل من النشر...",
      "reference": "ج1 ص 200",
      "manzumaLine": null,
      "kitabPage": "200"
    },
    {
      "id": 2,
      "source": "TAYYIBAH",
      "text": "البيت من الطيبة...",
      "reference": "البيت 15",
      "manzumaLine": "وَقِفْ يَقُولُ...",
      "kitabPage": null
    }
  ]
}
```

---

### 5. المراجعة (Review)

#### جلب المراجعات
```
GET /api/review
```

#### إنشاء مراجعة
```
POST /api/review
```

**الجسم:**
```json
{
  "tashjeerLineId": "line-1",
  "status": "APPROVED",
  "comment": "ممتاز"
}
```

#### تحديث مراجعة
```
PUT /api/review/[reviewId]
```

---

### 6. القراء (Readers)

#### جلب القراء
```
GET /api/readers
```

#### تسجيل قارئ جديد
```
POST /api/readers
```

**الجسم:**
```json
{
  "name": "أحمد",
  "email": "ahmed@example.com",
  "qiraat": ["حفص عن عاصم", "قالون عن نافع"]
}
```

#### جلب ملف قارئ
```
GET /api/readers/[readerId]
```

---

## رموز الحالة

| الرمز | الوصف |
|-------|-------|
| 200 | نجاح |
| 201 | تم الإنشاء |
| 400 | طلب خاطئ |
| 401 | غير مصرح |
| 403 | ممنوع |
| 404 | غير موجود |
| 500 | خطأ في الخادم |

---

## التحقق من الأخطاء

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "البيانات غير صحيحة",
    "details": [
      {
        "field": "ayahId",
        "message": "مطلوب"
      }
    ]
  }
}
```

---

## التوثيق التفاعلي

يمكن الوصول لتوثيق Swagger عبر:
```
GET /api/docs
```
