import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {diffPackages} from '../src/index.js';
import {dependencyVersions, workspaceDependencyVersions} from './fixtures/versions.js';
import {lockFilePath} from './utils/utils.js';
import {DependencyType} from '../src/options.js';

const [directVersionsBefore, directVersionsAfter] = (['before', 'after'] as const).map((stage) => ({
  ...dependencyVersions[stage].dependencies,
  ...dependencyVersions[stage].devDependencies,
  ...dependencyVersions[stage].optionalDependencies,
  ...dependencyVersions[stage].peerDependencies,
}));
const directNames = [...Object.keys(directVersionsBefore), ...Object.keys(directVersionsAfter)];

const expectedDependencyChanges = [...new Set(directNames)]
  .filter((name) => directVersionsBefore[name] !== directVersionsAfter[name])
  .map((name) => ({
    path: [name],
    name,
    version: {
      from: directVersionsBefore[name],
      to: directVersionsAfter[name],
    },
  }));

describe('diffPackages', () => {
  describe("mode: 'npm'", () => {
    const before = lockFilePath('npm-v3', 'before');
    const after = lockFilePath('npm-v3', 'after');

    it('detects changes between npm lock files', async () => {
      const diff = await diffPackages(before, after, {mode: 'npm'});
      expect(diff).toEqual(expect.arrayContaining(expectedDependencyChanges));
    });

    it('returns no changes for identical lock files', async () => {
      const diff = await diffPackages(before, before, {mode: 'npm'});
      expect(diff).toEqual([]);
    });

    it('supports directOnly', async () => {
      const full = await diffPackages(before, after, {mode: 'npm'});
      const direct = await diffPackages(before, after, {mode: 'npm', directOnly: true});

      expect(full.map(({name}) => name)).toContain('isexe');
      expect(direct.map(({name}) => name)).not.toContain('isexe');
      expect(direct.map(({name}) => name)).toContain('which');
    });

    it.each<{include: DependencyType[]; expected: string[]}>([
      {
        include: ['prod'],
        expected: ['chalk', 'commander', 'isexe', 'which'],
      },
      {
        include: ['dev'],
        expected: ['prettier'],
      },
      {
        include: ['optional'],
        expected: ['picocolors'],
      },
      {
        include: ['peer'],
        expected: ['typescript'],
      },
      {
        include: ['prod', 'dev'],
        expected: ['chalk', 'commander', 'isexe', 'prettier', 'which'],
      },
    ])('supports include: $include', async ({include, expected}) => {
      const diff = await diffPackages(before, after, {mode: 'npm', include});
      const names = diff.map(({name}) => name).sort();
      expect(names).toEqual(expected.toSorted());
    });

    it.each<{omit: Exclude<DependencyType, 'prod'>[]; expected: string[]}>([
      {
        omit: ['dev'],
        expected: ['chalk', 'commander', 'isexe', 'picocolors', 'typescript', 'which'],
      },
      {
        omit: ['optional'],
        expected: ['chalk', 'commander', 'isexe', 'prettier', 'typescript', 'which'],
      },
      {
        omit: ['peer'],
        expected: ['chalk', 'commander', 'isexe', 'picocolors', 'prettier', 'which'],
      },
      {
        omit: ['dev', 'optional', 'peer'],
        expected: ['chalk', 'commander', 'isexe', 'which'],
      },
    ])('supports omit: $omit', async ({omit, expected}) => {
      const diff = await diffPackages(before, after, {mode: 'npm', omit});
      const names = diff.map(({name}) => name).sort();
      expect(names).toEqual(expected.toSorted());
    });

    it('rejects unsupported lock files', async () => {
      const tmp = await mkdtemp(join(tmpdir(), 'npvd-test-'));
      try {
        const badPath = join(tmp, 'package-lock.json');
        await writeFile(badPath, JSON.stringify({lockfileVersion: 1, dependencies: {}}), 'utf-8');
        const diffPromise = diffPackages(badPath, badPath, {mode: 'npm'});
        await expect(diffPromise).rejects.toThrow(/supported v2 or v3 NPM lock file/);
      } finally {
        await rm(tmp, {recursive: true, force: true});
      }
    });

    describe('workspaces', () => {
      const beforeWorkspace = lockFilePath('npm-workspaces', 'before');
      const afterWorkspace = lockFilePath('npm-workspaces', 'after');

      it('does not surface workspace packages as dependencies', async () => {
        const diff = await diffPackages(beforeWorkspace, afterWorkspace, {mode: 'npm'});
        const names = diff.map(({name}) => name);
        expect(names).not.toContain('packages/a');
        expect(names).not.toContain('packages/b');
      });

      it('detects dependency changes within workspaces', async () => {
        const diff = await diffPackages(beforeWorkspace, afterWorkspace, {mode: 'npm'});
        const names = diff.map(({name}) => name);
        expect(names).toContain('commander');
      });
    });
  });

  describe("mode: 'pnpm'", () => {
    const beforeV6 = lockFilePath('pnpm-v6', 'before');
    const afterV6 = lockFilePath('pnpm-v6', 'after');
    const beforeV9 = lockFilePath('pnpm-v9', 'before');
    const afterV9 = lockFilePath('pnpm-v9', 'after');

    it('detects changes between pnpm v9 lock files', async () => {
      const diff = await diffPackages(beforeV9, afterV9, {mode: 'pnpm'});
      expect(diff).toEqual(expect.arrayContaining(expectedDependencyChanges));
    });

    it('detects changes between pnpm v6 lock files', async () => {
      const diff = await diffPackages(beforeV6, afterV6, {mode: 'pnpm'});
      expect(diff).toEqual(expect.arrayContaining(expectedDependencyChanges));
    });

    it('supports cross-version v6 -> v9 diffs', async () => {
      const diff = await diffPackages(beforeV6, afterV9, {mode: 'pnpm'});
      expect(diff).toEqual(expect.arrayContaining(expectedDependencyChanges));
    });

    it('supports directOnly', async () => {
      const full = await diffPackages(beforeV9, afterV9, {mode: 'pnpm'});
      const direct = await diffPackages(beforeV9, afterV9, {mode: 'pnpm', directOnly: true});

      expect(full.map(({name}) => name)).toContain('isexe');
      expect(direct.map(({name}) => name)).not.toContain('isexe');
      expect(direct.map(({name}) => name)).toContain('which');
    });

    describe('workspaces', () => {
      const beforeWorkspace = lockFilePath('pnpm-workspaces', 'before');
      const afterWorkspace = lockFilePath('pnpm-workspaces', 'after');

      const expectedWorkspaceChanges = [
        ...new Set([
          ...Object.keys(workspaceDependencyVersions.before),
          ...Object.keys(workspaceDependencyVersions.after),
        ]),
      ].flatMap((workspace) => {
        const [before, after] = (['before', 'after'] as const).map((stage) => ({
          ...workspaceDependencyVersions[stage][workspace]?.dependencies,
          ...workspaceDependencyVersions[stage][workspace]?.devDependencies,
          ...workspaceDependencyVersions[stage][workspace]?.optionalDependencies,
          ...workspaceDependencyVersions[stage][workspace]?.peerDependencies,
        }));
        return [...new Set([...Object.keys(before), ...Object.keys(after)])]
          .filter((name) => before[name] !== after[name])
          .map((name) => ({
            path: [workspace, name],
            name,
            version: {from: before[name], to: after[name]},
          }));
      });

      it('does not collapse paths across importers with the same dependencies at different versions', async () => {
        const diff = await diffPackages(beforeWorkspace, beforeWorkspace, {mode: 'pnpm'});
        expect(diff).toEqual([]);
      });

      it('reports per-importer changes with importer-prefixed paths', async () => {
        const diff = await diffPackages(beforeWorkspace, afterWorkspace, {mode: 'pnpm'});
        expect(diff).toEqual(expect.arrayContaining(expectedWorkspaceChanges));
      });
    });

    // PNPM handles peer dependencies a prod dependencies
    it.each<{include: DependencyType[]; expected: string[]}>([
      {
        include: ['prod'],
        expected: ['chalk', 'commander', 'isexe', 'typescript', 'which'],
      },
      {
        include: ['dev'],
        expected: ['prettier'],
      },
      {
        include: ['optional'],
        expected: ['picocolors'],
      },
      {
        include: ['peer'],
        expected: [],
      },
      {
        include: ['prod', 'dev'],
        expected: ['chalk', 'commander', 'isexe', 'prettier', 'typescript', 'which'],
      },
    ])('supports include: $include', async ({include, expected}) => {
      const diff = await diffPackages(beforeV9, afterV9, {mode: 'pnpm', include});
      const names = diff.map(({name}) => name).sort();
      expect(names).toEqual(expected.toSorted());
    });

    it.each<{omit: Exclude<DependencyType, 'prod'>[]; expected: string[]}>([
      {
        omit: ['dev'],
        expected: ['chalk', 'commander', 'isexe', 'picocolors', 'typescript', 'which'],
      },
      {
        omit: ['optional'],
        expected: ['chalk', 'commander', 'isexe', 'prettier', 'typescript', 'which'],
      },
      {
        omit: ['peer'],
        expected: ['chalk', 'commander', 'isexe', 'picocolors', 'prettier', 'typescript', 'which'],
      },
      {
        omit: ['dev', 'optional', 'peer'],
        expected: ['chalk', 'commander', 'isexe', 'typescript', 'which'],
      },
    ])('supports omit: $omit', async ({omit, expected}) => {
      const diff = await diffPackages(beforeV9, afterV9, {mode: 'pnpm', omit});
      const names = diff.map(({name}) => name).sort();
      expect(names).toEqual(expected.toSorted());
    });
  });

  describe("mode: 'yarn'", () => {
    const before = lockFilePath('yarn-berry', 'before');
    const after = lockFilePath('yarn-berry', 'after');

    // Yarn berry's lock file does not retain peer-only dependencies (they're not installed),
    // so peer-only direct deps are excluded from expectations.
    const [yarnVersionsBefore, yarnVersionsAfter] = (['before', 'after'] as const).map((stage) => ({
      ...dependencyVersions[stage].dependencies,
      ...dependencyVersions[stage].devDependencies,
      ...dependencyVersions[stage].optionalDependencies,
    }));
    const expectedYarnChanges = [
      ...new Set([...Object.keys(yarnVersionsBefore), ...Object.keys(yarnVersionsAfter)]),
    ]
      .filter((name) => yarnVersionsBefore[name] !== yarnVersionsAfter[name])
      .map((name) => ({
        path: [name],
        name,
        version: {from: yarnVersionsBefore[name], to: yarnVersionsAfter[name]},
      }));

    it('detects changes between yarn berry lock files', async () => {
      const diff = await diffPackages(before, after, {mode: 'yarn'});
      expect(diff).toEqual(expect.arrayContaining(expectedYarnChanges));
    });

    it('returns no changes for identical lock files', async () => {
      const diff = await diffPackages(before, before, {mode: 'yarn'});
      expect(diff).toEqual([]);
    });

    it('does not surface peer-only dependencies', async () => {
      const diff = await diffPackages(before, after, {mode: 'yarn'});
      expect(diff.map(({name}) => name)).not.toContain('typescript');
    });

    it('supports directOnly', async () => {
      const full = await diffPackages(before, after, {mode: 'yarn'});
      const direct = await diffPackages(before, after, {mode: 'yarn', directOnly: true});

      expect(full.map(({name}) => name)).toContain('isexe');
      expect(direct.map(({name}) => name)).not.toContain('isexe');
      expect(direct.map(({name}) => name)).toContain('which');
    });

    describe('workspaces', () => {
      const beforeWorkspace = lockFilePath('yarn-berry-workspaces', 'before');
      const afterWorkspace = lockFilePath('yarn-berry-workspaces', 'after');

      const expectedWorkspaceChanges = [
        ...new Set([
          ...Object.keys(workspaceDependencyVersions.before),
          ...Object.keys(workspaceDependencyVersions.after),
        ]),
      ].flatMap((workspace) => {
        const [before, after] = (['before', 'after'] as const).map((stage) => ({
          ...workspaceDependencyVersions[stage][workspace]?.dependencies,
          ...workspaceDependencyVersions[stage][workspace]?.devDependencies,
          ...workspaceDependencyVersions[stage][workspace]?.optionalDependencies,
        }));
        return [...new Set([...Object.keys(before), ...Object.keys(after)])]
          .filter((name) => before[name] !== after[name])
          .map((name) => ({
            path: [workspace, name],
            name,
            version: {from: before[name], to: after[name]},
          }));
      });

      it('does not collapse paths across importers with the same dependencies at different versions', async () => {
        const diff = await diffPackages(beforeWorkspace, beforeWorkspace, {mode: 'yarn'});
        expect(diff).toEqual([]);
      });

      it('reports per-importer changes with importer-prefixed paths', async () => {
        const diff = await diffPackages(beforeWorkspace, afterWorkspace, {mode: 'yarn'});
        expect(diff).toEqual(expect.arrayContaining(expectedWorkspaceChanges));
      });
    });

    // Yarn berry's lock file merges devDependencies into dependencies, so prod and dev are
    // indistinguishable; --include dev behaves the same as --include prod. Peer-only deps
    // aren't installed, so --include peer returns nothing.
    it.each<{include: DependencyType[]; expected: string[]}>([
      {
        include: ['prod'],
        expected: ['chalk', 'commander', 'isexe', 'prettier', 'which'],
      },
      {
        include: ['dev'],
        expected: ['chalk', 'commander', 'isexe', 'prettier', 'which'],
      },
      {
        include: ['optional'],
        expected: ['picocolors'],
      },
      {
        include: ['peer'],
        expected: [],
      },
      {
        include: ['prod', 'dev'],
        expected: ['chalk', 'commander', 'isexe', 'prettier', 'which'],
      },
    ])('supports include: $include', async ({include, expected}) => {
      const diff = await diffPackages(before, after, {mode: 'yarn', include});
      const names = diff.map(({name}) => name).sort();
      expect(names).toEqual(expected.toSorted());
    });

    it.each<{omit: Exclude<DependencyType, 'prod'>[]; expected: string[]}>([
      {
        omit: ['dev'],
        expected: ['chalk', 'commander', 'isexe', 'picocolors', 'prettier', 'which'],
      },
      {
        omit: ['optional'],
        expected: ['chalk', 'commander', 'isexe', 'prettier', 'which'],
      },
      {
        omit: ['peer'],
        expected: ['chalk', 'commander', 'isexe', 'picocolors', 'prettier', 'which'],
      },
      {
        omit: ['dev', 'optional', 'peer'],
        expected: ['chalk', 'commander', 'isexe', 'prettier', 'which'],
      },
    ])('supports omit: $omit', async ({omit, expected}) => {
      const diff = await diffPackages(before, after, {mode: 'yarn', omit});
      const names = diff.map(({name}) => name).sort();
      expect(names).toEqual(expected.toSorted());
    });
  });
});
