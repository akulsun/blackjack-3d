/**
 * Player Statistics & Bankroll Progression Tracker for 3D Blackjack.
 * Tracks session & lifetime metrics, win rates, streaks, and bankroll trajectory.
 * Provides a persistent Casino Loyalty & XP Career Progression system.
 * Unlocks dynamic reload allowances, exclusive table themes, and level celebrations.
 */

const STORAGE_KEY = 'blackjack_3d_analytics';
const MAX_HISTORY_POINTS = 50;

export const LOYALTY_TIERS = [
  {
    id: 'bronze',
    name: 'Bronze Roller',
    minXp: 0,
    maxXp: 999,
    minLevel: 1,
    maxLevel: 5,
    icon: '🥉',
    color: '#cd7f32',
    accent: 'rgba(205, 127, 50, 0.25)',
    reloadAllowance: 1000,
    title: 'Apprentice Roller',
    perks: ['$1,000 Reload Allowance', 'Emerald Felt', 'Table Analytics & Strategy Guidance']
  },
  {
    id: 'silver',
    name: 'Silver Club',
    minXp: 1000,
    maxXp: 4999,
    minLevel: 6,
    maxLevel: 15,
    icon: '🥈',
    color: '#cbd5e1',
    accent: 'rgba(203, 213, 225, 0.25)',
    reloadAllowance: 2500,
    title: 'Card Sharp',
    perks: ['$2,500 Reload Allowance (+150%)', 'Sapphire Navy Felt Unlocked', 'Priority Bankroll Rebuy']
  },
  {
    id: 'gold',
    name: 'Gold VIP',
    minXp: 5000,
    maxXp: 14999,
    minLevel: 16,
    maxLevel: 30,
    icon: '🥇',
    color: '#facc15',
    accent: 'rgba(250, 204, 21, 0.25)',
    reloadAllowance: 5000,
    title: 'High Roller',
    perks: ['$5,000 Reload Allowance (+400%)', 'Ruby Velvet Felt Unlocked', '$500 High-Roller Chips Priority']
  },
  {
    id: 'platinum',
    name: 'Platinum Elite',
    minXp: 15000,
    maxXp: 49999,
    minLevel: 31,
    maxLevel: 50,
    icon: '💎',
    color: '#38bdf8',
    accent: 'rgba(56, 189, 248, 0.25)',
    reloadAllowance: 10000,
    title: 'Pit Boss Favorite',
    perks: ['$10,000 Reload Allowance (+900%)', 'Onyx Charcoal Felt Unlocked', '$1,000 Whale Chips Priority']
  },
  {
    id: 'diamond',
    name: 'Diamond Whale',
    minXp: 50000,
    maxXp: Infinity,
    minLevel: 51,
    maxLevel: 100,
    icon: '👑',
    color: '#c084fc',
    accent: 'rgba(192, 132, 252, 0.25)',
    reloadAllowance: 25000,
    title: 'Monte Carlo Legend',
    perks: ['$25,000 Maximum Reload Allowance', 'Royale Diamond Table Access', 'VIP Whale Crown Status']
  }
];

export const VIP_TIERS = LOYALTY_TIERS;

/**
 * Calculates numeric player level from total XP earned.
 */
export function calculateLevel(xp) {
  const val = Math.max(0, Number(xp) || 0);
  if (val < 1000) {
    return Math.min(5, 1 + Math.floor(val / 200));
  } else if (val < 5000) {
    return Math.min(15, 6 + Math.floor((val - 1000) / 400));
  } else if (val < 15000) {
    return Math.min(30, 16 + Math.floor((val - 5000) / 667));
  } else if (val < 50000) {
    return Math.min(50, 31 + Math.floor((val - 15000) / 1750));
  } else {
    return 51 + Math.floor((val - 50000) / 2500);
  }
}

/**
 * Returns min and max XP bounds for a given level.
 */
export function getLevelBounds(level) {
  const lvl = Math.max(1, Number(level) || 1);
  if (lvl <= 5) {
    return { minXp: (lvl - 1) * 200, maxXp: lvl * 200 };
  } else if (lvl <= 15) {
    return { minXp: 1000 + (lvl - 6) * 400, maxXp: 1000 + (lvl - 5) * 400 };
  } else if (lvl <= 30) {
    return { minXp: Math.round(5000 + (lvl - 16) * 666.67), maxXp: Math.round(5000 + (lvl - 15) * 666.67) };
  } else if (lvl <= 50) {
    return { minXp: 15000 + (lvl - 31) * 1750, maxXp: 15000 + (lvl - 30) * 1750 };
  } else {
    return { minXp: 50000 + (lvl - 51) * 2500, maxXp: 50000 + (lvl - 50) * 2500 };
  }
}

/**
 * Computes full loyalty career progression details.
 */
export function getLoyaltyProgression(statsOrXp) {
  let xp = 0;
  if (typeof statsOrXp === 'number') {
    xp = statsOrXp;
  } else if (statsOrXp && typeof statsOrXp.xp === 'number') {
    xp = statsOrXp.xp;
  }

  const level = calculateLevel(xp);
  const lvlBounds = getLevelBounds(level);
  const levelSpan = Math.max(1, lvlBounds.maxXp - lvlBounds.minXp);
  const currentInLevel = Math.max(0, xp - lvlBounds.minXp);
  const levelProgressPercent = Math.min(100, Math.round((currentInLevel / levelSpan) * 100));
  const levelToNext = Math.max(0, lvlBounds.maxXp - xp);

  let tierIndex = 0;
  for (let i = LOYALTY_TIERS.length - 1; i >= 0; i--) {
    if (xp >= LOYALTY_TIERS[i].minXp) {
      tierIndex = i;
      break;
    }
  }

  const tier = LOYALTY_TIERS[tierIndex];
  const nextTier = LOYALTY_TIERS[tierIndex + 1] || null;

  let tierProgressPercent = 100;
  let tierToNext = 0;
  if (nextTier) {
    const tierSpan = nextTier.minXp - tier.minXp;
    const currentInTier = Math.max(0, xp - tier.minXp);
    tierProgressPercent = Math.min(100, Math.round((currentInTier / tierSpan) * 100));
    tierToNext = Math.max(0, nextTier.minXp - xp);
  }

  return {
    ...tier,
    tierIndex,
    level,
    xp,
    levelMinXp: lvlBounds.minXp,
    levelMaxXp: lvlBounds.maxXp,
    levelProgressPercent,
    levelToNext,
    progressPercent: tierProgressPercent,
    toNext: tierToNext,
    tierProgressPercent,
    tierToNext,
    nextTier,
    reloadAllowance: tier.reloadAllowance,
    title: tier.title,
    perks: tier.perks,
    nextPerks: nextTier ? nextTier.perks : []
  };
}

/**
 * Backwards compatible helper returning VIP loyalty info.
 */
export function getVIPTier(bankrollOrStats) {
  if (bankrollOrStats && typeof bankrollOrStats === 'object') {
    return getLoyaltyProgression(bankrollOrStats);
  }
  const stats = loadStats();
  if (stats && stats.xp !== undefined && stats.xp > 0) {
    return getLoyaltyProgression(stats);
  }
  // Fallback if raw number passed
  const amount = Math.max(0, Number(bankrollOrStats) || 0);
  return getLoyaltyProgression(amount);
}

/**
 * Returns reload allowance for the player's current loyalty tier.
 */
export function getReloadAllowance(statsOrBankroll) {
  const progression = getLoyaltyProgression(statsOrBankroll || loadStats());
  return progression.reloadAllowance || 1000;
}

/**
 * Adds loyalty XP to player stats, detecting level-ups and tier promotions.
 */
export function addLoyaltyXP(stats, amount, category = 'wager') {
  if (!stats) return { leveledUp: false, tieredUp: false, xpGained: 0, stats };
  const addVal = Math.max(0, Math.round(amount || 0));
  if (addVal <= 0) return { leveledUp: false, tieredUp: false, xpGained: 0, stats };

  const oldXp = stats.xp || 0;
  const oldLevel = calculateLevel(oldXp);
  const oldProgression = getLoyaltyProgression(oldXp);

  stats.xp = oldXp + addVal;
  if (!stats.xpBreakdown) {
    stats.xpBreakdown = { wager: 0, wins: 0, blackjacks: 0, strategy: 0 };
  }
  if (stats.xpBreakdown[category] !== undefined) {
    stats.xpBreakdown[category] += addVal;
  }

  const newLevel = calculateLevel(stats.xp);
  stats.level = newLevel;
  const newProgression = getLoyaltyProgression(stats.xp);

  const leveledUp = newLevel > oldLevel;
  const tieredUp = newProgression.tierIndex > oldProgression.tierIndex;

  return {
    leveledUp,
    tieredUp,
    oldLevel,
    newLevel,
    oldTier: oldProgression,
    newTier: newProgression,
    xpGained: addVal,
    stats
  };
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
  peakBankroll: 1000,
  xp: 0,
  level: 1,
  xpBreakdown: {
    wager: 0,
    wins: 0,
    blackjacks: 0,
    strategy: 0
  },
  history: [] // [{ round: number, netChange: number, bankroll: number, result: 'win'|'loss'|'push'|'bj' }]
};

export function loadStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const totalWagered = Number(parsed.totalWagered) || 0;
      const handsPlayed = Number(parsed.handsPlayed) || 0;
      const handsWon = Number(parsed.handsWon) || 0;
      const blackjacks = Number(parsed.blackjacks) || 0;
      const handsPushed = Number(parsed.handsPushed) || 0;

      // Backward compatibility: backfill XP if upgrading from legacy stats
      let xp = Number(parsed.xp);
      if (isNaN(xp) || xp <= 0) {
        if (totalWagered > 0 || handsPlayed > 0) {
          xp = Math.floor(totalWagered / 5) + handsWon * 25 + blackjacks * 60 + handsPushed * 10;
        } else {
          xp = 0;
        }
      }

      const level = calculateLevel(xp);
      const peakBankroll = Number(parsed.peakBankroll) || Math.max(1000, Number(parsed.netProfit) + 1000 || 1000);

      const xpBreakdown = parsed.xpBreakdown && typeof parsed.xpBreakdown === 'object'
        ? {
            wager: Number(parsed.xpBreakdown.wager) || Math.floor(totalWagered / 5),
            wins: Number(parsed.xpBreakdown.wins) || handsWon * 25,
            blackjacks: Number(parsed.xpBreakdown.blackjacks) || blackjacks * 60,
            strategy: Number(parsed.xpBreakdown.strategy) || 0
          }
        : {
            wager: Math.floor(totalWagered / 5),
            wins: handsWon * 25,
            blackjacks: blackjacks * 60,
            strategy: 0
          };

      return {
        handsPlayed,
        handsWon,
        handsLost: Number(parsed.handsLost) || 0,
        handsPushed,
        blackjacks,
        currentStreak: Number(parsed.currentStreak) || 0,
        bestStreak: Number(parsed.bestStreak) || 0,
        biggestWin: Number(parsed.biggestWin) || 0,
        totalWagered,
        netProfit: Number(parsed.netProfit) || 0,
        strategyDecisions: Number(parsed.strategyDecisions) || 0,
        optimalDecisions: Number(parsed.optimalDecisions) || 0,
        peakBankroll,
        xp,
        level,
        xpBreakdown,
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
    // Add Strategy XP
    addLoyaltyXP(stats, 15, 'strategy');
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
 * @returns {{ stats: object, xpResult: object }} updated stats object and XP breakdown
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
  stats.peakBankroll = Math.max(stats.peakBankroll || 1000, currentBankroll || 0);

  if (isBlackjack) {
    stats.blackjacks += 1;
  }

  let outcomeXp = 5; // Loss consolation XP
  if (outcome === 'win' || outcome === 'bj') {
    stats.handsWon += 1;
    stats.currentStreak = Math.max(0, stats.currentStreak) + 1;
    if (stats.currentStreak > stats.bestStreak) {
      stats.bestStreak = stats.currentStreak;
    }
    if (netChange > stats.biggestWin) {
      stats.biggestWin = netChange;
    }
    outcomeXp = isBlackjack ? 60 : 25;
    if (stats.currentStreak >= 2) {
      outcomeXp += Math.min(50, stats.currentStreak * 10);
    }
  } else if (outcome === 'loss') {
    stats.handsLost += 1;
    stats.currentStreak = Math.min(0, stats.currentStreak) - 1;
    outcomeXp = 5;
  } else {
    // Push
    stats.handsPushed += 1;
    outcomeXp = 10;
  }

  // Wager XP: 1 XP per $5 wagered (min 1 XP)
  const wagerXp = Math.max(1, Math.floor(wager / 5));
  const totalRoundXp = wagerXp + outcomeXp;

  const xpResult = addLoyaltyXP(
    stats,
    totalRoundXp,
    outcome === 'bj' ? 'blackjacks' : outcome === 'win' ? 'wins' : 'wager'
  );

  // Record historical trajectory point
  stats.history.push({
    round: stats.handsPlayed,
    netChange,
    bankroll: currentBankroll,
    result: outcome,
    xp: stats.xp
  });

  if (stats.history.length > MAX_HISTORY_POINTS) {
    stats.history = stats.history.slice(-MAX_HISTORY_POINTS);
  }

  saveStats(stats);
  return { stats, xpResult };
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
