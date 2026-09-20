// El "Content-Type" de un archivo subido lo declara el cliente y es
// trivial de falsificar (mandar un .html o un .svg con script pero
// declarando "image/png"). Esto confirma la firma binaria real del
// archivo ("magic bytes") contra los formatos que efectivamente
// aceptamos, como segunda capa además del filtro de mimetype de multer.
const SIGNATURES: { mime: string; check: (buf: Buffer) => boolean }[] = [
  {
    mime: 'image/jpeg',
    check: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: 'image/png',
    check: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    mime: 'image/webp',
    check: (b) => b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

export function isRealImage(buffer: Buffer): boolean {
  return SIGNATURES.some((sig) => sig.check(buffer));
}
