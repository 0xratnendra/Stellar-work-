import { describe, it, expect, vi } from "vitest";
import { validateImageFile, compressAndValidateImage } from "../lib/image-compressor";

describe("Image Compressor & Validator", () => {
  it("rejects non-image files", () => {
    const file = new File(["dummy text"], "document.pdf", { type: "application/pdf" });
    const result = validateImageFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("File must be a valid image format");
  });

  it("rejects oversized images beyond configured limit", () => {
    const largeContent = new Uint8Array(11 * 1024 * 1024); // 11MB
    const file = new File([largeContent], "large.png", { type: "image/png" });
    const result = validateImageFile(file, 10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("exceeds maximum limit of 10MB");
  });

  it("passes validation for acceptable image sizes", () => {
    const file = new File(["fake image content"], "photo.jpg", { type: "image/jpeg" });
    const result = validateImageFile(file, 10);
    expect(result.valid).toBe(true);
  });

  it("falls back to original file when compression fails or canvas is unsupported", async () => {
    const file = new File(["fake image bytes"], "attachment.png", { type: "image/png" });
    const progressSpy = vi.fn();

    const result = await compressAndValidateImage(file, {
      maxFileSizeMB: 10,
      onProgress: progressSpy,
    });

    expect(result.file).toBe(file);
    expect(result.file.name).toBe("attachment.png");
    expect(result.file.type).toBe("image/png");
    expect(result.originalSize).toBe(file.size);
    expect(result.compressedSize).toBe(file.size);
    expect(result.wasCompressed).toBe(false);
    expect(progressSpy).toHaveBeenCalled();
  });
});
