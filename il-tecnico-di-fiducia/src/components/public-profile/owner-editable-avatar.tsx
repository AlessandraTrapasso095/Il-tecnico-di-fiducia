"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { ProfileAvatar } from "@/components/ui/profile-avatar";
import type { PublicProfessionalProfileDetails } from "@/lib/server/professional-profile";

type CropState = {
  file: File;
  previewUrl: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
};

function drawAvatarCrop({
  bitmap,
  canvas,
  zoom,
  offsetX,
  offsetY,
}: {
  bitmap: ImageBitmap;
  canvas: HTMLCanvasElement;
  zoom: number;
  offsetX: number;
  offsetY: number;
}) {
  const width = 512;
  const height = 512;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas non disponibile.");
  }

  ctx.fillStyle = "#f9f9ff";
  ctx.fillRect(0, 0, width, height);

  const coverScale =
    Math.max(width / bitmap.width, height / bitmap.height) * zoom;

  const drawWidth = bitmap.width * coverScale;
  const drawHeight = bitmap.height * coverScale;

  const dx = (width - drawWidth) / 2 + offsetX;
  const dy = (height - drawHeight) / 2 + offsetY;

  ctx.drawImage(bitmap, dx, dy, drawWidth, drawHeight);
}

async function cropAvatarToFile({
  file,
  zoom,
  offsetX,
  offsetY,
}: {
  file: File;
  zoom: number;
  offsetX: number;
  offsetY: number;
}) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");

  try {
    drawAvatarCrop({
      bitmap,
      canvas,
      zoom,
      offsetX,
      offsetY,
    });
  } finally {
    bitmap.close();
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.9);
  });

  if (!blob) {
    throw new Error("Impossibile preparare l’immagine.");
  }

  return new File([blob], "avatar.jpg", {
    type: "image/jpeg",
  });
}

export function OwnerEditableAvatar({
  profile,
  isOwner,
}: {
  profile: PublicProfessionalProfileDetails;
  isOwner: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const cropPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const cameraStreamRef = useRef<MediaStream | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);

  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  const activePreviewUrlRef = useRef<string | null>(null);

  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);

  const [menuOpen, setMenuOpen] = useState(false);

  const [cameraOpen, setCameraOpen] = useState(false);

  const [cameraStarting, setCameraStarting] = useState(false);

  const [preparingPhoto, setPreparingPhoto] = useState(false);

  const [cropState, setCropState] = useState<CropState | null>(null);

  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (
        menuRef.current?.contains(target) ||
        menuButtonRef.current?.contains(target)
      ) {
        return;
      }

      setMenuOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    return () => {
      const previewUrl = activePreviewUrlRef.current;

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    };
  }, []);

  async function openCropForFile(file: File) {
    setPreparingPhoto(true);
    setError(null);

    const previewUrl = URL.createObjectURL(file);
    const image = new Image();

    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Immagine non decodificabile."));
        image.src = previewUrl;
      });

      if (activePreviewUrlRef.current) {
        URL.revokeObjectURL(activePreviewUrlRef.current);
      }

      activePreviewUrlRef.current = previewUrl;

      setCropState({
        file,
        previewUrl,
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      });
    } catch {
      URL.revokeObjectURL(previewUrl);

      setError(
        "Non è stato possibile leggere questa immagine. Prova con un file JPG, PNG o WebP.",
      );
    } finally {
      setPreparingPhoto(false);
    }
  }

  function onPickImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    setMenuOpen(false);

    void openCropForFile(file);
  }

  function openDevicePicker() {
    setMenuOpen(false);

    window.setTimeout(() => {
      fileInputRef.current?.click();
    }, 0);
  }

  function stopCamera() {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraStarting(false);
    setCameraOpen(false);
  }

  async function startCamera() {
    setMenuOpen(false);
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "La fotocamera non è disponibile su questo dispositivo o browser.",
      );
      return;
    }

    setCameraOpen(true);
    setCameraStarting(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
        },
        audio: false,
      });

      cameraStreamRef.current = stream;
    } catch {
      stopCamera();
      setError(
        "Non è stato possibile accedere alla fotocamera. Controlla i permessi del browser.",
      );
    } finally {
      setCameraStarting(false);
    }
  }

  useEffect(() => {
    if (!cameraOpen || cameraStarting) {
      return;
    }

    const video = videoRef.current;
    const stream = cameraStreamRef.current;

    if (!video || !stream) {
      return;
    }

    video.srcObject = stream;

    void video.play().catch(() => {
      setError("Non è stato possibile avviare l’anteprima della fotocamera.");
    });
  }, [cameraOpen, cameraStarting]);

  async function captureCameraFrame() {
    const video = videoRef.current;

    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setError(
        "La fotocamera non è ancora pronta. Attendi un momento e riprova.",
      );
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      setError("Impossibile acquisire la foto dalla fotocamera.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });

    if (!blob) {
      setError("Impossibile preparare la foto acquisita.");
      return;
    }

    const file = new File([blob], "camera-avatar.jpg", {
      type: "image/jpeg",
    });

    stopCamera();

    await openCropForFile(file);
  }

  useEffect(() => {
    if (!cropState) {
      return;
    }

    const canvas = cropPreviewCanvasRef.current;

    if (!canvas) {
      return;
    }

    const currentCropState = cropState;
    const currentCanvas = canvas;

    let disposed = false;

    async function renderPreview() {
      try {
        const bitmap = await createImageBitmap(currentCropState.file);

        if (disposed) {
          bitmap.close();
          return;
        }

        try {
          drawAvatarCrop({
            bitmap,
            canvas: currentCanvas,
            zoom: currentCropState.zoom,
            offsetX: currentCropState.offsetX,
            offsetY: currentCropState.offsetY,
          });
        } finally {
          bitmap.close();
        }
      } catch {
        if (!disposed) {
          setError("Non è stato possibile aggiornare l’anteprima della foto.");
        }
      }
    }

    void renderPreview();

    return () => {
      disposed = true;
    };
  }, [cropState]);

  function closeCrop() {
    if (uploading) {
      return;
    }

    if (cropState?.previewUrl) {
      URL.revokeObjectURL(cropState.previewUrl);
      activePreviewUrlRef.current = null;
    }

    setCropState(null);
    setError(null);
  }

  async function uploadAvatar() {
    if (!cropState || uploading) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const cropped = await cropAvatarToFile(cropState);

      const formData = new FormData();

      formData.append("file", cropped);

      const response = await fetch("/api/uploads/avatar", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      const payload = (await response.json().catch(() => ({}))) as {
        avatar_url?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Upload non riuscito.");
      }

      if (!payload.avatar_url) {
        throw new Error("URL avatar non ricevuto.");
      }

      setAvatarUrl(payload.avatar_url);

      window.dispatchEvent(
        new CustomEvent("professional-avatar-updated", {
          detail: {
            avatar_url: payload.avatar_url,
          },
        }),
      );

      URL.revokeObjectURL(cropState.previewUrl);
      activePreviewUrlRef.current = null;

      setCropState(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload non riuscito.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div className="relative w-fit shrink-0">
        <ProfileAvatar
          person={{
            ...profile,
            avatar_url: avatarUrl,
          }}
          alt={
            `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
            "Professionista"
          }
          size="2xl"
          priority
          className="border-4 border-primary-fixed bg-surface-container-high text-primary shadow-sm"
          fallbackClassName="font-headline-md"
        />

        {isOwner ? (
          <div className="absolute bottom-0 right-0">
            <button
              ref={menuButtonRef}
              type="button"
              aria-label="Modifica foto profilo"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((current) => !current)}
              className="flex size-10 items-center justify-center rounded-full border-2 border-surface bg-[#FF8500] text-white shadow-lg transition hover:bg-[#FF9A2B]"
            >
              <span className="material-symbols-outlined text-[20px]">
                photo_camera
              </span>
            </button>

            {menuOpen ? (
              <div
                ref={menuRef}
                className="absolute bottom-12 left-0 z-40 w-[210px] overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-2 shadow-xl sm:left-auto sm:right-0"
              >
                <button
                  type="button"
                  onClick={openDevicePicker}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold text-primary transition hover:bg-primary-fixed"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    upload
                  </span>
                  Scegli dal dispositivo
                </button>

                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-bold text-primary transition hover:bg-primary-fixed"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    photo_camera
                  </span>
                  Scatta una foto
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {isOwner ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={onPickImage}
          />
        </>
      ) : null}

      {isOwner && cameraOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="owner-avatar-camera-title"
          className="fixed inset-0 z-[125] flex items-center justify-center bg-inverse-surface/50 p-3 backdrop-blur-sm sm:p-5"
        >
          <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[560px] flex-col overflow-hidden rounded-[22px] bg-surface-container-lowest shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-[28px]">
            <div className="flex items-start justify-between gap-4 px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
              <div>
                <h2
                  id="owner-avatar-camera-title"
                  className="font-headline-sm text-[21px] text-primary sm:text-[24px]"
                >
                  Scatta una foto
                </h2>

                <p className="mt-1 text-sm text-on-surface-variant">
                  Posizionati al centro dell’inquadratura.
                </p>
              </div>

              <button
                type="button"
                aria-label="Chiudi fotocamera"
                onClick={stopCamera}
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-primary transition hover:bg-primary-fixed sm:size-11"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="min-h-0 px-3 sm:px-6">
              <div className="relative mx-auto aspect-[4/3] w-full max-w-[480px] overflow-hidden rounded-2xl bg-black">
                {cameraStarting ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center text-sm font-bold text-white">
                    <span className="material-symbols-outlined mr-2 animate-spin">
                      progress_activity
                    </span>
                    Avvio fotocamera…
                  </div>
                ) : null}

                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            {error ? (
              <div
                role="alert"
                className="mx-4 mt-4 rounded-2xl bg-error-container p-3 text-sm text-on-error-container sm:mx-6"
              >
                {error}
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 px-4 py-4 sm:flex-row sm:justify-end sm:px-6 sm:py-5">
              <button
                type="button"
                onClick={stopCamera}
                className="min-h-11 rounded-full px-6 py-3 font-button text-primary transition hover:bg-primary-fixed"
              >
                Annulla
              </button>

              <button
                type="button"
                disabled={cameraStarting}
                onClick={() => void captureCameraFrame()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#FF8500] px-7 py-3 font-button text-white transition hover:bg-[#FF9A2B] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[19px]">
                  photo_camera
                </span>
                Scatta foto
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isOwner && preparingPhoto ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[130] flex items-center justify-center bg-inverse-surface/35 p-4 backdrop-blur-sm"
        >
          <div className="flex w-full max-w-[320px] flex-col items-center rounded-[22px] bg-surface-container-lowest px-6 py-7 text-center shadow-2xl">
            <span className="material-symbols-outlined animate-spin text-[32px] text-[#FF8500]">
              progress_activity
            </span>

            <p className="mt-4 font-bold text-primary">
              Caricamento foto in corso…
            </p>

            <p className="mt-1 text-sm text-on-surface-variant">
              Stiamo preparando l’anteprima.
            </p>
          </div>
        </div>
      ) : null}

      {isOwner && cropState ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="owner-avatar-crop-title"
          className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4"
        >
          <div className="absolute inset-0 bg-inverse-surface/50 backdrop-blur-sm" />

          <div className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-[520px] overflow-y-auto rounded-[22px] bg-surface-container-lowest p-4 shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-[26px] sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="owner-avatar-crop-title"
                  className="font-headline-sm text-[21px] text-primary sm:text-[23px]"
                >
                  Sistema foto profilo
                </h2>

                <p className="mt-1 text-sm text-on-surface-variant">
                  Regola zoom e posizione prima di confermare.
                </p>
              </div>

              <button
                type="button"
                aria-label="Chiudi"
                disabled={uploading}
                onClick={closeCrop}
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-primary transition hover:bg-primary-fixed disabled:opacity-50"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mt-4 rounded-2xl bg-surface-container-low p-3 sm:p-4">
              <div className="relative mx-auto size-[min(280px,calc(100vw-4rem))] overflow-hidden rounded-full bg-surface-container-high">
                <canvas
                  ref={cropPreviewCanvasRef}
                  role="img"
                  aria-label="Anteprima foto profilo"
                  width={512}
                  height={512}
                  className="absolute inset-0 h-full w-full"
                />

                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/90 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.16)]"
                />
              </div>

              <p className="mt-3 text-center text-xs text-on-surface-variant">
                Il contenuto dentro il cerchio sarà la tua foto profilo.
              </p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <AvatarSlider
                label="Zoom"
                min={1}
                max={2.2}
                step={0.05}
                value={cropState.zoom}
                onChange={(value) =>
                  setCropState((current) =>
                    current
                      ? {
                          ...current,
                          zoom: value,
                        }
                      : current,
                  )
                }
              />

              <AvatarSlider
                label="Destra / Sinistra"
                min={-160}
                max={160}
                step={1}
                value={cropState.offsetX}
                onChange={(value) =>
                  setCropState((current) =>
                    current
                      ? {
                          ...current,
                          offsetX: value,
                        }
                      : current,
                  )
                }
              />

              <AvatarSlider
                label="Alto / Basso"
                min={-160}
                max={160}
                step={1}
                value={cropState.offsetY}
                onChange={(value) =>
                  setCropState((current) =>
                    current
                      ? {
                          ...current,
                          offsetY: value,
                        }
                      : current,
                  )
                }
              />
            </div>

            {error ? (
              <div
                role="alert"
                className="mt-5 rounded-2xl bg-error-container p-4 text-sm text-on-error-container"
              >
                {error}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={uploading}
                onClick={closeCrop}
                className="min-h-11 rounded-full px-6 py-3 font-button text-primary transition hover:bg-primary-fixed disabled:opacity-50"
              >
                Annulla
              </button>

              <button
                type="button"
                disabled={uploading}
                onClick={() => void uploadAvatar()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#FF8500] px-7 py-3 font-button text-white transition hover:bg-[#FF9A2B] disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[19px]">
                      progress_activity
                    </span>
                    Caricamento…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[19px]">
                      check
                    </span>
                    Conferma
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function AvatarSlider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-primary">{label}</span>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full accent-[#FF8500]"
      />
    </label>
  );
}
