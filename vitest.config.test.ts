import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "node",
    // Load .env.test before any test file runs
    setupFiles: ["tests/helpers/setup.ts"],
    // Run test files sequentially to avoid DB race conditions
    pool: "forks",
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/lib/**", "src/app/api/**"],
      exclude: ["src/app/api/auth/route.ts"],
    },
    // Timeouts — DB operations can be slow
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
