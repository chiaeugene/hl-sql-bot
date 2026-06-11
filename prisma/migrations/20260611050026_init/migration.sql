-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SupplierAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    CONSTRAINT "SupplierAlias_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplierItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupplierItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierItemId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'correction',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ItemAlias_supplierItemId_fkey" FOREIGN KEY ("supplierItemId") REFERENCES "SupplierItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'parsed',
    "rawAiJson" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "rawDescription" TEXT NOT NULL,
    "matchedCode" TEXT,
    "matchedItemId" TEXT,
    "qty" REAL NOT NULL DEFAULT 0,
    "uom" TEXT NOT NULL DEFAULT 'KG',
    "unitPrice" REAL NOT NULL DEFAULT 0,
    "subtotal" REAL NOT NULL DEFAULT 0,
    "matchConfidence" REAL NOT NULL DEFAULT 0,
    "matchMethod" TEXT NOT NULL DEFAULT 'none',
    "wasEdited" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "SupplierAlias_supplierId_idx" ON "SupplierAlias"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierItem_supplierId_idx" ON "SupplierItem"("supplierId");

-- CreateIndex
CREATE INDEX "ItemAlias_rawText_idx" ON "ItemAlias"("rawText");

-- CreateIndex
CREATE UNIQUE INDEX "ItemAlias_supplierItemId_rawText_key" ON "ItemAlias"("supplierItemId", "rawText");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");
