import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const username = searchParams.get('username');

        if (!username) {
            return NextResponse.json({ error: 'Username is required' }, { status: 400 });
        }

        // Step 1: Get all archives
        const archivesUrl = `https://api.chess.com/pub/player/${username}/games/archives`;
        const archivesRes = await fetch(archivesUrl, {
            headers: { 'User-Agent': 'Chess Game Reviewer' }
        });

        if (!archivesRes.ok) {
            return NextResponse.json({ error: 'Player not found or API error' }, { status: archivesRes.status });
        }

        const archivesData = await archivesRes.json();
        const archives = archivesData.archives || [];

        if (archives.length === 0) {
            return NextResponse.json({ games: [] });
        }

        // Step 2: Fetch games from archives until we have at least 10
        let allGames: any[] = [];
        // Start from the most recent archive
        for (let i = archives.length - 1; i >= 0; i--) {
            const archiveRes = await fetch(archives[i], {
                headers: { 'User-Agent': 'Chess Game Reviewer' }
            });

            if (archiveRes.ok) {
                const data = await archiveRes.json();
                const monthGames = data.games || [];
                // Sort by end_time descending (latest first)
                monthGames.sort((a: any, b: any) => b.end_time - a.end_time);
                allGames = [...allGames, ...monthGames];
            }

            if (allGames.length >= 10) break;
        }

        // Step 3: Formalize the results (top 10)
        const recentGames = allGames.slice(0, 10).map(game => {
            const gameId = game.url.split('/').pop();
            return {
                url: game.url,
                gameId,
                pgn: game.pgn,
                white: game.white,
                black: game.black,
                endTime: game.end_time,
                timeClass: game.time_class,
                result: game.white.result + ' - ' + game.black.result
            };
        });

        return NextResponse.json({ games: recentGames });

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'An error occurred fetching recent games.';
        console.error('Recent Games Error:', error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
