import {exec} from 'node:child_process';
import {mkdir, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {dependencyVersions, FixtureDependencies, workspaceDependencyVersions} from './versions.js';

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

async function setupPnpmWorkspaceStage(
  stageDir: string,
  workspaces: Record<string, FixtureDependencies>
) {
  await mkdir(stageDir, {recursive: true});
  await writeFile(
    join(stageDir, 'package.json'),
    JSON.stringify({name: 'npvd-fixture-mono', version: '0.0.0', private: true}, null, 2) + '\n'
  );
  const workspacePaths = Object.keys(workspaces);
  await writeFile(
    join(stageDir, 'pnpm-workspace.yaml'),
    `packages:\n${workspacePaths.map((p) => `  - '${p}'`).join('\n')}\n`
  );
  for (const [wsPath, deps] of Object.entries(workspaces)) {
    const wsDir = join(stageDir, wsPath);
    await mkdir(wsDir, {recursive: true});
    await writeFile(
      join(wsDir, 'package.json'),
      JSON.stringify(
        {
          name: `@npvd-fixture/${wsPath.split('/').pop()}`,
          version: '0.0.0',
          private: true,
          ...deps,
        },
        null,
        2
      ) + '\n'
    );
  }
}

async function generatePnpmWorkspaceFixtures(dir: string, pnpmVersion: string) {
  await rm(dir, {recursive: true, force: true});
  const before = join(dir, 'before');
  const after = join(dir, 'after');
  await setupPnpmWorkspaceStage(before, workspaceDependencyVersions.before);
  await setupPnpmWorkspaceStage(after, workspaceDependencyVersions.after);
  const cmd = `npx --yes pnpm@${pnpmVersion} install --lockfile-only --ignore-scripts --silent`;
  await pexec(cmd, {cwd: before});
  await pexec(cmd, {cwd: after});
}

const npmWorkspaceVersions: Record<'before' | 'after', Record<string, string>> = {
  before: {'packages/a': '0.0.0', 'packages/b': '0.0.0'},
  after: {'packages/a': '0.0.1', 'packages/b': '0.0.0'},
};

async function setupNpmWorkspaceStage(
  stageDir: string,
  workspaces: Record<string, FixtureDependencies>,
  workspaceVersions: Record<string, string>
) {
  await mkdir(stageDir, {recursive: true});
  await writeFile(
    join(stageDir, 'package.json'),
    JSON.stringify(
      {
        name: 'npvd-fixture-mono',
        version: '0.0.0',
        private: true,
        workspaces: Object.keys(workspaces),
      },
      null,
      2
    ) + '\n'
  );
  for (const [wsPath, deps] of Object.entries(workspaces)) {
    const wsDir = join(stageDir, wsPath);
    await mkdir(wsDir, {recursive: true});
    await writeFile(
      join(wsDir, 'package.json'),
      JSON.stringify(
        {
          name: `@npvd-fixture/${wsPath.split('/').pop()}`,
          version: workspaceVersions[wsPath] ?? '0.0.0',
          private: true,
          ...deps,
        },
        null,
        2
      ) + '\n'
    );
  }
}

async function generateNpmWorkspaceFixtures(dir: string) {
  await rm(dir, {recursive: true, force: true});
  const before = join(dir, 'before');
  const after = join(dir, 'after');
  await setupNpmWorkspaceStage(
    before,
    workspaceDependencyVersions.before,
    npmWorkspaceVersions.before
  );
  await setupNpmWorkspaceStage(
    after,
    workspaceDependencyVersions.after,
    npmWorkspaceVersions.after
  );
  const cmd = `npm install --package-lock-only --no-audit --no-fund --silent`;
  await pexec(cmd, {cwd: before});
  await pexec(cmd, {cwd: after});
}

process.stdout.write('Generating fixtures...');

await generateNpmFixtures(join(import.meta.dirname, 'npm-v2'), '2');
await generateNpmFixtures(join(import.meta.dirname, 'npm-v3'), '3');
await generatePnpmFixtures(join(import.meta.dirname, 'pnpm-v6'), PNPM_V6);
await generatePnpmFixtures(join(import.meta.dirname, 'pnpm-v9'), PNPM_V9);
await generatePnpmWorkspaceFixtures(join(import.meta.dirname, 'pnpm-workspaces'), PNPM_V9);
await generateNpmWorkspaceFixtures(join(import.meta.dirname, 'npm-workspaces'));

process.stdout.write(' done.\n');
