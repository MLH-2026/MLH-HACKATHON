import sharp from 'sharp';
import { ApiError } from './errors.js';

// Keep native decoder caches bounded too; screenshots are never written to files.
sharp.cache(false);
sharp.concurrency(2);
const supported = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };

export async function validateImage(file, config) {
  if (file.buffer.length > config.maxImageBytes) {
    throw new ApiError(413, 'image_too_large', 'Screenshot exceeds the configured image byte limit.');
  }
  const declared = file.mimetype?.toLowerCase().split(';')[0].trim();
  if (!Object.values(supported).includes(declared)) {
    throw new ApiError(415, 'unsupported_image', 'Use a PNG, JPEG, or WebP screenshot with its image MIME type.');
  }
  try {
    const image = sharp(file.buffer, { limitInputPixels: false, failOn: 'warning', animated: true });
    const metadata = await image.metadata();
    if (!supported[metadata.format] || supported[metadata.format] !== declared) {
      throw new ApiError(415, 'unsupported_image', 'Image format does not match a supported declared MIME type.');
    }
    if (!metadata.width || !metadata.height) throw new Error('Missing dimensions');
    if (metadata.width * metadata.height > config.maxImagePixels) {
      throw new ApiError(413, 'image_too_large', 'Screenshot exceeds the configured pixel limit.');
    }
    if ((metadata.pages ?? 1) !== 1) {
      throw new ApiError(422, 'unreadable_image', 'Upload a single still screenshot, not an animation.');
    }
    // Metadata alone does not establish that the complete image can be decoded.
    await image.raw().toBuffer();
    return { data: file.buffer, mimeType: supported[metadata.format] };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(422, 'unreadable_image', 'Screenshot is empty, damaged, or unreadable.');
  }
}
