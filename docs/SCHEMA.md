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

## حتمية الملف (DM-13، NFR-06)

الترحيل ومولّدات التصدير في هذه المرحلة لا يقدّمان طوابع زمنية متغيّرة في الحقول
المنطقية، والمعرّفات صريحة والترتيب حسب الرتب لا الإدراج، ليكون Git diff ذا معنى
(مثل `Rule A priority: 80 → 100`).

## الاختبارات

- `tests/model-v8.test.ts` — أنواع ومساعدات v8.
- `tests/migrate-v7-v8.test.ts` — الترحيل وحفظ المعرّفات وتعدد الاختلافات.
- `tests/decision-resolver.test.ts` — حلّ القرار والسياسات ومصفوفة الدمج.
- `tests/command-log.test.ts` — سجل التراجع الموحّد.
