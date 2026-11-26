import type { GuideSection, Service } from './data/catalog';

export type AnswerChoice = { route: string; section: string | null; paragraphs?: number[] };
export type Conversation = 'greeting' | 'available' | 'wellbeing' | 'thanks' | 'about' | 'unclear' | 'offTopic';
export type CatalogReply = { answers: AnswerChoice[]; mode: 'answer' | 'clarify' | 'partial'; conversation?: Conversation; text?: string };
export const conversationReplies: Record<Conversation, string>;

export function findServices(services: Service[], query: string): Service[];
export function findSections(sections: GuideSection[], query: string, allowPartial?: boolean): GuideSection[];
export function matchTopics(services: Service[], question: string, lastTopic?: string | null): string[];
export function answerSections(service: Service, question: string, previousSection?: string | null): GuideSection[];
export function findContacts<T extends { keys: string }>(contacts: T[], query: string): T[];
export function directCatalogAnswers(services: Service[], question: string, previous?: AnswerChoice | null): AnswerChoice[];
export function requiresUnavailableAnswer(question: string): boolean;
export function questionParts(question: string): string[];
export function localAnswers(services: Service[], question: string, previous?: AnswerChoice | null): AnswerChoice[];
export function localCatalogReply(services: Service[], question: string, previous?: AnswerChoice | null): CatalogReply;
export function parseAiAnswers(services: Service[], value: unknown): AnswerChoice[];
export function parseCatalogReply(services: Service[], value: unknown): CatalogReply;
export function normalized(text: string): string;
