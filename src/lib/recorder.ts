/** Ääninauhoitus MediaRecorderilla; valitsee laitteen tukeman formaatin. */

const PREFERRED_TYPES = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];

export function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  return PREFERRED_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

export interface ActiveRecording {
  stop(): Promise<{ blob: Blob; mimeType: string; durationMs: number }>;
}

export async function startRecording(): Promise<ActiveRecording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  const startedAt = Date.now();
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.start();

  return {
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const type = recorder.mimeType || mimeType || 'audio/webm';
          resolve({ blob: new Blob(chunks, { type }), mimeType: type, durationMs: Date.now() - startedAt });
        };
        recorder.stop();
      }),
  };
}

export function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}
