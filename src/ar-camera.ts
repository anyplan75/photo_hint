/** AR을 누르는 순간에 카메라를 엽니다. 화면이 그려진 뒤에 열면 아이폰이 요청을 거절합니다. */

type CameraAsk = {
  id: number;
  promise: Promise<MediaStream>;
};

let sequence = 0;
let current: CameraAsk | null = null;
const holders = new Map<number, number>();

export function holdArCamera(id: number): () => void {
  holders.set(id, (holders.get(id) ?? 0) + 1);
  return () => {
    const next = (holders.get(id) ?? 1) - 1;
    if (next <= 0) holders.delete(id);
    else holders.set(id, next);
  };
}

export function cameraStillHeld(id: number): boolean {
  return (holders.get(id) ?? 0) > 0;
}

export function currentArCameraAsk(): CameraAsk | null {
  return current;
}

export function askForArCamera(): CameraAsk {
  sequence += 1;
  const ask = { id: sequence, promise: openEnvironmentCamera() };
  current = ask;
  return ask;
}

export function askForArOrientation(): void {
  const orientation = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
  const ask = orientation.requestPermission;
  if (typeof ask !== 'function') return;
  void ask.call(DeviceOrientationEvent).catch(() => undefined);
}

export function cameraErrorName(error: unknown): string {
  if (error instanceof DOMException) return error.name;
  if (typeof error === 'object' && error !== null && 'name' in error && typeof error.name === 'string') return error.name;
  return 'Error';
}

async function openEnvironmentCamera(): Promise<MediaStream> {
  const media = navigator.mediaDevices;
  if (!media?.getUserMedia) {
    throw new DOMException('이 브라우저는 카메라를 열 수 없습니다.', 'NotSupportedError');
  }
  try {
    return await media.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'OverconstrainedError') {
      return media.getUserMedia({ audio: false, video: true });
    }
    throw error;
  }
}
