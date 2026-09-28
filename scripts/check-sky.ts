import { distanceMeters } from '../src/geo';
import { buildSpotGuide, formatPosition } from '../src/ideas';
import { selectNearby } from '../src/nearby';
import { getDaySky, moonPhaseName, skyPosition } from '../src/sky';
import { formatClock } from '../src/time';

const here = { name: '현재 위치', lat: 35.1631, lng: 129.1635, elevationM: 5 };
let failed = false;

function assert(condition: boolean, message: string) {
  if (!condition) {
    failed = true;
    console.error(`FAIL ${message}`);
  }
}

function seoulHour(date: Date): number {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return Number(hour);
}

for (const day of [0, 1]) {
  const sky = getDaySky(here.lat, here.lng, here.elevationM, day);
  const guide = buildSpotGuide({
    ...here,
    kind: 'here',
    sky,
    phaseName: moonPhaseName(sky.moonPhaseDegrees),
  });
  console.log(`\n${day === 0 ? '오늘' : '내일'} ${here.name}`);
  console.log(`일출 ${sky.sunrise && formatClock(sky.sunrise)} ${formatPosition(sky.sunrise ? skyPosition('sun', sky.sunrise, here.lat, here.lng, here.elevationM) : null)}`);
  console.log(`일몰 ${sky.sunset && formatClock(sky.sunset)}`);
  console.log(guide.dayLine);
  console.log(guide.moon.summary);
  for (const idea of guide.ideas) {
    console.log(`- ${idea.title} [${idea.composition}] ${idea.detail}`);
  }

  assert(sky.sunrise !== null && sky.sunset !== null, 'sunrise and sunset exist');
  if (sky.sunrise && sky.sunset) {
    assert(sky.sunrise < sky.sunset, 'sunrise before sunset');
    assert(seoulHour(sky.sunrise) >= 5 && seoulHour(sky.sunrise) <= 8, `sunrise hour ${seoulHour(sky.sunrise)}`);
    assert(seoulHour(sky.sunset) >= 17 && seoulHour(sky.sunset) <= 20, `sunset hour ${seoulHour(sky.sunset)}`);
    const rise = skyPosition('sun', sky.sunrise, here.lat, here.lng, here.elevationM);
    const set = skyPosition('sun', sky.sunset, here.lat, here.lng, here.elevationM);
    assert(rise.azimuth > 40 && rise.azimuth < 140, 'sunrise is easterly');
    assert(set.azimuth > 220 && set.azimuth < 320, 'sunset is westerly');
    assert(Math.abs(rise.altitude) < 2 && Math.abs(set.altitude) < 2, 'rise and set are near the horizon');
  }
  if (sky.sunrise && sky.goldenMorningEnd) assert(sky.goldenMorningEnd > sky.sunrise, 'morning golden ends after sunrise');
  if (sky.goldenEveningStart && sky.sunset) assert(sky.goldenEveningStart < sky.sunset, 'evening golden starts before sunset');
  if (sky.blueMorningStart && sky.sunrise) assert(sky.blueMorningStart < sky.sunrise, 'blue hour starts before sunrise');
  if (sky.sunset && sky.blueEveningEnd) assert(sky.blueEveningEnd > sky.sunset, 'blue hour ends after sunset');
  assert(guide.track.some((row) => row.label === '일출' && Number.isFinite(row.azimuth)), 'sun track has sunrise');
  assert(guide.track.some((row) => row.label === '일몰' && Number.isFinite(row.altitude)), 'sun track has sunset');
  assert(guide.ideas.length >= 4, `several ideas, got ${guide.ideas.length}`);
  const kinds = new Set(guide.ideas.map((idea) => idea.composition));
  assert(kinds.has('alignment') && kinds.has('silhouette') && kinds.has('reflection') && kinds.has('frame'), 'four compositions');
  for (const idea of guide.ideas) {
    assert(idea.detail.includes('방위') && idea.detail.includes('고도'), `${idea.title} cites azimuth and altitude`);
  }
  assert(guide.moon.summary.includes('밝기'), 'moon phase detail');
  assert(sky.moonPhaseDegrees >= 0 && sky.moonPhaseDegrees < 360, 'moon phase range');
}

const namsan = { lat: 37.55117, lng: 126.9915 };
const seokchon = { lat: 37.5089, lng: 127.1038 };
assert(distanceMeters(here.lat, here.lng, namsan.lat, namsan.lng) > 5000, 'namsan is far from the test coordinate');
assert(distanceMeters(here.lat, here.lng, seokchon.lat, seokchon.lng) > 5000, 'seokchon is far from the test coordinate');

const picked = selectNearby(here.lat, here.lng, [
  { type: 'node', id: 1, lat: namsan.lat, lon: namsan.lng, tags: { name: '남산서울타워', tourism: 'viewpoint' } },
  { type: 'node', id: 2, lat: seokchon.lat, lon: seokchon.lng, tags: { name: '석촌호수 동호', natural: 'water', water: 'lake' } },
  { type: 'node', id: 3, lat: 35.17, lon: 129.17, tags: { name: '달맞이 언덕', tourism: 'viewpoint' } },
  { type: 'node', id: 4, lat: 35.164, lon: 129.164, tags: { tourism: 'viewpoint' } },
  { type: 'way', id: 5, center: { lat: 35.166, lon: 129.161 }, tags: { name: '옆 개천', natural: 'water', water: 'river' } },
  { type: 'way', id: 6, center: { lat: 35.168, lon: 129.166 }, tags: { name: '가까운 호수', natural: 'water', water: 'lake' } },
]);
console.log(`\nnearby ${picked.map((place) => `${place.name}:${place.kind}:${Math.round(place.distanceM)}m`).join(', ')}`);
assert(picked.some((place) => place.name === '달맞이 언덕'), 'keeps a viewpoint within 5km');
assert(picked.some((place) => place.name === '가까운 호수' && place.kind === 'lake'), 'keeps a named lake');
assert(!picked.some((place) => place.name.includes('남산') || place.name.includes('석촌')), 'drops landmarks outside 5km');
assert(!picked.some((place) => place.name === '옆 개천'), 'drops a river');
assert(picked.every((place) => place.distanceM <= 5000), 'every nearby place is inside 5km');
assert(selectNearby(here.lat, here.lng, []).length === 0, 'empty lookup stays empty');

const crowded = selectNearby(here.lat, here.lng, [
  ...Array.from({ length: 8 }, (_, index) => ({
    type: 'way',
    id: 100 + index,
    center: { lat: here.lat + 0.002 * (index + 1), lon: here.lng },
    tags: { name: `도로 ${index}`, bridge: 'yes' },
  })),
  { type: 'node', id: 200, lat: here.lat + 0.03, lon: here.lng, tags: { name: '먼 전망', tourism: 'viewpoint' } },
]);
assert(crowded.some((place) => place.name === '먼 전망'), 'a viewpoint within 5km is not hidden by closer roads');

if (failed) {
  console.error('\nsky check failed');
  process.exit(1);
}
console.log('\nsky check ok');
