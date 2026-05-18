import {exec} from 'node:child_process';
import {mkdir, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {dependencyVersions} from './versions.js';

const pexec = promisify(exec);

const PNPM_V6 = '8.15.9';
const PNPM_V9 = '11.1.2';

const packageJsonBefore =
  JSON.stringify(
    {
      name: 'npvd-fixture',
      version: '0.0.0',
      private: true,
      ...dependencyVersions.before,
    },
    null,
    2
  ) + '\n';

const packageJsonAfter =
  JSON.stringify(
    {
      name: 'npvd-fixture',
      version: '0.0.0',
      private: true,
      ...dependencyVersions.after,
    },
    null,
    2
  ) + '\n';

async function prepareFixtureDirs(dir: string) {
  await rm(dir, {recursive: true, force: true});
  const before = join(dir, 'before');
  const after = join(dir, 'after');
  await mkdir(before, {recursive: true});
  await mkdir(after, {recursive: true});
  await writeFile(join(before, 'package.json'), packageJsonBefore);
  await writeFile(join(after, 'package.json'), packageJsonAfter);
  return {before, after};
}

async function generateNpmFixtures(dir: string, lockfileVersion: string) {
  const {before, after} = await prepareFixtureDirs(dir);
  const cmd = `npm install --package-lock-only --lockfile-version ${lockfileVersion} --no-audit --no-fund --silent`;
  await pexec(cmd, {cwd: before});
  await pexec(cmd, {cwd: after});
}

async function generatePnpmFixtures(dir: string, pnpmVersion: string) {
  const {before, after} = await prepareFixtureDirs(dir);
  const cmd = `npx --yes pnpm@${pnpmVersion} install --lockfile-only --ignore-scripts --silent`;
  await pexec(cmd, {cwd: before});
  await pexec(cmd, {cwd: after});
}

process.stdout.write('Generating fixtures...');

await generateNpmFixtures(join(import.meta.dirname, 'npm-v2'), '2');
await generateNpmFixtures(join(import.meta.dirname, 'npm-v3'), '3');
await generatePnpmFixtures(join(import.meta.dirname, 'pnpm-v6'), PNPM_V6);
await generatePnpmFixtures(join(import.meta.dirname, 'pnpm-v9'), PNPM_V9);

process.stdout.write(' done.\n');
