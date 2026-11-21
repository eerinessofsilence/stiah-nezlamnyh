export const statuses = [
  { id: 'military', title: 'Військовий', icon: 'shield',
    serviceIds: ['injury', 'vlk', 'status', 'benefits', 'housing', 'psychology'] },
  { id: 'veteran', title: 'Ветеран', icon: 'medal',
    serviceIds: ['status', 'medical', 'work', 'benefits', 'housing', 'legal', 'escort', 'psychology'] },
  { id: 'disability', title: 'Особа з інвалідністю внаслідок війни', icon: 'wheelchair',
    serviceIds: ['msek', 'status', 'medical', 'rehab', 'benefits', 'housing', 'psychology', 'legal'] },
  { id: 'fallen-family', title: 'Сім’ї загиблих (померлих)', icon: 'heart',
    serviceIds: ['fallen-family', 'status', 'benefits', 'housing', 'legal', 'psychology'] },
  { id: 'pow-family', title: 'Родини полонених', icon: 'users',
    serviceIds: ['missing-family', 'escort', 'status', 'benefits', 'legal', 'psychology'] },
  { id: 'missing-family', title: 'Сім’ї зниклих безвісти', icon: 'user-focus',
    serviceIds: ['missing-family', 'escort', 'status', 'benefits', 'legal', 'psychology'] },
] as const;

export type GuideProfile = {
  name: string;
  statusId: typeof statuses[number]['id'];
};

export function readProfile(value: string | null, legacyStatusId: string | null): GuideProfile | null {
  if (value) {
    try {
      const saved = JSON.parse(value) as Partial<GuideProfile> | null;
      if (saved === null) return null;
      const status = statuses.find(item => item.id === saved?.statusId);
      if (status && typeof saved?.name === 'string') {
        return { name: saved.name, statusId: status.id };
      }
    } catch {
      // Fall back to the status saved before onboarding was introduced.
    }
  }

  const status = statuses.find(item => item.id === legacyStatusId);
  return status ? { name: '', statusId: status.id } : null;
}
