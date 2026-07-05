import type { ReactNode } from "react";
import type { GameInfo } from "../data/games";
import { Navbar } from "../components/Navbar/Navbar";
import { Footer } from "../components/Footer/Footer";
import { Section } from "../components/Section/Section";
import { SectionHeader } from "../components/SectionHeader/SectionHeader";
import styles from "./GamePageFrame.module.css";

interface GamePageFrameProps {
  game: GameInfo;
  inMatch: boolean;
  onExitMatch: () => void;
  children: ReactNode;
}

/** Shared chrome for the three game pages: navbar, header band, footer. */
export function GamePageFrame({ game, inMatch, onExitMatch, children }: GamePageFrameProps) {
  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <Section tone="black" className={styles.section}>
          <SectionHeader
            tone="black"
            icon={game.icon}
            label={game.title}
            description={`${game.genre} · ${game.players}`}
          />
          {inMatch && (
            <button type="button" className={styles.backLink} onClick={onExitMatch}>
              <i className="fas fa-arrow-left"></i> Back to lobby
            </button>
          )}
          {children}
        </Section>
      </main>
      <Footer />
    </>
  );
}
