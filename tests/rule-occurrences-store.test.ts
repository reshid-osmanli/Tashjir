// اختبارات استثناءات مواضع القواعد - Rule Occurrences Tests
//
// جوهر المطلوب هنا استقلال المواضع: القاعدة الواحدة قد تصيب ألفي موضع،
// وحذفها من موضع خطأ يجب ألا يمسّ الباقي، وأن يُسجَّل في سجل ظاهر يبيّن
// أين حُذفت ومتى ولماذا. هذه الاختبارات تحرس هذا العقد.

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

async function loadStore() {
  return import('@/lib/storage/rule-occurrences-store');
}

/** موضع تطبيق وهمي بالشكل الذي يعيده محرك القواعد. */
function makeMatch(ayahKey: number, startPosition = 1, endPosition = startPosition): GlobalRuleMatch {
  return {
    ayahKey,
    startPosition,
    endPosition,
    characterRange: {
      start: { position: startPosition, characterIndex: 1 },
      end: { position: endPosition, characterIndex: 3 },
    },
    matchedText: 'نص',
  };
}

describe('معرّف الموضع', () => {
  it('حتمي: الموضع نفسه يعطي المعرّف نفسه دائما', async () => {
    const store = await loadStore();
    const match = makeMatch(makeAyahKey(2, 5));

    expect(store.occurrenceIdFor('rule-1', match)).toBe(store.occurrenceIdFor('rule-1', match));
  });

  it('يفرّق بين موضعين في آيتين، وبين قاعدتين في موضع واحد', async () => {
    const store = await loadStore();
    const first = makeMatch(makeAyahKey(2, 5));
    const second = makeMatch(makeAyahKey(2, 6));

    expect(store.occurrenceIdFor('rule-1', first)).not.toBe(store.occurrenceIdFor('rule-1', second));
    expect(store.occurrenceIdFor('rule-1', first)).not.toBe(store.occurrenceIdFor('rule-2', first));
  });
});

describe('استقلال المواضع', () => {
  it('حذف موضع لا يمسّ بقية مواضع القاعدة نفسها', async () => {
    const store = await loadStore();
    const target = makeMatch(makeAyahKey(2, 5));
    const other = makeMatch(makeAyahKey(2, 6));

    store.deleteOccurrence('rule-1', target, 'موضع مستثنى عند أهل الأداء');

    const deleted = store.deletedOccurrenceIds('rule-1');
    expect(deleted.has(store.occurrenceIdFor('rule-1', target))).toBe(true);
    expect(deleted.has(store.occurrenceIdFor('rule-1', other))).toBe(false);
    expect(store.occurrenceStats('rule-1').deleted).toBe(1);
  });

  it('حذف موضع من قاعدة لا يمسّ قاعدة أخرى في الموضع نفسه', async () => {
    const store = await loadStore();
    const match = makeMatch(makeAyahKey(2, 5));

    store.deleteOccurrence('rule-1', match);

    expect(store.deletedOccurrenceIds('rule-2').size).toBe(0);
    expect(store.occurrenceStats('rule-2').deleted).toBe(0);
  });

  it('يخزّن الاستثناءات وحدها، فالمواضع السليمة لا تشغل مساحة', async () => {
    const store = await loadStore();
    store.deleteOccurrence('rule-1', makeMatch(makeAyahKey(2, 5)));

    expect(store.listOccurrenceOverrides('rule-1')).toHaveLength(1);
    expect(store.listOccurrenceOverrides()).toHaveLength(1);
  });
});

describe('السجل', () => {
  it('يسجّل الحذف بسببه وموضعه', async () => {
    const store = await loadStore();
    const ayahKey = makeAyahKey(2, 5);
    store.deleteOccurrence('rule-1', makeMatch(ayahKey), 'ليس من مواضع القاعدة');

    const log = store.listOccurrenceLog('rule-1');
    expect(log).toHaveLength(1);
    expect(log[0].action).toBe('DELETE');
    expect(log[0].reason).toBe('ليس من مواضع القاعدة');
    expect(log[0].ayahKey).toBe(ayahKey);
  });

  it('يسجّل الإرجاع والاعتماد كذلك، بالأحدث أولا', async () => {
    const store = await loadStore();
    const match = makeMatch(makeAyahKey(2, 5));

    store.deleteOccurrence('rule-1', match);
    store.restoreOccurrence(store.occurrenceIdFor('rule-1', match));
    store.confirmOccurrence('rule-1', match);

    const actions = store.listOccurrenceLog('rule-1').map((entry) => entry.action);
    expect(actions).toContain('DELETE');
    expect(actions).toContain('RESTORE');
    expect(actions).toContain('CONFIRM');
    expect(actions).toHaveLength(3);
  });

  it('يحدّ حجم السجل فلا يمتلئ التخزين المحلي', async () => {
    const store = await loadStore();
    for (let index = 0; index < 520; index += 1) {
      store.deleteOccurrence('rule-1', makeMatch(makeAyahKey(2, 5), index + 1));
    }

    const log = store.listOccurrenceLog('rule-1', 10_000);
    expect(log.length).toBeLessThanOrEqual(500);
    // الأحدث هو الباقي: آخر موضع سُجِّل لا بد أن يكون في السجل.
    expect(log.some((entry) => entry.occurrenceId.endsWith(':520:520:1:3'))).toBe(true);
  });

  it('يفصل سجل كل قاعدة عن غيرها', async () => {
    const store = await loadStore();
    store.deleteOccurrence('rule-1', makeMatch(makeAyahKey(2, 5)));
    store.deleteOccurrence('rule-2', makeMatch(makeAyahKey(3, 7)));

    expect(store.listOccurrenceLog('rule-1')).toHaveLength(1);
    expect(store.listOccurrenceLog('rule-2')).toHaveLength(1);
    expect(store.listOccurrenceLog()).toHaveLength(2);
  });
});

describe('الإرجاع', () => {
  it('يمحو سطر الاستثناء بالكلية إن لم يبق فيه تخصيص', async () => {
    const store = await loadStore();
    const match = makeMatch(makeAyahKey(2, 5));

    store.deleteOccurrence('rule-1', match);
    store.restoreOccurrence(store.occurrenceIdFor('rule-1', match));

    expect(store.listOccurrenceOverrides('rule-1')).toHaveLength(0);
    expect(store.deletedOccurrenceIds('rule-1').size).toBe(0);
  });

  it('يُبقي السطر إن كانت للموضع درجة مخصَّصة، ويعيد حالته إلى مطبَّق', async () => {
    const store = await loadStore();
    const match = makeMatch(makeAyahKey(2, 5));

    store.setOccurrenceStrength('rule-1', match, { strengthDegreeId: 'muakhkhar' });
    store.deleteOccurrence('rule-1', match);
    store.restoreOccurrence(store.occurrenceIdFor('rule-1', match));

    const overrides = store.listOccurrenceOverrides('rule-1');
    expect(overrides).toHaveLength(1);
    expect(overrides[0].state).not.toBe('DELETED');
    expect(overrides[0].strengthDegreeId).toBe('muakhkhar');
  });
});

describe('درجة الموضع الواحد', () => {
  it('يخصّص درجة لموضع بعينه دون أن يمسّ غيره', async () => {
    const store = await loadStore();
    const target = makeMatch(makeAyahKey(2, 5));
    const other = makeMatch(makeAyahKey(2, 6));

    store.setOccurrenceStrength('rule-1', target, {
      strengthDegreeId: 'jaiz',
      strengthByNarrator: { 'narrator-warsh': 'muqaddam' },
    });

    const map = store.occurrenceOverrideMap('rule-1');
    expect(map.get(store.occurrenceIdFor('rule-1', target))?.strengthDegreeId).toBe('jaiz');
    expect(map.get(store.occurrenceIdFor('rule-1', target))?.strengthByNarrator).toEqual({
      'narrator-warsh': 'muqaddam',
    });
    expect(map.get(store.occurrenceIdFor('rule-1', other))).toBeUndefined();
    expect(store.occurrenceStats('rule-1').edited).toBe(1);
  });

  it('لا يُخرج الموضع من حالة الحذف عند تعديل درجته', async () => {
    const store = await loadStore();
    const match = makeMatch(makeAyahKey(2, 5));

    store.deleteOccurrence('rule-1', match);
    store.setOccurrenceStrength('rule-1', match, { strengthDegreeId: 'jaiz' });

    expect(store.deletedOccurrenceIds('rule-1').size).toBe(1);
  });
});

describe('تنظيف القاعدة المحذوفة', () => {
  it('يمحو استثناءات القاعدة وسجلها معا', async () => {
    const store = await loadStore();
    store.deleteOccurrence('rule-1', makeMatch(makeAyahKey(2, 5)));
    store.deleteOccurrence('rule-2', makeMatch(makeAyahKey(3, 7)));

    store.clearRuleOccurrences('rule-1');

    expect(store.listOccurrenceOverrides('rule-1')).toHaveLength(0);
    expect(store.listOccurrenceLog('rule-1')).toHaveLength(0);
    expect(store.listOccurrenceOverrides('rule-2')).toHaveLength(1);
  });

  it('حذف القاعدة العامة يمحو استثناءات مواضعها', async () => {
    const store = await loadStore();
    const rules = await import('@/lib/storage/global-rules-store');
    rules.saveGlobalRule({
      id: 'rule-1',
      title: 'قاعدة',
      category: 'TAJWEED',
      scope: { kind: 'ALL' },
      status: 'DRAFT',
      isActive: true,
    });
    store.deleteOccurrence('rule-1', makeMatch(makeAyahKey(2, 5)));

    rules.deleteGlobalRule('rule-1');

    expect(store.listOccurrenceOverrides('rule-1')).toHaveLength(0);
  });
});

describe('التصدير والاستيراد', () => {
  it('يعيد الاستثناءات والسجل معا، ويستعيدهما دون تكرار', async () => {
    const store = await loadStore();
    store.deleteOccurrence('rule-1', makeMatch(makeAyahKey(2, 5)), 'سبب');

    const exported = store.exportOccurrenceData();
    expect(exported.overrides).toHaveLength(1);
    expect(exported.log).toHaveLength(1);

    store.upsertOccurrenceOverrides(exported.overrides, exported.log);
    expect(store.listOccurrenceOverrides('rule-1')).toHaveLength(1);
    expect(store.listOccurrenceLog('rule-1')).toHaveLength(1);
  });
});
