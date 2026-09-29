import { fileKind, LIMITS } from '@/lib/core/rules';

function detectedType(file: File) {
  if (file.type) return file.type.toLowerCase();
  const extension = file.name.split('.').pop()?.toLowerCase();
  return extension === 'heic'
    ? 'image/heic'
    : extension === 'heif'
      ? 'image/heif'
      : extension === 'mov'
        ? 'video/quicktime'
        : extension === 'm4v'
          ? 'video/mp4'
          : '';
}

async function imageSource(file: File) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (context: CanvasRenderingContext2D, width: number, height: number) =>
        context.drawImage(bitmap, 0, 0, width, height),
      close: () => bitmap.close(),
    };
  } catch {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
      return {
        width: image.naturalWidth,
        height: image.naturalHeight,
        draw: (context: CanvasRenderingContext2D, width: number, height: number) =>
          context.drawImage(image, 0, 0, width, height),
        close: () => URL.revokeObjectURL(url),
      };
    } catch {
      URL.revokeObjectURL(url);
      throw new Error('Foto non leggibile. Esportala come JPEG e riprova.');
    }
  }
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (webp) => {
        if (webp?.type === 'image/webp') resolve(webp);
        else canvas.toBlob(resolve, 'image/jpeg', 0.84);
      },
      'image/webp',
      0.82,
    );
  });
}

export async function prepareMedia(file: File, onProgress: (value: string) => void): Promise<File> {
  const type = detectedType(file);
  const kind = fileKind(type);
  if (!kind)
    throw new Error('Formato non supportato. Scegli una foto o un video da Foto su iPhone.');
  if (file.size > 100 * 1024 * 1024)
    throw new Error('Il file originale supera 100 MB. Scegli un file più piccolo.');
  if (kind === 'image') {
    onProgress('Preparo l’immagine…');
    const source = await imageSource(file);
    const ratio = Math.min(1, 1600 / Math.max(source.width, source.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(source.width * ratio);
    canvas.height = Math.round(source.height * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      source.close();
      throw new Error('Foto non preparata. Scegli un’altra foto e riprova.');
    }
    source.draw(ctx, canvas.width, canvas.height);
    source.close();
    const blob = await canvasBlob(canvas);
    if (!blob || blob.size > LIMITS.file)
      throw new Error('Foto ancora sopra 3 MB. Ritagliala o riducila e riprova.');
    const outputType = blob.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
    return new File([blob], outputType === 'image/jpeg' ? 'immagine.jpg' : 'immagine.webp', {
      type: outputType,
    });
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
      throw new Error('Video sopra 3 MB e non comprimibile qui. Accorcialo su iPhone e riprova.');
    return file.type === type ? file : new File([file], file.name, { type });
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

export async function prepareChatMedia(
  file: File,
  onProgress: (value: string) => void,
): Promise<File> {
  if (!file.type.startsWith('audio/')) return prepareMedia(file, onProgress);
  if (
    !['audio/webm', 'audio/ogg', 'audio/mp4'].includes(file.type) ||
    !file.size ||
    file.size > LIMITS.file
  )
    throw new Error('Scegli un audio WebM, Ogg o M4A entro 3 MB.');
  onProgress('Controllo l’audio…');
  const context = new AudioContext();
  try {
    const audio = await context.decodeAudioData(await file.arrayBuffer());
    if (audio.duration > 60) throw new Error('Scegli una nota audio di massimo 60 secondi.');
    return file;
  } finally {
    await context.close();
  }
}
