-- CreateTable
CREATE TABLE "SignalCursor" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "cursor" INTEGER NOT NULL,
    "cursorTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignalCursor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignalCursor_scope_key" ON "SignalCursor"("scope");

-- CreateIndex
CREATE INDEX "SignalCursor_source_idx" ON "SignalCursor"("source");
