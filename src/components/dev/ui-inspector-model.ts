/**
 * UI ID Inspector — pure model.
 *
 * Badge placement, badge families and the registry detail rows. Nothing here touches the
 * DOM or imports the registry at runtime, so the rules are unit-tested against the real
 * registry data in tests/ui-inspector.test.ts.
 */
import type { UIRegistryEntry } from '@/ui/ui-registry';

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface BadgeCandidate extends Box {
  key: string;
  id: string;
  instance: string | null;
}

export interface PlacedBadge {
  key: string;
  id: string;
  instance: string | null;
  left: number;
  top: number;
}

export const BADGE_HEIGHT = 16;
const BADGE_EDGE = 2;
const BADGE_GAP = 2;
const BADGE_SLIDE_STEP = 4;
const BADGE_SLIDE_TRIES = 3;
const BADGE_PADDING = 8;
const BADGE_CHAR_WIDTH = 6.4;

/** Estimated label width for a 10px monospace ID, used for collision checks before paint. */
export function badgeWidth(id: string): number {
  return Math.ceil(BADGE_PADDING + BADGE_CHAR_WIDTH * id.length);
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
}

/**
 * Places one label per candidate. A label sits just above the element's top-left corner, or
 * inside that corner when there is no room above it. When labels would collide, the next free
 * slot to the right is used. Smaller elements claim their slot first, so a large container
 * never covers the label of a control inside it. Output keeps the candidate order.
 */
export function placeBadges(candidates: readonly BadgeCandidate[], viewport: { width: number; height: number }): PlacedBadge[] {
  const order = candidates
    .map((candidate, index) => ({ candidate, index, area: candidate.width * candidate.height }))
    .sort((a, b) => a.area - b.area || a.index - b.index);
  const occupied: Box[] = [];
  const placed: PlacedBadge[] = new Array<PlacedBadge>(candidates.length);

  for (const { candidate, index } of order) {
    const width = badgeWidth(candidate.id);
    const clampX = (x: number) => Math.max(BADGE_EDGE, Math.min(x, viewport.width - width - BADGE_EDGE));
    const clampY = (y: number) => Math.max(BADGE_EDGE, Math.min(y, viewport.height - BADGE_HEIGHT - BADGE_EDGE));

    const aboveTop = candidate.top - BADGE_HEIGHT - BADGE_GAP;
    const fitsAbove = aboveTop >= BADGE_EDGE;
    const preferredTop = clampY(fitsAbove ? aboveTop : candidate.top + BADGE_GAP);
    const preferredLeft = clampX(fitsAbove ? candidate.left : candidate.left + BADGE_GAP);
    const attempts: Box[] = [{ left: preferredLeft, top: preferredTop, width, height: BADGE_HEIGHT }];
    attempts.push({ left: clampX(candidate.left + BADGE_GAP), top: clampY(candidate.top + BADGE_GAP), width, height: BADGE_HEIGHT });
    for (let step = 1; step <= BADGE_SLIDE_TRIES; step++) {
      attempts.push({ left: clampX(preferredLeft + step * (width + BADGE_SLIDE_STEP)), top: preferredTop, width, height: BADGE_HEIGHT });
    }

    const chosen = attempts.find((box) => !occupied.some((other) => overlaps(box, other))) ?? attempts[0];
    if (!chosen) continue;
    occupied.push(chosen);
    placed[index] = { key: candidate.key, id: candidate.id, instance: candidate.instance, left: chosen.left, top: chosen.top };
  }
  return placed.filter((badge): badge is PlacedBadge => badge !== undefined);
}

/** Visual family of a registered kind. Colour is a quick cue; the registry kind is still shown in the details. */
export type InspectorFamily = 'action' | 'field' | 'choice' | 'container' | 'unregistered' | 'pending';

export const FAMILY_BY_KIND: Readonly<Record<string, Exclude<InspectorFamily, 'unregistered' | 'pending'>>> = {
  button: 'action',
  action: 'action',
  control: 'action',
  checkbox: 'action',
  radio: 'action',
  slider: 'action',
  filter: 'action',
  'drag-handle': 'action',
  'drop-zone': 'action',
  input: 'field',
  textarea: 'field',
  select: 'field',
  form: 'field',
  tab: 'choice',
  'menu-item': 'choice',
  menu: 'choice',
  option: 'choice',
  navigation: 'choice',
  route: 'container',
  shell: 'container',
  toolbar: 'container',
  panel: 'container',
  card: 'container',
  section: 'container',
  list: 'container',
  'list-item': 'container',
  table: 'container',
  dialog: 'container',
  inspector: 'container',
};

/** Family of a kind, for every kind the registry type allows. */
export function kindFamily(kind: string): Exclude<InspectorFamily, 'unregistered' | 'pending'> {
  return FAMILY_BY_KIND[kind] ?? 'container';
}

/** Family of a badge: `pending` until the registry is loaded, `unregistered` when the ID is missing from it. */
export function badgeFamily(entry: Pick<UIRegistryEntry, 'kind'> | undefined, registryReady: boolean): InspectorFamily {
  if (!registryReady) return 'pending';
  if (!entry) return 'unregistered';
  return kindFamily(entry.kind);
}

export const FAMILY_BADGE_CLASS: Readonly<Record<InspectorFamily, string>> = {
  action: 'border-fuchsia-100 bg-fuchsia-700 text-white',
  field: 'border-sky-100 bg-sky-700 text-white',
  choice: 'border-amber-100 bg-amber-600 text-white',
  container: 'border-emerald-100 bg-emerald-700 text-white',
  unregistered: 'border-rose-100 bg-rose-700 text-white',
  pending: 'border-slate-200 bg-slate-600 text-white',
};

/** Lookups the detail card needs. The panel implements them over the lazily loaded registry. */
export interface RegistryLookup {
  entry(id: string): UIRegistryEntry | undefined;
  identityName(id: string): string | undefined;
  featureName(id: string): string | undefined;
}

export interface InspectorRow {
  label: string;
  value: string;
  mono?: boolean;
}

function list(values: readonly string[] | undefined): string {
  return values && values.length > 0 ? values.join(', ') : '—';
}

function linked(id: string | null, nameOf: (id: string) => string | undefined): string {
  if (!id) return '—';
  const name = nameOf(id);
  return name ? `${id} — ${name}` : `${id} — (not in registry)`;
}

/** Registry rows for one record, in the order the detail card shows them. Missing values render as an em dash. */
export function buildRegistryRows(entry: UIRegistryEntry, lookup: RegistryLookup): InspectorRow[] {
  const actions = (entry.actions ?? []).map((action) => `${action.event}: ${action.expression}`).join('\n');
  return [
    { label: 'UI ID', value: entry.id, mono: true },
    { label: 'Name', value: entry.name },
    { label: 'Kind', value: entry.kind, mono: true },
    { label: 'Status', value: entry.status },
    { label: 'Route', value: entry.route, mono: true },
    { label: 'Parent ID', value: linked(entry.parentId, (id) => lookup.identityName(id)) },
    { label: 'Feature ID', value: linked(entry.featureId, (id) => lookup.featureName(id)) },
    { label: 'Component', value: entry.component, mono: true },
    { label: 'Source file', value: entry.sourceFile, mono: true },
    { label: 'Action / handler', value: actions || '— (no action recorded)', mono: true },
    { label: 'Related IDs', value: list(entry.relatedIds), mono: true },
    { label: 'Stores', value: list(entry.stores), mono: true },
    { label: 'Logic files', value: list(entry.logicFiles), mono: true },
    { label: 'Tests', value: list(entry.testFiles), mono: true },
    { label: 'Shortcuts', value: list(entry.shortcuts) },
    { label: 'Dependencies', value: list(entry.dependencies), mono: true },
    { label: 'Code refs', value: list(entry.codeReferences), mono: true },
    { label: 'Purpose', value: entry.description },
    { label: 'Behavior', value: entry.behavior },
    { label: 'Constraints', value: entry.constraints },
  ];
}
