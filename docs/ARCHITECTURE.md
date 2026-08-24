# هيكل النظام - Architecture Documentation

## نظرة عامة

مشروع التشجير مبني باستخدام Next.js 15 مع App Router، ويستخدم PostgreSQL كقاعدة بيانات مع Prisma ORM.

---

## المكدس التقني (Tech Stack)

| التقنية | الإصدار | الاستخدام |
|---------|---------|-----------|
| Next.js | 15 | إطار العمل الرئيسي |
| React | 19 | واجهة المستخدم |
| TypeScript | 5 | الأنواع والسلامة |
| Tailwind CSS | 4 | التنسيق |
| Prisma | 6 | ORM قاعدة البيانات |
| PostgreSQL | 16 | قاعدة البيانات |
| Zustand | 5 | إدارة الحالة |
| React Query | 5 | جلب البيانات |
| NextAuth.js | 5 | المصادقة |
| Zod | 3 | التحقق من البيانات |

---

## هيكل المجلدات

```
tashjeer/
├── docs/                          # التوثيق
│   ├── ARCHITECTURE.md            # هذا الملف
│   ├── COMPONENTS.md              # توثيق المكونات
│   ├── DATABASE.md                # توثيق قاعدة البيانات
│   ├── QIRAAT.md                  # بيانات القراءات
│   ├── TASHJEER_LOGIC.md          # منطق التشجير
│   └── API.md                     # توثيق API
│
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx             # التخطيط الرئيسي
│   │   ├── page.tsx               # الصفحة الرئيسية
│   │   ├── globals.css            # الأنماط العامة
│   │   │
│   │   ├── (dashboard)/           # مجموعة لوحة التحكم
│   │   │   ├── layout.tsx         # تخطيط لوحة التحكم
│   │   │   ├── page.tsx           # صفحة لوحة التحكم
│   │   │   ├── editor/            # محرر التشجير
│   │   │   │   ├── page.tsx       # صفحة المحرر
│   │   │   │   └── [ayahId]/
│   │   │   │       └── page.tsx   # محرر آية محددة
│   │   │   ├── quran/             # عرض المصحف
│   │   │   │   ├── page.tsx       # صفحة المصحف
│   │   │   │   └── [surahId]/
│   │   │   │       └── page.tsx   # عرض سورة
│   │   │   ├── review/            # نظام المراجعة
│   │   │   │   ├── page.tsx       # صفحة المراجعة
│   │   │   │   └── [lineId]/
│   │   │   │       └── page.tsx   # مراجعة خط
│   │   │   └── readers/           # نظام القراء
│   │   │       ├── page.tsx       # صفحة القراء
│   │   │       └── [readerId]/
│   │   │           └── page.tsx   # ملف قارئ
│   │   │
│   │   ├── api/                   # API Routes
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/
│   │   │   │       └── route.ts   # مصادقة NextAuth
│   │   │   ├── quran/
│   │   │   │   ├── route.ts       # جلب القرآن
│   │   │   │   ├── [surahId]/
│   │   │   │   │   └── route.ts   # جلب سورة
│   │   │   │   └── [surahId]/
│   │   │   │       └── [ayahId]/
│   │   │   │           └── route.ts # جلب آية
│   │   │   ├── tashjeer/
│   │   │   │   ├── route.ts       # جلب التشجير
│   │   │   │   ├── [ayahId]/
│   │   │   │   │   └── route.ts   # جلب تشجير آية
│   │   │   │   └── save/
│   │   │   │       └── route.ts   # حفظ التشجير
│   │   │   ├── qiraat/
│   │   │   │   └── route.ts       # جلب القراءات
│   │   │   ├── evidence/
│   │   │   │   └── route.ts       # جلب الأدلة
│   │   │   ├── review/
│   │   │   │   ├── route.ts       # جلب المراجعات
│   │   │   │   └── [reviewId]/
│   │   │   │       └── route.ts   # مراجعة محددة
│   │   │   └── readers/
│   │   │       ├── route.ts       # جلب القراء
│   │   │       └── [readerId]/
│   │   │           └── route.ts   # قارئ محدد
│   │   │
│   │   └── login/                 # صفحة تسجيل الدخول
│   │       └── page.tsx
│   │
│   ├── components/                # المكونات
│   │   ├── editor/                # مكونات المحرر
│   │   │   ├── TashjeerCanvas.tsx # لوحة الرسم الرئيسية
│   │   │   ├── WordMarker.tsx     # مؤشر الكلمة
│   │   │   ├── LineDrawer.tsx     # رسم الخطوط
│   │   │   ├── EvidencePopup.tsx  # نافذة الدليل
│   │   │   ├── Toolbar.tsx        # شريط الأدوات
│   │   │   └── PropertiesPanel.tsx # لوحة الخصائص
│   │   │
│   │   ├── quran/                 # مكونات المصحف
│   │   │   ├── MushafView.tsx     # عرض المصحف
│   │   │   ├── AyahBlock.tsx      # مكون الآية
│   │   │   ├── WordHighlight.tsx  # تمييز الكلمات
│   │   │   └── PageNavigation.tsx # تنقل الصفحات
│   │   │
│   │   ├── review/                # مكونات المراجعة
│   │   │   ├── ReviewPanel.tsx    # لوحة المراجعة
│   │   │   ├── ScholarBadge.tsx   # شارة العالم
│   │   │   └── ReviewStatus.tsx   # حالة المراجعة
│   │   │
│   │   ├── reader/                # مكونات القراء
│   │   │   ├── ReaderProfile.tsx  # ملف القارئ
│   │   │   ├── IjazahCard.tsx     # بطاقة الإجازة
│   │   │   └── ReaderList.tsx     # قائمة القراء
│   │   │
│   │   ├── ui/                    # مكونات واجهة عامة
│   │   │   ├── Button.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Tooltip.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   └── Spinner.tsx
│   │   │
│   │   └── layout/                # مكونات التخطيط
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       ├── Footer.tsx
│   │       └── Breadcrumb.tsx
│   │
│   ├── lib/                       # المكتبات والمنطق
│   │   ├── quran-logic/           # منطق القرآن والقراءات
│   │   │   ├── tajweed.ts         # أحكام التجويد
│   │   │   ├── harakat.ts         # معالجة الحركات
│   │   │   ├── qiraat-rules.ts    # قواعد القراءات
│   │   │   └── text-analysis.ts   # تحليل النص
│   │   │
│   │   ├── tashjeer/              # منطق التشجير
│   │   │   ├── position-engine.ts # محرك المواقع
│   │   │   ├── line-calculator.ts # حاسبة الخطوط
│   │   │   ├── color-system.ts    # نظام الألوان
│   │   │   └── export-import.ts   # التصدير والاستيراد
│   │   │
│   │   ├── db/                    # قاعدة البيانات
│   │   │   ├── client.ts          # عميل Prisma
│   │   │   ├── queries.ts         # الاستعلامات
│   │   │   └── seed.ts            # البيانات الأولية
│   │   │
│   │   └── utils/                 # أدوات مساعدة
│   │       ├── arabic.ts          # أدوات عربية
│   │       ├── validators.ts      # مدققات
│   │       └── helpers.ts         # مساعدات
│   │
│   ├── hooks/                     # React Hooks
│   │   ├── useMushafLayout.ts     # تخطيط المصحف
│   │   ├── useTashjeerLines.ts    # خطوط التشجير
│   │   ├── useWordSelection.ts    # تحديد الكلمات
│   │   ├── useEvidence.ts         # الأدلة
│   │   ├── useZoom.ts             # التكبير
│   │   └── useAuth.ts             # المصادقة
│   │
│   ├── types/                     # TypeScript Types
│   │   ├── quran.ts               # أنواع القرآن
│   │   ├── tashjeer.ts            # أنواع التشجير
│   │   ├── qiraat.ts              # أنواع القراءات
│   │   ├── evidence.ts            # أنواع الأدلة
│   │   ├── review.ts              # أنواع المراجعة
│   │   ├── reader.ts              # أنواع القراء
│   │   └── ui.ts                  # أنواع الواجهة
│   │
│   ├── data/                      # البيانات الثابتة
│   │   ├── quran-text/            # نص المصحف
│   │   │   ├── surahs.json        # بيانات السور
│   │   │   └── pages.json         # بيانات الصفحات
│   │   ├── qiraat-data/           # بيانات القراءات
│   │   │   ├── qiraat.json        # القراءات العشر
│   │   │   ├── turuq.json         # الطرق
│   │   │   └── order.json         # الترتيب في الطيبة
│   │   └── evidence/              # الأدلة
│   │       ├── tayyibah.json      # الطيبة
│   │       └── nashr.json         # النشر
│   │
│   └── stores/                    # إدارة الحالة
│       ├── editor-store.ts        # حالة المحرر
│       ├── quran-store.ts         # حالة المصحف
│       └── auth-store.ts          # حالة المصادقة
│
├── prisma/                        # Prisma
│   ├── schema.prisma              # مخطط قاعدة البيانات
│   └── seed.ts                    # البيانات الأولية
│
├── public/                        # الملفات العامة
│   ├── fonts/                     # الخطوط
│   │   ├── UthmanicHafs.otf      # خط عثمان طه
│   │   └── Amiri.ttf              # خط أميري
│   └── images/                    # الصور
│
├── .env                           # متغيرات البيئة
├── .env.example                   # مثال متغيرات البيئة
├── next.config.js                 # إعدادات Next.js
├── tailwind.config.js             # إعدادات Tailwind
├── tsconfig.json                  # إعدادات TypeScript
├── package.json                   # الحزم
└── README.md                      # الرئيسي
```

---

## تدفق البيانات

```
┌─────────────────────────────────────────────────────────────────┐
│                        المستخدم                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    واجهة المستخدم (React)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  المحرر     │  │  المصحف     │  │  المراجعة   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    إدارة الحالة (Zustand)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │Editor Store │  │Quran Store  │  │ Auth Store  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    المكتبات (Lib)                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │Quran Logic  │  │Tashjeer     │  │Position     │             │
│  │             │  │Logic        │  │Engine       │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Routes (Next.js)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │/api/quran   │  │/api/tashjeer│  │/api/review  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Prisma ORM                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## أنماط التصميم المستخدمة

### 1. Compound Components
للمكونات المرتبطة ببعضها مثل المحرر والمصحف.

### 2. Custom Hooks
لفصل المنطق عن العرض.

### 3. Server Components
للبيانات الثابتة والعرض الأولي.

### 4. Client Components
للتفاعل والمحرر.

---

## الأمان

1. **المصادقة:** NextAuth.js مع JWT
2. **الصلاحيات:** RBAC (Role-Based Access Control)
3. **التحقق:** Zod لجميع المدخلات
4. **الحماية:** CSRF, XSS, SQL Injection

---

## الأداء

1. **التخزين المؤقت:** React Query للبيانات
2. **التحميل الكسول:** React.lazy و dynamic imports
3. **الصور:** Next.js Image Optimization
4. **الخطوط:** Font Optimization

---

## النشر

1. **التطوير:** `npm run dev`
2. **البناء:** `npm run build`
3. **الإنتاج:** `npm start`
4. **قاعدة البيانات:** `npx prisma migrate deploy`

---

## طبقة السياسة وحلّ القرار المركزي (PH0 — FR-EN-01..04، FR-ES-01/05/06/10)

المحرك الكودي (`src/lib/tashjeer/*`: القياس، التخطيط، ضرب الأوجه، توليد الأسطر)
يبقى كودًا خوارزميًا (P-08). كل قرار **قابل للتهيئة** (أولوية، دمج، منع دمج، فصل،
سياق وقف/وصل، استثناء، تعارض، ترتيب) انتقل إلى طبقة سياسة موحّدة يديرها لاحقًا
Engine Studio، ويُحلّ عبر مكوّن واحد:

- `src/lib/tashjeer/decision/policy.ts` — `EngineConfig` (مجموعات الأولوية، سلم حل
  التعارض، ترتيب التنفيذ، مصفوفة الدمج، السياقات) + ملف النظام الافتراضي
  `DEFAULT_SYSTEM_PROFILE`.
- `src/lib/tashjeer/decision/conditions.ts` — مُقيِّم شروط بلا كود (field/op/value).
- `src/lib/tashjeer/decision/resolver.ts` — **حلّ القرار المركزي**: مطابقة القواعد،
  الأولوية، الخصوصية، حل التعارض، الدمج، التنافي؛ يعيد كل قرار مرفقًا بأثر
  (`DecisionTrace`) قابل للتفسير (Why؟، FR-ES-10).
- `src/lib/tashjeer/decision/api.ts` — **واجهة القرار الموحّدة** (FR-EN-03):
  `resolveDifference / resolveMerge / resolveOrder / resolveRelation /
  resolveConnection / resolveVariant`. كلها تمرّ من الحل المركزي ولا تنفّذ قرارًا
  خاصًا في أي Feature (P-07).

هذا يضمن: **قرار واحد في مكان واحد**، وبيانات لا تضيع، وكل نتيجة قابلة للتفسير.

## سجل التراجع الموحّد (PH0 — DM-15، FR-ED-13)

`src/lib/tashjeer/history/command-log.ts` — سجل أوامر نقي (بلا DOM) يغطي النقل،
الدمج، الفصل، الحذف الفردي/الجماعي، اللصق، التعميم، إنشاء المجموعة، إعادة الترتيب،
تعديل الرتبة، علامات الوقف، والتجاوزات المحلية. العمليات الدفعية تُتراجع **وحدة
واحدة** (`transaction`)، ويدعم القفز إلى أي عمق (`jumpTo`) وقوائم اللقطات
(`snapshotCommand`).

---

## طبقة القرار الحالية (v8)

المرجع التشغيلي للقرارات القابلة للتهيئة هو:

```
Engine Studio profile → Decision API → Decision Resolver → Engine Core
```

- `src/lib/tashjeer/decision/resolver.ts` هو المكان الوحيد لحل الأولوية
  والخصوصية والتعارض والدمج/التنافي.
- `src/lib/tashjeer/decision/api.ts` يتيح `resolveDifference`, `resolveMerge`,
  `resolveOrder`, `resolveRelation`, `resolveConnection`, و`resolveVariant`.
- لا تنفذ الواجهة قرار دمج خاصا بها؛ تستدعي السياسة وتعرض `DecisionTrace`.
- `engine-studio-store` مخزن Zustand دائم في المتصفح، فيما يبقى محرك القياس
  والرسم والضرب كودا حتميا في `lib/tashjeer/`.
