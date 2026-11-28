/**
 * The first letter of a name, for the placeholder shown where a vendor has no photo yet.
 *
 * A Latin, Cyrillic or Greek letter is upper-cased; a Georgian one is left as it is. JavaScript's
 * toUpperCase() turns Georgian Mkhedruli (ა–ჰ) into Mtavruli capitals (U+1C90–U+1CBF), which the
 * heading font does not have and older phones and Windows cannot draw at all: „ბენდი" showed a
 * fallback-font „Ბ" or an empty box (found by the sweep of 2026-11-28). Georgian has no capitals
 * in everyday writing anyway.
 */
export function nameInitial(name: string): string {
  const first = Array.from(name.trim())[0] ?? '';
  return /[ა-ჿ]/.test(first) ? first : first.toUpperCase();
}
