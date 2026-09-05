import { expect, test } from "@playwright/test";

/**
 * End-to-end check that two independent browser contexts (simulating two different users) can
 * find each other through the signaling server and complete a real WebRTC handshake — not a
 * mock. Each context gets its own storage/cookies, matching two separate people on two separate
 * machines more closely than two tabs in the same context would.
 */
test("two peers in the same room connect to each other over WebRTC", async ({ browser }) => {
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();

  await pageA.goto("/");
  await expect(pageA.getByTitle("LoomP2P")).toBeVisible();

  const roomUrl = pageA.url();

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await pageB.goto(roomUrl);
  await expect(pageB.getByTitle("LoomP2P")).toBeVisible();

  await expect(pageA.getByTestId("connection-status")).toHaveText("Connected", { timeout: 15_000 });
  await expect(pageA.locator("header").getByTestId("peer-avatar")).toHaveCount(2, { timeout: 15_000 }); // you + the other peer
  await expect(pageB.getByTestId("connection-status")).toHaveText("Connected", { timeout: 15_000 });
  await expect(pageB.locator("header").getByTestId("peer-avatar")).toHaveCount(2, { timeout: 15_000 });

  // Each side's network panel should list the *other* peer, not itself twice.
  const peerIdA = await pageA.locator("aside").getByText(/^[0-9a-f]{6}$/).last().innerText();
  const peerIdB = await pageB.locator("aside").getByText(/^[0-9a-f]{6}$/).last().innerText();
  expect(peerIdA).not.toBe(peerIdB);

  await contextA.close();
  await contextB.close();
});

test("adding a track in one tab syncs to the other via the CRDT", async ({ browser }) => {
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await pageA.goto("/");

  const roomUrl = pageA.url();
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await pageB.goto(roomUrl);

  // "Connected" alone only means the signaling socket is open; wait for an actual peer too,
  // otherwise a CRDT update sent before the data channel exists would never arrive.
  await expect(pageA.locator("header").getByTestId("peer-avatar")).toHaveCount(2, { timeout: 15_000 });
  await expect(pageB.locator("header").getByTestId("peer-avatar")).toHaveCount(2, { timeout: 15_000 });

  await pageA.getByRole("button", { name: "Video track" }).click();
  await expect(pageA.getByText("V1", { exact: true })).toBeVisible();
  await expect(pageB.getByText("V1", { exact: true })).toBeVisible({ timeout: 5_000 });

  await contextA.close();
  await contextB.close();
});
