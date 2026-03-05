import { NextResponse } from 'next/server';
import { auth } from '@/auth';

// ----- In-Memory Rate Limiter -----
type RateEntry = { count: number; resetAt: number };
const rateLimitMap = new Map<string, RateEntry>();

function getIp(req: Request): string {
    const xff = req.headers.get('x-forwarded-for');
    return xff ? xff.split(',')[0].trim() : 'unknown';
}

function checkRateLimit(ip: string, maxPerMin: number): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
        return { allowed: true };
    }
    if (entry.count >= maxPerMin) {
        return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
    }
    entry.count++;
    return { allowed: true };
}

// ----- In-Memory Guest Token Gate -----
const guestTokenMap = new Map<string, number>(); // token -> count

export async function POST(req: Request) {
    try {
        const ip = getIp(req);
        const session = await auth();
        const isAuthed = !!session?.user;

        // Rate limit: 60/min for authed, 10/min for guests
        const limit = isAuthed ? 60 : 10;
        const rl = checkRateLimit(ip, limit);
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Please slow down.' },
                {
                    status: 429,
                    headers: { 'Retry-After': String(rl.retryAfter) },
                }
            );
        }

        // Guest-token gate (server-side defence for the 3-game limit)
        if (!isAuthed) {
            const guestToken = req.headers.get('x-guest-token');
            if (!guestToken) {
                return NextResponse.json(
                    { error: 'bad_request', message: 'Guest token is required.' },
                    { status: 400 }
                );
            }
            const count = guestTokenMap.get(guestToken) ?? 0;
            if (count >= 3) {
                return NextResponse.json(
                    { error: 'limit_reached', message: 'Sign in to analyze more games.' },
                    { status: 403 }
                );
            }
            guestTokenMap.set(guestToken, count + 1);
        }

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

        const username = cbData?.players?.bottom?.username || cbData?.players?.top?.username;
        const endTime = cbData?.game?.endTime;

        if (!username || !endTime) {
            return NextResponse.json({ error: 'Unsupported game type or missing metadata' }, { status: 500 });
        }

        // Step 2: Extract YYYY and MM from endTime timestamp
        const date = new Date(endTime * 1000);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');

        // Step 3: Fetch the player's archive for that month
        const archiveUrl = `https://api.chess.com/pub/player/${username}/games/${year}/${month}`;
        const archiveRes = await fetch(archiveUrl, {
            headers: { 'User-Agent': 'Chess Game Reviewer' }
        });

        if (!archiveRes.ok) {
            return NextResponse.json({ error: 'Failed to fetch player archive' }, { status: archiveRes.status });
        }

        const archiveData = await archiveRes.json();
        const games = archiveData.games || [];

        const targetGame = games.find((g: { url?: string }) => g.url && g.url.includes(gameId));

        if (!targetGame) {
            return NextResponse.json({ error: 'Game not found in player archive' }, { status: 404 });
        }

        return NextResponse.json({
            pgn: targetGame.pgn,
            white: targetGame.white,
            black: targetGame.black,
            timeClass: targetGame.time_class
        });

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'An error occurred during analysis.';
        console.error('Analysis Error:', error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
