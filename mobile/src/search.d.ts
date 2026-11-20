import type { GuideSection, preparation, Service } from './data/catalog';

export type AnswerChoice = { route: string; section: string | null };

export function findServices(services: Service[], query: string): Service[];
export function matchTopics(services: Service[], question: string, lastTopic?: string | null): string[];
export function answerSections(service: Service, question: string, previousSection?: string | null): GuideSection[];
export function findContacts<T extends { keys: string }>(contacts: T[], query: string): T[];
export function localAnswers(services: Service[], question: string, previous?: AnswerChoice | null): AnswerChoice[];
export function parseAiAnswers(services: Service[], value: unknown): AnswerChoice[];
export function normalized(text: string): string;

export function routeProgressSummary(id: string, lists: typeof preparation, checked: string[]): {
  section: string | null; total: number; completed: number; next: string | null;
};
