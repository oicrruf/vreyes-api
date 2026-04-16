-- CreateTable
CREATE TABLE "activity" (
    "cod_actividad" TEXT NOT NULL,
    "desc_actividad" TEXT NOT NULL,

    CONSTRAINT "activity_pkey" PRIMARY KEY ("cod_actividad")
);

-- CreateTable
CREATE TABLE "taxpayer" (
    "id" TEXT NOT NULL,
    "nrc" TEXT,
    "nit" TEXT,
    "nombre" TEXT NOT NULL,
    "nombre_comercial" TEXT,
    "cod_actividad" TEXT,
    "raw_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "taxpayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "taxpayer_nrc_key" ON "taxpayer"("nrc");

-- AddForeignKey
ALTER TABLE "taxpayer" ADD CONSTRAINT "taxpayer_cod_actividad_fkey" FOREIGN KEY ("cod_actividad") REFERENCES "activity"("cod_actividad") ON DELETE SET NULL ON UPDATE CASCADE;

-- Insert logic to migrate data
INSERT INTO "activity" ("cod_actividad", "desc_actividad")
SELECT DISTINCT
  raw_json->'emisor'->>'codActividad' as cod_actividad,
  raw_json->'emisor'->>'descActividad' as desc_actividad
FROM "dte"
WHERE raw_json->'emisor'->>'codActividad' IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "activity" ("cod_actividad", "desc_actividad")
SELECT DISTINCT
  raw_json->'receptor'->>'codActividad' as cod_actividad,
  raw_json->'receptor'->>'descActividad' as desc_actividad
FROM "dte"
WHERE raw_json->'receptor'->>'codActividad' IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "taxpayer" ("id", "nrc", "nit", "nombre", "nombre_comercial", "cod_actividad", "raw_json", "created_at", "updated_at")
SELECT 
  gen_random_uuid(),
  raw_json->'emisor'->>'nrc' as nrc,
  raw_json->'emisor'->>'nit' as nit,
  raw_json->'emisor'->>'nombre' as nombre,
  raw_json->'emisor'->>'nombreComercial' as nombre_comercial,
  raw_json->'emisor'->>'codActividad' as cod_actividad,
  raw_json->'emisor' as raw_json,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "dte"
WHERE raw_json->'emisor'->>'nrc' IS NOT NULL
ON CONFLICT ("nrc") DO NOTHING;

INSERT INTO "taxpayer" ("id", "nrc", "nit", "nombre", "nombre_comercial", "cod_actividad", "raw_json", "created_at", "updated_at")
SELECT 
  gen_random_uuid(),
  raw_json->'receptor'->>'nrc' as nrc,
  raw_json->'receptor'->>'nit' as nit,
  raw_json->'receptor'->>'nombre' as nombre,
  raw_json->'receptor'->>'nombreComercial' as nombre_comercial,
  raw_json->'receptor'->>'codActividad' as cod_actividad,
  raw_json->'receptor' as raw_json,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "dte"
WHERE raw_json->'receptor'->>'nrc' IS NOT NULL
ON CONFLICT ("nrc") DO NOTHING;

-- AlterTable: dte
ALTER TABLE "dte" DROP COLUMN "issuer_activity",
DROP COLUMN "issuer_name",
DROP COLUMN "receiver_name";

-- Alter receiver_nrc to nullable
ALTER TABLE "dte" ALTER COLUMN "receiver_nrc" DROP NOT NULL;

-- AddForeignKeys to dte
ALTER TABLE "dte" ADD CONSTRAINT "dte_issuer_nrc_fkey" FOREIGN KEY ("issuer_nrc") REFERENCES "taxpayer"("nrc") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "dte" ADD CONSTRAINT "dte_receiver_nrc_fkey" FOREIGN KEY ("receiver_nrc") REFERENCES "taxpayer"("nrc") ON DELETE SET NULL ON UPDATE CASCADE;
