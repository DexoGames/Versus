import { Link } from "react-router-dom";
import { GAMES_DATA } from "../../data/games";
import { Navbar } from "../../components/Navbar/Navbar";
import { Footer } from "../../components/Footer/Footer";
import { Section } from "../../components/Section/Section";
import { SectionHeader } from "../../components/SectionHeader/SectionHeader";
import styles from "./HubPage.module.css";

export function HubPage() {
  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <p className={styles.heroKicker}>Dexo presents</p>
            <h1 className={styles.heroTitle}>
              Versus<span className={styles.heroDot}>.</span>
            </h1>
            <p className={styles.heroSub}>
              Three head-to-head games from the Gridlock+ collection, rebuilt
              for the browser. Face the CPU across four difficulty tiers, share
              a device, or send a friend a room code.
            </p>
            <div className={styles.heroMeta}>
              <span>vs CPU</span>
              <span>Hotseat</span>
              <span>Online rooms</span>
            </div>
          </div>
        </section>

        <Section tone="cream" id="games" className={styles.gamesSection}>
          <SectionHeader
            icon="fa-gamepad"
            label="Pick your game"
            description="Every game is playable against the CPU, on one device, or online with a room code."
          />
          <div className={styles.grid}>
            {GAMES_DATA.map((game, i) => (
              <Link key={game.id} to={game.route} className={styles.card}>
                <div
                  className={styles.cover}
                  style={{ ["--accent" as string]: game.accent }}
                >
                  <i className={`fas ${game.icon}`}></i>
                  <span className={styles.coverIndex}>0{i + 1}</span>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardTop}>
                    <h3 className={styles.cardTitle}>{game.title}</h3>
                    <span className={styles.cardPlayers}>{game.players}</span>
                  </div>
                  <p className={styles.cardGenre}>{game.genre}</p>
                  <p className={styles.cardBlurb}>{game.blurb}</p>
                  <span className={styles.cardCta}>
                    Play <i className="fas fa-arrow-right"></i>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}
