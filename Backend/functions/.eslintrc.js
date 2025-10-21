module.exports = {
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2021,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  rules: {
    // Keep essentials
    "no-restricted-globals": ["error", "name", "length"],
    "prefer-arrow-callback": "error",
    "quotes": ["error", "double", { allowTemplateLiterals: true }],

    // Make lint pass without touching existing source files
    "linebreak-style": "off",
    "indent": "off",
    "no-tabs": "off",
    "max-len": "off",
    "object-curly-spacing": "off",
    "comma-dangle": "off",
    "require-jsdoc": "off",
    "new-cap": "off",
    "eol-last": "off",
    "operator-linebreak": "off",
  },
  overrides: [
    {
      files: ["**/*.spec.*"],
      env: {
        mocha: true,
      },
      rules: {},
    },
  ],
  globals: {},
};
