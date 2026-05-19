import { teardownAllFixtures } from "./test-data";

/**
 * Global teardown: runs once after all tests.
 * Removes test fixture data to leave TDB clean.
 *
 * Set KEEP_TEST_DATA=1 to skip teardown (useful for debugging).
 */
export default async function globalTeardown(): Promise<void> {
  if (process.env.KEEP_TEST_DATA === "1") {
    console.log("[global-teardown] KEEP_TEST_DATA=1 — skipping cleanup");
    return;
  }

  console.log("[global-teardown] Removing test fixtures...");
  await teardownAllFixtures();
  console.log("[global-teardown] Cleanup complete");
}
