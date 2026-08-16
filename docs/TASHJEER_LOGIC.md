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

الشكل المعتمد في المصحف المشجّر: النص في الأعلى، وكل أسطر الأوجه تحته تنازليا.

```
                        نص الآية (رواية الأساس)
   ┌──────────────────────────────────────────────────────────────┐
   │  ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ                                    │
   └──────────────────────────────────────────────────────────────┘
              ╎                    ╎              ← وصلة إلى موضع الاختلاف
            إمالة                 قصر             ← اسم الحكم عند الكلمة
 ج ع ┈┈┈┈┈┈┈┈┈┈├════════┤┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈  ٢   ← رموز يسارا، مد يمينا
 ف   ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈├════════┤┈┈┈┈┈┈┈┈┈┈┈┈  ٤
 ق   ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈├════════┤┈┈┈┈┈┈┈┈┈┈┈┈  ٦
 ↑ رموز القراء        ↑ ═ مدى الاختلاف      ↑ حركات المد
                      ┈ الخط التوضيحي بطول الآية
```

**القواعد الصارمة:**

1. **لا شيء فوق النص.** كل الفئات — الأصول والمدود والفرش والهمز والوقف — تنزل تحت الآية. رفع الأصول والمدود فوق النص كان خطأ: يقطع تسلسل القراءة ويزاحم الحركات.
2. **سطر مستقل لكل وجه.** لا يتشارك خطان مسارا واحدا وإن تباعدا أفقيا.
3. **السطر يمتد مع الآية كلها.** امتداده يبيّن أن الوجه يوافق ما قبله في بقية الآية؛ والوصلة الرأسية وحدها تشير إلى موضع الاختلاف.
4. **الوصلة لا تخترق النص.** في الآية الطويلة الملتفة تُرسم على جزأين: شارة قصيرة تحت الكلمة، ثم وصلة في الفراغ بين كتلة النص والسطر.
5. **أوجه الموضع الواحد متتالية** بلا فاصل، مرتبة بقوة الوجه في الكتاب.
6. **رموز القراء في الطرف الأيسر.** ترتيب قراءة الاختلاف يبدأ من آخر كلمة في الآية، وآخر الآية في الرسم العربي هو الطرف الأيسر، فتقع البطاقة حيث تنتهي عين القارئ لا حيث تبدأ. وكل رمز عنصر مستقل قابل للنقر يفتح بطاقة صاحبه.
7. **مع كل سطر خط توضيحي** بطول الآية كلها، منفصل عن خط الوجه، يقود العين من الكلمة إلى بطاقة قارئها. ويُغلَّظ مدى الاختلاف وحده على السطر الممتد، فينفصل الاختلاف عن الخط بصريا.

### سطر الاتفاق: جمهور

إذا خلت الآية من كل اختلاف — أي اتفق القراء العشرة على وجه واحد — رُسم سطر واحد عنوانه **«جمهور»**:

```
 جمهور ────────────────────────────────────────────────
```

- **لا يُنسب إلى راوٍ.** طبع «جمهور حفص» خطأ منهجي: نص المصحف مكتوب برواية حفص، لكن الوجه عند الاتفاق وجه الجمهور كلهم لا وجه حفص وحده.
- **تفاعلي.** عند التمرير عليه تنكشف رموز القراء العشرين، وبالنقر على أي رمز تُفتح بطاقة صاحبه: اسمه وإمامه وسنة وفاته ونبذة عن قراءته.
- **يختفي متى وُجد اختلاف واحد**، لأن امتداد أسطر الأوجه حينئذ هو الذي يبيّن موافقة من وافق.

---

## ترتيب التشجير

### ترتيب المواضع فيما بينها

من آخر الآية إلى أولها. فترتيب مواضع `الحمد لله رب العالمين`:
**العالمين ← رب ← لله ← الحمد**.

نقطة ارتكاز الاختلاف الممتد على عدة كلمات هي **آخر كلمة من مداه**، لا أوله.

الوقف والابتداء يقسمان الآية مقاطع، ويُعالج آخر مقطع أولا.

يتقدم على ذلك كله **الرتبة اليدوية** (`variant.orderRank`) التي يثبّتها المحقق لهذه الآية، لأن الكتب تختلف في مواضع بعينها.

### ترتيب الأوجه داخل الموضع الواحد

| القاعدة | المصدر | متى تُستعمل |
|---------|--------|-------------|
| `MANUAL` صريح | `variant.alternativeOrder` | قرار المحقق لهذا الموضع — يسبق كل قاعدة |
| `STRENGTH` | رتبة درجة الوجه من سلّم الدرجات | الافتراضي: قوة الوجه في الكتاب |
| `TAYYIBAH` | ترتيب أول راوٍ في الطيبة | عند غياب الترجيح |

الوجه الذي لم تُسجَّل قوته يأتي بعد المسجَّل، فلا يتقدم وجه غير محقَّق على وجه رجّحه المحقق.

### درجات قوة الوجه

«الوجه المقدَّم» ليس مفهوما مستقلا عن القوة، بل هو أعلى درجاتها. فالمفهومان
مدموجان في **سلّم درجات** واحد قابل للتحرير من الإعدادات
(`src/lib/tashjeer/strength-degrees.ts`)، لا في حقل رقمي مجرّد.

| المفهوم | الحقل | الشرح |
|---------|-------|-------|
| سلّم الدرجات | `StrengthDegreeCatalog.degrees` | قائمة مرتّبة، لكل درجة `rank` و`label` ولون. الافتراضي أربع: مقدَّم، راجح، جائز، مؤخَّر — ويزيدها المحقق أو ينقصها من الإعدادات |
| «الوجه المقدَّم» | `StrengthDegree.isPreferred` | درجة واحدة لا غير تحمل هذه العلامة، وهي المقدَّمة في العرض والترتيب |
| درجة الوجه العامة | `alternative.strengthDegreeId` | درجة تنطبق على كل راوٍ في نطاق الوجه لم تُخصَّص له درجة |
| درجة كل راوٍ | `alternative.strengthByNarrator` | معرّف الراوي ← معرّف الدرجة. **وهذا الأصل**: الرواة يختلفون في تقديم الوجه الواحد، فيُسأل عن الدرجة لكل راوٍ على حدة عند إنشاء القاعدة |
| الحقل القديم | `alternative.strength` | رقم مجرّد في الملفات السابقة؛ يُقرأ رتبةً احتياطية فلا يضيع ترجيح سابق |

**رتبة الوجه = أصغر رتبة أعطاها له أحد رواته.** السطر في الشجرة واحد لا
يتجزأ، وتقديمه عند من قدّمه أولى من تأخيره عند من أخّره. أما اختلاف الرواة
فلا يُهدَر: يظهر في بطاقة الوجه عبر `isMixed` و`perNarrator` من
`resolveStrength`، فيرى القارئ من قدّم ومن أخّر.

الوجه المشتق من قاعدة عامة يرث درجاتها، إلا أن يُخصَّص لموضعه درجةٌ في
`RuleOccurrenceOverride.strengthDegreeId` — فتقديم الوجه قد يختلف من موضع
إلى موضع، وهذا التخصيص موضعي لا يتعدى صاحبه.

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
