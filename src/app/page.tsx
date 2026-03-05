"use client";

import { useState } from "react";
import { GameInput } from "@/components/GameInput";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Loader2, Search, User, Calendar, ExternalLink, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { incrementGuestCount, isGuestLimitReached } from "@/lib/guest-utils";

export default function Home() {
  const [username, setUsername] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [recentGames, setRecentGames] = useState<any[]>([]);
  const [error, setError] = useState("");
  const router = useRouter();

  async function fetchRecentGames() {
    if (!username.trim()) return;
    setIsFetching(true);
    setError("");
    try {
      const res = await fetch(`/api/recent-games?username=${username.trim()}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRecentGames(data.games || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch games");
    } finally {
      setIsFetching(false);
    }
  }

  function handleAnalyze(gameId: string) {
    if (isGuestLimitReached()) {
      alert("Analysis limit reached for today. Please try again in 24 hours.");
      return;
    }
    incrementGuestCount();
    router.push(`/review/${gameId}`);
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Navbar */}
      <header className="absolute top-0 w-full p-6 flex justify-between items-center z-10">
        <div className="font-bold text-xl tracking-tight flex items-center gap-2">
          ♟️ <span className="hidden sm:inline">Chess Game Reviewer</span>
        </div>
        <ThemeToggle />
      </header>

      {/* Main Hero Content */}
      <main className="flex-1 flex flex-col items-center p-6 pt-24 text-center z-10 w-full max-w-5xl mx-auto">
        <div className="space-y-8 w-full animate-in fade-in slide-in-from-bottom-6 duration-1000 ease-out fill-mode-both">

          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-balance bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              Analyze Your Chess Games Instantly.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground font-medium max-w-2xl mx-auto text-balance">
              Paste a Chess.com game link or PGN to get a full engine evaluation and accuracy analysis.
              Enjoy 10 free analyses every 24 hours.
            </p>
          </div>

          <div className="w-full">
            <GameInput />
          </div>

          <div className="w-full border-t border-border pt-12 mt-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center justify-center gap-2">
              <User className="w-6 h-6 text-primary" /> Fetch Recent Games
            </h2>

            <div className="max-w-md mx-auto flex gap-2 mb-8">
              <input
                type="text"
                placeholder="Chess.com Username"
                className="flex-1 px-4 py-3 rounded-xl bg-card border border-border focus:ring-2 focus:ring-primary focus:outline-none transition-shadow"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchRecentGames()}
              />
              <button
                onClick={fetchRecentGames}
                disabled={isFetching || !username.trim()}
                className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
              >
                {isFetching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              </button>
            </div>

            {error && <p className="text-destructive mb-4">{error}</p>}

            {recentGames.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left animate-in fade-in slide-in-from-bottom-4 duration-500">
                {recentGames.map((game: any) => (
                  <div key={game.gameId} className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between hover:border-primary/50 transition-colors shadow-sm group">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2 py-0.5 bg-accent rounded-full">
                          {game.timeClass}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {new Date(game.endTime * 1000).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="space-y-1.5 mb-4 font-medium">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-slate-200" /> {game.white.username} ({game.white.rating})
                          </span>
                          {game.white.result === "win" && <span className="text-xs text-green-500 font-bold tracking-tighter">WIN</span>}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-slate-800" /> {game.black.username} ({game.black.rating})
                          </span>
                          {game.black.result === "win" && <span className="text-xs text-green-500 font-bold tracking-tighter">WIN</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAnalyze(game.gameId)}
                        className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" /> Analyze
                      </button>
                      <a
                        href={game.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 border border-border rounded-lg hover:bg-accent transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 text-muted-foreground" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
    </div>
  );
}
