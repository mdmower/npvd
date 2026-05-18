import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {diffPackages} from '../src/index.js';
import {dependencyVersions} from './fixtures/versions.js';
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
});
