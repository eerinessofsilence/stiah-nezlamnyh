export type RouteProgress = { saved: string[]; checked: string[] };

export function readProgress(raw: string | null, serviceIds: ReadonlySet<string>, itemIds: ReadonlySet<string>): RouteProgress {
  const empty: RouteProgress = { saved: [], checked: [] };
  if (!raw) return empty;

  try {
    const data = JSON.parse(raw);
    return {
      saved: validIds(data?.saved, serviceIds),
      checked: validIds(data?.checked, itemIds),
    };
  } catch {
    return empty;
  }
}

function validIds(value: unknown, allowed: ReadonlySet<string>) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && allowed.has(id)))];
}

export function toggleProgress(progress: RouteProgress, key: keyof RouteProgress, id: string): RouteProgress {
  const ids = progress[key];
  return { ...progress, [key]: ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id] };
}
