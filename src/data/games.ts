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
      "Draw your line around the grid and gain as much area you can.",
    howToPlay: [
      "Extend your line two edges a turn (one on your first). No retracing.",
      "Close a loop to claim the area inside — diagonals count, a triangle is 0.5.",
      "Hold the most area to win.",
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
      "Build a word letter by letter. If your letter completes a word that can't be extended, you win.",
    howToPlay: [
      "Add one letter a turn to a shared fragment.",
      "It must still spell toward a real word. A dead letter loses on the spot.",
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
    genre: "Mind-Game Standoff",
    blurb:
      "Every turn you pick a number, if the number is adjacent to the opponents then the higher wins. If you undercut by more than 1 then the lowest number wins. You earn as many points as your number.",
    howToPlay: [
      "Everyone secretly picks 1–10 each turn.",
      "If adjacent to opponent, higher number wins, otherwise you undercut and lowest wins. Tie scores no one.",
      "You earn as many points as the number you put forward. Race to 10 points for a round.",
    ],
    players: "2–4 players",
    icon: "fa-arrow-down-1-9",
    route: "/undercut",
    accent: "var(--game-undercut)",
  },
];
