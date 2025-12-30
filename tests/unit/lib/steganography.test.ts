
import { encodePortfolioWatermark, decodePortfolioWatermark } from '../../../lib/steganography';
import { expect, test, describe } from 'bun:test';

// Mock ImageData globally if not present
if (typeof ImageData === 'undefined') {
    global.ImageData = class ImageData {
        width: number;
        height: number;
        data: Uint8ClampedArray;
        constructor(data: Uint8ClampedArray, width: number, height: number) {
            this.data = data;
            this.width = width;
            this.height = height;
        }
    } as any;
}

describe('Steganography', () => {
    test('should encode and decode portfolio data correctly', () => {
        // CORRECTED: Use ticker directly
        const portfolio = [
            { ticker: 'AAPL', shares: 10, weight: 50 },
            { ticker: 'MSFT', shares: 5, weight: 50 }
        ];
        const budget = 10000;

        const width = 400; // Increased size to fit payload
        const height = 400;
        const data = new Uint8ClampedArray(width * height * 4);
        // Fill with random noise
        for(let i=0; i<data.length; i++) {
            data[i] = Math.floor(Math.random() * 255);
        }

        const originalImageData = new ImageData(data, width, height);

        const watermarkedImageData = encodePortfolioWatermark(originalImageData, portfolio as any, budget);
        const result = decodePortfolioWatermark(watermarkedImageData);

        expect(result).not.toBeNull();
        expect(result?.budget).toBe(budget);
        expect(result?.portfolio).toHaveLength(2);
        expect(result?.portfolio[0].ticker).toBe('AAPL');
        expect(result?.portfolio[0].shares).toBe(10);
    });

    test('should decode cleanly generated image', () => {
         const portfolio = [{ ticker: 'SPY', shares: 1, weight: 100 }];
        const budget = 500;
        const width = 400; // Increased size to fit payload
        const height = 400;
        const data = new Uint8ClampedArray(width * height * 4);
        data.fill(128); // Grey background
        const imgData = new ImageData(data, width, height);

        // Note: encode modifies in place
        const encoded = encodePortfolioWatermark(imgData, portfolio as any, budget);
        const result = decodePortfolioWatermark(encoded);
        expect(result).not.toBeNull();
        expect(result?.portfolio[0].ticker).toBe('SPY');
    });
});
