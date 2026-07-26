import { Routes, Route } from "react-router-dom";
import DashboardPage from "../pages/DashboardPage";
import NewGamePage from "../pages/NewGamePage";
import GamesPage from "../pages/GamesPage";
import SettingsPage from "../pages/SettingsPage";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/new-game" element={<NewGamePage />} />
      <Route path="/games" element={<GamesPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}