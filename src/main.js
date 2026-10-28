import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createTable } from './table.js';
import { createFloorTexture } from './textures.js';
import { createCard } from './card.js';
import { Shoe } from './shoe.js';
import {
  calculateHand,
  shouldDealerHit,
  determineOutcome,
  canDoubleDown,
  canSplit,
  canSurrender,
  calculateSurrenderRefund,
  shouldDealerPeek,
  canOfferInsurance,
  calculateMaxInsurance,
  resolveInsurance
} from './rules.js';
import {
  playCardSlideSound,
  playCardFlipSound,
  playChipClinkSound,
  playChipCollectSound,
  playWinSound,
  playBustSound,
  playShuffleSound,
  setSoundEnabled,
  setSoundVolume
} from './audio.js';
import {
  loadBankroll,
  saveBankroll,
  resetBankroll,
  createChipMesh,
  CHIP_DENOMS,
  CHIP_CONFIGS
} from './chips.js';

// 1. Scene & Environment
const scene = new THREE.Scene();
const bgColor = new THREE.Color(0x0a0806);
scene.background = bgColor;
scene.fog = new THREE.FogExp2(0x0a0806, 0.22);

// 2. Renderer
const container = document.getElementById('canvas-container');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85; // Calibrated for deep, dark lounge contrast
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// 3. Table
const table = createTable();
scene.add(table.group);

// 4. Dark Room Floor
const floorTexture = createFloorTexture();
const floorGeo = new THREE.PlaneGeometry(20, 20);
const floorMat = new THREE.MeshStandardMaterial({
  map: floorTexture,
  roughness: 0.92,
  metalness: 0.05
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = table.floorY;
floor.receiveShadow = true;
scene.add(floor);

// 5. Soft Warm Hanging Lamp Lighting (Dark & Cozy Ambiance)
// Subtle ambient & bounce fills so shadows are rich, dark, and warm
const hemiLight = new THREE.HemisphereLight(0xffd5a0, 0x140d07, 0.22);
scene.add(hemiLight);

const ambientLight = new THREE.AmbientLight(0x20140a, 0.14);
scene.add(ambientLight);

// Primary soft warm spotlight from the hanging lamp down onto the center of the board
const spotLight = new THREE.SpotLight(0xffd4a0, 3.2);
spotLight.position.copy(table.lampPosition);
spotLight.target.position.copy(table.centerTarget);
scene.add(spotLight.target);

spotLight.angle = Math.PI / 2.6; // Broad gentle cone
spotLight.penumbra = 0.95; // Ultra-soft gradient falloff (no harsh spotlight edges)
spotLight.decay = 1.8;
spotLight.distance = 4.5;
spotLight.castShadow = true;
spotLight.shadow.mapSize.width = 2048;
spotLight.shadow.mapSize.height = 2048;
spotLight.shadow.camera.near = 0.1;
spotLight.shadow.camera.far = 3.5;
spotLight.shadow.bias = -0.00015;
spotLight.shadow.radius = 3.0; // Diffused soft shadow edges
scene.add(spotLight);

// Gentle warm bulb point light for soft local radiance
const bulbPointLight = new THREE.PointLight(0xffaa44, 1.2, 2.5, 2.0);
bulbPointLight.position.copy(table.lampPosition);
scene.add(bulbPointLight);

// Subtle card fill light so card faces remain legible in the moody lighting
const cardFillLight = new THREE.DirectionalLight(0xffebd2, 0.10);
cardFillLight.position.set(0, 2.2, 0.60);
cardFillLight.target.position.copy(table.centerTarget);
scene.add(cardFillLight);
scene.add(cardFillLight.target);

// Faint player fill
const playerFillLight = new THREE.DirectionalLight(0xffcaa0, 0.06);
playerFillLight.position.set(0, 1.2, 1.9);
scene.add(playerFillLight);

// 6. Seated Player Camera & Enhanced OrbitControls
const camera = new THREE.PerspectiveCamera(
  46,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
// Closer default seated position and slightly higher elevation for optimal card visibility
camera.position.set(0, 0.74, 1.25);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0.46);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = false;
controls.enableZoom = false;
controls.enableRotate = false; // Prevent manual camera rotation at will
controls.update();

// Camera View Presets (Seated when placing bets, Close-Up when game starts)
const CAMERA_VIEWS = {
  seated: {
    name: 'Seated',
    pos: new THREE.Vector3(0, 0.74, 1.25),
    target: new THREE.Vector3(0, 0, 0.46)
  },
  closeup: {
    name: 'Close-Up',
    pos: new THREE.Vector3(0, 0.58, 0.98),
    target: new THREE.Vector3(0, 0, 0.46)
  }
};
let cameraTransition = null;

function switchCameraView(targetKey) {
  const view = CAMERA_VIEWS[targetKey];
  if (!view) return;

  cameraTransition = {
    startPos: camera.position.clone(),
    endPos: view.pos.clone(),
    startTarget: controls.target.clone(),
    endTarget: view.target.clone(),
    startTime: performance.now(),
    duration: 550
  };
}

// 7. UI Elements
const dealBtn = document.getElementById('deal-btn');
const hitBtn = document.getElementById('hit-btn');
const standBtn = document.getElementById('stand-btn');
const doubleBtn = document.getElementById('double-btn');
const splitBtn = document.getElementById('split-btn');
const surrenderBtn = document.getElementById('surrender-btn');
const playerActions = document.getElementById('player-actions');
const bettingControls = document.getElementById('betting-controls');
const clearBetBtn = document.getElementById('clear-bet-btn');
const resetBankrollBtn = document.getElementById('reset-bankroll-btn');
const shoeCounter = document.getElementById('shoe-counter');

// Insurance UI
const insurancePrompt = document.getElementById('insurance-prompt');
const insureYesBtn = document.getElementById('insure-yes-btn');
const insureNoBtn = document.getElementById('insure-no-btn');
const insureCostSpan = document.getElementById('insure-cost');

// Settings State & Persistence
const SETTINGS_STORAGE_KEY = 'blackjack_3d_settings';

const DEFAULT_SETTINGS = {
  dealerHitsSoft17: false, // S17 vs H17
  blackjackPayout: '3:2',  // '3:2' or '6:5'
  deckCount: 6,            // 1, 2, 4, 6, 8
  allowSurrender: true,
  allowInsurance: true,
  allowDoubleAfterSplit: true,
  soundEnabled: true,
  soundVolume: 80,
  feltColor: 'emerald',    // 'emerald', 'sapphire', 'ruby', 'charcoal'
  animationSpeed: 'normal',// 'normal', 'fast', 'turbo'
  showShoeCounter: true
};

const FELT_COLORS = {
  emerald: '#105c35',
  sapphire: '#14325c',
  ruby: '#54141e',
  charcoal: '#1e242b'
};

function loadSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    // ignore
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settingsObj) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsObj));
  } catch (e) {
    // ignore
  }
}

const settings = loadSettings();

// Apply initial audio & visual settings
setSoundEnabled(settings.soundEnabled);
setSoundVolume(settings.soundVolume / 100);
if (table && table.setFeltColor) {
  table.setFeltColor(FELT_COLORS[settings.feltColor] || FELT_COLORS.emerald);
}
if (shoeCounter) {
  shoeCounter.style.display = settings.showShoeCounter ? 'block' : 'none';
}

function getSpeedScale() {
  if (settings.animationSpeed === 'turbo') return 0.45;
  if (settings.animationSpeed === 'fast') return 0.7;
  return 1.0;
}

// Top Bar & Settings Menu Elements
const headerRuleBadge = document.getElementById('header-rule-badge');
const settingsOpenBtn = document.getElementById('settings-open-btn');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsBackdrop = document.getElementById('settings-backdrop');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const settingsDoneBtn = document.getElementById('settings-done-btn');

const bankrollVal = document.getElementById('bankroll-val');
const betVal = document.getElementById('bet-val');
const currentBetDisplay = document.getElementById('current-bet-display');

const dealerBadge = document.getElementById('dealer-score-badge');
const dealerScoreVal = document.getElementById('dealer-score-val');
const playerScoresContainer = document.getElementById('player-scores-container');
const playerBadge = document.getElementById('player-score-badge');
const playerScoreVal = document.getElementById('player-score-val');

const resultBanner = document.getElementById('result-banner');
const resultTitle = document.getElementById('result-title');
const resultSubtitle = document.getElementById('result-subtitle');

// 8. Game State & Animation Queue
let shoe = new Shoe(settings.deckCount);
let gameState = 'BETTING'; // 'BETTING' | 'DEALING' | 'INSURANCE' | 'DEALER_PEEK' | 'PLAYER_TURN' | 'DEALER_TURN' | 'ROUND_OVER'
let bankroll = loadBankroll();
let currentBet = 0;
let lastRoundBet = 0;

// Insurance State
let insuranceBet = 0;
let insuranceChipMesh = null;

// Multi-hand support (split up to 3 times, max 4 hands)
let playerHands = []; // Array of { cards: [{ data, mesh }], bet: number, isDone: boolean, isBust: boolean, isDouble: boolean, isSplitAces: boolean, chipMeshes: [] }
let activeHandIndex = 0;
let totalSplits = 0;

// Debug test helpers via keyboard ('s' for 8-8, 'a' for A-A, 'i' for dealer BJ with Ace, 'u' for surrender 16 vs 10)
let forceNextPairRank = null;
let forcePlayerCards = null;
let forceDealerUpRank = null;
let forceDealerHoleRank = null;

let dealerHand = []; // { data: { suit, rank }, mesh: THREE.Mesh, isHole: boolean }
let isHoleCardRevealed = false;
let isBusy = false;

const activeAnimations = [];
const betChipMeshes = [];
const clickableChipObjects = [];

// 8b. Active Hand 3D Felt Highlight Marker
function createActiveHandMarker() {
  const group = new THREE.Group();
  const width = 0.17;
  const height = 0.15;
  const radius = 0.016;

  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);

  const geo = new THREE.ShapeGeometry(shape);
  const fillMat = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    transparent: true,
    opacity: 0.16,
    depthWrite: false
  });
  const fillMesh = new THREE.Mesh(geo, fillMat);
  group.add(fillMesh);

  const edges = new THREE.EdgesGeometry(geo);
  const lineMat = new THREE.LineBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.85
  });
  const lineMesh = new THREE.LineSegments(edges, lineMat);
  group.add(lineMesh);

  group.rotation.x = -Math.PI / 2;
  group.position.set(0, 0.0019, 0.68);
  group.visible = false;

  return { group, fillMat, lineMat };
}

const activeHandMarker = createActiveHandMarker();
scene.add(activeHandMarker.group);

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function updateShoeDisplay() {
  if (shoeCounter) {
    shoeCounter.textContent = `Shoe: ${shoe.remaining} / ${shoe.numDecks * 52} cards`;
  }
}
updateShoeDisplay();

function updateBankrollDisplay() {
  if (bankrollVal) {
    bankrollVal.textContent = `$${bankroll.toLocaleString()}`;
  }
  if (betVal) {
    betVal.textContent = `$${currentBet.toLocaleString()}`;
  }
  if (currentBetDisplay) {
    if (currentBet > 0) {
      currentBetDisplay.classList.remove('hidden');
    } else {
      currentBetDisplay.classList.add('hidden');
    }
  }

  // Update Deal button state
  if (gameState === 'BETTING') {
    if (currentBet > 0) {
      dealBtn.disabled = false;
      dealBtn.textContent = `Deal ($${currentBet})`;
    } else {
      dealBtn.disabled = true;
      dealBtn.textContent = 'Place a Bet';
    }
  }

  // Update chip button disabled states
  document.querySelectorAll('.chip-btn').forEach((btn) => {
    const denom = parseInt(btn.dataset.denom, 10);
    btn.disabled = gameState !== 'BETTING' || bankroll < denom;
  });

  if (clearBetBtn) {
    clearBetBtn.disabled = gameState !== 'BETTING' || currentBet === 0;
  }

  // If bankroll is zero and no active bet, show reload button
  if (resetBankrollBtn) {
    if (bankroll === 0 && currentBet === 0 && gameState === 'BETTING') {
      resetBankrollBtn.classList.remove('hidden');
    } else {
      resetBankrollBtn.classList.add('hidden');
    }
  }
}

// 9. 3D Chips on the Table (Near Player's Right Side)
const chipTrayGroup = new THREE.Group();
chipTrayGroup.position.set(0, 0, 0);
scene.add(chipTrayGroup);

// Tray base plate
const trayBaseGeo = new THREE.BoxGeometry(0.20, 0.006, 0.065);
const trayBaseMat = new THREE.MeshStandardMaterial({
  color: 0x24140b,
  roughness: 0.4,
  metalness: 0.1
});
const trayBase = new THREE.Mesh(trayBaseGeo, trayBaseMat);
trayBase.position.set(0.25, 0.003, 0.86);
trayBase.receiveShadow = true;
chipTrayGroup.add(trayBase);

// Chip stack positions on table
const stackPositions = {
  1: new THREE.Vector3(0.18, 0.006, 0.86),
  5: new THREE.Vector3(0.23, 0.006, 0.86),
  25: new THREE.Vector3(0.28, 0.006, 0.86),
  100: new THREE.Vector3(0.33, 0.006, 0.86)
};

// Spawn 4 chips in each denomination stack on the table
CHIP_DENOMS.forEach((denom) => {
  const basePos = stackPositions[denom];
  for (let i = 0; i < 4; i++) {
    const chipMesh = createChipMesh(denom);
    chipMesh.position.set(basePos.x, basePos.y + i * 0.0034, basePos.z);
    chipMesh.rotation.y = (Math.PI / 4) * i;
    chipTrayGroup.add(chipMesh);
    clickableChipObjects.push(chipMesh);
  }
});

// 10. Betting Circle Destination
const BET_CIRCLE_CENTER = new THREE.Vector3(0, 0.0018, 0.785);

function addBet(denom) {
  if (gameState !== 'BETTING' || isBusy) return;
  if (bankroll < denom) return;

  bankroll -= denom;
  currentBet += denom;
  saveBankroll(bankroll);
  updateBankrollDisplay();

  playChipClinkSound();

  // Create 3D chip in betting circle
  const chipMesh = createChipMesh(denom);
  const stackIdx = betChipMeshes.length;
  const chipTargetY = BET_CIRCLE_CENTER.y + stackIdx * 0.0034;

  // Small organic jitter in circle
  const jitterX = (Math.random() - 0.5) * 0.004;
  const jitterZ = (Math.random() - 0.5) * 0.004;
  const targetPos = new THREE.Vector3(
    BET_CIRCLE_CENTER.x + jitterX,
    chipTargetY,
    BET_CIRCLE_CENTER.z + jitterZ
  );

  const startPos = stackPositions[denom].clone();
  startPos.y += 0.015;
  chipMesh.position.copy(startPos);
  chipMesh.rotation.y = Math.random() * Math.PI * 2;
  scene.add(chipMesh);
  betChipMeshes.push(chipMesh);

  // Animate chip flying from stack to betting circle
  animateCard({
    mesh: chipMesh,
    startPos,
    targetPos,
    startRotY: chipMesh.rotation.y,
    targetRotY: chipMesh.rotation.y + (Math.random() - 0.5) * 0.8,
    arcHeight: 0.045,
    duration: 320,
    onComplete: () => {
      playChipClinkSound();
    }
  });
}

function clearBet() {
  if (gameState !== 'BETTING' || isBusy || currentBet === 0) return;

  playChipCollectSound();
  bankroll += currentBet;
  currentBet = 0;
  saveBankroll(bankroll);
  updateBankrollDisplay();

  betChipMeshes.forEach((mesh) => {
    scene.remove(mesh);
    if (mesh.geometry) mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => m.dispose());
    }
  });
  betChipMeshes.length = 0;
}

// 11. Raycasting for Clicking 3D Chips on the Table
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('pointerdown', (e) => {
  if (gameState !== 'BETTING' || isBusy) return;
  // Ignore clicks on HTML buttons or HUD panels
  if (
    e.target.closest('#action-bar') ||
    e.target.closest('#top-nav-bar') ||
    e.target.closest('#scores-container') ||
    e.target.closest('#bankroll-card')
  ) {
    return;
  }

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(clickableChipObjects, true);
  if (intersects.length > 0) {
    let obj = intersects[0].object;
    while (obj && !obj.userData?.denom && obj.parent) {
      obj = obj.parent;
    }
    if (obj?.userData?.denom) {
      addBet(obj.userData.denom);
    }
  }
});

// Cursor hover pointer feedback
window.addEventListener('pointermove', (e) => {
  if (gameState !== 'BETTING' || isBusy) {
    renderer.domElement.style.cursor = 'default';
    return;
  }
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(clickableChipObjects, true);
  renderer.domElement.style.cursor = intersects.length > 0 ? 'pointer' : 'default';
});

// 12. Animation Queue Helper
function animateCard({
  mesh,
  startPos,
  targetPos,
  startRotY,
  targetRotY,
  startRotZ = 0,
  targetRotZ = 0,
  arcHeight = 0.038,
  duration = 440,
  delay = 0,
  onStart,
  onComplete
}) {
  const speedScale = getSpeedScale();
  const scaledDuration = Math.max(70, Math.round(duration * speedScale));
  const scaledDelay = Math.round(delay * speedScale);

  activeAnimations.push({
    mesh,
    startPos,
    targetPos,
    startRotY,
    targetRotY,
    startRotZ,
    targetRotZ,
    arcHeight,
    duration: scaledDuration,
    delay: scaledDelay,
    startTime: null,
    started: false,
    onStart,
    onComplete
  });
}

function updateCardAnimations(now) {
  for (let i = activeAnimations.length - 1; i >= 0; i--) {
    const anim = activeAnimations[i];
    if (anim.startTime === null) {
      anim.startTime = now + anim.delay;
    }

    if (now < anim.startTime) {
      continue;
    }

    if (!anim.started) {
      anim.started = true;
      anim.mesh.visible = true;
      if (anim.onStart) anim.onStart();
    }

    const elapsed = now - anim.startTime;
    const progress = Math.min(1, elapsed / anim.duration);
    const eased = easeOutCubic(progress);

    const x = THREE.MathUtils.lerp(anim.startPos.x, anim.targetPos.x, eased);
    const z = THREE.MathUtils.lerp(anim.startPos.z, anim.targetPos.z, eased);
    const arc = Math.sin(progress * Math.PI) * anim.arcHeight;
    const y = THREE.MathUtils.lerp(anim.startPos.y, anim.targetPos.y, eased) + arc;

    anim.mesh.position.set(x, y, z);
    anim.mesh.rotation.y = THREE.MathUtils.lerp(anim.startRotY, anim.targetRotY, eased);
    anim.mesh.rotation.z = THREE.MathUtils.lerp(anim.startRotZ, anim.targetRotZ, eased);

    if (progress >= 1) {
      anim.mesh.position.copy(anim.targetPos);
      anim.mesh.rotation.y = anim.targetRotY;
      anim.mesh.rotation.z = anim.targetRotZ;
      if (anim.onComplete) anim.onComplete();
      activeAnimations.splice(i, 1);
    }
  }
}

// 12b. Dealer Peek Animation
function animateDealerPeek({ mesh, hasBlackjack, onPeekDone }) {
  const origPos = mesh.position.clone();
  const origRotX = mesh.rotation.x;

  playCardSlideSound();

  const scale = getSpeedScale();
  const startTime = performance.now();
  const peekDuration = Math.max(70, Math.round(260 * scale));
  const holdDuration = Math.max(90, Math.round(360 * scale));
  const lowerDuration = Math.max(60, Math.round(220 * scale));

  function step(now) {
    const elapsed = now - startTime;
    if (elapsed < peekDuration) {
      const p = easeOutCubic(elapsed / peekDuration);
      mesh.position.y = origPos.y + 0.016 * p;
      mesh.position.z = origPos.z - 0.007 * p;
      mesh.rotation.x = origRotX + 0.32 * p;
      requestAnimationFrame(step);
    } else if (elapsed < peekDuration + holdDuration) {
      // Hold card in peek inspection pose
      requestAnimationFrame(step);
    } else if (!hasBlackjack && elapsed < peekDuration + holdDuration + lowerDuration) {
      // Lower card back down flat on the felt
      const p = easeOutCubic((elapsed - peekDuration - holdDuration) / lowerDuration);
      mesh.position.y = origPos.y + 0.016 * (1 - p);
      mesh.position.z = origPos.z - 0.007 * (1 - p);
      mesh.rotation.x = origRotX + 0.32 * (1 - p);
      requestAnimationFrame(step);
    } else {
      if (!hasBlackjack) {
        mesh.position.copy(origPos);
        mesh.rotation.x = origRotX;
      }
      if (onPeekDone) onPeekDone();
    }
  }

  requestAnimationFrame(step);
}

// 13. Score Displays & Result Messages
function formatScoreString(evalResult, isSplitHand = false) {
  if (!isSplitHand && evalResult.isBlackjack) {
    return '21 (Blackjack!)';
  } else if (evalResult.isBust) {
    return `Bust (${evalResult.score})`;
  } else if (evalResult.isSoft && evalResult.score < 21) {
    return `Soft ${evalResult.score}`;
  } else {
    return `${evalResult.score}`;
  }
}

const SUIT_SYMBOLS = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣'
};

function renderMiniCardsHtml(cards, hideHoleIndex = -1) {
  if (!cards || cards.length === 0) return '';
  const items = cards.map((c, i) => {
    if (i === hideHoleIndex) {
      return `<span class="mini-card mini-card-hole" title="Face-down hole card">🂠</span>`;
    }
    const suit = c.data?.suit || 'spades';
    const rank = c.data?.rank || '';
    const isRed = suit === 'hearts' || suit === 'diamonds';
    const symbol = SUIT_SYMBOLS[suit] || '';
    return `<span class="mini-card ${isRed ? 'red' : 'black'}" title="${rank} of ${suit}"><span class="mc-rank">${rank}</span><span class="mc-suit">${symbol}</span></span>`;
  }).join('');
  return `<div class="mini-cards-row">${items}</div>`;
}

function updateScoresDisplay() {
  if (playerScoresContainer) {
    const validHands = playerHands.filter((h) => h.cards.length > 0);
    if (validHands.length === 1) {
      playerScoresContainer.innerHTML = '';
      const hand = validHands[0];
      const pEval = calculateHand(hand.cards.map((c) => c.data));
      const badge = document.createElement('div');
      badge.className = 'score-badge';
      if (gameState === 'PLAYER_TURN') badge.classList.add('active-hand');
      if (hand.isBust) badge.classList.add('bust-hand');
      badge.innerHTML = `
        <div class="score-header">
          <span class="score-title">Player</span>
          <span class="score-number">${formatScoreString(pEval, false)}</span>
        </div>
        ${renderMiniCardsHtml(hand.cards)}
      `;
      playerScoresContainer.appendChild(badge);
    } else if (validHands.length > 1) {
      playerScoresContainer.innerHTML = '';
      playerHands.forEach((hand, idx) => {
        if (hand.cards.length === 0) return;
        const pEval = calculateHand(hand.cards.map((c) => c.data));
        const badge = document.createElement('div');
        badge.className = 'score-badge';
        if (gameState === 'PLAYER_TURN' && idx === activeHandIndex) {
          badge.classList.add('active-hand');
        }
        if (hand.isBust) badge.classList.add('bust-hand');
        const title = `Hand ${idx + 1}${gameState === 'PLAYER_TURN' && idx === activeHandIndex ? ' ★' : ''}`;
        badge.innerHTML = `
          <div class="score-header">
            <span class="score-title">${title}</span>
            <span class="score-number">${formatScoreString(pEval, true)}</span>
          </div>
          ${renderMiniCardsHtml(hand.cards)}
        `;
        playerScoresContainer.appendChild(badge);
      });
    } else {
      playerScoresContainer.innerHTML = '';
    }
  }

  if (dealerHand.length > 0) {
    dealerBadge.classList.remove('hidden');
    let dScoreStr = '';
    if (isHoleCardRevealed) {
      const dEval = calculateHand(dealerHand.map((c) => c.data));
      dScoreStr = formatScoreString(dEval, false);
    } else {
      const upcardEval = calculateHand([dealerHand[0].data]);
      dScoreStr = `${upcardEval.score}`;
    }
    dealerBadge.innerHTML = `
      <div class="score-header">
        <span class="score-title">Dealer</span>
        <span id="dealer-score-val" class="score-number">${dScoreStr}</span>
      </div>
      ${renderMiniCardsHtml(dealerHand, isHoleCardRevealed ? -1 : 1)}
    `;
  } else {
    dealerBadge.classList.add('hidden');
  }
}

function showResultBanner(title, subtitle, type = 'win') {
  resultTitle.textContent = title;
  resultSubtitle.textContent = subtitle;
  resultBanner.className = `result-${type}`;
  resultBanner.classList.remove('hidden');
}

function hideResultBanner() {
  resultBanner.classList.add('hidden');
}

// 14. Card Layout Positions
function getHandCenterX(handIndex, totalHands) {
  if (totalHands <= 1) return 0;
  const spacing = totalHands === 2 ? 0.30 : totalHands === 3 ? 0.26 : 0.22;
  const startX = -((totalHands - 1) * spacing) / 2;
  return startX + handIndex * spacing;
}

function getPlayerCardPosition(cardIndex, handIndex = 0, totalHands = 1) {
  const handCenterX = getHandCenterX(handIndex, totalHands);
  const cardSpacing = 0.052;
  const startX = handCenterX - cardSpacing / 2;
  return new THREE.Vector3(
    startX + cardIndex * cardSpacing,
    0.0018 + cardIndex * 0.0003,
    0.68
  );
}

function getHandChipPosition(handIndex = 0, totalHands = 1, chipIndex = 0) {
  const handCenterX = getHandCenterX(handIndex, totalHands);
  return new THREE.Vector3(
    handCenterX,
    0.0018 + chipIndex * 0.0034,
    0.785
  );
}

function getDealerCardPosition(index) {
  const spacing = 0.056;
  if (index === 0) {
    return new THREE.Vector3(-0.060, 0.0018, 0.2268);
  } else if (index === 1) {
    return new THREE.Vector3(0.060, 0.0018 + 0.0002, 0.2268);
  } else {
    return new THREE.Vector3(
      0.060 + (index - 1) * spacing,
      0.0018 + index * 0.0003,
      0.2268
    );
  }
}

// 15. Deal Flow
function dealRound() {
  if (isBusy || currentBet <= 0) return;
  isBusy = true;
  gameState = 'DEALING';
  lastRoundBet = currentBet;

  // Switch camera to dramatic close-up view for the action
  switchCameraView('closeup');

  dealBtn.disabled = true;
  dealBtn.classList.add('hidden');
  bettingControls.classList.add('hidden');
  playerActions.classList.add('hidden');
  hideResultBanner();

  if (activeHandMarker) {
    activeHandMarker.group.visible = false;
  }

  // Clear previous round cards
  [...dealerHand, ...playerHands.flatMap((h) => h.cards)].forEach(({ mesh }) => {
    scene.remove(mesh);
    if (mesh.geometry) mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => m.dispose());
    }
  });

  playerHands = [];
  dealerHand = [];
  activeHandIndex = 0;
  totalSplits = 0;
  isHoleCardRevealed = false;
  updateScoresDisplay();

  // Draw 4 cards (or debug forced cards for testing)
  const pCard1 = forcePlayerCards
    ? { suit: 'spades', rank: forcePlayerCards[0] }
    : (forceNextPairRank ? { suit: 'spades', rank: forceNextPairRank } : shoe.drawCard());
  const dCard1 = forceDealerUpRank ? { suit: 'spades', rank: forceDealerUpRank } : shoe.drawCard();
  const pCard2 = forcePlayerCards
    ? { suit: 'hearts', rank: forcePlayerCards[1] }
    : (forceNextPairRank ? { suit: 'hearts', rank: forceNextPairRank } : shoe.drawCard());
  const dCard2 = forceDealerHoleRank ? { suit: 'diamonds', rank: forceDealerHoleRank } : shoe.drawCard();
  forcePlayerCards = null;
  forceNextPairRank = null;
  forceDealerUpRank = null;
  forceDealerHoleRank = null;
  updateShoeDisplay();

  const pMesh1 = createCard({ suit: pCard1.suit, rank: pCard1.rank });
  const dMesh1 = createCard({ suit: dCard1.suit, rank: dCard1.rank });
  const pMesh2 = createCard({ suit: pCard2.suit, rank: pCard2.rank });
  const dMesh2 = createCard({ suit: dCard2.suit, rank: dCard2.rank });

  [pMesh1, dMesh1, pMesh2, dMesh2].forEach((m) => {
    m.visible = false;
    scene.add(m);
  });

  playerHands.push({
    cards: [
      { data: pCard1, mesh: pMesh1 },
      { data: pCard2, mesh: pMesh2 }
    ],
    bet: lastRoundBet,
    isDone: false,
    isBust: false,
    isDouble: false,
    isSplitAces: false,
    chipMeshes: [...betChipMeshes]
  });

  dealerHand.push({ data: dCard1, mesh: dMesh1, isHole: false });
  dealerHand.push({ data: dCard2, mesh: dMesh2, isHole: true });

  const dealOrigin = table.dealOrigin;

  // 1. Player Card 1 (face-up)
  animateCard({
    mesh: pMesh1,
    startPos: dealOrigin.clone(),
    targetPos: getPlayerCardPosition(0, 0, 1),
    startRotY: -0.48,
    targetRotY: Math.PI,
    delay: 0,
    onStart: playCardSlideSound
  });

  // 2. Dealer Card 1 (Upcard, face-up)
  animateCard({
    mesh: dMesh1,
    startPos: dealOrigin.clone(),
    targetPos: getDealerCardPosition(0),
    startRotY: -0.48,
    targetRotY: Math.PI,
    delay: 260,
    onStart: playCardSlideSound
  });

  // 3. Player Card 2 (face-up)
  animateCard({
    mesh: pMesh2,
    startPos: dealOrigin.clone(),
    targetPos: getPlayerCardPosition(1, 0, 1),
    startRotY: -0.48,
    targetRotY: Math.PI,
    delay: 520,
    onStart: playCardSlideSound
  });

  // 4. Dealer Card 2 (Hole card, face-down)
  animateCard({
    mesh: dMesh2,
    startPos: dealOrigin.clone(),
    targetPos: getDealerCardPosition(1),
    startRotY: -0.48,
    targetRotY: 0,
    delay: 780,
    onStart: playCardSlideSound,
    onComplete: () => {
      onInitialDealComplete();
    }
  });
}

function onInitialDealComplete() {
  isBusy = false;
  updateScoresDisplay();

  const dealerUpcard = dealerHand[0].data;

  // 1. If dealer shows an Ace, offer Insurance (up to half the bet, pays 2:1)
  if (settings.allowInsurance && canOfferInsurance(dealerUpcard, bankroll)) {
    const maxInsurance = calculateMaxInsurance(lastRoundBet, bankroll);
    if (maxInsurance > 0) {
      promptInsurance(maxInsurance);
      return;
    }
  }

  // 2. If dealer shows Ace or 10-value card ('10', 'J', 'Q', 'K'), dealer peeks for blackjack
  if (shouldDealerPeek(dealerUpcard)) {
    insuranceBet = 0;
    doDealerPeek();
    return;
  }

  // 3. Dealer does not peek ('2'-'9') -> Check player natural BJ or proceed to player turn
  checkNaturalBlackjackNoPeek();
}

function promptInsurance(cost) {
  gameState = 'INSURANCE';
  if (insureCostSpan) {
    insureCostSpan.textContent = cost;
  }
  if (insurancePrompt) {
    insurancePrompt.classList.remove('hidden');
  }
}

function handleTakeInsurance() {
  if (gameState !== 'INSURANCE') return;
  const cost = calculateMaxInsurance(lastRoundBet, bankroll);
  if (cost <= 0) {
    handleDeclineInsurance();
    return;
  }

  insuranceBet = cost;
  bankroll -= insuranceBet;
  saveBankroll(bankroll);
  updateBankrollDisplay();
  playChipClinkSound();

  // Spawn 3D chip in insurance area on table felt
  const chipDenom = insuranceBet >= 100 ? 100 : insuranceBet >= 25 ? 25 : insuranceBet >= 5 ? 5 : 1;
  insuranceChipMesh = createChipMesh(chipDenom);
  insuranceChipMesh.position.set(0, 0.0018, 0.56);
  insuranceChipMesh.rotation.y = Math.random() * Math.PI * 2;
  scene.add(insuranceChipMesh);

  if (insurancePrompt) {
    insurancePrompt.classList.add('hidden');
  }

  doDealerPeek();
}

function handleDeclineInsurance() {
  if (gameState !== 'INSURANCE') return;
  insuranceBet = 0;
  if (insurancePrompt) {
    insurancePrompt.classList.add('hidden');
  }
  doDealerPeek();
}

function doDealerPeek() {
  gameState = 'DEALER_PEEK';
  isBusy = true;

  const holeCard = dealerHand.find((c) => c.isHole);
  if (!holeCard) {
    checkNaturalBlackjackNoPeek();
    return;
  }

  const dEval = calculateHand(dealerHand.map((c) => c.data));
  const hasBlackjack = dEval.isBlackjack;

  animateDealerPeek({
    mesh: holeCard.mesh,
    hasBlackjack,
    onPeekDone: () => {
      if (hasBlackjack) {
        // Dealer has Blackjack! Reveal hole card immediately and end round
        revealDealerHoleCard(() => {
          resolveDealerBlackjackRound();
        });
      } else {
        // Dealer does NOT have Blackjack
        proceedAfterNoBlackjackPeek();
      }
    }
  });
}

function resolveDealerBlackjackRound() {
  const pEval = calculateHand(playerHands[0].cards.map((c) => c.data));

  let insProfit = 0;
  if (insuranceBet > 0) {
    const insRes = resolveInsurance(dealerHand.map((c) => c.data), insuranceBet);
    bankroll += insRes.payout; // returns stake + 2:1 profit
    insProfit = insRes.profit;
    saveBankroll(bankroll);
    updateBankrollDisplay();
    playWinSound();
  }

  if (pEval.isBlackjack) {
    // Both have Blackjack: main bet pushes!
    bankroll += lastRoundBet;
    saveBankroll(bankroll);
    updateBankrollDisplay();
    if (insuranceBet > 0) {
      showResultBanner('DEALER BLACKJACK', `Both have Blackjack (Push) &bull; Insurance Won (+$${insProfit})`, 'win');
    } else {
      showResultBanner('PUSH', 'Both have Blackjack &bull; Bet Returned', 'push');
    }
  } else {
    // Player does not have Blackjack: main bet lost
    if (insuranceBet > 0) {
      const net = insProfit - lastRoundBet;
      const type = net > 0 ? 'win' : net === 0 ? 'push' : 'loss';
      showResultBanner('DEALER BLACKJACK', `Dealer Wins Hand (-$${lastRoundBet}) &bull; Insurance Won (+$${insProfit})`, type);
    } else {
      playBustSound();
      showResultBanner('DEALER BLACKJACK', `Dealer wins (-$${lastRoundBet})`, 'loss');
    }
  }

  endRound();
}

function proceedAfterNoBlackjackPeek() {
  isBusy = false;

  // If insurance was placed, it is now lost
  if (insuranceBet > 0) {
    if (insuranceChipMesh) {
      scene.remove(insuranceChipMesh);
      if (insuranceChipMesh.geometry) insuranceChipMesh.geometry.dispose();
      if (Array.isArray(insuranceChipMesh.material)) {
        insuranceChipMesh.material.forEach((m) => m.dispose());
      }
      insuranceChipMesh = null;
    }
    insuranceBet = 0;
  }

  checkNaturalBlackjackNoPeek();
}

function checkNaturalBlackjackNoPeek() {
  const pEval = calculateHand(playerHands[0].cards.map((c) => c.data));

  // If player has natural Blackjack:
  // Dealer does NOT have blackjack, so player natural BJ wins 3:2 immediately!
  if (pEval.isBlackjack) {
    revealDealerHoleCard(() => {
      const payoutMultiplier = settings.blackjackPayout === '6:5' ? 1.2 : 1.5;
      const profit = Math.round(lastRoundBet * payoutMultiplier);
      bankroll += lastRoundBet + profit;
      saveBankroll(bankroll);
      updateBankrollDisplay();
      playWinSound();
      showResultBanner('BLACKJACK!', `Player wins ${settings.blackjackPayout} (+$${profit})`, 'win');
      endRound();
    });
    return;
  }

  // Player turn starts
  startPlayerTurn();
}

// 16. Player Turn (Hit / Stand / Double Down / Split)
function startPlayerTurn() {
  gameState = 'PLAYER_TURN';
  activeHandIndex = 0;
  playActiveHand();
}

function playActiveHand() {
  if (gameState !== 'PLAYER_TURN') return;

  // If we've played all player hands left-to-right, end player turn
  if (activeHandIndex >= playerHands.length) {
    onAllPlayerHandsComplete();
    return;
  }

  const hand = playerHands[activeHandIndex];

  // If this hand is already marked done, advance to next hand
  if (hand.isDone) {
    activeHandIndex++;
    playActiveHand();
    return;
  }

  isBusy = false;

  // Highlight active hand on table felt
  if (activeHandMarker) {
    activeHandMarker.group.position.x = getHandCenterX(activeHandIndex, playerHands.length);
    activeHandMarker.group.visible = true;
  }

  updateScoresDisplay();

  const pEval = calculateHand(hand.cards.map((c) => c.data));

  // If 21 reached, auto-stand and proceed to next hand
  if (pEval.score === 21) {
    hand.isDone = true;
    setTimeout(() => {
      activeHandIndex++;
      playActiveHand();
    }, 400);
    return;
  }

  // If bust, mark bust and proceed
  if (pEval.isBust) {
    hand.isBust = true;
    hand.isDone = true;
    playBustSound();
    setTimeout(() => {
      activeHandIndex++;
      playActiveHand();
    }, 400);
    return;
  }

  // Show player action buttons
  dealBtn.classList.add('hidden');
  playerActions.classList.remove('hidden');
  hitBtn.disabled = false;
  standBtn.disabled = false;

  // Double Down: legal only on first 2 cards, bankroll >= bet, not split Aces (or DAS if split)
  if (doubleBtn) {
    const isSplitHand = playerHands.length > 1 || totalSplits > 0;
    const allowDAS = !isSplitHand || settings.allowDoubleAfterSplit;
    const canDouble = allowDAS && canDoubleDown(hand.cards.map((c) => c.data), bankroll, hand.bet) && !hand.isSplitAces;
    doubleBtn.disabled = !canDouble;
    if (canDouble) {
      doubleBtn.classList.remove('hidden');
    } else {
      doubleBtn.classList.add('hidden');
    }
  }

  // Split: legal only on pair of same rank, bankroll >= bet, totalSplits < 3
  if (splitBtn) {
    const canDoSplit = canSplit(hand.cards.map((c) => c.data), bankroll, hand.bet, totalSplits);
    splitBtn.disabled = !canDoSplit;
    if (canDoSplit) {
      splitBtn.classList.remove('hidden');
    } else {
      splitBtn.classList.add('hidden');
    }
  }

  // Late Surrender: legal on initial 2 cards after dealer peek, non-split hand, when enabled
  if (surrenderBtn) {
    const canDoSurrender = settings.allowSurrender && canSurrender(
      hand.cards.map((c) => c.data),
      true,
      playerHands.length === 1 && totalSplits === 0
    );
    surrenderBtn.disabled = !canDoSurrender;
    if (canDoSurrender) {
      surrenderBtn.classList.remove('hidden');
    } else {
      surrenderBtn.classList.add('hidden');
    }
  }
}

function onAllPlayerHandsComplete() {
  if (activeHandMarker) {
    activeHandMarker.group.visible = false;
  }
  playerActions.classList.add('hidden');
  updateScoresDisplay();

  // If ALL hands busted, dealer reveals hole card and round resolves immediately
  const allBusted = playerHands.every((h) => h.isBust);
  if (allBusted) {
    revealDealerHoleCard(() => {
      resolveRound();
    });
    return;
  }

  // At least one hand is alive -> dealer's turn
  gameState = 'DEALER_TURN';
  startDealerTurn();
}

function handlePlayerHit() {
  if (isBusy || gameState !== 'PLAYER_TURN') return;
  const hand = playerHands[activeHandIndex];
  if (!hand || hand.isDone) return;

  isBusy = true;
  hitBtn.disabled = true;
  standBtn.disabled = true;
  if (doubleBtn) {
    doubleBtn.disabled = true;
    doubleBtn.classList.add('hidden');
  }
  if (splitBtn) {
    splitBtn.disabled = true;
    splitBtn.classList.add('hidden');
  }
  if (surrenderBtn) {
    surrenderBtn.disabled = true;
    surrenderBtn.classList.add('hidden');
  }
  if (surrenderBtn) {
    surrenderBtn.disabled = true;
    surrenderBtn.classList.add('hidden');
  }

  const cardData = shoe.drawCard();
  updateShoeDisplay();

  const mesh = createCard({ suit: cardData.suit, rank: cardData.rank });
  mesh.visible = false;
  scene.add(mesh);

  const cardIndex = hand.cards.length;
  hand.cards.push({ data: cardData, mesh });

  const targetPos = getPlayerCardPosition(cardIndex, activeHandIndex, playerHands.length);

  animateCard({
    mesh,
    startPos: table.dealOrigin.clone(),
    targetPos,
    startRotY: -0.48,
    targetRotY: Math.PI,
    delay: 0,
    onStart: playCardSlideSound,
    onComplete: () => {
      isBusy = false;
      updateScoresDisplay();
      const pEval = calculateHand(hand.cards.map((c) => c.data));

      if (pEval.isBust) {
        hand.isBust = true;
        hand.isDone = true;
        playBustSound();
        setTimeout(() => {
          activeHandIndex++;
          playActiveHand();
        }, 350);
      } else if (pEval.score === 21) {
        hand.isDone = true;
        setTimeout(() => {
          activeHandIndex++;
          playActiveHand();
        }, 350);
      } else {
        hitBtn.disabled = false;
        standBtn.disabled = false;
      }
    }
  });
}

function handlePlayerStand() {
  if (isBusy || gameState !== 'PLAYER_TURN') return;
  const hand = playerHands[activeHandIndex];
  if (!hand || hand.isDone) return;

  hand.isDone = true;
  activeHandIndex++;
  playActiveHand();
}

function handlePlayerDouble() {
  if (isBusy || gameState !== 'PLAYER_TURN') return;
  const hand = playerHands[activeHandIndex];
  if (!hand || hand.isDone) return;

  const canDouble = canDoubleDown(hand.cards.map((c) => c.data), bankroll, hand.bet) && !hand.isSplitAces;
  if (!canDouble) return;

  isBusy = true;
  hitBtn.disabled = true;
  standBtn.disabled = true;
  if (doubleBtn) doubleBtn.disabled = true;
  if (splitBtn) splitBtn.disabled = true;
  if (surrenderBtn) {
    surrenderBtn.disabled = true;
    surrenderBtn.classList.add('hidden');
  }

  // Double the bet on this hand
  bankroll -= hand.bet;
  const addedBet = hand.bet;
  hand.bet *= 2;
  hand.isDouble = true;
  saveBankroll(bankroll);
  updateBankrollDisplay();
  playChipClinkSound();

  // Spawn an extra 3D chip in this hand's chip stack
  const extraChip = createChipMesh(
    addedBet >= 100 ? 100 : addedBet >= 25 ? 25 : addedBet >= 5 ? 5 : 1
  );
  const stackIdx = hand.chipMeshes.length;
  const chipTargetPos = getHandChipPosition(activeHandIndex, playerHands.length, stackIdx);
  extraChip.position.copy(chipTargetPos);
  extraChip.rotation.y = Math.random() * Math.PI * 2;
  scene.add(extraChip);
  hand.chipMeshes.push(extraChip);

  // Draw exactly ONE card from the shoe
  const cardData = shoe.drawCard();
  updateShoeDisplay();

  const mesh = createCard({ suit: cardData.suit, rank: cardData.rank });
  mesh.visible = false;
  scene.add(mesh);

  const cardIndex = hand.cards.length;
  hand.cards.push({ data: cardData, mesh });

  const targetPos = getPlayerCardPosition(cardIndex, activeHandIndex, playerHands.length);

  animateCard({
    mesh,
    startPos: table.dealOrigin.clone(),
    targetPos,
    startRotY: -0.48,
    targetRotY: Math.PI,
    startRotZ: 0,
    targetRotZ: Math.PI / 2, // Classic sideways turned card for Double Down
    delay: 0,
    onStart: playCardSlideSound,
    onComplete: () => {
      isBusy = false;
      updateScoresDisplay();
      const pEval = calculateHand(hand.cards.map((c) => c.data));
      hand.isDone = true;

      if (pEval.isBust) {
        hand.isBust = true;
        playBustSound();
      }

      setTimeout(() => {
        activeHandIndex++;
        playActiveHand();
      }, 350);
    }
  });
}

function handlePlayerSplit() {
  if (isBusy || gameState !== 'PLAYER_TURN') return;
  const hand = playerHands[activeHandIndex];
  if (!hand || hand.isDone) return;

  const canDoSplit = canSplit(hand.cards.map((c) => c.data), bankroll, hand.bet, totalSplits);
  if (!canDoSplit) return;

  isBusy = true;
  hitBtn.disabled = true;
  standBtn.disabled = true;
  if (doubleBtn) {
    doubleBtn.disabled = true;
    doubleBtn.classList.add('hidden');
  }
  if (splitBtn) {
    splitBtn.disabled = true;
    splitBtn.classList.add('hidden');
  }
  if (surrenderBtn) {
    surrenderBtn.disabled = true;
    surrenderBtn.classList.add('hidden');
  }

  // Deduct matching bet for the split hand
  bankroll -= hand.bet;
  totalSplits++;
  saveBankroll(bankroll);
  updateBankrollDisplay();
  playChipClinkSound();

  const isAces = hand.cards[0].data.rank === 'A';
  if (isAces) {
    hand.isSplitAces = true;
  }

  // Pop second card from current hand
  const splitCard = hand.cards.pop();

  // Create new hand right after current hand
  const newHand = {
    cards: [splitCard],
    bet: hand.bet,
    isDone: false,
    isBust: false,
    isDouble: false,
    isSplitAces: isAces,
    chipMeshes: []
  };

  // Spawn chip stack for the new hand
  const chipDenom = newHand.bet >= 100 ? 100 : newHand.bet >= 25 ? 25 : newHand.bet >= 5 ? 5 : 1;
  const newChip = createChipMesh(chipDenom);
  newChip.rotation.y = Math.random() * Math.PI * 2;
  scene.add(newChip);
  newHand.chipMeshes.push(newChip);

  playerHands.splice(activeHandIndex + 1, 0, newHand);
  const newTotalHands = playerHands.length;

  // 1. Reposition all existing cards and chip meshes of all hands smoothly to their new centers
  playerHands.forEach((h, hIdx) => {
    h.cards.forEach((c, cIdx) => {
      const targetPos = getPlayerCardPosition(cIdx, hIdx, newTotalHands);
      animateCard({
        mesh: c.mesh,
        startPos: c.mesh.position.clone(),
        targetPos,
        startRotY: c.mesh.rotation.y,
        targetRotY: c.mesh.rotation.y,
        startRotZ: c.mesh.rotation.z,
        targetRotZ: c.mesh.rotation.z,
        arcHeight: 0.012,
        duration: 280
      });
    });

    h.chipMeshes.forEach((chipMesh, chipIdx) => {
      const chipTarget = getHandChipPosition(hIdx, newTotalHands, chipIdx);
      animateCard({
        mesh: chipMesh,
        startPos: chipMesh.position.clone(),
        targetPos: chipTarget,
        startRotY: chipMesh.rotation.y,
        targetRotY: chipMesh.rotation.y,
        arcHeight: 0.015,
        duration: 280
      });
    });
  });

  // Move active hand marker to updated center
  if (activeHandMarker) {
    activeHandMarker.group.position.x = getHandCenterX(activeHandIndex, newTotalHands);
  }

  // 2. Deal second card to active hand after cards shift
  setTimeout(() => {
    const cardData1 = shoe.drawCard();
    updateShoeDisplay();
    const mesh1 = createCard({ suit: cardData1.suit, rank: cardData1.rank });
    mesh1.visible = false;
    scene.add(mesh1);
    hand.cards.push({ data: cardData1, mesh: mesh1 });

    const targetPos1 = getPlayerCardPosition(1, activeHandIndex, newTotalHands);

    animateCard({
      mesh: mesh1,
      startPos: table.dealOrigin.clone(),
      targetPos: targetPos1,
      startRotY: -0.48,
      targetRotY: Math.PI,
      delay: 0,
      onStart: playCardSlideSound,
      onComplete: () => {
        updateScoresDisplay();

        // 3. Deal second card to new hand
        setTimeout(() => {
          const cardData2 = shoe.drawCard();
          updateShoeDisplay();
          const mesh2 = createCard({ suit: cardData2.suit, rank: cardData2.rank });
          mesh2.visible = false;
          scene.add(mesh2);
          newHand.cards.push({ data: cardData2, mesh: mesh2 });

          const targetPos2 = getPlayerCardPosition(1, activeHandIndex + 1, newTotalHands);

          animateCard({
            mesh: mesh2,
            startPos: table.dealOrigin.clone(),
            targetPos: targetPos2,
            startRotY: -0.48,
            targetRotY: Math.PI,
            delay: 0,
            onStart: playCardSlideSound,
            onComplete: () => {
              isBusy = false;
              updateScoresDisplay();

              if (isAces) {
                // "one card only on split Aces" - both split Ace hands stand immediately!
                hand.isDone = true;
                newHand.isDone = true;
                activeHandIndex = playerHands.length;
                playActiveHand();
              } else {
                // Resume play on active hand
                playActiveHand();
              }
            }
          });
        }, 160);
      }
    });
  }, 320);
}

function handlePlayerSurrender() {
  if (isBusy || gameState !== 'PLAYER_TURN') return;
  const hand = playerHands[activeHandIndex];
  if (!hand || hand.isDone) return;

  const canDoSurrender = canSurrender(
    hand.cards.map((c) => c.data),
    true,
    playerHands.length === 1 && totalSplits === 0
  );
  if (!canDoSurrender) return;

  isBusy = true;
  playerActions.classList.add('hidden');
  if (activeHandMarker) {
    activeHandMarker.group.visible = false;
  }

  const refund = calculateSurrenderRefund(hand.bet);
  const forfeited = hand.bet - refund;

  bankroll += refund;
  saveBankroll(bankroll);
  updateBankrollDisplay();
  playChipCollectSound();

  revealDealerHoleCard(() => {
    showResultBanner(
      'SURRENDER',
      `Returned half bet (+$${refund}) &bull; Forfeited $${forfeited}`,
      'loss'
    );
    endRound();
  });
}

// 17. Dealer Turn
function revealDealerHoleCard(onComplete) {
  if (isHoleCardRevealed) {
    if (onComplete) onComplete();
    return;
  }

  const holeCard = dealerHand.find((c) => c.isHole);
  if (!holeCard) {
    if (onComplete) onComplete();
    return;
  }

  isHoleCardRevealed = true;
  playCardFlipSound();

  const currentPos = holeCard.mesh.position.clone();
  animateCard({
    mesh: holeCard.mesh,
    startPos: currentPos,
    targetPos: currentPos,
    startRotY: 0,
    targetRotY: Math.PI,
    arcHeight: 0.024,
    duration: 360,
    onComplete: () => {
      updateScoresDisplay();
      if (onComplete) onComplete();
    }
  });
}

function startDealerTurn() {
  revealDealerHoleCard(() => {
    runDealerStep();
  });
}

function runDealerStep() {
  const scale = getSpeedScale();
  if (shouldDealerHit(dealerHand.map((c) => c.data), settings.dealerHitsSoft17)) {
    setTimeout(() => {
      const cardData = shoe.drawCard();
      updateShoeDisplay();

      const mesh = createCard({ suit: cardData.suit, rank: cardData.rank });
      mesh.visible = false;
      scene.add(mesh);

      const cardIndex = dealerHand.length;
      dealerHand.push({ data: cardData, mesh, isHole: false });

      const targetPos = getDealerCardPosition(cardIndex);

      animateCard({
        mesh,
        startPos: table.dealOrigin.clone(),
        targetPos,
        startRotY: -0.48,
        targetRotY: Math.PI,
        delay: 0,
        onStart: playCardSlideSound,
        onComplete: () => {
          updateScoresDisplay();
          runDealerStep();
        }
      });
    }, Math.max(120, Math.round(450 * scale)));
  } else {
    setTimeout(() => {
      resolveRound();
    }, Math.max(90, Math.round(300 * scale)));
  }
}

function resolveRound() {
  const dEval = calculateHand(dealerHand.map((c) => c.data));
  const isMultiHand = playerHands.length > 1;

  let totalWon = 0;
  let totalLost = 0;
  let netGain = 0;
  const summaries = [];

  playerHands.forEach((hand, idx) => {
    const pEval = calculateHand(hand.cards.map((c) => c.data));
    const outcome = determineOutcome(
      hand.cards.map((c) => c.data),
      dealerHand.map((c) => c.data),
      isMultiHand
    );

    const label = isMultiHand ? `Hand ${idx + 1}` : 'Player';

    if (outcome === 'player_blackjack') {
      const payoutMultiplier = settings.blackjackPayout === '6:5' ? 1.2 : 1.5;
      const profit = Math.round(hand.bet * payoutMultiplier);
      bankroll += hand.bet + profit;
      totalWon += profit;
      netGain += profit;
      summaries.push(`${label}: Blackjack (${settings.blackjackPayout}, +$${profit})`);
    } else if (outcome === 'player_win') {
      const profit = hand.bet;
      bankroll += hand.bet + profit;
      totalWon += profit;
      netGain += profit;
      summaries.push(`${label}: ${pEval.score} vs ${dEval.isBust ? 'Bust' : dEval.score} (+$${profit})`);
    } else if (outcome === 'push') {
      bankroll += hand.bet;
      summaries.push(`${label}: Push ${pEval.score}`);
    } else {
      totalLost += hand.bet;
      netGain -= hand.bet;
      summaries.push(`${label}: ${pEval.isBust ? 'Bust' : pEval.score} vs ${dEval.score} (-$${hand.bet})`);
    }
  });

  saveBankroll(bankroll);
  updateBankrollDisplay();

  if (netGain > 0) {
    playWinSound();
    showResultBanner(
      `WIN (+$${netGain})`,
      summaries.join(' &bull; '),
      'win'
    );
  } else if (netGain < 0) {
    playBustSound();
    showResultBanner(
      `DEALER WINS (-$${Math.abs(netGain)})`,
      summaries.join(' &bull; '),
      'loss'
    );
  } else {
    showResultBanner(
      'PUSH (Even)',
      summaries.join(' &bull; '),
      'push'
    );
  }

  endRound();
}

function endRound() {
  isBusy = false;
  gameState = 'BETTING';
  currentBet = 0;

  // Switch camera back to seated view so the player can see all chips and place bets
  switchCameraView('seated');

  if (activeHandMarker) {
    activeHandMarker.group.visible = false;
  }

  if (insurancePrompt) {
    insurancePrompt.classList.add('hidden');
  }

  if (insuranceChipMesh) {
    scene.remove(insuranceChipMesh);
    if (insuranceChipMesh.geometry) insuranceChipMesh.geometry.dispose();
    if (Array.isArray(insuranceChipMesh.material)) {
      insuranceChipMesh.material.forEach((m) => m.dispose());
    }
    insuranceChipMesh = null;
  }
  insuranceBet = 0;

  // Clear 3D bet chips from betting circle and hands
  playerHands.forEach((hand) => {
    hand.chipMeshes.forEach((mesh) => {
      scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      }
    });
    hand.chipMeshes.length = 0;
  });

  betChipMeshes.forEach((mesh) => {
    scene.remove(mesh);
    if (mesh.geometry) mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => m.dispose());
    }
  });
  betChipMeshes.length = 0;

  playerActions.classList.add('hidden');
  if (doubleBtn) {
    doubleBtn.disabled = true;
    doubleBtn.classList.add('hidden');
  }
  if (splitBtn) {
    splitBtn.disabled = true;
    splitBtn.classList.add('hidden');
  }
  if (surrenderBtn) {
    surrenderBtn.disabled = true;
    surrenderBtn.classList.add('hidden');
  }
  bettingControls.classList.remove('hidden');
  dealBtn.classList.remove('hidden');

  updateBankrollDisplay();
}

// 18. Event Listeners
dealBtn.addEventListener('click', dealRound);
hitBtn.addEventListener('click', handlePlayerHit);
standBtn.addEventListener('click', handlePlayerStand);
if (doubleBtn) {
  doubleBtn.addEventListener('click', handlePlayerDouble);
}
if (splitBtn) {
  splitBtn.addEventListener('click', handlePlayerSplit);
}
if (surrenderBtn) {
  surrenderBtn.addEventListener('click', handlePlayerSurrender);
}

if (insureYesBtn) {
  insureYesBtn.addEventListener('click', handleTakeInsurance);
}
if (insureNoBtn) {
  insureNoBtn.addEventListener('click', handleDeclineInsurance);
}

// Keyboard shortcuts during BETTING phase to easily test game situations:
// 's': player pair of 8s (split test)
// 'a': player pair of Aces (split aces test)
// 'i': dealer shows Ace & has Blackjack (Insurance + Peek + Dealer BJ)
// 'o': dealer shows Ace & does NOT have BJ (Insurance + Peek + No BJ)
// 't': dealer shows 10 & has Blackjack (Peek + Dealer BJ)
// 'n': dealer shows 10 & does NOT have BJ (Peek + No BJ)
// 'u': late surrender test (player gets 16 vs dealer 10, peek confirms no BJ)
window.addEventListener('keydown', (e) => {
  if (gameState !== 'BETTING' || isBusy) return;
  const key = e.key.toLowerCase();
  if (key === 's') {
    forceNextPairRank = '8';
  } else if (key === 'a') {
    forceNextPairRank = 'A';
  } else if (key === 'i') {
    forceDealerUpRank = 'A';
    forceDealerHoleRank = 'K';
  } else if (key === 'o') {
    forceDealerUpRank = 'A';
    forceDealerHoleRank = '7';
  } else if (key === 't') {
    forceDealerUpRank = '10';
    forceDealerHoleRank = 'A';
  } else if (key === 'n') {
    forceDealerUpRank = '10';
    forceDealerHoleRank = '8';
  } else if (key === 'u') {
    forcePlayerCards = ['10', '6'];
    forceDealerUpRank = '10';
    forceDealerHoleRank = '7';
  } else if (key === 'h') {
    // 'h': soft 17 dealer test (dealer gets 6 upcard & Ace hole = soft 17, player gets 18)
    forcePlayerCards = ['10', '8'];
    forceDealerUpRank = '6';
    forceDealerHoleRank = 'A';
  }
});

// 18. Dedicated Settings Menu Management & Interactivity
function syncSettingsUI() {
  if (headerRuleBadge) {
    headerRuleBadge.textContent = settings.dealerHitsSoft17 ? 'H17' : 'S17';
    headerRuleBadge.className = settings.dealerHitsSoft17 ? 'header-rule-badge h17' : 'header-rule-badge s17';
    headerRuleBadge.title = settings.dealerHitsSoft17
      ? 'Dealer hits soft 17 (H17)'
      : 'Dealer stands on all 17s (S17)';
  }

  // Soft 17 segmented buttons
  document.querySelectorAll('#h17-segment .segment-opt').forEach((btn) => {
    const isH17 = btn.dataset.val === 'h17';
    btn.classList.toggle('active', isH17 === settings.dealerHitsSoft17);
  });

  // Blackjack Payout segmented buttons
  document.querySelectorAll('#payout-segment .segment-opt').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.val === settings.blackjackPayout);
  });

  // Shoe Deck Count dropdown
  const deckSelect = document.getElementById('setting-deck-count');
  if (deckSelect) {
    deckSelect.value = String(settings.deckCount);
  }

  // Toggle switches
  const surrenderToggle = document.getElementById('setting-surrender-toggle');
  if (surrenderToggle) surrenderToggle.checked = settings.allowSurrender;

  const insuranceToggle = document.getElementById('setting-insurance-toggle');
  if (insuranceToggle) insuranceToggle.checked = settings.allowInsurance;

  const dasToggle = document.getElementById('setting-das-toggle');
  if (dasToggle) dasToggle.checked = settings.allowDoubleAfterSplit;

  const soundToggle = document.getElementById('setting-sound-toggle');
  if (soundToggle) soundToggle.checked = settings.soundEnabled;

  const shoeCounterToggle = document.getElementById('setting-shoe-counter-toggle');
  if (shoeCounterToggle) shoeCounterToggle.checked = settings.showShoeCounter;

  // Volume slider & label
  const volSlider = document.getElementById('setting-volume-slider');
  const volLabel = document.getElementById('setting-volume-label');
  if (volSlider) volSlider.value = String(settings.soundVolume);
  if (volLabel) volLabel.textContent = `${settings.soundVolume}%`;

  // Table Felt Swatches
  document.querySelectorAll('#felt-swatches .felt-swatch-item').forEach((swatch) => {
    swatch.classList.toggle('active', swatch.dataset.color === settings.feltColor);
  });

  // Animation Speed buttons
  document.querySelectorAll('#speed-segment .segment-opt').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.val === settings.animationSpeed);
  });

  // Tools availability
  const toolReshuffleBtn = document.getElementById('tool-reshuffle-btn');
  if (toolReshuffleBtn) {
    toolReshuffleBtn.disabled = gameState !== 'BETTING' || isBusy;
  }
  const toolReloadBankrollBtn = document.getElementById('tool-reload-bankroll-btn');
  if (toolReloadBankrollBtn) {
    toolReloadBankrollBtn.disabled = gameState !== 'BETTING' || isBusy;
  }
}

function openSettingsMenu() {
  syncSettingsUI();
  if (settingsOverlay) {
    settingsOverlay.classList.remove('hidden');
  }
}

function closeSettingsMenu() {
  if (settingsOverlay) {
    settingsOverlay.classList.add('hidden');
  }
}

if (settingsOpenBtn) {
  settingsOpenBtn.addEventListener('click', openSettingsMenu);
}
if (settingsCloseBtn) {
  settingsCloseBtn.addEventListener('click', closeSettingsMenu);
}
if (settingsDoneBtn) {
  settingsDoneBtn.addEventListener('click', closeSettingsMenu);
}
if (settingsBackdrop) {
  settingsBackdrop.addEventListener('click', closeSettingsMenu);
}

// Close settings menu with Escape key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && settingsOverlay && !settingsOverlay.classList.contains('hidden')) {
    closeSettingsMenu();
  }
});

// Settings Tab switching
document.querySelectorAll('.settings-tab-btn').forEach((tabBtn) => {
  tabBtn.addEventListener('click', () => {
    const tabKey = tabBtn.dataset.tab;
    document.querySelectorAll('.settings-tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.settings-tab-panel').forEach((p) => p.classList.remove('active'));
    tabBtn.classList.add('active');
    const target = document.getElementById(`tab-${tabKey}`);
    if (target) target.classList.add('active');
  });
});

// Settings Control Listeners
document.querySelectorAll('#h17-segment .segment-opt').forEach((btn) => {
  btn.addEventListener('click', () => {
    settings.dealerHitsSoft17 = btn.dataset.val === 'h17';
    saveSettings(settings);
    syncSettingsUI();
  });
});

document.querySelectorAll('#payout-segment .segment-opt').forEach((btn) => {
  btn.addEventListener('click', () => {
    settings.blackjackPayout = btn.dataset.val;
    saveSettings(settings);
    syncSettingsUI();
  });
});

const settingDeckCountSelect = document.getElementById('setting-deck-count');
if (settingDeckCountSelect) {
  settingDeckCountSelect.addEventListener('change', (e) => {
    const newCount = parseInt(e.target.value, 10);
    settings.deckCount = newCount;
    saveSettings(settings);
    if (gameState === 'BETTING' && !isBusy) {
      shoe = new Shoe(newCount);
      updateShoeDisplay();
    }
  });
}

const settingSurrenderToggle = document.getElementById('setting-surrender-toggle');
if (settingSurrenderToggle) {
  settingSurrenderToggle.addEventListener('change', (e) => {
    settings.allowSurrender = e.target.checked;
    saveSettings(settings);
  });
}

const settingInsuranceToggle = document.getElementById('setting-insurance-toggle');
if (settingInsuranceToggle) {
  settingInsuranceToggle.addEventListener('change', (e) => {
    settings.allowInsurance = e.target.checked;
    saveSettings(settings);
  });
}

const settingDasToggle = document.getElementById('setting-das-toggle');
if (settingDasToggle) {
  settingDasToggle.addEventListener('change', (e) => {
    settings.allowDoubleAfterSplit = e.target.checked;
    saveSettings(settings);
  });
}

const settingSoundToggle = document.getElementById('setting-sound-toggle');
if (settingSoundToggle) {
  settingSoundToggle.addEventListener('change', (e) => {
    settings.soundEnabled = e.target.checked;
    setSoundEnabled(settings.soundEnabled);
    saveSettings(settings);
  });
}

const settingVolumeSlider = document.getElementById('setting-volume-slider');
const settingVolumeLabel = document.getElementById('setting-volume-label');
if (settingVolumeSlider) {
  settingVolumeSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    settings.soundVolume = val;
    if (settingVolumeLabel) settingVolumeLabel.textContent = `${val}%`;
    setSoundVolume(val / 100);
    saveSettings(settings);
  });
  settingVolumeSlider.addEventListener('change', () => {
    playChipClinkSound();
  });
}

document.querySelectorAll('#felt-swatches .felt-swatch-item').forEach((swatch) => {
  swatch.addEventListener('click', () => {
    const color = swatch.dataset.color;
    settings.feltColor = color;
    saveSettings(settings);
    syncSettingsUI();
    if (table && table.setFeltColor) {
      table.setFeltColor(FELT_COLORS[color] || FELT_COLORS.emerald);
    }
  });
});

document.querySelectorAll('#speed-segment .segment-opt').forEach((btn) => {
  btn.addEventListener('click', () => {
    settings.animationSpeed = btn.dataset.val;
    saveSettings(settings);
    syncSettingsUI();
  });
});

const settingShoeCounterToggle = document.getElementById('setting-shoe-counter-toggle');
if (settingShoeCounterToggle) {
  settingShoeCounterToggle.addEventListener('change', (e) => {
    settings.showShoeCounter = e.target.checked;
    if (shoeCounter) {
      shoeCounter.style.display = settings.showShoeCounter ? 'block' : 'none';
    }
    saveSettings(settings);
  });
}

// Tool Action: Reshuffle Shoe
const toolReshuffleBtn = document.getElementById('tool-reshuffle-btn');
if (toolReshuffleBtn) {
  toolReshuffleBtn.addEventListener('click', () => {
    if (gameState !== 'BETTING' || isBusy) return;
    shoe.shuffle();
    playShuffleSound();
    updateShoeDisplay();
    const origText = toolReshuffleBtn.textContent;
    toolReshuffleBtn.textContent = 'Reshuffled! ✓';
    toolReshuffleBtn.disabled = true;
    setTimeout(() => {
      toolReshuffleBtn.textContent = origText;
      toolReshuffleBtn.disabled = gameState !== 'BETTING' || isBusy;
    }, 1200);
  });
}

// Tool Action: Reload Bankroll
const toolReloadBankrollBtn = document.getElementById('tool-reload-bankroll-btn');
if (toolReloadBankrollBtn) {
  toolReloadBankrollBtn.addEventListener('click', () => {
    if (gameState !== 'BETTING' || isBusy) return;
    bankroll = resetBankroll();
    currentBet = 0;
    clearBet();
    updateBankrollDisplay();
    playChipCollectSound();
    const origText = toolReloadBankrollBtn.textContent;
    toolReloadBankrollBtn.textContent = 'Reloaded $1,000 ✓';
    toolReloadBankrollBtn.disabled = true;
    setTimeout(() => {
      toolReloadBankrollBtn.textContent = origText;
      toolReloadBankrollBtn.disabled = gameState !== 'BETTING' || isBusy;
    }, 1200);
  });
}

// Initial Settings Sync
syncSettingsUI();

if (clearBetBtn) {
  clearBetBtn.addEventListener('click', clearBet);
}

document.querySelectorAll('.chip-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const denom = parseInt(btn.dataset.denom, 10);
    addBet(denom);
  });
});

if (resetBankrollBtn) {
  resetBankrollBtn.addEventListener('click', () => {
    bankroll = resetBankroll();
    currentBet = 0;
    updateBankrollDisplay();
    playChipClinkSound();
  });
}

// Initial UI sync
updateBankrollDisplay();

// 19. Resize Handler
window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// 20. Animation Loop
function animate(currentTime) {
  requestAnimationFrame(animate);
  const now = currentTime || performance.now();
  updateCardAnimations(now);

  if (activeHandMarker && activeHandMarker.group.visible) {
    const pulse = Math.sin(now * 0.005);
    activeHandMarker.lineMat.opacity = 0.65 + 0.35 * pulse;
    activeHandMarker.fillMat.opacity = 0.14 + 0.08 * pulse;
  }

  // Smooth Camera View Transitions
  if (cameraTransition) {
    const elapsed = now - cameraTransition.startTime;
    const progress = Math.min(1, elapsed / cameraTransition.duration);
    const eased = easeOutCubic(progress);

    camera.position.lerpVectors(cameraTransition.startPos, cameraTransition.endPos, eased);
    controls.target.lerpVectors(cameraTransition.startTarget, cameraTransition.endTarget, eased);

    if (progress >= 1) {
      camera.position.copy(cameraTransition.endPos);
      controls.target.copy(cameraTransition.endTarget);
      cameraTransition = null;
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

animate(performance.now());
