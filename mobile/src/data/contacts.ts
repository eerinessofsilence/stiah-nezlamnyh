import snapshot from './catalog.json';

export type Contact = {
  title: string;
  description: string;
  details?: string;
  phone: string;
  dial: string;
  email?: string;
  source: string;
};

export const contacts: Contact[] = snapshot.contacts;
export const localContacts: (Contact & { keys: string })[] = snapshot.localContacts;
export const hotline = contacts[0];
