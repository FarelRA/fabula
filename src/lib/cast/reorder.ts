/** Array move used by the audition drag-and-drop and its pure tests. */
export function moveId<T>(items: readonly T[], activeId: T, overId: T): T[] {
  const from = items.indexOf(activeId);
  const to = items.indexOf(overId);
  if (from === -1 || to === -1 || from === to) return [...items];
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return next;
  next.splice(to, 0, moved);
  return next;
}

export function moveRoleIds(
  roleIds: readonly string[],
  activeId: string,
  overId: string,
): string[] {
  return moveId(roleIds, activeId, overId);
}
