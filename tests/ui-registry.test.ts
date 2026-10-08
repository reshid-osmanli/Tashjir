import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FEATURE_REGISTRY, type FeatureRegistryEntry } from '../src/ui/feature-registry';
import { renderFeatureRegistryDoc, renderProjectMapDoc, renderUIRegistryDoc } from '../src/ui/render-registry-docs';
import { validateIdentityRegistry } from '../src/ui/registry-validation';
import { RETIRED_UI_IDS, UI_REGISTRY, type UIRegistryEntry } from '../src/ui/ui-registry';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const sourceRoot = join(repoRoot, 'src');

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    const path = join(directory, item.name);
    if (item.isDirectory()) return walk(path);
    return /\.(tsx?|jsx?)$/.test(item.name) ? [path] : [];
  });
}

function readAllSources(): Map<string, string> {
  return new Map(walk(sourceRoot).map((absolutePath) => [
    relative(repoRoot, absolutePath).replaceAll('\\', '/'),
    readFileSync(absolutePath, 'utf8'),
  ]));
}

const sourceFiles = readAllSources();

function pathReferenceExists(reference: string): boolean {
  if (existsSync(join(repoRoot, reference))) return true;
  const wildcard = reference.indexOf('*');
  if (wildcard < 0) return false;
  const slash = reference.lastIndexOf('/', wildcard);
  const directory = join(repoRoot, slash < 0 ? '.' : reference.slice(0, slash));
  if (!existsSync(directory) || !statSync(directory).isDirectory()) return false;
  const pattern = reference.slice(slash + 1);
  const [prefix, suffix = ''] = pattern.split('*', 2);
  return readdirSync(directory).some((name) => name.startsWith(prefix!) && name.endsWith(suffix));
}

function minimalFeature(): FeatureRegistryEntry {
  return {
    ...FEATURE_REGISTRY[0]!,
    mainFiles: [],
    mainComponents: [],
    stores: [],
    engineDependencies: [],
    testFiles: [],
    impactMap: [],
  };
}

function minimalEntry(overrides: Partial<UIRegistryEntry> = {}): UIRegistryEntry {
  return {
    ...UI_REGISTRY[0]!,
    id: 'A900',
    name: 'Validation Fixture',
    parentId: 'A001',
    featureId: 'A001',
    sourceFile: 'fixture.tsx',
    dependencies: [],
    relatedIds: [],
    ...overrides,
  };
}

function validateFixture(
  entry: UIRegistryEntry,
  source = '<button data-ui-id="A900" />',
  retired: readonly string[] = []
) {
  return validateIdentityRegistry([minimalFeature()], [entry], new Map([['fixture.tsx', source]]), retired);
}

describe('Project Feature & UI Identity Registry', () => {
  it('keeps IDs unique globally and validates hierarchy, source files, and DOM markers', () => {
    const result = validateIdentityRegistry(FEATURE_REGISTRY, UI_REGISTRY, sourceFiles, RETIRED_UI_IDS);
    expect(result.errors, result.errors.join('\n')).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('registers each current App Router page route exactly once', () => {
    const expectedRoutes: Record<string, string> = {
      '/': 'src/app/page.tsx',
      '/editor': 'src/app/(dashboard)/editor/page.tsx',
      '/studio': 'src/app/(dashboard)/studio/page.tsx',
      '/quran': 'src/app/(dashboard)/quran/page.tsx',
      '/tracking': 'src/app/(dashboard)/tracking/page.tsx',
      '/variants': 'src/app/(dashboard)/variants/page.tsx',
      '/qiraat': 'src/app/(dashboard)/qiraat/page.tsx',
      '/readers': 'src/app/(dashboard)/readers/page.tsx',
      '/review': 'src/app/(dashboard)/review/page.tsx',
      '/admin': 'src/app/(dashboard)/admin/page.tsx',
      '/settings': 'src/app/(dashboard)/settings/page.tsx',
      '/statistics': 'src/app/(dashboard)/statistics/page.tsx',
      '/login': 'src/app/login/page.tsx',
    };
    const routes = UI_REGISTRY.filter((entry) => entry.kind === 'route');
    expect(routes).toHaveLength(Object.keys(expectedRoutes).length);
    for (const [route, file] of Object.entries(expectedRoutes)) {
      const matches = routes.filter((entry) => entry.route === route);
      expect(matches, `route ${route}`).toHaveLength(1);
      expect(matches[0]?.sourceFile).toBe(file);
    }
  });

  it('keeps feature map file, store, engine, test, and impact references resolvable', () => {
    const references = new Set<string>();
    for (const feature of FEATURE_REGISTRY) {
      for (const reference of [
        ...feature.mainFiles,
        ...feature.stores,
        ...feature.engineDependencies,
        ...feature.testFiles,
        ...feature.impactMap.flatMap((layer) => layer.files),
      ]) references.add(reference);
    }
    const missing = [...references].filter((reference) => !pathReferenceExists(reference));
    expect(missing, `Unresolved project-map paths: ${missing.join(', ')}`).toEqual([]);
  });

  it('preserves the requested example identities as exact Registry lookups', () => {
    expect(UI_REGISTRY.find((entry) => entry.id === 'A333')).toMatchObject({
      kind: 'button',
      name: 'Delete Selected Differences Button',
      parentId: 'A119',
      route: '/editor',
      component: 'VariantsPanel',
      sourceFile: 'src/components/editor/VariantsPanel.tsx',
      status: 'active',
    });
    expect(UI_REGISTRY.find((entry) => entry.id === 'A421')).toMatchObject({
      kind: 'dialog',
      name: 'Smart Create Wizard Dialog',
      parentId: 'A114',
      route: '/editor',
      component: 'SmartCreateWizard',
      sourceFile: 'src/components/editor/SmartCreateWizard.tsx',
      status: 'active',
    });
  });

  it('rejects duplicate IDs, malformed IDs, missing parents, and unregistered DOM markers', () => {
    const duplicate = validateIdentityRegistry(
      [minimalFeature()],
      [minimalEntry({ id: 'A001' })],
      new Map([['fixture.tsx', '<button data-ui-id="A001" />']])
    );
    expect(duplicate.errors.join('\n')).toContain('Duplicate global ID "A001"');

    const malformed = validateFixture(minimalEntry({ id: 'A9' }), '<button data-ui-id="A9" />');
    expect(malformed.errors.join('\n')).toContain('invalid ID "A9"');

    const missingParent = validateFixture(minimalEntry({ parentId: 'A999' }));
    expect(missingParent.errors.join('\n')).toContain('references missing parent A999');

    const unknownDom = validateFixture(minimalEntry(), '<main data-ui-id="A900" /><button data-ui-id="A999" />');
    expect(unknownDom.errors.join('\n')).toContain('contains unregistered data-ui-id="A999"');
  });

  it('rejects active IDs without DOM bindings and prevents retired ID reuse', () => {
    const unbound = validateFixture(minimalEntry(), '<button />');
    expect(unbound.errors.join('\n')).toContain('has no data-ui-id="A900" marker');

    const reused = validateFixture(minimalEntry(), '<button data-ui-id="A900" />', ['A900']);
    expect(reused.errors.join('\n')).toContain('Retired ID "A900" has been reused');
  });

  it('validates IDs resolved from a stable typed data property', () => {
    const mapped = validateFixture(
      minimalEntry(),
      `const NAV = [{ uiId: 'A900' }];\n<Link data-ui-id={item.uiId} />`
    );
    expect(mapped.errors, mapped.errors.join('\n')).toEqual([]);

    const orphaned = validateFixture(
      minimalEntry(),
      `const NAV = [{ uiId: 'A999' }];\n<Link data-ui-id={item.uiId} />`
    );
    expect(orphaned.errors.join('\n')).toContain('contains unregistered data-ui-id="A999"');
  });

  it('keeps the human-readable registry, feature map, and project map generated from the code source', () => {
    expect(readFileSync(join(repoRoot, 'docs/UI_REGISTRY.md'), 'utf8')).toBe(renderUIRegistryDoc());
    expect(readFileSync(join(repoRoot, 'docs/FEATURE_REGISTRY.md'), 'utf8')).toBe(renderFeatureRegistryDoc());
    expect(readFileSync(join(repoRoot, 'docs/PROJECT_MAP.md'), 'utf8')).toBe(renderProjectMapDoc());
  });
});
