import { describe, expect, it } from 'vitest';
import { auditUIRegistry } from '../scripts/validate-ui-registry';
import { readUISources, validateUISourceCoverage } from '../scripts/ui-source-audit';
import { validateIdentityRegistry } from '../src/ui/registry-validation';
import { FEATURE_REGISTRY } from '../src/ui/feature-registry';
import { UI_REGISTRY } from '../src/ui/ui-registry';

describe('complete JSX UI coverage', () => {
  it('has zero missing, duplicate, orphan or invalid-parent identities', () => {
    const result = auditUIRegistry();
    expect(result.errors, result.errors.join('\n')).toEqual([]);
    expect(result.report.registered).toBe(result.report.mapped);
    expect(result.report).toMatchObject({ missing: 0, duplicateIds: 0, orphanIds: 0, invalidParents: 0 });
  });
  it.each(['button', 'input', 'select', 'textarea', 'summary', 'option', 'nav', 'dialog'])('rejects new <%s> without an ID even in a hidden branch', tag => {
    expect(validateUISourceCoverage(new Map([['fixture.tsx', `function Demo(){return false && <${tag} />}`]]))).toHaveLength(1);
  });
  it('rejects custom icon actions, editable controls and drop zones', () => {
    for (const jsx of ['<g onClick={act} />', '<div contentEditable />', '<div onDrop={act} />', '<div role="tab" />']) {
      expect(validateUISourceCoverage(new Map([['fixture.tsx', jsx]]))).toHaveLength(1);
    }
  });
  it('does not register decorative HTML', () => {
    expect(validateUISourceCoverage(new Map([['fixture.tsx', '<div><span>text</span><p>copy</p><svg><path d="" /></svg></div>']]))).toEqual([]);
  });
  it('allows retirement records without allowing tombstone reuse', () => {
    const entry = { ...UI_REGISTRY[0]!, status: 'retired' as const, dependencies: [], relatedIds: [] };
    const feature = { ...FEATURE_REGISTRY[0]!, impactMap: [] };
    const result = validateIdentityRegistry([feature], [entry], new Map(), [entry.id]);
    expect(result.errors).toEqual([]);
  });
  it('discovers routes from actual App Router source, not a fixed list', () => {
    const pages = [...readUISources().keys()].filter((path: string) => path.endsWith('/page.tsx'));
    for (const file of pages) {
      const route = '/' + file.replace(/^src\/app\//, '').replace(/(^|\/)\([^/]+\)\//g, '$1').replace(/(^|\/)page\.tsx$/, '');
      expect(UI_REGISTRY.filter(e => e.kind === 'route' && e.sourceFile === file)).toHaveLength(1);
      expect(UI_REGISTRY.find(e => e.kind === 'route' && e.sourceFile === file)?.route).toBe(route.replace(/\/$/, '') || '/');
    }
  });
});
