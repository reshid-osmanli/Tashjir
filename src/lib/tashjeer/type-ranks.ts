import type { VariantCategory } from '@/types';

/** Defaults for NEW types only; stored/local explicit ranks always win (P-04). */
export const DEFAULT_TYPE_RANK: Record<VariantCategory, number> = {
  TAHQIQ: 1, USUL: 2, FARSH: 3, MADUD: 4, HAMZ: 5, WAQF: 6, TAJWEED: 7,
};
export const ORDERED_VARIANT_CATEGORIES = (Object.keys(DEFAULT_TYPE_RANK) as VariantCategory[])
  .sort((a, b) => DEFAULT_TYPE_RANK[a] - DEFAULT_TYPE_RANK[b]);
