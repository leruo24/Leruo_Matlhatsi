export const limitYaw = value => Math.max(-Math.PI, Math.min(Math.PI, value));
export function dragYaw(start, dx, width) {
  return limitYaw(start - dx / Math.max(1, width) * Math.PI);
}

export const MAX_PITCH = Math.PI / 3;
export const limitPitch = value => Math.max(-MAX_PITCH, Math.min(MAX_PITCH, value));
export function dragPitch(start, dy, height) {
  return limitPitch(start + dy / Math.max(1, height) * Math.PI / 2);
}
