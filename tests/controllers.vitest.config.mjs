// Vitest configuration for the memory-controller suites, used by
// .github/workflows/test-controllers.yml.
//
// Deliberately has no imports: the job runs vitest from the agentic-flow
// package's node_modules against the repository root, where vitest would
// otherwise auto-load the root vite.config.ts and fail with
// "Cannot find package 'vite'" because root dependencies are not installed.
// A plain object resolves regardless of which node_modules is present.
export default {
  test: {
    include: [
      'tests/unit/controllers/**/*.test.ts',
      'tests/integration/controllers/**/*.test.ts',
    ],
    environment: 'node',
  },
};
