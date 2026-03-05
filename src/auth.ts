import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

type CredUser = { username: string; password: string };

function getUsers(): CredUser[] {
    try {
        return JSON.parse(process.env.CREDENTIALS_USERS || "[]");
    } catch {
        return [];
    }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        Credentials({
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                const { username, password } = credentials as { username: string; password: string };
                if (!username || !password) return null;

                const users = getUsers();
                const user = users.find(
                    (u) => u.username === username && u.password === password
                );
                if (!user) return null;

                return { id: username, name: username, email: `${username}@local` };
            },
        }),
    ],
    session: { strategy: "jwt" },
    pages: {
        signIn: "/", // Stay on home page, we use a modal
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) token.username = user.name;
            return token;
        },
        async session({ session, token }) {
            if (token.username) session.user.name = token.username as string;
            return session;
        },
    },
});
