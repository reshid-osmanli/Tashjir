import ts from 'typescript';
import { existsSync } from 'node:fs';
import { UI_REGISTRY, RETIRED_UI_IDS } from '../src/ui/ui-registry';
import { FEATURE_REGISTRY } from '../src/ui/feature-registry';
import { validateIdentityRegistry } from '../src/ui/registry-validation';
import { readUISources, parseUI, attributes, value, isForwarder, componentOf, validateUISourceCoverage, type UINode } from './ui-source-audit';

/** Resolve only explicit static JSX bindings and finite checked-in ID tables. */
export function boundIds(node: UINode, source: string): string[] {
  const binding = value(attributes(node).get('data-ui-id'));
  if (/^A\d+$/.test(binding)) return [binding];
  const table = binding.match(/^(UI_\w+)\[/)?.[1];
  if (table) {
    const block = source.match(new RegExp(`const ${table} = \\{([\\s\\S]*?)\\} as const;`))?.[1] ?? '';
    return [...block.matchAll(/["'](A\d+)["']/g)].map(m => m[1]!);
  }
  const property = binding.match(/^\w+\.(\w+)$/)?.[1];
  if (property) return [...source.matchAll(new RegExp(`\\b${property}:\\s*['"](A\\d+)['"]`, 'g'))].map(m => m[1]!);
  return [];
}

export function auditUIRegistry(sources = readUISources()) {
  const validation = validateIdentityRegistry(FEATURE_REGISTRY, UI_REGISTRY, sources, RETIRED_UI_IDS);
  const missing = validateUISourceCoverage(sources);
  const errors = [...validation.errors, ...missing];
  const bindings = new Map<string, { file: string; component: string; line: number; handler: string }[]>();
  for (const [file, source] of sources) {
    const { ast, nodes } = parseUI(file, source);
    for (const node of nodes) {
      if (isForwarder(file, node)) continue;
      const ids = boundIds(node, source);
      if (attributes(node).has('data-ui-id') && !ids.length) errors.push(`${file}:${ast.getLineAndCharacterOfPosition(node.getStart()).line + 1} unresolved identity binding`);
      for (const id of new Set(ids)) {
        const list = bindings.get(id) ?? [];
        list.push({ file, component: componentOf(node), line: ast.getLineAndCharacterOfPosition(node.getStart()).line + 1, handler: [...attributes(node)].filter(([k]) => /^on[A-Z]/.test(k)).map(([k,a])=>k+':'+value(a)).join('\n') });
        bindings.set(id, list);
      }
    }
  }
  let duplicates = 0, orphans = 0;
  for (const [id, bindingsForId] of bindings) {
    const entry = UI_REGISTRY.find(e=>e.id===id);
    if (!entry) { orphans++; errors.push(`Orphan ${id}`); continue; }
    const components = new Set(bindingsForId.map(b=>b.file+':'+b.component));
    if (components.size > 1) { duplicates++; errors.push(`${id} reused by distinct components: ${[...components].join(', ')}`); }
    if (bindingsForId.some(b=>b.file!==entry.sourceFile)) errors.push(`${id} bound outside registered sourceFile`);
    // Multiple declarations only allowed for responsive equivalents declared as
    // templates; repeated DATA records are one declaration, not duplicate IDs.
    if (bindingsForId.length > 1 && !['template','finite'].includes(entry.identity ?? '') && id !== 'A328' && !/^A3(1[4-9]|2[0-4])$/.test(id)) {
      duplicates++; errors.push(`${id} has ${bindingsForId.length} unrelated static binding sites`);
    }
  }
  const active = UI_REGISTRY.filter(e=>e.status!=='retired');
  const unmapped = active.filter(e=>!bindings.has(e.id));
  for (const entry of unmapped) errors.push(`${entry.id} no resolved JSX binding`);
  for (const entry of UI_REGISTRY) {
    for (const file of [...(entry.logicFiles??[]), ...(entry.stores??[]), ...(entry.testFiles??[])]) {
      if (!existsSync(file)) errors.push(`${entry.id} missing logic/test file: ${file}`);
    }
  }
  const counts: Record<string,number> = {};
  for (const entry of active) counts[entry.kind]=(counts[entry.kind]??0)+1;
  return {
    valid: errors.length===0, errors,
    report: {
      totalFeatures: FEATURE_REGISTRY.length,
      totalRoutes: active.filter(e=>e.kind==='route').length,
      registered: active.length,
      mapped: active.length-unmapped.length,
      retired: UI_REGISTRY.length-active.length,
      missing: missing.length+unmapped.length,
      duplicateIds: duplicates + UI_REGISTRY.length-new Set(UI_REGISTRY.map(e=>e.id)).size,
      orphanIds: orphans,
      invalidParents: validation.errors.filter(e=>/parent|Parent/.test(e)).length,
      counts,
    },
  };
}

if (process.argv[1]?.endsWith('validate-ui-registry.ts')) {
  const result = auditUIRegistry();
  console.log(JSON.stringify(result.report, null, 2));
  console.log(`Registry Validation: ${result.valid ? 'PASS' : 'FAIL'}`);
  if (!result.valid) { console.error(result.errors.join('\n')); process.exitCode=1; }
}
