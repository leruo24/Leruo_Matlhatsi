import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

test('the 3D farm is the home page, with 360, Walk and Fly views', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const m of ['hd', 'walk', 'fly']) assert.ok(html.includes(`data-mode="${m}"`), m);
  assert.ok(html.includes('href="photo.html"'), 'small link to the photo version');
  const old = readFileSync(new URL('../look-around.html', import.meta.url), 'utf8');
  assert.match(old, /location\.replace\('\.\/'/, 'old address forwards to the home page');
});

test('the walk/fly model exists, is compressed and stays under 15 MB', () => {
  const f = new URL('../assets/world/farm.glb', import.meta.url);
  const size = statSync(f).size;
  assert.ok(size > 1e6 && size < 15e6, `farm.glb is ${(size / 1e6).toFixed(1)} MB`);
  const buf = readFileSync(f);
  const json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString());
  assert.ok(json.extensionsUsed.includes('EXT_meshopt_compression'));
});
