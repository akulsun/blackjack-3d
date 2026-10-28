# 3D Blackjack

An immersive, real-time 3D Blackjack game built with **Three.js** and **Vite**. Features authentic casino table geometry, procedural high-resolution playing cards, synthesized audio via the Web Audio API, and a complete standard rules engine.

---

## Features

- **3D Table & Atmosphere**: Realistic casino table with custom-felt tones (Emerald Green, Sapphire Navy, Ruby Burgundy, and Onyx Charcoal), dynamic camera transitions, and cast shadows.
- **Procedural High-Resolution Cards**: 52-card deck generated directly via HTML5 Canvas with sharp vector pips, custom royal court designs, authentic back filigree, and physical thickness.
- **Comprehensive Rules Engine**:
  - **Dealer Rules**: Stand on all 17s (**S17**) or Hit Soft 17 (**H17**).
  - **Blackjack Payouts**: Standard **3:2** or Vegas **6:5**.
  - **Shoe Configuration**: 1, 2, 4, 6, or 8 deck shoe with realistic cut-card penetration and Fisher-Yates shuffling.
  - **Player Actions**: Hit, Stand, Double Down, Split (up to 3 splits / 4 hands), Late Surrender, and 2:1 Insurance against dealer Aces.
- **Animated Discard Tray & Card Cleanup**: Authentically styled clear-acrylic discard rack positioned on the dealer's right. When a round finishes, cards automatically lift, scoop into a neat stack at the center felt with synthesized sliding friction audio, and slide into the discard tray. Features an automatic 1.8-second idle cleanup timer or instantaneous expedited sweep on Deal / Rebet & Deal, with a physical discard stack inside the tray that visibly accumulates and resets on shoe reshuffle.
- **Synthesized Web Audio**: Procedural sound effects using the Web Audio API for card sliding, felt taps, chip placement, winning fanfares, and busts — zero external audio assets required.
- **Fast Casino Flow & Quality of Life**: Instant "Rebet" and "Rebet & Deal" one-click actions, 2× bet multiplier, full desktop keyboard shortcuts (`Space`, `H`, `S`, `D`, `P`, `U`, `R`, `X`, `C`, `1-4`, `Y/N`), intuitive mobile touch gestures (Swipe Down = Hit, Swipe Across = Stand, Swipe Up = Double, Two-finger Tap = Split), and an interactive Controls Guide modal.
- **Player Analytics & Bankroll Progression**: Comprehensive statistics dashboard tracking total hands played, win rate percentage, natural blackjack frequency, current & best winning streaks, highest single payout, and an interactive real-time canvas bankroll trajectory chart.
- **High-Roller Chip Denominations & Interactive Betting**: Extended chip stack array with $1, $5, $25, $100, $500, and $1,000 chips. Supports direct 3D raycast interaction to click table chip stacks to bet, and click active bets in the betting circle to remove or adjust chips.
- **Table HUD & Settings Modal**: Responsive controls for denomination bets ($1, $5, $25, $100, $500, $1,000), bankroll reload, animation speed adjustment (Normal, Fast, Turbo), and audio controls.
- **Card Inspector Grid**: Dedicated `/debug.html` grid displaying all 52 high-resolution procedural card faces with filtering.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- `npm`

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/akulsun/blackjack-3d.git
   cd blackjack-3d
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the local development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to the local URL (typically `http://localhost:5173/`).

---

## Available Scripts

- `npm run dev`: Launch the Vite local development server.
- `npm run build`: Bundle production-ready assets into the `dist/` directory.
- `npm run preview`: Preview the production build locally.
- `npm test`: Run the Blackjack rules engine unit test suite.

---

## Tech Stack

- **Three.js**: 3D rendering, lighting, materials, and card geometry.
- **Vite**: Ultra-fast build tool and bundler.
- **Web Audio API**: Real-time sound synthesis.
- **Vanilla JavaScript (ES Modules)**: Clean architecture decoupling rules logic from 3D presentation.

---

## License

This project is licensed under the [MIT License](LICENSE).
