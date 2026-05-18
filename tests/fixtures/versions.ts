export interface FixtureDependencies {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export const dependencyVersions: {before: FixtureDependencies; after: FixtureDependencies} = {
  before: {
    dependencies: {commander: '13.0.0', chalk: '5.3.0', dayjs: '1.11.20'},
    optionalDependencies: {picocolors: '1.0.0'},
    peerDependencies: {typescript: '5.5.4'},
  },
  after: {
    dependencies: {commander: '14.0.0', dayjs: '1.11.20', which: '5.0.0'},
    devDependencies: {prettier: '3.8.0'},
    optionalDependencies: {picocolors: '1.1.0'},
    peerDependencies: {typescript: '5.6.3'},
  },
};
