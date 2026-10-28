import * as THREE from 'three';

/**
 * 3D Casino Chips & Bankroll Model.
 * Supports $1, $5, $25, and $100 denominations.
 * Procedural canvas textures with no external image files.
 */

export const CHIP_DENOMS = [1, 5, 25, 100, 500, 1000];

export const CHIP_CONFIGS = {
  1: {
    value: 1,
    label: '$1',
    baseColor: '#f0f0ee',
    stripeColor: '#2563eb',
    textColor: '#1e3a8a',
    ringColor: '#60a5fa'
  },
  5: {
    value: 5,
    label: '$5',
    baseColor: '#b91c1c',
    stripeColor: '#ffffff',
    textColor: '#ffffff',
    ringColor: '#f87171'
  },
  25: {
    value: 25,
    label: '$25',
    baseColor: '#15803d',
    stripeColor: '#fef08a',
    textColor: '#fef08a',
    ringColor: '#4ade80'
  },
  100: {
    value: 100,
    label: '$100',
    baseColor: '#171717',
    stripeColor: '#facc15',
    textColor: '#facc15',
    ringColor: '#d4af37'
  },
  500: {
    value: 500,
    label: '$500',
    baseColor: '#6b21a8',
    stripeColor: '#fde047',
    textColor: '#ffffff',
    ringColor: '#c084fc'
  },
  1000: {
    value: 1000,
    label: '$1000',
    baseColor: '#c2410c',
    stripeColor: '#facc15',
    textColor: '#fef08a',
    ringColor: '#fb923c'
  }
};

const textureCache = new Map();

/**
 * Generates the circular top/bottom face texture for a chip.
 */
function createChipFaceTexture(denom) {
  const cacheKey = `face_${denom}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey);
  }

  const config = CHIP_CONFIGS[denom];
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const cx = 128;
  const cy = 128;
  const r = 124;

  // 1. Base Circular Body
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = config.baseColor;
  ctx.fill();

  // 2. Eight Edge Stripe Inserts (Trapezoidal blocks)
  const numStripes = 8;
  for (let i = 0; i < numStripes; i++) {
    const angle = (i / numStripes) * Math.PI * 2;
    const stripeSpan = 0.16; // angular width in radians

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, angle - stripeSpan / 2, angle + stripeSpan / 2);
    ctx.arc(cx, cy, r * 0.72, angle + stripeSpan / 2, angle - stripeSpan / 2, true);
    ctx.closePath();
    ctx.fillStyle = config.stripeColor;
    ctx.fill();
    ctx.restore();
  }

  // 3. Outer Rim Border Line
  ctx.beginPath();
  ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 4. Inner Concentric Ring
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
  ctx.strokeStyle = config.ringColor;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Dotted inner accent ring
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.64, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // 5. Center Denomination Inset Circle
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.52, 0, Math.PI * 2);
  ctx.fillStyle = config.baseColor;
  ctx.fill();
  ctx.strokeStyle = config.ringColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // 6. Denomination Text
  ctx.font = `bold ${denom >= 1000 ? 44 : denom >= 100 ? 54 : 64}px "Arial", sans-serif`;
  ctx.fillStyle = config.textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.fillText(config.label, cx, cy + 2);

  // Subtle clay texture grain
  const imgData = ctx.getImageData(0, 0, 256, 256);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) {
      const n = (Math.random() - 0.5) * 8;
      data[i] = Math.min(255, Math.max(0, data[i] + n));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Generates the cylindrical rim edge texture for a chip.
 */
function createChipRimTexture(denom) {
  const cacheKey = `rim_${denom}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey);
  }

  const config = CHIP_CONFIGS[denom];
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  // Base rim color
  ctx.fillStyle = config.baseColor;
  ctx.fillRect(0, 0, 512, 64);

  // 8 vertical stripes matching face inserts
  const step = 512 / 8;
  const stripeW = step * 0.32;
  ctx.fillStyle = config.stripeColor;

  for (let i = 0; i < 8; i++) {
    const x = i * step + (step - stripeW) / 2;
    ctx.fillRect(x, 0, stripeW, 64);

    // Subtle edge shadows
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(x, 0, 1.5, 64);
    ctx.fillRect(x + stripeW - 1.5, 0, 1.5, 64);
    ctx.fillStyle = config.stripeColor;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  textureCache.set(cacheKey, texture);
  return texture;
}

/**
 * Creates a physical 3D chip mesh:
 * - Radius: 0.018m (36mm)
 * - Height: 0.0034m (3.4mm)
 */
export function createChipMesh(denom) {
  const radius = 0.018;
  const height = 0.0034;
  const geometry = new THREE.CylinderGeometry(radius, radius, height, 32);

  const faceTexture = createChipFaceTexture(denom);
  const rimTexture = createChipRimTexture(denom);

  const rimMaterial = new THREE.MeshStandardMaterial({
    map: rimTexture,
    roughness: 0.35,
    metalness: 0.08
  });

  const faceMaterial = new THREE.MeshStandardMaterial({
    map: faceTexture,
    roughness: 0.35,
    metalness: 0.08
  });

  // Cylinder materials: [sides, topCap, bottomCap]
  const mesh = new THREE.Mesh(geometry, [rimMaterial, faceMaterial, faceMaterial]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { isChip: true, denom };

  return mesh;
}

// ----------------- Bankroll & LocalStorage -----------------
const STORAGE_KEY = 'blackjack_3d_bankroll';
const DEFAULT_BANKROLL = 1000;

export function loadBankroll() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  } catch (e) {
    // localStorage might be unavailable in restricted contexts
  }
  return DEFAULT_BANKROLL;
}

export function saveBankroll(amount) {
  try {
    localStorage.setItem(STORAGE_KEY, amount.toString());
  } catch (e) {
    // ignore storage quota errors
  }
}

export function resetBankroll() {
  saveBankroll(DEFAULT_BANKROLL);
  return DEFAULT_BANKROLL;
}

/**
 * Decomposes an integer dollar amount into standard chip denominations
 * in descending order: $100, $25, $5, $1.
 * @param {number} amount
 * @param {number} [maxChips=20]
 * @returns {number[]} array of chip denominations
 */
export function decomposeBet(amount, maxChips = 24) {
  let remaining = Math.max(0, Math.floor(amount));
  const denoms = [1000, 500, 100, 25, 5, 1];
  const result = [];

  for (const d of denoms) {
    const count = Math.floor(remaining / d);
    for (let i = 0; i < count; i++) {
      if (result.length < maxChips) {
        result.push(d);
      }
    }
    remaining %= d;
  }
  return result;
}

