import type { Composition } from './places';

export function FrameSketch({ compositions }: { compositions: Composition[] }) {
  const kind = sketchKind(compositions);
  return (
    <svg className="sketch" viewBox="0 0 160 96" aria-hidden="true">
      <rect x="1" y="1" width="158" height="94" rx="6" className="sketch-frame" />
      {kind === 'frame' && (
        <>
          <rect x="28" y="16" width="104" height="64" className="sketch-line" />
          <rect x="58" y="30" width="44" height="36" className="sketch-solid" />
        </>
      )}
      {kind === 'reflection' && (
        <>
          <path d="M8 48 H152" className="sketch-line" />
          <path d="M78 48 L86 22 H96 L104 48 Z" className="sketch-solid" />
          <path d="M78 48 L86 74 H96 L104 48 Z" className="sketch-ghost" />
        </>
      )}
      {kind === 'sun-horizon' && (
        <>
          <path d="M8 62 H152" className="sketch-line" />
          <circle cx="108" cy="62" r="10" className="sketch-sun" />
          <path d="M36 62 V40 H44 V62 M48 62 V32 H58 V62 M62 62 V44 H68 V62" className="sketch-solid" />
        </>
      )}
      {kind === 'silhouette' && (
        <>
          <path d="M8 70 H152" className="sketch-line" />
          <circle cx="118" cy="28" r="9" className="sketch-sun" />
          <path d="M40 70 V38 H50 V70 M54 70 V28 H66 V70 M70 70 V44 H78 V70" className="sketch-solid" />
        </>
      )}
    </svg>
  );
}

function sketchKind(compositions: Composition[]): 'frame' | 'reflection' | 'sun-horizon' | 'silhouette' {
  if (compositions.includes('frame')) return 'frame';
  if (compositions.includes('reflection')) return 'reflection';
  if (compositions.includes('alignment') && compositions.includes('silhouette')) return 'sun-horizon';
  if (compositions.includes('silhouette')) return 'silhouette';
  return 'sun-horizon';
}
