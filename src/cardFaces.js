import * as THREE from 'three';

/**
 * Procedural card face generator for classic poker decks.
 * - Corner indexes (top-left and inverted bottom-right)
 * - Standard pip layouts for 2-10
 * - Elaborate ornate Ace of Spades
 * - Stylized double-ended court figures for J, Q, K
 */

export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const SUIT_INFO = {
  spades: { symbol: '♠', color: '#0d0e12', name: 'Spades' },
  hearts: { symbol: '♥', color: '#d61f27', name: 'Hearts' },
  diamonds: { symbol: '♦', color: '#d61f27', name: 'Diamonds' },
  clubs: { symbol: '♣', color: '#0d0e12', name: 'Clubs' }
};

// Standard authentic pip coordinates (normalized 0 to 1) for ranks 2-10
const PIP_CONFIGS = {
  '2': [
    { x: 0.5, y: 0.20 },
    { x: 0.5, y: 0.80, inv: true }
  ],
  '3': [
    { x: 0.5, y: 0.20 },
    { x: 0.5, y: 0.50 },
    { x: 0.5, y: 0.80, inv: true }
  ],
  '4': [
    { x: 0.34, y: 0.20 }, { x: 0.66, y: 0.20 },
    { x: 0.34, y: 0.80, inv: true }, { x: 0.66, y: 0.80, inv: true }
  ],
  '5': [
    { x: 0.34, y: 0.20 }, { x: 0.66, y: 0.20 },
    { x: 0.5, y: 0.50 },
    { x: 0.34, y: 0.80, inv: true }, { x: 0.66, y: 0.80, inv: true }
  ],
  '6': [
    { x: 0.34, y: 0.20 }, { x: 0.66, y: 0.20 },
    { x: 0.34, y: 0.50 }, { x: 0.66, y: 0.50 },
    { x: 0.34, y: 0.80, inv: true }, { x: 0.66, y: 0.80, inv: true }
  ],
  '7': [
    { x: 0.34, y: 0.20 }, { x: 0.66, y: 0.20 },
    { x: 0.5, y: 0.35 },
    { x: 0.34, y: 0.50 }, { x: 0.66, y: 0.50 },
    { x: 0.34, y: 0.80, inv: true }, { x: 0.66, y: 0.80, inv: true }
  ],
  '8': [
    { x: 0.34, y: 0.20 }, { x: 0.66, y: 0.20 },
    { x: 0.5, y: 0.35 },
    { x: 0.34, y: 0.50 }, { x: 0.66, y: 0.50 },
    { x: 0.5, y: 0.65, inv: true },
    { x: 0.34, y: 0.80, inv: true }, { x: 0.66, y: 0.80, inv: true }
  ],
  '9': [
    { x: 0.34, y: 0.20 }, { x: 0.66, y: 0.20 },
    { x: 0.34, y: 0.40 }, { x: 0.66, y: 0.40 },
    { x: 0.5, y: 0.50 },
    { x: 0.34, y: 0.60, inv: true }, { x: 0.66, y: 0.60, inv: true },
    { x: 0.34, y: 0.80, inv: true }, { x: 0.66, y: 0.80, inv: true }
  ],
  '10': [
    { x: 0.34, y: 0.19 }, { x: 0.66, y: 0.19 },
    { x: 0.5, y: 0.29 },
    { x: 0.34, y: 0.39 }, { x: 0.66, y: 0.39 },
    { x: 0.34, y: 0.61, inv: true }, { x: 0.66, y: 0.61, inv: true },
    { x: 0.5, y: 0.71, inv: true },
    { x: 0.34, y: 0.81, inv: true }, { x: 0.66, y: 0.81, inv: true }
  ]
};

/**
 * Draws a suit pip vector path
 */
export function drawPip(ctx, suit, cx, cy, size, inverted = false) {
  const s = size / 2;
  const color = SUIT_INFO[suit].color;

  ctx.save();
  ctx.translate(cx, cy);
  if (inverted) {
    ctx.rotate(Math.PI);
  }

  ctx.fillStyle = color;

  if (suit === 'hearts') {
    ctx.beginPath();
    ctx.moveTo(0, s * 0.75);
    ctx.bezierCurveTo(-s * 1.15, s * 0.15, -s * 1.15, -s * 0.75, -s * 0.55, -s * 0.85);
    ctx.bezierCurveTo(-s * 0.15, -s * 0.9, 0, -s * 0.45, 0, -s * 0.35);
    ctx.bezierCurveTo(0, -s * 0.45, s * 0.15, -s * 0.9, s * 0.55, -s * 0.85);
    ctx.bezierCurveTo(s * 1.15, -s * 0.75, s * 1.15, s * 0.15, 0, s * 0.75);
    ctx.closePath();
    ctx.fill();
  } else if (suit === 'spades') {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.85);
    ctx.bezierCurveTo(s * 0.15, -s * 0.4, s * 1.15, s * 0.1, s * 0.55, s * 0.6);
    ctx.bezierCurveTo(s * 0.25, s * 0.75, s * 0.08, s * 0.4, 0, s * 0.35);
    ctx.bezierCurveTo(-s * 0.08, s * 0.4, -s * 0.25, s * 0.75, -s * 0.55, s * 0.6);
    ctx.bezierCurveTo(-s * 1.15, s * 0.1, -s * 0.15, -s * 0.4, 0, -s * 0.85);
    ctx.closePath();
    ctx.fill();

    // Stem
    ctx.beginPath();
    ctx.moveTo(0, s * 0.25);
    ctx.quadraticCurveTo(s * 0.08, s * 0.55, s * 0.28, s * 0.85);
    ctx.lineTo(-s * 0.28, s * 0.85);
    ctx.quadraticCurveTo(-s * 0.08, s * 0.55, 0, s * 0.25);
    ctx.closePath();
    ctx.fill();
  } else if (suit === 'diamonds') {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.9);
    ctx.lineTo(s * 0.72, 0);
    ctx.lineTo(0, s * 0.9);
    ctx.lineTo(-s * 0.72, 0);
    ctx.closePath();
    ctx.fill();
  } else if (suit === 'clubs') {
    const lobeR = s * 0.38;
    // Top lobe
    ctx.beginPath();
    ctx.arc(0, -s * 0.32, lobeR, 0, Math.PI * 2);
    ctx.fill();

    // Left lobe
    ctx.beginPath();
    ctx.arc(-s * 0.36, s * 0.12, lobeR, 0, Math.PI * 2);
    ctx.fill();

    // Right lobe
    ctx.beginPath();
    ctx.arc(s * 0.36, s * 0.12, lobeR, 0, Math.PI * 2);
    ctx.fill();

    // Center fill
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Stem
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(s * 0.08, s * 0.5, s * 0.28, s * 0.85);
    ctx.lineTo(-s * 0.28, s * 0.85);
    ctx.quadraticCurveTo(-s * 0.08, s * 0.5, 0, 0);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draws standard corner indexes (rank letter/number and small suit pip)
 * at top-left and inverted bottom-right using bold Jumbo casino typography.
 */
function drawCornerIndexes(ctx, rank, suit, w, h) {
  const color = SUIT_INFO[suit].color;
  const isTen = rank === '10';

  function drawIndex(ox, oy, inverted = false) {
    ctx.save();
    ctx.translate(ox, oy);
    if (inverted) {
      ctx.rotate(Math.PI);
    }

    // Rank text - Jumbo high-contrast casino index
    ctx.fillStyle = color;
    ctx.font = `bold ${isTen ? 56 : 64}px "Arial", "Helvetica Neue", -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(rank, 0, 0);

    // Suit pip directly below rank
    drawPip(ctx, suit, 0, isTen ? 48 : 50, 36, false);

    ctx.restore();
  }

  // Top-left corner
  drawIndex(46, 52, false);

  // Bottom-right corner (inverted)
  drawIndex(w - 46, h - 52, true);
}

/**
 * Draws the big iconic Ace of Spades with ornate filigree engraving
 */
function drawOrnateAceOfSpades(ctx, cx, cy, w, h) {
  const size = 230;

  // Main bold spade
  drawPip(ctx, 'spades', cx, cy - 8, size, false);

  // Ornate white / cream filigree inside the spade
  ctx.save();
  ctx.strokeStyle = '#fbf8ee';
  ctx.lineWidth = 2.2;

  // Inner contour line
  ctx.beginPath();
  const is = size * 0.38;
  ctx.moveTo(cx, cy - 8 - is * 0.82);
  ctx.bezierCurveTo(cx + is * 0.15, cy - 8 - is * 0.4, cx + is * 1.05, cy - 8 + is * 0.1, cx + is * 0.5, cy - 8 + is * 0.55);
  ctx.bezierCurveTo(cx + is * 0.2, cy - 8 + is * 0.7, cx + is * 0.08, cy - 8 + is * 0.38, cx, cy - 8 + is * 0.32);
  ctx.bezierCurveTo(cx - is * 0.08, cy - 8 + is * 0.38, cx - is * 0.2, cy - 8 + is * 0.7, cx - is * 0.5, cy - 8 + is * 0.55);
  ctx.bezierCurveTo(cx - is * 1.05, cy - 8 + is * 0.1, cx - is * 0.15, cy - 8 - is * 0.4, cx, cy - 8 - is * 0.82);
  ctx.stroke();

  // Victorian floral scrollwork inside the lobes
  ctx.lineWidth = 1.6;
  [1, -1].forEach((dir) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8 + is * 0.2);
    ctx.bezierCurveTo(cx + dir * 25, cy - 8 + 10, cx + dir * 45, cy - 8 - 15, cx + dir * 25, cy - 8 - 35);
    ctx.bezierCurveTo(cx + dir * 10, cy - 8 - 45, cx + dir * 5, cy - 8 - 25, cx + dir * 16, cy - 8 - 22);
    ctx.stroke();

    // Spiral flourish
    ctx.beginPath();
    ctx.arc(cx + dir * 18, cy - 8 - 22, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fbf8ee';
    ctx.fill();
  });

  // Center crest inside the big spade
  ctx.fillStyle = '#fbf8ee';
  ctx.beginPath();
  ctx.arc(cx, cy - 8, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#141416';
  ctx.beginPath();
  ctx.arc(cx, cy - 8, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Elegant text banner beneath the big ace
  ctx.save();
  ctx.font = 'bold 15px "Georgia", serif';
  ctx.fillStyle = '#141416';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '5px';
  ctx.fillText('A C E   O F   S P A D E S', cx, cy + 130);

  ctx.font = 'italic 11px "Georgia", serif';
  ctx.fillStyle = 'rgba(20, 20, 22, 0.6)';
  ctx.letterSpacing = '2px';
  ctx.fillText('CLASSIC POKER DECK', cx, cy + 148);
  ctx.restore();
}

/**
 * Draws the half-figure for stylized double-ended court cards (King, Queen, Jack).
 * Rendered in original geometric vector court style.
 */
function drawCourtFigureHalf(ctx, rank, suit, cx, cy, fx, fy, fw, halfH, p) {
  const { primaryColor, secondaryColor, goldColor, skinColor, darkOutline } = p;

  // 1. Tunic / Shoulders / Robes
  ctx.save();

  // Base mantle
  ctx.fillStyle = primaryColor;
  ctx.beginPath();
  ctx.moveTo(108, cy);
  ctx.lineTo(132, 252);
  ctx.lineTo(210, 240);
  ctx.lineTo(302, 240);
  ctx.lineTo(380, 252);
  ctx.lineTo(404, cy);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = darkOutline;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Contrasting mantle side panels
  ctx.fillStyle = secondaryColor;
  // Left side panel
  ctx.beginPath();
  ctx.moveTo(108, cy);
  ctx.lineTo(132, 252);
  ctx.lineTo(178, 252);
  ctx.lineTo(158, cy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Right side panel
  ctx.beginPath();
  ctx.moveTo(404, cy);
  ctx.lineTo(380, 252);
  ctx.lineTo(334, 252);
  ctx.lineTo(354, cy);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Central chevron brocade embroidery on torso
  ctx.strokeStyle = goldColor;
  ctx.lineWidth = 2.5;
  for (let y = 265; y < cy; y += 22) {
    ctx.beginPath();
    ctx.moveTo(170, y + 10);
    ctx.lineTo(cx, y - 6);
    ctx.lineTo(342, y + 10);
    ctx.stroke();

    // Gold diamond rivet
    ctx.fillStyle = '#faebd7';
    ctx.beginPath();
    ctx.arc(cx, y - 6, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Rank-specific collar:
  if (rank === 'K') {
    // Royal Ermine Collar (White fur with black ermine tails)
    ctx.fillStyle = '#faf8f2';
    ctx.beginPath();
    ctx.moveTo(175, 238);
    ctx.quadraticCurveTo(150, 275, 195, 290);
    ctx.lineTo(cx, 260);
    ctx.lineTo(317, 290);
    ctx.quadraticCurveTo(362, 275, 337, 238);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = darkOutline;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Ermine tail spots
    ctx.fillStyle = '#141416';
    const ermineSpots = [
      [180, 270],
      [220, 262],
      [cx, 275],
      [292, 262],
      [332, 270]
    ];
    ermineSpots.forEach(([ex, ey]) => {
      ctx.beginPath();
      ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - 1.5, ey + 6);
      ctx.lineTo(ex + 1.5, ey + 6);
      ctx.closePath();
      ctx.fill();
    });
  } else if (rank === 'Q') {
    // Queen's Royal Pearl Necklace & Embroidered Bodice
    ctx.fillStyle = '#faf8f2';
    ctx.beginPath();
    ctx.moveTo(195, 238);
    ctx.quadraticCurveTo(cx, 268, 317, 238);
    ctx.lineTo(305, 252);
    ctx.quadraticCurveTo(cx, 282, 207, 252);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = darkOutline;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Pearl necklace beads
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 9; i++) {
      const px = 208 + i * 12;
      const py = 244 + Math.sin((i / 8) * Math.PI) * 14;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = goldColor;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  } else if (rank === 'J') {
    // Jack's Elizabethan Pleated Ruff Collar & Armored Pauldrons
    ctx.fillStyle = '#faf8f2';
    ctx.beginPath();
    ctx.ellipse(cx, 236, 52, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = darkOutline;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Ruff pleats
    ctx.strokeStyle = '#c5bfb4';
    ctx.lineWidth = 1;
    for (let a = -0.8; a <= 0.8; a += 0.16) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.sin(a) * 20, 236 - Math.cos(a) * 4);
      ctx.lineTo(cx + Math.sin(a) * 50, 236 + Math.cos(a) * 14);
      ctx.stroke();
    }

    // Steel pauldrons (curved shoulder plates)
    ctx.fillStyle = '#7a8c9e';
    ctx.beginPath();
    ctx.ellipse(146, 265, 20, 14, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = goldColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#7a8c9e';
    ctx.beginPath();
    ctx.ellipse(366, 265, 20, 14, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = goldColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // 2. Head, Hair & Facial Features
  // Hair base
  ctx.fillStyle = rank === 'Q' ? '#c48e3d' : rank === 'K' ? '#5a3d24' : '#684522';
  ctx.beginPath();
  ctx.ellipse(cx, 196, 38, 44, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = darkOutline;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Face oval
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.ellipse(cx, 196, 29, 35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = darkOutline;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Eyes & Eyebrows
  ctx.fillStyle = darkOutline;
  // Left eye
  ctx.beginPath();
  ctx.arc(cx - 12, 190, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 18, 184);
  ctx.quadraticCurveTo(cx - 12, 181, cx - 6, 184);
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Right eye
  ctx.beginPath();
  ctx.arc(cx + 12, 190, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 6, 184);
  ctx.quadraticCurveTo(cx + 12, 181, cx + 18, 184);
  ctx.stroke();

  // Nose
  ctx.beginPath();
  ctx.moveTo(cx, 187);
  ctx.lineTo(cx + 2.5, 198);
  ctx.lineTo(cx - 2, 201);
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Specific Mouth / Beard / Features:
  if (rank === 'K') {
    // Grand royal bifurcated beard and mustache
    ctx.fillStyle = '#5a3d24';
    // Mustache
    ctx.beginPath();
    ctx.moveTo(cx - 18, 206);
    ctx.quadraticCurveTo(cx - 4, 204, cx, 207);
    ctx.quadraticCurveTo(cx + 4, 204, cx + 18, 206);
    ctx.quadraticCurveTo(cx + 10, 213, cx, 210);
    ctx.quadraticCurveTo(cx - 10, 213, cx - 18, 206);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = darkOutline;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Dual-lobed beard extending down to collar
    ctx.beginPath();
    ctx.moveTo(cx - 15, 212);
    ctx.quadraticCurveTo(cx - 25, 235, cx - 10, 245);
    ctx.lineTo(cx, 226);
    ctx.lineTo(cx + 10, 245);
    ctx.quadraticCurveTo(cx + 25, 235, cx + 15, 212);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (rank === 'Q') {
    // Rosy cheeks
    ctx.fillStyle = 'rgba(224, 75, 75, 0.22)';
    ctx.beginPath();
    ctx.arc(cx - 16, 200, 6, 0, Math.PI * 2);
    ctx.arc(cx + 16, 200, 6, 0, Math.PI * 2);
    ctx.fill();

    // Elegant ruby lips
    ctx.fillStyle = '#c41e24';
    ctx.beginPath();
    ctx.moveTo(cx - 7, 211);
    ctx.quadraticCurveTo(cx, 209, cx + 7, 211);
    ctx.quadraticCurveTo(cx, 216, cx - 7, 211);
    ctx.closePath();
    ctx.fill();

    // Flowing hair curls falling over shoulders
    ctx.fillStyle = '#c48e3d';
    ctx.beginPath();
    ctx.moveTo(cx - 28, 205);
    ctx.quadraticCurveTo(cx - 38, 235, cx - 28, 252);
    ctx.quadraticCurveTo(cx - 22, 235, cx - 26, 215);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + 28, 205);
    ctx.quadraticCurveTo(cx + 38, 235, cx + 28, 252);
    ctx.quadraticCurveTo(cx + 22, 235, cx + 26, 215);
    ctx.fill();
    ctx.stroke();
  } else if (rank === 'J') {
    // Youthful lips & jawline
    ctx.fillStyle = '#a84c4c';
    ctx.beginPath();
    ctx.moveTo(cx - 6, 212);
    ctx.lineTo(cx + 6, 212);
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Sideburns
    ctx.fillStyle = '#684522';
    ctx.beginPath();
    ctx.moveTo(cx - 27, 185);
    ctx.lineTo(cx - 24, 204);
    ctx.lineTo(cx - 20, 198);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + 27, 185);
    ctx.lineTo(cx + 24, 204);
    ctx.lineTo(cx + 20, 198);
    ctx.closePath();
    ctx.fill();
  }

  // 3. Headwear (Crown / Tiara / Renaissance Cap)
  if (rank === 'K') {
    // Grand Imperial Gold Crown
    // Velvet cap dome
    ctx.fillStyle = '#8e1218';
    ctx.beginPath();
    ctx.moveTo(cx - 30, 166);
    ctx.quadraticCurveTo(cx, 134, cx + 30, 166);
    ctx.closePath();
    ctx.fill();

    // Crown base band
    ctx.fillStyle = goldColor;
    ctx.fillRect(cx - 35, 158, 70, 14);
    ctx.strokeStyle = darkOutline;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(cx - 35, 158, 70, 14);

    // Jewels on base band
    const jewelColors = ['#c41e24', '#1e3860', '#c41e24', '#1e3860', '#c41e24'];
    jewelColors.forEach((jc, idx) => {
      ctx.fillStyle = jc;
      ctx.beginPath();
      ctx.arc(cx - 26 + idx * 13, 165, 3.2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Crown peaks
    ctx.fillStyle = goldColor;
    ctx.beginPath();
    ctx.moveTo(cx - 35, 158);
    ctx.lineTo(cx - 28, 136);
    ctx.lineTo(cx - 15, 150);
    ctx.lineTo(cx, 124); // Center peak
    ctx.lineTo(cx + 15, 150);
    ctx.lineTo(cx + 28, 136);
    ctx.lineTo(cx + 35, 158);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Imperial Cross Finial on center peak
    ctx.fillStyle = goldColor;
    ctx.fillRect(cx - 2, 114, 4, 12);
    ctx.fillRect(cx - 6, 117, 12, 4);
    ctx.beginPath();
    ctx.arc(cx - 28, 136, 3, 0, Math.PI * 2);
    ctx.arc(cx + 28, 136, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (rank === 'Q') {
    // Royal Translucent Veil behind tiara
    ctx.fillStyle = 'rgba(250, 246, 235, 0.65)';
    ctx.beginPath();
    ctx.moveTo(cx - 38, 160);
    ctx.quadraticCurveTo(cx - 52, 210, cx - 44, 260);
    ctx.lineTo(cx + 44, 260);
    ctx.quadraticCurveTo(cx + 52, 210, cx + 38, 160);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
    ctx.stroke();

    // Queen's Gold Tiara
    ctx.fillStyle = goldColor;
    ctx.beginPath();
    ctx.moveTo(cx - 28, 168);
    ctx.lineTo(cx - 24, 142);
    ctx.lineTo(cx - 14, 154);
    ctx.lineTo(cx, 130); // Center peak
    ctx.lineTo(cx + 14, 154);
    ctx.lineTo(cx + 24, 142);
    ctx.lineTo(cx + 28, 168);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = darkOutline;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Pearl finials on tiara peaks
    ctx.fillStyle = '#ffffff';
    [-24, -14, 0, 14, 24].forEach((px, idx) => {
      const py = idx === 2 ? 129 : idx === 0 || idx === 4 ? 141 : 153;
      ctx.beginPath();
      ctx.arc(cx + px, py, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = goldColor;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    });
  } else if (rank === 'J') {
    // Renaissance Page Velvet Beret with Sweeping Feather Plume
    ctx.save();
    ctx.translate(cx, 166);
    ctx.rotate(-0.1);

    // Velvet cap puff
    ctx.fillStyle = secondaryColor;
    ctx.beginPath();
    ctx.ellipse(0, -6, 42, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = darkOutline;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Cap headband with gold trim
    ctx.fillStyle = goldColor;
    ctx.fillRect(-34, 4, 68, 8);
    ctx.strokeRect(-34, 4, 68, 8);

    // Gold brooch / clasp holding plume
    ctx.fillStyle = '#faebd7';
    ctx.beginPath();
    ctx.arc(-22, 6, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = goldColor;
    ctx.stroke();

    // Sweeping ostrich feather plume
    ctx.strokeStyle = '#faf7ee';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(-22, 6);
    ctx.bezierCurveTo(-26, -26, 8, -48, 48, -40);
    ctx.stroke();

    ctx.strokeStyle = goldColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  // 4. Regalia & Weapons (Broadsword, Sceptre, Halberd)
  if (rank === 'K') {
    // Upright Royal Broadsword (Right side)
    const swX = 356;
    // Hand grasping hilt
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.ellipse(swX, 278, 9, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = darkOutline;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Gold pommel & grip
    ctx.fillStyle = goldColor;
    ctx.fillRect(swX - 3, 274, 6, 20);
    ctx.beginPath();
    ctx.arc(swX, 296, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Gold crossguard
    ctx.fillRect(swX - 18, 268, 36, 7);
    ctx.strokeRect(swX - 18, 268, 36, 7);

    // Gleaming steel blade rising upward
    ctx.fillStyle = '#d8e1ea';
    ctx.beginPath();
    ctx.moveTo(swX - 5.5, 268);
    ctx.lineTo(swX - 5.5, 142);
    ctx.lineTo(swX, 130); // Tip
    ctx.lineTo(swX + 5.5, 142);
    ctx.lineTo(swX + 5.5, 268);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = darkOutline;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Fuller (center groove)
    ctx.strokeStyle = '#8fa0b5';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(swX, 262);
    ctx.lineTo(swX, 146);
    ctx.stroke();

    // Left hand holding golden orb with suit pip
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.ellipse(156, 280, 9, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = darkOutline;
    ctx.stroke();

    drawPip(ctx, suit, 156, 236, 32, false);
  } else if (rank === 'Q') {
    // Royal Sceptre & Flower (Right side)
    const scX = 346;
    // Hand
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.ellipse(scX, 276, 8, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = darkOutline;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Golden sceptre staff
    ctx.strokeStyle = goldColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(scX, 310);
    ctx.lineTo(scX, 218);
    ctx.stroke();

    // Sceptre finial holding blooming suit pip
    ctx.fillStyle = goldColor;
    ctx.beginPath();
    ctx.arc(scX, 214, 8, 0, Math.PI * 2);
    ctx.fill();

    drawPip(ctx, suit, scX, 188, 32, false);

    // Left hand resting gracefully on waist
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.ellipse(168, 282, 8, 7, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = darkOutline;
    ctx.stroke();

    // Gold bracelet
    ctx.strokeStyle = goldColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(168, 282, 8, 0, Math.PI * 2);
    ctx.stroke();
  } else if (rank === 'J') {
    // Knight's Halberd / Poleaxe (Right side)
    const hlX = 352;
    // Hand
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.ellipse(hlX, 276, 9, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = darkOutline;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Shaft
    ctx.strokeStyle = '#5a3d24';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(hlX, 325);
    ctx.lineTo(hlX, 134);
    ctx.stroke();

    // Steel poleaxe head & spear point
    ctx.fillStyle = '#8fa0b5';
    // Spear point
    ctx.beginPath();
    ctx.moveTo(hlX - 5, 160);
    ctx.lineTo(hlX, 126);
    ctx.lineTo(hlX + 5, 160);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = darkOutline;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Crescent axe blade
    ctx.beginPath();
    ctx.moveTo(hlX - 4, 154);
    ctx.quadraticCurveTo(hlX - 28, 160, hlX - 22, 185);
    ctx.lineTo(hlX - 4, 178);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Pennant / suit emblem on poleaxe
    drawPip(ctx, suit, hlX - 32, 170, 26, false);

    // Left hand resting on sword hilt
    ctx.fillStyle = skinColor;
    ctx.beginPath();
    ctx.ellipse(160, 282, 8, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = darkOutline;
    ctx.stroke();

    // Gold hilt
    ctx.fillStyle = goldColor;
    ctx.beginPath();
    ctx.arc(160, 292, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draws stylized double-ended court card faces for J, Q, K
 */
function drawDoubleEndedCourtFigure(ctx, rank, suit, w, h) {
  const fw = 344;
  const fh = 496;
  const fx = (w - fw) / 2; // 84
  const fy = (h - fh) / 2; // 114
  const cx = w / 2;        // 256
  const cy = h / 2;        // 362
  const halfH = fh / 2;    // 248

  const isRed = suit === 'hearts' || suit === 'diamonds';
  const primaryColor = isRed ? '#c41e24' : '#141416';
  const secondaryColor = isRed ? '#182638' : '#94141a';
  const goldColor = '#d4af37';
  const goldLight = '#f5d97a';
  const skinColor = '#faebd7';
  const darkOutline = '#121214';

  ctx.save();

  // 1. Court outer frame and background
  ctx.fillStyle = '#faf6ed';
  ctx.fillRect(fx, fy, fw, fh);

  // Subtle diamond micro-pattern in the background of the court frame
  ctx.save();
  ctx.beginPath();
  ctx.rect(fx, fy, fw, fh);
  ctx.clip();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.12)';
  ctx.lineWidth = 1;
  const bStep = 24;
  for (let x = fx - fh; x < fx + fw + fh; x += bStep) {
    ctx.beginPath();
    ctx.moveTo(x, fy);
    ctx.lineTo(x + fh, fy + fh);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, fy + fh);
    ctx.lineTo(x + fh, fy);
    ctx.stroke();
  }
  ctx.restore();

  // 2. Draw Top Half (Upright portrait)
  ctx.save();
  ctx.beginPath();
  ctx.rect(fx, fy, fw, halfH);
  ctx.clip();
  drawCourtFigureHalf(ctx, rank, suit, cx, cy, fx, fy, fw, halfH, {
    primaryColor,
    secondaryColor,
    goldColor,
    goldLight,
    skinColor,
    darkOutline,
    isTop: true
  });
  ctx.restore();

  // 3. Draw Bottom Half (Rotated 180 degrees around card center)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI);
  ctx.translate(-cx, -cy);
  ctx.beginPath();
  ctx.rect(fx, fy, fw, halfH);
  ctx.clip();
  drawCourtFigureHalf(ctx, rank, suit, cx, cy, fx, fy, fw, halfH, {
    primaryColor,
    secondaryColor,
    goldColor,
    goldLight,
    skinColor,
    darkOutline,
    isTop: false
  });
  ctx.restore();

  // 4. Central Horizontal Dividing Bar (Signature of authentic double-ended cards)
  ctx.save();
  const divH = 10;
  const divY = cy - divH / 2;
  ctx.fillStyle = '#181b24';
  ctx.fillRect(fx, divY, fw, divH);

  // Gold pinstripes
  ctx.strokeStyle = goldColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(fx, divY);
  ctx.lineTo(fx + fw, divY);
  ctx.moveTo(fx, divY + divH);
  ctx.lineTo(fx + fw, divY + divH);
  ctx.stroke();

  // Center decorative diamond cartouche on the dividing bar
  ctx.fillStyle = goldColor;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 8);
  ctx.lineTo(cx + 16, cy);
  ctx.lineTo(cx, cy + 8);
  ctx.lineTo(cx - 16, cy);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = primaryColor;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 5. Outer Court Border Frames
  // Inner gold border
  ctx.strokeStyle = goldColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(fx + 6, fy + 6, fw - 12, fh - 12);

  // Primary suit-colored outer border
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 3.5;
  ctx.strokeRect(fx, fy, fw, fh);

  // Corner quadrant decorations
  const cornerSize = 22;
  const corners = [
    [fx + 6, fy + 6, 1, 1],
    [fx + fw - 6, fy + 6, -1, 1],
    [fx + 6, fy + fh - 6, 1, -1],
    [fx + fw - 6, fy + fh - 6, -1, -1]
  ];
  corners.forEach(([x, y, sx, sy]) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);
    ctx.fillStyle = goldColor;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(cornerSize, 0);
    ctx.lineTo(0, cornerSize);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  ctx.restore();
}

/**
 * Generates the complete HTML Canvas for any card in the 52-card deck.
 * Rendered at 1024x1448 retina resolution with high-contrast Jumbo indexes and bold pips.
 * @param {string} suit - 'spades' | 'hearts' | 'diamonds' | 'clubs'
 * @param {string} rank - 'A' | '2'..'10' | 'J' | 'Q' | 'K'
 * @returns {HTMLCanvasElement}
 */
export function createCardFaceCanvas(suit, rank) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1448;
  const ctx = canvas.getContext('2d');

  // Scale 2x for double resolution & crisp edges
  ctx.scale(2, 2);

  const w = 512;
  const h = 724;
  const cx = w / 2;
  const cy = h / 2;

  // 1. Crisp clean bright white cardstock background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  // Subtle clean paper border guide
  ctx.strokeStyle = 'rgba(210, 200, 185, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(16, 16, w - 32, h - 32);

  // 2. Central Card Art / Pips:
  if (rank === 'A') {
    if (suit === 'spades') {
      // Big ornate Ace of Spades
      drawOrnateAceOfSpades(ctx, cx, cy, w, h);
    } else {
      // Large clean centered Ace pip
      drawPip(ctx, suit, cx, cy, 145, false);
    }
  } else if (['J', 'Q', 'K'].includes(rank)) {
    // Stylized double-ended court figure in original vector style
    drawDoubleEndedCourtFigure(ctx, rank, suit, w, h);
  } else if (PIP_CONFIGS[rank]) {
    // Standard numbered pip layout (2 through 10) with enlarged readable pips
    const pips = PIP_CONFIGS[rank];
    const pipSize = rank === '10' ? 62 : rank === '9' || rank === '8' || rank === '7' ? 68 : 74;
    pips.forEach((pip) => {
      const px = pip.x * w;
      const py = pip.y * h;
      drawPip(ctx, suit, px, py, pipSize, Boolean(pip.inv));
    });
  }

  // 3. Corner Indexes (Always present on all 52 cards, drawn on top for crystal clarity)
  drawCornerIndexes(ctx, rank, suit, w, h);

  return canvas;
}

const cardFaceTextureCache = new Map();

/**
 * Creates a Three.js CanvasTexture for a specific card face with 16x anisotropic filtering.
 * Reuses cached textures across hands to eliminate memory overhead.
 */
export function createCardFaceTexture(suit = 'spades', rank = 'A') {
  const key = `${suit}_${rank}`;
  if (cardFaceTextureCache.has(key)) {
    return cardFaceTextureCache.get(key);
  }

  const canvas = createCardFaceCanvas(suit, rank);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  cardFaceTextureCache.set(key, texture);
  return texture;
}
