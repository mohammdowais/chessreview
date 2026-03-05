import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { gameId } = await req.json();

        if (!gameId) {
            return NextResponse.json({ error: 'gameId is required' }, { status: 400 });
        }

        // Step 1: Use live callback to grab player info and timestamp
        const callbackUrl = `https://www.chess.com/callback/live/game/${gameId}`;
        const cbRes = await fetch(callbackUrl, {
            headers: { 'User-Agent': 'Chess Game Reviewer' }
        });

        if (!cbRes.ok) {
            return NextResponse.json({ error: 'Game not found on Chess.com' }, { status: 404 });
        }
        const cbData = await cbRes.json();

        // Some formats have players object
        const username = cbData?.players?.bottom?.username || cbData?.players?.top?.username;
        const endTime = cbData?.game?.endTime;
        // Alternatively, if it is a daily game, the structure varies.

        if (!username || !endTime) {
            return NextResponse.json({ error: 'Unsupported game type or missing metadata' }, { status: 500 });
        }

        // Step 2: Extract YYYY and MM from endTime timestamp
        const date = new Date(endTime * 1000);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');

        // Step 3: Fetch the player's archive for that month using pub API
        const archiveUrl = `https://api.chess.com/pub/player/${username}/games/${year}/${month}`;
        const archiveRes = await fetch(archiveUrl, {
            headers: { 'User-Agent': 'Chess Game Reviewer' }
        });

        if (!archiveRes.ok) {
            return NextResponse.json({ error: 'Failed to fetch player archive' }, { status: archiveRes.status });
        }

        const archiveData = await archiveRes.json();
        const games = archiveData.games || [];

        // Find our specific game by matching gameId in the URL
        const targetGame = games.find((g: any) => g.url && g.url.includes(gameId));

        if (!targetGame) {
            return NextResponse.json({ error: 'Game not found in player archive' }, { status: 404 });
        }

        // Return the clean Standard PGN from Public API!
        return NextResponse.json({
            pgn: targetGame.pgn,
            white: targetGame.white,
            black: targetGame.black,
            timeClass: targetGame.time_class
        });

    } catch (error: any) {
        console.error("Analysis Error:", error);
        return NextResponse.json(
            { error: error.message || 'An error occurred during analysis.' },
            { status: 500 }
        );
    }
}
