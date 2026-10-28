/**
 * Player Statistics & Bankroll Progression Tracker for 3D Blackjack.
 * Tracks session & lifetime metrics, win rates, streaks, and bankroll trajectory.
 * Provides high-DPI HTML5 canvas chart rendering for profit/loss history.
 */

const STORAGE_KEY = 'blackjack_3d_analytics';
const MAX_HISTORY_POINTS = 50;

export const VIP_TIERS = [
  { name: 'Bronze Roller', min: 0, max: 1499, icon: '🥉', color: '#cd7f32' },
  { name: 'Silver Club', min: 1500, max: 4999, icon: '🥈', color: '#cbd5e1' },
  { name: 'Gold VIP', min: 5000, max: 14999, icon: '🥇', color: '#facc15' },
  { name: 'Platinum Elite', min: 15000, max: 49999, icon: '💎', color: '#38bdf8' },
  { name: 'Diamond Whale', min: 50000, max: Infinity, icon: '👑', color: '#c084fc' }
];

export function getVIPTier(bankroll) {
  const amount = Math.max(0, bankroll || 0);
  for (let i = VIP_TIERS.length - 1; i >= 0; i--) {
    if (amount >= VIP_TIERS[i].min) {
      const tier = VIP_TIERS[i];
      const nextTier = VIP_TIERS[i + 1] || null;
      let progressPercent = 100;
      let toNext = 0;
      if (nextTier) {
        const span = nextTier.min - tier.min;
        const currentInTier = amount - tier.min;
        progressPercent = Math.min(100, Math.max(0, Math.round((currentInTier / span) * 100)));
        toNext = nextTier.min - amount;
      }
      return {
        ...tier,
        progressPercent,
        toNext,
        nextTier
      };
    }
  }
  return { ...VIP_TIERS[0], progressPercent: 0, toNext: 1500, nextTier: VIP_TIERS[1] };
}

export const DEFAULT_STATS = {
  handsPlayed: 0,
  handsWon: 0,
  handsLost: 0,
  handsPushed: 0,
  blackjacks: 0,
  currentStreak: 0,
  bestStreak: 0,
  biggestWin: 0,
  totalWagered: 0,
  netProfit: 0,
  strategyDecisions: 0,
  optimalDecisions: 0,
  history: [] // [{ round: number, netChange: number, bankroll: number, result: 'win'|'loss'|'push'|'bj' }]
};

export function loadStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        handsPlayed: Number(parsed.handsPlayed) || 0,
        handsWon: Number(parsed.handsWon) || 0,
        handsLost: Number(parsed.handsLost) || 0,
        handsPushed: Number(parsed.handsPushed) || 0,
        blackjacks: Number(parsed.blackjacks) || 0,
        currentStreak: Number(parsed.currentStreak) || 0,
        bestStreak: Number(parsed.bestStreak) || 0,
        biggestWin: Number(parsed.biggestWin) || 0,
        totalWagered: Number(parsed.totalWagered) || 0,
        netProfit: Number(parsed.netProfit) || 0,
        strategyDecisions: Number(parsed.strategyDecisions) || 0,
        optimalDecisions: Number(parsed.optimalDecisions) || 0,
        history: Array.isArray(parsed.history) ? parsed.history : []
      };
    }
  } catch (e) {
    // Ignore storage parse errors
  }
  return { ...DEFAULT_STATS, history: [] };
}

export function saveStats(stats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (e) {
    // Ignore quota errors
  }
}

export function resetStats() {
  const fresh = { ...DEFAULT_STATS, history: [] };
  saveStats(fresh);
  return fresh;
}

/**
 * Records whether a player action followed basic strategy.
 * @param {boolean} isOptimal
 * @returns {object} updated stats
 */
export function recordStrategyDecision(isOptimal) {
  const stats = loadStats();
  stats.strategyDecisions += 1;
  if (isOptimal) {
    stats.optimalDecisions += 1;
  }
  saveStats(stats);
  return stats;
}

export function getStrategyAccuracy(stats) {
  if (!stats.strategyDecisions || stats.strategyDecisions <= 0) return 100;
  return Math.round((stats.optimalDecisions / stats.strategyDecisions) * 100);
}

/**
 * Records the outcome of a finished round.
 * @param {object} params
 * @param {number} params.wager - Total initial wager placed for the round
 * @param {number} params.netChange - Net profit (positive) or loss (negative)
 * @param {'win'|'loss'|'push'|'bj'} params.outcome - Outcome category
 * @param {boolean} params.isBlackjack - Whether player hit natural blackjack
 * @param {number} params.currentBankroll - Bankroll balance after resolution
 * @returns {object} updated stats object
 */
export function recordRoundOutcome({
  wager,
  netChange,
  outcome,
  isBlackjack = false,
  currentBankroll
}) {
  const stats = loadStats();

  stats.handsPlayed += 1;
  stats.totalWagered += Math.max(0, wager || 0);
  stats.netProfit += netChange;

  if (isBlackjack) {
    stats.blackjacks += 1;
  }

  if (outcome === 'win' || outcome === 'bj') {
    stats.handsWon += 1;
    stats.currentStreak = Math.max(0, stats.currentStreak) + 1;
    if (stats.currentStreak > stats.bestStreak) {
      stats.bestStreak = stats.currentStreak;
    }
    if (netChange > stats.biggestWin) {
      stats.biggestWin = netChange;
    }
  } else if (outcome === 'loss') {
    stats.handsLost += 1;
    stats.currentStreak = Math.min(0, stats.currentStreak) - 1;
  } else {
    // Push
    stats.handsPushed += 1;
  }

  // Record historical trajectory point
  stats.history.push({
    round: stats.handsPlayed,
    netChange,
    bankroll: currentBankroll,
    result: outcome
  });

  if (stats.history.length > MAX_HISTORY_POINTS) {
    stats.history = stats.history.slice(-MAX_HISTORY_POINTS);
  }

  saveStats(stats);
  return stats;
}

/**
 * Calculates win rate percentage.
 * Pushes are excluded from decision win-rate denominator (standard casino metric).
 */
export function calculateWinRate(stats) {
  const decided = (stats.handsWon || 0) + (stats.handsLost || 0);
  if (decided <= 0) return 0;
  return Math.round((stats.handsWon / decided) * 100);
}

/**
 * Renders a dark casino-themed line chart of the bankroll trajectory on an HTML5 canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {object} stats
 */
export function renderTrajectoryChart(canvas, stats) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.parentElement ? canvas.parentElement.clientWidth : 580;
  const height = 180;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.save();
  ctx.scale(dpr, dpr);

  // Clear background
  ctx.fillStyle = '#0d111a';
  ctx.fillRect(0, 0, width, height);

  const history = stats.history || [];

  // Empty state if no hands played yet
  if (history.length < 2) {
    ctx.fillStyle = 'rgba(212, 175, 55, 0.4)';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Play hands to chart your bankroll trajectory', width / 2, height / 2);
    ctx.restore();
    return;
  }

  const paddingLeft = 60;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 30;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const bankrolls = history.map((h) => h.bankroll);
  let minVal = Math.min(...bankrolls);
  let maxVal = Math.max(...bankrolls);

  // Expand bounds slightly for breathing room
  if (minVal === maxVal) {
    minVal -= 50;
    maxVal += 50;
  } else {
    const range = maxVal - minVal;
    minVal = Math.max(0, minVal - range * 0.1);
    maxVal = maxVal + range * 0.1;
  }

  const startBankroll = history[0].bankroll - history[0].netChange;
  const currentNet = stats.netProfit;
  const isNetPositive = currentNet >= 0;

  // Grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.lineWidth = 1;
  const gridSteps = 3;
  for (let i = 0; i <= gridSteps; i++) {
    const y = paddingTop + (chartH / gridSteps) * i;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();

    // Value label
    const val = Math.round(maxVal - ((maxVal - minVal) / gridSteps) * i);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`$${val.toLocaleString()}`, paddingLeft - 8, y);
  }

  // Baseline ($1,000 or initial bankroll) dashed line
  if (startBankroll >= minVal && startBankroll <= maxVal) {
    const baselineY = paddingTop + (1 - (startBankroll - minVal) / (maxVal - minVal)) * chartH;
    ctx.save();
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, baselineY);
    ctx.lineTo(width - paddingRight, baselineY);
    ctx.stroke();
    ctx.restore();
  }

  // Compute coordinate points
  const points = history.map((pt, idx) => {
    const x = paddingLeft + (idx / (history.length - 1)) * chartW;
    const y = paddingTop + (1 - (pt.bankroll - minVal) / (maxVal - minVal)) * chartH;
    return { x, y, ...pt };
  });

  // Gradient area fill under curve
  const areaGrad = ctx.createLinearGradient(0, paddingTop, 0, height - paddingBottom);
  if (isNetPositive) {
    areaGrad.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
    areaGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
  } else {
    areaGrad.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
    areaGrad.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, height - paddingBottom);
  points.forEach((pt) => ctx.lineTo(pt.x, pt.y));
  ctx.lineTo(points[points.length - 1].x, height - paddingBottom);
  ctx.closePath();
  ctx.fillStyle = areaGrad;
  ctx.fill();

  // Trajectory Stroke Line
  ctx.beginPath();
  points.forEach((pt, idx) => {
    if (idx === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  });
  ctx.strokeStyle = isNetPositive ? '#10b981' : '#ef4444';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Dots for last 10 points or key peaks
  points.forEach((pt, idx) => {
    if (idx === points.length - 1 || idx === 0 || idx % 5 === 0) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, idx === points.length - 1 ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = pt.netChange > 0 ? '#10b981' : pt.netChange < 0 ? '#ef4444' : '#d4af37';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });

  // Latest value badge above last point
  const last = points[points.length - 1];
  ctx.fillStyle = isNetPositive ? '#10b981' : '#ef4444';
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`$${last.bankroll.toLocaleString()}`, width - paddingRight, last.y - 8);

  ctx.restore();
}
