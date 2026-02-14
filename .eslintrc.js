module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
    node: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'commonjs'
  },
  rules: {
    // Critical Error Prevention
    'no-case-declarations': 'error',
    'no-dupe-keys': 'error',
    'no-control-regex': 'error',
    'no-prototype-builtins': 'error',
    'consistent-return': 'error',
    'no-param-reassign': 'error',
    'no-shadow': 'error',
    
    // Code Style Standards
    'indent': ['error', 2],
    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    'no-console': ['warn'],
    'prefer-const': ['error'],
    'no-var': ['error'],
    'eqeqeq': ['error', 'always'],
    'no-implicit-globals': ['error'],
    'no-use-before-define': ['error', { functions: false, classes: true }],
    'curly': ['error', 'all'],
    'dot-notation': ['error'],
    'no-else-return': ['error'],
    'no-empty-function': ['warn'],
    'no-eval': ['error'],
    'no-implied-eval': ['error'],
    'no-new': ['warn'],
    'no-return-assign': ['error'],
    'no-script-url': ['error'],
    'no-self-compare': ['error'],
    'no-throw-literal': ['error'],
    'no-useless-concat': ['error'],
    'radix': ['error'],
    'yoda': ['error'],
    'no-duplicate-imports': ['error'],
    'no-useless-constructor': ['error'],
    'object-shorthand': ['error'],
    'prefer-arrow-callback': ['error'],
    'prefer-template': ['error'],
    
    // Code Formatting
    'array-bracket-spacing': ['error', 'never'],
    'block-spacing': ['error'],
    'brace-style': ['error', '1tbs'],
    'comma-dangle': ['error', 'never'],
    'comma-spacing': ['error'],
    'comma-style': ['error'],
    'computed-property-spacing': ['error'],
    'eol-last': ['error'],
    'func-call-spacing': ['error'],
    'key-spacing': ['error'],
    'keyword-spacing': ['error'],
    'newline-per-chained-call': ['error', { ignoreChainWithDepth: 3 }],
    'no-multiple-empty-lines': ['error', { max: 2 }],
    'no-trailing-spaces': ['error'],
    'object-curly-spacing': ['error', 'always'],
    'padded-blocks': ['error', 'never'],
    'space-before-blocks': ['error'],
    'space-before-function-paren': ['error', 'never'],
    'space-in-parens': ['error'],
    'space-infix-ops': ['error'],
    'space-unary-ops': ['error'],
    
    // Security Rules
    'no-new-func': ['error'],
    'no-debugger': ['error'],
    'no-alert': ['error'],
    
    // Complexity Management
    'complexity': ['warn', 15],
    'max-depth': ['warn', 4],
    'max-lines': ['warn', 1000],
    'max-lines-per-function': ['warn', 100],
    'max-params': ['warn', 6]
  },
  globals: {
    'require': 'readonly',
    'module': 'readonly',
    'process': 'readonly',
    '__dirname': 'readonly',
    '__filename': 'readonly'
  },
  overrides: [
    {
      files: ['tests/**/*.js', '**/*.test.js', '**/*.spec.js'],
      rules: {
        'no-console': 'off',
        'max-lines-per-function': 'off',
        'max-lines': 'off',
        'prefer-arrow-callback': 'off'
      }
    }
  ]
};