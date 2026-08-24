# Engine Studio — دليل المستخدم والمطوّر

> مركز إعداد وتعليم المحرك (FR-ES-01..16، FR-EN-01..06)

## نظرة عامة

Engine Studio هي بيئة رسومية لتعليم المحرك: الأولويات، متى يُدمج ومتى لا يُدمج، سياسات القرار، القواعد، واختبارها — دون العودة إلى الكود أو تحرير JSON يدويًا.

### المبدأ المعماري

```
Engine Code = Execution Engine (يبقى كودًا في lib/tashjeer/)
Engine Studio = Decision & Configuration Layer (هنا)
Editor = Human Review & Correction Layer
Reference Data = Trusted Knowledge Layer
```

### الوصول

- **المسار**: `/studio`
- **التنقل**: من الشريط الجانبي → «⚡ Engine Studio»

---

## الأقسام الرئيسية

### 1. القواعد (Rules)

**المتطلبات**: FR-ES-02، FR-ES-07

مستكشف القواعد مع إنشاء وتحرير بالنقر والاختيار.

| الحقل | الوصف |
|---|---|
| الاسم | اسم وصفي للقاعدة |
| النوع | DIFFERENCE / ORDERING / MERGE / RELATION / CONTEXT / EXCEPTION |
| الفئة | 14 فئة: DETECTION، DIFFERENCE، MERGE، SPLIT، ORDERING، ... |
| النطاق | CHARACTER → MUSHAF |
| الأولوية | رقم صريح (الأعلى أقوى) |
| الصلابة | HARD (لا تُتجاوز) / SOFT (تُتجاوز) |
| الحالة | DRAFT / ACTIVE / DISABLED / DEPRECATED / EXPERIMENTAL |

#### منشئ الشروط (Condition Builder)

```
IF  [field] [equals|not-equals|in|not-in|matches-pattern|exists] [value]
AND [field] [op] [value]
```

- يدعم AND / OR / NOT بتداخل مجموعات
- لا كود برمجية — كل شيء بالنقر والاختيار (FR-ES-02)

#### منشئ الإجراءات (Action Builder)

الإجراءات المتاحة:
- `CREATE_DIFFERENCE` — إنشاء اختلاف
- `CREATE_VARIANT` — إنشاء وجه
- `MERGE` — دمج
- `PREVENT_MERGE` — منع الدمج
- `SPLIT` — فصل
- `CHANGE_ORDER` — تغيير الترتيب
- `SET_RANK` — تعيين الرتبة
- `CREATE_RELATION` — إنشاء علاقة
- `BLOCK_RESULT` — حظر النتيجة
- `ASSIGN_CONTEXT` — تعيين السياق
- `GENERATE_CORRECTION` — توليد تصحيح

### 2. مصفوفة الدمج (Merge Matrix)

**المتطلبات**: FR-ES-05

جدول قابل للتحرير يحدد متى يُدمج عنصران ومتى لا يُدمجان.

| Element A | Element B | Merge | Priority | Reason |
|---|---|---|---|---|
| MADD | TAQIQ | ✅ Yes | 80 | مرتبطان |
| MADD | WASL | ✅ Yes | 70 | مرتبطان |
| FARSH | MADD | ❌ No | 100 | مستقلان |
| FARSH | TAQIQ | ❌ No | 100 | مستقلان |
| MADD | MADD | ❌ No | 90 | متنافيان |

### 3. نظام الأولويات (Priority System)

**المتطلبات**: FR-ES-01

مجموعات الأولوية بالترتيب:

| # | المجموعة | الوصف |
|---|---|---|
| 1 | بنائية | Structural Rules |
| 2 | منع | Blocking Rules |
| 3 | استثناءات | Explicit Exceptions |
| 4 | القراء | Reader Rules |
| 5 | الرواة | Narrator Rules |
| 6 | الطرق | Path Rules |
| 7 | الاختلافات | Difference Rules |
| 8 | الدمج | Merge Rules |
| 9 | احتياطية | Fallback Rules |

### 4. خط الأنابيب (Pipeline Viewer)

**المتطلبات**: FR-ES-04

مراحل اتخاذ القرار بالترتيب:

```
1. NORMALIZE   — تطبيع المدخلات
2. CONTEXT     — تحديد السياق
3. BLOCKING    — قواعد المنع
4. EXCEPTIONS  — الاستثناءات الصريحة
5. STRUCTURAL  — القواعد البنائية
6. READER      — قواعد القراء
7. DIFFERENCE  — قواعد الاختلافات
8. MERGE       — قواعد الدمج
9. ORDERING    — الترتيب
10. FALLBACK   — قواعد احتياطية
```

### 5. تتبع القرار (Why?)

**المتطلبات**: FR-ES-10

اختبار أي قرار دمج وعرض الأثر الكامل:

```
Result: ادمج
Because: مصفوفة الدمج — مرتبطان (Priority 80)

Trace:
1. INPUT: تقييم الدمج بين MADD وTAHQIQ
2. MATCH: طابقت: ادمج المد مع التحقيق (P80)
3. MATCH: لم تُطابق: لا تدمج الفرش مع المد
4. MERGE: مصفوفة الدمج: ادمج — مرتبطان (P80)
```

### 6. البروفايلات (Profiles)

**المتطلبات**: FR-ES-11

- **Default** — السياسات الحالية
- **Experimental** — للتجارب
- **Testing** — للاختبار
- **Legacy** — للإصدارات القديمة
- **Reference** — مرجعي معتمد

كل بروفايل حزمة سياسات كاملة قابلة للتبديل والمقارنة.

### 7. القواعد المرشحة (Candidate Rules)

**المتطلبات**: FR-ES-12

عند تكرار نمط تصحيح معين (مثلاً: 23 تصحيحًا بنمط «القارئ X + سياق WAQF + نوع Y»)، يقترح النظام قاعدة مرشحة بمراجعة المستخدم.

سير العمل: `Review → Create Rule → Test → Approve → Activate`

### 8. التصدير والاستيراد

**المتطلبات**: FR-ES-14، DM-13

تصدير Git-friendly: ترتيب مستقر، معرّفات صريحة، إصدار.

```json
{
  "schemaVersion": 1,
  "profile": "default",
  "priorityGroups": [...],
  "rules": [...],
  "conflictPolicy": [...],
  "executionOrder": [...],
  "mergeMatrix": [...],
  "contexts": {...}
}
```

---

## سير الاعتماد (Approval Workflow)

```
Draft → Test → Preview → Review → Approve → Active
                                            ↓
                                        Deprecated
```

---

## المخزن (Store)

**الملف**: `src/stores/engine-studio-store.ts`

المخزن يحمل:
- `profiles[]` — البروفايلات المتاحة
- `activeProfileId` — البروفايل النشط
- `selection` — التحديد الموحد (يرتبط FR-ED-02)
- `auditLog[]` — سجل التغييرات
- `candidateRules[]` — القواعد المرشحة

---

## الربط مع المحرر (FR-ES-15)

- **من المحرر إلى الاستوديو**: تحديد أي Difference → زر `Open in Engine Studio`
- **من القاعدة إلى المحرر**: `Affected: N positions` → `Open Affected Positions`
- **Why؟ داخل المحرر**: زر Why بجانب أي سطر ظاهر

---

## الحفظ والتحديد والربط (تحديث التنفيذ)

- تحفظ حالة الاستوديو محليا في المفتاح `tashjeer:engine-studio:v1`. ويشمل ذلك
  البروفايلات، القواعد، مصفوفة الدمج، سجل التدقيق والقواعد المرشحة؛ فلا تضيع
  عند إعادة تحميل الصفحة.
- تغيّر أسهم مجموعات الأولوية أرقام `order` الصريحة بعد تأكيد، وتبدّل أسهم
  القواعد أرقام `priority` الصريحة نفسها (لا ترتيب المصفوفة فقط).
- القاعدة `DRAFT` أو `DISABLED` لا تدخل إلى Resolver. وتظل ظاهرة في الاستوديو
  للتجربة والمراجعة فقط.
- افتح قاعدة من المحرر عبر `/studio?rule=<ruleId>`؛ يستقبل الاستوديو الرابط،
  يفتح تبويب القواعد، ويضع القاعدة في **Unified Selection Context**.
- قرار الدمج غير موجه: قاعدة مكتوبة على `A + B` تطبق أيضا عند اختبار `B + A`.
  وتسبق قاعدة `PREVENT_MERGE` المطابقة قرار مصفوفة يسمح بالدمج، مع أثر واضح في
  شاشة **Why?**.

## حدود Playground الحالية

المقارنة بين بروفايلين حتمية: لا تستخدم عشوائية ولا تسمي التغيير «تحسنا» أو
«تراجعا» بلا Reference Data معتمد. تعرض `Changed/Same`؛ وتأتي تسميات
`Improved/Regressed` من طبقة التحقق المرجعي بعد إدخال بيانات بشرية معتمدة.
