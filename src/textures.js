import * as THREE from 'three';

/**
 * Procedural canvas textures for the 3D Blackjack scene.
 * No external image files used.
 */

export function createFeltTexture(feltColorHex = '#105c35') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Base casino green or chosen color
  ctx.fillStyle = feltColorHex;
  ctx.fillRect(0, 0, 512, 512);

  // Fiber noise & micro-weave texture
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 14;
    data[i] = Math.min(255, Math.max(0, data[i] + noise * 0.6));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise * 0.7));
  }
  ctx.putImageData(imgData, 0, 0);

  // Subtle criss-cross weave
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.018)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 512; i += 4) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

export function createFeltBumpMap() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  const imgData = ctx.getImageData(0, 0, 256, 256);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = 128 + Math.floor((Math.random() - 0.5) * 35);
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  return texture;
}

/**
 * Creates the high-resolution canvas texture for table markings:
 * - "BLACKJACK PAYS 3 TO 2"
 * - "DEALER MUST STAND ON 17"
 * - Betting circle
 * - Dealer card area
 */
export function createFeltMarkingsTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, 2048, 1024);

  const centerX = 1024;
  const centerY = 0; // Dealer flat edge

  // Helper: rounded rectangle
  function drawRoundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // Helper: draw text along an arc centered at (centerX, centerY)
  function drawCurvedText(text, radius, font, color, letterSpacing = 2) {
    ctx.save();
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const charWidths = [];
    for (let i = 0; i < text.length; i++) {
      charWidths.push(ctx.measureText(text[i]).width + letterSpacing);
    }
    const totalLength = charWidths.reduce((a, b) => a + b, 0);
    const totalAngle = totalLength / radius;

    let currentAngle = Math.PI / 2 + totalAngle / 2;

    for (let i = 0; i < text.length; i++) {
      const halfCharAngle = (charWidths[i] / 2) / radius;
      const charAngle = currentAngle - halfCharAngle;

      const x = centerX + radius * Math.cos(charAngle);
      const y = centerY + radius * Math.sin(charAngle);
      const rot = charAngle - Math.PI / 2;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);

      ctx.shadowColor = 'rgba(4, 20, 10, 0.6)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetY = 2;

      ctx.fillText(text[i], 0, 0);
      ctx.restore();

      currentAngle -= charWidths[i] / radius;
    }
    ctx.restore();
  }

  // 1. Subtle Outer Table Perimeter Borders
  ctx.save();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 980, 0.2, Math.PI - 0.2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(212, 175, 55, 0.2)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, 966, 0.22, Math.PI - 0.22);
  ctx.stroke();
  ctx.restore();

  // 2. Dealer Card Area
  const dealerAreaY = 195;
  const cardW = 74;
  const cardH = 104;
  const cardCornerR = 6;
  const boxSpacing = 16;
  const boxY = dealerAreaY - 45;

  // Outer frame for dealer area
  ctx.save();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(centerX - 100, dealerAreaY - 78, 200, 150, 10);
  ctx.stroke();

  // Label: "DEALER"
  ctx.font = 'bold 15px "Arial", sans-serif';
  ctx.fillStyle = '#d4af37';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '4px';
  ctx.fillText('D E A L E R', centerX, dealerAreaY - 64);

  // Two card placeholder boxes (Upcard & Hole card)
  const box1X = centerX - cardW - boxSpacing / 2;
  const box2X = centerX + boxSpacing / 2;

  [box1X, box2X].forEach((bx) => {
    // Translucent dark felt fill
    ctx.fillStyle = 'rgba(4, 28, 14, 0.45)';
    drawRoundedRect(bx, boxY, cardW, cardH, cardCornerR);
    ctx.fill();

    // Solid gold border
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    drawRoundedRect(bx, boxY, cardW, cardH, cardCornerR);
    ctx.stroke();

    // Inner dashed accent
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    drawRoundedRect(bx + 4, boxY + 4, cardW - 8, cardH - 8, cardCornerR - 2);
    ctx.stroke();
    ctx.setLineDash([]);
  });
  ctx.restore();

  // 3. "DEALER MUST STAND ON 17"
  drawCurvedText(
    'DEALER MUST STAND ON 17',
    440,
    'bold 26px "Trebuchet MS", "Arial", sans-serif',
    '#e8dcbe',
    3
  );

  // 4. "BLACKJACK PAYS 3 TO 2"
  drawCurvedText(
    '◆   BLACKJACK PAYS 3 TO 2   ◆',
    605,
    'bold 40px "Georgia", "Times New Roman", serif',
    '#d4af37',
    4
  );

  // 5. Betting Circle
  const betCenterY = 785;
  const outerR = 70;

  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, betCenterY, outerR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(4, 24, 12, 0.45)';
  ctx.fill();

  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(centerX, betCenterY, outerR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(212, 175, 55, 0.75)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.arc(centerX, betCenterY, 61, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = 'rgba(212, 175, 55, 0.9)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(centerX, betCenterY, 52, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = 'bold 22px "Arial", sans-serif';
  ctx.fillStyle = '#d4af37';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1;
  ctx.fillText('BET', centerX, betCenterY);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Creates the procedural ornate red card back texture.
 * Features:
 * - Crisp white card margin border
 * - Deep crimson radial gradient field
 * - Symmetrical diamond lattice filigree
 * - Corner Victorian flourishes
 * - Two-way symmetrical dual ornate rosettes with sunburst petals and central jewel
 * - Fine air-cushion micro-finish
 */
let cachedCardBackTexture = null;

export function createCardBackTexture() {
  if (cachedCardBackTexture) {
    return cachedCardBackTexture;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 724;
  const ctx = canvas.getContext('2d');

  const w = 512;
  const h = 724;
  const cx = w / 2; // 256
  const cy = h / 2; // 362

  // 1. Crisp white/cream cardstock border
  ctx.fillStyle = '#f8f6f0';
  ctx.fillRect(0, 0, w, h);

  // Helper: rounded rectangle
  function roundedRect(x, y, rw, rh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + rw - r, y);
    ctx.quadraticCurveTo(x + rw, y, x + rw, y + r);
    ctx.lineTo(x + rw, y + rh - r);
    ctx.quadraticCurveTo(x + rw, y + rh, x + rw - r, y + rh);
    ctx.lineTo(x + r, y + rh);
    ctx.quadraticCurveTo(x, y + rh, x, y + rh - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // 2. Red pattern boundary
  const margin = 20;
  const innerW = w - margin * 2; // 472
  const innerH = h - margin * 2; // 684
  const cornerR = 12;

  ctx.save();
  roundedRect(margin, margin, innerW, innerH, cornerR);
  ctx.clip();

  // Deep rich crimson background gradient
  const redGrad = ctx.createRadialGradient(cx, cy, 50, cx, cy, 380);
  redGrad.addColorStop(0, '#9c151c');
  redGrad.addColorStop(0.7, '#820f15');
  redGrad.addColorStop(1, '#61070b');
  ctx.fillStyle = redGrad;
  ctx.fillRect(margin, margin, innerW, innerH);

  // 3. Ornate Diamond Lattice (Guilloché cross-hatch)
  const step = 20;
  ctx.save();
  ctx.lineWidth = 1.2;

  // Dark crimson diamond lines
  ctx.strokeStyle = 'rgba(55, 4, 7, 0.45)';
  for (let d = -h; d < w + h; d += step) {
    ctx.beginPath();
    ctx.moveTo(d, 0);
    ctx.lineTo(d + h, h);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(d, h);
    ctx.lineTo(d + h, 0);
    ctx.stroke();
  }

  // Pale gold/white highlight lines
  ctx.strokeStyle = 'rgba(255, 230, 215, 0.22)';
  ctx.lineWidth = 0.8;
  for (let d = -h; d < w + h; d += step) {
    ctx.beginPath();
    ctx.moveTo(d + 1, 0);
    ctx.lineTo(d + h + 1, h);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(d + 1, h);
    ctx.lineTo(d + h + 1, 0);
    ctx.stroke();
  }

  // Lattice intersection micro-diamonds
  ctx.fillStyle = 'rgba(255, 240, 225, 0.4)';
  for (let x = margin; x <= w - margin; x += step) {
    for (let y = margin; y <= h - margin; y += step) {
      if ((x / step + y / step) % 2 === 0) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();

  // 4. Two-Way Symmetrical Dual Ornate Rosette Medallions
  function drawRosette(rcx, rcy) {
    ctx.save();
    ctx.translate(rcx, rcy);

    // Outer scalloped beaded ring
    const beadRadius = 68;
    const numBeads = 28;
    ctx.fillStyle = '#fbe8c8';
    for (let i = 0; i < numBeads; i++) {
      const angle = (i / numBeads) * Math.PI * 2;
      const bx = beadRadius * Math.cos(angle);
      const by = beadRadius * Math.sin(angle);
      ctx.beginPath();
      ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Outer concentric gold rings
    ctx.strokeStyle = '#fbe8c8';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, beadRadius - 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(70, 5, 8, 0.7)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, beadRadius - 7, 0, Math.PI * 2);
    ctx.stroke();

    // 16-point sunburst petals
    const numPetals = 16;
    for (let i = 0; i < numPetals; i++) {
      const angle = (i / numPetals) * Math.PI * 2;
      ctx.save();
      ctx.rotate(angle);

      // Gold petal outline
      ctx.fillStyle = i % 2 === 0 ? '#fae3bc' : '#7d0d12';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(8, 25, 0, 52);
      ctx.quadraticCurveTo(-8, 25, 0, 0);
      ctx.fill();

      ctx.strokeStyle = '#fbe8c8';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    }

    // Inner medallion circle
    ctx.fillStyle = '#590509';
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#fbe8c8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Center gold floral 8-point star
    ctx.fillStyle = '#fae3bc';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(4, 8);
      ctx.lineTo(0, 20);
      ctx.lineTo(-4, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Center ruby jewel dot
    ctx.fillStyle = '#a6171f';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff4e0';
    ctx.beginPath();
    ctx.arc(1, -1, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Draw top & bottom rosettes
  drawRosette(cx, 225);
  drawRosette(cx, h - 225);

  // 5. Center Cartouche / Emblem linking both halves
  ctx.save();
  ctx.translate(cx, cy);

  // Central ornate oval cartouche
  ctx.fillStyle = '#540508';
  ctx.beginPath();
  ctx.ellipse(0, 0, 55, 36, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#fbe8c8';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 230, 200, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 0, 48, 29, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Central 4-point gold star crest
  ctx.fillStyle = '#fae3bc';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(5, 7);
    ctx.lineTo(0, i % 2 === 0 ? 25 : 16);
    ctx.lineTo(-5, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = '#9c151c';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // 6. Victorian Corner Flourishes
  function drawCornerScroll(ox, oy, sx, sy) {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(sx, sy);
    ctx.strokeStyle = '#fbe8c8';
    ctx.lineWidth = 1.4;

    ctx.beginPath();
    ctx.moveTo(0, 35);
    ctx.bezierCurveTo(8, 20, 20, 8, 35, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(16, 16, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#fae3bc';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(10, 26, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(26, 10, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawCornerScroll(margin + 10, margin + 10, 1, 1);
  drawCornerScroll(w - margin - 10, margin + 10, -1, 1);
  drawCornerScroll(margin + 10, h - margin - 10, 1, -1);
  drawCornerScroll(w - margin - 10, h - margin - 10, -1, -1);

  // 7. Inner Pinstripe Border
  ctx.strokeStyle = '#fae3bc';
  ctx.lineWidth = 1.5;
  roundedRect(margin + 8, margin + 8, innerW - 16, innerH - 16, cornerR - 3);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(70, 5, 8, 0.8)';
  ctx.lineWidth = 1;
  roundedRect(margin + 11, margin + 11, innerW - 22, innerH - 22, cornerR - 5);
  ctx.stroke();

  ctx.restore(); // Restore clip

  // 8. Outer Framing Lines
  ctx.strokeStyle = '#4d0508';
  ctx.lineWidth = 2;
  roundedRect(margin, margin, innerW, innerH, cornerR);
  ctx.stroke();

  // 9. Authentic Air-Cushion Micro-Dimple Texture
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  for (let y = 0; y < h; y += 3) {
    for (let x = 0; x < w; x += 3) {
      const idx = (y * w + x) * 4;
      const noise = (Math.random() - 0.5) * 10;
      data[idx] = Math.min(255, Math.max(0, data[idx] + noise));
      data[idx + 1] = Math.min(255, Math.max(0, data[idx + 1] + noise));
      data[idx + 2] = Math.min(255, Math.max(0, data[idx + 2] + noise));
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  cachedCardBackTexture = texture;
  return texture;
}

export function createLeatherTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Rich cognac / deep saddle leather base
  ctx.fillStyle = '#3a2014';
  ctx.fillRect(0, 0, 512, 512);

  // Base grain noise
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    data[i] = Math.min(255, Math.max(0, data[i] + n * 1.2));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n * 0.8));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n * 0.5));
  }
  ctx.putImageData(imgData, 0, 0);

  // Pebbled leather grain spots
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 1 + Math.random() * 2.2;
    ctx.fillStyle = 'rgba(25, 12, 6, 0.4)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(95, 52, 30, 0.25)';
    ctx.beginPath();
    ctx.arc(x + 0.6, y + 0.6, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  return texture;
}

export function createWoodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Dark mahogany wood tone
  ctx.fillStyle = '#24140b';
  ctx.fillRect(0, 0, 512, 512);

  // Wood grain streaks
  for (let i = 0; i < 512; i += 2) {
    const alpha = 0.05 + Math.sin(i * 0.08) * 0.04 + (Math.random() - 0.5) * 0.03;
    ctx.strokeStyle = Math.random() > 0.4 ? `rgba(50, 28, 16, ${alpha})` : `rgba(15, 8, 4, ${alpha * 1.5})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.bezierCurveTo(150, i + Math.random() * 4, 350, i - Math.random() * 4, 512, i);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

export function createFloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Dark warm casino carpet
  ctx.fillStyle = '#14110e';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle diamond pattern in warm bronze
  const step = 64;
  ctx.strokeStyle = 'rgba(56, 44, 32, 0.28)';
  ctx.lineWidth = 1.5;
  for (let x = -512; x < 1024; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 512, 512);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, 512);
    ctx.lineTo(x + 512, 0);
    ctx.stroke();
  }

  const imgData = ctx.getImageData(0, 0, 512, 512);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 8;
    data[i] = Math.min(255, Math.max(0, data[i] + n));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12);
  return texture;
}
