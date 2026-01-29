import React, { useEffect, useRef, memo } from 'react';

interface QRCodeProps {
  value: string;
  size?: number;
  bgColor?: string;
  fgColor?: string;
}

/**
 * Simple QR Code generator using Canvas
 * Based on the QR Code specification with error correction level L
 */
const QRCode: React.FC<QRCodeProps> = ({
  value,
  size = 128,
  bgColor = '#ffffff',
  fgColor = '#000000'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Generate QR matrix using a simple encoding
    // For production, you'd use a proper QR library, but this creates a visual placeholder
    const qrMatrix = generateQRMatrix(value);
    const moduleCount = qrMatrix.length;
    const moduleSize = size / moduleCount;

    // Clear canvas
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);

    // Draw modules
    ctx.fillStyle = fgColor;
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        const rowData = qrMatrix[row];
        if (rowData && rowData[col]) {
          ctx.fillRect(
            col * moduleSize,
            row * moduleSize,
            moduleSize,
            moduleSize
          );
        }
      }
    }
  }, [value, size, bgColor, fgColor]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ borderRadius: '4px' }}
    />
  );
};

/**
 * Generate a simple QR-like matrix for the given value
 * This is a simplified version - for production use a proper QR library
 */
function generateQRMatrix(value: string): boolean[][] {
  const size = 25; // Standard QR code size for short URLs
  const matrix: boolean[][] = [];
  for (let i = 0; i < size; i++) {
    matrix[i] = [];
    for (let j = 0; j < size; j++) {
      matrix[i]![j] = false;
    }
  }

  // Add finder patterns (the three corner squares)
  addFinderPattern(matrix, 0, 0, size);
  addFinderPattern(matrix, size - 7, 0, size);
  addFinderPattern(matrix, 0, size - 7, size);

  // Add timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (matrix[6]) matrix[6][i] = i % 2 === 0;
    if (matrix[i]) matrix[i]![6] = i % 2 === 0;
  }

  // Add alignment pattern (center)
  const alignPos = Math.floor(size / 2) - 2;
  addAlignmentPattern(matrix, alignPos, alignPos, size);

  // Encode data in remaining space
  let dataIndex = 0;
  const dataBytes = stringToBytes(value);
  
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col = 5; // Skip timing column
    
    for (let row = 0; row < size; row++) {
      for (let c = 0; c < 2; c++) {
        const actualCol = col - c;
        if (!isReserved(row, actualCol, size) && matrix[row]) {
          if (dataIndex < dataBytes.length * 8) {
            const byteIndex = Math.floor(dataIndex / 8);
            const bitIndex = 7 - (dataIndex % 8);
            const byte = dataBytes[byteIndex];
            if (byte !== undefined) {
              matrix[row]![actualCol] = ((byte >> bitIndex) & 1) === 1;
            }
            dataIndex++;
          } else {
            // Fill remaining with pattern
            matrix[row]![actualCol] = (row + actualCol) % 2 === 0;
          }
        }
      }
    }
  }

  return matrix;
}

function addFinderPattern(matrix: boolean[][], startRow: number, startCol: number, size: number): void {
  // Outer border
  for (let i = 0; i < 7; i++) {
    const row1 = matrix[startRow];
    const row2 = matrix[startRow + 6];
    const row3 = matrix[startRow + i];
    if (row1 && startCol + i < size) row1[startCol + i] = true;
    if (row2 && startCol + i < size) row2[startCol + i] = true;
    if (row3 && startCol < size) row3[startCol] = true;
    if (row3 && startCol + 6 < size) row3[startCol + 6] = true;
  }
  // Inner square
  for (let i = 2; i < 5; i++) {
    for (let j = 2; j < 5; j++) {
      const row = matrix[startRow + i];
      if (row && startCol + j < size) row[startCol + j] = true;
    }
  }
}

function addAlignmentPattern(matrix: boolean[][], centerRow: number, centerCol: number, size: number): void {
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      const row = centerRow + i;
      const col = centerCol + j;
      if (row >= 0 && row < size && col >= 0 && col < size && matrix[row]) {
        matrix[row]![col] = Math.abs(i) === 2 || Math.abs(j) === 2 || (i === 0 && j === 0);
      }
    }
  }
}

function isReserved(row: number, col: number, size: number): boolean {
  // Finder patterns
  if ((row < 8 && col < 8) || (row < 8 && col >= size - 8) || (row >= size - 8 && col < 8)) {
    return true;
  }
  // Timing patterns
  if (row === 6 || col === 6) {
    return true;
  }
  return false;
}

function stringToBytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    bytes.push(str.charCodeAt(i) & 0xFF);
  }
  return bytes;
}

export default memo(QRCode);
