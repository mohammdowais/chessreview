"use client";

export const GUEST_LIMIT = 10;
export const STORAGE_COUNT_KEY = "gamesAnalyzed";
export const STORAGE_TOKEN_KEY = "guestToken";
export const STORAGE_RESET_KEY = "quotaResetTime";

export function getOrCreateGuestToken(): string {
    if (typeof window === "undefined") return "";
    const existing = localStorage.getItem(STORAGE_TOKEN_KEY);
    if (existing) return existing;

    const uuid = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    localStorage.setItem(STORAGE_TOKEN_KEY, uuid);
    return uuid;
}

export function getGuestCount(): number {
    if (typeof window === "undefined") return 0;

    const resetTime = localStorage.getItem(STORAGE_RESET_KEY);
    if (resetTime && Date.now() > parseInt(resetTime, 10)) {
        localStorage.setItem(STORAGE_COUNT_KEY, "0");
        localStorage.removeItem(STORAGE_RESET_KEY);
        return 0;
    }

    return parseInt(localStorage.getItem(STORAGE_COUNT_KEY) || "0", 10);
}

export function incrementGuestCount() {
    if (typeof window === "undefined") return;

    const count = getGuestCount();
    if (count === 0) {
        // First analysis of the period, set reset time to 24 hours from now
        localStorage.setItem(STORAGE_RESET_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    }

    localStorage.setItem(STORAGE_COUNT_KEY, String(count + 1));
}

export function isGuestLimitReached(): boolean {
    return getGuestCount() >= GUEST_LIMIT;
}
