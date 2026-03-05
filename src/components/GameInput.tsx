"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search, Loader2, Link2, FileText } from "lucide-react";
import { Chess } from "chess.js";
import { AuthModal } from "@/components/AuthModal";
import {
    GUEST_LIMIT,
    getOrCreateGuestToken,
    getGuestCount,
    incrementGuestCount
} from "@/lib/guest-utils";

type Tab = "url" | "pgn";

export function GameInput() {
    const [tab, setTab] = useState<Tab>("url");
    const [url, setUrl] = useState("");
    const [pgn, setPgn] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const pendingActionRef = useRef<(() => void) | null>(null);
    const router = useRouter();

    // Reset error on tab switch
    useEffect(() => { setError(""); }, [tab]);

    function checkGuestLimit(action: () => void) {
        const count = getGuestCount();
        if (count >= GUEST_LIMIT) {
            pendingActionRef.current = action;
            setShowAuthModal(true);
            return;
        }
        action();
    }

    function handleAuthSuccess() {
        setShowAuthModal(false);
        if (pendingActionRef.current) {
            pendingActionRef.current();
            pendingActionRef.current = null;
        }
    }

    // --- URL Tab ---
    function handleUrlSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");

        if (!url.trim()) {
            setError("Please enter a game URL");
            return;
        }

        try {
            const parsedUrl = new URL(url);
            if (!parsedUrl.hostname.includes("chess.com")) {
                setError("Please enter a valid Chess.com link");
                return;
            }
            const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
            const gameId = pathParts[pathParts.length - 1];
            if (!gameId || isNaN(Number(gameId))) {
                setError("Could not extract a valid Game ID from the URL");
                return;
            }

            checkGuestLimit(() => {
                incrementGuestCount();
                setIsLoading(true);
                router.push(`/review/${gameId}`);
            });
        } catch {
            setError("Please enter a valid URL");
        }
    }

    // --- PGN Tab ---
    function handlePgnSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");

        if (!pgn.trim()) {
            setError("Please paste a PGN");
            return;
        }

        // Validate with chess.js
        try {
            const chess = new Chess();
            chess.loadPgn(pgn.trim());
            if (chess.history().length === 0) {
                setError("PGN appears to have no moves.");
                return;
            }
        } catch {
            setError("Invalid PGN — could not parse it. Please check the format.");
            return;
        }

        checkGuestLimit(() => {
            incrementGuestCount();
            sessionStorage.setItem("pendingPgn", pgn.trim());
            setIsLoading(true);
            router.push("/review/pgn");
        });
    }

    const guestCount = typeof window !== "undefined" ? getGuestCount() : 0;
    const guestRemaining = Math.max(0, GUEST_LIMIT - guestCount);

    return (
        <>
            {showAuthModal && (
                <AuthModal
                    onClose={() => setShowAuthModal(false)}
                    onSuccess={handleAuthSuccess}
                />
            )}

            <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-4">
                {/* Tabs */}
                <div className="flex bg-card border border-border rounded-xl p-1 gap-1 w-full max-w-xs shadow-sm">
                    <button
                        type="button"
                        onClick={() => setTab("url")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-150 ${tab === "url" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        <Link2 className="w-3.5 h-3.5" /> Chess.com URL
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab("pgn")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-150 ${tab === "pgn" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        <FileText className="w-3.5 h-3.5" /> Paste PGN
                    </button>
                </div>

                {/* URL Tab */}
                {tab === "url" && (
                    <form onSubmit={handleUrlSubmit} className="w-full relative shadow-lg rounded-2xl animate-in fade-in duration-150">
                        <div className="relative flex items-center w-full">
                            <input
                                type="text"
                                placeholder="Paste your Chess.com game URL here..."
                                className="w-full pl-6 pr-32 py-5 rounded-2xl bg-card border-none text-card-foreground text-lg focus:ring-2 focus:ring-primary focus:outline-none transition-shadow"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                disabled={isLoading}
                            />
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="absolute right-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Analyze</span><Search className="w-4 h-4" /></>}
                            </button>
                        </div>
                    </form>
                )}

                {/* PGN Tab */}
                {tab === "pgn" && (
                    <form onSubmit={handlePgnSubmit} className="w-full flex flex-col gap-3 animate-in fade-in duration-150">
                        <textarea
                            placeholder={`Paste your PGN here...\n\n[Event "Live Chess"]\n[White "Player1"]\n...\n\n1. e4 e5 2. Nf3 ...`}
                            className="w-full min-h-[200px] p-4 rounded-2xl bg-card border border-border text-card-foreground text-sm font-mono focus:ring-2 focus:ring-primary focus:outline-none transition-shadow resize-y shadow-lg"
                            value={pgn}
                            onChange={(e) => setPgn(e.target.value)}
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !pgn.trim()}
                            className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-primary-foreground font-semibold text-lg rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><FileText className="w-5 h-5" /><span>Analyze PGN</span></>}
                        </button>
                    </form>
                )}

                {/* Error */}
                {error && (
                    <p className="text-destructive font-medium bg-destructive/10 px-4 py-2 rounded-lg text-sm w-full text-center animate-in fade-in">
                        {error}
                    </p>
                )}

                {/* Guest usage badge */}
                <p className="text-xs text-muted-foreground">
                    {guestRemaining > 0
                        ? `${guestRemaining} free ${guestRemaining === 1 ? "analysis" : "analyses"} remaining`
                        : "Free limit reached — come back tomorrow"}
                </p>
            </div>
        </>
    );
}
