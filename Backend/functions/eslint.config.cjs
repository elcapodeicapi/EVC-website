// ESLint flat config (ESLint 9+). Replaces the old .eslintrc.js.
// eslint-config-google was dropped: it depends on rules that no longer exist in ESLint 9+
// (valid-jsdoc, require-jsdoc), and its formatting rules were already switched off here.
const js = require("@eslint/js");
const globals = require("globals");

const sharedRules = {
  "no-restricted-globals": ["error", "name", "length"],
  "prefer-arrow-callback": "error",
  // `catch (_) {}` is used on purpose throughout the code base (ESLint 8 did not flag it).
  "no-unused-vars": ["error", { caughtErrors: "none" }],
};

module.exports = [
  {
    ignores: ["node_modules/**", "uploads/**"],
  },
  {
    // Older eslint-disable comments for rules that are no longer enabled.
    linterOptions: { reportUnusedDisableDirectives: "off" },
  },
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: sharedRules,
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: sharedRules,
  },
  {
    files: ["**/*.spec.*"],
    languageOptions: {
      globals: { ...globals.mocha },
    },
  },
];
