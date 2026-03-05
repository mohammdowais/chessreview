"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Chess } from "chess.js";
import dynamic from "next/dynamic";
import { Loader2, ArrowLeft, ChevronLeft, ChevronRight, FastForward, Rewind } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { isGuestLimitReached } from "@/lib/guest-utils";
import { ChessEngine } from "@/lib/engine";
import { getMoveClassification, getClassificationColor, MoveClassification } from "@/lib/chess-utils";

type SquareHandlerArgs = { piece: { pieceType: string } | null; square: string };
type BadgeConfig = { symbol: string; bg: string; text: string; ring: string };

function getClassificationBadge(c: MoveClassification): BadgeConfig | null {
    switch (c) {
        case "Brilliant": return { symbol: "!!", bg: "#21c0c0", text: "#fff", ring: "#17a3a3" };
        case "Great": return { symbol: "!", bg: "#5c99e0", text: "#fff", ring: "#3d7dc8" };
        case "Best": return { symbol: "★", bg: "#5db55d", text: "#fff", ring: "#3d9a3d" };
        case "Excellent": return { symbol: "!", bg: "#96c46a", text: "#fff", ring: "#7aaa4a" };
        case "Good": return { symbol: "✓", bg: "#96c46a", text: "#fff", ring: "#7aaa4a" };
        case "Book": return { symbol: "Ꞵ", bg: "#a88a5e", text: "#fff", ring: "#8a6e46" };
        case "Inaccuracy": return { symbol: "?!", bg: "#f0c040", text: "#333", ring: "#d4a820" };
        case "Mistake": return { symbol: "?", bg: "#e07020", text: "#fff", ring: "#c05010" };
        case "Blunder": return { symbol: "??", bg: "#c0392b", text: "#fff", ring: "#922b21" };
        default: return null;
    }
}

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
type CustomSquareProps = {
  square: string;
  children?: React.ReactNode;
};
export default function PgnReviewPage() {
    const router = useRouter();

    const [loadingMsg, setLoadingMsg] = useState("Loading PGN...");
    const [error, setError] = useState("");

    const [whitePlayer, setWhitePlayer] = useState("White");
    const [blackPlayer, setBlackPlayer] = useState("Black");

    const [game] = useState<Chess>(new Chess());
    const [fen, setFen] = useState(game.fen());
    const [history, setHistory] = useState<string[]>([]);
    const [historyUci, setHistoryUci] = useState<string[]>([]);
    const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);

    const [analyzing, setAnalyzing] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState(0);
    const [analyzedMoves, setAnalyzedMoves] = useState<MoveAnalysis[]>([]);

    const engineRef = useRef<ChessEngine | null>(null);

    useEffect(() => {
        if (isGuestLimitReached()) {
            setError("Analysis limit reached for today. Please try again in 24 hours.");
            return;
        }

        const pgn = sessionStorage.getItem("pendingPgn");
        if (!pgn) {
            setError("No PGN found. Please go back and paste a PGN.");
            setLoadingMsg("");
            return;
        }

        try {
            game.loadPgn(pgn);

            // Extract player names from PGN headers
            const headers = game.header();
            setWhitePlayer(headers["White"] || "White");
            setBlackPlayer(headers["Black"] || "Black");

            const moveHistorySan = game.history();
            setHistory(moveHistorySan);

            const tempGame = new Chess();
            const moveHistoryUci = moveHistorySan.map(m => {
                const moveObj = tempGame.move(m);
                return moveObj.from + moveObj.to + (moveObj.promotion || "");
            });
            setHistoryUci(moveHistoryUci);

            setFen(game.fen());
            setCurrentMoveIndex(moveHistorySan.length - 1);

            setLoadingMsg("");
            startAnalysis(moveHistorySan, moveHistoryUci);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to parse PGN";
            setError(msg);
            setLoadingMsg("");
        }

        return () => { engineRef.current?.destroy(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const startAnalysis = async (movesSan: string[], movesUci: string[]) => {
        setAnalyzing(true);
        setAnalysisProgress(0);
        engineRef.current = new ChessEngine();
        const tempGame = new Chess();
        const results: MoveAnalysis[] = [];
        let prevEval = 0.2;

        for (let i = 0; i < movesSan.length; i++) {
            setAnalysisProgress(Math.round(((i + 1) / movesSan.length) * 100));
            tempGame.move(movesSan[i]);
            const currentFen = tempGame.fen();
            try {
                const { evalScore, bestMove } = await engineRef.current.getEvaluation(currentFen, 12);
                const isWhiteMove = i % 2 === 0;
                const { classification } = getMoveClassification(prevEval, evalScore, movesUci[i], bestMove, isWhiteMove);
                results.push({ fen: currentFen, moveSan: movesSan[i], playedMoveUci: movesUci[i], evalScore, bestMove, classification });
                prevEval = evalScore;
                setAnalyzedMoves([...results]);
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
        if (idx === -1) { setFen(new Chess().fen()); return; }
        const temp = new Chess();
        for (let i = 0; i <= idx; i++) temp.move(history[i]);
        setFen(temp.fen());
    };

    if (error && history.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4 bg-background">
                <h2 className="text-2xl font-bold text-destructive">Error Loading PGN</h2>
                <p className="text-muted-foreground">{error}</p>
                <Link href="/" className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity">
                    Back to Home
                </Link>
            </div>
        );
    }

    const currentEvalScore = currentMoveIndex === -1 ? 0.2 : (analyzedMoves[currentMoveIndex]?.evalScore || 0);
    const currentAnalysis = currentMoveIndex !== -1 ? analyzedMoves[currentMoveIndex] : null;
    let displayEval = currentEvalScore > 0 ? `+${currentEvalScore.toFixed(2)}` : currentEvalScore.toFixed(2);
    if (currentEvalScore === 10) displayEval = "M+";
    if (currentEvalScore === -10) displayEval = "M-";
    const whiteAdvantagePercentage = Math.max(0, Math.min(100, 50 + (currentEvalScore * 5)));

    const currentDestSquare = currentMoveIndex >= 0 && historyUci[currentMoveIndex]
        ? historyUci[currentMoveIndex].slice(2, 4) : null;
    const currentClassification = currentMoveIndex >= 0 ? analyzedMoves[currentMoveIndex]?.classification : null;
    const currentBadge = currentClassification ? getClassificationBadge(currentClassification) : null;

    const squareRenderer = ({ square, children }: CustomSquareProps) => (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
            {children}

            {currentBadge && square === currentDestSquare && (
            <div
                style={{
                position: "absolute",
                top: "2px",
                right: "2px",
                width: "28%",
                height: "28%",
                minWidth: 14,
                minHeight: 14,
                borderRadius: "50%",
                backgroundColor: currentBadge.bg,
                border: `2px solid ${currentBadge.ring}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 20,
                boxShadow: "0 1px 4px rgba(0,0,0,0.45)",
                pointerEvents: "none",
                }}
            >
                <span
                style={{
                    color: currentBadge.text,
                    fontSize: "clamp(6px, 1.5vw, 11px)",
                    fontWeight: 900,
                    lineHeight: 1,
                    fontFamily: "serif",
                    letterSpacing: "-0.5px",
                    userSelect: "none",
                }}
                >
                {currentBadge.symbol}
                </span>
            </div>
            )}
        </div>
        );

    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground animate-in fade-in duration-500">
            <header className="w-full p-4 border-b bg-card flex justify-between items-center z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push("/")} className="hover:bg-accent p-2 rounded-full transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="font-bold text-xl flex items-center gap-2 tracking-tight">
                        Reviewer <span className="text-xs font-normal text-muted-foreground bg-accent px-2 py-0.5 rounded-full">PGN</span>
                    </div>
                </div>
                <ThemeToggle />
            </header>

            <main className="flex-1 max-w-[1400px] w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 h-full">
                <div className="lg:col-span-8 flex flex-col md:flex-row gap-4 lg:gap-8 h-full items-start justify-center">
                    {/* Eval Bar */}
                    <div className="hidden md:flex flex-col w-8 h-full min-h-[400px] max-h-[600px] rounded-lg overflow-hidden border border-border bg-neutral-800 relative shadow-inner">
                        <div className="absolute bottom-0 w-full bg-slate-100 transition-all duration-500 ease-in-out" style={{ height: `${whiteAdvantagePercentage}%` }} />
                        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-1 py-0.5 text-[10px] font-bold rounded z-10 ${currentEvalScore >= 0 ? "text-neutral-900 bg-white/70" : "text-white bg-black/70"}`}>
                            {displayEval}
                        </div>
                    </div>

                    <div className="flex-col max-w-[600px] w-full mx-auto md:mx-0 space-y-4">
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
                                position={fen}
                                boardOrientation="white"
                                customDarkSquareStyle={{ backgroundColor: "#769656" }}
                                customLightSquareStyle={{ backgroundColor: "#eeeed2" }}
                                arePiecesDraggable={false}
                                animationDuration={200}
                                customSquare={squareRenderer}
                                />
                        </div>

                        <div className="flex items-center justify-between font-semibold px-2">
                            <span>{whitePlayer}</span>
                            <span className="text-muted-foreground text-sm bg-accent px-2 py-1 rounded">White</span>
                        </div>

                        <div className="flex items-center justify-center gap-2 p-3 bg-card border rounded-xl shadow-sm">
                            <button onClick={() => handleMoveChange(-1)} disabled={currentMoveIndex === -1} className="p-2 hover:bg-accent rounded-lg disabled:opacity-50 transition-colors"><Rewind className="w-5 h-5" /></button>
                            <button onClick={() => handleMoveChange(currentMoveIndex - 1)} disabled={currentMoveIndex === -1} className="p-2 hover:bg-accent rounded-lg disabled:opacity-50 transition-colors"><ChevronLeft className="w-6 h-6" /></button>
                            <button onClick={() => handleMoveChange(currentMoveIndex + 1)} disabled={currentMoveIndex === history.length - 1} className="p-2 hover:bg-accent rounded-lg disabled:opacity-50 transition-colors"><ChevronRight className="w-6 h-6" /></button>
                            <button onClick={() => handleMoveChange(history.length - 1)} disabled={currentMoveIndex === history.length - 1} className="p-2 hover:bg-accent rounded-lg disabled:opacity-50 transition-colors"><FastForward className="w-5 h-5" /></button>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 flex flex-col gap-4 h-full max-h-[85vh]">
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
                                    {Array.from({ length: Math.ceil(history.length / 2) }).map((_, rowIndex) => {
                                        const wIdx = rowIndex * 2;
                                        const bIdx = wIdx + 1;
                                        const wA = analyzedMoves[wIdx];
                                        const bA = analyzedMoves[bIdx];
                                        return (
                                            <div key={rowIndex} className="contents">
                                                <div className="text-right text-muted-foreground text-xs font-sans pr-2 select-none">{rowIndex + 1}.</div>
                                                <div className={`px-3 py-1.5 rounded cursor-pointer transition-colors flex justify-between items-center ${currentMoveIndex === wIdx ? 'bg-primary text-primary-foreground font-bold shadow-md' : 'hover:bg-accent'}`} onClick={() => handleMoveChange(wIdx)}>
                                                    <span>{history[wIdx]}</span>
                                                    {wA && <span className={`text-[10px] ml-2 ${currentMoveIndex === wIdx ? 'text-primary-foreground/80' : getClassificationColor(wA.classification)}`}>{wA.classification === "Best" ? "★" : wA.classification === "Blunder" ? "??" : wA.classification === "Mistake" ? "?" : ""}</span>}
                                                </div>
                                                {history[bIdx] ? (
                                                    <div className={`px-3 py-1.5 rounded cursor-pointer transition-colors flex justify-between items-center ${currentMoveIndex === bIdx ? 'bg-primary text-primary-foreground font-bold shadow-md' : 'hover:bg-accent'}`} onClick={() => handleMoveChange(bIdx)}>
                                                        <span>{history[bIdx]}</span>
                                                        {bA && <span className={`text-[10px] ml-2 ${currentMoveIndex === bIdx ? 'text-primary-foreground/80' : getClassificationColor(bA.classification)}`}>{bA.classification === "Best" ? "★" : bA.classification === "Blunder" ? "??" : bA.classification === "Mistake" ? "?" : ""}</span>}
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
