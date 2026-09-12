"use client";

import { useState, useSyncExternalStore } from "react";
import { isMobileDevice } from "@/lib/orders/device";

const subscribeToDevice = () => () => undefined;

export function CheckoutWhatsAppActions({
  mobileWhatsappUrl,
  mobileFallbackWhatsappUrl,
  desktopWhatsappUrl,
}: {
  mobileWhatsappUrl: string;
  mobileFallbackWhatsappUrl: string;
  desktopWhatsappUrl: string;
}) {
  const mobile = useSyncExternalStore(
    subscribeToDevice,
    () => isMobileDevice(window.navigator),
    () => null,
  );
  const [showFallback, setShowFallback] = useState(false);
  if (mobile === null) return <p>Preparando WhatsApp…</p>;

  if (!mobile) {
    return <a className="public-button public-button-dark" href={desktopWhatsappUrl} target="_blank" rel="noopener noreferrer">Continuar por WhatsApp</a>;
  }

  return (
    <div className="checkout-whatsapp-actions">
      <a className="public-button public-button-dark" href={mobileWhatsappUrl} target="_blank" rel="noopener noreferrer" onClick={() => setShowFallback(true)}>Continuar por WhatsApp</a>
      {showFallback && <a href={mobileFallbackWhatsappUrl} target="_blank" rel="noopener noreferrer">¿No se abrió la app? Continuar en WhatsApp</a>}
    </div>
  );
}
