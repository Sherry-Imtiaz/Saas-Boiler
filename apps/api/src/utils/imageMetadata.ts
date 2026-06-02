export interface ImageMetadata {
  width: number | null;
  height: number | null;
  format: string | null;
}

function readPng(buffer: Buffer): ImageMetadata | null {
  if (buffer.length < 24) return null;
  const pngSignature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== pngSignature) return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    format: 'png'
  };
}

function readJpeg(buffer: Buffer): ImageMetadata | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return null;
    const isSof = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
    if (isSof && offset + 8 < buffer.length) {
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5),
        format: 'jpeg'
      };
    }
    offset += 2 + length;
  }
  return null;
}

function readWebp(buffer: Buffer): ImageMetadata | null {
  if (buffer.length < 30) return null;
  if (buffer.subarray(0, 4).toString('ascii') !== 'RIFF' || buffer.subarray(8, 12).toString('ascii') !== 'WEBP') return null;
  const chunk = buffer.subarray(12, 16).toString('ascii');
  if (chunk === 'VP8X' && buffer.length >= 30) {
    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);
    return { width, height, format: 'webp' };
  }
  if (chunk === 'VP8 ' && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
      format: 'webp'
    };
  }
  return { width: null, height: null, format: 'webp' };
}

function readSvg(buffer: Buffer): ImageMetadata | null {
  const text = buffer.toString('utf8', 0, Math.min(buffer.length, 4096));
  if (!/<svg[\s>]/i.test(text)) return null;
  const width = text.match(/\bwidth=["']([0-9.]+)(?:px)?["']/i);
  const height = text.match(/\bheight=["']([0-9.]+)(?:px)?["']/i);
  const viewBox = text.match(/\bviewBox=["'][^"']*?\s+([0-9.]+)\s+([0-9.]+)["']/i);
  return {
    width: width ? Math.round(Number(width[1])) : viewBox ? Math.round(Number(viewBox[1])) : null,
    height: height ? Math.round(Number(height[1])) : viewBox ? Math.round(Number(viewBox[2])) : null,
    format: 'svg'
  };
}

export function extractImageMetadata(buffer: Buffer, mimeType: string): ImageMetadata {
  const byMime = mimeType.toLowerCase();
  const result = byMime.includes('png')
    ? readPng(buffer)
    : byMime.includes('jpeg') || byMime.includes('jpg')
      ? readJpeg(buffer)
      : byMime.includes('webp')
        ? readWebp(buffer)
        : byMime.includes('svg')
          ? readSvg(buffer)
          : readPng(buffer) || readJpeg(buffer) || readWebp(buffer) || readSvg(buffer);

  return result ?? { width: null, height: null, format: null };
}
