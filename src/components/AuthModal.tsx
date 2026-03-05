"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Loader2, X, LogIn, ShieldAlert } from "lucide-react";

type Props = {
    onClose: () => void;
    onSuccess: () => void;
};

export function AuthModal({ onClose, onSuccess }: Props) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!username.trim() || !password) return;
        setLoading(true);
        setError("");

        const result = await signIn("credentials", {
            username: username.trim(),
            password,
            redirect: false,
        });

        setLoading(false);
        if (result?.ok) {
            onSuccess();
        } else {
            setError("Invalid username or password.");
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in-95 duration-200">
                {/* Close */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Header */}
                <div className="flex flex-col items-center gap-3 mb-8 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <ShieldAlert className="w-7 h-7 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">You&apos;ve used your 3 free analyses</h2>
                        <p className="text-muted-foreground text-sm mt-1">
                            Sign in to get unlimited game analysis.
                        </p>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-foreground">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
                            className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                            autoFocus
                            autoComplete="username"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-foreground">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                            autoComplete="current-password"
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-destructive font-medium animate-in fade-in">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !username.trim() || !password}
                        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition mt-2"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <LogIn className="w-4 h-4" />
                        )}
                        {loading ? "Signing in…" : "Sign In"}
                    </button>
                </form>
            </div>
        </div>
    );
}
