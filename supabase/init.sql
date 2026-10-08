-- Initial schema for a new Supabase project. Run in the SQL Editor.
-- Existing tables are preserved; future schema changes require migrations.
CREATE TABLE IF NOT EXISTS "user" ("id" text PRIMARY KEY NOT NULL, "name" text NOT NULL, "email" text NOT NULL UNIQUE, "emailVerified" boolean NOT NULL, "image" text, "createdAt" timestamp NOT NULL, "updatedAt" timestamp NOT NULL);
CREATE TABLE IF NOT EXISTS "session" ("id" text PRIMARY KEY NOT NULL, "expiresAt" timestamp NOT NULL, "token" text NOT NULL UNIQUE, "createdAt" timestamp NOT NULL, "updatedAt" timestamp NOT NULL, "ipAddress" text, "userAgent" text, "userId" text NOT NULL);
CREATE TABLE IF NOT EXISTS "account" ("id" text PRIMARY KEY NOT NULL, "accountId" text NOT NULL, "providerId" text NOT NULL, "userId" text NOT NULL, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamp, "refreshTokenExpiresAt" timestamp, "scope" text, "password" text, "createdAt" timestamp NOT NULL, "updatedAt" timestamp NOT NULL);
CREATE TABLE IF NOT EXISTS "verification" ("id" text PRIMARY KEY NOT NULL, "identifier" text NOT NULL, "value" text NOT NULL, "expiresAt" timestamp NOT NULL, "createdAt" timestamp, "updatedAt" timestamp);
CREATE TABLE IF NOT EXISTS "challenge" ("id" text PRIMARY KEY NOT NULL, "ownerId" text NOT NULL, "name" text NOT NULL, "goalType" text NOT NULL, "goalValue" numeric, "startDate" date NOT NULL, "endDate" date NOT NULL, "joinCode" text NOT NULL UNIQUE, "description" text, "profilePathname" text, "coverPathname" text, "createdAt" timestamp NOT NULL);
CREATE TABLE IF NOT EXISTS "challenge_member" ("id" text PRIMARY KEY NOT NULL, "challengeId" text NOT NULL, "userId" text NOT NULL, "joinedAt" timestamp NOT NULL, UNIQUE ("challengeId", "userId"));
CREATE TABLE IF NOT EXISTS "cardio_record" ("id" text PRIMARY KEY NOT NULL, "challengeId" text, "userId" text NOT NULL, "recordDate" date NOT NULL, "submissionKey" text, "minutes" integer NOT NULL, "kilometers" numeric NOT NULL, "pace" numeric, "activityType" text NOT NULL, "proofPathname" text NOT NULL, "description" text, "createdAt" timestamp NOT NULL, UNIQUE ("userId", "submissionKey"));

-- Block anonymous Data API access. The server uses the PostgreSQL connection
-- and the server-only storage key; no public access policies are created.
ALTER TABLE public."user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."verification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."challenge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."challenge_member" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."cardio_record" ENABLE ROW LEVEL SECURITY;
