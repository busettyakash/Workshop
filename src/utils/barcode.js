// Code 39 character mapping
// '0' = narrow element, '1' = wide element
// 9 elements per character alternating: bar, space, bar, space, bar, space, bar, space, bar
const CODE39_MAP = {
  '0': '000110100',
  '1': '100100001',
  '2': '001100001',
  '3': '101100000',
  '4': '000110001',
  '5': '100110000',
  '6': '001110000',
  '7': '000100101',
  '8': '100100100',
  '9': '001100100',
  'A': '100001001',
  'B': '001001001',
  'C': '101001000',
  'D': '000011001',
  'E': '100011000',
  'F': '001011000',
  'G': '000001101',
  'H': '100001100',
  'I': '001001100',
  'J': '000011100',
  'K': '100000011',
  'L': '001000011',
  'M': '101000010',
  'N': '000010011',
  'O': '100010010',
  'P': '001010010',
  'Q': '000000111',
  'R': '100000110',
  'S': '001000110',
  'T': '000010110',
  'U': '110000001',
  'V': '011000001',
  'W': '111000000',
  'X': '010010001',
  'Y': '110010000',
  'Z': '011010000',
  '-': '010000101',
  '.': '110000100',
  ' ': '011000100',
  '*': '010010100', // Start/Stop character
  '$': '010101000',
  '/': '010100010',
  '+': '010001010',
  '%': '000101010'
};

/**
 * Draws a Code 39 barcode onto a canvas element.
 * @param {HTMLCanvasElement} canvas
 * @param {string} text
 */
export function drawBarcode(canvas, text) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cleanText = (text || '').trim().toUpperCase();
  if (!cleanText) return;

  const formattedText = `*${cleanText}*`;
  const narrowWidth = 2; // Width of narrow bars/spaces
  const wideWidth = 5;   // Width of wide bars/spaces
  const gapWidth = 2;    // Inter-character gap width

  // Calculate total barcode width
  let barcodeWidth = 0;
  for (let i = 0; i < formattedText.length; i++) {
    const char = formattedText[i];
    const pattern = CODE39_MAP[char];
    if (!pattern) continue;

    for (let j = 0; j < 9; j++) {
      const isWide = pattern[j] === '1';
      barcodeWidth += isWide ? wideWidth : narrowWidth;
    }
    if (i < formattedText.length - 1) {
      barcodeWidth += gapWidth;
    }
  }

  // Padding and dimensions
  const paddingX = 24;
  const paddingY = 16;
  const barcodeHeight = 56;
  const textHeight = 16;

  // Set high-dpi / standard canvas size
  canvas.width = barcodeWidth + (paddingX * 2);
  canvas.height = barcodeHeight + textHeight + (paddingY * 2);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw Bars
  ctx.fillStyle = '#111827';
  let currentX = paddingX;

  for (let i = 0; i < formattedText.length; i++) {
    const char = formattedText[i];
    const pattern = CODE39_MAP[char];
    if (!pattern) continue;

    for (let j = 0; j < 9; j++) {
      const isBar = j % 2 === 0;
      const isWide = pattern[j] === '1';
      const w = isWide ? wideWidth : narrowWidth;

      if (isBar) {
        ctx.fillRect(currentX, paddingY, w, barcodeHeight);
      }
      currentX += w;
    }
    // Inter-character space
    currentX += gapWidth;
  }

  // Text at the bottom
  ctx.fillStyle = '#4b5563';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(cleanText, canvas.width / 2, paddingY + barcodeHeight + 8);
}
