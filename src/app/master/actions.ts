"use server";

import { revalidatePath } from "next/cache";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeText } from "@/lib/normalize";
import { importMasterFromExcel } from "@/lib/import-master";

async function guard() {
  if (!(await isAuthenticated())) throw new Error("Unauthorized");
}

export async function addSupplier(formData: FormData) {
  await guard();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await prisma.supplier.upsert({
    where: { name },
    update: {},
    create: { name, aliases: { create: { text: name.toUpperCase() } } },
  });
  revalidatePath("/master");
}

export async function addItem(formData: FormData) {
  await guard();
  const supplierId = String(formData.get("supplierId") || "");
  const code = String(formData.get("code") || "").trim();
  const description = String(formData.get("description") || "").trim();
  if (!supplierId || !code || !description) return;

  const item = await prisma.supplierItem.create({
    data: { supplierId, code, description },
  });
  const norm = normalizeText(description);
  if (norm) {
    await prisma.itemAlias.upsert({
      where: { supplierItemId_rawText: { supplierItemId: item.id, rawText: norm } },
      update: {},
      create: { supplierItemId: item.id, rawText: norm, source: "seed" },
    });
  }
  revalidatePath("/master");
}

export async function updateItem(formData: FormData) {
  await guard();
  const id = String(formData.get("id") || "");
  const code = String(formData.get("code") || "").trim();
  const description = String(formData.get("description") || "").trim();
  if (!id || !code || !description) return;
  await prisma.supplierItem.update({ where: { id }, data: { code, description } });
  revalidatePath("/master");
}

export async function deleteItem(formData: FormData) {
  await guard();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await prisma.supplierItem.delete({ where: { id } }).catch(() => {});
  revalidatePath("/master");
}

export async function reimportMaster() {
  await guard();
  await importMasterFromExcel(prisma);
  revalidatePath("/master");
}
