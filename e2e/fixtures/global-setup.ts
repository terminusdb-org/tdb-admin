import { setupAllFixtures } from "./test-data";
import { getApiBaseUrl } from "./auth";

/**
 * Global setup: runs once before all tests.
 * Creates test fixture data via TDB REST API.
 */
export default async function globalSetup(): Promise<void> {
  const baseUrl = getApiBaseUrl();
  console.log(`[global-setup] Target: ${baseUrl}`);

  // Verify TDB is reachable before creating fixtures
  try {
    const res = await fetch(`${baseUrl}/api/info`, { timeout: 5000 } as RequestInit);
    if (!res.ok) {
      throw new Error(`TDB not reachable: ${res.status}`);
    }
    console.log("[global-setup] TDB is reachable");
  } catch (err) {
    console.error(`[global-setup] Cannot reach TDB at ${baseUrl}. Is the container running?`);
    console.error(err);
    throw new Error(
      `E2E setup failed: TDB not reachable at ${baseUrl}. ` +
      "Start the container with: docker run -p 6363:6363 dfrntcr.azurecr.io/twinfoxdb:dev"
    );
  }

  console.log("[global-setup] Creating test fixtures...");
  await setupAllFixtures();
  console.log("[global-setup] Fixtures created successfully");
}
