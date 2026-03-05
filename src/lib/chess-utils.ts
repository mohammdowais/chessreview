export type MoveClassification = "Brilliant" | "Great" | "Best" | "Book" | "Excellent" | "Good" | "Inaccuracy" | "Mistake" | "Blunder" | "None";

export function getMoveClassification(
    prevEval: number,
    currentEval: number,
    playedMove: string,
    bestMove: string,
    isWhite: boolean
): { classification: MoveClassification; diff: number } {
    // Both evals here are absolute (positive = white advantage)
    // Let's compute the difference relative to the player who just moved

    let diff = 0;
    if (isWhite) {
        // White played. If white made a bad move, currentEval is LOWER than prevEval.
        // So diff = prevEval - currentEval. Positive diff means evaluation dropped (bad).
        diff = prevEval - currentEval;
    } else {
        // Black played. If black made a bad move, currentEval is HIGHER than prevEval.
        diff = currentEval - prevEval;
    }

    // Handle mate scores (+10 / -10 mapping simplify extreme drops)
    // If bestMove === playedMove (basic string match, or close), we could reward "Best" directly
    // Often engines output uci (e.g. e2e4), while playedMove might be sanity checked. We will just use diff for now.

    if (diff <= 0.05) return { classification: "Best", diff };
    if (diff <= 0.20) return { classification: "Excellent", diff };
    if (diff <= 0.50) return { classification: "Good", diff };
    if (diff <= 1.00) return { classification: "Inaccuracy", diff };
    if (diff <= 2.00) return { classification: "Mistake", diff };

    return { classification: "Blunder", diff };
}

export function getClassificationColor(classification: MoveClassification): string {
    switch (classification) {
        case "Brilliant": return "text-teal-400 font-bold";
        case "Great": return "text-blue-500 font-bold";
        case "Best": return "text-green-500 font-bold";
        case "Book": return "text-violet-500";
        case "Excellent": return "text-green-400";
        case "Good": return "text-green-300";
        case "Inaccuracy": return "text-yellow-500";
        case "Mistake": return "text-orange-500 font-bold";
        case "Blunder": return "text-red-500 font-extrabold";
        default: return "text-muted-foreground";
    }
}
