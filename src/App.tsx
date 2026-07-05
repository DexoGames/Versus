import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { HubPage } from "./pages/hub/HubPage";
import { GridlockPage } from "./pages/gridlock/GridlockPage";
import { SpelloutPage } from "./pages/spellout/SpelloutPage";
import { UndercutPage } from "./pages/undercut/UndercutPage";

/** Route → accent theme class (each game recolours the shared chrome). */
function themeFor(pathname: string): string {
  if (pathname.startsWith("/gridlock")) return "theme-gridlock";
  if (pathname.startsWith("/spellout")) return "theme-spellout";
  if (pathname.startsWith("/undercut")) return "theme-undercut";
  return "";
}

export function App() {
  const location = useLocation();
  return (
    <div id="pageWrapper" className={`page-wrapper ${themeFor(location.pathname)}`}>
      <Routes>
        <Route path="/" element={<HubPage />} />
        <Route path="/gridlock" element={<GridlockPage />} />
        <Route path="/spellout" element={<SpelloutPage />} />
        <Route path="/undercut" element={<UndercutPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
