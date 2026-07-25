import imageCompression from "browser-image-compression";

export const MAX_MEDIA_PER_POST = 4;
export const MAX_VIDEO_PER_POST = 1;

export const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

const IMAGE_OUTPUT_MAX_MB = 0.8;
const IMAGE_MAX_WIDTH_OR_HEIGHT = 1600;

export type PreparedPostMedia = {
  files: File[];
  imagesCount: number;
  videosCount: number;
};

function isImage(file: File) {
  return file.type.startsWith("image/");
}

function isVideo(file: File) {
  return file.type.startsWith("video/");
}

export async function compressPostImage(file: File): Promise<File> {
  if (!isImage(file)) {
    throw new Error("Il file selezionato non è un’immagine.");
  }

  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error("Immagine troppo grande. Il limite massimo è 25 MB.");
  }

  try {
    const compressedBlob = await imageCompression(file, {
      maxSizeMB: IMAGE_OUTPUT_MAX_MB,
      maxWidthOrHeight: IMAGE_MAX_WIDTH_OR_HEIGHT,
      useWebWorker: true,
      fileType: "image/webp",
      initialQuality: 0.82,
      preserveExif: false,
    });

    const baseName =
      file.name.replace(/\.[^/.]+$/, "").trim() || "immagine";

    return new File(
      [compressedBlob],
      `${baseName}.webp`,
      {
        type: "image/webp",
        lastModified: Date.now(),
      },
    );
  } catch {
    throw new Error(
      `Non è stato possibile ottimizzare l’immagine “${file.name}”.`,
    );
  }
}

export async function preparePostMedia(
  selectedFiles: File[],
): Promise<PreparedPostMedia> {
  if (selectedFiles.length === 0) {
    return {
      files: [],
      imagesCount: 0,
      videosCount: 0,
    };
  }

  if (selectedFiles.length > MAX_MEDIA_PER_POST) {
    throw new Error(
      "Puoi allegare al massimo 4 foto o video per post.",
    );
  }

  const images = selectedFiles.filter(isImage);
  const videos = selectedFiles.filter(isVideo);
  const unsupported = selectedFiles.filter(
    (file) => !isImage(file) && !isVideo(file),
  );

  if (unsupported.length > 0) {
    throw new Error(
      "Formato non supportato. Usa JPG, PNG, WebP, MP4 o MOV.",
    );
  }

  if (videos.length > MAX_VIDEO_PER_POST) {
    throw new Error("Puoi allegare al massimo un video per post.");
  }

  const oversizedVideo = videos.find(
    (file) => file.size > MAX_VIDEO_BYTES,
  );

  if (oversizedVideo) {
    throw new Error("Video troppo grande, massimo 25 MB.");
  }

  const preparedImages = await Promise.all(
    images.map((file) => compressPostImage(file)),
  );

  return {
    files: [...preparedImages, ...videos],
    imagesCount: preparedImages.length,
    videosCount: videos.length,
  };
}