import ts from 'typescript';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export function readUISources(root = process.cwd()): Map<string, string> {
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(item => {
    const path = join(dir, item.name);
    return item.isDirectory() ? walk(path) : /\.tsx$/.test(path) ? [path] : [];
  });
  return new Map(walk(join(root, 'src')).map(path => [relative(root, path).replaceAll('\\', '/'), readFileSync(path, 'utf8')]));
}

export type UINode = ts.JsxOpeningElement | ts.JsxSelfClosingElement;
export function attributes(node: UINode): Map<string, ts.JsxAttribute> {
  return new Map(node.attributes.properties.filter(ts.isJsxAttribute).map(attr => [attr.name.getText(), attr]));
}
export function value(attr: ts.JsxAttribute | undefined): string {
  if (!attr?.initializer) return '';
  return ts.isStringLiteral(attr.initializer) ? attr.initializer.text : attr.initializer.getText().replace(/^\{|\}$/g, '');
}
export function componentOf(node: ts.Node): string {
  for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
    if (ts.isFunctionDeclaration(ancestor) && ancestor.name) return ancestor.name.text;
    if (ts.isVariableDeclaration(ancestor) && ts.isIdentifier(ancestor.name)) return ancestor.name.text;
  }
  return 'AnonymousComponent';
}
const intrinsic = new Set(['button', 'input', 'textarea', 'select', 'option', 'summary', 'details', 'a', 'form', 'nav', 'header', 'footer', 'aside', 'main', 'section', 'dialog', 'menu', 'ul', 'ol', 'table', 'li']);
const roles = new Set(['button', 'tab', 'tablist', 'dialog', 'menu', 'menuitem', 'list', 'listbox', 'option', 'combobox', 'slider', 'checkbox', 'radio', 'switch', 'toolbar', 'tree', 'treeitem', 'separator']);
// These wrappers forward the identity to their functional DOM root. New wrappers
// must be added here and tested; their call sites, not their render implementation,
// own the identity. Checked by validateUISourceCoverage.
export const UI_FORWARDERS: Readonly<Record<string, readonly string[]>> = {
  "src/app/(dashboard)/admin/page.tsx": [
    "TextInput",
    "SecondaryButton",
    "TinyButton",
    "SelectInput",
    "PrimaryButton"
  ],
  "src/app/(dashboard)/review/page.tsx": [
    "ActionButton"
  ],
  "src/app/(dashboard)/settings/page.tsx": [
    "Toggle",
    "Field"
  ],
  "src/app/(dashboard)/tracking/page.tsx": [
    "FilterChip"
  ],
  "src/app/(dashboard)/variants/page.tsx": [
    "FilterSelect",
    "Field"
  ],
  "src/components/editor/AyahNavigator.tsx": [
    "NavButton"
  ],
  "src/components/editor/EditorToolbar.tsx": [
    "Group",
    "ToolButton",
    "ToggleButton"
  ],
  "src/components/editor/GlobalRuleBuilder.tsx": [
    "Field"
  ],
  "src/components/editor/GlobalRuleMetaEditor.tsx": [
    "Field"
  ],
  "src/components/editor/PropertiesPanel.tsx": [
    "Section"
  ],
  "src/components/editor/RecitationControls.tsx": [
    "Section"
  ],
  "src/components/editor/RuleOccurrenceReview.tsx": [
    "NavButton",
    "Tab"
  ],
  "src/components/editor/SelectionDetailsPanel.tsx": [
    "DetailList"
  ],
  "src/components/editor/VariantEditor.tsx": [
    "Field"
  ],
  "src/components/studio/CandidateRulesPanel.tsx": [
    "TypeSelect",
    "DecisionSelect",
    "Field"
  ],
  "src/components/studio/EngineSettingsPanel.tsx": [
    "SelectInput",
    "CheckboxInput",
    "RangeInput"
  ],
  "src/components/editor/RelationsPanel.tsx": [
    "FaceSelect",
    "LineSelect",
    "RelationSelect",
    "NotesInput"
  ],
  "src/components/editor/LineOrderEditor.tsx": [
    "RankInput"
  ],
  "src/components/studio/RuleBuilder.tsx": [
    "Select",
    "Field"
  ],
  "src/app/(dashboard)/readers/page.tsx": [
    "TextField"
  ]
};
export const UI_WRAPPERS = new Set(['TextInput', 'TextField', 'Toggle', 'FilterSelect', 'TypeSelect', 'DecisionSelect', 'PrimaryButton', 'SecondaryButton', 'SelectInput', 'CheckboxInput', 'RangeInput', 'Select', 'TinyButton', 'ActionButton', 'FilterChip', 'ToolButton', 'ToggleButton', 'NavButton', 'Tab', 'Group', 'Section', 'Field', 'DetailList', 'FaceSelect', 'LineSelect', 'RelationSelect', 'NotesInput', 'RankInput']);
export function isForwarder(file: string, node: UINode): boolean {
  if (file.endsWith('EditorToolbar.tsx') && ['ToolButton', 'ToggleButton'].includes(componentOf(node)) && node.attributes.properties.some(ts.isJsxSpreadAttribute)) return true;
  if (file.endsWith('RecitationControls.tsx') && componentOf(node) === 'Section' && node.attributes.properties.some(ts.isJsxSpreadAttribute)) return true;
  return (UI_FORWARDERS[file] ?? []).includes(componentOf(node)) && value(attributes(node).get('data-ui-id')) === 'uiId';
}
export function isMeaningful(node: UINode): boolean {
  const tag = node.tagName.getText();
  const attrs = attributes(node);
  if (['ClassicLineShape', 'ClassicEntryShape', 'WordShape'].includes(tag)) return false;
  if (intrinsic.has(tag) || tag === 'Link' || UI_WRAPPERS.has(tag)) return true;
  if (roles.has(value(attrs.get('role')))) return true;
  if ([...attrs.keys()].some(name => /^(onClick|onDoubleClick|onContextMenu|onPointerDown|onMouseDown|onTouchStart|onKeyDown|onDrop|onDragStart|onDragOver|contentEditable|draggable|data-list-index|data-scroll-viewport)$/.test(name))) return true;
  if (tag === 'tr' && ts.isJsxOpeningElement(node)) {
    return /<(button|input|select|textarea|a|Link)\b/.test(node.parent.getText());
  }
  return attrs.has('data-ui-id');
}
export function kindOf(node: UINode): string {
  const attrs = attributes(node), tag = node.tagName.getText(), role = value(attrs.get('role'));
  if (role === 'dialog' || tag === 'dialog') return 'dialog';
  if (role === 'tab' || tag === 'Tab') return 'tab';
  if (role === 'menuitem') return 'menu-item';
  if (role === 'menu' || tag === 'menu' || tag === 'details') return 'menu';
  if (attrs.has('onDrop') || attrs.has('onDragOver')) return 'drop-zone';
  if (attrs.has('draggable') || attrs.has('onDragStart')) return 'drag-handle';
  if (tag === 'input') return ['checkbox', 'radio', 'range'].includes(value(attrs.get('type'))) ? ({ checkbox: 'checkbox', radio: 'radio', range: 'slider' }[value(attrs.get('type'))]!) : 'input';
  if (tag === 'textarea') return 'textarea';
  if (tag === 'select' || /Select$/.test(tag)) return 'select';
  if (tag === 'option') return 'option';
  if (tag === 'button' || /Button$/.test(tag) || tag === 'summary') return 'button';
  if (tag === 'Link' || tag === 'a' || tag === 'nav') return 'navigation';
  if (tag === 'form') return 'form';
  if (tag === 'ul' || tag === 'ol' || role === 'listbox' || role === 'list' || attrs.has('data-scroll-viewport')) return 'list';
  if (tag === 'table') return 'table';
  if (tag === 'tr' || attrs.has('data-list-index')) return 'list-item';
  if (tag === 'Group' || role === 'toolbar' || role === 'tablist') return 'toolbar';
  if (tag === 'aside') return 'panel';
  if (tag === 'main') return 'shell';
  if (['section', 'header', 'footer', 'Section', 'Field', 'DetailList'].includes(tag)) return 'section';
  return 'control';
}
export function parseUI(file: string, source: string): { ast: ts.SourceFile; nodes: UINode[] } {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const nodes: UINode[] = [];
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && isMeaningful(node)) nodes.push(node);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return { ast, nodes };
}

export function validateUISourceCoverage(sources = readUISources()): string[] {
  const errors: string[] = [];
  for (const [file, source] of sources) {
    const { ast, nodes } = parseUI(file, source);
    for (const node of nodes) {
      // Wrapper contents are validated through their call-site identity.
      if (isForwarder(file, node)) continue;
      if (!attributes(node).has('data-ui-id')) {
        const line = ast.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        errors.push(`${file}:${line} <${node.tagName.getText()}> in ${componentOf(node)} missing data-ui-id`);
      }
    }
  }
  return errors;
}
