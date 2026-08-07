export type PreparedImage = {
  imageId: string;
  tempPath: string;
  finalPath: string;
  publicUrl: string;
};

export async function runImageMutation<T>({
  prepare,
  persist,
  confirm,
  rollback,
  deletePrevious,
}: {
  prepare: (() => Promise<PreparedImage>) | null;
  persist: (prepared: PreparedImage | null) => Promise<T>;
  confirm: (prepared: PreparedImage) => Promise<void>;
  rollback: (prepared: PreparedImage) => Promise<void>;
  deletePrevious?: () => Promise<void>;
}) {
  const prepared = prepare ? await prepare() : null;

  let result: T;
  try {
    result = await persist(prepared);
  } catch (error) {
    if (prepared) await rollback(prepared).catch(() => undefined);
    throw error;
  }

  if (prepared) {
    await confirm(prepared);
    if (deletePrevious) await deletePrevious();
  }

  return result;
}

export async function cancelTemporaryImage(
  imageId: string | null,
  discard: (imageId: string) => Promise<void>,
) {
  if (imageId) await discard(imageId);
}
