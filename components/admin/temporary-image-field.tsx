"use client";

import Image from "next/image";
import {
  ChangeEvent,
  DragEvent,
  forwardRef,
  KeyboardEvent,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp"];

async function discardImage(imageId: string, keepalive = false) {
  await fetch("/admin/images/discard", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageId }),
    credentials: "same-origin",
    keepalive,
  });
}

export type TemporaryImageFieldHandle = {
  commit: () => void;
  discard: () => Promise<void>;
};

export const TemporaryImageField = forwardRef<
  TemporaryImageFieldHandle,
  {
    target: "BOWL" | "PROMOTION" | "GALLERY";
    label: string;
    previewAlt: string;
    initialImageUrl?: string | null;
    allowRemove?: boolean;
    disabled: boolean;
    onImageIdChange: (imageId: string | null) => void;
    onRemove: () => void;
    onBusyChange: (busy: boolean) => void;
    onError: (message: string) => void;
    showPlayIndicator?: boolean;
  }
>(function TemporaryImageField(
  {
    target,
    label,
    previewAlt,
    initialImageUrl = null,
    allowRemove = true,
    disabled,
    onImageIdChange,
    onRemove,
    onBusyChange,
    onError,
    showPlayIndicator = false,
  },
  ref,
) {
  const temporaryImageRef = useRef<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialImageUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    onBusyChange(isUploading);
  }, [isUploading, onBusyChange]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      if (temporaryImageRef.current) {
        void discardImage(temporaryImageRef.current, true).catch(() => undefined);
      }
    };
  }, []);

  async function discardCurrent() {
    const imageId = temporaryImageRef.current;
    temporaryImageRef.current = null;
    onImageIdChange(null);
    if (imageId) await discardImage(imageId).catch(() => undefined);
  }

  useImperativeHandle(ref, () => ({
    commit() {
      temporaryImageRef.current = null;
    },
    discard: discardCurrent,
  }));

  function replaceObjectPreview(file: File) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = URL.createObjectURL(file);
    setPreviewUrl(objectUrlRef.current);
  }

  async function uploadImage(file: File) {
    if (!acceptedImageTypes.includes(file.type)) {
      onError("Elegí una imagen JPEG, PNG o WebP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      onError("La imagen no puede superar 5 MB.");
      return;
    }

    setIsUploading(true);
    let imageId: string | null = null;
    try {
      await discardCurrent();
      const intentResponse = await fetch("/admin/images/upload-intent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const intent = (await intentResponse.json().catch(() => null)) as
        | { imageId?: string; uploadUrl?: string; error?: string }
        | null;
      if (!intentResponse.ok || !intent?.imageId || !intent.uploadUrl) {
        throw new Error(intent?.error ?? "No se pudo preparar la imagen.");
      }
      imageId = intent.imageId;

      const uploadResponse = await fetch(intent.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type, "x-upsert": "false" },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error("No se pudo subir la imagen.");

      const completeResponse = await fetch("/admin/images/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageId }),
      });
      const completed = (await completeResponse.json().catch(() => null)) as
        | { error?: string; status?: string }
        | null;
      if (!completeResponse.ok || completed?.status !== "ready") {
        throw new Error(completed?.error ?? "La imagen no pudo procesarse.");
      }

      temporaryImageRef.current = imageId;
      onImageIdChange(imageId);
      replaceObjectPreview(file);
    } catch (reason) {
      if (imageId) await discardImage(imageId).catch(() => undefined);
      onError(reason instanceof Error ? reason.message : "No se pudo cargar la imagen.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void uploadImage(file);
  }

  const blocked = disabled || isUploading;
  const openFilePicker = () => {
    if (!blocked) fileInputRef.current?.click();
  };

  return (
    <div className="admin-image-field">
      <div
        className={`admin-dropzone${isDragging ? " is-dragging" : ""}`}
        role="button"
        tabIndex={blocked ? -1 : 0}
        aria-disabled={blocked}
        onClick={openFilePicker}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openFilePicker();
          }
        }}
        onDragOver={(event: DragEvent<HTMLDivElement>) => {
          event.preventDefault();
          if (!blocked) setIsDragging(true);
        }}
        onDragLeave={(event: DragEvent<HTMLDivElement>) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
        }}
        onDrop={(event: DragEvent<HTMLDivElement>) => {
          event.preventDefault();
          setIsDragging(false);
          if (!blocked) {
            const file = event.dataTransfer.files.item(0);
            if (file) void uploadImage(file);
          }
        }}
      >
        <strong>{label}</strong>
        <p>JPEG, PNG o WebP. Máximo 5 MB, 6000×6000 y 24 MP.</p>
        <p className="admin-dropzone-hint">Arrastrá una imagen aquí o elegí un archivo.</p>
        <span className="admin-file-button" aria-hidden="true">
          {isUploading ? "Procesando…" : previewUrl ? "Reemplazar imagen" : "Cargar imagen"}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileInputChange}
          disabled={blocked}
          tabIndex={-1}
        />
      </div>
      <div className="admin-image-preview">
        {previewUrl ? (
          <>
            <Image src={previewUrl} alt={previewAlt} width={480} height={320} unoptimized />
            {showPlayIndicator && <span className="admin-play-indicator" aria-hidden="true">▶</span>}
            {allowRemove && (
              <button
                className="admin-remove-image"
                type="button"
                disabled={blocked}
                onClick={async () => {
                  await discardCurrent();
                  setPreviewUrl(null);
                  onRemove();
                }}
              >
                Quitar imagen
              </button>
            )}
          </>
        ) : (
          <span>Sin imagen</span>
        )}
      </div>
    </div>
  );
});
