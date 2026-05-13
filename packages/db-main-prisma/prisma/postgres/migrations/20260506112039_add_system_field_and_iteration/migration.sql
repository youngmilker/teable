-- AlterTable
ALTER TABLE "field" ADD COLUMN     "config_source" TEXT,
ADD COLUMN     "is_system_field" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "system_field_key" TEXT;

-- CreateTable
CREATE TABLE "iteration" (
    "id" TEXT NOT NULL,
    "space_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "is_first" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" DOUBLE PRECISION,
    "created_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_modified_time" TIMESTAMP(3),
    "deleted_time" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "last_modified_by" TEXT,

    CONSTRAINT "iteration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "iteration_space_id_deleted_time_idx" ON "iteration"("space_id", "deleted_time");

-- CreateIndex
CREATE INDEX "iteration_sort_order_idx" ON "iteration"("sort_order");
