import {
  MAX_INPUT_BYTES,
  TenderDocumentExtractionError,
} from "../tender-document-extraction.types";
import { MAX_ENTRIES, MAX_EXPANDED_BYTES } from "./archive-guard";

const FREE = 0xffffffff,
  END = 0xfffffffe,
  FAT = 0xfffffffd,
  DIFAT = 0xfffffffc;
const corrupt = () => new TenderDocumentExtractionError("DOCUMENT_CORRUPT");
const limit = () => new TenderDocumentExtractionError("DOCUMENT_ARCHIVE_LIMIT");
interface DirectoryEntry {
  name: string;
  type: number;
  left: number;
  right: number;
  child: number;
  start: number;
  size: number;
}
interface StreamPlan {
  path: string;
  size: number;
  chain: number[];
  mini: boolean;
}

/** Read the original CFB without an eager third-party reader. The first phase
 * keeps bounded metadata and source-buffer views only. Validate every reachable
 * allocation chain, including ignored streams, before copying any stream bytes.
 * The only later CFB.read belongs to hwp-convert and receives our freshly written,
 * uncompressed container, never attacker-supplied allocation tables.
 */
export function readBoundedCfb(bytes: Buffer): Map<string, Buffer> {
  if (bytes.length > MAX_INPUT_BYTES)
    throw new TenderDocumentExtractionError("DOCUMENT_TOO_LARGE");
  if (
    bytes.length < 512 ||
    bytes.subarray(0, 8).toString("hex") !== "d0cf11e0a1b11ae1"
  )
    throw corrupt();
  const version = bytes.readUInt16LE(26),
    shift = bytes.readUInt16LE(30);
  if (
    ![3, 4].includes(version) ||
    shift !== (version === 3 ? 9 : 12) ||
    bytes.readUInt16LE(28) !== 0xfffe ||
    bytes.readUInt16LE(32) !== 6 ||
    bytes.readUInt32LE(56) !== 4096
  )
    throw corrupt();
  const sectorSize = 2 ** shift,
    sectorCount = bytes.length / sectorSize - 1,
    entriesPerSector = sectorSize / 4;
  if (!Number.isInteger(sectorCount) || sectorCount < 1) throw corrupt();
  const fatCount = bytes.readUInt32LE(44),
    difatCount = bytes.readUInt32LE(72),
    miniFatCount = bytes.readUInt32LE(64),
    directoryCount = bytes.readUInt32LE(40);
  const maxDirectorySectors = Math.floor((MAX_ENTRIES * 128) / sectorSize);
  if (
    fatCount > sectorCount ||
    difatCount > sectorCount ||
    miniFatCount > sectorCount ||
    directoryCount > maxDirectorySectors
  )
    throw limit();
  if (!fatCount || (version === 3 && directoryCount !== 0)) throw corrupt();
  const sector = (id: number): Buffer => {
    if (!Number.isInteger(id) || id < 0 || id >= sectorCount) throw corrupt();
    return bytes.subarray((id + 1) * sectorSize, (id + 2) * sectorSize);
  };
  const regularOwners = new Set<number>();
  const claim = (id: number) => {
    sector(id);
    if (regularOwners.has(id)) throw corrupt();
    regularOwners.add(id);
  };
  const fatIds: number[] = [];
  const fatIdSet = new Set<number>();
  const addFat = (id: number) => {
    if (id === FREE) return;
    sector(id);
    if (fatIds.length >= fatCount || fatIdSet.has(id)) throw corrupt();
    fatIds.push(id);
    fatIdSet.add(id);
  };
  for (let offset = 76; offset < 512; offset += 4)
    addFat(bytes.readUInt32LE(offset));
  const difatIds: number[] = [];
  let difatId = bytes.readUInt32LE(68);
  for (let index = 0; index < difatCount; index++) {
    claim(difatId);
    difatIds.push(difatId);
    const data = sector(difatId);
    for (let offset = 0; offset < sectorSize - 4; offset += 4)
      addFat(data.readUInt32LE(offset));
    difatId = data.readUInt32LE(sectorSize - 4);
  }
  if (difatId !== END && (difatCount !== 0 || difatId !== FREE))
    throw corrupt();
  if (fatIds.length !== fatCount || fatCount * entriesPerSector < sectorCount)
    throw corrupt();
  for (const id of fatIds) claim(id);
  const fatAt = (id: number): number => {
    sector(id);
    return sector(fatIds[Math.floor(id / entriesPerSector)]).readUInt32LE(
      (id % entriesPerSector) * 4,
    );
  };
  for (const id of fatIds) if (fatAt(id) !== FAT) throw corrupt();
  for (const id of difatIds) if (fatAt(id) !== DIFAT) throw corrupt();
  const regularChain = (
    start: number,
    expected: number | null,
    maximum = sectorCount,
  ): number[] => {
    if (expected === 0) {
      // Some CFB writers encode an empty stream with start=0. Zero bytes
      // allocate no sector; accept that marker without following/claiming FAT[0].
      if (start !== END && start !== FREE && start !== 0) throw corrupt();
      return [];
    }
    const chain: number[] = [];
    let id = start;
    while (id !== END) {
      if (chain.length >= maximum) throw limit();
      if (expected !== null && chain.length >= expected) throw corrupt();
      claim(id);
      chain.push(id);
      id = fatAt(id);
    }
    if (expected !== null && chain.length !== expected) throw corrupt();
    return chain;
  };
  const directoryChain = regularChain(
    bytes.readUInt32LE(48),
    version === 4 ? directoryCount : null,
    maxDirectorySectors,
  );
  if (!directoryChain.length) throw corrupt();
  const directory: Array<DirectoryEntry | null> = [];
  let declaredBytes = 0;
  for (const id of directoryChain) {
    const data = sector(id);
    for (let offset = 0; offset < sectorSize; offset += 128) {
      const type = data[offset + 66];
      if (type === 0) {
        directory.push(null);
        continue;
      }
      if (![1, 2, 5].includes(type)) throw corrupt();
      const length = data.readUInt16LE(offset + 64),
        sizeBig = data.readBigUInt64LE(offset + 120);
      if (
        length < 2 ||
        length > 64 ||
        length % 2 ||
        data.readUInt16LE(offset + length - 2) !== 0
      )
        throw corrupt();
      if (sizeBig > BigInt(MAX_EXPANDED_BYTES)) throw limit();
      const name = data.toString("utf16le", offset, offset + length - 2),
        size = Number(sizeBig);
      if (!name || /[\0/\\]/.test(name) || (type === 1 && size !== 0))
        throw corrupt();
      if (type !== 1) declaredBytes += size;
      if (declaredBytes > MAX_EXPANDED_BYTES) throw limit();
      directory.push({
        name,
        type,
        size,
        left: data.readUInt32LE(offset + 68),
        right: data.readUInt32LE(offset + 72),
        child: data.readUInt32LE(offset + 76),
        start: data.readUInt32LE(offset + 116),
      });
    }
  }
  const root = directory[0];
  if (
    !root ||
    root.type !== 5 ||
    root.name !== "Root Entry" ||
    root.left !== FREE ||
    root.right !== FREE ||
    directory.slice(1).some((entry) => entry?.type === 5)
  )
    throw corrupt();
  const reached = new Set<number>([0]),
    paths = new Set<string>();
  const stack = [{ id: root.child, parent: "", depth: 0 }];
  const streams: Array<{ path: string; entry: DirectoryEntry }> = [];
  while (stack.length) {
    const { id, parent, depth } = stack.pop()!;
    if (id === FREE) continue;
    if (id >= directory.length || reached.has(id) || !directory[id])
      throw corrupt();
    if (depth > 100) throw limit();
    reached.add(id);
    const entry = directory[id]!;
    const path = parent ? `${parent}/${entry.name}` : entry.name;
    if (path.length > 4096) throw limit();
    const identity = path.toUpperCase();
    if (paths.has(identity)) throw corrupt();
    paths.add(identity);
    stack.push(
      { id: entry.left, parent, depth },
      { id: entry.right, parent, depth },
    );
    if (entry.type === 1)
      stack.push({ id: entry.child, parent: path, depth: depth + 1 });
    else {
      if (entry.child !== FREE) throw corrupt();
      streams.push({ path, entry });
    }
  }
  if (directory.some((entry, index) => entry && !reached.has(index)))
    throw corrupt();
  const miniFatChain = regularChain(bytes.readUInt32LE(60), miniFatCount);
  const rootChain = regularChain(root.start, Math.ceil(root.size / sectorSize));
  if (root.size % 64 !== 0) throw corrupt();
  const miniOwners = new Set<number>();
  const miniAt = (id: number): number => {
    if (id >= miniFatChain.length * entriesPerSector) throw corrupt();
    return sector(miniFatChain[Math.floor(id / entriesPerSector)]).readUInt32LE(
      (id % entriesPerSector) * 4,
    );
  };
  const plans: StreamPlan[] = [];
  for (const { path, entry } of streams) {
    const mini = entry.size > 0 && entry.size < 4096;
    let chain: number[];
    if (!mini)
      chain = regularChain(entry.start, Math.ceil(entry.size / sectorSize));
    else {
      chain = [];
      let id = entry.start;
      const expected = Math.ceil(entry.size / 64);
      while (id !== END) {
        if (
          id >= root.size / 64 ||
          miniOwners.has(id) ||
          chain.length >= expected
        )
          throw corrupt();
        miniOwners.add(id);
        chain.push(id);
        id = miniAt(id);
      }
      if (chain.length !== expected) throw corrupt();
    }
    plans.push({ path, size: entry.size, chain, mini });
  }
  if (
    regularOwners.size * sectorSize + miniOwners.size * 64 >
    MAX_EXPANDED_BYTES
  )
    throw limit();
  // All metadata/declared/actual-chain budgets passed. No concatenation or
  // allocation proportional to declared stream size occurs before this point.
  const copy = (
    chain: number[],
    size: number,
    unit: number,
    source: (id: number) => Buffer,
  ): Buffer => {
    const output = Buffer.alloc(size);
    let offset = 0;
    for (const id of chain) {
      const length = Math.min(unit, size - offset);
      source(id).copy(output, offset, 0, length);
      offset += length;
    }
    return output;
  };
  const rootData = copy(rootChain, root.size, sectorSize, sector);
  const output = new Map<string, Buffer>();
  for (const plan of plans) {
    const data = copy(
      plan.chain,
      plan.size,
      plan.mini ? 64 : sectorSize,
      plan.mini ? (id) => rootData.subarray(id * 64, (id + 1) * 64) : sector,
    );
    output.set(plan.path, data);
  }
  return output;
}
