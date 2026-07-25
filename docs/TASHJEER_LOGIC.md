# منطق التشجير - Tashjeer Logic Documentation

## نظرة عامة

هذا الملف يوثق المنطق الأساسي لنظام التشجير وكيفية عمله.

---

## مفهوم التشجير

التشجير هو طريقة لتمثيل الاختلافات بين القراءات العشر بشكل بصري، حيث يتم:
1. عرض نص المصحف (رواية حفص عن عاصم) كخط أساسي
2. رسم خطوط أفقية لكل قارئ/راوي
3. ربط الكلمات المتفقة بخطوط
4. إظهار الاختلافات في مكانها الصحيح

---

## هيكل التشجير

```
┌─────────────────────────────────────────────────────────────────┐
│                        منطقة الأصول                              │
│  (تنطبق على كل المصحف - مشتركة بين جميع القراء)                 │
├─────────────────────────────────────────────────────────────────┤
│  ═══════════════════════════════════════════════════════════    │
│                        خط المصحف (حفص عن عاصم)                   │
│  ═══════════════════════════════════════════════════════════    │
├─────────────────────────────────────────────────────────────────┤
│                        منطقة الفرش                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ قالون ──────────────────────────────────────────────    │   │
│  │ ورش ───────────────────────────────────────────────     │   │
│  │ البزي ─────────────────────────────────────────────     │   │
│  │ قنبل ──────────────────────────────────────────────     │   │
│  │ ...                                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                        منطقة المدود                               │
│  (عند وجود اختلاف في المدود)                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## قواعد رسم الخطوط

### 1. قاعدة الترتيب من الأعلى للأسفل

```
الترتيب في المحرر (من الأعلى للأسفل):
┌──────────────────────┐
│ الأصول (إن وجدت)      │  ← الأعلى
├──────────────────────┤
│ قالون                │
├──────────────────────┤
│ ورش                  │
├──────────────────────┤
│ البزي                │
├──────────────────────┤
│ قنبل                 │
├──────────────────────┤
│ ...                  │
├──────────────────────┤
│ إسحاق (عن خلف)       │  ← الأسفل
└──────────────────────┘
```

### 2. قاعدة الوقف والابتداء

> **القاعدة الذهبية:** بعد قالون يقرأ الذي يحتوي على اختلاف من بعده من آخر الآية إلى أولها

**التفسير:**
- يبدأ القراءة من آخر كلمة مختلفة في الآية
- يقرأ إلى أول كلمة مختلفة
- هذا يضمن عدم تكرار القراءة المشتركة

### 3. قاعدة ربط الكلمات

```
الحالة 1: الكلمة متفقة في جميع القراءات
═══════════════════════════════════════
الكلمة ─────── لا يحتاج خط تشجير

الحالة 2: الكلمة مختلفة في قراءة واحدة
═══════════════════════════════════════
الكلمة ──────┬───── حفص (الأصل)
             │
             └───── القراءة المختلفة

الحالة 3: الكلمة مختلفة في عدة قراءات
═══════════════════════════════════════
الكلمة ──────┬───── حفص (الأصل)
             │
             ├───── القراءة 1
             │
             ├───── القراءة 2
             │
             └───── القراءة 3
```

---

## خوارزمية حساب المواقع

### حساب موقع الكلمة

```typescript
interface WordPosition {
  wordId: number;
  x: number;           // إحداثي X (من اليمين لليسار)
  y: number;           // إحداثي Y
  width: number;       // عرض الكلمة
  height: number;      // ارتفاع الكلمة
  centerX: number;     // مركز الكلمة X
  centerY: number;     // مركز الكلمة Y
  baselineY: number;   // خط الأساس
}

function calculateWordPosition(
  word: Word,
  context: LayoutContext
): WordPosition {
  // 1. حساب عرض الكلمة بالحركات
  const width = measureWordWidth(word.text, {
    font: 'UthmanicHafs',
    fontSize: context.fontSize,
    includeHarakat: true,
  });

  // 2. حساب الموقع بناءً على الكلمات السابقة
  const x = context.currentX + context.wordSpacing;

  // 3. حساب الارتفاع بناءً على الحركات
  const height = calculateHeightWithHarakat(word.text);

  return {
    wordId: word.id,
    x,
    y: context.currentY,
    width,
    height,
    centerX: x + width / 2,
    centerY: context.currentY,
    baselineY: context.currentY + height * 0.8,
  };
}
```

### حساب موقع خط التشجير

```typescript
interface TashjeerLinePosition {
  startX: number;
  endX: number;
  y: number;
  controlPoints: Point[];
}

function calculateLinePosition(
  words: WordPosition[],
  config: LineConfig
): TashjeerLinePosition {
  // 1. تحديد نقطة البداية (أول كلمة مختلفة)
  const startWord = words[0];

  // 2. تحديد نقطة النهاية (آخر كلمة مختلفة)
  const endWord = words[words.length - 1];

  // 3. حساب محور Y بناءً على نوع الخط
  const y = calculateYAxis(config.type, config.order);

  // 4. حساب نقاط التحكم للانحناء
  const controlPoints = calculateBezierControlPoints(
    startWord,
    endWord,
    config.curve
  );

  return {
    startX: startWord.centerX,
    endX: endWord.centerX,
    y,
    controlPoints,
  };
}
```

---

## فهم الحركات والأحكام

### تحليل الحركات

```typescript
interface HarakaAnalysis {
  harakat: Haraka[];
  baseLetters: Letter[];
  totalWidth: number;
  maxHeight: number;
}

interface Haraka {
  type: 'fatha' | 'damma' | 'kasra' | 'shadda' | 'sukun' | 'madd' | 'tanween';
  position: 'above' | 'below' | 'on';
  character: string;
  width: number;
  height: number;
}

function analyzeHarakat(text: string): HarakaAnalysis {
  const harakatMap: Record<string, Haraka['type']> = {
    '\u064E': 'fatha',      // فتحة
    '\u064F': 'damma',      // ضمة
    '\u0650': 'kasra',      // كسرة
    '\u0651': 'shadda',     // شدة
    '\u0652': 'sukun',      // سكون
    '\u0653': 'madd',       // مد
    '\u064B': 'tanween',    // تنوين فتح
    '\u064C': 'tanween',    // تنوين ضم
    '\u064D': 'tanween',    // تنوين كسر
  };

  // تحليل النص حرفاً بحرف
  // استخراج الحركات ومواقعها
  // حساب العرض والارتفاع الإضافي
}
```

### أحكام النون الساكنة

```typescript
enum TajweedRule {
  IDGHAM = 'إدغام',
  IKHFAA = 'إخفاء',
  IQLAB = 'إقلاب',
  IZHAR = 'إظهار',
}

function detectNunSaakinahRule(
  word: string,
  nextWord: string
): TajweedRule | null {
  // حروف الإظهار: ح خ ع غ ه ء
  const izharLetters = ['ح', 'خ', 'ع', 'غ', 'ه', 'ء'];

  // حروف الإقلاب: ب
  const iqlabLetters = ['ب'];

  // حروف الإدغام: ي ر م ل و ن
  const idghamLetters = ['ي', 'ر', 'م', 'ل', 'و', 'ن'];

  // حروف الإخفاء: باقي الحروف
  const nextLetter = nextWord.charAt(0);

  if (izharLetters.includes(nextLetter)) return TajweedRule.IZHAR;
  if (iqlabLetters.includes(nextLetter)) return TajweedRule.IQLAB;
  if (idghamLetters.includes(nextLetter)) return TajweedRule.IDGHAM;
  return TajweedRule.IKHFAA;
}
```

---

## نظام الألوان

### ألوان خطوط التشجير

| النوع | اللون | الكود | الاستخدام |
|-------|-------|-------|-----------|
| أصول | أخضر | `#22c55e` | الأصول المشتركة |
| فرش | أزرق | `#3b82f6` | الفرش الخاصة |
| مدود | برتقالي | `#f97316` | اختلافات المدود |
| وقف | بنفسجي | `#8b5cf6` | اختلافات الوقف |
| همز | أحمر | `#ef4444` | اختلافات الهمز |

### ألوان التمييز

| الحالة | اللون | الاستخدام |
|--------|-------|-----------|
| محدد | `#3b82f6` | الكلمة المحددة |
| مختلف | `#fbbf24` | كلمة مختلفة |
| متفق | `#22c55e` | كلمة متفقة |
| مراجع | `#10b981` | تم المراجعة |
| معلق | `#f59e0b` | بانتظار المراجعة |

---

## نظام الأدلة

### ربط الأدلة بالعقد

```typescript
interface EvidenceLink {
  nodeId: number;
  evidence: Evidence[];
  displayMode: 'popup' | 'sidebar' | 'inline';
  trigger: 'hover' | 'click' | 'always';
}

function getEvidenceForNode(node: TashjeerNode): Evidence[] {
  // 1. جلب الأدلة من الطيبة
  const tayyibahEvidence = getTayyibahEvidence(node);

  // 2. جلب الأدلة من النشر
  const nashrEvidence = getNashrEvidence(node);

  // 3. جلب أدلة إضافية
  const additionalEvidence = getAdditionalEvidence(node);

  return [...tayyibahEvidence, ...nashrEvidence, ...additionalEvidence];
}
```

---

## نظام الحفظ والتصدير

### صيغة حفظ التشجير

```typescript
interface TashjeerSaveData {
  version: string;
  ayahId: number;
  lines: TashjeerLineData[];
  metadata: {
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    verifiedBy?: string;
    status: 'draft' | 'review' | 'approved';
  };
}

interface TashjeerLineData {
  id: string;
  type: 'usul' | 'farsh' | 'madud';
  qiraahOrder: number;
  nodes: {
    wordId: number;
    position: 'top' | 'middle' | 'bottom';
    x: number;
    y: number;
  }[];
  style: {
    color: string;
    strokeWidth: number;
    dashArray?: string;
  };
}
```

---

## ملاحظات للتطوير

1. **الدقة في المواقع:** يجب حساب مواقع الكلمات بدقة متناهية
2. **دعم RTL:** المصحف من اليمين لليسار
3. **الحركات:** يجب فهم تأثير الحركات على العرض
4. **الأداء:** استخدام Virtualization للآيات الطويلة
5. **التوافق:** دعم المتصفحات المختلفة
