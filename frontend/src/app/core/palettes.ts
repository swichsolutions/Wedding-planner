/**
 * Wedding colour palettes a couple can pick for their banner (B7). A first set until Taso's
 * (BUILD-PLAN B7 "You provide"); keys must match BannerRules.PaletteKeys in the API. These are the
 * couple's own colours, shown on their banner only, so they sit outside the brand tokens.
 */
export interface Palette {
  key: string;
  /** Light to dark. */
  colors: [string, string, string, string];
  /** The darkest colour: tints the banner's scrim, dark enough for white text. */
  deep: string;
}

export const PALETTES: Palette[] = [
  { key: 'ivory-sage', colors: ['#F4F1EA', '#DCE3D3', '#9AAE8C', '#4F5D47'], deep: '#3E4A38' },
  { key: 'blush-gold', colors: ['#F8E6E0', '#E9B8AE', '#C99A5B', '#7A4E3A'], deep: '#5E3A2B' },
  { key: 'garnet', colors: ['#F3E3DF', '#C4A272', '#B5474B', '#6E1F2A'], deep: '#5A1822' },
  { key: 'dusty-blue', colors: ['#EEF2F5', '#A9BCCD', '#5E7A93', '#2F3E4E'], deep: '#26323F' },
  { key: 'terracotta', colors: ['#F6E9DE', '#E0A27C', '#B85C38', '#6B3A2A'], deep: '#552D20' },
  { key: 'lavender', colors: ['#F2EEF6', '#C8B8DB', '#8E77AA', '#4E3F63'], deep: '#3E3250' },
  { key: 'emerald', colors: ['#EEF3EE', '#C9A96A', '#5E9C83', '#2E6B53'], deep: '#1F4D3B' },
  { key: 'mono', colors: ['#FFFFFF', '#D9D6D1', '#6D6868', '#1E1C1D'], deep: '#1E1C1D' },
];

export const paletteOf = (key: string | null | undefined): Palette | null =>
  PALETTES.find((p) => p.key === key) ?? null;
