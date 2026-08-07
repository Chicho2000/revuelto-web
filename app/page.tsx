import type { Metadata } from "next";
import Image from "next/image";
import { buildWhatsAppUrl, DEFAULT_SITE_CONTENT } from "@/lib/content/schema";
import { getPublicSiteData, type PublicSiteData } from "@/lib/public-data";
import { PUBLIC_SECTION_IDS } from "@/lib/public-visibility";
import { formatPromotionPublicAvailability } from "@/lib/promotions/schema";
import { GalleryDisplay } from "@/components/public/gallery-display";

export const dynamic = "force-dynamic";

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const days: Record<string, string> = {
  MONDAY: "Lunes",
  TUESDAY: "Martes",
  WEDNESDAY: "Miércoles",
  THURSDAY: "Jueves",
  FRIDAY: "Viernes",
  SATURDAY: "Sábado",
  SUNDAY: "Domingo",
};

export async function generateMetadata(): Promise<Metadata> {
  const data = await getPublicSiteData();
  if (data.status !== "ready") return {};
  return {
    title: data.content.seoTitle || DEFAULT_SITE_CONTENT.seoTitle,
    description: data.content.seoDescription || DEFAULT_SITE_CONTENT.seoDescription,
  };
}

function ConfigurationNotice({ error = false }: { error?: boolean }) {
  return (
    <section className="status-section" aria-live="polite">
      <p className="eyebrow">{error ? "No pudimos cargar la carta" : "Carta en preparación"}</p>
      <h2>{error ? "Volvé a intentarlo en unos minutos." : "Estamos preparando algo rico."}</h2>
      <p>{error ? "La información no está disponible en este momento." : "La carta estará disponible cuando conectemos los datos de Revuelto."}</p>
    </section>
  );
}

export function PublicHome({ data }: { data: PublicSiteData }) {
  const content = data.status === "ready" ? data.content : DEFAULT_SITE_CONTENT;
  const whatsappUrl = buildWhatsAppUrl(content);
  const externalHeroButton = content.heroButtonUrl.startsWith("https://");

  return (
    <main>
      <header className="site-header">
        <a href="#inicio" aria-label="Ir al inicio de Revuelto">
          <Image src="/brand/logos/logo-horizontal.svg" alt="Revuelto" width={560} height={210} priority className="brand-logo" />
        </a>
        {data.status === "ready" && data.navigation.menuItems.length > 0 && (
          <nav className="site-navigation" aria-label="Secciones disponibles">
            {data.navigation.menuItems.map((item) => <a className="header-link" href={item.href} key={item.id}>{item.label}</a>)}
          </nav>
        )}
      </header>

      <section id="inicio" className="hero-section">
        <div>
          {content.heroSubtitle && <p className="eyebrow">{content.heroSubtitle}</p>}
          <h1>{content.heroTitle}</h1>
          {content.heroDescription && <p className="hero-copy">{content.heroDescription}</p>}
          {content.heroButtonText && content.heroButtonUrl && (
            <a
              className="button button-dark"
              href={content.heroButtonUrl}
              {...(externalHeroButton ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {content.heroButtonText}
            </a>
          )}
        </div>
        <Image src="/brand/logos/illustration-eating.svg" alt="Ilustración de una persona disfrutando Revuelto" width={580} height={580} className="hero-illustration" />
      </section>

      {data.status === "configuration" && <ConfigurationNotice />}
      {data.status === "error" && <ConfigurationNotice error />}

      {data.status === "ready" && (
        <>
          {data.navigation.hasBowls && (
            <section id={PUBLIC_SECTION_IDS.bowls} className="section section-cream">
              <div className="section-heading">
                <p className="eyebrow">La carta</p>
                {content.menuSectionTitle && <h2>{content.menuSectionTitle}</h2>}
                {content.menuSectionDescription && <p>{content.menuSectionDescription}</p>}
              </div>
              <div className="bowl-grid">
                {data.visibleBowls.map((bowl) => (
                  <article key={bowl.id} className="bowl-card">
                    <div className="bowl-image">
                      {bowl.imageUrl ? <Image src={bowl.imageUrl} alt={bowl.name} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" /> : <p>Foto próximamente</p>}
                    </div>
                    <div className="bowl-body">
                      <h3>{bowl.name}</h3>
                      <p>{bowl.shortDescription}</p>
                      <div className="size-list">
                        {bowl.sizes.map((size) => (
                          <div key={size.id} className="size-row">
                            <span><strong>{size.size}</strong> · {size.ounces} oz · {size.eggQuantity} huevos</span>
                            <strong>{currencyFormatter.format(Number(size.price))}</strong>
                            {size.quantityNotes && <small>{size.quantityNotes}</small>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {data.navigation.hasPromotions && (
            <section id={PUBLIC_SECTION_IDS.promotions} className="section section-pink">
              <div className="section-heading">
                <p className="eyebrow">Promociones</p>
                {content.promotionsSectionTitle && <h2>{content.promotionsSectionTitle}</h2>}
                {content.promotionsSectionDescription && <p>{content.promotionsSectionDescription}</p>}
              </div>
              <div className="promotion-grid">
                {data.visiblePromotions.map((promotion) => (
                  <article key={promotion.id} className="promotion-card">
                    {promotion.imageUrl && <Image src={promotion.imageUrl} alt={promotion.title} width={960} height={540} className="promotion-image" />}
                    <h3>{promotion.title}</h3>
                    <p>{promotion.description}</p>
                    <p className="promotion-availability"><strong>Disponible:</strong> {formatPromotionPublicAvailability(promotion)}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {data.navigation.hasBranches && (
            <section id={PUBLIC_SECTION_IDS.branches} className="section section-green">
              <div className="section-heading">
                <p className="eyebrow">Sucursales</p>
                {content.branchesSectionTitle && <h2>{content.branchesSectionTitle}</h2>}
                {content.branchesSectionDescription && <p>{content.branchesSectionDescription}</p>}
              </div>
              <div className="branch-grid">
                {data.visibleBranches.map((branch) => (
                  <article key={branch.id} className="branch-card">
                    <h3>{branch.name}</h3>
                    <p>{branch.address}</p>
                    <p>{branch.city}</p>
                    {branch.whatsappNumber && <p>Teléfono: {branch.whatsappNumber}</p>}
                    <ul>{branch.businessHours.map((hour) => <li key={hour.id}>{days[hour.dayOfWeek]}: {hour.isClosed ? "Cerrado" : `${hour.openingTime} a ${hour.closingTime}`}</li>)}</ul>
                  </article>
                ))}
              </div>
            </section>
          )}

          {data.navigation.hasGallery && (
            <section id={PUBLIC_SECTION_IDS.gallery} className="section section-blue gallery-section">
              <div className="section-heading">
                <p className="eyebrow">Galería</p>
                {content.gallerySectionTitle && <h2>{content.gallerySectionTitle}</h2>}
                {content.gallerySectionDescription && <p>{content.gallerySectionDescription}</p>}
              </div>
              <GalleryDisplay items={data.visibleGallery} />
            </section>
          )}

          {(content.brandTitle || content.brandDescription) && (
            <section className="section section-pink about-section about-section-closing">
              <Image src="/brand/logos/illustration-cooking.svg" alt="Ilustración de una persona cocinando" width={480} height={480} />
              <div><p className="eyebrow">Revuelto</p>{content.brandTitle && <h2>{content.brandTitle}</h2>}{content.brandDescription && <p>{content.brandDescription}</p>}</div>
            </section>
          )}
        </>
      )}

      {whatsappUrl && <a className="whatsapp-button" href={whatsappUrl} target="_blank" rel="noopener noreferrer">{content.whatsappButtonText || "WhatsApp"}</a>}
      <footer className="site-footer">
        <Image src="/brand/logos/logo-compact.svg" alt="Revuelto" width={180} height={180} />
        {content.footerText && <p>{content.footerText}</p>}
        <div className="footer-social-links">
          {content.instagramUrl && <a href={content.instagramUrl} target="_blank" rel="noopener noreferrer">Instagram</a>}
          {content.tiktokUrl && <a href={content.tiktokUrl} target="_blank" rel="noopener noreferrer">TikTok</a>}
        </div>
      </footer>
    </main>
  );
}

export default async function Home() {
  return <PublicHome data={await getPublicSiteData()} />;
}
