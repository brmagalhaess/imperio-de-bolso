-- CreateTable
CREATE TABLE "player_reports" (
    "reporter_id" UUID NOT NULL,
    "reported_id" UUID NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'name',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(3),

    CONSTRAINT "player_reports_pkey" PRIMARY KEY ("reporter_id","reported_id")
);

-- CreateIndex
CREATE INDEX "player_reports_reported_id_idx" ON "player_reports"("reported_id");

-- AddForeignKey
ALTER TABLE "player_reports" ADD CONSTRAINT "player_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_reports" ADD CONSTRAINT "player_reports_reported_id_fkey" FOREIGN KEY ("reported_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
