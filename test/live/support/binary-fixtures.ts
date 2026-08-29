import { createHash } from "node:crypto";

const encoder = new TextEncoder();

const concatBytes = (...parts: ReadonlyArray<Uint8Array>): Uint8Array => {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.byteLength, 0));
  let offset = 0;

  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }

  return result;
};

const encodeText = (value: string): Uint8Array => encoder.encode(value);

const crc32 = (value: Uint8Array): number => {
  let crc = 0xffffffff;

  for (const byte of value) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
};

const zipHeader = (length: number, write: (view: DataView) => void): Uint8Array => {
  const bytes = new Uint8Array(length);
  write(new DataView(bytes.buffer));
  return bytes;
};

export const createStoredZipFile = (name: string): File => {
  const entryName = encodeText("fixture.txt");
  const contents = encodeText("put.io SDK live archive fixture\n");
  const checksum = crc32(contents);
  const localHeader = zipHeader(30, (view) => {
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint32(14, checksum, true);
    view.setUint32(18, contents.byteLength, true);
    view.setUint32(22, contents.byteLength, true);
    view.setUint16(26, entryName.byteLength, true);
  });
  const centralHeader = zipHeader(46, (view) => {
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint32(16, checksum, true);
    view.setUint32(20, contents.byteLength, true);
    view.setUint32(24, contents.byteLength, true);
    view.setUint16(28, entryName.byteLength, true);
  });
  const centralOffset = localHeader.byteLength + entryName.byteLength + contents.byteLength;
  const centralSize = centralHeader.byteLength + entryName.byteLength;
  const end = zipHeader(22, (view) => {
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, 1, true);
    view.setUint16(10, 1, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, centralOffset, true);
  });
  const archive = concatBytes(localHeader, entryName, contents, centralHeader, entryName, end);

  return new File([archive], name, { type: "application/zip" });
};

export const createTorrentFile = (name: string): File => {
  const payload = encodeText("put.io SDK live torrent fixture\n");
  const pieceHash = new Uint8Array(createHash("sha1").update(payload).digest());
  const payloadName = `${name}.txt`;
  const info = concatBytes(
    encodeText(`d6:lengthi${payload.byteLength}e4:name${payloadName.length}:${payloadName}`),
    encodeText(`12:piece lengthi16384e6:pieces20:`),
    pieceHash,
    encodeText("e"),
  );
  const announce = `https://example.invalid/${name}`;
  const torrent = concatBytes(
    encodeText(`d8:announce${announce.length}:${announce}4:info`),
    info,
    encodeText("e"),
  );

  return new File([torrent], `${name}.torrent`, { type: "application/x-bittorrent" });
};
