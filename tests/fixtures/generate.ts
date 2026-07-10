import {exec} from 'node:child_process';
import {mkdir, rm, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {dependencyVersions, FixtureDependencies, workspaceDependencyVersions} from './versions.js';

const pexec = promisify(exec);

const PNPM_V6 = '8.15.9';
const PNPM = '11.11.0';
const YARN_BERRY = '4.5.0';

// Pinning pnpm via devEngines.packageManager makes pnpm 11+ record its resolved version in a
// leading YAML document of pnpm-lock.yaml. onFail: 'warn' allows npx to run.
const pnpmV11Manifest = {
  devEngines: {
    packageManager: {
      name: 'pnpm',
      version: PNPM,
      onFail: 'warn',
    },
  },
};

function buildRootPackageJson(stage: 'before' | 'after', extraManifest?: Record<string, unknown>) {
  return (
    JSON.stringify(
      {
        name: 'npvd-fixture',
        version: '0.0.0',
        private: true,
        ...extraManifest,
        ...dependencyVersions[stage],
      },
      null,
      2
    ) + '\n'
  );
}

async function prepareFixtureDirs(dir: string, extraManifest?: Record<string, unknown>) {
  await rm(dir, {recursive: true, force: true});
  const before = join(dir, 'before');
  const after = join(dir, 'after');
  await mkdir(before, {recursive: true});
  await mkdir(after, {recursive: true});
  await writeFile(join(before, 'package.json'), buildRootPackageJson('before', extraManifest));
  await writeFile(join(after, 'package.json'), buildRootPackageJson('after', extraManifest));
  return {before, after};
}

async function writeWorkspacePackages(
  stageDir: string,
  workspaces: Record<string, FixtureDependencies>,
  workspaceVersions?: Record<string, string>
) {
  for (const [wsPath, deps] of Object.entries(workspaces)) {
    const wsDir = join(stageDir, wsPath);
    await mkdir(wsDir, {recursive: true});
    await writeFile(
      join(wsDir, 'package.json'),
      JSON.stringify(
        {
          name: `@npvd-fixture/${wsPath.split('/').pop()}`,
          version: workspaceVersions?.[wsPath] ?? '0.0.0',
          private: true,
          ...deps,
        },
        null,
        2
      ) + '\n'
    );
  }
}

async function generateNpmFixtures(dir: string, lockfileVersion: string) {
  const {before, after} = await prepareFixtureDirs(dir);
  const cmd = `npm install --package-lock-only --lockfile-version ${lockfileVersion} --no-audit --no-fund --silent`;
  await pexec(cmd, {cwd: before});
  await pexec(cmd, {cwd: after});
}

async function generatePnpmFixtures(
  dir: string,
  pnpmVersion: string,
  extraManifest?: Record<string, unknown>
) {
  const {before, after} = await prepareFixtureDirs(dir, extraManifest);
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
  await writeWorkspacePackages(stageDir, workspaces);
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
  await writeWorkspacePackages(stageDir, workspaces, workspaceVersions);
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

async function runYarnInstall(cwd: string, yarnVersion: string) {
  // Write empty yarn.lock so the fixture directory is recognized as standalone, not part of npvd.
  // Manually remove unneeded .yarn/install-state.gz after generating lock file.
  await writeFile(join(cwd, 'yarn.lock'), '');
  const cmd = `npx --yes @yarnpkg/cli-dist@${yarnVersion} install --mode=update-lockfile`;
  await pexec(cmd, {cwd, env: {...process.env, YARN_ENABLE_TELEMETRY: '0'}});
  await rm(join(cwd, '.yarn'), {recursive: true, force: true});
}

async function generateYarnFixtures(dir: string, yarnVersion: string) {
  const {before, after} = await prepareFixtureDirs(dir);
  await runYarnInstall(before, yarnVersion);
  await runYarnInstall(after, yarnVersion);
}

async function setupYarnWorkspaceStage(
  stageDir: string,
  workspaces: Record<string, FixtureDependencies>
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
  await writeWorkspacePackages(stageDir, workspaces);
}

async function generateYarnWorkspaceFixtures(dir: string, yarnVersion: string) {
  await rm(dir, {recursive: true, force: true});
  const before = join(dir, 'before');
  const after = join(dir, 'after');
  await setupYarnWorkspaceStage(before, workspaceDependencyVersions.before);
  await setupYarnWorkspaceStage(after, workspaceDependencyVersions.after);
  await runYarnInstall(before, yarnVersion);
  await runYarnInstall(after, yarnVersion);
}

process.stdout.write('Generating fixtures...');

await generateNpmFixtures(join(import.meta.dirname, 'npm-v2'), '2');
await generateNpmFixtures(join(import.meta.dirname, 'npm-v3'), '3');
await generatePnpmFixtures(join(import.meta.dirname, 'pnpm-v6'), PNPM_V6);
await generatePnpmFixtures(join(import.meta.dirname, 'pnpm-v9'), PNPM);
await generatePnpmFixtures(join(import.meta.dirname, 'pnpm-v11'), PNPM, pnpmV11Manifest);
await generatePnpmWorkspaceFixtures(join(import.meta.dirname, 'pnpm-workspaces'), PNPM);
await generateNpmWorkspaceFixtures(join(import.meta.dirname, 'npm-workspaces'));
await generateYarnFixtures(join(import.meta.dirname, 'yarn-berry'), YARN_BERRY);
await generateYarnWorkspaceFixtures(join(import.meta.dirname, 'yarn-berry-workspaces'), YARN_BERRY);

process.stdout.write(' done.\n');
