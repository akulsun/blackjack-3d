import { SUITS, RANKS } from './cardFaces.js';

/**
 * 6-Deck Blackjack Dealing Shoe.
 * Keeps game logic strictly separated from rendering.
 */
export class Shoe {
  constructor(numDecks = 6) {
    this.numDecks = numDecks;
    this.cards = [];
    this.shuffle();
  }

  /**
   * Initializes and shuffles 6 full standard decks (312 cards)
   * using the unbiased Fisher-Yates shuffle algorithm.
   */
  shuffle() {
    this.cards = [];
    for (let d = 0; d < this.numDecks; d++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          this.cards.push({ suit, rank });
        }
      }
    }

    // Fisher-Yates shuffle
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = this.cards[i];
      this.cards[i] = this.cards[j];
      this.cards[j] = temp;
    }

    // Cut card penetration: reshuffle when ~20% of shoe remains (approx 60 cards)
    this.penetrationLimit = Math.floor(this.cards.length * 0.2);
  }

  /**
   * Draws a single card from the shoe. Reshuffles automatically if shoe runs low.
   * @returns {{ suit: string, rank: string }}
   */
  drawCard() {
    if (this.cards.length <= this.penetrationLimit) {
      this.shuffle();
    }
    return this.cards.pop();
  }

  /**
   * Number of cards currently remaining in the shoe.
   */
  get remaining() {
    return this.cards.length;
  }
}
