/**
 * Keeps a saved selection visible in a filtered dropdown.
 * When the stored id is not part of `list` (partial hydration, legacy links…),
 * the matching record from `all` is appended so the select still shows a name.
 */
export function withSelected<T extends { id: string }>(
  list: T[],
  selectedId: string | undefined,
  all: T[],
): T[] {
  if (!selectedId) return list;
  if (list.some((x) => x.id === selectedId)) return list;
  const found = all.find((x) => x.id === selectedId);
  return found ? [...list, found] : list;
}
