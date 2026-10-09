import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RETIRED_UI_IDS, UI_REGISTRY, getUIEntryById, getUIIdentity } from '../src/ui/ui-registry';
import { getFeatureById } from '../src/ui/feature-registry';
import {
  parseInspectorQuery,
  resolveInspectorActivation,
  withInspectorQuery,
} from '../src/components/dev/ui-inspector-activation';
import {
  BADGE_HEIGHT,
  FAMILY_BADGE_CLASS,
  FAMILY_BY_KIND,
  badgeFamily,
  badgeWidth,
  buildRegistryRows,
  kindFamily,
  placeBadges,
  type BadgeCandidate,
  type PlacedBadge,
  type RegistryLookup,
} from '../src/components/dev/ui-inspector-model';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const lookup: RegistryLookup = {
  entry: (id) => getUIEntryById(id),
  identityName: (id) => getUIIdentity(id)?.name,
  featureName: (id) => getFeatureById(id)?.name,
};

const viewport = { width: 1200, height: 800 };

function candidate(overrides: Partial<BadgeCandidate> & { id: string }): BadgeCandidate {
  return { key: overrides.id, instance: null, left: 100, top: 100, width: 80, height: 30, ...overrides };
}

function overlapping(a: PlacedBadge, b: PlacedBadge): boolean {
  const aRight = a.left + badgeWidth(a.id);
  const bRight = b.left + badgeWidth(b.id);
  return a.left < bRight && b.left < aRight && a.top < b.top + BADGE_HEIGHT && b.top < a.top + BADGE_HEIGHT;
}

describe('UI ID Inspector activation', () => {
  it('reads the URL switch in its common spellings and ignores unknown values', () => {
    expect(parseInspectorQuery('?uiInspector=1')).toBe('on');
    expect(parseInspectorQuery('?uiInspector=on')).toBe('on');
    expect(parseInspectorQuery('?uiInspector=true')).toBe('on');
    expect(parseInspectorQuery('?uiInspector')).toBe('on');
    expect(parseInspectorQuery('?uiInspector=0')).toBe('off');
    expect(parseInspectorQuery('?uiInspector=off')).toBe('off');
    expect(parseInspectorQuery('?uiInspector=banana')).toBeNull();
    expect(parseInspectorQuery('?other=1')).toBeNull();
    expect(parseInspectorQuery('')).toBeNull();
  });

  it('lets the URL override the remembered tab state, and falls back to that state', () => {
    expect(resolveInspectorActivation('?uiInspector=1', false)).toBe(true);
    expect(resolveInspectorActivation('?uiInspector=0', true)).toBe(false);
    expect(resolveInspectorActivation('', true)).toBe(true);
    expect(resolveInspectorActivation('', false)).toBe(false);
  });

  it('keeps the URL in step with the state, and writes nothing when it already agrees', () => {
    const plain = 'https://tashjir.vercel.app/editor';
    expect(withInspectorQuery(plain, true)).toBe(`${plain}?uiInspector=1`);
    expect(withInspectorQuery(`${plain}?uiInspector=1`, true)).toBeNull();
    expect(withInspectorQuery(`${plain}?uiInspector=1&tab=x`, false)).toBe(`${plain}?tab=x`);
    expect(withInspectorQuery(plain, false)).toBeNull();
  });
});

describe('badge placement', () => {
  it('sits just above the top-left corner when there is room', () => {
    const [badge] = placeBadges([candidate({ id: 'A116', left: 300, top: 120 })], viewport);
    expect(badge).toMatchObject({ id: 'A116', left: 300, top: 120 - BADGE_HEIGHT - 2 });
  });

  it('moves inside the corner when nothing fits above', () => {
    const [badge] = placeBadges([candidate({ id: 'A116', left: 300, top: 0 })], viewport);
    expect(badge).toMatchObject({ left: 302, top: 2 });
  });

  it('keeps labels inside the viewport', () => {
    const [badge] = placeBadges([candidate({ id: 'A1269', left: 1195, top: 400, width: 20, height: 20 })], viewport);
    expect(badge).toBeDefined();
    expect(badge!.left + badgeWidth('A1269')).toBeLessThanOrEqual(viewport.width);
    expect(badge!.left).toBeGreaterThanOrEqual(0);
  });

  it('never stacks labels on each other when several elements share one corner', () => {
    const candidates = ['A116', 'A117', 'A118', 'A119'].map((id, index) =>
      candidate({ id, left: 300, top: 120, width: 40 + index * 10, height: 20 + index * 5 }),
    );
    const placed = placeBadges(candidates, viewport);
    expect(placed.map((badge) => badge.key)).toEqual(candidates.map((item) => item.key));
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        expect(overlapping(placed[i]!, placed[j]!), `${placed[i]!.id} vs ${placed[j]!.id}`).toBe(false);
      }
    }
  });

  it('lets a small control claim its label before the container around it', () => {
    const container = candidate({ id: 'A114', key: 'container', left: 300, top: 120, width: 600, height: 400 });
    const button = candidate({ id: 'A116', key: 'button', left: 300, top: 120, width: 60, height: 24 });
    const [containerBadge, buttonBadge] = placeBadges([container, button], viewport);
    expect(buttonBadge).toMatchObject({ key: 'button', left: 300, top: 120 - BADGE_HEIGHT - 2 });
    expect(containerBadge).toBeDefined();
    expect(containerBadge!.top).not.toBe(buttonBadge!.top);
    expect(overlapping(containerBadge!, buttonBadge!)).toBe(false);
  });

  it('sizes labels by the length of the real ID', () => {
    expect(badgeWidth('A2126')).toBeGreaterThan(badgeWidth('A20'));
  });
});

describe('badge families', () => {
  it('maps every kind used by the registry to an explicit family', () => {
    const kinds = new Set(UI_REGISTRY.map((entry) => entry.kind));
    for (const kind of kinds) {
      expect(FAMILY_BY_KIND, kind).toHaveProperty([kind]);
    }
  });

  it('reports registry state explicitly: pending while loading, unregistered when missing', () => {
    expect(badgeFamily(undefined, true)).toBe('unregistered');
    expect(badgeFamily({ kind: 'button' }, false)).toBe('pending');
    expect(badgeFamily({ kind: 'input' }, true)).toBe('field');
    expect(kindFamily('tab')).toBe('choice');
    expect(kindFamily('dialog')).toBe('container');
    expect(Object.keys(FAMILY_BADGE_CLASS).sort()).toEqual(['action', 'choice', 'container', 'field', 'pending', 'unregistered']);
  });
});

describe('detail rows come from the registry', () => {
  it('builds the rows for A333 from its record, not from placeholders', () => {
    const rows = Object.fromEntries(buildRegistryRows(getUIEntryById('A333')!, lookup).map((row) => [row.label, row.value]));
    expect(rows).toMatchObject({
      'UI ID': 'A333',
      Name: 'Delete Selected Differences Button',
      Kind: 'button',
      Route: '/editor',
      'Parent ID': `A119 — ${getUIIdentity('A119')?.name}`,
      'Feature ID': `A001 — ${getFeatureById('A001')?.name}`,
      Component: 'VariantsPanel',
      'Source file': 'src/components/editor/VariantsPanel.tsx',
      'Related IDs': 'A118, A114',
    });
    expect(rows['Action / handler']).toMatch(/^onClick: \(\) => void requestDeleteItems/);
  });

  it('states when a parent is not in the registry instead of inventing a name', () => {
    const entry = { ...getUIEntryById('A333')!, parentId: 'A99999' };
    const rows = buildRegistryRows(entry, lookup);
    expect(rows.find((row) => row.label === 'Parent ID')?.value).toBe('A99999 — (not in registry)');
  });

  it('shows recorded reference actions as they are, and says so when none is recorded', () => {
    const withAction = buildRegistryRows(getUIEntryById('A116')!, lookup);
    expect(withAction.find((row) => row.label === 'Action / handler')?.value).toBe('reference: setShowSmartWizard');
    const withoutAction = buildRegistryRows(getUIEntryById('A110')!, lookup);
    expect(withoutAction.find((row) => row.label === 'Action / handler')?.value).toBe('— (no action recorded)');
  });
});

describe('inspector registry records', () => {
  it('gives every inspector record a clean name and the real source file', () => {
    for (const id of ['A410', 'A411', 'A412', 'A730', 'A731', 'A732', 'A2126', 'A2127']) {
      const entry = getUIEntryById(id);
      expect(entry, id).toBeDefined();
      expect(entry!.name, id).not.toMatch(/[{}()=<>;`]/);
      expect(entry!.sourceFile, id).toBe('src/components/dev/UIRegistryInspectorPanel.tsx');
      expect(entry!.status, id).toBe('active');
    }
    expect(RETIRED_UI_IDS).not.toContain('A2126');
  });
});

describe('source guards: the inspector cannot be gated off in production', () => {
  const inspectorFiles = [
    'src/components/dev/UIRegistryInspector.tsx',
    'src/components/dev/UIRegistryInspectorPanel.tsx',
    'src/components/dev/ui-inspector-activation.ts',
    'src/components/dev/ui-inspector-model.ts',
  ];

  it('mounts the inspector on every page without a NODE_ENV check', () => {
    const layout = read('src/app/layout.tsx');
    expect(layout).toContain('<UIRegistryInspector />');
    expect(layout).not.toMatch(/NODE_ENV/);
  });

  it('keeps build-mode checks out of the inspector code', () => {
    for (const file of inspectorFiles) {
      expect(read(file), file).not.toMatch(/NODE_ENV/);
    }
  });

  it('loads the registry only on activation, so ordinary pages do not ship it', () => {
    for (const file of inspectorFiles) {
      const staticRuntimeImports = read(file)
        .split('\n')
        .filter((line) => /^import\s/.test(line) && !/^import type\s/.test(line) && /@\/ui\/(ui-registry|feature-registry)/.test(line));
      expect(staticRuntimeImports, file).toEqual([]);
    }
    expect(read('src/components/dev/UIRegistryInspectorPanel.tsx')).toMatch(/import\('@\/ui\/ui-registry'\)/);
    expect(read('src/components/dev/UIRegistryInspector.tsx')).toMatch(/import\('\.\/UIRegistryInspectorPanel'\)/);
  });
});
