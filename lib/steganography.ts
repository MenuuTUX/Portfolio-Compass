
import { type PortfolioItem } from '@/types';

// Constants for watermarking
const BLOCK_SIZE = 8; // Size of the block for each bit
const HEADER_SEQUENCE = "BIO"; // Short sync header
const REPEAT_COUNT = 5; // Increased redundancy

// Helper to convert string to binary
function stringToBinary(str: string): string {
  let binary = "";
  for (let i = 0; i < str.length; i++) {
    const bin = str.charCodeAt(i).toString(2);
    binary += "0".repeat(8 - bin.length) + bin;
  }
  return binary;
}

// Helper to convert binary to string
function binaryToString(binary: string): string {
  let str = "";
  for (let i = 0; i < binary.length; i += 8) {
    const charCode = parseInt(binary.substr(i, 8), 2);
    if (!isNaN(charCode)) str += String.fromCharCode(charCode);
  }
  return str;
}

/**
 * Encodes the portfolio data into the image using differential block encoding.
 * This is robust to mild compression and resizing.
 * @param imageData The original ImageData object from the canvas
 * @param portfolio The portfolio items to encode
 * @returns The modified ImageData
 */
export function encodePortfolioWatermark(imageData: ImageData, portfolio: PortfolioItem[], budget: number): ImageData {
  // 1. Serialize Portfolio
  const payloadData = `v1|${budget}|` + portfolio.map(p =>
    `${p.item.symbol}:${p.shares}:${p.weight}`
  ).join(';');

  const fullPayload = HEADER_SEQUENCE + payloadData + "|END|";
  const binaryPayload = stringToBinary(fullPayload);
  const dataLength = binaryPayload.length;

  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  let bitIndex = 0;
  let repeatIndex = 0;

  // Loop through blocks
  for (let y = 0; y < height - BLOCK_SIZE; y += BLOCK_SIZE) {
    for (let x = 0; x < width - BLOCK_SIZE; x += BLOCK_SIZE) {
      if (repeatIndex >= REPEAT_COUNT) break; // Done repeats

      const currentBit = binaryPayload[bitIndex];

      const halfBlock = Math.floor(BLOCK_SIZE / 2);

      // Calculate current bias
      let sumLeft = 0;
      let sumRight = 0;
      for (let by = 0; by < BLOCK_SIZE; by++) {
        for (let bx = 0; bx < BLOCK_SIZE; bx++) {
             const pixelIndex = ((y + by) * width + (x + bx)) * 4;
             const brightness = data[pixelIndex] + data[pixelIndex+1] + data[pixelIndex+2];
             if (bx < halfBlock) sumLeft += brightness;
             else sumRight += brightness;
        }
      }
      const currentDiff = sumLeft - sumRight;

      const targetMargin = BLOCK_SIZE * BLOCK_SIZE * 5; // Margin ~5 per pixel difference

      let desiredChange = 0;
      if (currentBit === '1') {
          if (currentDiff <= targetMargin) {
              desiredChange = (targetMargin - currentDiff);
          }
      } else {
          if (currentDiff >= -targetMargin) {
              desiredChange = (-targetMargin - currentDiff);
          }
      }

      // Distribute desiredChange
      // We change roughly half of pixels (Left) +X and half (Right) -X
      // Total Shift = (BlockSize/2 * BlockSize) * (2 * Delta)
      // Delta = DesiredChange / (BlockSize^2) roughly

      let delta = 0;
      if (desiredChange !== 0) {
          delta = Math.abs(desiredChange) / (BLOCK_SIZE * BLOCK_SIZE);
      }

      // Clamp delta
      delta = Math.max(8, Math.min(25, delta)); // Min 8 for robustness, Max 25 for visibility constraint

      for (let by = 0; by < BLOCK_SIZE; by++) {
        for (let bx = 0; bx < BLOCK_SIZE; bx++) {
            const pixelIndex = ((y + by) * width + (x + bx)) * 4;
            const isLeft = bx < halfBlock;

            let change = 0;
            if (currentBit === '1') {
                change = isLeft ? delta : -delta;
            } else {
                change = isLeft ? -delta : delta;
            }

            // Apply change to R, G, B channels
            for(let c=0; c<3; c++) {
                data[pixelIndex+c] = Math.max(0, Math.min(255, data[pixelIndex+c] + change));
            }
        }
      }

      bitIndex++;
      if (bitIndex >= dataLength) {
          bitIndex = 0;
          repeatIndex++;
      }
    }
  }

  return imageData;
}

/**
 * Decodes the portfolio data from the image.
 * @param imageData The image data to decode
 * @returns The decoded portfolio object or null
 */
export function decodePortfolioWatermark(imageData: ImageData): { portfolio: any[], budget: number } | null {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  let decodedBinary = "";

  for (let y = 0; y < height - BLOCK_SIZE; y += BLOCK_SIZE) {
    for (let x = 0; x < width - BLOCK_SIZE; x += BLOCK_SIZE) {
        let sumLeft = 0;
        let sumRight = 0;
        const halfBlock = Math.floor(BLOCK_SIZE / 2);

        for (let by = 0; by < BLOCK_SIZE; by++) {
            for (let bx = 0; bx < BLOCK_SIZE; bx++) {
                const pixelIndex = ((y + by) * width + (x + bx)) * 4;
                // Sum RGB
                const brightness = data[pixelIndex] + data[pixelIndex+1] + data[pixelIndex+2];

                if (bx < halfBlock) {
                    sumLeft += brightness;
                } else {
                    sumRight += brightness;
                }
            }
        }
        decodedBinary += (sumLeft > sumRight) ? "1" : "0";
    }
  }

  const fullString = binaryToString(decodedBinary);

  // Use regex to find all matches, but better handle noise in the header itself?
  // No, if header is corrupt, we likely can't recover easily without complex logic.
  // With REPEAT_COUNT=5, we hope one is clean.

  const matches = [...fullString.matchAll(new RegExp(HEADER_SEQUENCE, 'g'))];

  for (const match of matches) {
      if (match.index === undefined) continue;

      try {
          const startIndex = match.index;
          const rawData = fullString.substring(startIndex + HEADER_SEQUENCE.length);

          const endMarker = "|END|";
          const endIndex = rawData.indexOf(endMarker);

          if (endIndex === -1) continue;

          const payload = rawData.substring(0, endIndex);
          const parts = payload.split('|');

          if (parts[0] !== 'v1') continue;

          const budget = parseFloat(parts[1]);
          const itemsStr = parts[2];

          if (!itemsStr) continue;

          const items = itemsStr.split(';').map(s => {
              const [symbol, shares, weight] = s.split(':');
              if (!symbol || !shares || !weight) return null;
              return {
                  ticker: symbol,
                  shares: parseFloat(shares),
                  weight: parseFloat(weight)
              };
          }).filter(Boolean);

          if (items.length === 0) continue;

          return { portfolio: items, budget };

      } catch (e) {
          continue;
      }
  }

  return null;
}
