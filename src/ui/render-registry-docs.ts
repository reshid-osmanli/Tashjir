import { FEATURE_REGISTRY } from './feature-registry';
import { RETIRED_UI_IDS, UI_REGISTRY } from './ui-registry';

const recordsByParent = new Map<string, typeof UI_REGISTRY[number][]>();
for (const entry of UI_REGISTRY) {
  const siblings = recordsByParent.get(entry.parentId ?? '') ?? [];
  siblings.push(entry);
  recordsByParent.set(entry.parentId ?? '', siblings);
}

function markdownCell(value: string): string {
  return value.trim().replaceAll('|', '\\|').replaceAll('\n', '<br>');
}

function codeList(values: readonly string[]): string {
  return values.length ? values.map((value) => `\`${markdownCell(value)}\``).join(', ') : '—';
}

function treeFor(parentId: string, depth = 0, visited = new Set<string>()): string[] {
  const children = recordsByParent.get(parentId) ?? [];
  const lines: string[] = [];
  for (const entry of children) {
    if (visited.has(entry.id)) continue;
    const nextVisited = new Set(visited).add(entry.id);
    const suffix = entry.kind === 'route' ? ` — \`${entry.route}\`` : '';
    lines.push(`${'  '.repeat(depth)}- **${entry.id}** — ${entry.name} (${entry.kind}, ${entry.status})${suffix}`);
    lines.push(...treeFor(entry.id, depth + 1, nextVisited));
  }
  return lines;
}

export function renderUIRegistryDoc(): string {
  const featureTree = FEATURE_REGISTRY.flatMap((feature) => [
    `- **${feature.id}** — ${feature.name} (feature, ${feature.status}) — \`${feature.route}\``,
    ...treeFor(feature.id, 1),
  ]).join('\n');

  const summaryTable = [
    '| ID | Type | Name | Parent | Route | Component | File | Status |',
    '|---|---|---|---|---|---|---|---|',
    ...UI_REGISTRY.map((entry) => `| ${entry.id} | ${entry.kind} | ${markdownCell(entry.name)} | ${entry.parentId} | \`${markdownCell(entry.route)}\` | \`${markdownCell(entry.component)}\` | \`${markdownCell(entry.sourceFile)}\` | ${entry.status} |`),
  ].join('\n');

  const details = UI_REGISTRY.map((entry) => [
    `<details>`,
    `<summary><strong>${entry.id} — ${markdownCell(entry.name)}</strong></summary>`,
    '',
    `- **Type:** \`${entry.kind}\``,
    `- **Feature:** ${entry.featureId} — ${FEATURE_REGISTRY.find((feature) => feature.id === entry.featureId)?.name ?? 'Unknown'}`,
    `- **Parent:** ${entry.parentId}`,
    `- **Route:** \`${markdownCell(entry.route)}\``,
    `- **Component:** \`${markdownCell(entry.component)}\``,
    `- **Source:** \`${markdownCell(entry.sourceFile)}\``,
    `- **Purpose:** ${markdownCell(entry.description)}`,
    `- **Behavior:** ${markdownCell(entry.behavior)}`,
    `- **Constraints:** ${markdownCell(entry.constraints)}`,
    `- **Actions:** ${markdownCell(JSON.stringify(entry.actions ?? []))}`,
    `- **Stores:** ${codeList(entry.stores ?? [])}`,
    `- **Logic files:** ${codeList(entry.logicFiles ?? [])}`,
    `- **Tests (regression boundary):** ${codeList(entry.testFiles ?? [])}`,
    `- **Shortcuts:** ${codeList(entry.shortcuts ?? [])}`,
    `- **Identity mode:** ${entry.identity ?? 'static'}`,
    `- **Status:** \`${entry.status}\``,
    `- **Dependencies:** ${codeList(entry.dependencies)}`,
    `- **Related UI IDs:** ${codeList(entry.relatedIds)}`,
    `- **Code references (not UI IDs):** ${codeList(entry.codeReferences)}`,
    '',
    `</details>`,
  ].join('\n')).join('\n\n');

  const retired = RETIRED_UI_IDS.length ? RETIRED_UI_IDS.map((id) => `- ${id}`).join('\n') : '- لا توجد معرفات متقاعدة عند تأسيس السجل؛ لا تحذف هذا القسم ولا تعِد استخدام أي ID يُتقاعد مستقبلا.';

  return `# Project Feature & UI Identity Registry\n\n` +
    `هذا هو المرجع الرسمي لهويات الميزات والعناصر المهمة في Tashjir. تعريف كل ID ومعلوماته في \`src/ui/feature-registry.ts\` أو \`src/ui/ui-registry.records.json\` (عبر ui-registry.ts)؛ ملف التوثيق هذا مولّد من المصدرين بواسطة \`npm run registry:docs\`. الاختبارات تقارن التوثيق بالمصدر وتفشل عند الانحراف.\n\n` +
    `## قواعد الهوية\n\n` +
    `- الصيغة الدائمة: \`A001\`، \`A002\`، ... ويقبل المدقق لاحقا أرقاما أطول من ثلاثة خانات. المعرفات يدوية وثابتة؛ لا تعتمد على ترتيب العرض أو ترتيب React أو النص العربي.\n` +
    `- كل ID عالمي بين سجل الميزات وسجل الواجهة. لا يُعاد استخدام ID محذوف: انقل سجله إلى حالة \`retired\` وأضفه إلى \`RETIRED_UI_IDS\`، ولا تحذف أثره التاريخي.\n` +
    `- \`data-ui-id\` يربط identity الفعلية بعنصر DOM. عناصر الصفوف/الأزرار المتكررة قد تشترك في هوية الدور/القالب؛ استخدم \`data-ui-instance\` بقيمة مفتاح المجال عند الحاجة لتحديد نسخة بعينها.\n` +
    `- Feature IDs تصف نطاق النظام. Route/UI IDs تصف سطح الصفحة أو التحكم المهم. لا تحول أسماء المتغيرات أو الدوال الداخلية إلى A IDs؛ تظهر تلك في \`codeReferences\` فقط.\n` +
    `- \`status\` هو \`active\`, \`deprecated\` أو \`retired\`. العنصر retired لا يبقى على DOM ولا يمكن إعادة استعمال معرفه.\n` +
    `- السجل نطاقه عناصر/نقاط تحكم ذات معنى، لا كل \`div\` أو عنصر HTML زخرفي. أي عنصر مهم جديد يحتاج ID وسجلا وعلامة DOM واختبارا.\n\n` +
    `## شجرة المشروع\n\n${featureTree}\n\n` +
    `## فهرس UI المختصر\n\n${summaryTable}\n\n` +
    `## السجلات الكاملة\n\n${details}\n\n` +
    `## دفتر المعرفات المتقاعدة\n\n${retired}\n\n` +
    `## التحقق\n\n` +
    `- \`npm test -- tests/ui-registry.test.ts\` يفحص uniqueness/format/hierarchy/references/DOM markers/unknown IDs/retired IDs وتطابق الوثائق.\n` +
    `- عناصر الـ UI ذات الحالة \`active\` أو \`deprecated\` يجب أن تحمل \`data-ui-id="Axxx"\` في الملف المسجل. فحص جميع ملفات المصدر يكشف أي علامة بلا تعريف.\n` +
    `- وضع UI ID Inspector: يعمل في كل بناء بما فيها الإنتاج، ويُفعَّل بـ \`?uiInspector=1\` أو الاختصار \`Alt+Shift+I\`. عند التعطيل لا يظهر شيء ولا تُحمَّل بيانات السجل؛ عند التفعيل تظهر الشارات وتُحمَّل بيانات السجل عند الطلب.\n`;
}

export function renderProjectMapDoc(): string {
  const routes = FEATURE_REGISTRY.map((feature) =>
    `| ${feature.id} | ${markdownCell(feature.name)} | \`${markdownCell(feature.route)}\` | ${codeList(feature.mainFiles)} |`
  );
  const entries = FEATURE_REGISTRY.map((feature) => [
    `## ${feature.id} — ${feature.name}`,
    '',
    `- **Current route/surface:** \`${markdownCell(feature.route)}\` (${feature.status})`,
    `- **Entry and primary files:** ${codeList(feature.mainFiles)}`,
    `- **Components:** ${codeList(feature.mainComponents)}`,
    `- **State/persistence owners:** ${codeList(feature.stores)}`,
    `- **Engine and data dependencies:** ${codeList(feature.engineDependencies)}`,
    `- **Focused tests:** ${codeList(feature.testFiles)}`,
    '',
    '| Layer | UI identities | Owning files/systems |',
    '|---|---|---|',
    ...feature.impactMap.map((layer) => `| ${layer.layer} | ${codeList(layer.uiIds)} | ${codeList(layer.files)} |`),
    '',
  ].join('\n')).join('\n');

  return `# Tashjir Project Map\n\n` +
    `This map is generated from \`src/ui/feature-registry.ts\`; exact interactive-element identities are in [UI_REGISTRY.md](./UI_REGISTRY.md), and change procedure is in [CHANGE_PROTOCOL.md](./CHANGE_PROTOCOL.md). Do not hand-edit generated sections.\n\n` +
    `## Current routes and cross-cutting surfaces\n\n` +
    `| Feature ID | Feature | Route/surface | Primary files |\n|---|---|---|---|\n${routes.join('\n')}\n\n` +
    `## Architecture and ownership\n\n` +
    `- **Route/UI layer:** App Router pages and components own presentation and user interaction; registered UI IDs are stable handles, not React keys.\n` +
    `- **State and persistence:** Stores/catalogs listed per feature own the current persisted state. A presentation-only change must not create another state owner.\n` +
    `- **Engine and data:** Listed engine dependencies are the existing behavior owners. UI work must call them rather than duplicating their rules.\n` +
    `- **Verification:** Feature test files and registry-wide validation are the expected regression boundary; inspect the feature's impact map before changing a lower layer.\n\n` +
    `## Feature map and impact layers\n\n${entries}` +
    `\n## Global source of truth\n\n` +
    `- Machine-readable feature definitions: \`src/ui/feature-registry.ts\`.\n` +
    `- Machine-readable UI definitions: \`src/ui/ui-registry.ts\`.\n` +
    `- DOM binding validator: \`src/ui/registry-validation.ts\`.\n` +
    `- Human-readable generated registry: [UI_REGISTRY.md](./UI_REGISTRY.md) and [FEATURE_REGISTRY.md](./FEATURE_REGISTRY.md).\n`;
}

export function renderFeatureRegistryDoc(): string {
  const sections = FEATURE_REGISTRY.map((feature) => {
    const descendants = new Set<string>();
    const visit = (parentId: string) => {
      for (const child of recordsByParent.get(parentId) ?? []) {
        if (descendants.has(child.id)) continue;
        descendants.add(child.id);
        visit(child.id);
      }
    };
    visit(feature.id);
    const featureUiIds = [...descendants];
    return [
      `## ${feature.id} — ${feature.name}`,
      '',
      `- **Route/surface:** \`${markdownCell(feature.route)}\``,
      `- **Status:** \`${feature.status}\``,
      `- **Purpose:** ${markdownCell(feature.purpose)}`,
      `- **Important child UI IDs:** ${featureUiIds.length ? featureUiIds.map((id) => `\`${id}\``).join(', ') : '—'}`,
      `- **Main files:** ${codeList(feature.mainFiles)}`,
      `- **Main components:** ${codeList(feature.mainComponents)}`,
      `- **Stores/persistence owners:** ${codeList(feature.stores)}`,
      `- **Engine/data dependencies:** ${codeList(feature.engineDependencies)}`,
      `- **Regression tests:** ${codeList(feature.testFiles)}`,
      '',
      `### Change impact map`,
      '',
      '| Layer | UI IDs | Files / systems | Notes |',
      '|---|---|---|---|',
      ...feature.impactMap.map((layer) => `| ${layer.layer} | ${codeList(layer.uiIds)} | ${codeList(layer.files)} | ${markdownCell(layer.notes)} |`),
      '',
    ].join('\n');
  }).join('\n');

  return `# Feature Registry and Change Impact Map\n\n` +
    `Feature definitions live in \`src/ui/feature-registry.ts\`. This document is generated from that source and checked by \`tests/ui-registry.test.ts\`; do not hand-edit it. UI definitions and exact element locations are in [UI_REGISTRY.md](./UI_REGISTRY.md).\n\n` +
    `## At a glance\n\n` +
    `| Feature ID | Feature | Route/surface | Purpose | Status |\n|---|---|---|---|---|\n` +
    FEATURE_REGISTRY.map((feature) => `| ${feature.id} | ${markdownCell(feature.name)} | \`${markdownCell(feature.route)}\` | ${markdownCell(feature.purpose)} | ${feature.status} |`).join('\n') +
    `\n\n## Feature details\n\n${sections}` +
    `\n## Reading the impact map\n\n` +
    `The dependency path is **UI ID → owning store/persistence → engine/data model → regression tests**. A UI-only request must remain at its exact UI ID unless the feature behavior proves another layer is necessary; if it does, explain the dependency and keep the change minimal. File/function names are ordinary code references, never UI IDs.\n`;
}
