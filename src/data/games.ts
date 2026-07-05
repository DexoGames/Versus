export interface GameInfo {
  id: "gridlock" | "spellout" | "undercut";
  title: string;
  genre: string;
  blurb: string;
  /** Longer description for the game page lobby. */
  howToPlay: string[];
  players: string;
  icon: string; // Font Awesome name, e.g. "fa-border-all"
  route: string;
  accent: string; // CSS colour used on the hub card
}

export const GAMES_DATA: GameInfo[] = [
  {
    id: "gridlock",
    title: "Gridlock",
    genre: "Territory Strategy",
    blurb:
      "Dots and boxes on steroids. Snake your chain across the grid, wall off territory, and starve your rivals of moves.",
    howToPlay: [
      "Each player owns a chain that starts in a corner. On your turn, extend it by two edges (one on the very first turn).",
      "You can't retrace a drawn edge. If you're boxed in orthogonally, diagonals open up as a last resort.",
      "Close a loop around empty cells to capture them — captured area is your score.",
      "No legal moves means your turn is skipped. Win by making your lead mathematically unbeatable, or hold the most area when the board locks up.",
    ],
    players: "2–4 players",
    icon: "fa-border-all",
    route: "/gridlock",
    accent: "var(--player-0)",
  },
  {
    id: "spellout",
    title: "Spellout",
    genre: "Word Duel",
    blurb:
      "Build a word letter by letter. Land the killing letter — the one that finishes a word that can't grow — and you win.",
    howToPlay: [
      "You and your opponent take turns adding one letter to a shared fragment.",
      "Every fragment must still lead to a real word. Play a dead letter and you lose on the spot.",
      "Finish a word that can't be extended any further and you win.",
      "Words that can still grow keep the duel alive — \"cat\" is safe while \"cattle\" exists.",
    ],
    players: "2 players",
    icon: "fa-spell-check",
    route: "/spellout",
    accent: "var(--player-1)",
  },
  {
    id: "undercut",
    title: "Undercut",
    genre: "Mind-Game Bidding",
    blurb:
      "Three players, secret bids, one rule: lowest wins — unless someone sits exactly one above you and steals it.",
    howToPlay: [
      "All three players secretly pick a number from 1 to 6 each round.",
      "Lowest unique bid wins the round... unless another player bid exactly one higher — they undercut and steal the win.",
      "The winner scores their own bid. Tie at the winning number and nobody scores.",
      "After round one you can only move ±1 from your previous bid. First to the target score wins.",
    ],
    players: "3 players",
    icon: "fa-arrow-down-1-9",
    route: "/undercut",
    accent: "var(--player-2)",
  },
];
