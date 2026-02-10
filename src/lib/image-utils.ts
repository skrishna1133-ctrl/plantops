/**
 * Compress an image to max dimensions and JPEG quality.
 */
export function compressImage(
  dataUrl: string,
  maxWidth = 1200,
  maxHeight = 1600,
  quality = 0.7
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

/**
 * Enhance a document photo: increase contrast and sharpen.
 */
export function enhanceDocument(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;

      // Draw original
      ctx.drawImage(img, 0, 0);

      // Apply contrast + brightness enhancement
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const contrast = 1.4;
      const brightness = 10;

      for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp(contrast * (data[i] - 128) + 128 + brightness);
        data[i + 1] = clamp(contrast * (data[i + 1] - 128) + 128 + brightness);
        data[i + 2] = clamp(contrast * (data[i + 2] - 128) + 128 + brightness);
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = dataUrl;
  });
}

/**
 * Crop an image given a rectangle (percentage-based).
 */
export function cropImage(
  dataUrl: string,
  crop: { x: number; y: number; width: number; height: number }
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const sx = (crop.x / 100) * img.width;
      const sy = (crop.y / 100) * img.height;
      const sw = (crop.width / 100) * img.width;
      const sh = (crop.height / 100) * img.height;

      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = dataUrl;
  });
}

function clamp(val: number): number {
  return Math.max(0, Math.min(255, Math.round(val)));
}
