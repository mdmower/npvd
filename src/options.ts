import {isRecord} from './utils.js';

export const modes = ['npm', 'pnpm', 'yarn'] as const;
export type Mode = (typeof modes)[number];

export const dependencyTypes = ['prod', 'dev', 'optional', 'peer'] as const;
export type DependencyType = (typeof dependencyTypes)[number];

export const includeTypes = dependencyTypes.slice();
export const omitTypes = dependencyTypes.slice().filter((type) => type !== 'prod');

export interface Options {
  mode: Mode;
  include?: DependencyType[];
  omit?: Exclude<DependencyType, 'prod'>[];
  directOnly?: boolean;
  git?: boolean;
  gitLockFile?: string;
  maxBuffer?: number;
}

export function isOptions(val: unknown): val is Options {
  return (
    isRecord(val) &&
    (val.mode === undefined || isOptionMode(val.mode)) &&
    (val.include === undefined || isOptionInclude(val.include)) &&
    (val.omit === undefined || isOptionOmit(val.omit)) &&
    (val.git === undefined || typeof val.git === 'boolean')
  );
}

export function isOptionMode(val: unknown): val is Options['mode'] {
  return typeof val === 'string' && (modes as readonly string[]).includes(val);
}

export function isOptionInclude(val: unknown): val is Options['include'] {
  return (
    Array.isArray(val) &&
    val.every((item) => typeof item === 'string' && (includeTypes as string[]).includes(item))
  );
}

export function isOptionOmit(val: unknown): val is Options['omit'] {
  return (
    Array.isArray(val) &&
    val.every((item) => typeof item === 'string' && (omitTypes as string[]).includes(item))
  );
}
