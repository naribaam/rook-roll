import { Switch, Route, Router as WouterRouter } from "wouter";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";
import HomePage from "@/pages/Home";
import PlayPage from "@/pages/Play";
import MultiplayerPage from "@/pages/Multiplayer";
import LeaderboardPage from "@/pages/Leaderboard";
import ProfilePage from "@/pages/Profile";
import StorePage from "@/pages/Store";
import GameAnalysisPage from "@/pages/GameAnalysis";
import RoomPage from "@/pages/Room";
import NotFound from "@/pages/not-found";

function Routes() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/play" component={PlayPage} />
      <Route path="/multiplayer" component={MultiplayerPage} />
      <Route path="/leaderboard" component={LeaderboardPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/store" component={StorePage} />
      <Route path="/game/:gameId" component={GameAnalysisPage} />
      <Route path="/room/:code" component={RoomPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AuthProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Routes />
      </WouterRouter>
      <Toaster richColors position="top-right" />
    </AuthProvider>
  );
}

export default App;
