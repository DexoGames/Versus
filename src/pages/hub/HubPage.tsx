import { Link } from "react-router-dom";
import { GAMES_DATA, type GameInfo } from "../../data/games";
import { Navbar } from "../../components/Navbar/Navbar";
import styles from "./HubPage.module.css";

/** Little SVG motif per game so the cards read as games, not text blocks. */
function CardMotif({ game }: { game: GameInfo }) {
  if (game.id === "gridlock") {
    return (
      <svg className={styles.motif} viewBox="0 0 120 90" aria-hidden="true">
        {[0, 30, 60, 90, 120].map((x) => (
          <line key={`v${x}`} x1={x} y1={0} x2={x} y2={90} className={styles.motifGrid} />
        ))}
        {[0, 30, 60, 90].map((y) => (
          <line key={`h${y}`} x1={0} y1={y} x2={120} y2={y} className={styles.motifGrid} />
        ))}
        <polygon points="30,60 60,60 60,30 30,30" className={styles.motifFillA} />
        <polygon points="60,30 90,30 90,60" className={styles.motifFillB} />
        <polyline points="0,90 30,90 30,60 60,60 60,30 90,30 90,60 60,60" className={styles.motifLineA} />
        <polyline points="120,0 90,0 90,30 60,30" className={styles.motifLineB} />
      </svg>
    );
  }
  if (game.id === "spellout") {
    return (
      <div className={styles.motifTiles} aria-hidden="true">
        {["V", "E", "R", "S", "U", "?"].map((l, i) => (
          <span
            key={i}
            className={styles.motifTile}
            style={{ animationDelay: `${i * 90}ms` }}
            data-dead={l === "?" || undefined}
          >
            {l}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className={styles.motifBids} aria-hidden="true">
      {[
        { n: 7, tag: "too high" },
        { n: 4, tag: "so close" },
        { n: 2, tag: "steals it" },
      ].map((b, i) => (
        <span
          key={i}
          className={styles.motifBid}
          data-win={b.n === 2 || undefined}
          style={{ animationDelay: `${i * 120}ms` }}
        >
          {b.n}
          <em>{b.tag}</em>
        </span>
      ))}
    </div>
  );
}

export function HubPage() {
  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <header className={styles.hero}>
          <div className={styles.heroInner}>
            <h1 className={styles.heroTitle}>
              Versus<span className={styles.heroDot}>.</span>
            </h1>
            <div className={styles.heroSide}>
              <p className={styles.heroSub}>
                Play a collection of brand new head-to-head games that challenge your intellect.
              </p>
              <div className={styles.heroMeta}>
                <span><i className="fas fa-robot"></i> vs CPU</span>
                <span><i className="fas fa-couch"></i> Hotseat</span>
                <span><i className="fas fa-wifi"></i> Online</span>
              </div>
            </div>
          </div>
        </header>

        <section className={styles.gamesSection} id="games">
          <div className={styles.grid}>
            {GAMES_DATA.map((game, i) => (
              <Link
                key={game.id}
                to={game.route}
                className={styles.card}
                style={{ ["--accent-card" as string]: game.accent }}
              >
                <div className={styles.cover}>
                  <CardMotif game={game} />
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
        </section>
      </main>
    </>
  );
}
