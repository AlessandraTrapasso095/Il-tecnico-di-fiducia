import "server-only";

function ascii(bytes: Uint8Array, start: number, len: number) {
  let out = "";
  for (let i = 0; i < len; i += 1) {
    const code = bytes[start + i];
    if (code === undefined) return null;
    out += String.fromCharCode(code);
  }
  return out;
}

function bytesEqual(bytes: Uint8Array, signature: number[], offset = 0) {
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  return true;
}

async function readHeader(file: File, byteLength: number) {
  const buf = await file.slice(0, byteLength).arrayBuffer();
  return new Uint8Array(buf);
}

export async function sniffImageMime(
  file: File,
): Promise<"image/jpeg" | "image/png" | "image/webp" | null> {
  const header = await readHeader(file, 12);

  // JPEG (SOI marker).
  if (bytesEqual(header, [0xff, 0xd8, 0xff], 0)) {
    return "image/jpeg";
  }

  // PNG signature.
  if (
    bytesEqual(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  ) {
    return "image/png";
  }

  // WebP: RIFF....WEBP
  const riff = ascii(header, 0, 4);
  const webp = ascii(header, 8, 4);
  if (riff === "RIFF" && webp === "WEBP") {
    return "image/webp";
  }

  return null;
}

export async function isPdfFile(file: File) {
  const header = await readHeader(file, 5);
  return ascii(header, 0, 5) === "%PDF-";
}

export async function sniffIsoBmffVideoMime(
  file: File,
): Promise<"video/mp4" | "video/quicktime" | null> {
  // ISO BMFF containers start with a 4-byte box size, then "ftyp".
  // We accept MP4/MOV by checking the 'ftyp' marker and major_brand.
  const header = await readHeader(file, 12);

  if (ascii(header, 4, 4) !== "ftyp") return null;
  const brand = ascii(header, 8, 4);
  if (!brand) return null;

  // QuickTime major brand.
  if (brand === "qt  ") return "video/quicktime";

  // Default to MP4 for other compatible brands (isom/mp41/mp42/avc1/iso2...).
  return "video/mp4";
}

