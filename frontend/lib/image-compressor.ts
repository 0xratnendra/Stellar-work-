export interface ImageCompressionOptions {
  maxFileSizeMB?: number; // e.g., 10MB limit for validation
  maxDimensionPx?: number; // e.g., max 2048px width/height for compression
  quality?: number; // 0.0 to 1.0 (default 0.8)
  onProgress?: (progress: number, details?: { compressedSize: number; dimensions: [number, number] }) => void;
}

export interface CompressedImageResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  dimensions: [number, number];
  wasCompressed: boolean;
}

export function validateImageFile(file: File, maxFileSizeMB = 10): { valid: boolean; error?: string } {
  const maxBytes = maxFileSizeMB * 1024 * 1024;
  if (!file.type.startsWith("image/")) {
    return { valid: false, error: "File must be a valid image format." };
  }
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `Image size (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds maximum limit of ${maxFileSizeMB}MB.`,
    };
  }
  return { valid: true };
}

export async function compressAndValidateImage(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<CompressedImageResult> {
  const { maxFileSizeMB = 10, maxDimensionPx = 2048, quality = 0.8, onProgress } = options;

  // 1. Size Validation
  const validation = validateImageFile(file, maxFileSizeMB);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  onProgress?.(10);

  // If not a compressable browser image or server/non-DOM environment, return original
  if (typeof window === "undefined" || typeof document === "undefined" || !window.createImageBitmap) {
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      dimensions: [0, 0],
      wasCompressed: false,
    };
  }

  try {
    onProgress?.(30);
    const bitmap = await createImageBitmap(file);
    const originalWidth = bitmap.width;
    const originalHeight = bitmap.height;

    let targetWidth = originalWidth;
    let targetHeight = originalHeight;

    if (originalWidth > maxDimensionPx || originalHeight > maxDimensionPx) {
      if (originalWidth > originalHeight) {
        targetWidth = maxDimensionPx;
        targetHeight = Math.round((originalHeight * maxDimensionPx) / originalWidth);
      } else {
        targetHeight = maxDimensionPx;
        targetWidth = Math.round((originalWidth * maxDimensionPx) / originalHeight);
      }
    }

    onProgress?.(50);

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Canvas 2D context unavailable");
    }

    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close();

    onProgress?.(70);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), file.type || "image/jpeg", quality);
    });

    if (!blob) {
      throw new Error("Failed to export compressed canvas blob");
    }

    // Preserve original filename and mime type
    const compressedFile = new File([blob], file.name, {
      type: file.type || "image/jpeg",
      lastModified: Date.now(),
    });

    onProgress?.(100, {
      compressedSize: compressedFile.size,
      dimensions: [targetWidth, targetHeight],
    });

    return {
      file: compressedFile,
      originalSize: file.size,
      compressedSize: compressedFile.size,
      dimensions: [targetWidth, targetHeight],
      wasCompressed: true,
    };
  } catch (err) {
    // Fallback to original file on compression failure
    console.warn("Client-side image compression failed, falling back to original file:", err);
    onProgress?.(100, {
      compressedSize: file.size,
      dimensions: [0, 0],
    });
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      dimensions: [0, 0],
      wasCompressed: false,
    };
  }
}
