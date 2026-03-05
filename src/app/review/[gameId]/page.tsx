"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Chess } from "chess.js";
import dynamic from "next/dynamic";
import { Loader2, ArrowLeft, ChevronLeft, ChevronRight, FastForward, Rewind } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ChessEngine } from "@/lib/engine";
import { getMoveClassification, getClassificationColor, MoveClassification } from "@/lib/chess-utils";

// Dynamic import for React Chessboard to prevent Next.js SSR hydration mismatch
const ReactChessboard = dynamic(() => import("react-chessboard").then(mod => mod.Chessboard), {
    ssr: false,
    loading: () => <div className="w-full aspect-square bg-accent/20 flex items-center justify-center animate-pulse"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
});

type MoveAnalysis = {
    fen: string;
    moveSan: string;
    playedMoveUci: string;
    evalScore: number;
    bestMove: string;
    classification: MoveClassification;
};

export default function ReviewPage() {
    const { gameId } = useParams();
    const router = useRouter();

    const [loadingMsg, setLoadingMsg] = useState("Loading Game Data...");
    const [error, setError] = useState("");

    // Players
    const [whitePlayer, setWhitePlayer] = useState("White");
    const [blackPlayer, setBlackPlayer] = useState("Black");

    // Chess State
    const [game] = useState<Chess>(new Chess());
    const [fen, setFen] = useState(game.fen());
    const [history, setHistory] = useState<string[]>([]);
    const [historyUci, setHistoryUci] = useState<string[]>([]);
    const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);

    // Analysis State
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState(0);
    const [analyzedMoves, setAnalyzedMoves] = useState<MoveAnalysis[]>([]);

    const engineRef = useRef<ChessEngine | null>(null);

    useEffect(() => {
        async function init() {
            try {
                setLoadingMsg("Fetching PGN...");
                const res = await fetch("/api/analyze", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ gameId }),
                });

                if (!res.ok) {
                    const e = await res.json();
                    throw new Error(e.error || "Failed to load game data");
                }

                const data = await res.json();

                if (data.pgn) {
                    game.loadPgn(data.pgn);

                    if (data.white) {
                        setWhitePlayer(typeof data.white === 'string' ? data.white.split("/").pop() || "White" : data.white.username || "White");
                    }
                    if (data.black) {
                        setBlackPlayer(typeof data.black === 'string' ? data.black.split("/").pop() || "Black" : data.black.username || "Black");
                    }

                    const moveHistorySan = game.history();
                    setHistory(moveHistorySan);

                    // Get exact internal moves for UCI to match with Stockfish bestMove
                    const tempGame = new Chess();
                    const moveHistoryUci = moveHistorySan.map(m => {
                        const moveObj = tempGame.move(m);
                        return moveObj.from + moveObj.to + (moveObj.promotion || "");
                    });
                    setHistoryUci(moveHistoryUci);

                    setFen(game.fen());
                    setCurrentMoveIndex(moveHistorySan.length - 1);

                    // Start Analysis
                    startAnalysis(moveHistorySan, moveHistoryUci);
                } else {
                    throw new Error("Game PGN not found");
                }
            } catch (err: any) {
                setError(err.message || "Something went wrong.");
            } finally {
                setLoadingMsg("");
            }
        }

        if (gameId) init();

        return () => {
            if (engineRef.current) {
                engineRef.current.destroy();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameId]);

    const startAnalysis = async (movesSan: string[], movesUci: string[]) => {
        setAnalyzing(true);
        setAnalysisProgress(0);

        engineRef.current = new ChessEngine();

        // We need to evaluate the position at each step.
        const tempGame = new Chess();
        const results: MoveAnalysis[] = [];

        // Evaluate starting position first (idx -1)
        let prevEval = 0.2; // roughly standard initial eval

        for (let i = 0; i < movesSan.length; i++) {
            setAnalysisProgress(Math.round(((i + 1) / movesSan.length) * 100));

            // Evaluate the position AFTER the move.
            // But stockfish getEvaluation takes a bit of time.
            tempGame.move(movesSan[i]);
            const currentFen = tempGame.fen();

            try {
                // Note: depth 10 for faster analysis in frontend. Depth 15 can take ~2s per move.
                const { evalScore, bestMove } = await engineRef.current.getEvaluation(currentFen, 12);

                const isWhiteMove = i % 2 === 0;
                // If white moved, we want to see how much worse the evaluation got.
                // getMoveClassification takes absolute evals relative to white.
                const { classification } = getMoveClassification(prevEval, evalScore, movesUci[i], bestMove, isWhiteMove);

                results.push({
                    fen: currentFen,
                    moveSan: movesSan[i],
                    playedMoveUci: movesUci[i],
                    evalScore,
                    bestMove,
                    classification,
                });

                prevEval = evalScore; // store for next iteration
                setAnalyzedMoves([...results]); // trigger UI update progressively

                // If it's a huge blunder or mate, users want to see it quickly, but we just continue
            } catch (e) {
                console.error("Engine evaluation failed for move", i, e);
                break;
            }
        }

        setAnalyzing(false);
    };

    const handleMoveChange = (idx: number) => {
        if (idx < -1 || idx >= history.length) return;

        setCurrentMoveIndex(idx);

        if (idx === -1) {
            setFen(new Chess().fen());
            return;
        }

        // Fast forward to exactly the fen needed
        const temp = new Chess();
        for (let i = 0; i <= idx; i++) {
            temp.move(history[i]);
        }
        setFen(temp.fen());
    };


    if (error && history.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4 bg-background">
                <h2 className="text-2xl font-bold text-destructive">Error Loading Game</h2>
                <p className="text-muted-foreground">{error}</p>
                <Link href="/" className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity">
                    Back to Home
                </Link>
            </div>
        );
    }

    // Determine current evaluation
    // If we're at start pos, eval is roughly 0.2
    const currentEvalScore = currentMoveIndex === -1 ? 0.2 : (analyzedMoves[currentMoveIndex]?.evalScore || 0);
    const currentAnalysis = currentMoveIndex !== -1 ? analyzedMoves[currentMoveIndex] : null;

    // Eval Bar calc
    // If mate (+10 / -10 mapping)
    let displayEval = currentEvalScore > 0 ? `+${currentEvalScore.toFixed(2)}` : currentEvalScore.toFixed(2);
    if (currentEvalScore === 10) displayEval = "M+";
    if (currentEvalScore === -10) displayEval = "M-";

    const whiteAdvantagePercentage = Math.max(0, Math.min(100, 50 + (currentEvalScore * 5)));

    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground animate-in fade-in duration-500">
            {/* Header */}
            <header className="w-full p-4 border-b bg-card flex justify-between items-center z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push("/")} className="hover:bg-accent p-2 rounded-full transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="font-bold text-xl flex items-center gap-2 tracking-tight">
                        ♟️ Reviewer
                    </div>
                </div>
                <ThemeToggle />
            </header>

            {/* Main Analysis Container */}
            <main className="flex-1 max-w-[1400px] w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 h-full">

                {/* Left Col: Evaluation Bar + Board */}
                <div className="lg:col-span-8 flex flex-col md:flex-row gap-4 lg:gap-8 h-full items-start justify-center">

                    {/* Evaluation Bar */}
                    <div className="hidden md:flex flex-col w-8 h-full min-h-[400px] max-h-[600px] rounded-lg overflow-hidden border border-border bg-neutral-800 relative shadow-inner">
                        <div
                            className="absolute bottom-0 w-full bg-slate-100 transition-all duration-500 ease-in-out"
                            style={{ height: `${whiteAdvantagePercentage}%` }}
                        />
                        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-1 py-0.5 text-[10px] font-bold rounded z-10 ${currentEvalScore >= 0 ? "text-neutral-900 bg-white/70" : "text-white bg-black/70"}`}>
                            {displayEval}
                        </div>
                    </div>

                    {/* Board Container */}
                    <div className="flex-col max-w-[600px] w-full mx-auto md:mx-0 space-y-4">

                        {/* Player Top (Black if board is normal) */}
                        <div className="flex items-center justify-between font-semibold px-2">
                            <span>{blackPlayer}</span>
                            <span className="text-muted-foreground text-sm bg-accent px-2 py-1 rounded">Black</span>
                        </div>

                        <div className="w-full aspect-square shadow-2xl rounded-sm overflow-hidden border border-border relative">
                            {loadingMsg && (
                                <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center z-50">
                                    <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                                    <p className="font-medium animate-pulse">{loadingMsg}</p>
                                </div>
                            )}
                            <ReactChessboard
                                options={{
                                    position: fen,
                                    boardOrientation: "white",
                                    darkSquareStyle: { backgroundColor: "#769656" },
                                    lightSquareStyle: { backgroundColor: "#eeeed2" },
                                    allowDragging: false,
                                    animationDurationInMs: 200,
                                }}
                            />
                        </div>

                        {/* Player Bottom */}
                        <div className="flex items-center justify-between font-semibold px-2">
                            <span>{whitePlayer}</span>
                            <span className="text-muted-foreground text-sm bg-accent px-2 py-1 rounded">White</span>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center justify-center gap-2 p-3 bg-card border rounded-xl shadow-sm">
                            <button
                                onClick={() => handleMoveChange(-1)}
                                disabled={currentMoveIndex === -1}
                                className="p-2 hover:bg-accent rounded-lg disabled:opacity-50 transition-colors"
                            >
                                <Rewind className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => handleMoveChange(currentMoveIndex - 1)}
                                disabled={currentMoveIndex === -1}
                                className="p-2 hover:bg-accent rounded-lg disabled:opacity-50 transition-colors"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <button
                                onClick={() => handleMoveChange(currentMoveIndex + 1)}
                                disabled={currentMoveIndex === history.length - 1}
                                className="p-2 hover:bg-accent rounded-lg disabled:opacity-50 transition-colors"
                            >
                                <ChevronRight className="w-6 h-6" />
                            </button>
                            <button
                                onClick={() => handleMoveChange(history.length - 1)}
                                disabled={currentMoveIndex === history.length - 1}
                                className="p-2 hover:bg-accent rounded-lg disabled:opacity-50 transition-colors"
                            >
                                <FastForward className="w-5 h-5" />
                            </button>
                        </div>

                    </div>
                </div>

                {/* Right Col: Details & Move List */}
                <div className="lg:col-span-4 flex flex-col gap-4 h-full max-h-[85vh]">

                    {/* Analysis Info Panel */}
                    <div className="bg-card border shadow-sm rounded-xl p-5 flex flex-col gap-3 shrink-0">
                        <div className="flex justify-between items-center border-b pb-2">
                            <h2 className="text-lg font-bold">Analysis</h2>
                            {analyzing ? (
                                <div className="flex items-center gap-2 text-sm text-primary font-medium bg-primary/10 px-3 py-1 rounded-full">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {analysisProgress}% Analyzing
                                </div>
                            ) : (
                                <span className="text-xs bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-1 rounded font-bold uppercase tracking-wider">
                                    Complete
                                </span>
                            )}
                        </div>

                        <div className="min-h-[80px] flex flex-col justify-center">
                            {currentMoveIndex === -1 ? (
                                <p className="text-muted-foreground text-center">Starting Position</p>
                            ) : currentAnalysis ? (
                                <div className="space-y-2 animate-in slide-in-from-right-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Played:</span>
                                        <span className="font-bold text-lg">{currentAnalysis.moveSan}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Classification:</span>
                                        <span className={`text-sm uppercase tracking-wider ${getClassificationColor(currentAnalysis.classification)}`}>
                                            {currentAnalysis.classification}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center bg-accent/50 p-2 rounded mt-2">
                                        <span className="text-xs text-muted-foreground font-medium">Engine Best Suggestion:</span>
                                        <span className="font-mono font-bold text-sm bg-background px-2 py-0.5 rounded border">{currentAnalysis.bestMove || "-"}</span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-muted-foreground text-center animate-pulse">Waiting for engine...</p>
                            )}
                        </div>
                    </div>

                    {/* Move List Box */}
                    <div className="flex-1 bg-card border shadow-sm rounded-xl flex flex-col overflow-hidden min-h-[300px]">
                        <div className="p-4 border-b bg-muted/30 font-semibold sticky top-0 z-10 flex justify-between">
                            <span>Moves</span>
                            <span className="text-xs text-muted-foreground font-normal">History</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-sm">
                            {history.length === 0 ? (
                                <p className="text-muted-foreground text-center pt-8">No moves available.</p>
                            ) : (
                                <div className="grid grid-cols-[30px_1fr_1fr] gap-x-2 gap-y-1 p-2 items-center">
                                    {/* Group moves into pairs (White / Black) */}
                                    {Array.from({ length: Math.ceil(history.length / 2) }).map((_, rowIndex) => {
                                        const whiteIdx = rowIndex * 2;
                                        const blackIdx = whiteIdx + 1;

                                        const whiteAnalysis = analyzedMoves[whiteIdx];
                                        const blackAnalysis = analyzedMoves[blackIdx];

                                        return (
                                            <div key={rowIndex} className="contents group">
                                                <div className="text-right text-muted-foreground text-xs font-sans pr-2 select-none">
                                                    {rowIndex + 1}.
                                                </div>

                                                {/* White Move */}
                                                <div
                                                    className={`px-3 py-1.5 rounded cursor-pointer transition-colors flex justify-between items-center
                            ${currentMoveIndex === whiteIdx ? 'bg-primary text-primary-foreground font-bold shadow-md' : 'hover:bg-accent'}`}
                                                    onClick={() => handleMoveChange(whiteIdx)}
                                                >
                                                    <span>{history[whiteIdx]}</span>
                                                    {whiteAnalysis && (
                                                        <span className={`text-[10px] ml-2 ${currentMoveIndex === whiteIdx ? 'text-primary-foreground/80' : getClassificationColor(whiteAnalysis.classification)}`}>
                                                            {whiteAnalysis.classification === "Best" ? "★" :
                                                                whiteAnalysis.classification === "Blunder" ? "??" :
                                                                    whiteAnalysis.classification === "Mistake" ? "?" : ""}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Black Move */}
                                                {history[blackIdx] ? (
                                                    <div
                                                        className={`px-3 py-1.5 rounded cursor-pointer transition-colors flex justify-between items-center
                              ${currentMoveIndex === blackIdx ? 'bg-primary text-primary-foreground font-bold shadow-md' : 'hover:bg-accent'}`}
                                                        onClick={() => handleMoveChange(blackIdx)}
                                                    >
                                                        <span>{history[blackIdx]}</span>
                                                        {blackAnalysis && (
                                                            <span className={`text-[10px] ml-2 ${currentMoveIndex === blackIdx ? 'text-primary-foreground/80' : getClassificationColor(blackAnalysis.classification)}`}>
                                                                {blackAnalysis.classification === "Best" ? "★" :
                                                                    blackAnalysis.classification === "Blunder" ? "??" :
                                                                        blackAnalysis.classification === "Mistake" ? "?" : ""}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : <div />}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
}
