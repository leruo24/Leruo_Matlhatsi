// Resolve the bare 'three' specifiers the browser gets from the import map.
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`
const three = ${JSON.stringify(new URL('../vendor/three/three.module.min.js', import.meta.url).href)};
const addons = ${JSON.stringify(new URL('../vendor/three/addons/', import.meta.url).href)};
export async function resolve(spec, ctx, next) {
  if (spec === 'three') return { url: three, shortCircuit: true };
  if (spec.startsWith('three/addons/')) return { url: addons + spec.slice(13), shortCircuit: true };
  return next(spec, ctx);
}`));
