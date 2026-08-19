"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type PublicNavigationItem = {
  id: string;
  href: string;
  label: string;
};

export function PublicHeader({ items }: { items: PublicNavigationItem[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const updateHeader = () => setScrolled(window.scrollY > 24);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  return (
    <header className={`public-header${scrolled ? " is-scrolled" : ""}`}>
      <div className="public-header-inner">
        <a className="public-header-brand" href="#inicio" aria-label="Ir al inicio de Revuelto">
          <Image
            src="/brand/logos/logo-horizontal.svg"
            alt="Revuelto"
            width={560}
            height={210}
            priority
          />
        </a>

        {items.length > 0 && (
          <>
            <button
              className="public-menu-toggle"
              type="button"
              aria-expanded={menuOpen}
              aria-controls="public-navigation"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span>{menuOpen ? "Cerrar" : "Menú"}</span>
              <span className="public-menu-icon" aria-hidden="true">
                <i />
                <i />
              </span>
            </button>
            <nav
              id="public-navigation"
              className={`public-navigation${menuOpen ? " is-open" : ""}`}
              aria-label="Secciones disponibles"
            >
              {items.map((item) => (
                <a href={item.href} key={item.id} onClick={() => setMenuOpen(false)}>
                  {item.label}
                </a>
              ))}
            </nav>
          </>
        )}
      </div>
    </header>
  );
}
