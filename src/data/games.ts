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
      "Extend your chain two edges a turn (one on your first). No retracing.",
      "Close a loop to claim the area inside — diagonals count, a triangle is 0.5.",
      "Hold the most area, or take an unbeatable lead, to win.",
    ],
    players: "2–4 players",
    icon: "fa-border-all",
    route: "/gridlock",
    accent: "var(--game-gridlock)",
  },
  {
    id: "spellout",
    title: "Spellout",
    genre: "Word Duel",
    blurb:
      "Build a word letter by letter. Land the killing letter — the one that finishes a word that can't grow — and you win.",
    howToPlay: [
      "Add one letter a turn to a shared fragment.",
      "It must still spell toward a real word — a dead letter loses on the spot.",
      "Finish a word that can't grow any further and you win.",
    ],
    players: "2–3 players",
    icon: "fa-spell-check",
    route: "/spellout",
    accent: "var(--game-spellout)",
  },
  {
    id: "undercut",
    title: "Undercut",
    genre: "Mind-Game Bidding",
    blurb:
      "Secret bids, one rule: the higher number wins — unless someone dives more than 1 below it and steals the lot.",
    howToPlay: [
      "Everyone secretly bids 1–10 each hand.",
      "Higher bid wins its value — unless undercut by more than 1. Tie at the top scores nobody.",
      "Race to 10 points for a round; win enough rounds to take the match.",
    ],
    players: "2–4 players",
    icon: "fa-arrow-down-1-9",
    route: "/undercut",
    accent: "var(--game-undercut)",
  },
];
