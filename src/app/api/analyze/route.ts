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
type GuestEntry = { count: number; resetAt: number };
const guestTokenMap = new Map<string, GuestEntry>();

export async function POST(req: Request) {
    try {
        const ip = getIp(req);

        // Rate limit: 10/min (everyone is now a guest)
        const rl = checkRateLimit(ip, 10);
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Too many requests. Please slow down.' },
                {
                    status: 429,
                    headers: { 'Retry-After': String(rl.retryAfter) },
                }
            );
        }

        // Guest-token gate (server-side defence for the 10-game limit)
        const guestToken = req.headers.get('x-guest-token');
        if (!guestToken) {
            return NextResponse.json(
                { error: 'bad_request', message: 'Guest token is required.' },
                { status: 400 }
            );
        }

        const now = Date.now();
        let entry = guestTokenMap.get(guestToken);

        // Reset count if 24 hours have passed
        if (entry && now > entry.resetAt) {
            entry = undefined;
        }

        if (!entry) {
            entry = { count: 0, resetAt: now + 24 * 60 * 60 * 1000 };
            guestTokenMap.set(guestToken, entry);
        }

        if (entry.count >= 10) {
            return NextResponse.json(
                { error: 'limit_reached', message: 'Analysis limit reached for today. Try again in 24 hours.' },
                { status: 403 }
            );
        }

        entry.count++;

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
