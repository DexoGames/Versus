import { Link } from "react-router-dom";
import { GAMES_DATA } from "../../data/games";
import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.col}>
          <h4 className={styles.colTitle}>Play</h4>
          {GAMES_DATA.map((game) => (
            <Link key={game.id} to={game.route}>
              {game.title}
            </Link>
          ))}
        </div>

        <div className={styles.col}>
          <h4 className={styles.colTitle}>Elsewhere</h4>
          <a href="https://www.dexo.games" target="_blank" rel="noopener noreferrer">
            Dexo.Games
          </a>
          <a
            href="https://apps.apple.com/app/gridlock/id6651863189"
            target="_blank"
            rel="noopener noreferrer"
          >
            Gridlock+ on iOS
          </a>
        </div>

        <div className={styles.col}>
          <h4 className={styles.colTitle}>Get in touch</h4>
          <a href="mailto:dexter.h.smith@outlook.com">dexter.h.smith@outlook.com</a>
        </div>

        <div className={styles.meta}>
          <p>
            &copy; 2026 Dexter Smith.
            <br />
            All rights reserved.
          </p>
          <p className={styles.tagline}>Winner plays on.</p>
        </div>
      </div>

      <div className={styles.bigNameWrap} aria-hidden="true">
        <span className={styles.bigName}>Versus</span>
      </div>
    </footer>
  );
}
