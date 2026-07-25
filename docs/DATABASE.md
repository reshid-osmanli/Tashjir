# توثيق قاعدة البيانات - Database Documentation

## نظرة عامة

قاعدة البيانات تستخدم PostgreSQL مع Prisma ORM للتعامل مع البيانات.

---

## الهيكل العام

```
┌─────────────────────────────────────────────────────────────────┐
│                        قاعدة البيانات                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐     │
│  │ Surah   │───▶│  Ayah   │───▶│  Word   │───▶│WordRead │     │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘     │
│                                     │              │           │
│                                     ▼              ▼           │
│                              ┌─────────┐    ┌─────────┐       │
│                              │TashNode │    │Evidence │       │
│                              └────┬────┘    └─────────┘       │
│                                   │                             │
│                                   ▼                             │
│                              ┌─────────┐                       │
│                              │TashLine │                       │
│                              └─────────┘                       │
│                                                                 │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                    │
│  │ Qiraah  │───▶│  Turuq  │    │ Scholar │                    │
│  └─────────┘    └─────────┘    └─────────┘                    │
│                                     │                          │
│                                     ▼                          │
│                              ┌─────────┐                       │
│                              │ Review  │                       │
│                              └─────────┘                       │
│                                                                 │
│  ┌─────────┐    ┌─────────┐                                    │
│  │ Reader  │───▶│ Ijazah  │                                    │
│  └─────────┘    └─────────┘                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## الجداول الرئيسية

### 1. جدول السور (Surah)

| الحقل | النوع | الوصف |
|-------|-------|-------|
| id | Int | معرف السورة (1-114) |
| name | String | اسم السورة |
| nameArabic | String | اسم السورة بالعربية |
| ayahsCount | Int | عدد الآيات |
| revelationType | enum | مكية/مدنية |

---

### 2. جدول الآيات (Ayah)

| الحقل | النوع | الوصف |
|-------|-------|-------|
| id | Int | معرف الآية الفريد |
| surahId | Int | معرف السورة |
| number | Int | رقم الآية في السورة |
| page | Int | رقم الصفحة في المصحف |
| juz | Int | رقم الحزب |
| hizb | Int | رقم الربع |
| rub | Int | رقم الربع (1-4) |
| text | String | نص الآية كاملاً |
| wordsCount | Int | عدد الكلمات |

---

### 3. جدول الكلمات (Word)

| الحقل | النوع | الوصف |
|-------|-------|-------|
| id | Int | معرف الكلمة الفريد |
| ayahId | Int | معرف الآية |
| position | Int | ترتيب الكلمة في الآية |
| text | String | النص بالحركات (حفص) |
| plainText | String | النص بدون حركات |
| unicode | String | النص بيونيكود للخط |
| pageX | Float | إحداثي X في الصفحة |
| pageY | Float | إحداثي Y في الصفحة |
| width | Float | عرض الكلمة |
| height | Float | ارتفاع الكلمة |

---

### 4. جدول القراءات (Qiraah)

| الحقل | النوع | الوصف |
|-------|-------|-------|
| id | Int | معرف القراءة |
| name | String | اسم القراءة |
| narrator | String | اسم القارئ/الراوي |
| tier | enum | قارئ/راوي/طريق |
| orderInTayyibah | Int | الترتيب في الطيبة |
| parentId | Int | معرف القراءة الأب |

**ترتيب القراءات في الطيبة:**

| orderInTayyibah | name | narrator |
|-----------------|------|----------|
| 1 | نافع | قالون |
| 2 | نافع | ورش |
| 3 | ابن كثير | البزي |
| 4 | ابن كثير | قنبل |
| 5 | أبو عمرو | الدوري |
| 6 | أبو عمرو | السوسي |
| 7 | ابن عامر | هشام |
| 8 | ابن عامر | ابن ذكوان |
| 9 | عاصم | حفص |
| 10 | عاصم | شعبة |
| 11 | حمزة | خلف |
| 12 | حمزة | خلاد |
| 13 | الكسائي | الليث |
| 14 | الكسائي | الدوري |
| 15 | أبو جعفر | ابن وردان |
| 16 | أبو جعفر | ابن جماز |
| 17 | يعقوب | رويس |
| 18 | يعقوب | روح |
| 19 | خلف | إدريس |
| 20 | خلف | إسحاق |

---

### 5. جدول الطرق (Turuq)

| الحقل | النوع | الوصف |
|-------|-------|-------|
| id | Int | معرف الطريق |
| qiraahId | Int | معرف القراءة |
| name | String | اسم الطريق |
| parentTuruqId | Int | معرف الطريق الأب |
| order | Int | ترتيب الطريق |

---

### 6. جدول قراءات الكلمات (WordReading)

| الحقل | النوع | الوصف |
|-------|-------|-------|
| id | Int | معرف القراءة |
| wordId | Int | معرف الكلمة |
| qiraahId | Int | معرف القراءة |
| turuqId | Int | معرف الطريق |
| text | String | نص القراءة بالحركات |
| differences | String | وصف الاختلاف |
| category | enum | أصول/فرش/مدود/وقف |
| notes | String | ملاحظات |

---

### 7. جدول خطوط التشجير (TashjeerLine)

| الحقل | النوع | الوصف |
|-------|-------|-------|
| id | Int | معرف الخط |
| ayahId | Int | معرف الآية |
| type | enum | أصول/فرش/مدود |
| color | String | لون الخط |
| strokeWidth | Float | سمك الخط |
| dashStyle | String | نمط الخط |
| yPosition | Float | محور Y |
| isActive | boolean | هل نشط |
| createdBy | Int | معرف المنشئ |
| verifiedBy | Int | معرف المراجع |

---

### 8. جدول عقد التشجير (TashjeerNode)

| الحقل | النوع | الوصف |
|-------|-------|-------|
| id | Int | معرف العقدة |
| tashjeerLineId | Int | معرف الخط |
| wordId | Int | معرف الكلمة |
| qiraahId | Int | معرف القراءة |
| position | enum | أعلى/أسفل/وسط |
| x | Float | إحداثي X |
| y | Float | إحداثي Y |

---

### 9. جدول الأدلة (Evidence)

| الحقل | النوع | الوصف |
|-------|-------|-------|
| id | Int | معرف الدليل |
| wordReadingId | Int | معرف القراءة |
| source | enum | النشر/الطيبة/الجنة/غيره |
| text | String | نص الدليل |
| reference | String | المرجع |
| manzumaLine | String | بيت المنظومة |
| kitabPage | String | صفحة الكتاب |
| linkType | enum | منظومة/كتاب/خارجي |
| linkUrl | String | الرابط |

---

### 10. جدول العلماء (Scholar)

| الحقل | النوع | الوصف |
|-------|-------|-------|
| id | Int | معرف العالم |
| name | String | الاسم |
| email | String | البريد |
| password | String | كلمة المرور (مشفرة) |
| role | enum | مراجع/مدقق/مشرف |
| specializations String[] | التخصصات |
| isActive | boolean | هل نشط |

---

### 11. جدول المراجعات (Review)

| الحقل | النوع | الوصف |
|-------|-------|-------|
| id | Int | معرف المراجعة |
| scholarId | Int | معرف العالم |
| tashjeerLineId | Int | معرف الخط |
| status | enum | معلق/مقبول/مرفوض |
| comment | String | التعليق |
| createdAt | DateTime | تاريخ الإنشاء |
| updatedAt | DateTime | تاريخ التحديث |

---

### 12. جدول القراء (Reader)

| الحقل | النوع | الوصف |
|-------|-------|-------|
| id | Int | معرف القارئ |
| name | String | الاسم |
| email | String | البريد |
| qiraat | String[] | القراءات |
| isActive | boolean | هل نشط |

---

### 13. جدول الإجازات (Ijazah)

| الحقل | النوع | الوصف |
|-------|-------|-------|
| id | Int | معرف الإجازة |
| readerId | Int | معرف القارئ |
| qiraah | String | القراءة |
| narrator | String | الرواية |
| turuq | String[] | الطرق |
| granter | String | المجيز |
| date | DateTime | التاريخ |
| certificateUrl | String | رابط الشهادة |

---

## العلاقات (Relations)

```
Surah 1───* Ayah 1───* Word 1───* WordReading *───1 Qiraah
                  │                              │
                  └──1 TashjeerLine 1───* TashjeerNode *───1 Word
                                             │
                                             └──1 Evidence

Qiraah 1───* Turuq (self-relation)

Scholar 1───* Review *───1 TashjeerLine

Reader 1───* Ijazah
```

---

## الفهارس (Indexes)

```sql
-- فهارس لتحسين الأداء
CREATE INDEX idx_word_ayah ON Word(ayahId);
CREATE INDEX idx_wordreading_word ON WordReading(wordId);
CREATE INDEX idx_wordreading_qiraah ON WordReading(qiraahId);
CREATE INDEX idx_tashline_ayah ON TashjeerLine(ayahId);
CREATE INDEX idx_tashnode_line ON TashjeerNode(tashjeerLineId);
CREATE INDEX idx_tashnode_word ON TashjeerNode(wordId);
CREATE INDEX idx_evidence_reading ON Evidence(wordReadingId);
CREATE INDEX idx_qiraah_order ON Qiraah(orderInTayyibah);
```

---

## النسخ الاحتياطي

- نسخ احتياطي يومي تلقائي
- الاحتفاظ بالنسخ لمدة 30 يوم
- نسخ احتياطي قبل كل تحديث كبير
