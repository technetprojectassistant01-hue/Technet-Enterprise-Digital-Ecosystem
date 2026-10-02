import { inflateSync } from "zlib";

/**
 * Unpacks a WOFF (1.0) font into the plain TrueType/OpenType font inside it, using Node's native
 * zlib. Why this exists (2026-10-02): the brand fonts ship as WOFF, and PDFKit's font library
 * unpacks WOFF with a pure-JavaScript inflater on *every* PDF - measured at 8 s of a 8.5 s PDF on
 * this machine, 40 s+ on Render's free instance, long enough for Render to answer other requests
 * with 503 "hibernate-wake-error" while the event loop was blocked. Unpacked once at module load,
 * each PDF then builds in milliseconds.
 *
 * WOFF 1.0 layout (W3C): a 44-byte header, then one 20-byte directory entry per table (tag,
 * offset, compLength, origLength, origChecksum); a table whose compLength < origLength is zlib-
 * compressed. The output is a standard sfnt: a 12-byte offset table, 16-byte table records, and
 * each table padded to 4 bytes.
 */
export function woffToSfnt(woff: Buffer): Buffer {
  if (woff.toString("latin1", 0, 4) !== "wOFF") return woff; // already a plain font
  const flavor = woff.readUInt32BE(4);
  const numTables = woff.readUInt16BE(12);

  const tables: { tag: number; checksum: number; data: Buffer }[] = [];
  for (let i = 0; i < numTables; i++) {
    const e = 44 + i * 20;
    const tag = woff.readUInt32BE(e);
    const offset = woff.readUInt32BE(e + 4);
    const compLength = woff.readUInt32BE(e + 8);
    const origLength = woff.readUInt32BE(e + 12);
    const checksum = woff.readUInt32BE(e + 16);
    const raw = woff.subarray(offset, offset + compLength);
    const data = compLength < origLength ? inflateSync(raw) : Buffer.from(raw);
    if (data.length !== origLength) throw new Error(`WOFF table ${tag.toString(16)} unpacked to ${data.length} bytes, expected ${origLength}`);
    tables.push({ tag, checksum, data });
  }

  // sfnt requires table records sorted by tag.
  tables.sort((a, b) => a.tag - b.tag);
  const pad4 = (n: number) => (n + 3) & ~3;
  let entrySelector = 0;
  while (1 << (entrySelector + 1) <= numTables) entrySelector++;
  const searchRange = (1 << entrySelector) * 16;

  const headerSize = 12 + numTables * 16;
  const total = headerSize + tables.reduce((sum, t) => sum + pad4(t.data.length), 0);
  const out = Buffer.alloc(total);
  out.writeUInt32BE(flavor, 0);
  out.writeUInt16BE(numTables, 4);
  out.writeUInt16BE(searchRange, 6);
  out.writeUInt16BE(entrySelector, 8);
  out.writeUInt16BE(numTables * 16 - searchRange, 10);

  let offset = headerSize;
  tables.forEach((t, i) => {
    const r = 12 + i * 16;
    out.writeUInt32BE(t.tag, r);
    out.writeUInt32BE(t.checksum, r + 4);
    out.writeUInt32BE(offset, r + 8);
    out.writeUInt32BE(t.data.length, r + 12);
    t.data.copy(out, offset);
    offset += pad4(t.data.length);
  });
  return out;
}
