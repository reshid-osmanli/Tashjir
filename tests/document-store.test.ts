// اختبارات مخزن المستندات - Document Store Tests
// مشروع التشجير - نظام القراءات العشر
//
// المخزن هو ما يحفظ عمل المستخدم. أي خلل فيه يعني ضياع ساعات من التحقيق،
// لذلك تُختبر دورة الحياة كاملة: إنشاء، حفظ، تحميل، تصدير، استيراد، حذف.
//
// نستعمل بديلا بسيطا لـ localStorage لأن بيئة الاختبار node بلا DOM.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAyahKey } from '@/data/quran';

/** بديل مبسط لـ localStorage يكفي لعقد الواجهة المستخدم في المخزن. */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** يستورد المخزن بعد تهيئة البيئة، لأنه يفحص وجود window عند الاستدعاء. */
async function loadStore() {
  return import('@/lib/storage/document-store');
}

describe('إنشاء المستند', () => {
  it('ينشئ مستندا بحالة مسودة وببيانات الآية الصحيحة', async () => {
    const store = await loadStore();
    const document = store.createDocument(makeAyahKey(2, 10));

    expect(document.surahNumber).toBe(2);
    expect(document.ayahNumber).toBe(10);
    expect(document.meta.status).toBe('DRAFT');
    expect(document.schemaVersion).toBe(store.SCHEMA_VERSION);
  });

  it('يحمّل الاختلافات الأولية للآيات التي فيها بذرة', async () => {
    const store = await loadStore();
    const document = store.createDocument(makeAyahKey(1, 4));

    expect(document.variants.length).toBeGreaterThan(0);
    expect(document.variants[0].title).toContain('مَٰلِكِ');
  });

  it('ينشئ مستندا فارغا للآيات بلا بذرة', async () => {
    const store = await loadStore();
    expect(store.createDocument(makeAyahKey(50, 3)).variants).toHaveLength(0);
  });

  it('البذرة منسوخة نسخا عميقا فلا يؤثر التعديل على المستندات الأخرى', async () => {
    const store = await loadStore();
    const first = store.createDocument(makeAyahKey(1, 4));
    first.variants[0].title = 'تعديل محلي';

    const second = store.createDocument(makeAyahKey(1, 4));
    expect(second.variants[0].title).not.toBe('تعديل محلي');
  });
});

describe('الحفظ والتحميل', () => {
  it('يحفظ ثم يحمّل المستند نفسه', async () => {
    const store = await loadStore();
    const ayahKey = makeAyahKey(1, 4);

    store.saveDocument(store.createDocument(ayahKey));
    const loaded = store.loadDocument(ayahKey);

    expect(loaded?.ayahKey).toBe(ayahKey);
    expect(loaded?.variants.length).toBeGreaterThan(0);
  });

  it('يعيد null لمستند غير محفوظ', async () => {
    const store = await loadStore();
    expect(store.loadDocument(makeAyahKey(50, 3))).toBeNull();
  });

  it('loadOrCreateDocument ينشئ عند غياب المحفوظ', async () => {
    const store = await loadStore();
    const document = store.loadOrCreateDocument(makeAyahKey(50, 3));
    expect(document.ayahKey).toBe(makeAyahKey(50, 3));
  });

  it('الحفظ يحدّث طابع آخر تعديل', async () => {
    const store = await loadStore();
    const original = store.createDocument(makeAyahKey(1, 1));
    original.meta.updatedAt = '2020-01-01T00:00:00.000Z';

    const saved = store.saveDocument(original);
    expect(saved.meta.updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
  });

  it('hasDocument يميّز المحفوظ من غيره', async () => {
    const store = await loadStore();
    const ayahKey = makeAyahKey(1, 2);

    expect(store.hasDocument(ayahKey)).toBe(false);
    store.saveDocument(store.createDocument(ayahKey));
    expect(store.hasDocument(ayahKey)).toBe(true);
  });
});

describe('الفهرس', () => {
  it('يسجّل كل مستند محفوظ مرة واحدة', async () => {
    const store = await loadStore();
    const ayahKey = makeAyahKey(1, 4);

    store.saveDocument(store.createDocument(ayahKey));
    store.saveDocument(store.loadDocument(ayahKey)!);

    expect(store.listDocuments()).toHaveLength(1);
  });

  it('يرتب الفهرس بالأحدث تعديلا', async () => {
    const store = await loadStore();

    const first = store.saveDocument(store.createDocument(makeAyahKey(1, 1)));
    // تأخير مصطنع لضمان اختلاف الطابع الزمني.
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = store.saveDocument(store.createDocument(makeAyahKey(2, 5)));

    const index = store.listDocuments();
    expect(index[0].ayahKey).toBe(second.ayahKey);
    expect(index[1].ayahKey).toBe(first.ayahKey);
  });

  it('الحذف يزيل المستند من الفهرس والتخزين', async () => {
    const store = await loadStore();
    const ayahKey = makeAyahKey(1, 4);

    store.saveDocument(store.createDocument(ayahKey));
    store.deleteDocument(ayahKey);

    expect(store.listDocuments()).toHaveLength(0);
    expect(store.loadDocument(ayahKey)).toBeNull();
  });
});

describe('التصدير والاستيراد', () => {
  it('يصدّر بصيغة معروفة تحمل إصدار المخطط', async () => {
    const store = await loadStore();
    store.saveDocument(store.createDocument(makeAyahKey(1, 4)));

    const bundle = JSON.parse(store.exportDocuments());
    expect(bundle.format).toBe('tashjeer-export');
    expect(bundle.schemaVersion).toBe(store.SCHEMA_VERSION);
    expect(bundle.documents).toHaveLength(1);
  });

  it('دورة تصدير واستيراد تحفظ المحتوى كما هو', async () => {
    const store = await loadStore();
    const ayahKey = makeAyahKey(1, 4);

    const saved = store.saveDocument(store.createDocument(ayahKey));
    const json = store.exportDocuments([ayahKey]);

    store.deleteDocument(ayahKey);
    expect(store.loadDocument(ayahKey)).toBeNull();

    const result = store.importDocuments(json);
    expect(result.imported).toBe(1);
    expect(store.loadDocument(ayahKey)?.variants).toEqual(saved.variants);
  });

  it('لا يستبدل الموجود إلا بطلب صريح', async () => {
    const store = await loadStore();
    const ayahKey = makeAyahKey(1, 4);

    store.saveDocument(store.createDocument(ayahKey));
    const json = store.exportDocuments([ayahKey]);

    expect(store.importDocuments(json).skipped).toBe(1);
    expect(store.importDocuments(json, true).imported).toBe(1);
  });

  it('يرفض الملفات غير الصالحة بلا انهيار', async () => {
    const store = await loadStore();

    expect(store.importDocuments('نص ليس JSON').errors).toHaveLength(1);
    expect(store.importDocuments('{"format":"other"}').errors).toHaveLength(1);
    expect(store.importDocuments('{"format":"other"}').imported).toBe(0);
  });

  it('يتجاهل المستندات المعطوبة داخل ملف صالح', async () => {
    const store = await loadStore();
    const json = JSON.stringify({
      format: 'tashjeer-export',
      schemaVersion: 2,
      documents: [{ noAyahKey: true }],
    });

    const result = store.importDocuments(json);
    expect(result.imported).toBe(0);
    expect(result.errors).toHaveLength(1);
  });

  it('يرقّي المستندات الناقصة الحقول عند الاستيراد', async () => {
    const store = await loadStore();
    const json = JSON.stringify({
      format: 'tashjeer-export',
      schemaVersion: 1,
      documents: [{ ayahKey: makeAyahKey(3, 7) }],
    });

    store.importDocuments(json, true);
    const loaded = store.loadDocument(makeAyahKey(3, 7));

    expect(loaded?.surahNumber).toBe(3);
    expect(loaded?.ayahNumber).toBe(7);
    expect(loaded?.variants).toEqual([]);
    expect(loaded?.meta.status).toBe('DRAFT');
  });
});
