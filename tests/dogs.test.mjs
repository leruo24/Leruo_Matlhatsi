import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { spriteHeading, NavGrid } from '../js/dogs.js';

test('sprite heading: 0 faces right, 2 faces away, 4 faces left, 6 faces the viewer', () => {
  // a dog straight ahead (0, 3): the line of sight is +y
  assert.equal(spriteHeading(0, 3, 0), 0);                 // facing +x: screen right
  assert.equal(spriteHeading(0, 3, Math.PI / 2), 2);       // facing +y: away
  assert.equal(spriteHeading(0, 3, Math.PI), 4);
  assert.equal(spriteHeading(0, 3, -Math.PI / 2), 6);      // facing the eye
  // off to the right (3, 0): line of sight is +x, so facing +x is "away"
  assert.equal(spriteHeading(3, 0, 0), 2);
  assert.equal(spriteHeading(-2, 2, -Math.PI / 4), 6);   // front-left, facing back toward the eye
});

function grid(rows) {
  const h = rows.length, w = rows[0].length;
  const bytes = Buffer.from(rows.join('').split('').map((c) => (c === '#' ? 255 : 100)));
  return new NavGrid({ x0: 0, y0: 0, cell: 1, w, h, data: bytes.toString('base64') }, 0);
}

test('nav grid: A* goes round a wall and the path is shortcut where the way is clear', () => {
  const g = grid(['.....', '.###.', '.....']);
  const p = g.path(0.5, 0.5, 4.5, 0.5);
  assert.ok(p && p.length >= 1);
  assert.deepEqual(p.at(-1), [4.5, 0.5]);
  const q = g.path(0.5, 1.5, 4.5, 1.5);                     // from one end of the wall to the other
  assert.ok(q.length >= 2, 'has to step round the wall');
  for (const [x, y] of q) assert.ok(g.isFree(x, y));
  assert.equal(g.path(0.5, 0.5, 2.5, 1.5), null, 'no path into a wall');
});

test('nav grid: blocked cells grow by the dog radius', () => {
  const rows = ['.......', '.......', '...#...', '.......', '.......'];
  const bytes = Buffer.from(rows.join('').split('').map((c) => (c === '#' ? 255 : 100)));
  const g = new NavGrid({ x0: 0, y0: 0, cell: 1, w: 7, h: 5, data: bytes.toString('base64') }, 1);
  assert.equal(g.isFree(3.5, 1.5), false); assert.equal(g.isFree(2.5, 2.5), false); assert.equal(g.isFree(1.5, 2.5), true); assert.equal(g.isFree(0.5, 2.5), false, 'the grid edge counts as a wall');
});

const navFile = new URL('../assets/workshop-3d/nav.json', import.meta.url);
test('the workshop floor: the dogs can walk from the desk to the yard and to the back of the room', { skip: !existsSync(navFile) }, () => {
  const g = new NavGrid(JSON.parse(readFileSync(navFile, 'utf8')));
  const desk = g.nearestFree(-2.0, 3.4), yard = g.nearestFree(-1.0, 7.0), back = g.nearestFree(-2.0, -2.5);
  assert.ok(desk && yard && back);
  assert.ok(g.path(...desk, ...yard), 'desk to yard');
  assert.ok(g.path(...desk, ...back), 'desk to the back wall');
  assert.equal(g.isFree(-0.2, 3.85), false, 'under the desk top is not walkable');
  assert.ok(Math.abs(g.groundAt(...desk)) < 0.05, 'the workshop floor is at floor level');
});
