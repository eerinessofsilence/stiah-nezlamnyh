export type RouteProgress = { checked: string[] };

export function readProgress(raw: string | null, itemIds: ReadonlySet<string>): RouteProgress {
  const empty: RouteProgress = { checked: [] };
  if (!raw) return empty;

  try {
    const data = JSON.parse(raw);
    return { checked: validIds(data?.checked, itemIds) };
  } catch {
    return empty;
  }
}

function validIds(value: unknown, allowed: ReadonlySet<string>) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && allowed.has(id)))];
}

export function toggleProgress({ checked }: RouteProgress, id: string): RouteProgress {
  return { checked: checked.includes(id) ? checked.filter((item) => item !== id) : [...checked, id] };
}
