// City display forms for the category×city landing surfaces (H1s, meta, back-links).

/**
 * Georgian locative ("in X"): names ending in "ი" drop it before "ში"
 * (თბილისი → თბილისში, ბათუმი → ბათუმში); anything else takes a plain "ში"
 * suffix (მცხეთა → მცხეთაში). Covers Georgian city names; not a general
 * grammar engine.
 */
export function cityLocativeKa(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  return (trimmed.endsWith('ი') ? trimmed.slice(0, -1) : trimmed) + 'ში';
}

/** English display from the Latin city slug: "tbilisi" → "Tbilisi", "didi-dighomi" → "Didi Dighomi". */
export function cityDisplayEn(slug: string): string {
  return slug
    .split('-')
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}
