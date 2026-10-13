/** The Taiyo Blitz indigo with a scattered pattern of maths symbols, built
 * once as an SVG data URI (the design's `blitzSvg()`). */
const SYMBOLS = ["+", "−", "×", "÷", "=", "+", "×", "−", "÷", "="];

function patternSvg(): string {
  let glyphs = "";
  for (let i = 0; i < 10; i++) {
    const x = ((i * 53) % 220) + 10;
    const y = ((i * 89) % 220) + 26;
    const rotate = ((i * 37) % 50) - 25;
    const fill = i % 4 === 0 ? "rgba(255,214,0,0.35)" : "rgba(255,255,255,0.12)";
    const size = 22 + (i % 3) * 10;
    glyphs += `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-weight="700" font-size="${size}" fill="${fill}" transform="rotate(${rotate} ${x} ${y})">${SYMBOLS[i]}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">${glyphs}</svg>`;
}

export const BLITZ_INDIGO = "#3B2BD1";

export const BLITZ_BACKGROUND = `${BLITZ_INDIGO} url("data:image/svg+xml,${encodeURIComponent(patternSvg())}") repeat`;
