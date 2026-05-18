import {readFileSync} from 'node:fs';
import {isNpmLockFile} from '../src/utils.js';
import {lockFilePath} from './utils/utils.js';

function loadLock(set: 'npm-v2' | 'npm-v3', variant: 'before' | 'after'): unknown {
  return JSON.parse(readFileSync(lockFilePath(set, variant), 'utf-8')) as unknown;
}

describe('isNpmLockFile', () => {
  it('accepts npm v2 lock file', () => {
    expect(isNpmLockFile(loadLock('npm-v2', 'before'))).toBe(true);
    expect(isNpmLockFile(loadLock('npm-v2', 'after'))).toBe(true);
  });

  it('accepts npm v3 lock file', () => {
    expect(isNpmLockFile(loadLock('npm-v3', 'before'))).toBe(true);
    expect(isNpmLockFile(loadLock('npm-v3', 'after'))).toBe(true);
  });

  it('rejects a v1 lockfile', () => {
    const v1Lockfile = {
      name: 'fixture',
      version: '0.0.0',
      lockfileVersion: 1,
      requires: true,
      dependencies: {
        chalk: {
          version: '5.3.0',
          resolved: 'https://registry.npmjs.org/chalk/-/chalk-5.3.0.tgz',
          integrity: 'sha512-fake',
        },
      },
    };
    expect(isNpmLockFile(v1Lockfile)).toBe(false);
  });

  it('rejects a package.json document', () => {
    const packageJson = {
      name: 'fixture',
      version: '0.0.0',
      dependencies: {commander: '^14.0.0'},
    };
    expect(isNpmLockFile(packageJson)).toBe(false);
  });
});
