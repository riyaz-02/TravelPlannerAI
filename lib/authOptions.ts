import { AuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt:        'consent',
          access_type:   'offline',
          response_type: 'code',
        },
      },
    }),
  ],
  session: { strategy: 'jwt' },
  debug: process.env.NODE_ENV === 'development',

  callbacks: {
    /* ── Create user record on first sign-in ────────────────────────────── */
    async signIn({ user }) {
      try {
        await dbConnect();
        await User.findOneAndUpdate(
          { email: user.email },
          { $setOnInsert: { name: user.name, email: user.email, image: user.image } },
          { upsert: true, new: true },
        );
      } catch (error) {
        console.error('[NextAuth] signIn DB error:', error);
        // Don't block sign-in — user can still use the app
      }
      return true;
    },

    /* ── Embed userId into JWT ───────────────────────────────────────────── */
    async jwt({ token, user, account }) {
      // `user` is only present on the FIRST sign-in, not on subsequent requests.
      // We persist userId in the token so it survives across requests.
      if (user?.email || account) {
        // Fresh sign-in — look up the DB user to get their _id
        try {
          await dbConnect();
          const email  = user?.email ?? (token.email as string);
          const dbUser = await User.findOne({ email });
          if (dbUser) {
            token.userId = dbUser._id.toString();
            token.email  = email;  // keep email in token as fallback
          } else if (email) {
            // Race: user doc not yet created (signIn ran async), create it now
            const created = await User.create({
              name:  user?.name  ?? token.name,
              email,
              image: user?.image ?? token.picture,
            });
            token.userId = created._id.toString();
            token.email  = email;
          }
        } catch (error) {
          console.error('[NextAuth] jwt DB lookup error:', error);
          // Fallback: use a stable deterministic id from the sub claim
          // so saves can still happen even if DB is temporarily unreachable
          if (!token.userId && token.sub) {
            token.userId = token.sub;
          }
        }
      }
      return token;
    },

    /* ── Expose userId on the client session object ─────────────────────── */
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as { userId?: string; email?: string };
        if (token.userId) u.userId = token.userId as string;
        // Always keep email available on session.user
        if (token.email && !u.email) u.email = token.email as string;
      }
      return session;
    },
  },

  pages: {
    signIn: '/',
    error:  '/',
  },
};
