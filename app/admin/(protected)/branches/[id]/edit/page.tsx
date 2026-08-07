import { notFound } from "next/navigation";
import { AdminConfigurationState } from "@/components/admin/configuration-state";
import { BranchForm } from "@/components/admin/branches/branch-form";
import { requireOwner } from "@/lib/auth";
import { BRANCH_DAYS } from "@/lib/branches/schema";
import { getPrisma } from "@/lib/prisma";

export default async function EditBranchPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireOwner();
  if (access.status === "configuration") return <AdminConfigurationState />;

  const { id } = await params;
  const branch = await getPrisma().branch.findUnique({
    where: { id },
    include: { businessHours: true },
  });
  if (!branch) notFound();

  return (
    <section className="admin-panel admin-branch-panel">
      <p className="eyebrow">Sucursales</p>
      <h1>Editar sucursal</h1>
      <BranchForm
        mode="edit"
        branchId={branch.id}
        initialValues={{
          name: branch.name,
          address: branch.address,
          city: branch.city,
          phone: branch.whatsappNumber,
          isActive: branch.isActive,
          schedules: BRANCH_DAYS.map((dayOfWeek) => {
            const hour = branch.businessHours.find((record) => record.dayOfWeek === dayOfWeek);
            return {
              dayOfWeek,
              isOpen: hour ? !hour.isClosed : false,
              openTime: hour?.openingTime ?? "",
              closeTime: hour?.closingTime ?? "",
            };
          }),
        }}
      />
    </section>
  );
}
