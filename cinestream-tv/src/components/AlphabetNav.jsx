import React from 'react';

const LETTERS = [
  '#', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 
  'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
];

export default function AlphabetNav({ currentLetter, onSelectLetter, counts = {} }) {
  return (
    <div className="alphabet-nav-container">
      <div className="alphabet-scroll-row">
        {LETTERS.map(letter => {
          const isActive = currentLetter === letter;
          const count = counts[letter];
          return (
            <button
              key={letter}
              className={`alphabet-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelectLetter(letter)}
              title={count ? `${count} títulos na letra ${letter}` : `Letra ${letter}`}
            >
              <span className="alphabet-char">{letter}</span>
              {count !== undefined && count > 0 && (
                <span className="alphabet-count">{count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
