import fs from 'fs/promises';
import fsc from 'fs';
import path from 'path';
import { app, nativeImage } from 'electron';
import { spawn } from 'child_process';
import url from 'url';

// PRD §4.3 Thumbnail Service: Define cache directory structure
const cacheDir = path.join(app.getPath('userData'), 'cache', 'thumbnails');

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

// PRD §4.3 Thumbnail Service: Generate thumbnail for an asset
export const generateThumbnail = async (assetId: number, sourcePath: string, mimeType: string): Promise<string | null> => {
    const outputPath = getCachePath(assetId);

    // Check if thumbnail already exists
    try {
        await fs.access(outputPath);
        console.log(`Thumbnail already exists for asset ${assetId}: ${outputPath}`);
        return url.pathToFileURL(outputPath).toString();
    } catch {
        // Thumbnail doesn't exist, proceed with generation
    }

    console.log(`Generating thumbnail for asset ${assetId} (${mimeType}) from ${sourcePath}`);

    try {
        if (mimeType.startsWith('image/')) {
            // PRD §4.3 Thumbnail Service: Generate image thumbnail using nativeImage
            const image = nativeImage.createFromPath(sourcePath);
            if (image.isEmpty()) {
                console.error(`Failed to load image for thumbnail generation: ${sourcePath}`);
                return null;
            }
            // Resize image to a reasonable thumbnail size, e.g., 200px width maintaining aspect ratio
            const resizedImage = image.resize({ width: 200 });
            const jpegBuffer = resizedImage.toJPEG(90); // Quality 90
            await fs.writeFile(outputPath, jpegBuffer);
            console.log(`Successfully generated image thumbnail for asset ${assetId}: ${outputPath}`);

        } else if (mimeType.startsWith('video/')) {
            // PRD §4.3 Thumbnail Service: Generate video thumbnail using ffmpeg
            await new Promise<void>((resolve, reject) => {
                // Extract frame at 1 second mark, output as single jpg
                const ffmpeg = spawn('ffmpeg', [
                    '-i', sourcePath,
                    '-ss', '00:00:01.000', // Timestamp for frame grab
                    '-frames:v', '1',     // Extract only one frame
                    '-vf', 'scale=200:-1', // Scale width to 200px, maintain aspect ratio
                    '-q:v', '4',          // Quality (lower is better, 2-5 is often good for jpg)
                    outputPath,
                    '-y' // Overwrite output file if it exists
                ]);

                ffmpeg.on('close', (code) => {
                    if (code === 0) {
                        console.log(`Successfully generated video thumbnail for asset ${assetId}: ${outputPath}`);
                        resolve();
                    } else {
                        console.error(`ffmpeg exited with code ${code} for asset ${assetId}`);
                        reject(new Error(`ffmpeg failed for ${sourcePath}`));
                    }
                });

                ffmpeg.stderr.on('data', (data) => {
                    // Log ffmpeg errors/output for debugging if needed
                    // console.error(`ffmpeg stderr: ${data}`);
                });

                ffmpeg.on('error', (err) => {
                    console.error('Failed to spawn ffmpeg:', err);
                    reject(err);
                });
            });

        } else if (mimeType === 'application/pdf') {
            // PRD §4.3 Thumbnail Service: Generate PDF thumbnail using pdftocairo
            await new Promise<void>((resolve, reject) => {
                 // Use pdftocairo to render the first page (-f 1 -l 1) as JPEG (-jpeg)
                 // Output directly to the target path. Scale to 200px width (-scale-to-x 200)
                const pdftocairo = spawn('pdftocairo', [
                    '-jpeg',        // Output format
                    '-singlefile',  // Prevent adding page number to filename
                    '-f', '1',      // First page
                    '-l', '1',      // Last page (effectively just the first)
                    '-scale-to-x', '200', // Scale width to 200px
                    '-scale-to-y', '-1', // Maintain aspect ratio
                    sourcePath,
                    path.parse(outputPath).name // pdftocairo appends extension, provide base name
                ]);


                 pdftocairo.on('close', (code) => {
                    if (code === 0) {
                         // pdftocairo adds .jpg, rename if necessary (depends on exact pdftocairo version behavior)
                         // Assuming singlefile works as expected or rename is handled if needed.
                        console.log(`Successfully generated PDF thumbnail for asset ${assetId}: ${outputPath}`);
                        resolve();
                    } else {
                        console.error(`pdftocairo exited with code ${code} for asset ${assetId}`);
                        reject(new Error(`pdftocairo failed for ${sourcePath}`));
                    }
                });

                 pdftocairo.stderr.on('data', (data) => {
                    // console.error(`pdftocairo stderr: ${data}`);
                });

                 pdftocairo.on('error', (err) => {
                    console.error('Failed to spawn pdftocairo:', err);
                    reject(err);
                });
            });

        } else {
            console.warn(`Thumbnail generation not supported for MIME type: ${mimeType}`);
            return null; // Unsupported type
        }

        // Return file URL for the newly created thumbnail
        return url.pathToFileURL(outputPath).toString();

    } catch (error) {
        console.error(`Error generating thumbnail for asset ${assetId} (${sourcePath}):`, error);
        // Attempt to clean up potentially partially created file
        try {
            await fs.unlink(outputPath);
        } catch (cleanupError) {
            // Ignore cleanup error
        }
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
        return url.pathToFileURL(cachePath).toString();
    } catch {
        return null; // Not found
    }
}; 