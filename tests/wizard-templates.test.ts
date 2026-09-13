// اختبارات قوالب المعالج وتفضيلاته — Wizard Templates (FR-ED-08)
// مشروع التشجير - نظام القراءات العشر
//
// «الإنشاء السريع» يحفظ إعداد آخر معالج كقالب يعاد استخدامه بنقرة، وحفظ
// التفضيلات يقصّر الخطوات للمتقدمين. القوالب والتفضيلات محلية شخصية.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from './helpers/memory-storage';
import {
  deleteWizardTemplate,
  listWizardTemplates,
  readWizardPrefs,
  saveWizardPrefs,
  saveWizardTemplate,
  touchWizardTemplate,
} from '@/lib/tashjeer/wizard-templates';

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('قوالب المعالج المحفوظة (الإنشاء السريع)', () => {
  it('يحفظ إعداد المعالج قالبًا مسمى ويعيده', () => {
    const saved = saveWizardTemplate('مد + تحقيق + صلة', {
      types: ['MADUD'],
      faces: { MADUD: 'تحقيق\nتحقيق + صلة' },
      relationMode: 'NONE',
      context: 'ALWAYS',
    });
    expect(saved.name).toBe('مد + تحقيق + صلة');
    expect(saved.config.types).toEqual(['MADUD']);

    const templates = listWizardTemplates();
    expect(templates).toHaveLength(1);
    expect(templates[0]!.config.faces.MADUD).toBe('تحقيق\nتحقيق + صلة');
  });

  it('يرفض القالب الفارغ (بلا أنواع)', () => {
    expect(() =>
      saveWizardTemplate('فارغ', { types: [], faces: {}, relationMode: 'NONE', context: 'ALWAYS' })
    ).toThrow();
    expect(listWizardTemplates()).toHaveLength(0);
  });

  it('يطهّر الأنواع غير المعروفة ويسقط وجوهها', () => {
    const saved = saveWizardTemplate('مختلط', {
      types: ['MADUD', 'BOGUS' as never],
      faces: { MADUD: 'تحقيق', BOGUS: 'x' } as never,
      relationMode: 'RELATED_TREE',
      context: 'ALWAYS',
    });
    expect(saved.config.types).toEqual(['MADUD']);
    expect(saved.config.faces).toEqual({ MADUD: 'تحقيق' });
  });

  it('اللمس يصعّد القالب إلى أول القائمة، والحذف يزيله', () => {
    const first = saveWizardTemplate('الأول', {
      types: ['FARSH'],
      faces: {},
      relationMode: 'NONE',
      context: 'ALWAYS',
    });
    saveWizardTemplate('الثاني', {
      types: ['USUL'],
      faces: {},
      relationMode: 'NONE',
      context: 'ALWAYS',
    });
    // الأحدث أولًا.
    expect(listWizardTemplates().map((t) => t.name)).toEqual(['الثاني', 'الأول']);

    touchWizardTemplate(first.id);
    expect(listWizardTemplates().map((t) => t.name)).toEqual(['الأول', 'الثاني']);

    deleteWizardTemplate(first.id);
    expect(listWizardTemplates().map((t) => t.name)).toEqual(['الثاني']);
  });
});

describe('تفضيلات المعالج (الوضع المتقدم)', () => {
  it('الافتراضي موجّه، والحفظ يستعيد المتقدم', () => {
    expect(readWizardPrefs()).toEqual({ advanced: false });
    saveWizardPrefs({ advanced: true });
    expect(readWizardPrefs()).toEqual({ advanced: true });
    saveWizardPrefs({ advanced: false });
    expect(readWizardPrefs()).toEqual({ advanced: false });
  });
});
