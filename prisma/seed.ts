import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { DayOfWeek, PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL es obligatoria para ejecutar el seed. No se insertaron datos.",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const bowlSizes = [
  {
    size: "SMALL" as const,
    ounces: 25,
    eggQuantity: 3,
    price: "8500",
    quantityNotes: "Porción de 25 oz con 3 huevos.",
    isAvailable: true,
  },
  {
    size: "LARGE" as const,
    ounces: 35,
    eggQuantity: 5,
    price: "11000",
    quantityNotes: "Porción de 35 oz con 5 huevos.",
    isAvailable: true,
  },
];

const businessDays = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
];

async function main() {
  await Promise.all([
    prisma.siteContent.upsert({
      where: { key: "hero" },
      create: {
        key: "hero",
        title: "Fresco, nutritivo, resuelto.",
        content: "Bowls de huevos revueltos para seguir con tu día.",
      },
      update: {
        title: "Fresco, nutritivo, resuelto.",
        content: "Bowls de huevos revueltos para seguir con tu día.",
      },
    }),
    prisma.siteContent.upsert({
      where: { key: "about" },
      create: {
        key: "about",
        title: "Hecho para resolver",
        content: "Recetas fijas, ingredientes frescos y energía que acompaña.",
      },
      update: {
        title: "Hecho para resolver",
        content: "Recetas fijas, ingredientes frescos y energía que acompaña.",
      },
    }),
  ]);

  await prisma.bowl.upsert({
    where: { slug: "revuelto-clasico" },
    create: {
      name: "Revuelto clásico",
      slug: "revuelto-clasico",
      shortDescription: "Huevos revueltos, vegetales frescos y mucho sabor.",
      description:
        "Una receta fija, fresca y completa para resolver tu comida después de entrenar.",
      isFeatured: true,
      displayOrder: 1,
      sizes: { create: bowlSizes },
    },
    update: {
      name: "Revuelto clásico",
      shortDescription: "Huevos revueltos, vegetales frescos y mucho sabor.",
      description:
        "Una receta fija, fresca y completa para resolver tu comida después de entrenar.",
      isFeatured: true,
      displayOrder: 1,
      sizes: { deleteMany: {}, create: bowlSizes },
    },
  });

  await prisma.branch.upsert({
    where: { id: "11111111-1111-4111-8111-111111111111" },
    create: {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Sucursal demo",
      address: "Dirección a confirmar",
      city: "Ciudad a confirmar",
      mapsUrl: "https://maps.google.com",
      whatsappNumber: "5491100000000",
      businessHours: {
        create: businessDays.map((dayOfWeek) => ({
          dayOfWeek,
          openingTime: "08:00",
          closingTime: "20:00",
        })),
      },
    },
    update: {
      name: "Sucursal demo",
      address: "Dirección a confirmar",
      city: "Ciudad a confirmar",
      mapsUrl: "https://maps.google.com",
      whatsappNumber: "5491100000000",
      businessHours: {
        deleteMany: {},
        create: businessDays.map((dayOfWeek) => ({
          dayOfWeek,
          openingTime: "08:00",
          closingTime: "20:00",
        })),
      },
    },
  });

  await prisma.promotion.upsert({
    where: { id: "22222222-2222-4222-8222-222222222222" },
    create: {
      id: "22222222-2222-4222-8222-222222222222",
      title: "Promoción demo",
      description: "Contenido demostrativo del seed. Actualizalo desde la próxima etapa.",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-12-31T23:59:59.999Z"),
      isActive: false,
    },
    update: {
      title: "Promoción demo",
      description: "Contenido demostrativo del seed. Actualizalo desde la próxima etapa.",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-12-31T23:59:59.999Z"),
      isActive: false,
    },
  });

  console.log("Seed de demostración completado.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
