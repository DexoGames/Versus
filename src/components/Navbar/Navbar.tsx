import { Link, useLocation } from "react-router-dom";
import { GAMES_DATA } from "../../data/games";
import { cx } from "../../lib/cx";
import styles from "./Navbar.module.css";

export function Navbar() {
  const location = useLocation();

  return (
    <nav className={styles.navbar}>
      <Link to="/" className={styles.brand}>
        Versus<span className={styles.brandDot}>.</span>
      </Link>

      <ul className={styles.links}>
        {GAMES_DATA.map((game) => (
          <li key={game.id}>
            <Link
              to={game.route}
              style={{ ["--link-accent" as string]: game.accent }}
              className={cx(
                styles.gameLink,
                location.pathname === game.route && styles.active,
              )}
            >
              {game.title}
            </Link>
          </li>
        ))}
      </ul>

      <a
        href="https://www.dexo.games"
        className={styles.cta}
        target="_blank"
        rel="noopener noreferrer"
      >
        Dexo.Games
      </a>
    </nav>
  );
}
