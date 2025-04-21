import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

// Thumbnail service uses static public cache directory; no Electron `app` needed

// Serve thumbnails from root-level public/cache/thumbnails
const cacheDir = path.join(__dirname, '..', '..', 'public', 'cache', 'thumbnails');
console.log('📁 Thumbnail public cache directory is', cacheDir);

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

// Load sharp at runtime to preserve native bindings
const requireSharp = (): typeof import('sharp') => {
  try { return require('sharp'); }
  catch (err) {
    console.error('Failed to require sharp:', err);
    throw err;
  }
};

// Supported extensions
const IMAGE_EXTS = ['.jpg','.jpeg','.png','.webp','.avif','.tiff','.gif','.svg'];
const VIDEO_EXTS = ['.mp4','.mov','.avi','.mkv','.webm'];

// PRD §4.3 Thumbnail Service: Generate thumbnail for an asset
export const generateThumbnail = async (assetId: number, sourcePath: string): Promise<string | null> => {
    console.log('🔍 generateThumbnail start', assetId, sourcePath);
    const outputPath = getCachePath(assetId);
    console.log('→ will write to', outputPath);
    // Ensure the thumbnail directory exists before writing
    await fs.mkdir(cacheDir, { recursive: true });
    try {
        const ext = path.extname(sourcePath).toLowerCase();
        if (IMAGE_EXTS.includes(ext)) {
            const sharpLib = requireSharp();
            await sharpLib(sourcePath)
                .resize({ width: 400, withoutEnlargement: true })
                .jpeg({ quality: 90 })
                .toFile(outputPath);
        } else if (VIDEO_EXTS.includes(ext)) {
            await new Promise((resolve, reject) => {
                const proc = spawn('ffmpeg', ['-y', '-i', sourcePath, '-ss', '00:00:01', '-frames:v', '1', outputPath]);
                proc.on('error', reject);
                proc.on('close', code => code === 0 ? resolve(null) : reject(new Error(`ffmpeg exited with code ${code}`)));
            });
        } else if (ext === '.pdf') {
            await new Promise((resolve, reject) => {
                const prefix = outputPath.replace(/\.jpg$/, '');
                const proc = spawn('pdftocairo', ['-jpeg', '-singlefile', '-scale-to', '400', sourcePath, prefix]);
                proc.on('error', reject);
                proc.on('close', code => code === 0 ? resolve(null) : reject(new Error(`pdftocairo exited with code ${code}`)));
            });
        } else {
            throw new Error(`Unsupported extension ${ext}`);
        }
        console.log('✅ wrote thumbnail file at', outputPath);
        return `/cache/thumbnails/${assetId}.jpg`;
    } catch (error) {
        console.error(`Failed to generate thumbnail for asset ${assetId}:`, error);
        try { await fs.unlink(outputPath); } catch {}
        return null;
    }
};

// PRD §4.3 Thumbnail Service: Delete thumbnail from cache
export const deleteThumbnail = async (assetId: number): Promise<void> => {
    const cachePath = getCachePath(assetId);
    try {
        await fs.unlink(cachePath);
        console.log(`Deleted cached thumbnail for asset ${assetId}: ${cachePath}`);
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