import "server-only";
import { getPrisma } from "@/lib/prisma";
import { deleteFinalImage } from "@/lib/images/temporary-images";
import { reportUnexpectedServerError } from "@/lib/observability/server-errors";
import { runConfirmedDeletion, type DeletionTarget } from "./deletion";

export async function deleteCatalogEntity(target: DeletionTarget, id: string, confirmation: string) {
  const imagePath = await getPrisma().$transaction(async (tx) => {
    // Check and delete in the same serializable transaction. updatedAt guards
    // also prevent deleting an element edited or reactivated after it was read.
    switch (target) {
      case "BOWL": {
        const row = await tx.bowl.findUnique({ where: { id } });
        return runConfirmedDeletion({
          entity: row && { ...row, active: row.isAvailable || row.isVisibleInNewMenu }, confirmation,
          remove: () => tx.bowl.deleteMany({ where: { id, updatedAt: row!.updatedAt, isAvailable: false, isVisibleInNewMenu: false } }),
        });
      }
      case "INGREDIENT": {
        const row = await tx.ingredient.findUnique({ where: { id }, include: { _count: { select: { recipeIngredients: true, choiceOptions: true } } } });
        return runConfirmedDeletion({
          entity: row && { ...row, active: row.isActive, inUse: row._count.recipeIngredients > 0 || row._count.choiceOptions > 0 }, confirmation,
          remove: () => tx.ingredient.deleteMany({ where: { id, updatedAt: row!.updatedAt, isActive: false } }),
        });
      }
      case "BRANCH": {
        const row = await tx.branch.findUnique({ where: { id }, include: { _count: { select: { checkoutOrders: true } } } });
        return runConfirmedDeletion({
          entity: row && { name: row.name, active: row.isActive, inUse: row._count.checkoutOrders > 0 }, confirmation,
          remove: () => tx.branch.deleteMany({ where: { id, updatedAt: row!.updatedAt, isActive: false } }),
        });
      }
      case "PROMOTION": {
        const row = await tx.promotion.findUnique({ where: { id } });
        return runConfirmedDeletion({
          entity: row && { name: row.title, active: row.isActive, imagePath: row.imagePath }, confirmation,
          remove: () => tx.promotion.deleteMany({ where: { id, updatedAt: row!.updatedAt, isActive: false } }),
        });
      }
      case "GALLERY": {
        const row = await tx.galleryItem.findUnique({ where: { id } });
        return runConfirmedDeletion({
          entity: row && { name: row.title || "Sin título", active: row.isActive, imagePath: row.imagePath }, confirmation,
          remove: () => tx.galleryItem.deleteMany({ where: { id, updatedAt: row!.updatedAt, isActive: false } }),
        });
      }
      case "MERCHANDISE": {
        const row = await tx.merchandiseItem.findUnique({ where: { id } });
        return runConfirmedDeletion({
          entity: row && { ...row, active: row.isActive }, confirmation,
          remove: () => tx.merchandiseItem.deleteMany({ where: { id, updatedAt: row!.updatedAt, isActive: false } }),
        });
      }
    }
  }, { isolationLevel: "Serializable" });

  // Never remove the file before the database commit: failed deletions must
  // leave the element and its image intact.
  if (imagePath) {
    await deleteFinalImage(imagePath).catch((error) => reportUnexpectedServerError("admin.delete-final-image", error));
  }
}
