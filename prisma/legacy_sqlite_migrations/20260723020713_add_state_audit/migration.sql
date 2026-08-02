-- CreateTable
CREATE TABLE "pdv_comanda_state" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "snapshot" JSONB NOT NULL,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "pdv_comanda_audit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "action" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "event" JSONB NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
