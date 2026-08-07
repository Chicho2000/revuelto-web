export async function submitContentDraft<T>(
  draft: T,
  persist: (value: T) => Promise<void>,
): Promise<{ draft: T; error: string | null }> {
  try {
    await persist(draft);
    return { draft, error: null };
  } catch (error) {
    return {
      draft,
      error: error instanceof Error ? error.message : "No se pudieron guardar los cambios.",
    };
  }
}
