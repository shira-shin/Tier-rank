import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const allowedEmails = (process.env.ALLOW_EMAILS ?? "").split(",").map(s=>s.trim()).filter(Boolean);
const allowedDomains = (process.env.ALLOW_DOMAINS ?? "").split(",").map(s=>s.trim()).filter(Boolean);

export const authOptions: NextAuthOptions = {
  providers: [GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!
  })],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      const email = user?.email ?? "";
      const domain = email.split("@")[1] ?? "";
      if (allowedEmails.includes(email)) return true;
      if (allowedDomains.length && allowedDomains.includes(domain)) return true;
      return false;
    }
  }
};
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
