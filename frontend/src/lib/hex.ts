/** Convert a UTF-8 string to hex (no 0x prefix). Works in browser. */
export function strToHex(str: string): string {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
