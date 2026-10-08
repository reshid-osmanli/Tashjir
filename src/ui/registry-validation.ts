import type { FeatureRegistryEntry, RegistryStatus } from './feature-registry';
import type { UIRegistryEntry } from './ui-registry';

const ID_PATTERN = /^A\d{3,}$/;
const VALID_STATUSES: readonly RegistryStatus[] = ['active', 'deprecated', 'retired'];

type SourceMap = ReadonlyMap<string, string>;

export interface RegistryValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Pure validation used by tests/CI. The caller supplies source contents so the
 * runtime registry has no Node filesystem dependency and can be bundled for UI.
 */
export function validateIdentityRegistry(
  features: readonly FeatureRegistryEntry[],
  entries: readonly UIRegistryEntry[],
  sourceFiles: SourceMap,
  retiredIds: readonly string[] = []
): RegistryValidationResult {
  const errors: string[] = [];
  const featureById = new Map(features.map((feature) => [feature.id, feature]));
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const identityIds = new Set<string>();
  const allIds = new Set<string>();

  const addId = (id: string, label: string) => {
    if (!ID_PATTERN.test(id)) errors.push(`${label} has invalid ID "${id}"; expected A followed by at least three digits.`);
    if (allIds.has(id)) errors.push(`Duplicate global ID "${id}" (${label}).`);
    allIds.add(id);
    identityIds.add(id);
  };

  for (const feature of features) {
    addId(feature.id, `feature ${feature.name}`);
    if (feature.kind !== 'feature') errors.push(`${feature.id} must have kind "feature".`);
    if (!VALID_STATUSES.includes(feature.status)) errors.push(`${feature.id} has invalid status "${feature.status}".`);
    for (const [field, value] of [
      ['name', feature.name],
      ['route', feature.route],
      ['purpose', feature.purpose],
    ] as const) {
      if (!value.trim()) errors.push(`${feature.id} is missing ${field}.`);
    }
    for (const field of ['mainFiles', 'mainComponents', 'stores', 'engineDependencies', 'testFiles'] as const) {
      if (!Array.isArray(feature[field])) errors.push(`${feature.id} has invalid ${field}.`);
    }
  }

  for (const entry of entries) {
    addId(entry.id, `UI entry ${entry.name}`);
    if (!VALID_STATUSES.includes(entry.status)) errors.push(`${entry.id} has invalid status "${entry.status}".`);
    for (const [field, value] of [
      ['kind', entry.kind],
      ['name', entry.name],
      ['featureId', entry.featureId],
      ['parentId', entry.parentId],
      ['route', entry.route],
      ['component', entry.component],
      ['sourceFile', entry.sourceFile],
      ['description', entry.description],
      ['behavior', entry.behavior],
      ['constraints', entry.constraints],
    ] as const) {
      if (!value.trim()) errors.push(`${entry.id} is missing ${field}.`);
    }
    if (!featureById.has(entry.featureId)) errors.push(`${entry.id} references missing feature ${entry.featureId}.`);
    if (!entryById.has(entry.parentId) && !featureById.has(entry.parentId)) {
      errors.push(`${entry.id} references missing parent ${entry.parentId}.`);
    }
    if (entry.parentId === entry.id) errors.push(`${entry.id} cannot be its own parent.`);
    for (const refId of [...entry.dependencies, ...entry.relatedIds]) {
      if (!identityIds.has(refId) && !featureById.has(refId) && !entryById.has(refId)) {
        errors.push(`${entry.id} references unknown related ID ${refId}.`);
      }
    }

    if (entry.status === 'active' || entry.status === 'deprecated') {
      const source = sourceFiles.get(entry.sourceFile);
      if (source === undefined) {
        errors.push(`${entry.id} source file does not exist: ${entry.sourceFile}.`);
      } else if (!hasStaticDomIdentity(source, entry.id)) {
        errors.push(`${entry.id} has no data-ui-id="${entry.id}" marker in ${entry.sourceFile}.`);
      }
    }
  }

  // Verify that the ancestry agrees with the declared feature, and contains no cycles.
  for (const entry of entries) {
    const parentEntry = entryById.get(entry.parentId);
    if (parentEntry && parentEntry.featureId !== entry.featureId) {
      errors.push(`${entry.id} belongs to ${entry.featureId}, but parent ${entry.parentId} belongs to ${parentEntry.featureId}.`);
    }
    const parentFeature = featureById.get(entry.parentId);
    if (parentFeature && parentFeature.id !== entry.featureId) {
      errors.push(`${entry.id} belongs to ${entry.featureId}, but feature parent ${entry.parentId} does not match.`);
    }

    const visited = new Set<string>([entry.id]);
    let parentId: string | undefined = entry.parentId;
    while (parentId && entryById.has(parentId)) {
      if (visited.has(parentId)) {
        errors.push(`Parent cycle detected from ${entry.id} through ${parentId}.`);
        break;
      }
      visited.add(parentId);
      parentId = entryById.get(parentId)?.parentId;
    }
  }

  for (const feature of features) {
    for (const layer of feature.impactMap) {
      for (const id of layer.uiIds) {
        if (!featureById.has(id) && !entryById.has(id)) {
          errors.push(`${feature.id} impact map references unknown UI ID ${id}.`);
        }
      }
    }
  }

  const retired = new Set<string>();
  for (const id of retiredIds) {
    if (!ID_PATTERN.test(id)) errors.push(`Retired ID ledger contains invalid ID "${id}".`);
    if (retired.has(id)) errors.push(`Retired ID ledger repeats "${id}".`);
    retired.add(id);
    if (allIds.has(id)) errors.push(`Retired ID "${id}" has been reused by an active registry record.`);
  }
  for (const entry of entries) {
    if (entry.status === 'retired' && !retired.has(entry.id)) {
      errors.push(`Retired registry entry ${entry.id} must also be present in the permanent retired-ID ledger.`);
    }
    if (entry.status === 'retired' && hasMarkerInAnySource(sourceFiles, entry.id)) {
      errors.push(`Retired UI ID ${entry.id} must not remain on an active DOM element.`);
    }
  }

  // Catch orphan UI markers in TS/TSX even if no Registry record points to them.
  for (const [file, source] of sourceFiles) {
    for (const id of findStaticDomIdentities(source)) {
      const entry = entryById.get(id);
      const feature = featureById.get(id);
      if (!entry && !feature) errors.push(`${file} contains unregistered data-ui-id="${id}".`);
      if (entry?.status === 'retired') errors.push(`${file} contains retired data-ui-id="${id}".`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function hasStaticDomIdentity(source: string, id: string): boolean {
  return findStaticDomIdentities(source).includes(id);
}

function findStaticDomIdentities(source: string): string[] {
  const ids = new Set<string>();
  const staticPattern = /\bdata-ui-id\s*=\s*["'](A\d+)["']/g;
  for (const match of source.matchAll(staticPattern)) ids.add(match[1]!);

  // Some repeated components resolve a stable registry ID from a typed data
  // record (for example, responsive navigation links). Validate the mapped
  // literals only when the JSX actually binds `data-ui-id` to that property.
  const propertyPattern = /\bdata-ui-id\s*=\s*\{\s*[A-Za-z_$][\w$]*\.([A-Za-z_$][\w$]*)\s*\}/g;
  for (const match of source.matchAll(propertyPattern)) {
    const property = match[1]!;
    const valuePattern = new RegExp(`\\b${property}\\s*:\\s*['"](A\\d+)['"]`, 'g');
    for (const value of source.matchAll(valuePattern)) ids.add(value[1]!);
  }

  return [...ids];
}

function hasMarkerInAnySource(sourceFiles: SourceMap, id: string): boolean {
  for (const source of sourceFiles.values()) {
    if (hasStaticDomIdentity(source, id)) return true;
  }
  return false;
}
