import type { SceneChoice } from './region-places';

const KEY = 'geuttae-field-v1';

export interface FieldPrefs {
  radiusKm: number;
  useMyLocation: boolean;
  preferScenes: SceneChoice[];
}

const SCENES: SceneChoice[] = ['바다', '오름', '거리', '사람', '밤', '들판', '절벽', '항구'];

export function loadFieldPrefs(): FieldPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<FieldPrefs>;
    const radius = typeof parsed.radiusKm === 'number' ? parsed.radiusKm : 12;
    return {
      radiusKm: Math.min(30, Math.max(3, Math.round(radius))),
      useMyLocation: parsed.useMyLocation !== false,
      preferScenes: Array.isArray(parsed.preferScenes) ? parsed.preferScenes.filter(isScene) : [],
    };
  } catch {
    return defaults();
  }
}

export function writeFieldPrefs(prefs: FieldPrefs): void {
  localStorage.setItem(KEY, JSON.stringify(prefs));
}

function defaults(): FieldPrefs {
  return { radiusKm: 12, useMyLocation: true, preferScenes: [] };
}

function isScene(value: unknown): value is SceneChoice {
  return typeof value === 'string' && SCENES.includes(value as SceneChoice);
}
