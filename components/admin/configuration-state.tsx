export function AdminConfigurationState() {
  return (
    <main className="admin-shell">
      <section className="admin-panel">
        <p className="eyebrow">Configuración pendiente</p>
        <h1>El panel todavía no está conectado.</h1>
        <p>
          Completá las variables de Supabase y PostgreSQL en <code>.env.local</code>{" "}
          para habilitar el acceso administrativo.
        </p>
      </section>
    </main>
  );
}
