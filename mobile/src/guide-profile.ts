export const statuses = [
  { id: 'military', title: 'Військовий', icon: { ios: 'shield', android: 'shield' },
    serviceIds: ['injury', 'vlk', 'status', 'benefits', 'housing', 'psychology'] },
  { id: 'veteran', title: 'Ветеран', icon: { ios: 'medal', android: 'military_tech' },
    serviceIds: ['status', 'medical', 'work', 'benefits', 'housing', 'legal', 'escort', 'psychology'] },
  { id: 'disability', title: 'Особа з інвалідністю внаслідок війни', icon: { ios: 'accessibility', android: 'accessibility_new' },
    serviceIds: ['status', 'medical', 'rehab', 'benefits', 'housing', 'psychology', 'legal'] },
  { id: 'fallen-family', title: 'Сім’ї загиблих (померлих)', icon: { ios: 'heart', android: 'favorite_border' },
    serviceIds: ['fallen-family', 'status', 'benefits', 'housing', 'legal', 'psychology'] },
  { id: 'pow-family', title: 'Родини полонених', icon: { ios: 'person.2', android: 'people' },
    serviceIds: ['missing-family', 'escort', 'status', 'benefits', 'legal', 'psychology'] },
  { id: 'missing-family', title: 'Сім’ї зниклих безвісти', icon: { ios: 'person.crop.circle.badge.questionmark', android: 'person_search' },
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
