module.exports = {
  root: true,
  env: {
    node: true,
    jest: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
    sourceType: "module",
  },
  // The existing backend predates lint configuration and has intentional
  // compatibility patterns (legacy `any` and CommonJS imports). Keep this
  // baseline parser check non-disruptive; stricter rules can be adopted
  // in a dedicated cleanup without blocking production verification.
  rules: {},
  ignorePatterns: ["dist/", "node_modules/", "coverage/"],
};
