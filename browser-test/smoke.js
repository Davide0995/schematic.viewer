import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync } from 'fflate';
import { chromium } from 'playwright';
import { createServer } from 'vite';

function tag(type, name, payload) {
  const nameBytes = Buffer.from(name);
  const nameLength = Buffer.alloc(2);
  nameLength.writeUInt16BE(nameBytes.length);
  return Buffer.concat([Buffer.from([type]), nameLength, nameBytes, payload]);
}

function oneBlockSchematic() {
  const dimension = Buffer.from([0, 1]);
  const blocks = Buffer.from([0, 0, 0, 1, 1]);
  return Buffer.concat([
    Buffer.from([10, 0, 0]),
    tag(2, 'Width', dimension),
    tag(2, 'Height', dimension),
    tag(2, 'Length', dimension),
    tag(7, 'Blocks', blocks),
    Buffer.from([0]),
  ]);
}

test('loads a schematic and displays its dimensions', async (t) => {
  const server = await createServer({
    server: { host: '127.0.0.1', port: 0 },
    logLevel: 'error',
  });
  await server.listen();
  t.after(() => server.close());

  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  t.after(() => browser.close());

  const page = await browser.newPage();
  await page.route('**/default-textures.zip', (route) =>
    route.fulfill({ contentType: 'application/zip', body: Buffer.from(zipSync({})) }),
  );
  const address = server.httpServer.address();
  assert.ok(address && typeof address !== 'string');
  await page.goto(`http://127.0.0.1:${address.port}/schematic.viewer/`);
  await page.locator('#schematic-file').setInputFiles({
    name: 'one-block.schematic',
    mimeType: 'application/octet-stream',
    buffer: oneBlockSchematic(),
  });
  await page.locator('#info-panel').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#loading').waitFor({ state: 'hidden', timeout: 30000 });
  assert.match(await page.locator('#schematic-info').innerText(), /1 × 1 × 1/);
  assert.equal(await page.locator('#error-state').isHidden(), true);
  assert.equal(await page.locator('#rebuild-btn').isEnabled(), true);
});
