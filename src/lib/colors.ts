const clientColors: Record<string, string> = {
  zebra: "#65e69a",
  zakura: "#e8be56",
  zcashd: "#8bb8e8",
  seeder: "#b8a897",
  unknown: "#a3adb1",
  other: "#b5bbae",
};

/** Stable across views, refreshes, and newly observed client categories. */
export function clientColor(name: string): string {
  const key = name.trim().toLowerCase();
  if (Object.hasOwn(clientColors, key)) return clientColors[key];
  let hash = 0;
  for (const character of key)
    hash = (Math.imul(hash, 31) + character.charCodeAt(0)) >>> 0;
  return `hsl(${hash % 360} 55% 65%)`;
}
