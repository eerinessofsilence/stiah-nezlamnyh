import snapshot from './catalog.json';

export type GuideSection = {
  id: string;
  title: string;
  keys: string;
  paragraphs: string[];
  action?: string[];
};
export type Service = {
  id: string;
  title: string;
  desc: string;
  keys: string;
  group: string;
  steps: string[];
  sections: GuideSection[];
  source: string[];
  action?: string[];
  related: string[];
};
export const services: Service[] = snapshot.services;
export const { groups, featured, checkedOn } = snapshot;
export const sources: Partial<Record<string, string[]>> = snapshot.sources;
export const preparation: Partial<Record<string, {
  note: string;
  source: string;
  items: string[][];
  section?: string;
}>> = snapshot.preparation;
