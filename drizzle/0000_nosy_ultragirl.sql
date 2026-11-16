CREATE TABLE "action_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_login" text NOT NULL,
	"gesture" text NOT NULL,
	"target" text NOT NULL,
	"payload" jsonb NOT NULL,
	"result" text NOT NULL,
	"github_response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"github_login" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_github_login_unique" UNIQUE("github_login")
);
