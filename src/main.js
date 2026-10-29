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
  resolveInsurance,
  getOptimalMove
} from './rules.js';
import {
  playCardSlideSound,
  playCardFlipSound,
  playChipClinkSound,
  playChipCollectSound,
  playWinSound,
  playBustSound,
  playShuffleSound,
  playLevelUpSound,
  setSoundEnabled,
  setSoundVolume
} from './audio.js';
import {
  loadBankroll,
  saveBankroll,
  resetBankroll,
  createChipMesh,
  CHIP_DENOMS,
  CHIP_CONFIGS,
  decomposeBet
} from './chips.js';
import {
  loadStats,
  resetStats,
  recordRoundOutcome,
  calculateWinRate,
  renderTrajectoryChart,
  getLevelProgression,
  getReloadAllowance,
  addLoyaltyXP,
  calculateLevel,
  getStrategyAccuracy,
  recordStrategyDecision,
  getNextMilestone
} from './stats.js';

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
camera.position.set(0, 0.82, 1.36);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0.52);
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
    pos: new THREE.Vector3(0, 0.82, 1.36),
    target: new THREE.Vector3(0, 0, 0.52)
  },
  closeup: {
    name: 'Close-Up',
    pos: new THREE.Vector3(0, 0.70, 1.20),
    target: new THREE.Vector3(0, 0, 0.52)
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
const dealBtnText = document.getElementById('deal-btn-text');
const dealKbdHint = document.getElementById('deal-kbd-hint');
const rebetBtn = document.getElementById('rebet-btn');
const rebetDealBtn = document.getElementById('rebet-deal-btn');
const doubleBetBtn = document.getElementById('double-bet-btn');
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

// Controls & Shortcuts Modal UI
const shortcutsOpenBtn = document.getElementById('shortcuts-open-btn');
const shortcutsOverlay = document.getElementById('shortcuts-overlay');
const shortcutsBackdrop = document.getElementById('shortcuts-backdrop');
const shortcutsCloseBtn = document.getElementById('shortcuts-close-btn');
const shortcutsDoneBtn = document.getElementById('shortcuts-done-btn');
const toolOpenShortcutsBtn = document.getElementById('tool-open-shortcuts-btn');
const gestureToast = document.getElementById('gesture-toast');

// Player Analytics & Stats Modal UI
const statsOpenBtn = document.getElementById('stats-open-btn');
const statsOverlay = document.getElementById('stats-overlay');
const statsBackdrop = document.getElementById('stats-backdrop');
const statsCloseBtn = document.getElementById('stats-close-btn');
const statsDoneBtn = document.getElementById('stats-done-btn');
const statsResetBtn = document.getElementById('stats-reset-btn');
const toolOpenStatsBtn = document.getElementById('tool-open-stats-btn');
const statsChartCanvas = document.getElementById('stats-chart-canvas');

const kpiNetProfit = document.getElementById('kpi-net-profit');
const kpiTotalWagered = document.getElementById('kpi-total-wagered');
const kpiWinRate = document.getElementById('kpi-win-rate');
const kpiRecord = document.getElementById('kpi-record');
const kpiBlackjacks = document.getElementById('kpi-blackjacks');
const kpiBjFreq = document.getElementById('kpi-bj-freq');
const kpiStreak = document.getElementById('kpi-streak');
const kpiBestStreak = document.getElementById('kpi-best-streak');
const kpiBiggestWin = document.getElementById('kpi-biggest-win');
const kpiHandsPlayed = document.getElementById('kpi-hands-played');

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

// Discard Tray & Card Cleanup State
let discardedCardsCount = 0;
let autoCleanupTimer = null;
let isCleaningCards = false;
let pendingDealAfterCleanup = false;

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

function drawCardFromShoe() {
  const card = shoe.drawCard();
  if (shoe.reshuffledThisDraw) {
    discardedCardsCount = 0;
    if (table && table.resetDiscardStack) {
      table.resetDiscardStack();
    }
    playShuffleSound();
  }
  updateShoeDisplay();
  return card;
}

function updateBankrollDisplay() {
  if (bankrollVal) {
    bankrollVal.textContent = `$${bankroll.toLocaleString()}`;
  }

  const stats = loadStats();
  const prog = getLevelProgression(stats);
  const allowance = prog.reloadAllowance || 1000;

  const levelBadge = document.getElementById('bankroll-level-badge');
  if (levelBadge) {
    levelBadge.textContent = `${prog.icon} Lv. ${prog.level}`;
  }

  const titleBadge = document.getElementById('bankroll-title-badge');
  if (titleBadge) {
    titleBadge.textContent = prog.title;
  }

  const xpText = document.getElementById('bankroll-xp-text');
  if (xpText) {
    const curInLvl = Math.max(0, prog.xp - prog.levelMinXp);
    const spanLvl = Math.max(1, prog.levelMaxXp - prog.levelMinXp);
    xpText.textContent = `${curInLvl.toLocaleString()} / ${spanLvl.toLocaleString()} XP`;
  }

  const xpFill = document.getElementById('bankroll-xp-fill');
  if (xpFill) {
    xpFill.style.width = `${prog.levelProgressPercent}%`;
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

  // Update Deal, Rebet, and Rebet & Deal button states
  if (gameState === 'BETTING') {
    if (currentBet > 0) {
      dealBtn.disabled = false;
      if (dealBtnText) {
        dealBtnText.textContent = `Deal ($${currentBet.toLocaleString()})`;
      } else {
        dealBtn.textContent = `Deal ($${currentBet.toLocaleString()})`;
      }
      if (dealKbdHint) dealKbdHint.classList.remove('hidden');
      if (rebetBtn) rebetBtn.classList.add('hidden');
      if (rebetDealBtn) rebetDealBtn.classList.add('hidden');
    } else {
      dealBtn.disabled = true;
      if (dealBtnText) {
        dealBtnText.textContent = 'Place a Bet';
      } else {
        dealBtn.textContent = 'Place a Bet';
      }
      if (dealKbdHint) dealKbdHint.classList.add('hidden');

      if (lastRoundBet > 0) {
        if (rebetBtn) {
          rebetBtn.classList.remove('hidden');
          rebetBtn.disabled = bankroll < lastRoundBet;
          const rebetLabel = rebetBtn.querySelector('.btn-text');
          if (rebetLabel) {
            rebetLabel.textContent = `Rebet ($${lastRoundBet.toLocaleString()})`;
          }
        }
        if (rebetDealBtn) {
          rebetDealBtn.classList.remove('hidden');
          rebetDealBtn.disabled = bankroll < lastRoundBet;
        }
      } else {
        if (rebetBtn) rebetBtn.classList.add('hidden');
        if (rebetDealBtn) rebetDealBtn.classList.add('hidden');
      }
    }
  } else {
    if (rebetBtn) rebetBtn.classList.add('hidden');
    if (rebetDealBtn) rebetDealBtn.classList.add('hidden');
  }

  // Update chip button disabled states
  document.querySelectorAll('.chip-btn').forEach((btn) => {
    const denom = parseInt(btn.dataset.denom, 10);
    btn.disabled = gameState !== 'BETTING' || bankroll < denom;
  });

  if (doubleBetBtn) {
    doubleBetBtn.disabled = gameState !== 'BETTING' || currentBet === 0 || bankroll < currentBet;
  }

  if (clearBetBtn) {
    clearBetBtn.disabled = gameState !== 'BETTING' || currentBet === 0;
  }

  // If bankroll is zero and no active bet, show reload button with dynamic tier allowance
  if (resetBankrollBtn) {
    resetBankrollBtn.textContent = `Reload $${allowance.toLocaleString()}`;
    if (bankroll === 0 && currentBet === 0 && gameState === 'BETTING') {
      resetBankrollBtn.classList.remove('hidden');
    } else {
      resetBankrollBtn.classList.add('hidden');
    }
  }
}

// Level-Up & Tier Celebration Banner Management
let levelUpToastTimer = null;
function showLevelUpCelebration(xpResult) {
  if (!xpResult || !xpResult.leveledUp) return;

  playLevelUpSound();

  const toast = document.getElementById('levelup-toast');
  const tag = document.getElementById('levelup-tag');
  const title = document.getElementById('levelup-title');
  const desc = document.getElementById('levelup-desc');
  const icon = document.getElementById('levelup-icon');

  if (toast && title && desc) {
    const prog = xpResult.newProgression;
    if (tag) tag.textContent = '⭐ LEVEL UP!';
    if (icon) icon.textContent = prog.icon;
    title.textContent = `Level ${xpResult.newLevel}`;
    desc.textContent = `${prog.title} • Reload: $${prog.reloadAllowance.toLocaleString()}`;

    toast.classList.remove('hidden');
    toast.classList.remove('fade-out');

    if (levelUpToastTimer) clearTimeout(levelUpToastTimer);
    levelUpToastTimer = setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => {
        toast.classList.add('hidden');
        toast.classList.remove('fade-out');
      }, 350);
    }, 4200);
  }
}

function logRoundOutcome(params) {
  const result = recordRoundOutcome(params);
  updateBankrollDisplay();
  if (result && result.xpResult && result.xpResult.leveledUp) {
    showLevelUpCelebration(result.xpResult);
  }
  return result;
}

// 9. 3D Chips on the Table (Near Player's Right Side)
const chipTrayGroup = new THREE.Group();
chipTrayGroup.position.set(0, 0, 0);
scene.add(chipTrayGroup);

// Tray base plate (Extended to fit all 6 chip stacks $1 through $1,000)
const trayBaseGeo = new THREE.BoxGeometry(0.31, 0.006, 0.065);
const trayBaseMat = new THREE.MeshStandardMaterial({
  color: 0x24140b,
  roughness: 0.4,
  metalness: 0.1
});
const trayBase = new THREE.Mesh(trayBaseGeo, trayBaseMat);
trayBase.position.set(0.28, 0.003, 0.86);
trayBase.receiveShadow = true;
chipTrayGroup.add(trayBase);

// Chip stack positions on table ($1, $5, $25, $100, $500, $1,000)
const stackPositions = {
  1: new THREE.Vector3(0.155, 0.006, 0.86),
  5: new THREE.Vector3(0.205, 0.006, 0.86),
  25: new THREE.Vector3(0.255, 0.006, 0.86),
  100: new THREE.Vector3(0.305, 0.006, 0.86),
  500: new THREE.Vector3(0.355, 0.006, 0.86),
  1000: new THREE.Vector3(0.405, 0.006, 0.86)
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
const BET_CIRCLE_CENTER = new THREE.Vector3(0, 0.0028, 0.882);

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

function handleRebet() {
  if (gameState !== 'BETTING' || isBusy || lastRoundBet <= 0) return;
  if (bankroll < lastRoundBet) return;

  // Clear existing bet first if any
  if (currentBet > 0) {
    bankroll += currentBet;
    currentBet = 0;
    betChipMeshes.forEach((mesh) => {
      scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      }
    });
    betChipMeshes.length = 0;
  }

  bankroll -= lastRoundBet;
  currentBet = lastRoundBet;
  saveBankroll(bankroll);
  updateBankrollDisplay();

  const chips = decomposeBet(lastRoundBet);
  chips.forEach((denom, i) => {
    const chipMesh = createChipMesh(denom);
    const stackIdx = betChipMeshes.length;
    const chipTargetY = BET_CIRCLE_CENTER.y + stackIdx * 0.0034;

    const jitterX = (Math.random() - 0.5) * 0.004;
    const jitterZ = (Math.random() - 0.5) * 0.004;
    const targetPos = new THREE.Vector3(
      BET_CIRCLE_CENTER.x + jitterX,
      chipTargetY,
      BET_CIRCLE_CENTER.z + jitterZ
    );

    const basePos = stackPositions[denom] || stackPositions[100];
    const startPos = basePos.clone();
    startPos.y += 0.015;
    chipMesh.position.copy(startPos);
    chipMesh.rotation.y = Math.random() * Math.PI * 2;
    scene.add(chipMesh);
    betChipMeshes.push(chipMesh);

    animateCard({
      mesh: chipMesh,
      startPos,
      targetPos,
      startRotY: chipMesh.rotation.y,
      targetRotY: chipMesh.rotation.y + (Math.random() - 0.5) * 0.8,
      arcHeight: 0.045,
      duration: Math.min(320, 160 + i * 25),
      onComplete: () => {
        if (i === 0) playChipClinkSound();
      }
    });
  });

  playChipClinkSound();
}

function handleRebetAndDeal() {
  if (gameState !== 'BETTING' || isBusy || lastRoundBet <= 0) return;
  if (bankroll < lastRoundBet) return;

  handleRebet();
  setTimeout(() => {
    if (gameState === 'BETTING' && currentBet > 0 && !isBusy) {
      dealRound();
    }
  }, 220);
}

function handleDoubleBet() {
  if (gameState !== 'BETTING' || isBusy || currentBet <= 0) return;
  if (bankroll < currentBet) return;

  const addAmount = currentBet;
  bankroll -= addAmount;
  currentBet += addAmount;
  saveBankroll(bankroll);
  updateBankrollDisplay();

  const chips = decomposeBet(addAmount);
  chips.forEach((denom, i) => {
    const chipMesh = createChipMesh(denom);
    const stackIdx = betChipMeshes.length;
    const chipTargetY = BET_CIRCLE_CENTER.y + stackIdx * 0.0034;

    const jitterX = (Math.random() - 0.5) * 0.004;
    const jitterZ = (Math.random() - 0.5) * 0.004;
    const targetPos = new THREE.Vector3(
      BET_CIRCLE_CENTER.x + jitterX,
      chipTargetY,
      BET_CIRCLE_CENTER.z + jitterZ
    );

    const basePos = stackPositions[denom] || stackPositions[100];
    const startPos = basePos.clone();
    startPos.y += 0.015;
    chipMesh.position.copy(startPos);
    chipMesh.rotation.y = Math.random() * Math.PI * 2;
    scene.add(chipMesh);
    betChipMeshes.push(chipMesh);

    animateCard({
      mesh: chipMesh,
      startPos,
      targetPos,
      startRotY: chipMesh.rotation.y,
      targetRotY: chipMesh.rotation.y + (Math.random() - 0.5) * 0.8,
      arcHeight: 0.045,
      duration: Math.min(320, 160 + i * 25),
      onComplete: () => {
        if (i === 0) playChipClinkSound();
      }
    });
  });

  playChipClinkSound();
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

  // 1. Check if chips placed in the betting circle were clicked to remove/refund
  if (betChipMeshes.length > 0) {
    const circleIntersects = raycaster.intersectObjects(betChipMeshes, true);
    if (circleIntersects.length > 0) {
      const topChip = betChipMeshes.pop();
      if (topChip) {
        const denom = topChip.userData?.denom || 0;
        scene.remove(topChip);
        if (topChip.geometry) topChip.geometry.dispose();
        if (Array.isArray(topChip.material)) {
          topChip.material.forEach((m) => m.dispose());
        }

        bankroll += denom;
        currentBet = Math.max(0, currentBet - denom);
        saveBankroll(bankroll);
        updateBankrollDisplay();
        playChipClinkSound();
        showGestureToast(`-$${denom} (Bet: $${currentBet})`);
        return;
      }
    }
  }

  // 2. Check if chip tray stacks were clicked to add to bet
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

// Cursor hover pointer feedback for both chip tray and active bet stack
window.addEventListener('pointermove', (e) => {
  if (gameState !== 'BETTING' || isBusy) {
    renderer.domElement.style.cursor = 'default';
    return;
  }
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const targets = [...clickableChipObjects, ...betChipMeshes];
  const intersects = raycaster.intersectObjects(targets, true);
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
    BET_CIRCLE_CENTER.y + chipIndex * 0.0034,
    BET_CIRCLE_CENTER.z
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

// 14b. Animated Discard Tray & Card Cleanup Flow
function sweepCardsToDiscard(onComplete, isExpedited = false) {
  if (autoCleanupTimer) {
    clearTimeout(autoCleanupTimer);
    autoCleanupTimer = null;
  }

  const cardsToSweep = [...dealerHand, ...playerHands.flatMap((h) => h.cards)];
  playerHands = [];
  dealerHand = [];

  if (cardsToSweep.length === 0) {
    if (onComplete) onComplete();
    return;
  }

  isCleaningCards = true;

  // Clear score badges while cards are being collected
  updateScoresDisplay();

  // Cancel any lingering animations for these cards
  const sweepMeshes = new Set(cardsToSweep.map((c) => c.mesh));
  for (let i = activeAnimations.length - 1; i >= 0; i--) {
    if (sweepMeshes.has(activeAnimations[i].mesh)) {
      activeAnimations.splice(i, 1);
    }
  }

  const speedScale = getSpeedScale();
  const gatherDuration = isExpedited ? 130 : Math.max(120, Math.round(220 * speedScale));
  const slideDuration = isExpedited ? 160 : Math.max(140, Math.round(260 * speedScale));
  const gatherStagger = isExpedited ? 8 : Math.max(6, Math.round(18 * speedScale));

  let gatheredCount = 0;
  const totalCards = cardsToSweep.length;

  cardsToSweep.forEach((cardObj, idx) => {
    const mesh = cardObj.mesh;
    const currentPos = mesh.position.clone();
    const currentRotY = mesh.rotation.y;
    const currentRotZ = mesh.rotation.z;

    // Stack cards at center felt
    const gatherTargetPos = new THREE.Vector3(
      0,
      0.015 + idx * 0.0012,
      0.38
    );

    activeAnimations.push({
      mesh,
      startPos: currentPos,
      targetPos: gatherTargetPos,
      startRotY: currentRotY,
      targetRotY: 0,
      startRotZ: currentRotZ,
      targetRotZ: 0,
      arcHeight: 0.024,
      duration: gatherDuration,
      delay: idx * gatherStagger,
      startTime: null,
      started: false,
      onStart: idx === 0 ? playCardSlideSound : null,
      onComplete: () => {
        gatheredCount++;
        if (gatheredCount === totalCards) {
          slideStackToDiscardTray(cardsToSweep, slideDuration, () => {
            isCleaningCards = false;
            if (pendingDealAfterCleanup) {
              pendingDealAfterCleanup = false;
              isBusy = false;
              startActualDeal();
            } else if (onComplete) {
              onComplete();
            }
          });
        }
      }
    });
  });
}

function slideStackToDiscardTray(cardsToSweep, slideDuration, onDone) {
  let slidCount = 0;
  const totalCards = cardsToSweep.length;
  const dest = table.discardDestination || new THREE.Vector3(-0.66, 0.026, 0.08);

  cardsToSweep.forEach((cardObj, idx) => {
    const mesh = cardObj.mesh;
    const currentPos = mesh.position.clone();
    const currentRotY = mesh.rotation.y;
    const currentRotZ = mesh.rotation.z;

    const trayTargetPos = new THREE.Vector3(
      dest.x,
      dest.y + idx * 0.0008,
      dest.z
    );

    activeAnimations.push({
      mesh,
      startPos: currentPos,
      targetPos: trayTargetPos,
      startRotY: currentRotY,
      targetRotY: 0.48, // Aligned with the angled discard tray
      startRotZ: currentRotZ,
      targetRotZ: 0,
      arcHeight: 0.012,
      duration: slideDuration,
      delay: idx * 4,
      startTime: null,
      started: false,
      onStart: idx === 0 ? playCardSlideSound : null,
      onComplete: () => {
        slidCount++;
        if (slidCount === totalCards) {
          // Dispose meshes and update tray stack
          cardsToSweep.forEach(({ mesh: m }) => {
            scene.remove(m);
            if (m.geometry) m.geometry.dispose();
            if (Array.isArray(m.material)) {
              m.material.forEach((mat) => mat.dispose());
            }
          });

          discardedCardsCount += totalCards;
          if (table && table.updateDiscardStackHeight) {
            table.updateDiscardStackHeight(discardedCardsCount, shoe.numDecks * 52);
          }

          if (onDone) onDone();
        }
      }
    });
  });
}

// 15. Deal Flow
function dealRound() {
  if (isBusy || currentBet <= 0) return;

  if (autoCleanupTimer) {
    clearTimeout(autoCleanupTimer);
    autoCleanupTimer = null;
  }

  // If cards are currently mid-sweep, mark deal pending so it starts right when cleanup finishes
  if (isCleaningCards) {
    pendingDealAfterCleanup = true;
    isBusy = true;
    return;
  }

  // If previous round cards are still sitting on the table, perform an expedited sweep first
  const remainingCards = [...dealerHand, ...playerHands.flatMap((h) => h.cards)];
  if (remainingCards.length > 0) {
    isBusy = true;
    sweepCardsToDiscard(() => {
      isBusy = false;
      startActualDeal();
    }, true /* expedited sweep */);
    return;
  }

  startActualDeal();
}

function startActualDeal() {
  if (currentBet <= 0) {
    isBusy = false;
    return;
  }
  isBusy = true;
  gameState = 'DEALING';
  lastRoundBet = currentBet;

  // Switch camera to dramatic close-up view for the action
  switchCameraView('closeup');

  dealBtn.disabled = true;
  dealBtn.classList.add('hidden');
  if (rebetBtn) rebetBtn.classList.add('hidden');
  if (rebetDealBtn) rebetDealBtn.classList.add('hidden');
  bettingControls.classList.add('hidden');
  playerActions.classList.add('hidden');
  hideResultBanner();

  if (activeHandMarker) {
    activeHandMarker.group.visible = false;
  }

  // Clear previous round cards (safety check)
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
    : (forceNextPairRank ? { suit: 'spades', rank: forceNextPairRank } : drawCardFromShoe());
  const dCard1 = forceDealerUpRank ? { suit: 'spades', rank: forceDealerUpRank } : drawCardFromShoe();
  const pCard2 = forcePlayerCards
    ? { suit: 'hearts', rank: forcePlayerCards[1] }
    : (forceNextPairRank ? { suit: 'hearts', rank: forceNextPairRank } : drawCardFromShoe());
  const dCard2 = forceDealerHoleRank ? { suit: 'diamonds', rank: forceDealerHoleRank } : drawCardFromShoe();
  forcePlayerCards = null;
  forceNextPairRank = null;
  forceDealerUpRank = null;
  forceDealerHoleRank = null;

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
    logRoundOutcome({
      wager: lastRoundBet,
      netChange: insuranceBet > 0 ? insProfit : 0,
      outcome: insuranceBet > 0 && insProfit > 0 ? 'win' : 'push',
      isBlackjack: true,
      currentBankroll: bankroll
    });
    if (insuranceBet > 0) {
      showResultBanner('DEALER BLACKJACK', `Both have Blackjack (Push) &bull; Insurance Won (+$${insProfit})`, 'win');
    } else {
      showResultBanner('PUSH', 'Both have Blackjack &bull; Bet Returned', 'push');
    }
  } else {
    // Player does not have Blackjack: main bet lost
    const net = (insuranceBet > 0 ? insProfit : 0) - lastRoundBet;
    logRoundOutcome({
      wager: lastRoundBet,
      netChange: net,
      outcome: net > 0 ? 'win' : net === 0 ? 'push' : 'loss',
      isBlackjack: false,
      currentBankroll: bankroll
    });
    if (insuranceBet > 0) {
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
      logRoundOutcome({
        wager: lastRoundBet,
        netChange: profit,
        outcome: 'bj',
        isBlackjack: true,
        currentBankroll: bankroll
      });
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

function trackPlayerStrategyDecision(action, hand) {
  if (!hand || !dealerHand) return;
  const dealerUpcard = dealerHand.find((c) => !c.isHole)?.data;
  if (!dealerUpcard) return;

  const optimal = getOptimalMove(
    hand.cards.map((c) => c.data),
    dealerUpcard,
    {
      canDouble: canDoubleDown(hand.cards.map((c) => c.data), bankroll, hand.bet) && !hand.isSplitAces,
      canSplitPair: canSplit(hand.cards.map((c) => c.data), bankroll, hand.bet, totalSplits),
      canLateSurrender: canSurrender(
        hand.cards.map((c) => c.data),
        true,
        playerHands.length === 1 && totalSplits === 0
      ),
      hitSoft17: settings.dealerHitsSoft17
    }
  );

  const isOptimal = action === optimal;
  recordStrategyDecision(isOptimal);
}

function handlePlayerHit() {
  if (isBusy || gameState !== 'PLAYER_TURN') return;
  const hand = playerHands[activeHandIndex];
  if (!hand || hand.isDone) return;

  trackPlayerStrategyDecision('H', hand);

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

  const cardData = drawCardFromShoe();

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

  trackPlayerStrategyDecision('S', hand);

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

  trackPlayerStrategyDecision('D', hand);

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
  const cardData = drawCardFromShoe();

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

  trackPlayerStrategyDecision('P', hand);

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
  newChip.position.copy(hand.chipMeshes[0]?.position || BET_CIRCLE_CENTER);
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
    const cardData1 = drawCardFromShoe();
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
          const cardData2 = drawCardFromShoe();
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

  trackPlayerStrategyDecision('U', hand);

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
  logRoundOutcome({
    wager: hand.bet,
    netChange: -forfeited,
    outcome: 'loss',
    isBlackjack: false,
    currentBankroll: bankroll
  });
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
      const cardData = drawCardFromShoe();

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

  const totalWager = playerHands.reduce((acc, h) => acc + h.bet, 0);
  const hadBlackjack = playerHands.some(
    (h) => determineOutcome(h.cards.map((c) => c.data), dealerHand.map((c) => c.data), isMultiHand) === 'player_blackjack'
  );
  const roundType = netGain > 0 ? (hadBlackjack ? 'bj' : 'win') : netGain < 0 ? 'loss' : 'push';

  logRoundOutcome({
    wager: totalWager,
    netChange: netGain,
    outcome: roundType,
    isBlackjack: hadBlackjack,
    currentBankroll: bankroll
  });

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

  // Schedule auto-cleanup of cards into the discard tray after idle pause (1.8s scaled)
  if (autoCleanupTimer) {
    clearTimeout(autoCleanupTimer);
    autoCleanupTimer = null;
  }
  const hasCards = dealerHand.length > 0 || playerHands.some((h) => h.cards.length > 0);
  if (hasCards) {
    const idleDelay = Math.round(1800 * getSpeedScale());
    autoCleanupTimer = setTimeout(() => {
      autoCleanupTimer = null;
      sweepCardsToDiscard();
    }, idleDelay);
  }
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

// Rebet, Rebet & Deal, and 2x Double Bet Action Listeners
if (rebetBtn) {
  rebetBtn.addEventListener('click', handleRebet);
}
if (rebetDealBtn) {
  rebetDealBtn.addEventListener('click', handleRebetAndDeal);
}
if (doubleBetBtn) {
  doubleBetBtn.addEventListener('click', handleDoubleBet);
}

// Controls & Shortcuts Modal Management
function openShortcutsModal() {
  if (shortcutsOverlay) {
    shortcutsOverlay.classList.remove('hidden');
  }
}

function closeShortcutsModal() {
  if (shortcutsOverlay) {
    shortcutsOverlay.classList.add('hidden');
  }
}

function toggleShortcutsModal() {
  if (!shortcutsOverlay) return;
  if (shortcutsOverlay.classList.contains('hidden')) {
    openShortcutsModal();
  } else {
    closeShortcutsModal();
  }
}

if (shortcutsOpenBtn) {
  shortcutsOpenBtn.addEventListener('click', openShortcutsModal);
}
if (shortcutsCloseBtn) {
  shortcutsCloseBtn.addEventListener('click', closeShortcutsModal);
}
if (shortcutsBackdrop) {
  shortcutsBackdrop.addEventListener('click', closeShortcutsModal);
}
if (shortcutsDoneBtn) {
  shortcutsDoneBtn.addEventListener('click', closeShortcutsModal);
}
if (toolOpenShortcutsBtn) {
  toolOpenShortcutsBtn.addEventListener('click', () => {
    closeSettingsMenu();
    openShortcutsModal();
  });
}

// Player Analytics & Stats Modal Management
function updateStatsUI() {
  const stats = loadStats();
  const prog = getLevelProgression(stats);

  // Level Progression Card
  const levelIcon = document.getElementById('stats-level-icon');
  const levelName = document.getElementById('stats-level-name');
  const levelTag = document.getElementById('stats-level-tag');
  const levelTitleTag = document.getElementById('stats-level-title-tag');
  const levelFill = document.getElementById('stats-level-fill');
  const xpSummary = document.getElementById('stats-xp-summary');
  const levelTarget = document.getElementById('stats-level-target');
  const nextPreview = document.getElementById('stats-next-preview');

  if (levelIcon) levelIcon.textContent = prog.icon;
  if (levelName) {
    levelName.textContent = `Level ${prog.level}`;
  }
  if (levelTag) levelTag.textContent = prog.title;
  if (levelTitleTag) levelTitleTag.textContent = `Reload: $${prog.reloadAllowance.toLocaleString()}`;
  if (levelFill) levelFill.style.width = `${prog.levelProgressPercent}%`;
  if (xpSummary) {
    const curInLvl = Math.max(0, prog.xp - prog.levelMinXp);
    const spanLvl = Math.max(1, prog.levelMaxXp - prog.levelMinXp);
    xpSummary.textContent = `${curInLvl.toLocaleString()} / ${spanLvl.toLocaleString()} XP to Level ${prog.level + 1}`;
  }
  if (levelTarget) {
    levelTarget.textContent = `${prog.levelToNext.toLocaleString()} XP remaining (${prog.levelProgressPercent}%)`;
  }

  // Next milestone preview
  if (nextPreview) {
    const nextMs = getNextMilestone(prog.level);
    if (nextMs) {
      nextPreview.textContent = `${nextMs.icon} Level ${nextMs.level}: "${nextMs.title}" — Reload $${nextMs.reloadAllowance.toLocaleString()}`;
    } else {
      nextPreview.textContent = '🏆 All milestones achieved! Maximum reload unlocked.';
    }
  }

  // Career XP & Peak Bankroll KPIs
  const kpiTotalXp = document.getElementById('kpi-total-xp');
  const kpiLevelSub = document.getElementById('kpi-level-sub');
  const kpiPeakBankroll = document.getElementById('kpi-peak-bankroll');

  if (kpiTotalXp) {
    kpiTotalXp.textContent = `${prog.xp.toLocaleString()} XP`;
  }
  if (kpiLevelSub) {
    const curInLvl = Math.max(0, prog.xp - prog.levelMinXp);
    const spanLvl = Math.max(1, prog.levelMaxXp - prog.levelMinXp);
    kpiLevelSub.textContent = `Level ${prog.level} • ${curInLvl.toLocaleString()} / ${spanLvl.toLocaleString()} XP`;
  }
  if (kpiPeakBankroll) {
    kpiPeakBankroll.textContent = `$${(stats.peakBankroll || bankroll || 1000).toLocaleString()}`;
  }

  if (kpiNetProfit) {
    const isPos = stats.netProfit > 0;
    const isNeg = stats.netProfit < 0;
    kpiNetProfit.textContent = `${isPos ? '+' : ''}$${stats.netProfit.toLocaleString()}`;
    kpiNetProfit.className = `kpi-value ${isPos ? 'profit-positive' : isNeg ? 'profit-negative' : 'profit-neutral'}`;
  }
  if (kpiTotalWagered) {
    kpiTotalWagered.textContent = `Total Wagered: $${stats.totalWagered.toLocaleString()}`;
  }
  if (kpiWinRate) {
    const rate = calculateWinRate(stats);
    kpiWinRate.textContent = `${rate}%`;
  }
  if (kpiRecord) {
    kpiRecord.textContent = `${stats.handsWon}W • ${stats.handsLost}L • ${stats.handsPushed}P`;
  }

  // Basic Strategy Accuracy
  const kpiStrategyAcc = document.getElementById('kpi-strategy-acc');
  const kpiStrategySub = document.getElementById('kpi-strategy-sub');
  if (kpiStrategyAcc) {
    const acc = getStrategyAccuracy(stats);
    kpiStrategyAcc.textContent = `${acc}%`;
  }
  if (kpiStrategySub) {
    kpiStrategySub.textContent = `${stats.optimalDecisions || 0} / ${stats.strategyDecisions || 0} optimal decisions`;
  }

  if (kpiBlackjacks) {
    kpiBlackjacks.textContent = stats.blackjacks.toString();
  }
  if (kpiBjFreq) {
    const freq = stats.handsPlayed > 0 ? ((stats.blackjacks / stats.handsPlayed) * 100).toFixed(1) : '0.0';
    kpiBjFreq.textContent = `${freq}% of hands`;
  }
  if (kpiStreak) {
    kpiStreak.textContent = stats.currentStreak > 0 ? `+${stats.currentStreak} 🔥` : stats.currentStreak < 0 ? `${stats.currentStreak} ❄️` : '0';
  }
  if (kpiBestStreak) {
    kpiBestStreak.textContent = `Best Streak: ${stats.bestStreak}`;
  }
  if (kpiBiggestWin) {
    kpiBiggestWin.textContent = `+$${stats.biggestWin.toLocaleString()}`;
  }
  if (kpiHandsPlayed) {
    kpiHandsPlayed.textContent = stats.handsPlayed.toLocaleString();
  }

  if (statsChartCanvas) {
    renderTrajectoryChart(statsChartCanvas, stats);
  }
}

function openStatsModal() {
  if (statsOverlay) {
    statsOverlay.classList.remove('hidden');
    updateStatsUI();
  }
}

function closeStatsModal() {
  if (statsOverlay) {
    statsOverlay.classList.add('hidden');
  }
}

function toggleStatsModal() {
  if (!statsOverlay) return;
  if (statsOverlay.classList.contains('hidden')) {
    openStatsModal();
  } else {
    closeStatsModal();
  }
}

if (statsOpenBtn) {
  statsOpenBtn.addEventListener('click', openStatsModal);
}
if (statsCloseBtn) {
  statsCloseBtn.addEventListener('click', closeStatsModal);
}
if (statsBackdrop) {
  statsBackdrop.addEventListener('click', closeStatsModal);
}
if (statsDoneBtn) {
  statsDoneBtn.addEventListener('click', closeStatsModal);
}
if (toolOpenStatsBtn) {
  toolOpenStatsBtn.addEventListener('click', () => {
    closeSettingsMenu();
    openStatsModal();
  });
}
if (statsResetBtn) {
  statsResetBtn.addEventListener('click', () => {
    resetStats();
    updateStatsUI();
    updateBankrollDisplay();
    showGestureToast('Career Analytics Reset ✓');
  });
}

const bankrollCard = document.getElementById('bankroll-card');
if (bankrollCard) {
  bankrollCard.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'reset-bankroll-btn') return;
    openStatsModal();
  });
}

const levelupToast = document.getElementById('levelup-toast');
if (levelupToast) {
  levelupToast.addEventListener('click', () => {
    levelupToast.classList.add('hidden');
    openStatsModal();
  });
}

// Floating Toast / Gesture Feedback
let gestureToastTimer = null;
function showGestureToast(msg) {
  if (!gestureToast) return;
  gestureToast.textContent = msg;
  gestureToast.classList.remove('hidden');
  gestureToast.classList.remove('toast-fade');

  if (navigator.vibrate) {
    try {
      navigator.vibrate(15);
    } catch (e) {
      // Haptics not allowed or unsupported
    }
  }

  if (gestureToastTimer) {
    clearTimeout(gestureToastTimer);
  }
  gestureToastTimer = setTimeout(() => {
    gestureToast.classList.add('toast-fade');
    gestureToastTimer = setTimeout(() => {
      gestureToast.classList.add('hidden');
      gestureToast.classList.remove('toast-fade');
    }, 320);
  }, 700);
}

// Mobile / Tablet Touch Gestures on Table Felt
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let touchFingerCount = 0;

window.addEventListener(
  'touchstart',
  (e) => {
    // Ignore touches starting inside interactive HUD controls or modals
    if (
      e.target.closest(
        'button, input, select, a, #settings-overlay, #shortcuts-overlay, #action-bar, #top-nav-bar, #bankroll-card'
      )
    ) {
      touchFingerCount = 0;
      return;
    }

    touchFingerCount = e.touches.length;
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = performance.now();
    } else if (e.touches.length === 2) {
      touchStartTime = performance.now();
    }
  },
  { passive: true }
);

window.addEventListener(
  'touchend',
  (e) => {
    if (gameState !== 'PLAYER_TURN' || isBusy) {
      touchFingerCount = 0;
      return;
    }

    const elapsed = performance.now() - touchStartTime;

    // Two-finger tap within 400ms -> Split
    if (touchFingerCount === 2 && elapsed < 400) {
      if (splitBtn && !splitBtn.disabled && !splitBtn.classList.contains('hidden')) {
        showGestureToast('Split ✌');
        handlePlayerSplit();
      }
      touchFingerCount = 0;
      return;
    }

    if (touchFingerCount === 1 && elapsed < 650) {
      const touch = e.changedTouches[0];
      if (!touch) return;
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const minDistance = 35;

      if (absY > absX && absY > minDistance) {
        if (deltaY > 0) {
          // Swipe Down -> Hit
          if (hitBtn && !hitBtn.disabled && !playerActions.classList.contains('hidden')) {
            showGestureToast('Hit ⬇');
            handlePlayerHit();
          }
        } else {
          // Swipe Up -> Double Down
          if (doubleBtn && !doubleBtn.disabled && !doubleBtn.classList.contains('hidden')) {
            showGestureToast('Double ⬆');
            handlePlayerDouble();
          }
        }
      } else if (absX > absY && absX > minDistance) {
        // Swipe Horizontal -> Stand
        if (standBtn && !standBtn.disabled && !playerActions.classList.contains('hidden')) {
          showGestureToast('Stand ➡');
          handlePlayerStand();
        }
      }
    }
    touchFingerCount = 0;
  },
  { passive: true }
);

// Comprehensive Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
  // Ignore keystrokes inside form fields
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
    return;
  }

  const key = e.key.toLowerCase();

  // Escape key: close whichever modal is open
  if (e.key === 'Escape') {
    if (statsOverlay && !statsOverlay.classList.contains('hidden')) {
      closeStatsModal();
      return;
    }
    if (shortcutsOverlay && !shortcutsOverlay.classList.contains('hidden')) {
      closeShortcutsModal();
      return;
    }
    if (settingsOverlay && !settingsOverlay.classList.contains('hidden')) {
      closeSettingsMenu();
      return;
    }
  }

  // 'T' key: toggle stats and analytics dashboard
  if (key === 't' && !e.altKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    toggleStatsModal();
    return;
  }

  // '?' key: toggle shortcuts and gestures guide
  if (e.key === '?' || (e.key === '/' && !e.ctrlKey && !e.metaKey)) {
    e.preventDefault();
    toggleShortcutsModal();
    return;
  }

  // Developer simulation cheats (Require Alt + key to avoid gameplay key collisions)
  if (e.altKey && gameState === 'BETTING') {
    if (key === 's') { forceNextPairRank = '8'; return; }
    if (key === 'a') { forceNextPairRank = 'A'; return; }
    if (key === 'i') { forceDealerUpRank = 'A'; forceDealerHoleRank = 'K'; return; }
    if (key === 'o') { forceDealerUpRank = 'A'; forceDealerHoleRank = '7'; return; }
    if (key === 't') { forceDealerUpRank = '10'; forceDealerHoleRank = 'A'; return; }
    if (key === 'n') { forceDealerUpRank = '10'; forceDealerHoleRank = '8'; return; }
    if (key === 'u') { forcePlayerCards = ['10', '6']; forceDealerUpRank = '10'; forceDealerHoleRank = '7'; return; }
    if (key === 'h') { forcePlayerCards = ['10', '8']; forceDealerUpRank = '6'; forceDealerHoleRank = 'A'; return; }
  }

  // Insurance Offer Phase (Y / N)
  if (insurancePrompt && !insurancePrompt.classList.contains('hidden')) {
    if (key === 'y' && insureYesBtn && !insureYesBtn.disabled) {
      e.preventDefault();
      handleTakeInsurance();
      return;
    }
    if (key === 'n' && insureNoBtn && !insureNoBtn.disabled) {
      e.preventDefault();
      handleDeclineInsurance();
      return;
    }
  }

  // BETTING Phase Controls
  if (gameState === 'BETTING' && !isBusy) {
    // Deal or Rebet & Deal (Space or Enter)
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (currentBet > 0) {
        dealRound();
      } else if (lastRoundBet > 0 && bankroll >= lastRoundBet) {
        handleRebetAndDeal();
      }
      return;
    }

    // Rebet (R) / Rebet & Deal (Shift + R)
    if (key === 'r') {
      e.preventDefault();
      if (e.shiftKey) {
        handleRebetAndDeal();
      } else {
        handleRebet();
      }
      return;
    }

    // Double Current Bet (X or D)
    if (key === 'x' || key === 'd') {
      e.preventDefault();
      handleDoubleBet();
      return;
    }

    // Clear Bet (C or Backspace)
    if (key === 'c' || e.key === 'Backspace') {
      e.preventDefault();
      clearBet();
      return;
    }

    // Number keys for chip denominations:
    // '1' -> $1, '2' or '5' -> $5, '3' -> $25, '4' or '0' -> $100
    if (e.key === '1') {
      e.preventDefault();
      addBet(1);
      return;
    }
    if (e.key === '5' || e.key === '2') {
      e.preventDefault();
      addBet(5);
      return;
    }
    if (e.key === '3') {
      e.preventDefault();
      addBet(25);
      return;
    }
    if (e.key === '4' || e.key === '0') {
      e.preventDefault();
      addBet(100);
      return;
    }
    if (e.key === '6') {
      e.preventDefault();
      addBet(500);
      return;
    }
    if (e.key === '7') {
      e.preventDefault();
      addBet(1000);
      return;
    }
  }

  // PLAYER_TURN Phase Controls
  if (gameState === 'PLAYER_TURN' && !isBusy) {
    // Hit (H)
    if (key === 'h' && hitBtn && !hitBtn.disabled && !playerActions.classList.contains('hidden')) {
      e.preventDefault();
      handlePlayerHit();
      return;
    }

    // Stand (S or Space)
    if ((key === 's' || e.key === ' ') && standBtn && !standBtn.disabled && !playerActions.classList.contains('hidden')) {
      e.preventDefault();
      handlePlayerStand();
      return;
    }

    // Double Down (D)
    if (key === 'd' && doubleBtn && !doubleBtn.disabled && !doubleBtn.classList.contains('hidden')) {
      e.preventDefault();
      handlePlayerDouble();
      return;
    }

    // Split Hand (P)
    if (key === 'p' && splitBtn && !splitBtn.disabled && !splitBtn.classList.contains('hidden')) {
      e.preventDefault();
      handlePlayerSplit();
      return;
    }

    // Late Surrender (U)
    if (key === 'u' && surrenderBtn && !surrenderBtn.disabled && !surrenderBtn.classList.contains('hidden')) {
      e.preventDefault();
      handlePlayerSurrender();
      return;
    }
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
    const allowance = getReloadAllowance();
    toolReloadBankrollBtn.textContent = `Reload $${allowance.toLocaleString()}`;
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
      discardedCardsCount = 0;
      if (table && table.resetDiscardStack) {
        table.resetDiscardStack();
      }
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
    discardedCardsCount = 0;
    if (table && table.resetDiscardStack) {
      table.resetDiscardStack();
    }
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
    const allowance = getReloadAllowance();
    bankroll = allowance;
    saveBankroll(bankroll);
    currentBet = 0;
    clearBet();
    updateBankrollDisplay();
    playChipCollectSound();
    const origText = toolReloadBankrollBtn.textContent;
    toolReloadBankrollBtn.textContent = `Reloaded $${allowance.toLocaleString()} ✓`;
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
    const allowance = getReloadAllowance();
    bankroll = allowance;
    saveBankroll(bankroll);
    currentBet = 0;
    updateBankrollDisplay();
    playChipCollectSound();
    showGestureToast(`Reloaded $${allowance.toLocaleString()} ✓`);
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

  if (statsOverlay && !statsOverlay.classList.contains('hidden')) {
    updateStatsUI();
  }
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
