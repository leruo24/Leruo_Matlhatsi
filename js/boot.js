// A GPU failure must never leave visitors on an endless loading screen.
try {
  await import('./world.js');
} catch (error) {
  console.warn('Workshop renderer unavailable; opening the accessible fallback.', error);
  const { startFallback } = await import('./fallback.js');
  startFallback();
}
