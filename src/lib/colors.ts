const clientColors: Record<string, string> = {
  zebra: "#24764e",
  zakura: "#d5a629",
  zcashd: "#677d9c",
  seeder: "#b3aaa0",
  unknown: "#858d91",
  other: "#a3a89e",
};

/** Stable across views, refreshes, and newly observed client categories. */
export function clientColor(name: string): string {
  const key = name.trim().toLowerCase();
  if (Object.hasOwn(clientColors, key)) return clientColors[key];
  let hash = 0;
  for (const character of key)
    hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 38% 38%)`;
}
