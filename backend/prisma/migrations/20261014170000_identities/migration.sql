-- CreateTable
CREATE TABLE "player_identities" (
    "provider" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "player_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_identities_pkey" PRIMARY KEY ("provider","subject")
);

-- CreateIndex
CREATE UNIQUE INDEX "player_identities_player_id_provider_key" ON "player_identities"("player_id", "provider");

-- AddForeignKey
ALTER TABLE "player_identities" ADD CONSTRAINT "player_identities_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

