import js from '@eslint/js';
import globals from 'globals';
import sonarjs from 'eslint-plugin-sonarjs';
import { importX } from 'eslint-plugin-import-x';

/**
 * Tiered Clean Code ESLint 9 flat configuration for @madpolaris/truthsrc.
 *
 * Tier 1 (Strict Clean Code Gate):
 *   Active curated emitter, layout strategy, value-object routing, and lint tooling.
 *   Enforces Clean Code readability, complexity ceilings, import hygiene, and zero dead code.
 *
 * Tier 2 (Baseline Correctness Gate):
 *   Remaining library, generator, CLI, and test modules across the repository.
 *   Enforces hard correctness errors while surfacing Clean Code complexity debt as warnings.
 */
export default [
  {
    ignores: [
      'node_modules/**',
      '.git/**',
      '.rounds/**',
      '.truthsrc/**',
      'target/**',
      'cache/**',
      'docs/**',
      'scaffold/**',
      'test/reference/**',
      'generators/_deprecated/**',
      'lib/workshop/client.js',
    ],
  },

  // Base configuration across all JS/MJS files (Tier 2: Baseline Correctness)
  {
    files: ['**/*.mjs', '**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      sonarjs,
      'import-x': importX,
    },
    rules: {
      // Hard correctness errors everywhere
      'no-const-assign': 'error',
      'no-debugger': 'error',
      'no-dupe-args': 'error',
      'no-dupe-class-members': 'error',
      'no-dupe-else-if': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-func-assign': 'error',
      'no-import-assign': 'error',
      'no-obj-calls': 'error',
      'no-self-assign': 'error',
      'no-self-compare': 'error',
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-unsafe-finally': 'error',
      'no-unsafe-negation': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',

      // Import hygiene (hard errors everywhere)
      'import-x/no-duplicates': 'error',
      'import-x/no-self-import': 'error',
    },
  },

  // Tier 1: Strict Clean Code Gate on active emitter, layout, and routing modules
  {
    files: [
      'emitter/**/*.mjs',
      'lib/layout/**/*.mjs',
      'lib/derivation/value-object-package.mjs',
      'tools/lint.mjs',
      'eslint.config.mjs',
    ],
    rules: {
      ...js.configs.recommended.rules,

      // Clean Code: Variables & Declarations
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-shadow-restricted-names': 'error',

      // Clean Code: Expressions & Control Flow
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'curly': ['error', 'multi-line'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-nested-ternary': 'error',
      'no-unneeded-ternary': 'error',
      'no-useless-return': 'error',
      'no-else-return': ['warn', { allowElseIf: false }],
      'object-shorthand': ['warn', 'always'],
      'prefer-template': 'off', // emitters intentionally mix string concat & template literals

      // Clean Code: Complexity & Modularity (error on extreme, warn on refactor candidates)
      'max-depth': ['warn', 4],
      'max-params': ['warn', 5],
      'complexity': ['warn', 20],
      'sonarjs/cognitive-complexity': ['warn', 20],
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-duplicated-branches': 'error',
      'sonarjs/no-all-duplicated-branches': 'error',
      'sonarjs/no-identical-expressions': 'error',
      'sonarjs/no-redundant-boolean': 'error',
      'sonarjs/no-collapsible-if': 'warn',
      'sonarjs/no-gratuitous-expressions': 'error',

      // Clean Code: Module Boundaries
      'import-x/no-duplicates': 'error',
      'import-x/no-self-import': 'error',
      'import-x/no-cycle': ['error', { maxDepth: 4 }],
      'import-x/first': 'error',
      'import-x/newline-after-import': 'error',

      // Library modules must not pollute stdout with console.log
      'no-console': 'error',
    },
  },

  // Allow console output in CLI/harness scripts under emitter/ and tools/
  {
    files: [
      'emitter/parity.mjs',
      'tools/lint.mjs',
    ],
    rules: {
      'no-console': 'off',
    },
  },
];
