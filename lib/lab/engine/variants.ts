// How many distinct variants have been tried. A variant is a run hash, so the
// same strategy on the same data counts once however often it is rerun, and a
// swept value counts once whether it was swept or run on its own.

/** From this many variants the results carry a warning. */
export const VARIANT_WARNING_AT = 10;

export function countVariants(...hashLists: Iterable<string>[]): number {
  const all = new Set<string>();
  for (const list of hashLists) for (const h of list) all.add(h);
  return all.size;
}
