// اختبار رسم اللوحة - Figure Rendering Smoke Test
//
// المحرر يُقرأ في المتصفح، لكن الرسم كله مكوّنات نقية بلا حالة، فيمكن
// توليده على الخادم والتحقق من ناتجه نصا. هذا يحرس أمرين لا يظهران في
// اختبارات المحرك وحده:
//
//   1. أن السطر المركّب يطبع **كل** أحكامه، كلٌّ باسمه ومقدار مدّه.
//   2. أن الأرقام المطبوعة عربية (٢، ٤، ٦) لا لاتينية، كما في المصحف.

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TashjeerFigure } from '@/components/editor/TashjeerFigure';
import { getAyahWords, makeAyahKey } from '@/data/quran';
import { DEFAULT_LAYOUT_OPTIONS, layoutAyah } from '@/lib/tashjeer/layout-engine';
import { generateClassicTashjeer } from '@/lib/tashjeer/classic-tashjeer';
import { DEFAULT_ENGINE_SETTINGS } from '@/lib/tashjeer/engine-settings';
import type { Variant, ViewFilter } from '@/types/tashjeer';

const ayahKey = makeAyahKey(1, 2);
const layout = layoutAyah(ayahKey, getAyahWords(1, 2), {
  ...DEFAULT_LAYOUT_OPTIONS,
  singleLine: true,
});

const filter: ViewFilter = {
  categories: ['USUL', 'FARSH', 'MADUD', 'HAMZ', 'WAQF', 'TAJWEED'],
  narratorIds: [],
  showLabels: true,
  showGrid: false,
  showRulers: false,
  showAnchors: false,
};

const variants: Variant[] = [
  {
    id: 'madd',
    ayahKey,
    category: 'MADUD',
    title: 'مد',
    startPosition: 1,
    endPosition: 1,
    status: 'DRAFT',
    alternatives: [
      {
        id: 'madd-alt',
        text: 'إشباع',
        label: 'إشباع',
        ruleLabel: 'مد',
        maddHarakat: 6,
        scope: { kind: 'IMAMS', imamIds: ['imam-nafi'] },
      },
    ],
  },
  {
    id: 'idgham',
    ayahKey,
    category: 'USUL',
    title: 'إدغام',
    startPosition: 3,
    endPosition: 3,
    status: 'DRAFT',
    alternatives: [
      {
        id: 'idgham-alt',
        text: 'إدغام',
        label: 'إدغام',
        ruleLabel: 'إدغام',
        scope: { kind: 'IMAMS', imamIds: ['imam-nafi'] },
      },
    ],
  },
];

function render() {
  const classic = generateClassicTashjeer(variants, layout, filter, DEFAULT_LAYOUT_OPTIONS, {
    engine: DEFAULT_ENGINE_SETTINGS,
  });

  const markup = renderToStaticMarkup(
    createElement(TashjeerFigure, {
      layout,
      classic,
      viewBox: { x: -150, y: 0, width: layout.canvasWidth + 240, height: 800 },
      fontSize: 34,
      showLabels: true,
      boundaries: [],
      baseNarratorName: 'حفص',
      engine: DEFAULT_ENGINE_SETTINGS,
      ayahMarkers: [{ position: 4, ayahNumber: 2 }],
      focusSegment: { startPosition: 1, endPosition: 3 },
    })
  );

  return { classic, markup };
}

describe('رسم السطر المركّب', () => {
  it('يطبع أحكام السطر كلها لا حكمه الأول وحده', () => {
    const { classic, markup } = render();

    expect(classic.lines).toHaveLength(1);
    expect(markup).toContain('إدغام');
    expect(markup).toContain('مد');
    // لكل حكم مجموعته الخاصة في الرسم، معلّمة بموضعها.
    expect(markup).toContain('data-entry-variant="madd"');
    expect(markup).toContain('data-entry-variant="idgham"');
  });

  it('يطبع مقدار المد بالأرقام العربية لا اللاتينية', () => {
    const { markup } = render();

    expect(markup).toContain('٦');
    expect(markup).not.toContain('>6<');
  });

  it('يطبع رمز الإمام في طرف السطر عند اجتماع راوييه', () => {
    const { markup } = render();
    expect(markup).toContain('data-narrator-id="narrator-qalun"');
    expect(markup).toContain('>أ</text>');
  });

  it('يرسم رقم الآية بين الآيتين الموصولتين بالأرقام العربية', () => {
    const { markup } = render();
    expect(markup).toContain('>٢</text>');
  });

  it('يرسم تغليظين منفصلين لموضعين متباعدين على السطر نفسه', () => {
    const disjoint: Variant = {
      id: 'silah',
      ayahKey,
      category: 'USUL',
      title: 'صلة',
      startPosition: 1,
      endPosition: 4,
      status: 'DRAFT',
      loci: [
        { startPosition: 1, endPosition: 1 },
        { startPosition: 4, endPosition: 4 },
      ],
      alternatives: [
        {
          id: 'silah-alt',
          text: 'صلة',
          label: 'صلة',
          ruleLabel: 'صلة',
          scope: { kind: 'NARRATORS', narratorIds: ['narrator-qalun'] },
        },
      ],
    };

    const classic = generateClassicTashjeer([disjoint], layout, filter, DEFAULT_LAYOUT_OPTIONS, {
      engine: DEFAULT_ENGINE_SETTINGS,
    });
    const markup = renderToStaticMarkup(
      createElement(TashjeerFigure, {
        layout,
        classic,
        viewBox: { x: -150, y: 0, width: layout.canvasWidth + 240, height: 800 },
        fontSize: 34,
        showLabels: true,
        boundaries: [],
        baseNarratorName: 'حفص',
        engine: DEFAULT_ENGINE_SETTINGS,
      })
    );

    expect(classic.lines[0].entries[0].emphases).toHaveLength(2);
    expect(markup).toContain('data-emphases="2"');
  });

  it('يرسم خلية نقر مستقلة لكل حرف عند تفعيل تعليم الحروف', () => {
    const { classic } = render();
    const markup = renderToStaticMarkup(
      createElement(TashjeerFigure, {
        layout,
        classic,
        viewBox: { x: -150, y: 0, width: layout.canvasWidth + 240, height: 800 },
        fontSize: 34,
        showLabels: true,
        boundaries: [],
        baseNarratorName: 'حفص',
        engine: DEFAULT_ENGINE_SETTINGS,
        characterMarkingActive: true,
      })
    );

    const firstWord = layout.boxes[0];
    const letterCount = firstWord.text.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '').length;
    expect(markup).toContain('data-character-index="1"');
    expect(markup).toContain(`data-character-index="${letterCount}"`);
    expect(markup).toContain('class="char-hit"');
  });

  it('يظلّل المقطع المشجَّر ويخفّت ما خرج عنه', () => {
    const { markup } = render();
    expect(markup).toContain('المقطع المشجَّر');
    expect(markup).toContain('opacity="0.32"');
  });
});
