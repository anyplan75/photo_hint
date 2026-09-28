export type Composition = 'silhouette' | 'reflection' | 'frame' | 'alignment';

export type WindowKind =
  | 'sunset-20'
  | 'sunrise-20'
  | 'evening-golden'
  | 'morning-golden'
  | 'evening-blue'
  | 'morning-blue'
  | 'moon-40';

export const COMPOSITION_LABEL: Record<Composition, string> = {
  silhouette: '실루엣',
  reflection: '반영',
  frame: '프레임 안의 프레임',
  alignment: '정렬',
};

export function lightBody(kind: WindowKind): 'sun' | 'moon' {
  return kind === 'moon-40' ? 'moon' : 'sun';
}
