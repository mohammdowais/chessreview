"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";

export function GameInput() {
    const [url, setUrl] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!url.trim()) {
            setError("Please enter a game URL");
            return;
        }

        try {
            const parsedUrl = new URL(url);

            // Basic validation for chess.com game URLs
            if (!parsedUrl.hostname.includes("chess.com")) {
                setError("Please enter a valid Chess.com link");
                return;
            }

            // Extract Game ID based on different chess.com URL formats
            // Format 1: https://www.chess.com/game/live/165548711762
            // Format 2: https://www.chess.com/game/daily/123456
            // Format 3: https://www.chess.com/analysis/game/live/165548711762
            const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
            // Usually the game ID is the last numeric part of the URL path
            const gameId = pathParts[pathParts.length - 1];

            if (!gameId || isNaN(Number(gameId))) {
                setError("Could not extract a valid Game ID from the URL");
                return;
            }

            setIsLoading(true);
            router.push(`/review/${gameId}`);
        } catch (err) {
            setError("Please enter a valid URL");
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto flex flex-col items-center">
            <form onSubmit={handleSubmit} className="w-full relative shadow-lg rounded-2xl">
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
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <span>Analyze</span>
                                <Search className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </div>
            </form>
            {error && (
                <p className="mt-4 text-destructive font-medium bg-destructive/10 px-4 py-2 rounded-lg">
                    {error}
                </p>
            )}
        </div>
    );
}
