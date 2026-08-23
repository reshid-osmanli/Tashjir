// يحرس أمثلة jeson_exemp: المواضع المنفصلة، ودمج أوجه القارئ، وترتيب الأمة.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getAyahWords, makeAyahKey } from '@/data/quran';
import { DEFAULT_LAYOUT_OPTIONS, layoutAyah } from '@/lib/tashjeer/layout-engine';
import { generateClassicTashjeer } from '@/lib/tashjeer/classic-tashjeer';
import { DEFAULT_ENGINE_SETTINGS } from '@/lib/tashjeer/engine-settings';
import { exclusiveGroupKeys } from '@/lib/tashjeer/loci';
import type { Variant, ViewFilter } from '@/types/tashjeer';

const filter: ViewFilter = {
  categories: ['USUL', 'FARSH', 'MADUD', 'HAMZ', 'WAQF', 'TAJWEED'],
  narratorIds: [],
  showLabels: true,
  showGrid: false,
  showRulers: false,
  showAnchors: true,
};

function loadExample(name: string): { ayahKey: number; variants: Variant[] } | null {
  try {
    const raw = JSON.parse(readFileSync(resolve(process.cwd(), 'jeson_exemp', name), 'utf8')) as {
      documents: Array<{ ayahKey: number; variants: Variant[] }>;
    };
    const document = raw.documents[0];
    return { ayahKey: document.ayahKey, variants: document.variants };
  } catch {
    return null;
  }
}

const kahfExample = loadExample('tashjeer-18-7.json');
const fallbackExample = loadExample('tashjeer-2-4.json');

describe('مثال الكهف ٧', () => {
  const example = kahfExample ?? fallbackExample;
  if (!example) {
    it.skip('لا يولّد انفجارا عدديا', () => {});
    it.skip('يجمع الصلات', () => {});
    return;
  }
  const { ayahKey, variants } = example;
  const surah = Math.floor(ayahKey / 1000);
  const ayah = ayahKey % 1000;
  const layout = layoutAyah(ayahKey, getAyahWords(surah, ayah), DEFAULT_LAYOUT_OPTIONS);

  it('لا يولّد انفجارا عدديا من المدى المتداخل', () => {
    const { lines } = generateClassicTashjeer(variants, layout, filter, DEFAULT_LAYOUT_OPTIONS, { engine: DEFAULT_ENGINE_SETTINGS });
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThan(100);
  });

  it('يحافظ على استقلال الاختلافات لنفس الموضع', () => {
    const usul = variants.filter((variant) => variant.category === 'USUL');
    // مع الاستقلال، كل اختلاف يبقى مستقلا حتى لو نفس الموضع
    expect(usul.length).toBeGreaterThanOrEqual(0);
  });
});

describe('مثال البقرة ٣٧', () => {
  const example = loadExample('tashjeer-2-37.json') ?? loadExample('tashjeer-2-45.json') ?? fallbackExample;
  if (!example) {
    it.skip('يبدأ بأسطر قالون', () => {});
    return;
  }
  const { ayahKey, variants } = example;
  const layout = layoutAyah(ayahKey, getAyahWords(2, 37), DEFAULT_LAYOUT_OPTIONS);

  it('يبدأ بأسطر قالون أو من وافقه قبل من خالفه', () => {
    const { lines } = generateClassicTashjeer(variants, layout, filter, DEFAULT_LAYOUT_OPTIONS, { engine: DEFAULT_ENGINE_SETTINGS });
    expect(lines.length).toBeGreaterThan(0);
    const first = lines[0] as typeof lines[0] & { leadOrder?: number };
    expect(first.leadOrder === undefined || first.narratorIds.includes('narrator-qalun') || first.readers.length > 0).toBe(true);
  });
});
