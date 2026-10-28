import { SUITS, RANKS, SUIT_INFO, createCardFaceCanvas } from './cardFaces.js';

const container = document.getElementById('deck-container');

function renderDeck(filter = 'all') {
  container.innerHTML = '';

  const suitsToRender = filter === 'all' ? SUITS : [filter];

  suitsToRender.forEach((suit) => {
    const info = SUIT_INFO[suit];
    const isRed = suit === 'hearts' || suit === 'diamonds';

    const section = document.createElement('div');
    section.className = 'suit-section';

    const title = document.createElement('div');
    title.className = `suit-title ${isRed ? 'red' : 'black'}`;
    title.textContent = `${info.name} ${info.symbol} (${RANKS.length} cards)`;
    section.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'card-grid';

    RANKS.forEach((rank) => {
      const cardItem = document.createElement('div');
      cardItem.className = 'card-item';

      const canvas = createCardFaceCanvas(suit, rank);
      cardItem.appendChild(canvas);

      const label = document.createElement('div');
      label.className = `card-label ${isRed ? 'red' : 'black'}`;
      label.textContent = `${rank}${info.symbol}`;
      cardItem.appendChild(label);

      grid.appendChild(cardItem);
    });

    section.appendChild(grid);
    container.appendChild(section);
  });
}

// Initial render
renderDeck('all');

// Filter button handlers
const filterBtns = document.querySelectorAll('.filter-btn');
filterBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    filterBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    renderDeck(btn.dataset.filter);
  });
});
