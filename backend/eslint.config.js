import js from '@eslint/js'
import globals from 'globals'
import sonarjs from 'eslint-plugin-sonarjs'

export default [
  {
    ignores: ['node_modules/**', 'coverage/**', 'test-*.js', 'init-db.js'],
  },
  js.configs.recommended,
  sonarjs.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2024,
      },
    },
    rules: {
      'no-console': 'off',
      'no-empty': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^[A-Z_]', caughtErrorsIgnorePattern: '^_' }],
      'sonarjs/cognitive-complexity': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/sql-queries': 'error',
      'sonarjs/no-hardcoded-ip': 'warn',
      'sonarjs/no-ignored-exceptions': 'off',
      'sonarjs/pseudo-random': 'warn',
      'sonarjs/super-linear-regex': 'warn',
      'sonarjs/slow-regex': 'warn',
      'sonarjs/no-dead-store': 'warn',
    },
  },
]
