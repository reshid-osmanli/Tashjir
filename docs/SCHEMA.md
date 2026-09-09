# مخطط البيانات الموحّد (v8) — Unified Data Model

> وثيقة ملحقة بـ `docs/DATA.md` وتُفصّل النموذج الموحّد المُضاف في المرحلة **PH0**
> (انظر `src/lib/tashjeer/model/v8.ts`). هذا النموذج هو أساس كل المتطلبات اللاحقة:
> المحرر، Engine Studio، نواة المحرك، وطبقة السياسة.

## المبدأ

- **بناء لا حذف (P-01):** النموذج يوسّع النموذج القائم في `src/types/tashjeer.ts`
  (حيث `Variant≈Difference` القديم و`VariantAlternative≈الوجه`) ولا يكسره.
- **معرّفات ثابتة (P-03):** كل كيان `id` مستقل بصيغة `<prefix>-<shortULID>` لا يتغير
  بإعادة الترتيب/النقل/الدمج.
- **ترتيب صريح رقمي (P-04):** كل ما يُعرض له رتبة: `Difference.rank`، `Variant.rank`،
  `Line.order`، و`DisplayOrderEntry.displayOrder` للقراء/الرواة/الطرق.
- **لا منطق مكرر (P-07):** كل قرار يصدر عن حلّ القرار المركزي
  (`src/lib/tashjeer/decision/`) لا من مكوّن واجهة.

## الكيانات الأساسية

| الكيان | الملف | المقابل القديم | الملاحظة |
|---|---|---|---|
| `Difference` | `model/v8.ts` | `Variant` | كيان مستقل كامل مع `occurrenceIndex` (DM-09) و`relations` و`context` |
| `Variant` (الوجه) | `model/v8.ts` | `VariantAlternative` | مستقل بـ`id` و`rank` صريح (DM-02) |
| `Relation` | `model/v8.ts` | `TashjeerLink` | يشير إلى معرّفات فقط (DM-03): `MERGE/COMPOSITE/PART_OF/RELATED/MUTUALLY_EXCLUSIVE/MANUAL_LINK` |
| `WaqfMark` | `model/v8.ts` | `RecitationBoundary` | `WAQF/IBTIDA/FORBIDDEN_WASL/WASL` (DM-07) |
| `Correction` | `model/v8.ts` | `engineSnapshot` + `origin` | الثلاثية Engine=A / Editor=B / Final=B (DM-05، P-06) |
| `GlobalRule` | `model/v8.ts` | القواعد العامة | +`priority`/`category`/`status`/`version` (FR-ED-15) |
| `RuleOccurrence` | `model/v8.ts` | المواضع المشتقة | +`localOverride` محلي (DM-08) |
| `EngineRule` | `model/v8.ts` | — | قاعدة سياسة في Engine Studio (FR-ES-02) |
| `EngineConfig` | `model/v8.ts` | — | ملف المحرك القابل للتصدير (DM-14، FR-ES-14) |
| `Line` / `LineSegment` | `model/v8.ts` | `ManualTashjeerLine` + `LineSegment` | رتبة صريحة (DM-10) |
| `RenderRange` | `model/v8.ts` | `readingWindow.focusSegment` | نطاق العرض عند الوقف الداخلي (DM-11) |

## ملف التصدير v8 (أعلى المستند)

```jsonc
{
  "format": "tashjeer-export",
  "schemaVersion": 8,
  "exportedAt": "…",
  "meta": { "appVersion": "…", "profile": "default" },
  "ayahKey": 2004,
  "differences": [ /* Difference كامل مع variants و relations و context */ ],
  "lines": [ /* الرتب اليدوية والأجزاء */ ],
  "relations": [ /* علاقات على مستوى المستند */ ],
  "waqfMarks": [ /* DM-07 */ ],
  "ruleOccurrences": [ /* +localOverride */ ],
  "renderRanges": [ /* DM-11 */ ],
  "corrections": [ /* Engine/Editor/Final */ ],
  "auditLog": [ /* قبل/بعد/سبب/مصدر */ ],
  "readingWindow": { "linkNextAyah": false, "focusSegment": null },
  "lineOrder": [ "…" ]
}
```

### حزمة التصدير (ExportBundle) — الحقول المضافة في v8

| الحقل | المعنى |
|---|---|
| `v8[]` | الصورة الموحّدة لكل مستند (تُشتق من `documents` بدالة نقية؛ معرّفات التصحيحات ونطاقات العرض حتمية) |
| `engineConfig` | ملف سياسات المحرك المفعّل وقت التصدير بصيغة قانونية مرتّبة |
| `displayOrder[]` | رتب العرض الصريحة للقراء/الرواة/الطرق (`{ id, kind, displayOrder }`) مرتبة بالنوع ثم بالمعرّف (DM-04). عند الاستيراد تُطبَّق على الكيانات المعروفة محليًا فقط؛ المجهولة تُحصى في التحذيرات ولا تُنشأ |

### القاعدة العامة (GlobalRule) — `applyRange`

`applyRange` يقيّد أين تُبحث القاعدة دون تغيير نمطها:
`{ kind: 'MUSHAF' }` (يُحذف عند الحفظ لأنه الافتراضي) أو
`{ kind: 'SURAH', surahNumber }` أو `{ kind: 'AYAH_RANGE', fromAyahKey, toAyahKey }`
(حدّان شاملان، يُطبَّعان تصاعديًا). المطابق `findGlobalRuleMatchesInAyah` يفحص
`ruleAppliesToAyah` قبل المطابقة.

## الترحيل v7 → v8 (DM-18، NFR-05)

الدالة `migrateDocumentToV8(doc)` في `src/lib/tashjeer/migration/migrate-v7-v8.ts`
تحوّل `TashjeerDocument` القديم (الموسوم داخليا v8 لكنه بنيويًا قديم:
`variants/links/boundaries/segments/editLog`) إلى النموذج الموحّد أعلاه، دون
تعديل الأصل (دالة نقية). تُولّد النسخة الاحتياطية عبر `migrateWithBackup`.

| من (قديم) | إلى (v8) |
|---|---|
| `Variant` | `Difference` (مع `locus`, `occurrenceIndex`, `relations`, `rank`) |
| `Variant.alternatives[]` | `Difference.variants[]` (الوجه الأساسي يُستبعد) |
| `TashjeerLink` | `Relation` (نوع موحّد) |
| `RecitationBoundary` | `WaqfMark` (`NO_WASL`→`FORBIDDEN_WASL`) |
| `Variant.engineSnapshot` | `Correction` + `Difference.engineSnapshot` |
| `Variant.origin` | `Difference.source` (`ENGINE`→`engine`, غيره→`editor`) |

### الاستيراد مع الترحيل التلقائي (NFR-04، AC-04)

`importDocuments(json)` يقبل حزم v7 وما قبلها: كل مستند يحتاج ترحيلًا يُحفظ
له أولًا نسخة احتياطية في التخزين المحلي بمفتاح يبدأ بـ `BACKUP_PREFIX`، ثم
يُرحَّل ويُخزَّن. النتيجة `ImportResult` تحمل `migrated[]` (المفتاح الاحتياطي
لكل مستند والإصدارين) و`warnings[]`. `describeImportResult` يصوغها للمستخدم.

## حتمية الملف (DM-13، NFR-06)

الترحيل ومولّدات التصدير في هذه المرحلة لا يقدّمان طوابع زمنية متغيّرة في الحقول
المنطقية، والمعرّفات صريحة والترتيب حسب الرتب لا الإدراج، ليكون Git diff ذا معنى
(مثل `Rule A priority: 80 → 100`).

## سجل إصدارات ملف المحرك (`tashjeer:engine-config-history:v1`)

مصفوفة `EngineConfigVersion[]` (الأحدث أولًا، حد ٤٠):
`{ id, seq, createdAt, source: SAVE|ROLLBACK|IMPORT|RESET, note?, restoredFrom?,
audit: EngineAuditEntry[], stats: { rules, active, matrix }, config }`.
`audit` يُحسب بـ `diffEngineConfigs(before, after)` ويتجاهل تغيّر الطوابع
الزمنية ورقم الإصدار وحدهما. الحفظ المطابق لآخر نسخة لا يُضيف شيئًا.

## ملف إعداد المحرك (EngineConfig — DM-14، FR-ES-14)

كتلة مستقلة قابلة للتصدير منفصلة عن مستند الآية، يديرها استوديو المحرك
(`/studio`). التصدير حتمي: القواعد مرتبة بمعرّفها المستقر (لا بأولويتها)،
ومصفوفة الدمج مرتبة بمفاتيحها، وبلا طوابع زمنية متقلّبة — فتغيير أولوية قاعدة
واحدة يغيّر سطرها وحده في Git.

```jsonc
{
  "schemaVersion": 1,
  "profile": "default",
  "priorityGroups": [ { "id": "merge", "label": "قواعد الدمج", "order": 80 } ],
  "rules": [
    {
      "id": "er-system-merge-farsh-madd",
      "name": "لا تدمج الفرش مع المد",
      "type": "MERGE",
      "category": "MERGE",
      "scope": "MUSHAF",
      "conditions": { "all": [
        { "field": "differenceType", "op": "equals", "value": "FARSH" },
        { "field": "sameReader", "op": "equals", "value": true }
      ]},
      "actions": [ { "type": "PREVENT_MERGE" } ],
      "priority": 100,
      "groupId": "merge",
      "specificity": "MUSHFAF",
      "hardness": "HARD",
      "status": "ACTIVE",
      "version": 1
    }
  ],
  "conflictPolicy": ["MOST_SPECIFIC", "HIGHEST_PRIORITY", "EXPLICIT", "LOCAL", "MANUAL"],
  "executionOrder": ["NORMALIZE", "CONTEXT", "BLOCKING", "EXCEPTIONS", "STRUCTURAL",
                     "READER", "DIFFERENCE", "MERGE", "ORDERING", "FALLBACK"],
  "mergeMatrix": [
    { "a": "MADD", "b": "TAHQIQ", "merge": true,  "priority": 80,  "reason": "مرتبطان" },
    { "a": "FARSH","b": "MADD",   "merge": false, "priority": 100, "reason": "مستقلان" }
  ],
  "contexts": { "waqf": [], "wasl": [], "ibtida": [], "forbiddenConnection": [] }
}
```

التخزين والواجهات النقيّة في `src/lib/tashjeer/engine-config-store.ts`؛
السياسات الافتراضية في `src/lib/tashjeer/decision/policy.ts`.

## الاختبارات

- `tests/model-v8.test.ts` — أنواع ومساعدات v8.
- `tests/migrate-v7-v8.test.ts` — الترحيل وحفظ المعرّفات وتعدد الاختلافات.
- `tests/decision-resolver.test.ts` — حلّ القرار والسياسات ومصفوفة الدمج.
- `tests/command-log.test.ts` — سجل التراجع الموحّد.
- `tests/engine-config-store.test.ts` — طبقة سياسات المحرك: الحتمية والصداقة
  لـ Git (DM-13)، الفحص والاستيراد وكشف التعارض، والجولة الكاملة.
