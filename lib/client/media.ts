import { fileKind, LIMITS } from '@/lib/core/rules';
export async function prepareMedia(file: File, onProgress: (value: string) => void): Promise<File> {
  const kind = fileKind(file.type);
  if (!kind) throw new Error('Scegli un’immagine JPEG, PNG, WebP o un video MP4/WebM.');
  if (file.size > 100 * 1024 * 1024)
    throw new Error('Il file originale supera 100 MB. Scegli un file più piccolo.');
  if (kind === 'image') {
    onProgress('Preparo l’immagine…');
    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      throw new Error('Impossibile elaborare l’immagine.');
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.82),
    );
    if (!blob || blob.size > LIMITS.file)
      throw new Error('L’immagine è troppo grande anche dopo la compressione.');
    return new File([blob], 'immagine.webp', { type: 'image/webp' });
  }
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Video non leggibile.'));
    });
    if (!Number.isFinite(video.duration) || video.duration > LIMITS.videoSeconds)
      throw new Error('Per la beta scegli un video di massimo 20 secondi.');
    const capture = video as HTMLVideoElement & { captureStream?: () => MediaStream };
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(
      (t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t),
    );
    if (capture.captureStream && mime) {
      onProgress('Comprimo il video: occorrono circa 20 secondi.');
      await video.play();
      const stream = capture.captureStream();
      const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: 650000,
        audioBitsPerSecond: 64000,
      });
      try {
        const blob = await new Promise<Blob>((resolve, reject) => {
          const chunks: Blob[] = [];
          const timeout = setTimeout(() => {
            if (recorder.state !== 'inactive') recorder.stop();
            reject(new Error('Compressione interrotta. Riprova con un video più corto.'));
          }, 30000);
          recorder.ondataavailable = (e) => {
            if (e.data.size) chunks.push(e.data);
          };
          recorder.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('Compressione video non riuscita.'));
          };
          recorder.onstop = () => {
            clearTimeout(timeout);
            resolve(new Blob(chunks, { type: 'video/webm' }));
          };
          video.onended = () => {
            if (recorder.state !== 'inactive') recorder.stop();
          };
          recorder.start(200);
        });
        if (blob.size > 0 && blob.size <= LIMITS.file)
          return new File([blob], 'video.webm', { type: 'video/webm' });
      } finally {
        stream.getTracks().forEach((t) => t.stop());
      }
    }
    if (file.size > LIMITS.file)
      throw new Error('Questo browser non può comprimere il video. Scegli un file entro 3 MB.');
    return file;
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}
export function asDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Lettura del file non riuscita.'));
    reader.readAsDataURL(file);
  });
}
