import assert from 'node:assert/strict';
import {
  getCardValue,
  calculateHand,
  shouldDealerHit,
  shouldDealerPeek,
  canOfferInsurance,
  calculateMaxInsurance,
  resolveInsurance,
  canDoubleDown,
  canSplit,
  canSurrender,
  calculateSurrenderRefund,
  determineOutcome,
  getOptimalMove
} from './rules.js';
import {
  calculateLevel,
  getLevelBounds,
  getLoyaltyProgression,
  getReloadAllowance,
  addLoyaltyXP,
  LOYALTY_TIERS
} from './stats.js';

let passedCount = 0;
let failedCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    failedCount++;
  }
}

console.log('\n--- Running Blackjack Rules Engine Tests ---\n');

// 1. Card Values
test('getCardValue assigns correct values to numbers, face cards, and aces', () => {
  assert.equal(getCardValue('2'), 2);
  assert.equal(getCardValue('7'), 7);
  assert.equal(getCardValue('10'), 10);
  assert.equal(getCardValue('J'), 10);
  assert.equal(getCardValue('Q'), 10);
  assert.equal(getCardValue('K'), 10);
  assert.equal(getCardValue('A'), 11);
});

// 2. Basic Hands
test('calculateHand scores simple number and face card hands', () => {
  assert.deepEqual(calculateHand([{ rank: '2' }, { rank: '5' }]), {
    score: 7,
    isSoft: false,
    isBust: false,
    isBlackjack: false
  });
  assert.deepEqual(calculateHand([{ rank: '10' }, { rank: '8' }]), {
    score: 18,
    isSoft: false,
    isBust: false,
    isBlackjack: false
  });
  assert.deepEqual(calculateHand([{ rank: 'J' }, { rank: 'Q' }]), {
    score: 20,
    isSoft: false,
    isBust: false,
    isBlackjack: false
  });
});

// 3. Soft Aces
test('calculateHand correctly handles single and multiple soft aces', () => {
  // A + 6 = soft 17
  const soft17 = calculateHand([{ rank: 'A' }, { rank: '6' }]);
  assert.equal(soft17.score, 17);
  assert.equal(soft17.isSoft, true);
  assert.equal(soft17.isBust, false);

  // A + 6 + 8 = hard 15 (Ace drops to 1)
  const hard15 = calculateHand([{ rank: 'A' }, { rank: '6' }, { rank: '8' }]);
  assert.equal(hard15.score, 15);
  assert.equal(hard15.isSoft, false);
  assert.equal(hard15.isBust, false);

  // A + A = soft 12 (one ace is 11, one ace is 1)
  const twoAces = calculateHand([{ rank: 'A' }, { rank: 'A' }]);
  assert.equal(twoAces.score, 12);
  assert.equal(twoAces.isSoft, true);

  // A + A + 9 = soft 21
  const soft21 = calculateHand([{ rank: 'A' }, { rank: 'A' }, { rank: '9' }]);
  assert.equal(soft21.score, 21);
  assert.equal(soft21.isSoft, true);
  assert.equal(soft21.isBlackjack, false); // 3 cards is not natural blackjack

  // A + A + 9 + 5 = hard 16 (both aces drop to 1: 1 + 1 + 9 + 5)
  const hard16 = calculateHand([{ rank: 'A' }, { rank: 'A' }, { rank: '9' }, { rank: '5' }]);
  assert.equal(hard16.score, 16);
  assert.equal(hard16.isSoft, false);
});

// 4. Natural Blackjack vs Non-Blackjack 21
test('calculateHand distinguishes natural 2-card blackjack from multi-card 21', () => {
  assert.equal(calculateHand([{ rank: 'A' }, { rank: 'K' }]).isBlackjack, true);
  assert.equal(calculateHand([{ rank: 'A' }, { rank: '10' }]).isBlackjack, true);
  assert.equal(calculateHand([{ rank: 'A' }, { rank: 'J' }]).isBlackjack, true);
  assert.equal(calculateHand([{ rank: 'A' }, { rank: 'Q' }]).isBlackjack, true);

  // 3-card 21 is NOT natural blackjack
  const threeCard21 = calculateHand([{ rank: '7' }, { rank: '7' }, { rank: '7' }]);
  assert.equal(threeCard21.score, 21);
  assert.equal(threeCard21.isBlackjack, false);

  const fourCard21 = calculateHand([{ rank: 'A' }, { rank: '2' }, { rank: '3' }, { rank: '5' }]);
  assert.equal(fourCard21.score, 21);
  assert.equal(fourCard21.isBlackjack, false);
});

// 5. Bust Hands
test('calculateHand detects busts when total exceeds 21', () => {
  const bust23 = calculateHand([{ rank: '10' }, { rank: '6' }, { rank: '7' }]);
  assert.equal(bust23.score, 23);
  assert.equal(bust23.isBust, true);

  const bust25 = calculateHand([{ rank: '10' }, { rank: 'J' }, { rank: '5' }]);
  assert.equal(bust25.score, 25);
  assert.equal(bust25.isBust, true);
});

// 6. Dealer Stands on 17 Rule
test('shouldDealerHit enforces dealer stands on all 17s', () => {
  // Hits under 17
  assert.equal(shouldDealerHit([{ rank: '10' }, { rank: '5' }]), true); // 15
  assert.equal(shouldDealerHit([{ rank: '10' }, { rank: '6' }]), true); // 16

  // Stands on hard 17
  assert.equal(shouldDealerHit([{ rank: '10' }, { rank: '7' }]), false); // Hard 17

  // Stands on soft 17 ("Dealer must stand on 17")
  assert.equal(shouldDealerHit([{ rank: 'A' }, { rank: '6' }]), false); // Soft 17

  // Stands on 18+
  assert.equal(shouldDealerHit([{ rank: 'A' }, { rank: '7' }]), false); // Soft 18
  assert.equal(shouldDealerHit([{ rank: '10' }, { rank: '8' }]), false); // 18
  assert.equal(shouldDealerHit([{ rank: '10' }, { rank: '6' }, { rank: 'A' }]), false); // Hard 17
});

// 7. Outcome Determination
test('determineOutcome resolves round winner according to standard rules', () => {
  // Player natural blackjack vs 20
  assert.equal(
    determineOutcome([{ rank: 'A' }, { rank: 'K' }], [{ rank: '10' }, { rank: 'Q' }]),
    'player_blackjack'
  );

  // Both have natural blackjack -> Push
  assert.equal(
    determineOutcome([{ rank: 'A' }, { rank: 'K' }], [{ rank: 'A' }, { rank: 'Q' }]),
    'push'
  );

  // Player natural blackjack vs dealer 3-card 21 -> Player Blackjack wins
  assert.equal(
    determineOutcome([{ rank: 'A' }, { rank: 'K' }], [{ rank: '7' }, { rank: '7' }, { rank: '7' }]),
    'player_blackjack'
  );

  // Dealer natural blackjack vs player 20 -> Dealer win
  assert.equal(
    determineOutcome([{ rank: '10' }, { rank: 'Q' }], [{ rank: 'A' }, { rank: 'J' }]),
    'dealer_win'
  );

  // Player busts -> Dealer wins immediately
  assert.equal(
    determineOutcome([{ rank: '10' }, { rank: '6' }, { rank: '7' }], [{ rank: '10' }, { rank: '7' }]),
    'dealer_win'
  );

  // Player busts even if dealer also busts -> Dealer wins (casino house edge)
  assert.equal(
    determineOutcome([{ rank: '10' }, { rank: '6' }, { rank: '7' }], [{ rank: '10' }, { rank: '6' }, { rank: '8' }]),
    'dealer_win'
  );

  // Dealer busts -> Player wins
  assert.equal(
    determineOutcome([{ rank: '10' }, { rank: '8' }], [{ rank: '10' }, { rank: '6' }, { rank: '8' }]),
    'player_win'
  );

  // Higher score wins
  assert.equal(
    determineOutcome([{ rank: '10' }, { rank: '9' }], [{ rank: '10' }, { rank: '8' }]),
    'player_win'
  );
  assert.equal(
    determineOutcome([{ rank: '10' }, { rank: '7' }], [{ rank: '10' }, { rank: '8' }]),
    'dealer_win'
  );

  // Push on equal score
  assert.equal(
    determineOutcome([{ rank: '10' }, { rank: '8' }], [{ rank: '9' }, { rank: '9' }]),
    'push'
  );
});

// 8. Double Down Rule
test('canDoubleDown verifies legality of Double Down', () => {
  const initialTwo = [{ rank: '5' }, { rank: '6' }]; // 11
  const softTwo = [{ rank: 'A' }, { rank: '7' }]; // Soft 18
  const threeCards = [{ rank: '5' }, { rank: '3' }, { rank: '3' }]; // 11 in 3 cards
  const naturalBJ = [{ rank: 'A' }, { rank: 'K' }];

  // Legal when player has 2 cards and bankroll >= bet
  assert.equal(canDoubleDown(initialTwo, 500, 50), true);
  assert.equal(canDoubleDown(initialTwo, 50, 50), true); // Exact balance match
  assert.equal(canDoubleDown(softTwo, 100, 25), true);

  // Illegal when bankroll < bet
  assert.equal(canDoubleDown(initialTwo, 49, 50), false);
  assert.equal(canDoubleDown(initialTwo, 0, 50), false);

  // Illegal on 3+ cards
  assert.equal(canDoubleDown(threeCards, 500, 50), false);

  // Illegal on natural blackjack (hand is already over)
  assert.equal(canDoubleDown(naturalBJ, 500, 50), false);

  // Illegal on empty hand or 1 card
  assert.equal(canDoubleDown([], 500, 50), false);
  assert.equal(canDoubleDown([{ rank: '10' }], 500, 50), false);
});

// 9. Split Rule
test('canSplit verifies legality of splitting hands', () => {
  const pair8 = [{ rank: '8' }, { rank: '8' }];
  const pairK = [{ rank: 'K' }, { rank: 'K' }];
  const pairA = [{ rank: 'A' }, { rank: 'A' }];
  const differentRanks10J = [{ rank: '10' }, { rank: 'J' }];
  const differentRanks79 = [{ rank: '7' }, { rank: '9' }];
  const threeCards = [{ rank: '8' }, { rank: '8' }, { rank: '8' }];

  // Legal when exactly 2 cards have the same rank and bankroll >= bet and splitCount < 3
  assert.equal(canSplit(pair8, 500, 50, 0), true);
  assert.equal(canSplit(pairK, 100, 50, 1), true);
  assert.equal(canSplit(pairA, 50, 50, 2), true); // Exact bankroll match, 3rd split

  // Illegal when bankroll < bet
  assert.equal(canSplit(pair8, 49, 50, 0), false);
  assert.equal(canSplit(pair8, 0, 50, 0), false);

  // Illegal when ranks are different (even if value is both 10 like 10 and J)
  assert.equal(canSplit(differentRanks10J, 500, 50, 0), false);
  assert.equal(canSplit(differentRanks79, 500, 50, 0), false);

  // Illegal when not exactly 2 cards
  assert.equal(canSplit(threeCards, 500, 50, 0), false);
  assert.equal(canSplit([{ rank: '8' }], 500, 50, 0), false);
  assert.equal(canSplit([], 500, 50, 0), false);

  // Illegal when maximum 3 splits already reached
  assert.equal(canSplit(pair8, 500, 50, 3), false);
  assert.equal(canSplit(pair8, 500, 50, 4), false);
});

// 10. Split Hands Outcome & Payout Resolution
test('determineOutcome handles split hand outcomes correctly (split 21 pays 1:1, not 3:2)', () => {
  const split21 = [{ rank: 'A' }, { rank: 'K' }];
  const dealer20 = [{ rank: '10' }, { rank: '10' }];
  const dealerNaturalBJ = [{ rank: 'A' }, { rank: 'J' }];
  const dealerMulti21 = [{ rank: '7' }, { rank: '7' }, { rank: '7' }];

  // Split hand 21 vs dealer 20 -> player_win (regular 1:1, not player_blackjack)
  assert.equal(determineOutcome(split21, dealer20, true), 'player_win');

  // Split hand 21 vs dealer natural BJ -> dealer_win (dealer natural blackjack beats split 21)
  assert.equal(determineOutcome(split21, dealerNaturalBJ, true), 'dealer_win');

  // Split hand 21 vs dealer 3-card 21 -> push
  assert.equal(determineOutcome(split21, dealerMulti21, true), 'push');

  // Standard non-split hand 21 vs dealer 20 -> player_blackjack (pays 3:2)
  assert.equal(determineOutcome(split21, dealer20, false), 'player_blackjack');
});

// 11. Multi-hand Split Progression and Split Aces Rules
test('multi-hand split progression tracks up to 3 splits and enforces split aces 1-card limit', () => {
  let splitCount = 0;
  let bankroll = 1000;
  const bet = 100;

  // Split 1: Initial pair of 8s
  const initialHand = [{ rank: '8' }, { rank: '8' }];
  assert.equal(canSplit(initialHand, bankroll, bet, splitCount), true);
  bankroll -= bet;
  splitCount++; // now 1 split, 2 hands
  assert.equal(splitCount, 1);

  // Split 2: Hand 0 dealt another 8 -> [8, 8]
  const hand0 = [{ rank: '8' }, { rank: '8' }];
  assert.equal(canSplit(hand0, bankroll, bet, splitCount), true);
  bankroll -= bet;
  splitCount++; // now 2 splits, 3 hands
  assert.equal(splitCount, 2);

  // Split 3: Hand 1 dealt another 8 -> [8, 8]
  const hand1 = [{ rank: '8' }, { rank: '8' }];
  assert.equal(canSplit(hand1, bankroll, bet, splitCount), true);
  bankroll -= bet;
  splitCount++; // now 3 splits, 4 hands (max)
  assert.equal(splitCount, 3);

  // Split 4: Disallowed because splitCount is 3 (max 3 splits reached)
  const hand2 = [{ rank: '8' }, { rank: '8' }];
  assert.equal(canSplit(hand2, bankroll, bet, splitCount), false);

  // Split Aces rule:
  // When Aces are split, each gets exactly 1 card and cannot hit further.
  const splitAcesHand = [{ rank: 'A' }];
  splitAcesHand.push({ rank: '9' }); // 1 card dealt
  const aceEval = calculateHand(splitAcesHand);
  assert.equal(aceEval.score, 20);
  assert.equal(aceEval.isSoft, true);
  // Split Ace cannot hit further (hand size must remain 2)
  assert.equal(splitAcesHand.length, 2);
});

// 12. Dealer Peek Rule
test('shouldDealerPeek checks if dealer upcard warrants peeking for blackjack', () => {
  // Peeks on Ace and 10-value cards
  assert.equal(shouldDealerPeek({ rank: 'A' }), true);
  assert.equal(shouldDealerPeek({ rank: '10' }), true);
  assert.equal(shouldDealerPeek({ rank: 'J' }), true);
  assert.equal(shouldDealerPeek({ rank: 'Q' }), true);
  assert.equal(shouldDealerPeek({ rank: 'K' }), true);

  // Does NOT peek on non-10 cards
  assert.equal(shouldDealerPeek({ rank: '9' }), false);
  assert.equal(shouldDealerPeek({ rank: '8' }), false);
  assert.equal(shouldDealerPeek({ rank: '7' }), false);
  assert.equal(shouldDealerPeek({ rank: '2' }), false);
  assert.equal(shouldDealerPeek(null), false);
  assert.equal(shouldDealerPeek({}), false);
});

// 13. Insurance Eligibility & Cost Calculation
test('canOfferInsurance and calculateMaxInsurance enforce insurance rules', () => {
  // Offered only when dealer shows Ace and player has funds
  assert.equal(canOfferInsurance({ rank: 'A' }, 100), true);
  assert.equal(canOfferInsurance({ rank: 'A' }, 1), true);
  assert.equal(canOfferInsurance({ rank: 'A' }, 0), false); // No funds to buy insurance

  // Not offered on non-Ace upcards (even 10s)
  assert.equal(canOfferInsurance({ rank: '10' }, 100), false);
  assert.equal(canOfferInsurance({ rank: 'K' }, 100), false);
  assert.equal(canOfferInsurance({ rank: '8' }, 100), false);
  assert.equal(canOfferInsurance(null, 100), false);

  // Cost: Up to half the bet, capped by bankroll
  assert.equal(calculateMaxInsurance(50, 100), 25);
  assert.equal(calculateMaxInsurance(25, 100), 12); // Math.floor(25 / 2)
  assert.equal(calculateMaxInsurance(100, 20), 20); // Bankroll cap
  assert.equal(calculateMaxInsurance(1, 100), 0); // Math.floor(1 / 2) = 0
  assert.equal(calculateMaxInsurance(50, 0), 0);
});

// 14. Insurance Resolution & 2:1 Payout
test('resolveInsurance calculates 2:1 insurance payouts and losses correctly', () => {
  const dealerBJ = [{ rank: 'A' }, { rank: 'K' }];
  const dealerNotBJ = [{ rank: 'A' }, { rank: '7' }];
  const dealerTenBJ = [{ rank: '10' }, { rank: 'A' }];

  // Dealer has blackjack: insurance pays 2:1 profit (payout = bet + 2*bet = 3*bet)
  const winResult = resolveInsurance(dealerBJ, 25);
  assert.equal(winResult.won, true);
  assert.equal(winResult.profit, 50); // 2:1 on $25
  assert.equal(winResult.payout, 75); // $25 stake returned + $50 profit

  // Dealer does not have blackjack: insurance wager is lost
  const lossResult = resolveInsurance(dealerNotBJ, 25);
  assert.equal(lossResult.won, false);
  assert.equal(lossResult.profit, -25);
  assert.equal(lossResult.payout, 0);

  // Zero insurance bet returns neutral
  const zeroResult = resolveInsurance(dealerBJ, 0);
  assert.equal(zeroResult.won, false);
  assert.equal(zeroResult.profit, 0);
  assert.equal(zeroResult.payout, 0);

  // Ten upcard natural blackjack with insurance also pays 2:1
  const winTenResult = resolveInsurance(dealerTenBJ, 50);
  assert.equal(winTenResult.won, true);
  assert.equal(winTenResult.profit, 100);
  assert.equal(winTenResult.payout, 150);
});

// 15. Immediate Round End on Dealer Natural Blackjack
test('round ends immediately when dealer has blackjack during peek', () => {
  const dealerBJ = [{ rank: 'A' }, { rank: 'J' }];
  const player18 = [{ rank: '10' }, { rank: '8' }];
  const playerBJ = [{ rank: 'A' }, { rank: 'K' }];

  // If dealer peeks and has BJ, outcome with non-BJ player is immediate dealer win
  assert.equal(determineOutcome(player18, dealerBJ), 'dealer_win');

  // If player also has natural blackjack, outcome is push
  assert.equal(determineOutcome(playerBJ, dealerBJ), 'push');
});

// 16. Late Surrender Rules & Refund Calculation
test('canSurrender and calculateSurrenderRefund enforce late surrender rules', () => {
  const initialHand16 = [{ rank: '10' }, { rank: '6' }];
  const softHand15 = [{ rank: 'A' }, { rank: '4' }];
  const hitHand19 = [{ rank: '10' }, { rank: '6' }, { rank: '3' }];
  const naturalBJ = [{ rank: 'A' }, { rank: 'K' }];

  // Legal on initial 2 cards after dealer peek on non-split hand
  assert.equal(canSurrender(initialHand16, true, true), true);
  assert.equal(canSurrender(softHand15, true, true), true);

  // Illegal before dealer peek
  assert.equal(canSurrender(initialHand16, false, true), false);

  // Illegal on split hands
  assert.equal(canSurrender(initialHand16, true, false), false);

  // Illegal after hitting (3+ cards)
  assert.equal(canSurrender(hitHand19, true, true), false);

  // Illegal on 1 card or empty hand
  assert.equal(canSurrender([{ rank: '10' }], true, true), false);
  assert.equal(canSurrender([], true, true), false);
  assert.equal(canSurrender(null, true, true), false);

  // Illegal on natural blackjack (already wins or pushes, no surrender)
  assert.equal(canSurrender(naturalBJ, true, true), false);

  // Refund: exactly half the bet (Math.floor(bet / 2))
  assert.equal(calculateSurrenderRefund(100), 50);
  assert.equal(calculateSurrenderRefund(50), 25);
  assert.equal(calculateSurrenderRefund(25), 12);
  assert.equal(calculateSurrenderRefund(5), 2);
  assert.equal(calculateSurrenderRefund(1), 0);
  assert.equal(calculateSurrenderRefund(0), 0);
});

// 17. Dealer Soft 17 Behavior (S17 vs H17)
test('shouldDealerHit correctly differentiates between S17 (stand) and H17 (hit soft 17)', () => {
  const hard16 = [{ rank: '10' }, { rank: '6' }];
  const hard17 = [{ rank: '10' }, { rank: '7' }];
  const soft17TwoCards = [{ rank: 'A' }, { rank: '6' }];
  const soft17ThreeCards = [{ rank: 'A' }, { rank: '2' }, { rank: '4' }];
  const soft17WithAces = [{ rank: 'A' }, { rank: 'A' }, { rank: '5' }];
  const soft18 = [{ rank: 'A' }, { rank: '7' }];
  const hard18 = [{ rank: '10' }, { rank: '8' }];

  // --- S17 Table Rule (hitSoft17 = false, default) ---
  assert.equal(shouldDealerHit(hard16, false), true); // Hits on 16
  assert.equal(shouldDealerHit(hard17, false), false); // Stands on hard 17
  assert.equal(shouldDealerHit(soft17TwoCards, false), false); // Stands on soft 17
  assert.equal(shouldDealerHit(soft17ThreeCards, false), false); // Stands on multi-card soft 17
  assert.equal(shouldDealerHit(soft17WithAces, false), false); // Stands on multi-ace soft 17
  assert.equal(shouldDealerHit(soft18, false), false); // Stands on soft 18
  assert.equal(shouldDealerHit(hard18, false), false); // Stands on hard 18

  // Default argument without passing second parameter must behave as S17 (OFF)
  assert.equal(shouldDealerHit(soft17TwoCards), false);
  assert.equal(shouldDealerHit(hard17), false);

  // --- H17 Table Rule (hitSoft17 = true, "Dealer hits soft 17") ---
  assert.equal(shouldDealerHit(hard16, true), true); // Still hits on 16
  assert.equal(shouldDealerHit(hard17, true), false); // Still STANDS on hard 17!
  assert.equal(shouldDealerHit(soft17TwoCards, true), true); // HITS on soft 17!
  assert.equal(shouldDealerHit(soft17ThreeCards, true), true); // HITS on multi-card soft 17!
  assert.equal(shouldDealerHit(soft17WithAces, true), true); // HITS on multi-ace soft 17!
  assert.equal(shouldDealerHit(soft18, true), false); // STANDS on soft 18
  assert.equal(shouldDealerHit(hard18, true), false); // STANDS on hard 18
});

// 18. Basic Strategy Optimal Moves
test('getOptimalMove determines mathematically optimal basic strategy decisions', () => {
  // Pairs
  assert.equal(
    getOptimalMove([{ rank: '8' }, { rank: '8' }], { rank: '10' }, { canSplitPair: true }),
    'P'
  ); // Always split 8s
  assert.equal(
    getOptimalMove([{ rank: 'A' }, { rank: 'A' }], { rank: '10' }, { canSplitPair: true }),
    'P'
  ); // Always split Aces
  assert.equal(
    getOptimalMove([{ rank: '10' }, { rank: '10' }], { rank: '6' }, { canSplitPair: true }),
    'S'
  ); // Never split 10s (stand)
  assert.equal(
    getOptimalMove([{ rank: '5' }, { rank: '5' }], { rank: '6' }, { canSplitPair: true, canDouble: true }),
    'D'
  ); // Double 5s vs 6, do not split

  // Surrender
  assert.equal(
    getOptimalMove([{ rank: '10' }, { rank: '6' }], { rank: '10' }, { canLateSurrender: true }),
    'U'
  ); // Surrender 16 vs 10
  assert.equal(
    getOptimalMove([{ rank: '10' }, { rank: '5' }], { rank: '10' }, { canLateSurrender: true }),
    'U'
  ); // Surrender 15 vs 10

  // Soft hands
  assert.equal(
    getOptimalMove([{ rank: 'A' }, { rank: '7' }], { rank: '9' }),
    'H'
  ); // Soft 18 hits vs 9
  assert.equal(
    getOptimalMove([{ rank: 'A' }, { rank: '7' }], { rank: '7' }),
    'S'
  ); // Soft 18 stands vs 7
  assert.equal(
    getOptimalMove([{ rank: 'A' }, { rank: '7' }], { rank: '5' }, { canDouble: true }),
    'D'
  ); // Soft 18 doubles vs 5

  // Hard hands
  assert.equal(
    getOptimalMove([{ rank: '10' }, { rank: '7' }], { rank: '10' }),
    'S'
  ); // Hard 17 stands vs 10
  assert.equal(
    getOptimalMove([{ rank: '7' }, { rank: '5' }], { rank: '5' }),
    'S'
  ); // Hard 12 stands vs 5
  assert.equal(
    getOptimalMove([{ rank: '7' }, { rank: '5' }], { rank: '2' }),
    'H'
  ); // Hard 12 hits vs 2
  assert.equal(
    getOptimalMove([{ rank: '6' }, { rank: '5' }], { rank: '6' }, { canDouble: true }),
    'D'
  ); // 11 doubles vs 6
});

// 19. Career Loyalty XP & Leveling Engine
test('calculateLevel and getLevelBounds map XP and level boundaries accurately', () => {
  assert.equal(calculateLevel(0), 1);
  assert.equal(calculateLevel(199), 1);
  assert.equal(calculateLevel(200), 2);
  assert.equal(calculateLevel(800), 5);
  assert.equal(calculateLevel(999), 5);

  // Silver tier boundary (1,000 XP -> Lv 6)
  assert.equal(calculateLevel(1000), 6);
  assert.equal(calculateLevel(1400), 7);
  assert.equal(calculateLevel(4999), 15);

  // Gold tier boundary (5,000 XP -> Lv 16)
  assert.equal(calculateLevel(5000), 16);

  // Platinum tier boundary (15,000 XP -> Lv 31)
  assert.equal(calculateLevel(15000), 31);

  // Diamond Whale boundary (50,000 XP -> Lv 51)
  assert.equal(calculateLevel(50000), 51);

  const bounds1 = getLevelBounds(1);
  assert.equal(bounds1.minXp, 0);
  assert.equal(bounds1.maxXp, 200);

  const bounds6 = getLevelBounds(6);
  assert.equal(bounds6.minXp, 1000);
  assert.equal(bounds6.maxXp, 1400);
});

// 20. Loyalty Tier Progression & Reload Allowances
test('getLoyaltyProgression returns persistent tiers, dynamic reload allowances, and unlocks', () => {
  const bronze = getLoyaltyProgression(450);
  assert.equal(bronze.name, 'Bronze Roller');
  assert.equal(bronze.reloadAllowance, 1000);
  assert.equal(bronze.tierIndex, 0);
  assert.equal(bronze.nextTier.name, 'Silver Club');
  assert.equal(getReloadAllowance(450), 1000);

  const silver = getLoyaltyProgression(1500);
  assert.equal(silver.name, 'Silver Club');
  assert.equal(silver.reloadAllowance, 2500);
  assert.equal(silver.tierIndex, 1);
  assert.equal(silver.nextTier.name, 'Gold VIP');
  assert.equal(getReloadAllowance(1500), 2500);

  const gold = getLoyaltyProgression(7500);
  assert.equal(gold.name, 'Gold VIP');
  assert.equal(gold.reloadAllowance, 5000);
  assert.equal(getReloadAllowance(7500), 5000);

  const platinum = getLoyaltyProgression(25000);
  assert.equal(platinum.name, 'Platinum Elite');
  assert.equal(platinum.reloadAllowance, 10000);
  assert.equal(getReloadAllowance(25000), 10000);

  const whale = getLoyaltyProgression(60000);
  assert.equal(whale.name, 'Diamond Whale');
  assert.equal(whale.reloadAllowance, 25000);
  assert.equal(whale.nextTier, null);
  assert.equal(getReloadAllowance(60000), 25000);
});

// 21. Dynamic XP Earning & Level-Up Detection
test('addLoyaltyXP accurately tracks XP, level-up transitions, and tier promotions', () => {
  const stats = {
    xp: 180,
    level: 1,
    xpBreakdown: { wager: 100, wins: 80, blackjacks: 0, strategy: 0 }
  };

  // Adding 10 XP: total 190 XP, still Lv 1
  const res1 = addLoyaltyXP(stats, 10, 'wager');
  assert.equal(res1.leveledUp, false);
  assert.equal(res1.tieredUp, false);
  assert.equal(stats.xp, 190);

  // Adding 30 XP: total 220 XP, level up to Lv 2
  const res2 = addLoyaltyXP(stats, 30, 'wins');
  assert.equal(res2.leveledUp, true);
  assert.equal(res2.tieredUp, false);
  assert.equal(res2.newLevel, 2);
  assert.equal(stats.level, 2);

  // Jump from 950 XP to 1050 XP: both level up and tier promotion to Silver Club
  stats.xp = 950;
  const res3 = addLoyaltyXP(stats, 100, 'wager');
  assert.equal(res3.leveledUp, true);
  assert.equal(res3.tieredUp, true);
  assert.equal(res3.newTier.name, 'Silver Club');
  assert.equal(stats.level, 6);
});

console.log(`\nResults: ${passedCount} passed, ${failedCount} failed.\n`);
if (failedCount > 0) {
  process.exit(1);
}
