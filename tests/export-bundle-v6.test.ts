// اختبارات دورة التصدير والاستيراد للإصدار السادس - Export Bundle v6
//
// ملف التصدير هو ما ينتقل بين أجهزة المحققين. وبعد دمج «الوجه المقدَّم» في
// سلّم الدرجات، صار الملف يحمل ثلاثة أشياء لا معنى لبعضها بلا بعض:
//   1) القواعد العامة بدرجاتها لكل راوٍ،
//   2) سلّم الدرجات نفسه (فمعرّف درجة بلا سلّم رقمٌ أصمّ على جهاز آخر)،
//   3) استثناءات المواضع وسجلها (فقاعدة بلا استثناءاتها تعود فتطبّق حيث
//      حذفها المحقق عمدا).
//
// هذه الاختبارات تحرس انتقال الثلاثة معا، وسلامة ترتيب الاستيراد.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAyahKey } from '@/data/quran';
import type { GlobalRuleMatch } from '@/lib/quran-logic/global-rule-engine';
import { MemoryStorage } from './helpers/memory-storage';

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function loadModules() {
  const [documents, rules, occurrences, degrees] = await Promise.all([
    import('@/lib/storage/document-store'),
    import('@/lib/storage/global-rules-store'),
    import('@/lib/storage/rule-occurrences-store'),
    import('@/lib/tashjeer/strength-degrees'),
  ]);
  return { documents, rules, occurrences, degrees };
}

const AYAH_KEY = makeAyahKey(2, 5);

function makeMatch(ayahKey = AYAH_KEY, startPosition = 2): GlobalRuleMatch {
  return {
    ayahKey,
    startPosition,
    endPosition: startPosition,
    characterRange: {
      start: { position: startPosition, characterIndex: 0 },
      end: { position: startPosition, characterIndex: 2 },
    },
    matchedText: 'رَحْمَةٌ',
  };
}

/** يبني حالة كاملة: قاعدة بدرجات لكل راوٍ، سلّم موسَّع، وموضع محذوف. */
async function seedWorkspace() {
  const { documents, rules, occurrences, degrees } = await loadModules();

  const catalog = degrees.normalizeStrengthDegrees({
    ...degrees.createDefaultStrengthDegrees(),
    degrees: [
      ...degrees.createDefaultStrengthDegrees().degrees,
      {
        id: 'degree-custom',
        label: 'وجه مذكور للتوسعة',
        shortLabel: 'توسعة',
        rank: 5,
        color: '#6d28d9',
      },
    ],
  });
  degrees.saveStrengthDegrees(catalog);

  rules.saveGlobalRule({
    id: 'rule-taa',
    title: 'وقف بالهاء على تاء التأنيث',
    category: 'TAJWEED',
    scope: { kind: 'NARRATORS', narratorIds: ['narrator-qalun', 'narrator-warsh'] },
    status: 'DRAFT',
    isActive: true,
    strengthDegreeId: 'jaiz',
    strengthByNarrator: { 'narrator-warsh': 'muqaddam', 'narrator-qalun': 'degree-custom' },
  });

  occurrences.deleteOccurrence('rule-taa', makeMatch(), 'ليس من مواضع القاعدة عند المحققين');
  occurrences.setOccurrenceStrength('rule-taa', makeMatch(AYAH_KEY, 4), {
    strengthDegreeId: 'muakhkhar',
  });

  documents.saveDocument(documents.createDocument(AYAH_KEY));

  return { documents, rules, occurrences, degrees };
}

describe('صيغة الملف', () => {
  it('يصدّر بالإصدار السابع ويحمل الحقول الجديدة كلها', async () => {
    await seedWorkspace();
    const { documents } = await loadModules();

    const bundle = JSON.parse(documents.exportDocuments());

    expect(bundle.format).toBe('tashjeer-export');
    expect(bundle.schemaVersion).toBe(7);
    expect(bundle.globalRules).toHaveLength(1);
    expect(bundle.strengthDegrees.degrees).toHaveLength(5);
    expect(bundle.ruleOccurrences).toHaveLength(2);
    expect(bundle.occurrenceLog.length).toBeGreaterThanOrEqual(2);
  });

  it('يحمل روابط المحرر وأجزاءه وترتيبه اليدوي وسجل تعديلاته (v7)', async () => {
    await seedWorkspace();
    const { documents } = await loadModules();

    const document = documents.loadDocument(AYAH_KEY);
    expect(document).not.toBeNull();
    if (!document) return;

    const withManual = documents.appendEditLog(
      {
        ...document,
        lineOrder: ['combo::a', 'combo::b'],
        links: [
          {
            id: 'link-1',
            ayahKey: AYAH_KEY,
            kind: 'FACE_TO_FACE',
            relation: 'MERGE',
            from: { type: 'FACE', id: 'v1::a1' },
            to: { type: 'FACE', id: 'v2::a2' },
            origin: 'EDITOR',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        segments: [
          {
            id: 'segment-1',
            ayahKey: AYAH_KEY,
            title: 'جزء اختبار',
            startPosition: 2,
            endPosition: 3,
            origin: 'EDITOR',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
      documents.makeEditEntry({
        action: 'ترتيب الأسطر يدويا',
        targetType: 'LINE_ORDER',
        targetId: String(AYAH_KEY),
        summary: 'تثبيت ترتيب سطرين يدويا',
      })
    );
    documents.saveDocument(withManual);

    const bundle = JSON.parse(documents.exportAyahDocument(AYAH_KEY));
    const exported = bundle.documents[0];

    expect(exported.lineOrder).toEqual(['combo::a', 'combo::b']);
    expect(exported.links).toHaveLength(1);
    expect(exported.links[0].kind).toBe('FACE_TO_FACE');
    expect(exported.links[0].origin).toBe('EDITOR');
    expect(exported.segments).toHaveLength(1);
    expect(exported.editLog.length).toBeGreaterThanOrEqual(1);
    expect(exported.editLog[0].origin).toBe('EDITOR');

    // الاستيراد على جهاز نظيف يحفظ هذه الحقول كما هي.
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.stubGlobal('window', { localStorage: new MemoryStorage() });
    const fresh = await loadModules();
    fresh.documents.importDocuments(JSON.stringify(bundle), true);
    const restored = fresh.documents.loadDocument(AYAH_KEY);
    expect(restored?.lineOrder).toEqual(['combo::a', 'combo::b']);
    expect(restored?.links).toHaveLength(1);
    expect(restored?.segments).toHaveLength(1);
    expect((restored?.editLog ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it('يحمل السلّم والاستثناءات حتى في تصدير آية واحدة', async () => {
    await seedWorkspace();
    const { documents } = await loadModules();

    const bundle = JSON.parse(documents.exportAyahDocument(AYAH_KEY));

    expect(bundle.strengthDegrees.degrees.some((d: { id: string }) => d.id === 'degree-custom')).toBe(true);
    expect(bundle.ruleOccurrences).toHaveLength(2);
  });
});

describe('دورة كاملة على جهاز نظيف', () => {
  it('يستعيد القاعدة ودرجاتها لكل راوٍ', async () => {
    await seedWorkspace();
    const json = (await loadModules()).documents.exportDocuments();

    // جهاز آخر: تخزين فارغ ووحدات مُعاد تحميلها.
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.stubGlobal('window', { localStorage: new MemoryStorage() });

    const fresh = await loadModules();
    expect(fresh.rules.listGlobalRules()).toHaveLength(0);

    const result = fresh.documents.importDocuments(json);
    expect(result.errors).toHaveLength(0);
    expect(result.imported).toBe(1);

    const rule = fresh.rules.listGlobalRules()[0];
    expect(rule.id).toBe('rule-taa');
    expect(rule.strengthDegreeId).toBe('jaiz');
    expect(rule.strengthByNarrator).toEqual({
      'narrator-warsh': 'muqaddam',
      'narrator-qalun': 'degree-custom',
    });
  });

  it('يستعيد السلّم الموسَّع، فتبقى معرّفات الدرجات مفهومة', async () => {
    await seedWorkspace();
    const json = (await loadModules()).documents.exportDocuments();

    vi.unstubAllGlobals();
    vi.resetModules();
    vi.stubGlobal('window', { localStorage: new MemoryStorage() });

    const fresh = await loadModules();
    expect(fresh.degrees.readStrengthDegrees().degrees).toHaveLength(4);

    fresh.documents.importDocuments(json);

    const catalog = fresh.degrees.readStrengthDegrees();
    expect(catalog.degrees).toHaveLength(5);
    expect(fresh.degrees.findStrengthDegree('degree-custom', catalog)?.label).toBe(
      'وجه مذكور للتوسعة'
    );
  });

  it('يستعيد حذف الموضع وسجله، فلا تعود القاعدة حيث حُذفت', async () => {
    await seedWorkspace();
    const json = (await loadModules()).documents.exportDocuments();

    vi.unstubAllGlobals();
    vi.resetModules();
    vi.stubGlobal('window', { localStorage: new MemoryStorage() });

    const fresh = await loadModules();
    fresh.documents.importDocuments(json);

    const deleted = fresh.occurrences.deletedOccurrenceIds('rule-taa');
    expect(deleted.has(fresh.occurrences.occurrenceIdFor('rule-taa', makeMatch()))).toBe(true);

    const log = fresh.occurrences.listOccurrenceLog('rule-taa');
    expect(log.some((entry) => entry.action === 'DELETE')).toBe(true);
    expect(log.some((entry) => entry.reason === 'ليس من مواضع القاعدة عند المحققين')).toBe(true);

    const stats = fresh.occurrences.occurrenceStats('rule-taa');
    expect(stats.deleted).toBe(1);
    expect(stats.edited).toBe(1);
  });

  it('يستعيد درجة الموضع المخصَّصة كما هي', async () => {
    await seedWorkspace();
    const json = (await loadModules()).documents.exportDocuments();

    vi.unstubAllGlobals();
    vi.resetModules();
    vi.stubGlobal('window', { localStorage: new MemoryStorage() });

    const fresh = await loadModules();
    fresh.documents.importDocuments(json);

    const map = fresh.occurrences.occurrenceOverrideMap('rule-taa');
    const id = fresh.occurrences.occurrenceIdFor('rule-taa', makeMatch(AYAH_KEY, 4));
    expect(map.get(id)?.strengthDegreeId).toBe('muakhkhar');
  });
});

describe('الاستيراد المتكرر والملفات القديمة', () => {
  it('لا يكرّر الاستثناءات ولا سطور السجل عند استيراد الملف مرتين', async () => {
    await seedWorkspace();
    const { documents, occurrences } = await loadModules();
    const json = documents.exportDocuments();

    documents.importDocuments(json, true);
    documents.importDocuments(json, true);

    expect(occurrences.listOccurrenceOverrides('rule-taa')).toHaveLength(2);
    // سطران فقط: حذف الموضع الأول وتخصيص درجة الثاني؛ التكرار يُدمج بالمعرّف.
    expect(occurrences.listOccurrenceLog('rule-taa')).toHaveLength(2);
  });

  it('يقبل ملفا قديما بلا سلّم ولا استثناءات ولا يفسد المحفوظ محليا', async () => {
    const { documents, degrees, occurrences } = await loadModules();

    const legacy = JSON.stringify({
      format: 'tashjeer-export',
      schemaVersion: 3,
      exportedAt: new Date().toISOString(),
      globalRules: [],
      ayahs: [],
      documents: [documents.createDocument(makeAyahKey(3, 7))],
    });

    const result = documents.importDocuments(legacy);

    expect(result.errors).toHaveLength(0);
    expect(result.imported).toBe(1);
    expect(degrees.readStrengthDegrees().degrees).toHaveLength(4);
    expect(occurrences.listOccurrenceOverrides()).toHaveLength(0);
  });

  it('يرفض ملفا ليس من صيغة التشجير برسالة واضحة', async () => {
    const { documents } = await loadModules();

    const result = documents.importDocuments(JSON.stringify({ format: 'other', documents: [] }));

    expect(result.imported).toBe(0);
    expect(result.errors[0]).toContain('ملف تصدير تشجير');
  });
});
