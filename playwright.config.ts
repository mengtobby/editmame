import { defineConfig } from "@playwright/test";

const PORT = 5183;
const SIGNALING_PORT = 8799;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    // Override via PLAYWRIGHT_EXECUTABLE_PATH if this environment can't download the bundled
    // browser (a sandboxed CI runner, for instance) and needs to point at a system Chrome/Edge.
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {},
  },
  webServer: [
    {
      command: "npx tsx server/signaling-server.ts",
      port: SIGNALING_PORT,
      env: { PORT: String(SIGNALING_PORT) },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npx vite --port ${PORT} --strictPort`,
      port: PORT,
      env: { VITE_SIGNALING_URL: `ws://localhost:${SIGNALING_PORT}` },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
