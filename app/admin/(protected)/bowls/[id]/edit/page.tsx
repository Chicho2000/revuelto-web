import { notFound } from "next/navigation";
import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { BowlForm } from "@/components/admin/bowls/bowl-form";
import { requireOwner } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export default async function EditBowlPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;

  const { id } = await params;
  const bowl = await getPrisma().bowl.findUnique({
    where: { id },
    include: { sizes: true },
  });
  if (!bowl) notFound();

  const small = bowl.sizes.find((size) => size.size === "SMALL");
  const large = bowl.sizes.find((size) => size.size === "LARGE");

  return (
    <section className="admin-panel">
      <p className="eyebrow">Productos</p>
      <h1>Editar bowl</h1>
      <BowlForm
        mode="edit"
        bowlId={bowl.id}
        initialImageUrl={bowl.imageUrl}
        initialValues={{
          name: bowl.name,
          slug: bowl.slug,
          description: bowl.description,
          isActive: bowl.isAvailable,
          temporaryImageId: null,
          sizes: {
            SMALL: { price: Number(small?.price ?? 0) },
            LARGE: { price: Number(large?.price ?? 0) },
          },
        }}
      />
    </section>
  );
}
