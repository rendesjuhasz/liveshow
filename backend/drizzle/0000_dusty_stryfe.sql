CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"verification_code" varchar(255),
	"email_verified" boolean DEFAULT false,
	"role" varchar(50) DEFAULT 'user',
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
