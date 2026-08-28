import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './db';

// Social OAuth — only enabled when credentials are present.
const githubConfigured = !!(
  process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
);
const googleConfigured = !!(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

const socialProviders: Record<string, unknown> = {};

if (githubConfigured) {
  socialProviders.github = {
    clientId: process.env.GITHUB_CLIENT_ID as string,
    clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    scope: ['repo', 'read:user'],
  };
}

if (googleConfigured) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID as string,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
  };
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  socialProviders: Object.keys(socialProviders).length > 0 ? socialProviders : undefined,
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['github', 'google'],
      allowDifferentEmails: true,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  user: {
    additionalFields: {
      plan: { type: 'string', defaultValue: 'free' },
      planExpiresAt: { type: 'date', required: false },
      waMode: { type: 'string', defaultValue: 'shared' },
      isOwner: { type: 'boolean', defaultValue: false },
    },
  },
});

export const isGithubOAuthEnabled = githubConfigured;

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
