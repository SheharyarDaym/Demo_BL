export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_STORED_CHARS = 450_000; // keep persisted previews small so storage cannot silently fail

export function validateImage(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return 'Choose a PNG, JPEG, WebP or GIF image.';
  if (file.size > MAX_UPLOAD_BYTES) return 'Images must be 5 MB or smaller.';
  return null;
}

/** Downscale and re-encode an image so its stored preview stays small. */
export async function compressImage(file: File, maxSide = 900): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('This image could not be read.'));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const q of [0.78, 0.6, 0.45]) {
      const data = canvas.toDataURL('image/jpeg', q);
      if (data.length <= MAX_STORED_CHARS) return data;
    }
    throw new Error('This image is too detailed to store in the demo. Try a smaller image.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
