# توثيق المكونات - Components Documentation

## نظرة عامة

هذا الملف يوثق جميع المكونات المستخدمة في المشروع مع شرح كل مكون وخصائصه واستخدامه.

---

## 1. مكونات المحرر (Editor Components)

### 1.1 TashjeerCanvas

المكون الرئيسي للمحرر - لوحة الرسم التي تحتوي على المصحف وخطوط التشجير.

**الموقع:** `src/components/editor/TashjeerCanvas.tsx`

**الخصائص (Props):**
```typescript
interface TashjeerCanvasProps {
  ayahId: number;              // معرف الآية
  surahId: number;             // معرف السورة
  qiraahOrder: number[];       // ترتيب القراء
  readOnly?: boolean;          // وضع القراءة فقط
  onSave?: (data: TashjeerData) => void; // عند الحفظ
}
```

**الحالة الداخلية:**
- `selectedWord`: الكلمة المحددة حالياً
- `hoveredNode`: العقدة التي يشير إليها الماوس
- `zoom`: مستوى التكبير
- `pan`: موضع التحريك
- `lines`: خطوط التشجير الحالية

**الأحداث:**
- `onWordSelect`: عند تحديد كلمة
- `onLineAdd`: عند إضافة خط تشجير
- `onLineUpdate`: عند تحديث خط
- `onEvidenceView`: عند عرض الدليل

---

### 1.2 WordMarker

مؤشر الكلمة في المصحف - يعرض الكلمة مع إمكانية تحديدها والتفاعل معها.

**الموقع:** `src/components/editor/WordMarker.tsx`

**الخصائص:**
```typescript
interface WordMarkerProps {
  word: Word;                  // بيانات الكلمة
  position: WordPosition;      // موقع الكلمة
  isSelected: boolean;         // هل محددة
  isHighlighted: boolean;      // هل مميزة
  readings: WordReading[];     // قراءات الكلمة
  onSelect: () => void;        // عند التحديد
  onHover: (node: TashjeerNode | null) => void; // عند التمرير
}
```

**المميزات:**
- عرض الكلمة بخط عثمان طه
- تمييز الكلمات المحددة بلون مختلف
- عرض نقاط ارتباط خطوط التشجير
- دعم الحركات بشكل كامل

---

### 1.3 LineDrawer

مكون رسم خطوط التشجير - يرسم الخطوط بين الكلمات المتفقة.

**الموقع:** `src/components/editor/LineDrawer.tsx`

**الخصائص:**
```typescript
interface LineDrawerProps {
  line: TashjeerLine;          // بيانات الخط
  positions: WordPositionMap;  // مواقع الكلمات
  isActive: boolean;           // هل نشط
  onUpdate: (line: TashjeerLine) => void;
  onDelete: () => void;
  onSelect: () => void;
}
```

**أنواع الخطوط:**
| النوع | اللون | الاستخدام |
|-------|-------|-----------|
| أصول | أخضر | الأصول التي تنطبق على كل المصحف |
| فرش | أزرق | الفرش الخاصة بكل قارئ |
| مدود | برتقالي | اختلافات المدود |

**خصائص الخط:**
- `strokeWidth`: سمك الخط
- `color`: لون الخط
- `dashStyle`: نمط الخط (متصل/متقطع)
- `curve`: انحناء الخط

---

### 1.4 EvidencePopup

نافذة منبثقة لعرض الأدلة عند التمرير أو الضغط على عقدة تشجير.

**الموقع:** `src/components/editor/EvidencePopup.tsx`

**الخصائص:**
```typescript
interface EvidencePopupProps {
  node: TashjeerNode;          // العقدة
  position: PopupPosition;     // موقع النافذة
  evidence: Evidence[];        // الأدلة
  onClose: () => void;
  onNavigate: (target: NavTarget) => void;
}
```

**المحتوى:**
- الدليل من الطيبة (مع رقم البيت)
- الدليل من النشر (مع رقم الصفحة)
- روابط للمنظومة والكتاب
- زر الانتقال للمصدر

---

### 1.5 Toolbar

شريط أدوات المحرر.

**الموقع:** `src/components/editor/Toolbar.tsx`

**الأدوات:**
- إضافة خط تشجير (أصول/فرش/مدود)
- تكبير/تصغير
- تحريك
- حفظ
- تراجع/إعادة
- عرض/إخفاء الطبقات

---

## 2. مكونات المصحف (Quran Components)

### 2.1 MushafView

عرض المصحف الأساسي - يعرض صفحة المصحف كاملة.

**الموقع:** `src/components/quran/MushafView.tsx`

**الخصائص:**
```typescript
interface MushafViewProps {
  page: number;                // رقم الصفحة
  surahId?: number;            // معرف السورة (اختياري)
  ayahId?: number;             // معرف الآية (اختياري)
  showTashjeer: boolean;       // إظهار التشجير
  qiraahFilter: number[];      // تصفية القراء
}
```

---

### 2.2 AyahBlock

مكون الآية - يعرض الآية مع كلماتها.

**الموقع:** `src/components/quran/AyahBlock.tsx`

**الخصائص:**
```typescript
interface AyahBlockProps {
  ayah: Ayah;                  // بيانات الآية
  words: Word[];               // كلمات الآية
  isSelected: boolean;         // هل محددة
  tashjeerLines: TashjeerLine[]; // خطوط التشجير
  onWordClick: (word: Word) => void;
}
```

---

### 2.3 WordHighlight

تمييز الكلمات - يعرض تمييزاً للكلمات حسب القراءات.

**الموقع:** `src/components/quran/WordHighlight.tsx`

---

## 3. مكونات واجهة المستخدم (UI Components)

### 3.1 Button

**الموقع:** `src/components/ui/Button.tsx`

**الأنواع:**
- `primary`: زر رئيسي
- `secondary`: زر ثانوي
- `ghost`: زر شفاف
- `danger`: زر خطر

---

### 3.2 Modal

**الموقع:** `src/components/ui/Modal.tsx`

---

### 3.3 Select

**الموقع:** `src/components/ui/Select.tsx`

---

### 3.4 Tooltip

**الموقع:** `src/components/ui/Tooltip.tsx`

---

## 4. مكونات نظام المراجعة (Review Components)

### 4.1 ReviewPanel

لوحة المراجعة للعلماء المجازين.

**الموقع:** `src/components/review/ReviewPanel.tsx`

**الخصائص:**
```typescript
interface ReviewPanelProps {
  tashjeerLine: TashjeerLine;
  scholar: Scholar;
  onApprove: (comment?: string) => void;
  onReject: (reason: string) => void;
  onRequestChanges: (changes: ChangeRequest[]) => void;
}
```

---

### 4.2 ScholarBadge

شارة العالم/المراجع.

**الموقع:** `src/components/review/ScholarBadge.tsx`

---

## 5. مكونات نظام القراء (Reader Components)

### 5.1 ReaderProfile

ملف القارئ.

**الموقع:** `src/components/reader/ReaderProfile.tsx`

---

### 5.2 IjazahCard

بطاقة الإجازة.

**الموقع:** `src/components/reader/IjazahCard.tsx`

---

## ملاحظات التطوير

### إضافة مكون جديد

1. أنشئ الملف في المجلد المناسب
2. أضف TypeScript Interface للخصائص
3. وثق المكون في هذا الملف
4. أضف المكون للـ index.ts الخاص بالمجلد

### تعديل مكون موجود

1. حافظ على التوافق مع الإصدارات السابقة
2. وثق التغييرات في CHANGELOG
3. اختبر جميع الحالات المستخدمة

### معايير الكود

- استخدام TypeScript بشكل صارم
- تسمية المتغيرات بالإنجليزية
- التوثيق بالعربية في الكود
- استخدام Tailwind CSS للتنسيق
