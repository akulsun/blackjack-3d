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
