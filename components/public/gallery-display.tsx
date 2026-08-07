"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  getNextGallerySlide,
  getPreviousGallerySlide,
  shouldUseGalleryCarousel,
} from "@/lib/gallery/carousel";
import { getSafeGalleryLinkProps } from "@/lib/gallery/schema";

const AUTOPLAY_INTERVAL_MS = 5_000;

type GalleryDisplayItem = {
  id: string;
  type: "IMAGE" | "INSTAGRAM_VIDEO";
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  externalUrl: string | null;
};

function GalleryCard({ item }: { item: GalleryDisplayItem }) {
  const linkProps = getSafeGalleryLinkProps(item);
  const card = (
    <article className="gallery-card">
      <div className="gallery-image">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt={item.title ?? "Galería de Revuelto"} width={800} height={600} />
        ) : <span>Imagen no disponible</span>}
        {item.type === "INSTAGRAM_VIDEO" && <span className="gallery-play-indicator" aria-hidden="true">▶</span>}
      </div>
      {(item.title || item.description) && (
        <div className="gallery-copy">
          {item.title && <h3>{item.title}</h3>}
          {item.description && <p>{item.description}</p>}
        </div>
      )}
    </article>
  );

  return linkProps ? (
    <a
      className="gallery-link"
      {...linkProps}
      aria-label={item.type === "INSTAGRAM_VIDEO" ? `Abrir ${item.title || "video"} en Instagram` : undefined}
    >
      {card}
    </a>
  ) : card;
}

export function GalleryDisplay({ items }: { items: GalleryDisplayItem[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const isCarousel = shouldUseGalleryCarousel(items.length);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (!isCarousel || isPaused || prefersReducedMotion) return;
    const interval = window.setInterval(() => {
      setCurrentIndex((index) => getNextGallerySlide(index, items.length));
    }, AUTOPLAY_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [isCarousel, isPaused, items.length, prefersReducedMotion]);

  if (!isCarousel) {
    return <div className="gallery-grid">{items.map((item) => <GalleryCard item={item} key={item.id} />)}</div>;
  }

  const goTo = (index: number) => setCurrentIndex(index);
  const previous = () => setCurrentIndex((index) => getPreviousGallerySlide(index, items.length));
  const next = () => setCurrentIndex((index) => getNextGallerySlide(index, items.length));

  return (
    <div
      className="gallery-carousel"
      role="region"
      aria-roledescription="carrusel"
      aria-label="Galería de Revuelto"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsPaused(false);
      }}
    >
      <div className="gallery-carousel-viewport">
        <div className="gallery-carousel-track" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
          {items.map((item, index) => (
            <div className="gallery-carousel-slide" key={item.id} aria-hidden={index !== currentIndex}>
              <GalleryCard item={item} />
            </div>
          ))}
        </div>
      </div>
      <div className="gallery-carousel-controls">
        <button type="button" className="gallery-carousel-button" onClick={previous} aria-label="Elemento anterior">←</button>
        <div className="gallery-carousel-indicators" aria-label="Seleccionar elemento de galería">
          {items.map((item, index) => (
            <button
              type="button"
              className={index === currentIndex ? "is-current" : ""}
              key={item.id}
              onClick={() => goTo(index)}
              aria-label={`Ver elemento ${index + 1} de ${items.length}`}
              aria-current={index === currentIndex ? "true" : undefined}
            />
          ))}
        </div>
        <button type="button" className="gallery-carousel-button" onClick={next} aria-label="Siguiente elemento">→</button>
      </div>
    </div>
  );
}
