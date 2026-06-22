import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';

const BUCKET_NAME = 'medical-uploads';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Get file extension from MIME type
 */
function getExtFromMime(mimeType) {
    const map = {
        'application/pdf': 'pdf',
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/heic': 'heic',
    };
    return map[mimeType] || 'bin';
}

/**
 * Generate a unique storage path for the file.
 * Format: {userId}/{timestamp}_{random}.{ext}
 */
function generateStoragePath(userId, mimeType) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = getExtFromMime(mimeType);
    return `${userId}/${timestamp}_${random}.${ext}`;
}

export const FileUploadService = {
    /**
     * Upload a local file to Supabase Storage.
     * Reads the file as base64, converts to ArrayBuffer, and uploads.
     *
     * @param {string} uri - Local file URI from picker
     * @param {string} mimeType - MIME type of the file
     * @param {string} userId - Authenticated user's ID
     * @returns {Promise<{storagePath: string, mimeType: string}>}
     */
    async uploadFile(uri, mimeType, userId) {
        if (!supabase) {
            throw new Error('Supabase not initialized. Please check your connection.');
        }
        if (!userId) {
            throw new Error('You must be signed in to upload files.');
        }

        // 1. Read file as base64 from local URI
        let base64Data;
        try {
            base64Data = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64,
            });
        } catch (readError) {
            console.error('[FileUpload] Failed to read file:', readError);
            throw new Error('Could not read the selected file. Please try again.');
        }

        if (!base64Data) {
            throw new Error('No file data available for upload.');
        }

        // 2. Check file size (base64 is ~33% larger than raw bytes)
        const estimatedBytes = (base64Data.length * 3) / 4;
        if (estimatedBytes > MAX_FILE_SIZE) {
            throw new Error(`File is too large (${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB). Maximum size is 10MB.`);
        }

        // 3. Convert base64 to ArrayBuffer for Supabase Storage SDK
        const arrayBuffer = decode(base64Data);

        // 4. Generate unique storage path
        const storagePath = generateStoragePath(userId, mimeType);

        // 5. Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(storagePath, arrayBuffer, {
                contentType: mimeType,
                upsert: false,
            });

        if (error) {
            console.error('[FileUpload] Storage upload error:', error);
            throw new Error('Failed to upload file. Please try again.');
        }

        console.log('[FileUpload] Uploaded successfully:', storagePath);
        return { storagePath, mimeType };
    },

    /**
     * Generate a signed URL for a file in Supabase Storage.
     * The URL expires after the given time (default: 10 days).
     *
     * @param {string} storagePath - Path inside the medical-uploads bucket
     * @param {number} expiresIn - Seconds until the URL expires (default: 10 days)
     * @returns {Promise<string|null>} - The signed URL or null if failed
     */
    async getSignedUrl(storagePath, expiresIn = 864000) {
        if (!storagePath) return null;
        try {
            const { data, error } = await supabase.storage
                .from(BUCKET_NAME)
                .createSignedUrl(storagePath, expiresIn);
            if (error) throw error;
            return data.signedUrl;
        } catch (e) {
            console.warn('[FileUpload] Signed URL failed, trying public URL:', e.message);
            // Fallback: construct public URL (works if bucket is public, 404s if private → shows fallback)
            const { data } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(storagePath);
            return data.publicUrl;
        }
    },

    /**
     * Batch-generate signed URLs for multiple storage paths.
     * Returns a map of { storagePath: signedUrl }.
     *
     * @param {string[]} storagePaths - Array of paths inside the medical-uploads bucket
     * @param {number} expiresIn - Seconds until URLs expire (default: 10 days)
     * @returns {Promise<Object>} - Map of path → signedUrl
     */
    async getSignedUrls(storagePaths, expiresIn = 864000) {
        if (!storagePaths || storagePaths.length === 0) return {};
        try {
            const { data, error } = await supabase.storage
                .from(BUCKET_NAME)
                .createSignedUrls(storagePaths, expiresIn);
            if (error) throw error;
            const urlMap = {};
            data.forEach(item => {
                if (item.signedUrl) {
                    urlMap[item.path] = item.signedUrl;
                }
            });
            return urlMap;
        } catch (e) {
            console.warn('[FileUpload] Batch signed URLs failed:', e.message);
            return {};
        }
    },
};
