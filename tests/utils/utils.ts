import {join} from 'node:path';

const fixturesDir = join(import.meta.dirname, '../fixtures');

export function lockFilePath(
  variant:
    | 'npm-v2'
    | 'npm-v3'
    | 'npm-workspaces'
    | 'pnpm-v6'
    | 'pnpm-v9'
    | 'pnpm-v11'
    | 'pnpm-workspaces'
    | 'yarn-berry'
    | 'yarn-berry-workspaces',
  stage: 'before' | 'after'
): string {
  const file = variant.startsWith('pnpm')
    ? 'pnpm-lock.yaml'
    : variant.startsWith('yarn')
      ? 'yarn.lock'
      : 'package-lock.json';
  return join(fixturesDir, variant, stage, file);
}
