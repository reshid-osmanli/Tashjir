// اختبار نموذج العرض الحقيقي — Live Showcase Model Test
//
// مشروع التشجير - نظام القراءات العشر
//
// يحرس هذا الاختبار قاعدة المواصفة §128: **كل رسم في الواجهة يُبنى من المحرك،
// لا من نموذج شبيه مكتوب يدويا**. لذلك لا نختبر "شكل" الصفحة، بل نختبر أن
// النموذج الذي ترسمه الواجهة هو ناتج المجال نفسه:
//
//   1. الكلمات وإحداثياتها = ناتج layout-engine.
//   2. الأسطر والرموز والروابط = ناتج classic-tashjeer على البذرة الحقيقية.
//   3. مواضع الاختلاف تشير إلى كلمات موجودة فعلا في الآية (لا موضع مُختلق).
//   4. حدود إطار التشريح تشمل صف الرموز، فلا شيء يُقتطع خارج الشكل.
//   5. الأعداد والتسميات تأتي من البيانات، ولا رقم مكتوب في الواجهة.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildShowcase, SHOWCASE_FILTER } from '@/lib/tashjeer/showcase';
import { readerRowMetrics } from '@/components/visualization/TashjeerAnatomy';
import { buildQiraatTree } from '@/components/marketing/LandingProof';
import { getAyahByKey, getAyahWordsByKey, makeAyahKey } from '@/data/quran';
import { getSeedVariants } from '@/data/variants/seed-variants';
import { DEFAULT_LAYOUT_OPTIONS, layoutAyah } from '@/lib/tashjeer/layout-engine';
import { generateClassicTashjeer } from '@/lib/tashjeer/classic-tashjeer';
import { createDefaultTransmissionCatalog } from '@/lib/transmissions/catalog';
import { NARRATORS, READING_IMAMS, TRANSMISSION_PATH_SEEDS } from '@/data/qiraat-data/qiraat';

const AYAH_KEY = makeAyahKey(1, 4);
const OPTIONS = { fontSize: 40, singleLine: true, paddingLeft: 30, paddingRight: 30 };

describe('نموذج الواجهة الحقيقي', () => {
  it('يعيد null لمعرّف آية غير موجود، بدل نموذج ناقص', () => {
    expect(buildShowcase(999_999)).toBeNull();
  });

  it('يأخذ النص والكلمات من بيانات المصحف نفسها', () => {
    const model = buildShowcase(AYAH_KEY, OPTIONS);
    const ayah = getAyahByKey(AYAH_KEY);
    const words = getAyahWordsByKey(AYAH_KEY);

    expect(model).not.toBeNull();
    expect(model!.text).toBe(ayah!.text);
    expect(model!.words.map((word) => word.text)).toEqual(words.map((word) => word.text));
    expect(model!.words.map((word) => word.position)).toEqual(words.map((word) => word.position));
    expect(model!.surahName).toBe('الفاتحة');
    expect(model!.ayahRef).toBe('١:٤');
  });

  it('إحداثيات الكلمات هي ناتج محرك التخطيط بلا تعديل', () => {
    const model = buildShowcase(AYAH_KEY, OPTIONS);
    const layout = layoutAyah(AYAH_KEY, getAyahWordsByKey(AYAH_KEY), {
      ...DEFAULT_LAYOUT_OPTIONS,
      ...OPTIONS,
    });

    for (const box of layout.boxes) {
      const mirrored = model!.words.find((word) => word.position === box.position);
      expect(mirrored).toBeDefined();
      expect(mirrored!.x).toBeCloseTo(box.x, 6);
      expect(mirrored!.width).toBeCloseTo(box.width, 6);
      expect(mirrored!.baselineY).toBeCloseTo(box.baselineY, 6);
      expect(mirrored!.centerX).toBeCloseTo(box.centerX, 6);
    }
  });

  it('الأسطر والرموز والروابط مطابقة لناتج التشجير الكلاسيكي', () => {
    const catalog = createDefaultTransmissionCatalog();
    const layout = layoutAyah(AYAH_KEY, getAyahWordsByKey(AYAH_KEY), {
      ...DEFAULT_LAYOUT_OPTIONS,
      ...OPTIONS,
    });
    const classic = generateClassicTashjeer(
      getSeedVariants(AYAH_KEY),
      layout,
      SHOWCASE_FILTER,
      OPTIONS,
      { catalog }
    );
    const model = buildShowcase(AYAH_KEY, OPTIONS);

    expect(model!.lines).toHaveLength(classic.lines.length);

    classic.lines.forEach((line, index) => {
      const showcaseLine = model!.lines[index];
      expect(showcaseLine.id).toBe(line.id);
      expect(showcaseLine.category).toBe(line.category);
      expect(showcaseLine.rowY).toBeCloseTo(line.rowY, 6);
      expect(showcaseLine.spanStartX).toBeCloseTo(line.spanStartX, 6);
      expect(showcaseLine.spanEndX).toBeCloseTo(line.spanEndX, 6);
      expect(showcaseLine.symbols).toEqual(line.symbols);
      expect(showcaseLine.marks.map((mark) => mark.x)).toEqual(line.marks.map((mark) => mark.x));
      expect(showcaseLine.readers.map((reader) => reader.name)).toEqual(
        line.readers.map((reader) => reader.name)
      );
    });
  });

  it('كل موضع اختلاف يشير إلى كلمة موجودة، ولا رقم مُختلق', () => {
    const model = buildShowcase(AYAH_KEY, OPTIONS);
    const positions = new Set(model!.words.map((word) => word.position));

    for (const line of model!.lines) {
      for (const mark of line.marks) {
        expect(positions.has(mark.position)).toBe(true);
      }
    }

    // موضع «مَٰلِكِ» هو الكلمة الأولى، والقراء الستة في البذرة بترتيب الطيبة.
    expect(model!.variant?.startPosition).toBe(1);
    expect(model!.variant?.endPosition).toBe(1);
    expect(model!.lines[0].marks[0].position).toBe(1);
    const rtlNames = model!.lines[0].readers.map((reader) => reader.name);
    const tayyibahOrder = rtlNames.map(
      (name) => NARRATORS.find((narrator) => narrator.name === name)?.legacyOrderInTayyibah ?? 0
    );
    expect([...tayyibahOrder]).toEqual([...tayyibahOrder].sort((a, b) => a - b));
  });

  it('حدود التشريح تشمل صف الرموز كاملا', () => {
    const model = buildShowcase(AYAH_KEY, OPTIONS)!;
    const metrics = readerRowMetrics(model)!;

    expect(metrics).not.toBeNull();
    expect(model.lines[0].symbols.length).toBeGreaterThan(1);

    // الصف يمتد من طرف سطر الوجه إلى آخر رمز، وكلها داخل الإطار.
    expect(metrics.viewBox.y).toBeLessThanOrEqual(model.lines[0].rowY);
    expect(metrics.viewBox.x).toBeLessThanOrEqual(
      metrics.firstSymbolX - metrics.symbolStep * (model.lines[0].symbols.length - 1) - metrics.symbolRadius
    );
    expect(metrics.viewBox.y + metrics.viewBox.height).toBeGreaterThanOrEqual(
      metrics.symbolsY + metrics.symbolRadius
    );
    // والحد الأيمن للإطار لا يقتطع النص.
    expect(metrics.viewBox.x + metrics.viewBox.width).toBeGreaterThanOrEqual(
      model.viewBox.x + model.viewBox.width
    );
  });

  it('لوح العرض المشترك لا يستورد بيانات المصحف ولا حالة، فتبقى حزمة الصفحة خفيفة', () => {
    const plate = readFileSync(
      resolve(__dirname, '../src/components/visualization/TashjeerPlate.tsx'),
      'utf8'
    );
    expect(plate).not.toContain("from '@/data/quran'");
    expect(plate).not.toContain("from '@/data/variants");
    expect(plate).not.toContain('generateClassicTashjeer');
    expect(plate).not.toContain("'use client'");

    // ومعاينة المحرر تعتمد اللوح، لا محرك التخطيط ولا بيانات المصحف.
    const preview = readFileSync(
      resolve(__dirname, '../src/components/marketing/EditorPreview.tsx'),
      'utf8'
    );
    expect(preview).not.toContain("from '@/data/quran'");
    expect(preview).not.toContain('layoutAyah');
    expect(preview).not.toContain("'use client'");
  });

  it('شجرة القراءات مبنية من بيانات القراءات بترتيبها', () => {
    const tree = buildQiraatTree();

    expect(tree.map((imam) => imam.name)).toEqual(
      [...READING_IMAMS].sort((a, b) => a.order - b.order).map((imam) => imam.name)
    );
    expect(tree.flatMap((imam) => imam.narrators)).toHaveLength(NARRATORS.length);

    const paths = tree.flatMap((imam) => imam.narrators).flatMap((narrator) => narrator.paths);
    expect(paths).toHaveLength(TRANSMISSION_PATH_SEEDS.length);

    // كل راوٍ تابع لإمامه في البيانات.
    for (const imam of tree) {
      for (const narrator of imam.narrators) {
        const source = NARRATORS.find((item) => item.id === narrator.id);
        expect(source?.imamId).toBe(imam.id);
      }
    }
  });
});
