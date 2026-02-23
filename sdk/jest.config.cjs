const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
};