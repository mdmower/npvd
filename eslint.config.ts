import {defineConfig} from 'eslint/config';
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import vitest from '@vitest/eslint-plugin';
import prettierConfigRecommended from 'eslint-plugin-prettier/recommended';

export default defineConfig(
  {
    ignores: ['dist/'],
  },
  eslint.configs.recommended,
  {
    files: ['**/*.[jt]s'],
    languageOptions: {ecmaVersion: 2023},
    rules: {
      'no-undef': 'error',
      'no-var': 'error',
    },
  },
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ['tsup.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        sourceType: 'module',
        projectService: {
          allowDefaultProject: ['*.config.ts'],
        },
      },
    },
    rules: {
      '@typescript-eslint/no-inferrable-types': 'off',
    },
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: {...globals.node},
    },
  },
  {
    files: ['tests/**/*.ts'],
    ...vitest.configs.recommended,
  },
  prettierConfigRecommended
);
