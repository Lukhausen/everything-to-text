import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  { ignores: ['dist', 'public/pdfjs/**'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/jsx-no-target-blank': 'off',
      // PropTypes is deprecated in React 19; this project never adopted it
      // and runtime type checking is moving to TS-style typing instead.
      'react/prop-types': 'off',
      // Demote unused-var noise to warnings so legitimate breakage isn't
      // hidden by stylistic noise. `_`-prefixed args are intentionally
      // ignored.
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-useless-escape': 'warn',
      'no-case-declarations': 'warn',
      'react/no-unescaped-entities': 'warn',
      'react/display-name': 'warn',
      'react/jsx-no-comment-textnodes': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  // The Vite config runs in Node, not the browser. Provide Node globals so
  // `process`, `Buffer`, `__dirname`, etc. resolve correctly when linting.
  {
    files: ['vite.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.node,
      sourceType: 'module',
    },
  },
];
