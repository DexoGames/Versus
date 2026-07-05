import { Navigate, Route, Routes } from "react-router-dom";
import { HubPage } from "./pages/hub/HubPage";
import { GridlockPage } from "./pages/gridlock/GridlockPage";
import { SpelloutPage } from "./pages/spellout/SpelloutPage";
import { UndercutPage } from "./pages/undercut/UndercutPage";

export function App() {
  return (
    <div id="pageWrapper" className="page-wrapper">
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
