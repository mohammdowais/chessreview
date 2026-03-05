"use client";

import { GameInput } from "@/components/GameInput";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useSession, signOut } from "next-auth/react";
import { LogOut, User } from "lucide-react";

export default function Home() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Navbar */}
      <header className="absolute top-0 w-full p-6 flex justify-between items-center z-10">
        <div className="font-bold text-xl tracking-tight flex items-center gap-2">
          ♟️ <span className="hidden sm:inline">Chess Game Reviewer</span>
        </div>
        <div className="flex items-center gap-3">
          {session?.user && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-card border border-border rounded-full px-3 py-1.5 text-sm font-medium shadow-sm">
                <User className="w-3.5 h-3.5 text-primary" />
                <span>{session.user.name}</span>
              </div>
              <button
                onClick={() => signOut()}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full hover:bg-accent"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Main Hero Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 w-full">
        <div className="max-w-4xl mx-auto space-y-8 mt-12 w-full animate-in fade-in slide-in-from-bottom-6 duration-1000 ease-out fill-mode-both">

          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-balance bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              Analyze Your Chess Games Instantly.
            </h1>
            <p className="text-lg md:text-2xl text-muted-foreground font-medium max-w-2xl mx-auto text-balance">
              Paste any Chess.com game link or PGN and get a full engine evaluation, brilliant move detection, and accuracy analysis.
            </p>
          </div>

          <div className="pt-8 w-full">
            <GameInput />
          </div>

        </div>
      </main>

      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
    </div>
  );
}
