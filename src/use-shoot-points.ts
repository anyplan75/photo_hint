import { useEffect, useState } from 'react';
import { firebaseServices } from './firebase-app';
import { deleteUserPlace, listenUserPlaces, saveUserPlace, uploadNewLocalPlaces } from './place-sync';
import { addShootPoint, loadShootPoints, removeShootPoint, writeShootPointMirror, type ShootPoint } from './shoot-points';

export type SyncMode = 'local' | 'syncing' | 'synced' | 'error';

/** 로그인 중이면 계정 장소를 보여주고, 로그아웃 중이면 이 브라우저 목록만 다룹니다. */
export function useSyncedShootPoints(region: string, uid: string | null, sessionReady: boolean) {
  const [points, setPoints] = useState<ShootPoint[]>([]);
  const [mode, setMode] = useState<SyncMode>('local');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionReady) return;
    if (!uid) {
      setPoints(loadShootPoints(region));
      setMode('local');
      setError(null);
      return;
    }
    const services = firebaseServices();
    if (!services) {
      setPoints(loadShootPoints(region));
      setMode('local');
      return;
    }
    let stop = () => {};
    let cancelled = false;
    setMode('syncing');
    setError(null);
    void (async () => {
      try {
        await uploadNewLocalPlaces(services.db, uid);
        if (cancelled) return;
        stop = listenUserPlaces(
          services.db,
          uid,
          (all) => {
            writeShootPointMirror(all);
            setPoints(all.filter((point) => point.region === region));
            setMode('synced');
            setError(null);
          },
          () => {
            setMode('error');
            setError('계정에 저장된 장소를 불러오지 못했습니다.');
          },
        );
      } catch {
        if (cancelled) return;
        setMode('error');
        setError('계정에 장소를 올리지 못했습니다. 이 브라우저의 복사본은 계정을 덮어쓰지 않습니다.');
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [region, uid, sessionReady]);

  async function addPoint(point: ShootPoint): Promise<void> {
    if (!uid) {
      setPoints(addShootPoint(point));
      return;
    }
    const services = firebaseServices();
    if (!services) {
      setPoints(addShootPoint(point));
      return;
    }
    await saveUserPlace(services.db, uid, point);
  }

  async function removePoint(id: string): Promise<void> {
    if (!uid) {
      setPoints(removeShootPoint(region, id));
      return;
    }
    const services = firebaseServices();
    if (!services) {
      setPoints(removeShootPoint(region, id));
      return;
    }
    await deleteUserPlace(services.db, uid, id);
  }

  return { points, mode, error, addPoint, removePoint };
}
