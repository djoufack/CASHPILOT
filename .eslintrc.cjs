module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    // Security rules
    'no-eval': 'warn',
    'no-implied-eval': 'warn',
    'no-new-func': 'warn',

    // React rules (warnings to not break existing workflow)
    'react/prop-types': 'warn',
    'react/no-unescaped-entities': 'warn',
    'react/display-name': 'warn',
    'react/react-in-jsx-scope': 'off', // Not needed in React 17+

    // General rules
    'no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      destructuredArrayIgnorePattern: '^_',
    }],
    'no-console': ['warn', { allow: ['error', 'warn'] }],
    'no-undef': 'warn',
  },
  ignorePatterns: ['node_modules/', 'dist/', 'build/', '.claude/'],
};
