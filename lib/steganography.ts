// Basic Least Significant Bit (LSB) Steganography
// This allows embedding hidden data into an image.
// Note: This survives PNG screenshots (lossless) and cropping.
// It does NOT survive JPEG compression or resizing.

const MAGIC_HEADER = "PC_DATA:";

/**
 * Encodes data into the image using LSB steganography.
 */
export async function embedDataInImage(
  canvas: HTMLCanvasElement,
  data: any,
): Promise<string> {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not get canvas context");

  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  // Prepare payload
  const jsonString = JSON.stringify(data);
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(jsonString);
  const magicBytes = encoder.encode(MAGIC_HEADER);

  // Create full payload: [MAGIC_HEADER] [LENGTH (4 bytes)] [DATA]
  const lengthBuffer = new ArrayBuffer(4);
  new DataView(lengthBuffer).setUint32(0, dataBytes.length, false); // Big endian
  const lengthBytes = new Uint8Array(lengthBuffer);

  const payload = new Uint8Array(
    magicBytes.length + lengthBytes.length + dataBytes.length,
  );
  payload.set(magicBytes, 0);
  payload.set(lengthBytes, magicBytes.length);
  payload.set(dataBytes, magicBytes.length + lengthBytes.length);

  const payloadBits = payload.length * 8;
  const totalCapacityBits = width * height; // 1 bit per pixel (Blue channel)

  if (payloadBits > totalCapacityBits) {
    console.warn("Payload too large for image, truncating.");
  }

  let bitIndex = 0;

  // Iterate over pixels and write bits
  for (let i = 0; i < pixels.length; i += 4) {
    // Current bit to write (repeat payload loop)
    const currentByteIndex = Math.floor(bitIndex / 8) % payload.length;
    const currentBitIndex = 7 - (bitIndex % 8);
    const bit = (payload[currentByteIndex] >> currentBitIndex) & 1;

    // Modify Blue channel LSB
    // clear LSB then set it
    pixels[i + 2] = (pixels[i + 2] & 0xfe) | bit;

    bitIndex++;
  }

  // Write back to canvas
  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL("image/png");
}

/**
 * Decodes data from the image using LSB steganography.
 * Scans for the magic header to recover data.
 */
export async function extractDataFromImage(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        reject(new Error("Canvas context failed"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;

      const bits: number[] = [];
      // Read all LSBs from Blue channel
      for (let i = 0; i < pixels.length; i += 4) {
        bits.push(pixels[i + 2] & 1);
      }

      // Convert bits to bytes
      const bytes = new Uint8Array(Math.floor(bits.length / 8));
      for (let i = 0; i < bytes.length; i++) {
        let byte = 0;
        for (let b = 0; b < 8; b++) {
          byte = (byte << 1) | bits[i * 8 + b];
        }
        bytes[i] = byte;
      }

      // Search for Header
      const encoder = new TextEncoder();
      const magicBytes = encoder.encode(MAGIC_HEADER);

      let foundIndex = -1;

      // Search for the magic sequence
      for (let i = 0; i < bytes.length - magicBytes.length; i++) {
        let match = true;
        for (let j = 0; j < magicBytes.length; j++) {
          if (bytes[i + j] !== magicBytes[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          foundIndex = i;
          break;
        }
      }

      if (foundIndex === -1) {
        reject(
          new Error(
            "No hidden portfolio data found. Make sure the image is a PNG and hasn't been compressed.",
          ),
        );
        return;
      }

      // Read Length
      const lengthOffset = foundIndex + magicBytes.length;
      if (lengthOffset + 4 > bytes.length) {
        reject(new Error("Data corrupted (header found but length missing)"));
        return;
      }

      const lengthView = new DataView(
        bytes.buffer,
        bytes.byteOffset + lengthOffset,
        4,
      );
      const dataLength = lengthView.getUint32(0, false);

      // Validate Length
      if (dataLength > 1000000 || dataLength <= 0) {
        // Max 1MB
        reject(new Error("Invalid data length detected"));
        return;
      }

      const dataOffset = lengthOffset + 4;
      if (dataOffset + dataLength > bytes.length) {
        reject(new Error("Data incomplete (cropped or corrupted)"));
        return;
      }

      // Read Data
      const dataBytes = bytes.slice(dataOffset, dataOffset + dataLength);
      const decoder = new TextDecoder();
      try {
        const jsonString = decoder.decode(dataBytes);
        const data = JSON.parse(jsonString);
        resolve(data);
      } catch (e) {
        reject(new Error("Failed to parse hidden data"));
      }
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}
