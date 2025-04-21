import fs from 'fs/promises';
import path from 'path';
// @ts-ignore: ffmpeg-static doesn't ship types
import ffmpegPath from 'ffmpeg-static';
// @ts-ignore: sharp doesn't ship types
import sharp from 'sharp';
import { execFile } from 'child_process';

// Thumbnail service uses static public cache directory; no Electron `app` needed

// Serve thumbnails from root-level public/cache/thumbnails
const cacheDir = path.join(__dirname, '..', '..', 'public', 'cache', 'thumbnails');

// Ensure cache directory exists
const ensureCacheDir = async (): Promise<void> => {
    try {
        await fs.mkdir(cacheDir, { recursive: true });
    } catch (error) {
        console.error('Failed to create thumbnail cache directory:', error);
    }
};

// Call once on module load
ensureCacheDir();

// Function to get the expected cache path for an asset
const getCachePath = (assetId: number): string => {
    return path.join(cacheDir, `${assetId}.jpg`);
};

// Supported extensions for images and videos
const IMAGE_EXTS = ['.jpg','.jpeg','.png','.webp','.avif','.tiff','.gif','.svg'];
const VIDEO_EXTS = ['.mp4','.mov','.avi','.mkv','.webm'];

// PRD §4.3 Thumbnail Service: Generate thumbnail for an asset
export const generateThumbnail = async (assetId: number, sourcePath: string): Promise<string | null> => {
    // Generate thumbnail for supported asset types
    const outputPath = getCachePath(assetId);
    // Ensure the thumbnail directory exists before writing
    await fs.mkdir(cacheDir, { recursive: true });
    try {
        const ext = path.extname(sourcePath).toLowerCase();
        if (IMAGE_EXTS.includes(ext)) {
            await sharp(sourcePath)
                .resize({ width: 400, withoutEnlargement: true })
                .jpeg({ quality: 90 })
                .toFile(outputPath);
        } else if (VIDEO_EXTS.includes(ext)) {
            await new Promise<void>((resolve, reject) => {
                // Use execFile to avoid shell quoting issues on Windows
                const exePath = ffmpegPath as string;
                const args = [
                    '-y', '-hide_banner', '-loglevel', 'error',
                    '-ss', '1', '-i', sourcePath,
                    '-frames:v', '1', '-q:v', '2',
                    '-vf', 'scale=400:-1',
                    outputPath
                ];
                execFile(exePath, args, { windowsHide: true }, (error) => {
                    if (error) return reject(error);
                    resolve();
                });
            });
        } else if (ext === '.pdf') {
            // PDF thumbnails now generated via magick CLI (ImageMagick must be in PATH)
            // Convert first PDF page to JPG using magick CLI
            await new Promise<void>((resolve, reject) => {
                const exe = 'magick';
                const input = `${sourcePath}[0]`;
                const args = ['-density', '150', input, '-resize', '400x', '-quality', '90', outputPath];
                execFile(exe, args, { windowsHide: true }, (error) => error ? reject(error) : resolve());
            });
        } else {
            return null;
        }
        return `/cache/thumbnails/${assetId}.jpg`;
    } catch (error) {
        console.error(`❌ generateThumbnail failed for asset ${assetId}`, error);
        try { await fs.unlink(outputPath); } catch {}
        return null;
    }
};

// PRD §4.3 Thumbnail Service: Delete thumbnail from cache
export const deleteThumbnail = async (assetId: number): Promise<void> => {
    const cachePath = getCachePath(assetId);
    try {
        await fs.unlink(cachePath);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            // File doesn't exist, which is fine
        } else {
            console.error(`Failed to delete cached thumbnail for asset ${assetId} (${cachePath}):`, error);
        }
    }
};

// PRD §4.3 Thumbnail Service: Get path for existing thumbnail
export const getExistingThumbnailPath = async (assetId: number): Promise<string | null> => {
    const cachePath = getCachePath(assetId);
    try {
        await fs.access(cachePath);
        // Return static URL for existing thumbnail
        return `/cache/thumbnails/${assetId}.jpg`;
    } catch {
        return null;
    }
};