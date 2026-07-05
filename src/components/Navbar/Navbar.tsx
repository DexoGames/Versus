import { Link, useLocation } from "react-router-dom";
import { useNavBrandTyper } from "../../hooks/useNavBrandTyper";
import { GAMES_DATA } from "../../data/games";
import { cx } from "../../lib/cx";
import styles from "./Navbar.module.css";

// Stable references so the typer effect doesn't restart on every render.
const BRAND_SUFFIXES = ["Versus", "Gridlock", "Spellout", "Undercut"];
const BRAND_HOLD_TIMES = [8000, 3000, 3000, 3000];

export function Navbar() {
  const location = useLocation();
  const typedSuffix = useNavBrandTyper(BRAND_SUFFIXES, BRAND_HOLD_TIMES);

  return (
    <nav className={styles.navbar}>
      <div className={styles.left}>
        <span className={styles.status}>
          <span className={styles.dot}></span>Head-to-head
        </span>
        <Link to="/" className={styles.brand}>
          Dexo.<span className={styles.brandSuffix}>{typedSuffix}</span>
        </Link>
      </div>

      <ul className={styles.links}>
        {GAMES_DATA.map((game) => (
          <li key={game.id}>
            <Link
              to={game.route}
              className={cx(location.pathname === game.route && styles.active)}
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
