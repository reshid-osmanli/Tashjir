import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderFeatureRegistryDoc, renderProjectMapDoc, renderUIRegistryDoc } from '../src/ui/render-registry-docs';

const root = process.cwd();
writeFileSync(resolve(root, 'docs/UI_REGISTRY.md'), renderUIRegistryDoc(), 'utf8');
writeFileSync(resolve(root, 'docs/FEATURE_REGISTRY.md'), renderFeatureRegistryDoc(), 'utf8');
writeFileSync(resolve(root, 'docs/PROJECT_MAP.md'), renderProjectMapDoc(), 'utf8');
console.log('Generated docs/UI_REGISTRY.md, docs/FEATURE_REGISTRY.md, and docs/PROJECT_MAP.md from src/ui registry sources.');
