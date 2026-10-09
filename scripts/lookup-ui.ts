import { getUIEntryById, getFeatureForIdentity } from '../src/ui/ui-registry';
const id = process.argv[2];
const entry = id ? getUIEntryById(id) : undefined;
if (!entry) {
  console.error(`Unknown UI ID: ${id ?? '(missing)'} — use npm run registry:lookup -- A333`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ ...entry, feature: getFeatureForIdentity(entry.id) }, null, 2));
}
