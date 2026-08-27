const { rmSync } = require("fs");
const { basename, dirname, resolve } = require("path");

const backendRoot = resolve(__dirname, "..");
const distPath = resolve(backendRoot, "dist");

if (dirname(distPath) !== backendRoot || basename(distPath) !== "dist") {
  throw new Error(
    "Refusing to clean anything except the backend dist directory",
  );
}

rmSync(distPath, { recursive: true, force: true });
