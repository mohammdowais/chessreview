"use client";

export const GUEST_LIMIT = 3;
export const STORAGE_COUNT_KEY = "gamesAnalyzed";
export const STORAGE_TOKEN_KEY = "guestToken";

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
    return parseInt(localStorage.getItem(STORAGE_COUNT_KEY) || "0", 10);
}

export function incrementGuestCount() {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_COUNT_KEY, String(getGuestCount() + 1));
}

export function isGuestLimitReached(): boolean {
    return getGuestCount() >= GUEST_LIMIT;
}
