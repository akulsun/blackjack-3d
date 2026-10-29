/**
 * Player Statistics & Bankroll Progression Tracker for 3D Blackjack.
 * Tracks session & lifetime metrics, win rates, streaks, and bankroll trajectory.
 * Provides a persistent XP & Level career progression system.
 * Unlocks dynamic reload allowances and level celebrations.
 */

const STORAGE_KEY = 'blackjack_3d_analytics';
const MAX_HISTORY_POINTS = 50;

/**
 * Level milestones define the reload allowance and title at each threshold.
 * Between milestones, the most recent milestone applies.
 */
const LEVEL_MILESTONES = [
  { level: 1,  title: 'Beginner',         icon: '🃏', reloadAllowance: 1000 },
  { level: 5,  title: 'Card Sharp',        icon: '♠️', reloadAllowance: 1500 },
  { level: 10, title: 'Regular',           icon: '♦️', reloadAllowance: 2000 },
  { level: 15, title: 'Skilled Player',    icon: '🎰', reloadAllowance: 2500 },
  { level: 20, title: 'High Roller',       icon: '💰', reloadAllowance: 3000 },
  { level: 25, title: 'Card Shark',        icon: '🦈', reloadAllowance: 4000 },
  { level: 30, title: 'Table Regular',     icon: '🎯', reloadAllowance: 5000 },
  { level: 40, title: 'Pit Boss Favorite', icon: '⭐', reloadAllowance: 7500 },
  { level: 50, title: 'Casino Legend',     icon: '👑', reloadAllowance: 10000 },
  { level: 75, title: 'Monte Carlo Elite', icon: '💎', reloadAllowance: 15000 },
  { level: 100, title: 'Hall of Fame',     icon: '🏆', reloadAllowance: 25000 }
];

/**
 * Calculates numeric player level from total XP earned.
 * Uses a smooth curve: each level requires (level * 100) XP,
 * so total XP for level L = 50 * L * (L + 1).
 * This gives: Lv2 = 200 XP, Lv5 = 1500 XP, Lv10 = 5500 XP, Lv20 = 21000 XP, etc.
 */
export function calculateLevel(xp) {
  const val = Math.max(0, Number(xp) || 0);
  // Solve: 50 * L * (L+1) <= val  =>  L = floor((-1 + sqrt(1 + val/50)) / 2) ... but simpler:
  // XP needed to complete level L (reach L+1) = (L+1) * 100
  // Cumulative XP for level L = sum from i=1 to L of (i*100) = 50*L*(L+1)
  // So level = floor((-1 + sqrt(1 + val/50)) / 2) ... let's do it iteratively for clarity:
  let level = 1;
  let cumulative = 0;
  while (true) {
    const needed = (level) * 100; // XP to go from current level to next
    if (cumulative + needed > val) break;
    cumulative += needed;
    level++;
  }
  return level;
}

/**
 * Returns min and max XP bounds for a given level.
 * minXp = cumulative XP to reach this level
 * maxXp = cumulative XP to reach next level
 */
export function getLevelBounds(level) {
  const lvl = Math.max(1, Number(level) || 1);
  // Cumulative XP to reach level L = sum(i=1..L-1) of i*100 = 50*(L-1)*L
  const minXp = 50 * (lvl - 1) * lvl;
  const maxXp = 50 * lvl * (lvl + 1);
  return { minXp, maxXp };
}

/**
 * Returns the milestone data for the given level (title, icon, reload allowance).
 */
export function getMilestoneForLevel(level) {
  let milestone = LEVEL_MILESTONES[0];
  for (let i = LEVEL_MILESTONES.length - 1; i >= 0; i--) {
    if (level >= LEVEL_MILESTONES[i].level) {
      milestone = LEVEL_MILESTONES[i];
      break;
    }
  }
  return milestone;
}

/**
 * Returns the next milestone after the current level, or null if at max.
 */
export function getNextMilestone(level) {
  for (let i = 0; i < LEVEL_MILESTONES.length; i++) {
    if (LEVEL_MILESTONES[i].level > level) {
      return LEVEL_MILESTONES[i];
    }
  }
  return null;
}

/**
 * Computes full level progression details.
 */
export function getLevelProgression(statsOrXp) {
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

  const milestone = getMilestoneForLevel(level);
  const nextMilestone = getNextMilestone(level);

  return {
    level,
    xp,
    levelMinXp: lvlBounds.minXp,
    levelMaxXp: lvlBounds.maxXp,
    levelProgressPercent,
    levelToNext,
    title: milestone.title,
    icon: milestone.icon,
    reloadAllowance: milestone.reloadAllowance,
    nextMilestone
  };
}

// Backwards-compatible aliases
export const getLoyaltyProgression = getLevelProgression;

export function getVIPTier(bankrollOrStats) {
  if (bankrollOrStats && typeof bankrollOrStats === 'object') {
    return getLevelProgression(bankrollOrStats);
  }
  const stats = loadStats();
  if (stats && stats.xp !== undefined && stats.xp > 0) {
    return getLevelProgression(stats);
  }
  const amount = Math.max(0, Number(bankrollOrStats) || 0);
  return getLevelProgression(amount);
}

/**
 * Returns reload allowance for the player's current level.
 */
export function getReloadAllowance(statsOrBankroll) {
  const progression = getLevelProgression(statsOrBankroll || loadStats());
  return progression.reloadAllowance || 1000;
}

/**
 * Adds XP to player stats, detecting level-ups.
 */
export function addLoyaltyXP(stats, amount, category = 'wager') {
  if (!stats) return { leveledUp: false, xpGained: 0, stats };
  const addVal = Math.max(0, Math.round(amount || 0));
  if (addVal <= 0) return { leveledUp: false, xpGained: 0, stats };

  const oldXp = stats.xp || 0;
  const oldLevel = calculateLevel(oldXp);
  const oldProgression = getLevelProgression(oldXp);

  stats.xp = oldXp + addVal;
  if (!stats.xpBreakdown) {
    stats.xpBreakdown = { wager: 0, wins: 0, blackjacks: 0, strategy: 0 };
  }
  if (stats.xpBreakdown[category] !== undefined) {
    stats.xpBreakdown[category] += addVal;
  }

  const newLevel = calculateLevel(stats.xp);
  stats.level = newLevel;
  const newProgression = getLevelProgression(stats.xp);

  const leveledUp = newLevel > oldLevel;

  return {
    leveledUp,
    tieredUp: false, // kept for backwards compat, always false now
    oldLevel,
    newLevel,
    oldProgression,
    newProgression,
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
