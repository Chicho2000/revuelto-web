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
import {
  CART_STORAGE_KEY,
  getCartItemKey,
  getTotalCartUnits,
  type CartItem,
  type CartItemInput,
  type OrderPaymentMethod,
} from "@/lib/orders/schema";
import { CartBottomBar } from "./cart-bottom-bar";
import { CartItemQuantityControl } from "./cart-item-quantity-control";

export type PublicOrderProduct = {
  key: string;
  type: "BOWL" | "MERCHANDISE";
  productId: string;
  size?: "SMALL" | "LARGE";
  name: string;
  variant: string | null;
  unitPriceCents: number;
  imageUrl: string | null;
};

export type PublicOrderBranch = { id: string; name: string; address: string; city: string };
export type PublicOrderConfiguration = {
  orderingEnabled: boolean;
  cashEnabled: boolean;
  transferEnabled: boolean;
  mercadoPagoEnabled: boolean;
};

type PreparedResponse = {
  lines: Array<{
    key: string;
    type: "BOWL" | "MERCHANDISE";
    name: string;
    variant: string | null;
    quantity: number;
    unitPriceCents: number;
    subtotalCents: number;
  }>;
  totalCents: number;
  whatsappUrl: string;
  branchName: string;
  paymentMethod: OrderPaymentMethod;
};

type CartContextValue = {
  enabled: boolean;
  totalUnits: number;
  add: (item: CartItemInput) => void;
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
  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod | "">("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [prepared, setPrepared] = useState<PreparedResponse | null>(null);
  const [recentlyChangedKey, setRecentlyChangedKey] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const liveTimeoutRef = useRef<number | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);

  const productMap = useMemo(() => new Map(products.map((product) => [product.key, product])), [products]);
  const pricesByKey = useMemo(() => new Map(products.map((product) => [product.key, product.unitPriceCents])), [products]);
  const totalUnits = getTotalCartUnits(items);
  const estimatedTotalCents = getEstimatedCartTotalCents(items, pricesByKey);

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

  const add = useCallback((item: CartItemInput) => {
    const next = addCartItem(items, item);
    const changed = serializeCart(next) !== serializeCart(items);
    announce(changed ? "Agregado al pedido." : "Alcanzaste el límite del pedido.");
    if (changed) markChanged(getCartItemKey(item));
    setItems(next);
  }, [announce, items, markChanged]);

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
    totalUnits,
    add,
    decrease,
    quantityFor: (item) => getCartLineQuantity(items, getCartItemKey(item)),
    recentlyChangedKey,
    open: (opener) => {
      openerRef.current = opener ?? document.activeElement as HTMLElement | null;
      setStep("cart");
      setPrepared(null);
      setOpen(true);
    },
  }), [add, configuration.orderingEnabled, decrease, items, recentlyChangedKey, totalUnits]);

  async function prepareOrder() {
    if (!branchId || !paymentMethod) {
      setMessage("Elegí una sucursal y una forma de pago.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/orders/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ branchId, paymentMethod, items }),
      });
      const body = await response.json().catch(() => null) as (PreparedResponse & { error?: string; code?: string }) | null;
      if (!response.ok || !body) {
        if (body?.code === "ITEM_UNAVAILABLE") router.refresh();
        throw new Error(body?.error ?? "No pudimos preparar el pedido. Intentá nuevamente.");
      }
      setPrepared(body);
      setStep("prepared");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos preparar el pedido. Intentá nuevamente.");
    } finally {
      setSubmitting(false);
    }
  }

  function clearCart() {
    setItems([]);
    setPrepared(null);
    setStep("cart");
    announce("Pedido vaciado.");
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
                  <div className="public-cart-total"><span>Total estimado</span><strong>{currencyFormatter.format(estimatedTotalCents / 100)}</strong></div>
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
                <fieldset><legend>Forma de pago</legend>
                  <label><input type="radio" name="payment" value="CASH" checked={paymentMethod === "CASH"} disabled={!configuration.cashEnabled} onChange={() => setPaymentMethod("CASH")} /> Efectivo {!configuration.cashEnabled && <small>No disponible</small>}</label>
                  <label><input type="radio" name="payment" value="TRANSFER" checked={paymentMethod === "TRANSFER"} disabled={!configuration.transferEnabled} onChange={() => setPaymentMethod("TRANSFER")} /> Transferencia {!configuration.transferEnabled && <small>No disponible</small>}</label>
                  <label><input type="radio" name="payment" value="MERCADO_PAGO" disabled checked={false} readOnly /> Mercado Pago <small>{configuration.mercadoPagoEnabled ? "Integración pendiente" : "No disponible"}</small></label>
                </fieldset>
                {!configuration.cashEnabled && !configuration.transferEnabled && <p className="form-message">Actualmente no hay formas de pago disponibles.</p>}
                <button type="button" className="public-button public-button-dark" disabled={submitting || !branchId || !paymentMethod} onClick={() => void prepareOrder()}>{submitting ? "Validando…" : "Preparar pedido"}</button>
                {message && <p className="form-message" role="alert">{message}</p>}
              </div>
            )}

            {step === "prepared" && prepared && (
              <div className="public-cart-checkout public-cart-prepared">
                <p className="public-kicker">Pedido validado</p>
                <h3>Revisá el total y continuá en WhatsApp</h3>
                <ul>{prepared.lines.map((line) => <li key={line.key}><span>{line.quantity} × {line.name}{line.variant ? ` — ${line.variant}` : ""}</span><strong>{currencyFormatter.format(line.subtotalCents / 100)}</strong></li>)}</ul>
                <div className="public-cart-total"><span>Total actual</span><strong>{currencyFormatter.format(prepared.totalCents / 100)}</strong></div>
                <p>Sucursal: <strong>{prepared.branchName}</strong></p>
                <a className="public-button public-button-dark" href={prepared.whatsappUrl} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>
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
          estimatedTotalCents={estimatedTotalCents}
          onOpen={(opener) => context.open(opener)}
        />
      )}
    </CartContext.Provider>
  );
}
