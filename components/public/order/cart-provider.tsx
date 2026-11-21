"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent,
} from "react";
import {
  addCartItem,
  getCartLineQuantity,
  getEstimatedCartTotalCents,
  parseStoredCart,
  removeCartItem,
  serializeCart,
  setCartItemQuantity,
  shouldShowCartBottomBar,
} from "@/lib/orders/cart";
import { isMobileDevice } from "@/lib/orders/device";
import {
  CART_STORAGE_KEY,
  getCartItemKey,
  getTotalCartUnits,
  type CartItem,
  type CartItemInput,
  type OrderPaymentMethod,
  type OrderFulfillment,
} from "@/lib/orders/schema";
import { COFFEE_DELIVERY_NOTICE, DELIVERY_FEE_CENTS, DELIVERY_HOURS_LABEL, DELIVERY_ZONE_LABEL, getDeliveryAvailability, type DeliveryBusinessHour } from "@/lib/orders/fulfillment";
import { CartBottomBar } from "./cart-bottom-bar";
import { CartItemQuantityControl } from "./cart-item-quantity-control";

export type PublicOrderProduct = {
  key: string;
  type: "BOWL" | "REVUELTO" | "MERCHANDISE";
  productId: string;
  size?: "SMALL" | "LARGE";
  name: string;
  variant: string | null;
  unitPriceCents: number;
  comboPriceCents?: number | null;
  ingredientNames?: Array<{ id: string; name: string }>;
  choiceGroups?: Array<{ id: string; label: string; options: Array<{ id: string; name: string }> }>;
  imageUrl: string | null;
};

export type PublicOrderBranch = { id: string; name: string; address: string; city: string; businessHours?: DeliveryBusinessHour[] };
export type PublicOrderConfiguration = {
  orderingEnabled: boolean;
  cashEnabled: boolean;
  transferEnabled: boolean;
  mercadoPagoEnabled: boolean;
};

type PreparedResponse = {
  lines: Array<{
    key: string;
    type: "BOWL" | "REVUELTO" | "MERCHANDISE";
    name: string;
    variant: string | null;
    quantity: number;
    unitPriceCents: number;
    subtotalCents: number;
  }>;
  totalCents: number;
  subtotalCents: number;
  deliveryFeeCents: number;
  deliveryWindow: string | null;
  deliveryDate: string | null;
  fulfillment: OrderFulfillment;
  mobileWhatsappUrl: string;
  mobileFallbackWhatsappUrl: string;
  desktopWhatsappUrl: string;
  branchName: string;
  paymentMethod: OrderPaymentMethod;
};

type MercadoPagoCreateResponse = {
  initPoint: string;
  error?: string;
  code?: string;
};

type CartContextValue = {
  enabled: boolean;
  fulfillmentMode: "PICKUP" | "DELIVERY";
  totalUnits: number;
  add: (item: CartItemInput) => void;
  addQuantity: (item: CartItemInput, quantity: number) => void;
  decrease: (item: CartItemInput) => void;
  quantityFor: (item: CartItemInput) => number;
  recentlyChangedKey: string | null;
  open: (opener?: HTMLElement | null) => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const currencyFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function usePublicOrderCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("usePublicOrderCart debe usarse dentro de PublicOrderCartProvider.");
  return value;
}

export function PublicOrderCartProvider({
  configuration,
  products,
  branches,
  children,
}: {
  configuration: PublicOrderConfiguration;
  products: PublicOrderProduct[];
  branches: PublicOrderBranch[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"cart" | "checkout" | "prepared">("cart");
  const [branchId, setBranchId] = useState("");
  const [fulfillmentMode, setFulfillmentMode] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryDetails, setDeliveryDetails] = useState("");
  const [zoneConfirmed, setZoneConfirmed] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod | "">("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [prepared, setPrepared] = useState<PreparedResponse | null>(null);
  const [whatsappHref, setWhatsappHref] = useState("");
  const [preparedForMobile, setPreparedForMobile] = useState(false);
  const [showMobileFallback, setShowMobileFallback] = useState(false);
  const [recentlyChangedKey, setRecentlyChangedKey] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const liveTimeoutRef = useRef<number | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);
  const checkoutRequestIdRef = useRef<string | null>(null);
  const submittingRef = useRef(false);

  const catalogProductMap = useMemo(() => new Map(products.map((product) => [product.key, product])), [products]);
  const productForItem = useCallback((item: CartItem) => {
    const catalogKey = item.type === "REVUELTO" ? `REVUELTO:${item.productId}` : getCartItemKey(item);
    const product = catalogProductMap.get(catalogKey);
    if (!product || item.type !== "REVUELTO") return product;
    const variantParts = [
      item.comboDrink === "COFFEE" ? "Con café" : item.comboDrink === "WATER" ? "Con agua" : null,
      item.excludedIngredientIds.length ? `Sin ${item.excludedIngredientIds.map((id) => product.ingredientNames?.find((ingredient) => ingredient.id === id)?.name ?? "ingrediente").join(", ")}` : null,
      ...item.choices.map((choice) => {
        const group = product.choiceGroups?.find((candidate) => candidate.id === choice.groupId);
        return group && choice.ingredientIds.length ? `${group.label}: ${choice.ingredientIds.map((id) => group.options.find((option) => option.id === id)?.name ?? "opción").join(", ")}` : null;
      }),
    ].filter((value): value is string => Boolean(value));
    return { ...product, unitPriceCents: item.comboDrink ? product.comboPriceCents ?? product.unitPriceCents : product.unitPriceCents, variant: variantParts.join(" · ") || null };
  }, [catalogProductMap]);
  const productMap = useMemo(() => new Map(items.flatMap((item) => {
    const product = productForItem(item);
    return product ? [[getCartItemKey(item), product] as const] : [];
  })), [items, productForItem]);
  const pricesByKey = useMemo(() => new Map([...productMap].map(([key, product]) => [key, product.unitPriceCents])), [productMap]);
  const totalUnits = getTotalCartUnits(items);
  const estimatedTotalCents = getEstimatedCartTotalCents(items, pricesByKey);
  const estimatedDeliveryFeeCents = fulfillmentMode === "DELIVERY" && items.length ? DELIVERY_FEE_CENTS : 0;
  const estimatedTotalWithDeliveryCents = estimatedTotalCents + estimatedDeliveryFeeCents;
  const selectedBranch = branches.find((branch) => branch.id === branchId);
  const deliveryAvailability = currentTime ? getDeliveryAvailability(selectedBranch?.businessHours ?? [], currentTime) : null;
  const coffeeInCart = items.some((item) => item.type === "REVUELTO" && item.comboDrink === "COFFEE");
  const deliveryReady = fulfillmentMode === "PICKUP" || Boolean(deliveryAvailability?.available && deliveryAddress.trim().length >= 5 && zoneConfirmed && !coffeeInCart && paymentMethod !== "MERCADO_PAGO");
  const preparedDeliveryCurrent = Boolean(deliveryAvailability?.available && prepared?.deliveryDate === deliveryAvailability.date);

  useEffect(() => {
    const update = () => setCurrentTime(new Date());
    const initial = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 30_000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    const hydrationTask = window.setTimeout(() => {
      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(CART_STORAGE_KEY);
        const parsed = parseStoredCart(stored);
        setItems(parsed);
        if (stored && parsed.length === 0) window.localStorage.removeItem(CART_STORAGE_KEY);
      } catch {
        setItems([]);
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(hydrationTask);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, serializeCart(items));
    } catch {
      // El carrito sigue funcionando durante la sesión aunque Storage esté bloqueado.
    }
  }, [hydrated, items]);

  useEffect(() => {
    checkoutRequestIdRef.current = null;
  }, [branchId, items, paymentMethod, fulfillmentMode, deliveryAddress, deliveryDetails, zoneConfirmed]);

  const announce = useCallback((text: string) => {
    setMessage(text);
    if (liveTimeoutRef.current) window.clearTimeout(liveTimeoutRef.current);
    liveTimeoutRef.current = window.setTimeout(() => setMessage(""), 1800);
  }, []);

  useEffect(() => () => {
    if (liveTimeoutRef.current) window.clearTimeout(liveTimeoutRef.current);
    if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);
  }, []);

  useEffect(() => {
    const active = configuration.orderingEnabled && items.length > 0;
    document.documentElement.classList.toggle("has-public-cart", active);
    return () => document.documentElement.classList.remove("has-public-cart");
  }, [configuration.orderingEnabled, items.length]);

  const markChanged = useCallback((key: string) => {
    setRecentlyChangedKey(key);
    if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = window.setTimeout(() => setRecentlyChangedKey(null), 320);
  }, []);

  const addQuantity = useCallback((item: CartItemInput, quantity: number) => {
    const safeQuantity = Math.max(1, Math.min(quantity, 20));
    const existingQuantity = getCartLineQuantity(items, getCartItemKey(item));
    const availableSlots = Math.min(20 - existingQuantity, 50 - getTotalCartUnits(items));
    const quantityToAdd = Math.max(0, Math.min(safeQuantity, availableSlots));
    if (quantityToAdd === 0) {
      announce("Alcanzaste el límite del pedido.");
      return;
    }
    setItems((current) => {
      let next = current;
      for (let index = 0; index < quantityToAdd; index += 1) next = addCartItem(next, item);
      return next;
    });
    announce(quantityToAdd === 1 ? "Agregado al pedido." : "Productos agregados al pedido.");
    markChanged(getCartItemKey(item));
  }, [announce, items, markChanged]);
  const add = useCallback((item: CartItemInput) => addQuantity(item, 1), [addQuantity]);
  const decrease = useCallback((item: CartItemInput) => {
    const key = getCartItemKey(item);
    const quantity = getCartLineQuantity(items, key);
    if (quantity === 0) return;
    setItems(setCartItemQuantity(items, key, quantity - 1));
    markChanged(key);
    announce(quantity === 1 ? "Producto quitado del pedido." : "Cantidad actualizada.");
  }, [announce, items, markChanged]);

  const closeDrawer = useCallback(() => {
    setOpen(false);
    window.setTimeout(() => openerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const drawer = drawerRef.current;
    const focusable = () => Array.from(drawer?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
    focusable()[0]?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = focusable();
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDrawer, open]);

  const context = useMemo<CartContextValue>(() => ({
    enabled: configuration.orderingEnabled,
    fulfillmentMode,
    totalUnits,
    add,
    addQuantity,
    decrease,
    quantityFor: (item) => getCartLineQuantity(items, getCartItemKey(item)),
    recentlyChangedKey,
    open: (opener) => {
      openerRef.current = opener ?? document.activeElement as HTMLElement | null;
      setStep("cart");
      setPrepared(null);
      setOpen(true);
    },
  }), [add, addQuantity, configuration.orderingEnabled, decrease, items, recentlyChangedKey, totalUnits, fulfillmentMode]);

  async function prepareOrder() {
    if (!branchId || !paymentMethod) {
      setMessage("Elegí una sucursal y una forma de pago.");
      return;
    }
    if (!deliveryReady) {
      setMessage(coffeeInCart && fulfillmentMode === "DELIVERY" ? COFFEE_DELIVERY_NOTICE : "Revisá el horario de envío, la dirección y la confirmación de zona.");
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setMessage("");
    try {
      if (paymentMethod === "MERCADO_PAGO") {
        const clientRequestId = checkoutRequestIdRef.current ?? window.crypto.randomUUID();
        checkoutRequestIdRef.current = clientRequestId;
        const response = await fetch("/api/orders/mercado-pago/create", {
          method: "POST",
          headers: { "content-type": "application/json", "x-idempotency-key": clientRequestId },
          body: JSON.stringify({ branchId, paymentMethod, items, fulfillment: { mode: "PICKUP" } }),
        });
        const body = await response.json().catch(() => null) as MercadoPagoCreateResponse | null;
        if (!response.ok || !body?.initPoint) {
          if (body?.code === "ITEM_UNAVAILABLE") router.refresh();
          throw new Error(body?.error ?? "No pudimos iniciar el pago con Mercado Pago. Intentá nuevamente.");
        }
        window.location.assign(body.initPoint);
        return;
      }

      const response = await fetch("/api/orders/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ branchId, paymentMethod, items, fulfillment: fulfillmentMode === "DELIVERY" ? { mode: "DELIVERY", address: deliveryAddress.trim(), details: deliveryDetails.trim(), zoneConfirmed } : { mode: "PICKUP" } }),
      });
      const body = await response.json().catch(() => null) as (PreparedResponse & { error?: string; code?: string }) | null;
      if (!response.ok || !body) {
        if (body?.code === "ITEM_UNAVAILABLE") router.refresh();
        throw new Error(body?.error ?? "No pudimos preparar el pedido. Intentá nuevamente.");
      }
      const mobile = isMobileDevice(window.navigator);
      setPrepared(body);
      setPreparedForMobile(mobile);
      setShowMobileFallback(false);
      setWhatsappHref(mobile ? body.mobileWhatsappUrl : body.desktopWhatsappUrl);
      setStep("prepared");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos preparar el pedido. Intentá nuevamente.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  function clearCart() {
    setItems([]);
    setPrepared(null);
    setWhatsappHref("");
    setPreparedForMobile(false);
    setShowMobileFallback(false);
    setFulfillmentMode("PICKUP");
    setDeliveryAddress("");
    setDeliveryDetails("");
    setZoneConfirmed(false);
    setStep("cart");
    announce("Pedido vaciado.");
  }

  function guardPreparedDelivery(event: MouseEvent<HTMLAnchorElement>) {
    if (prepared?.fulfillment.mode !== "DELIVERY") return true;
    const availability = getDeliveryAvailability(selectedBranch?.businessHours ?? [], new Date());
    if (availability.available && availability.date === prepared.deliveryDate) return true;
    event.preventDefault();
    setPrepared(null);
    setStep("checkout");
    setMessage("El envío preparado ya no está vigente. Revisá el horario o elegí retiro.");
    return false;
  }

  return (
    <CartContext.Provider value={context}>
      {children}
      <p className="public-cart-live" role="status" aria-live="polite" aria-atomic="true">{message}</p>
      {configuration.orderingEnabled && open && (
        <div className="public-cart-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDrawer(); }}>
          <div className="public-cart-drawer" ref={drawerRef} role="dialog" aria-modal="true" aria-labelledby="public-cart-title">
            <div className="public-cart-header">
              <div><p className="public-kicker">Tu selección</p><h2 id="public-cart-title">Pedido ({totalUnits})</h2></div>
              <button type="button" className="public-cart-close" onClick={closeDrawer} aria-label="Cerrar pedido">×</button>
            </div>

            {step === "cart" && (
              <>
                <div className="public-cart-body">
                  {items.length === 0 ? <p>Tu pedido todavía está vacío.</p> : items.map((item) => {
                    const key = getCartItemKey(item);
                    const product = productMap.get(key);
                    return (
                      <article className="public-cart-line" key={key}>
                        <div className="public-cart-line-image">
                          {product?.imageUrl ? <Image src={product.imageUrl} alt="" fill sizes="72px" /> : <span aria-hidden="true">R</span>}
                        </div>
                        <div className="public-cart-line-copy">
                          <h3>{product?.name ?? "Producto no disponible"}</h3>
                          {product?.variant && <p>{product.variant}</p>}
                          <strong>{product ? currencyFormatter.format(product.unitPriceCents / 100) : "Revisar"}</strong>
                          {product && <small>Subtotal: {currencyFormatter.format((product.unitPriceCents * item.quantity) / 100)}</small>}
                        </div>
                        <CartItemQuantityControl
                          name={product?.name ?? "producto"}
                          quantity={item.quantity}
                          onDecrease={() => setItems((current) => setCartItemQuantity(current, key, item.quantity - 1))}
                          onIncrease={() => setItems((current) => setCartItemQuantity(current, key, item.quantity + 1))}
                        />
                        <button className="public-cart-remove" type="button" onClick={() => setItems((current) => removeCartItem(current, key))}>Eliminar</button>
                      </article>
                    );
                  })}
                </div>
                <div className="public-cart-footer">
                  {estimatedDeliveryFeeCents > 0 && <p className="public-cart-note">Incluye {currencyFormatter.format(estimatedDeliveryFeeCents / 100)} de envío.</p>}
                  <div className="public-cart-total"><span>Total estimado</span><strong>{currencyFormatter.format(estimatedTotalWithDeliveryCents / 100)}</strong></div>
                  <button type="button" className="public-button public-button-dark" disabled={items.length === 0} onClick={() => setStep("checkout")}>Finalizar pedido</button>
                  {items.length > 0 && <button type="button" className="public-cart-clear" onClick={clearCart}>Vaciar pedido</button>}
                </div>
              </>
            )}

            {step === "checkout" && (
              <div className="public-cart-checkout">
                <button type="button" className="public-cart-back" onClick={() => setStep("cart")}>← Volver al pedido</button>
                <label>Sucursal<select value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">Elegí una sucursal</option>{branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name} — {branch.address}, {branch.city}</option>)}</select></label>
                {branches.length === 0 && <p className="form-message">No hay sucursales habilitadas para pedidos por WhatsApp.</p>}
                <fieldset><legend>¿Cómo querés recibirlo?</legend>
                  <label><input type="radio" name="fulfillment" checked={fulfillmentMode === "PICKUP"} onChange={() => setFulfillmentMode("PICKUP")} /> Retiro en el local</label>
                  <label><input type="radio" name="fulfillment" checked={fulfillmentMode === "DELIVERY"} disabled={!deliveryAvailability?.available} onChange={() => { setFulfillmentMode("DELIVERY"); if (paymentMethod === "MERCADO_PAGO") setPaymentMethod(""); }} /> Envío a domicilio · +{currencyFormatter.format(DELIVERY_FEE_CENTS / 100)}</label>
                  <p className="public-cart-note">{DELIVERY_HOURS_LABEL}</p>
                  <p className="public-cart-note">Zona: {DELIVERY_ZONE_LABEL}.</p>
                  {!branchId ? <p className="public-cart-note">Elegí una sucursal para consultar el horario de envío.</p> : !deliveryAvailability?.available ? <p className="public-cart-note">El envío no está disponible ahora para esta sucursal. Solo se encarga desde las 11:00 del mismo día y antes de las 15:00 o el cierre del local.</p> : <p className="public-cart-note">Entregas de hoy: {deliveryAvailability.windowLabel} hs.{deliveryAvailability.preOrder ? " Podés encargar ahora para ese horario." : ""}</p>}
                </fieldset>
                {fulfillmentMode === "DELIVERY" && <>
                  <label>Dirección de envío<input type="text" autoComplete="street-address" placeholder="Calle, número y piso/departamento" maxLength={300} value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} /></label>
                  <label>Indicaciones (opcional)<input type="text" placeholder="Por ejemplo, timbre o referencia de entrada" maxLength={300} value={deliveryDetails} onChange={(event) => setDeliveryDetails(event.target.value)} /></label>
                  <label className="public-delivery-zone"><input type="checkbox" checked={zoneConfirmed} onChange={(event) => setZoneConfirmed(event.target.checked)} /> Confirmo que la dirección está dentro de la zona entre Pellegrini, Oroño y el río.</label>
                  {coffeeInCart && <p className="form-message" role="alert">{COFFEE_DELIVERY_NOTICE} Volvé al pedido para quitar el combo con café y agregarlo con agua, o elegí retiro.</p>}
                </>}
                <fieldset><legend>Forma de pago</legend>
                  <label><input type="radio" name="payment" value="CASH" checked={paymentMethod === "CASH"} disabled={!configuration.cashEnabled} onChange={() => setPaymentMethod("CASH")} /> Efectivo {!configuration.cashEnabled && <small>No disponible</small>}</label>
                  <label><input type="radio" name="payment" value="TRANSFER" checked={paymentMethod === "TRANSFER"} disabled={!configuration.transferEnabled} onChange={() => setPaymentMethod("TRANSFER")} /> Transferencia {!configuration.transferEnabled && <small>No disponible</small>}</label>
                  <label><input type="radio" name="payment" value="MERCADO_PAGO" checked={paymentMethod === "MERCADO_PAGO"} disabled={!configuration.mercadoPagoEnabled || fulfillmentMode === "DELIVERY"} onChange={() => setPaymentMethod("MERCADO_PAGO")} /> Mercado Pago <small>{configuration.mercadoPagoEnabled && fulfillmentMode === "PICKUP" ? "Checkout Pro · Prueba" : "No disponible"}</small></label>
                </fieldset>
                {!configuration.cashEnabled && !configuration.transferEnabled && !configuration.mercadoPagoEnabled && <p className="form-message">Actualmente no hay formas de pago disponibles.</p>}
                <div className="public-cart-total"><span>Productos</span><strong>{currencyFormatter.format(estimatedTotalCents / 100)}</strong></div>
                {estimatedDeliveryFeeCents > 0 && <div className="public-cart-total"><span>Envío</span><strong>{currencyFormatter.format(estimatedDeliveryFeeCents / 100)}</strong></div>}
                <div className="public-cart-total"><span>Total estimado</span><strong>{currencyFormatter.format(estimatedTotalWithDeliveryCents / 100)}</strong></div>
                <button type="button" className="public-button public-button-dark" disabled={submitting || !branchId || !paymentMethod || !deliveryReady} onClick={() => void prepareOrder()}>{submitting ? (paymentMethod === "MERCADO_PAGO" ? "Iniciando pago…" : "Validando…") : (paymentMethod === "MERCADO_PAGO" ? "Pagar con Mercado Pago" : "Preparar pedido")}</button>
                {message && <p className="form-message" role="alert">{message}</p>}
              </div>
            )}

            {step === "prepared" && prepared && (
              <div className="public-cart-checkout public-cart-prepared">
                <p className="public-kicker">Pedido validado</p>
                <h3>Revisá el total y continuá en WhatsApp</h3>
                <ul>{prepared.lines.map((line) => <li key={line.key}><span>{line.quantity} × {line.name}{line.variant ? ` — ${line.variant}` : ""}</span><strong>{currencyFormatter.format(line.subtotalCents / 100)}</strong></li>)}</ul>
                <p>Modalidad: <strong>{prepared.fulfillment.mode === "DELIVERY" ? "Envío a domicilio" : "Retiro en el local"}</strong></p>
                {prepared.fulfillment.mode === "DELIVERY" && <>
                  <p>Dirección: <strong>{prepared.fulfillment.address}</strong></p>
                  {prepared.fulfillment.details && <p>Indicaciones: {prepared.fulfillment.details}</p>}
                  <p>Entrega de hoy: {prepared.deliveryWindow} hs, a confirmar por el local.</p>
                  <div className="public-cart-total"><span>Productos</span><strong>{currencyFormatter.format(prepared.subtotalCents / 100)}</strong></div>
                  <div className="public-cart-total"><span>Envío</span><strong>{currencyFormatter.format(prepared.deliveryFeeCents / 100)}</strong></div>
                </>}
                <div className="public-cart-total"><span>Total actual</span><strong>{currencyFormatter.format(prepared.totalCents / 100)}</strong></div>
                <p>Sucursal: <strong>{prepared.branchName}</strong></p>
                {prepared.fulfillment.mode === "DELIVERY" && !preparedDeliveryCurrent ? <p className="form-message">El envío preparado ya no está vigente. Volvé al pedido para actualizarlo o elegí retiro.</p> : <a className="public-button public-button-dark" href={whatsappHref} target="_blank" rel="noopener noreferrer" onClick={(event) => {
                  if (!guardPreparedDelivery(event)) return;
                  if (preparedForMobile) setShowMobileFallback(true);
                }}>Continuar por WhatsApp</a>}
                {preparedForMobile && showMobileFallback && (prepared.fulfillment.mode === "PICKUP" || preparedDeliveryCurrent) && (
                  <a className="public-cart-back" href={prepared.mobileFallbackWhatsappUrl} target="_blank" rel="noopener noreferrer" onClick={guardPreparedDelivery}>¿No se abrió la app? Continuar en WhatsApp</a>
                )}
                <p className="public-cart-note">WhatsApp abrirá el chat con el texto precargado. Podés revisarlo antes de enviarlo; el carrito se conserva.</p>
                <button type="button" className="public-cart-back" onClick={() => setStep("cart")}>Volver al pedido</button>
                <button type="button" className="public-cart-clear" onClick={clearCart}>Vaciar pedido</button>
              </div>
            )}
          </div>
        </div>
      )}
      {configuration.orderingEnabled && shouldShowCartBottomBar(items) && (
        <CartBottomBar
          items={items}
          products={productMap}
          totalUnits={totalUnits}
          estimatedTotalCents={estimatedTotalWithDeliveryCents}
          onOpen={(opener) => context.open(opener)}
        />
      )}
    </CartContext.Provider>
  );
}
