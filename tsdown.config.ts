import {defineConfig} from 'tsdown';

export default defineConfig((options) => {
  const dev = options.env?.dev === 'true';
  const entry = ['src/index.ts', 'src/cli.ts'];

  return {
    entry,
    outDir: 'dist',
    dts: true,
    clean: true,
    format: ['cjs', 'esm'],
    sourcemap: dev,
  };
});
