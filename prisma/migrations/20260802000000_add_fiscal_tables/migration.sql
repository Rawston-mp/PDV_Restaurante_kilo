-- ============================================
-- Migration: Add Fiscal Tables (NFC-e)
-- Date: 2026-08-02
-- Description: Cria tabelas fiscal_documents, nfce_number_control e fiscal_queue
-- ============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabela principal de documentos fiscais
CREATE TABLE "fiscal_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sale_id" VARCHAR(255) NOT NULL,
    "document_type" VARCHAR(20) NOT NULL DEFAULT 'NFCE',
    "model" VARCHAR(10) NOT NULL DEFAULT '65',
    "series" VARCHAR(10) NOT NULL,
    "number" VARCHAR(20) NOT NULL,
    "environment" VARCHAR(20) NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "access_key" VARCHAR(44) NOT NULL,
    "protocol" VARCHAR(50),
    "qr_code_url" TEXT,
    "signed_xml" TEXT,
    "authorized_xml" TEXT,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "cstat" VARCHAR(10),
    "xmotivo" TEXT,
    "last_error" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorized_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_documents_pkey" PRIMARY KEY ("id")
);

-- Índices para performance
CREATE UNIQUE INDEX "fiscal_documents_sale_id_key" ON "fiscal_documents"("sale_id");
CREATE UNIQUE INDEX "fiscal_documents_access_key_key" ON "fiscal_documents"("access_key");
CREATE INDEX "fiscal_documents_status_idx" ON "fiscal_documents"("status");
CREATE INDEX "fiscal_documents_access_key_idx" ON "fiscal_documents"("access_key");
CREATE INDEX "fiscal_documents_sale_id_idx" ON "fiscal_documents"("sale_id");

-- Tabela de controle de numeração fiscal
CREATE TABLE "nfce_number_control" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cnpj" VARCHAR(14) NOT NULL,
    "ambiente" VARCHAR(20) NOT NULL,
    "serie" VARCHAR(10) NOT NULL,
    "ultimo_numero" VARCHAR(20) NOT NULL DEFAULT '0',
    "proximo_numero" VARCHAR(20) NOT NULL DEFAULT '1',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nfce_number_control_pkey" PRIMARY KEY ("id")
);

-- Garante unicidade por CNPJ + ambiente + série
CREATE UNIQUE INDEX "nfce_number_control_cnpj_ambiente_serie_key" 
ON "nfce_number_control"("cnpj", "ambiente", "serie");

-- Tabela de fila de emissão fiscal (assíncrona)
CREATE TABLE "fiscal_queue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "sale_id" VARCHAR(255) NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "next_retry_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_queue_pkey" PRIMARY KEY ("id")
);

-- Índices da fila
CREATE UNIQUE INDEX "fiscal_queue_document_id_key" ON "fiscal_queue"("document_id");
CREATE INDEX "fiscal_queue_status_idx" ON "fiscal_queue"("status");
CREATE INDEX "fiscal_queue_document_id_idx" ON "fiscal_queue"("document_id");

-- Comentários nas tabelas
COMMENT ON TABLE "fiscal_documents" IS 'Documentos fiscais NFC-e emitidos (autorizados, rejeitados, cancelados)';
COMMENT ON TABLE "nfce_number_control" IS 'Controle de numeração fiscal por CNPJ + ambiente + série';
COMMENT ON TABLE "fiscal_queue" IS 'Fila de emissão assíncrona com retry e backoff';
