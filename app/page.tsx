import type { Metadata } from "next";
import Image from "next/image";
import { buildWhatsAppUrl, DEFAULT_SITE_CONTENT } from "@/lib/content/schema";
import { getPublicSiteData, type PublicSiteData } from "@/lib/public-data";
import { PUBLIC_SECTION_IDS } from "@/lib/public-visibility";
import { formatPromotionPublicAvailability } from "@/lib/promotions/schema";
import { GalleryDisplay } from "@/components/public/gallery-display";
import { PublicHeader } from "@/components/public/public-header";
import { RevealController } from "@/components/public/reveal-controller";

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
  const menuItems = data.status === "ready" ? data.navigation.menuItems : [];

  return (
    <div className="public-site">
      <RevealController />
      <PublicHeader items={menuItems} />
      <main>
      <section id="inicio" className="public-hero">
        <div className="public-hero-copy" data-reveal>
          {content.heroSubtitle && <p className="public-kicker">{content.heroSubtitle}</p>}
          <h1>{content.heroTitle}</h1>
          {content.heroDescription && <p className="public-hero-description">{content.heroDescription}</p>}
          {content.heroButtonText && content.heroButtonUrl && (
            <a
              className="public-button public-button-dark"
              href={content.heroButtonUrl}
              {...(externalHeroButton ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              <span>{content.heroButtonText}</span><span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
        <div className="public-hero-art" data-reveal>
          <span className="public-hero-orbit" aria-hidden="true" />
          <span className="public-hero-sticker" aria-hidden="true"><Image src="/brand/logos/logo-compact.svg" alt="" width={100} height={100} /></span>
          <Image src="/brand/logos/illustration-cooking.svg" alt="Ilustración de una persona cocinando" width={580} height={580} priority sizes="(max-width: 719px) 82vw, 42vw" />
        </div>
      </section>

      {data.status === "configuration" && <ConfigurationNotice />}
      {data.status === "error" && <ConfigurationNotice error />}

      {data.status === "ready" && (
        <>
          {data.navigation.hasBowls && (
            <section id={PUBLIC_SECTION_IDS.bowls} className="public-section public-menu-section">
              <div className="public-section-heading" data-reveal>
                <h2>{content.menuSectionTitle || "La carta"}</h2>
                {content.menuSectionDescription && <p>{content.menuSectionDescription}</p>}
              </div>
              <div className="public-bowl-grid">
                {data.visibleBowls.map((bowl, index) => (
                  <article key={bowl.id} className="public-bowl-card" data-reveal>
                    <span className="public-bowl-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    <div className="public-bowl-image">
                      {bowl.imageUrl ? <Image src={bowl.imageUrl} alt={bowl.name} fill sizes="(max-width: 719px) 100vw, (max-width: 1099px) 50vw, 33vw" /> : <p>Foto próximamente</p>}
                    </div>
                    <div className="public-bowl-body">
                      <h3>{bowl.name}</h3>
                      <p className="public-bowl-description">{bowl.description || bowl.shortDescription}</p>
                      <div className="public-size-list">
                        {bowl.sizes.map((size) => (
                          <div key={size.id} className="public-size-row">
                            <span><strong>{size.size === "SMALL" ? "Small" : "Large"}</strong> · {size.ounces} oz · {size.eggQuantity} huevos</span>
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
            <section id={PUBLIC_SECTION_IDS.promotions} className="public-section public-promotions-section">
              <div className="public-section-heading public-section-heading-light" data-reveal>
                <h2>{content.promotionsSectionTitle || "Promociones"}</h2>
                {content.promotionsSectionDescription && <p>{content.promotionsSectionDescription}</p>}
              </div>
              <div className="public-promotion-list">
                {data.visiblePromotions.map((promotion, index) => (
                  <article key={promotion.id} className="public-promotion-poster" data-reveal>
                    {promotion.imageUrl && <div className="public-promotion-image"><Image src={promotion.imageUrl} alt={promotion.title} fill sizes="(max-width: 719px) 100vw, 50vw" /></div>}
                    <div className="public-promotion-copy"><span className="public-promotion-index">PROMO {index + 1}</span><h3>{promotion.title}</h3><p>{promotion.description}</p>
                    <p className="public-promotion-availability"><strong>Disponible</strong><span>{formatPromotionPublicAvailability(promotion)}</span></p></div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {data.navigation.hasBranches && (
            <section id={PUBLIC_SECTION_IDS.branches} className="public-section public-branches-section">
              <div className="public-section-heading" data-reveal>
                <h2>{content.branchesSectionTitle || "Sucursales"}</h2>
                {content.branchesSectionDescription && <p>{content.branchesSectionDescription}</p>}
              </div>
              <div className="public-branch-grid">
                {data.visibleBranches.map((branch) => (
                  <article key={branch.id} className="public-branch-card" data-reveal>
                    <div className="public-branch-heading"><p className="public-kicker">Punto Revuelto</p><h3>{branch.name}</h3><p>{branch.address}<br />{branch.city}</p>{branch.whatsappNumber && <p className="public-branch-phone">{branch.whatsappNumber}</p>}</div>
                    <ul className="public-schedule">{branch.businessHours.map((hour) => <li className={hour.isClosed ? "is-closed" : ""} key={hour.id}><span>{days[hour.dayOfWeek]}</span><strong>{hour.isClosed ? "Cerrado" : `${hour.openingTime}—${hour.closingTime}`}</strong></li>)}</ul>
                  </article>
                ))}
              </div>
            </section>
          )}

          {data.navigation.hasGallery && (
            <section id={PUBLIC_SECTION_IDS.gallery} className="public-section public-gallery-section">
              <div className="public-section-heading" data-reveal>
                <h2>{content.gallerySectionTitle || "Galería"}</h2>
                {content.gallerySectionDescription && <p>{content.gallerySectionDescription}</p>}
              </div>
              <div data-reveal><GalleryDisplay items={data.visibleGallery} /></div>
            </section>
          )}

          {data.navigation.hasMerchandise && (
            <section id={PUBLIC_SECTION_IDS.merchandise} className="public-section public-merchandise-section">
              <div className="public-section-heading" data-reveal>
                <h2>Merchandising</h2>
              </div>
              <div className="public-merchandise-grid">
                {data.visibleMerchandise.map((item) => (
                  <article className="public-merchandise-card" key={item.id} data-reveal>
                    <div className="public-merchandise-image">
                      {item.imageUrl ? (
                        <Image src={item.imageUrl} alt={item.name} fill sizes="(max-width: 719px) 100vw, (max-width: 1099px) 50vw, 33vw" />
                      ) : (
                        <span>Imagen no disponible</span>
                      )}
                    </div>
                    <div className="public-merchandise-copy">
                      <h3>{item.name}</h3>
                      {item.description && <p>{item.description}</p>}
                      <strong>{currencyFormatter.format(Number(item.price))}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {(content.brandTitle || content.brandDescription) && (
            <section className="public-brand-story public-section" data-reveal>
              <div className="public-brand-visual"><Image src="/brand/logos/illustration-eating.svg" alt="Ilustración de una persona disfrutando Revuelto" width={480} height={480} /></div>
              <div className="public-brand-copy"><p className="public-brand-name">Revuelto</p>{content.brandTitle && <h2>{content.brandTitle}</h2>}</div>
              <Image className="public-brand-seal" src="/brand/logos/seal-smile.svg" alt="" width={180} height={180} aria-hidden="true" />
            </section>
          )}
        </>
      )}

      </main>
      {whatsappUrl && <a className="public-whatsapp" href={whatsappUrl} target="_blank" rel="noopener noreferrer"><span className="public-whatsapp-dot" aria-hidden="true">↗</span><span>{content.whatsappButtonText || "WhatsApp"}</span></a>}
      <footer className="public-footer"><div className="public-footer-top"><a href="#inicio" aria-label="Volver al inicio"><Image src="/brand/logos/logo-horizontal.svg" alt="Revuelto" width={560} height={210} /></a>{content.footerText && <p>{content.footerText}</p>}</div><div className="public-footer-bottom"><nav aria-label="Navegación del pie"><a href="#inicio">Inicio</a>{menuItems.map((item) => <a href={item.href} key={item.id}>{item.label}</a>)}</nav><div className="public-social-links">{content.instagramUrl && <a href={content.instagramUrl} target="_blank" rel="noopener noreferrer">Instagram ↗</a>}{content.tiktokUrl && <a href={content.tiktokUrl} target="_blank" rel="noopener noreferrer">TikTok ↗</a>}</div></div><Image className="public-footer-seal" src="/brand/logos/seal-light.svg" alt="" width={260} height={260} aria-hidden="true" /></footer>
    </div>
  );
}

export default async function Home() {
  return <PublicHome data={await getPublicSiteData()} />;
}
