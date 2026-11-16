CREATE TABLE "progress" (
	"player_login" text NOT NULL,
	"level_id" text NOT NULL,
	"proof" text NOT NULL,
	"stamped_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "progress_player_login_level_id_pk" PRIMARY KEY("player_login","level_id")
);
--> statement-breakpoint
CREATE TABLE "tutorial_events" (
	"player_login" text NOT NULL,
	"event" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tutorial_events_player_login_event_pk" PRIMARY KEY("player_login","event")
);
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "practice_repo" text;