/**
 * Pure JavaScript Blackjack Rules Engine.
 * No rendering, UI, or 3D dependencies.
 */

/**
 * Returns the numerical card value for a given rank.
 * 2-10 count as face value. J, Q, K count as 10. Ace counts as 11.
 * @param {string} rank - 'A' | '2'..'10' | 'J' | 'Q' | 'K'
 * @returns {number}
 */
export function getCardValue(rank) {
  if (rank === 'A') return 11;
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  return parseInt(rank, 10);
}

/**
 * Evaluates the total point value of a hand, correctly accounting for soft aces.
 * @param {Array<{ rank: string, suit?: string }>} cards
 * @returns {{ score: number, isSoft: boolean, isBust: boolean, isBlackjack: boolean }}
 */
export function calculateHand(cards) {
  if (!cards || cards.length === 0) {
    return { score: 0, isSoft: false, isBust: false, isBlackjack: false };
  }

  let score = 0;
  let aceCount = 0;

  for (const card of cards) {
    if (card.rank === 'A') {
      aceCount++;
      score += 11;
    } else {
      score += getCardValue(card.rank);
    }
  }

  // Reduce Aces from 11 to 1 as needed if bust
  while (score > 21 && aceCount > 0) {
    score -= 10;
    aceCount--;
  }

  const isBust = score > 21;
  const isSoft = aceCount > 0;
  const isBlackjack = cards.length === 2 && score === 21;

  return {
    score,
    isSoft,
    isBust,
    isBlackjack
  };
}

/**
 * Evaluates whether the dealer must hit according to table rules:
 * - When hitSoft17 is false (S17, default): Dealer hits on < 17, and stands on all 17s (hard and soft).
 * - When hitSoft17 is true (H17): Dealer hits on < 17 and hits on soft 17; stands on hard 17 and 18+.
 * @param {Array<{ rank: string, suit?: string }>} dealerCards
 * @param {boolean} [hitSoft17=false]
 * @returns {boolean} true if dealer must hit, false if dealer stands
 */
export function shouldDealerHit(dealerCards, hitSoft17 = false) {
  const { score, isSoft } = calculateHand(dealerCards);
  if (score < 17) {
    return true;
  }
  if (score === 17 && isSoft && hitSoft17) {
    return true;
  }
  return false;
}

/**
 * Evaluates whether the dealer should peek for natural blackjack:
 * The dealer peeks when their face-up card is an Ace or a 10-value card ('10', 'J', 'Q', 'K').
 * @param {{ rank: string }} dealerUpcard
 * @returns {boolean}
 */
export function shouldDealerPeek(dealerUpcard) {
  if (!dealerUpcard || !dealerUpcard.rank) {
    return false;
  }
  return ['A', '10', 'J', 'Q', 'K'].includes(dealerUpcard.rank);
}

/**
 * Evaluates whether Insurance can legally be offered to the player:
 * Offered only when the dealer's face-up card is an Ace, and player has bankroll.
 * @param {{ rank: string }} dealerUpcard
 * @param {number} bankroll
 * @returns {boolean}
 */
export function canOfferInsurance(dealerUpcard, bankroll = 0) {
  if (!dealerUpcard || dealerUpcard.rank !== 'A') {
    return false;
  }
  return bankroll > 0;
}

/**
 * Calculates the maximum legal insurance wager (up to half the main bet, capped by bankroll).
 * @param {number} mainBet
 * @param {number} bankroll
 * @returns {number}
 */
export function calculateMaxInsurance(mainBet, bankroll) {
  if (!mainBet || mainBet <= 0) return 0;
  const halfBet = Math.floor(mainBet / 2);
  if (halfBet <= 0) return 0;
  return Math.min(halfBet, Math.max(0, bankroll));
}

/**
 * Resolves the payout for an Insurance wager:
 * Pays 2:1 profit if dealer has natural blackjack; wager is lost otherwise.
 * @param {Array<{ rank: string }>} dealerCards
 * @param {number} insuranceBet
 * @returns {{ won: boolean, payout: number, profit: number }}
 */
export function resolveInsurance(dealerCards, insuranceBet) {
  if (!insuranceBet || insuranceBet <= 0) {
    return { won: false, payout: 0, profit: 0 };
  }
  const { isBlackjack } = calculateHand(dealerCards);
  if (isBlackjack) {
    const profit = insuranceBet * 2;
    const payout = insuranceBet + profit;
    return { won: true, payout, profit };
  }
  return { won: false, payout: 0, profit: -insuranceBet };
}

/**
 * Evaluates whether Double Down is legally allowed:
 * - Only allowed on the initial two cards of a hand.
 * - The player must have enough bankroll to match the current bet.
 * @param {Array<{ rank: string, suit?: string }>} cards
 * @param {number} bankroll
 * @param {number} currentBet
 * @returns {boolean}
 */
export function canDoubleDown(cards, bankroll, currentBet) {
  if (!cards || cards.length !== 2) {
    return false;
  }
  const { isBust, isBlackjack } = calculateHand(cards);
  if (isBust || isBlackjack) {
    return false;
  }
  return bankroll >= currentBet;
}

/**
 * Evaluates whether Split is legally allowed:
 * - Only allowed on a pair of cards of the exact same rank (e.g., '8'-'8', 'K'-'K', 'A'-'A').
 * - Only allowed when the hand has exactly 2 cards.
 * - Allowed up to 3 splits per round (maximum 4 hands total).
 * - Player must have sufficient bankroll to match the hand's bet.
 * @param {Array<{ rank: string, suit?: string }>} cards
 * @param {number} bankroll
 * @param {number} currentBet
 * @param {number} [splitCount=0]
 * @returns {boolean}
 */
export function canSplit(cards, bankroll, currentBet, splitCount = 0) {
  if (!cards || cards.length !== 2) {
    return false;
  }
  if (splitCount >= 3) {
    return false;
  }
  if (cards[0].rank !== cards[1].rank) {
    return false;
  }
  return bankroll >= currentBet;
}

/**
 * Evaluates whether Late Surrender is legally allowed:
 * - Available only on the initial two cards of a hand.
 * - Available only after the dealer peek has confirmed no dealer natural blackjack.
 * - Not available after splitting or hitting.
 * @param {Array<{ rank: string, suit?: string }>} cards
 * @param {boolean} [hasDealerPeeked=true]
 * @param {boolean} [isInitialHand=true]
 * @returns {boolean}
 */
export function canSurrender(cards, hasDealerPeeked = true, isInitialHand = true) {
  if (!cards || cards.length !== 2) {
    return false;
  }
  if (!hasDealerPeeked || !isInitialHand) {
    return false;
  }
  const { isBust, isBlackjack } = calculateHand(cards);
  if (isBust || isBlackjack) {
    return false;
  }
  return true;
}

/**
 * Calculates the refund amount for a surrendered hand (half the bet).
 * @param {number} bet
 * @returns {number}
 */
export function calculateSurrenderRefund(bet) {
  if (!bet || bet <= 0) return 0;
  return Math.floor(bet / 2);
}

/**
 * Resolves the outcome of a completed round between player and dealer.
 * @param {Array<{ rank: string }>} playerCards
 * @param {Array<{ rank: string }>} dealerCards
 * @param {boolean} [isSplitHand=false] - If true, 21 is a regular win, not natural 3:2 blackjack
 * @returns {'player_blackjack' | 'player_win' | 'dealer_win' | 'push'}
 */
export function determineOutcome(playerCards, dealerCards, isSplitHand = false) {
  const player = calculateHand(playerCards);
  const dealer = calculateHand(dealerCards);

  // 1. Player busts -> Dealer wins (player loses immediately, even if dealer also busts)
  if (player.isBust) {
    return 'dealer_win';
  }

  // 2. Blackjacks: Natural blackjack pays 3:2 and only applies to non-split hands
  const playerHasBJ = !isSplitHand && player.isBlackjack;
  const dealerHasBJ = dealer.isBlackjack;

  if (playerHasBJ && dealerHasBJ) {
    return 'push';
  }
  if (playerHasBJ) {
    return 'player_blackjack';
  }
  if (dealerHasBJ) {
    return 'dealer_win';
  }

  // 3. Dealer busts -> Player wins
  if (dealer.isBust) {
    return 'player_win';
  }

  // 4. Score comparison
  if (player.score > dealer.score) {
    return 'player_win';
  }
  if (dealer.score > player.score) {
    return 'dealer_win';
  }

  // Equal score -> Tie
  return 'push';
}

/**
 * Evaluates the mathematically optimal basic strategy move for a player hand.
 * @param {Array<{ rank: string }>} playerCards
 * @param {{ rank: string }} dealerUpcard
 * @param {object} [options]
 * @param {boolean} [options.canDouble=false]
 * @param {boolean} [options.canSplitPair=false]
 * @param {boolean} [options.canLateSurrender=false]
 * @param {boolean} [options.hitSoft17=false]
 * @returns {'H'|'S'|'D'|'P'|'U'} Action code: 'H' (Hit), 'S' (Stand), 'D' (Double), 'P' (Split), 'U' (Surrender)
 */
export function getOptimalMove(playerCards, dealerUpcard, options = {}) {
  const {
    canDouble = false,
    canSplitPair = false,
    canLateSurrender = false,
    hitSoft17 = false
  } = options;

  if (!playerCards || playerCards.length < 2 || !dealerUpcard) {
    return 'H';
  }

  const dVal = getCardValue(dealerUpcard.rank);
  const isDealerAce = dVal === 11;
  const isDealerTen = dVal === 10;

  // 1. Pair Splitting
  if (canSplitPair && playerCards.length === 2 && playerCards[0].rank === playerCards[1].rank) {
    const r = playerCards[0].rank;
    if (r === 'A' || r === '8') {
      return 'P'; // Always split Aces and 8s
    }
    if (['10', 'J', 'Q', 'K'].includes(r)) {
      return 'S'; // Never split 10s
    }
    if (r === '9') {
      if ((dVal >= 2 && dVal <= 6) || dVal === 8 || dVal === 9) return 'P';
      return 'S';
    }
    if (r === '7') {
      return dVal >= 2 && dVal <= 7 ? 'P' : 'H';
    }
    if (r === '6') {
      return dVal >= 2 && dVal <= 6 ? 'P' : 'H';
    }
    if (r === '5') {
      if (canDouble && dVal >= 2 && dVal <= 9) return 'D';
      return 'H';
    }
    if (r === '4') {
      if (dVal === 5 || dVal === 6) return 'P';
      return 'H';
    }
    if (r === '2' || r === '3') {
      return dVal >= 2 && dVal <= 7 ? 'P' : 'H';
    }
  }

  // 2. Late Surrender
  const { score, isSoft } = calculateHand(playerCards);
  if (canLateSurrender && playerCards.length === 2 && !isSoft) {
    if (score === 16 && (dVal === 9 || isDealerTen || isDealerAce)) {
      return 'U';
    }
    if (score === 15 && (isDealerTen || (isDealerAce && hitSoft17))) {
      return 'U';
    }
    if (score === 17 && isDealerAce && hitSoft17) {
      return 'U';
    }
  }

  // 3. Soft Hands
  if (isSoft && score <= 21) {
    if (score >= 20) {
      return 'S';
    }
    if (score === 19) {
      if (canDouble && dVal === 6 && playerCards.length === 2) return 'D';
      return 'S';
    }
    if (score === 18) {
      if (canDouble && dVal >= 2 && dVal <= 6 && playerCards.length === 2) return 'D';
      if (dVal === 7 || dVal === 8) return 'S';
      return 'H';
    }
    if (score === 17) {
      if (canDouble && dVal >= 3 && dVal <= 6 && playerCards.length === 2) return 'D';
      return 'H';
    }
    if (score === 15 || score === 16) {
      if (canDouble && dVal >= 4 && dVal <= 6 && playerCards.length === 2) return 'D';
      return 'H';
    }
    if (score === 13 || score === 14) {
      if (canDouble && dVal >= 5 && dVal <= 6 && playerCards.length === 2) return 'D';
      return 'H';
    }
  }

  // 4. Hard Hands
  if (score >= 17) {
    return 'S';
  }
  if (score >= 13 && score <= 16) {
    return dVal >= 2 && dVal <= 6 ? 'S' : 'H';
  }
  if (score === 12) {
    return dVal >= 4 && dVal <= 6 ? 'S' : 'H';
  }
  if (score === 11) {
    if (canDouble && playerCards.length === 2 && (!isDealerAce || hitSoft17)) return 'D';
    return 'H';
  }
  if (score === 10) {
    if (canDouble && dVal >= 2 && dVal <= 9 && playerCards.length === 2) return 'D';
    return 'H';
  }
  if (score === 9) {
    if (canDouble && dVal >= 3 && dVal <= 6 && playerCards.length === 2) return 'D';
    return 'H';
  }

  return 'H';
}
