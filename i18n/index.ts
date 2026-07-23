import type { Lang } from './types';
import en from './en';
import ms from './ms';
import zh from './zh';
import ta from './ta';

export const dictionaries: Record<Lang, Record<string, string>> = { en, ms, zh, ta };

export type { Lang } from './types';
export { LANGS } from './types';
