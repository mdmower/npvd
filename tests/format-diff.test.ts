import {DiffResult, formatDiff} from '../src/index.js';

const changes: DiffResult[] = [
  {path: ['foo'], name: 'foo', version: {from: '1.0.0', to: '2.0.0'}},
  {path: ['parent', 'bar'], name: 'bar', version: {from: undefined, to: '1.0.0'}},
  {path: ['baz'], name: 'baz', version: {from: '3.0.0', to: undefined}},
];

const expectedParsed = [
  {path: ['foo'], name: 'foo', version: {from: '1.0.0', to: '2.0.0'}},
  {path: ['parent', 'bar'], name: 'bar', version: {to: '1.0.0'}},
  {path: ['baz'], name: 'baz', version: {from: '3.0.0'}},
];

describe('formatDiff', () => {
  it('supports text formatted output', async () => {
    expect(await formatDiff(changes, 'text')).toBe(
      [
        'foo: 1.0.0 -> 2.0.0',
        'bar [parent > bar]: (added) -> 1.0.0',
        'baz: 3.0.0 -> (removed)',
      ].join('\n')
    );
  });

  it('supports csv formatted output', async () => {
    expect(await formatDiff(changes, 'csv')).toBe(
      [
        'name,path,from version,to version',
        'foo,foo,1.0.0,2.0.0',
        'bar,parent > bar,,1.0.0',
        'baz,baz,3.0.0,',
        '',
      ].join('\n')
    );
  });

  it('supports json formatted output', async () => {
    const result = await formatDiff(changes, 'json');
    expect(result).not.toContain('\n');
    expect(JSON.parse(result)).toEqual(expectedParsed);
  });

  it('supports indented json via jsonSpaces', async () => {
    const result = await formatDiff(changes, 'json', {jsonSpaces: 2});
    expect(result).toMatch(/^\[\n {2}/);
    expect(JSON.parse(result)).toEqual(expectedParsed);
  });
});
