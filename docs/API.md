# توثيق API - API Documentation

## نظرة عامة

API المشروع مبني باستخدام Next.js API Routes.

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
