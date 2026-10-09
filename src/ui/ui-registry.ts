/**
 * Project Feature & UI Identity Registry — the sole definition of UI identities.
 *
 * `data-ui-id` is the DOM binding for these records. IDs are permanent
 * conceptual identities, not labels, list positions, React keys, or render order.
 * Repeated instances of a list-row/control template may share the template ID;
 * attach a domain-specific `data-ui-instance` when a particular row matters.
 */

import records from './ui-registry.records.json';
import { FEATURE_REGISTRY, type FeatureId, type RegistryStatus } from './feature-registry';

export type UIKind =
  | 'route'
  | 'shell'
  | 'navigation'
  | 'toolbar'
  | 'panel'
  | 'card'
  | 'section'
  | 'list'
  | 'list-item'
  | 'dialog'
  | 'menu'
  | 'form'
  | 'input'
  | 'select'
  | 'checkbox'
  | 'button'
  | 'action'
  | 'control'
  | 'filter'
  | 'drag-handle'
  | 'inspector'
  | 'tab' | 'menu-item' | 'option' | 'textarea' | 'radio' | 'slider' | 'table' | 'drop-zone';

export interface UIRegistryEntry {
  id: string;
  kind: UIKind;
  name: string;
  featureId: FeatureId;
  parentId: string | null;
  route: string;
  component: string;
  sourceFile: string;
  description: string;
  status: RegistryStatus;
  identity?: "static" | "template" | "finite";
  optionKey?: string;
  actions?: readonly { event: string; expression: string }[];
  logicFiles?: readonly string[];
  stores?: readonly string[];
  testFiles?: readonly string[];
  shortcuts?: readonly string[];
  behavior: string;
  constraints: string;
  dependencies: readonly string[];
  relatedIds: readonly string[];
  codeReferences: readonly string[];
}

/** Checked-in, append-only identity records. No IDs are generated at render time. */
export const UI_REGISTRY: readonly UIRegistryEntry[] = records as readonly UIRegistryEntry[];

/** Permanent tombstones: retired records remain in the registry and never render. */
export const RETIRED_UI_IDS: readonly string[] = ["A977","A535","A536","A1146","A1156","A1187","A1190","A1943","A1717","A1719","A1721","A1444","A1445","A1449","A1453","A1454","A1456","A1457","A1458","A1549","A530","A532","A565","A597","A722","A1685","A1692","A577","A578","A660","A661","A690","A723","A729","A1050","A1074","A1079","A1109","A1139","A1149","A1222","A1226","A1258","A1611","A1663","A2000","A2001","A2002","A2003","A2004","A2005","A2006","A2007","A2008","A2009","A2010","A2011","A2012","A2013","A2014","A2015","A2016","A2017","A2018","A2019","A2020","A2021","A2022","A2023","A2024","A2025","A2026","A2027","A2028","A2057","A2058","A2059"];

export type RegistryIdentity = (typeof FEATURE_REGISTRY)[number] | (typeof UI_REGISTRY)[number];

export function getUIEntryById(id: string): (typeof UI_REGISTRY)[number] | undefined {
  return UI_REGISTRY.find((entry) => entry.id === id);
}

export function getUIIdentity(id: string): RegistryIdentity | undefined {
  return getUIEntryById(id) ?? FEATURE_REGISTRY.find((feature) => feature.id === id);
}

export function getFeatureForIdentity(id: string) {
  const identity = getUIIdentity(id);
  return identity ? FEATURE_REGISTRY.find((feature) => feature.id === ('featureId' in identity ? identity.featureId : identity.id)) : undefined;
}
