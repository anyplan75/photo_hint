import { collection, deleteDoc, doc, getDocs, onSnapshot, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import {
  clearPendingPlaceIds,
  isPlaceSeeded,
  loadAllShootPoints,
  markPlacesSeeded,
  placesToUpload,
  readPendingPlaceIds,
  type ShootPoint,
} from './shoot-points';

/** [photo_hint]_ 촬영 지점 묶음. 규칙 파일이 한글 경로를 받지 않아 영문 이름을 씁니다. */
const COLLECTION = 'photo_hint_shoot_points';
const POINTS = 'points';

function pointCollection(db: Firestore, uid: string) {
  return collection(db, COLLECTION, uid, POINTS);
}

function toDocument(point: ShootPoint): Record<string, string | number | Timestamp> {
  const document: Record<string, string | number | Timestamp> = {
    id: point.id,
    region: point.region,
    name: point.name,
    lat: point.lat,
    lng: point.lng,
    savedAt: Timestamp.fromDate(new Date(point.savedAt)),
  };
  if (point.note) document.note = point.note;
  return document;
}

function fromDocument(value: unknown): ShootPoint | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  const savedAt = data.savedAt instanceof Timestamp ? data.savedAt.toDate().toISOString() : null;
  if (!savedAt) return null;
  const point: ShootPoint = {
    id: String(data.id ?? ''),
    region: String(data.region ?? ''),
    name: String(data.name ?? ''),
    lat: Number(data.lat),
    lng: Number(data.lng),
    savedAt,
  };
  if (typeof data.note === 'string' && data.note) point.note = data.note;
  if (!point.id || !point.region || !point.name || Number.isNaN(point.lat) || Number.isNaN(point.lng)) return null;
  return point;
}

/** 서버에 없는 지점만 새로 만듭니다. 이미 있는 문서는 건드리지 않습니다. */
export async function uploadNewLocalPlaces(db: Firestore, uid: string): Promise<void> {
  const local = loadAllShootPoints();
  const seeded = isPlaceSeeded();
  const pending = new Set(readPendingPlaceIds());
  const existing = await getDocs(pointCollection(db, uid));
  const serverIds = new Set(existing.docs.map((item) => item.id));
  const fresh = placesToUpload(local, serverIds, seeded, pending);
  for (const point of fresh) {
    await setDoc(doc(db, COLLECTION, uid, POINTS, point.id), toDocument(point));
  }
  markPlacesSeeded();
  clearPendingPlaceIds();
}

/**
 * 실시간으로 계정 장소를 받습니다.
 * 맥에서 저장하면 아이폰과 웹이 새로고침 없이 보게 하려고 스냅샷을 씁니다.
 * 파이프라인 조회는 한 번만 받아 와서 이 흐름에는 맞지 않습니다.
 */
export function listenUserPlaces(
  db: Firestore,
  uid: string,
  onPlaces: (points: ShootPoint[]) => void,
  onError: () => void,
): () => void {
  return onSnapshot(
    pointCollection(db, uid),
    (snapshot) => {
      const points = snapshot.docs
        .map((item) => fromDocument(item.data()))
        .filter((point): point is ShootPoint => point !== null);
      onPlaces(points);
    },
    () => onError(),
  );
}

export async function saveUserPlace(db: Firestore, uid: string, point: ShootPoint): Promise<void> {
  await setDoc(doc(db, COLLECTION, uid, POINTS, point.id), toDocument(point));
}

export async function deleteUserPlace(db: Firestore, uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, uid, POINTS, id));
}
