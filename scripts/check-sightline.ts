import { bearingDegrees } from '../src/geo';
import {
  analyzeProfile,
  angularDiameterDegrees,
  azimuthOffset,
  chordElevation,
  elevationFromRgb,
  fieldOfView,
  framePhrase,
  inLensFrame,
  personShape,
  SENSOR_HEIGHT_MM,
  SENSOR_WIDTH_MM,
} from '../src/sightline';
import {
  brightLimbRadians,
  formatAngle,
  galacticEquator,
  moonDiameterDegrees,
  moonGeocentricDiameter,
  moonLit,
  moonStage,
  MOON_STAGE_COUNT,
  showersOn,
  skyBodies,
  skyMarks,
  sunDiameterDegrees,
} from '../src/sky-scene';
import { dateFromSeoul } from '../src/time';

let failed = false;

function assert(condition: boolean, message: string) {
  if (!condition) {
    failed = true;
    console.error(`FAIL ${message}`);
  }
}

const fov50 = fieldOfView(50, SENSOR_WIDTH_MM);
const fov50v = fieldOfView(50, SENSOR_HEIGHT_MM);
assert(Math.abs(fov50 - 2 * Math.atan(18 / 50) * (180 / Math.PI)) < 1e-9, '50mm horizontal field');
assert(Math.abs(fov50v - 2 * Math.atan(12 / 50) * (180 / Math.PI)) < 1e-9, '50mm vertical field');
assert(fov50 > fov50v, 'horizontal field is wider on a 36x24 sensor');
for (const mm of [24, 35, 50, 85, 135, 200]) {
  const horizontal = fieldOfView(mm, SENSOR_WIDTH_MM);
  const vertical = fieldOfView(mm, SENSOR_HEIGHT_MM);
  assert(horizontal > 1 && horizontal < 90, `${mm}mm horizontal field is a real lens angle`);
  assert(vertical > 1 && vertical < 70, `${mm}mm vertical field is a real lens angle`);
}

const personAngle = angularDiameterDegrees(1.7, 1000);
assert(Math.abs(personAngle - 2 * Math.atan(0.85 / 1000) * (180 / Math.PI)) < 1e-9, 'person angle uses 2*atan(half/distance)');
const shape = personShape(1.7);
assert(Math.abs(shape.headM - 1.7 / 8) < 1e-9, 'head is one eighth of the height');
assert(shape.shoulderM > shape.headWidthM && shape.shoulderM < 1.7, 'shoulders come from the same body, not a separate width');
assert(shape.hipFromFeetM < shape.shoulderFromFeetM && shape.shoulderFromFeetM < shape.heightM, 'body stacks feet, hip, shoulder, crown');

assert(Math.abs(azimuthOffset(10, 20) - 10) < 1e-9, 'offset to the right is positive');
assert(Math.abs(azimuthOffset(10, 350) + 20) < 1e-9, 'offset wraps to the left');
assert(inLensFrame(0, 0, 0, 40, 27), 'center is inside the frame');
assert(!inLensFrame(30, 0, 0, 40, 27), '30 degrees is outside a 40 degree frame');
assert(framePhrase(30, 0, 0, 40, 27).includes('오른쪽'), 'outside the frame says which side');

const flat = analyzeProfile({
  from: { lat: 33.3, lng: 126.4 },
  to: { lat: 33.34, lng: 126.45 },
  elevations: null,
  cameraHeightM: 1.5,
  subjectHeightM: 1.7,
});
assert(flat.blocked === null && flat.cameraAbs === null, 'missing terrain does not invent a ridge');
assert(flat.groundM > 1000, 'a few kilometers apart has a real distance');
const samples = flat.samples;
const sea = samples.map(() => 10);
const open = analyzeProfile({
  from: { lat: 33.3, lng: 126.4 },
  to: { lat: 33.34, lng: 126.45 },
  elevations: sea,
  cameraHeightM: 1.5,
  subjectHeightM: 1.7,
});
assert(open.blocked === false && open.ridge === null, 'flat ground leaves the line clear');
const blockedElevations = sea.slice();
blockedElevations[Math.floor(blockedElevations.length / 2)] = 800;
const blocked = analyzeProfile({
  from: { lat: 33.3, lng: 126.4 },
  to: { lat: 33.34, lng: 126.45 },
  elevations: blockedElevations,
  cameraHeightM: 1.5,
  subjectHeightM: 1.7,
});
assert(blocked.blocked === true && blocked.ridge !== null && blocked.ridge.excessM > 100, 'a ridge above the line hides the subject');
const chord = chordElevation(100, 120, open.groundM / 2, open.groundM);
assert(chord < 110, 'earth curvature puts the midpoint below the straight average');

assert(Math.abs(elevationFromRgb(1, 210, 12) - (-10000 + (1 * 65536 + 210 * 256 + 12) * 0.1)) < 1e-6, 'terrain rgb decoding');
assert(Math.abs(elevationFromRgb(1, 134, 160)) < 0.2, 'sea-level encoding is near zero');

const jeju = { lat: 33.36, lng: 126.53 };
const evening = dateFromSeoul('2026-10-21', 20 * 60);
const sunDeg = sunDiameterDegrees(evening, jeju.lat, jeju.lng, 300);
const moonDeg = moonDiameterDegrees(evening, jeju.lat, jeju.lng, 300);
const moonGeo = moonGeocentricDiameter(evening);
assert(sunDeg > 0.52 && sunDeg < 0.55, `sun diameter stays near 0.53, got ${sunDeg}`);
assert(moonDeg > 0.45 && moonDeg < 0.58, `moon diameter follows lunar distance, got ${moonDeg}`);
assert(Math.abs(moonDeg - moonGeo) / moonGeo < 0.02, 'topocentric moon size stays near the library geocentric diameter');

for (let phase = 0; phase < 360; phase += 24) {
  assert(moonStage(phase).index === phase / 24, `stage ${phase}`);
}
assert(moonStage(180).index === 7 && moonStage(180).shapeDeg === 180, 'full moon is stage 7 with a 180 degree terminator');
assert(moonStage(0).index === 0 && moonStage(359).index === 14, 'new moon bin is 0 and the last bin is 14');
assert(MOON_STAGE_COUNT === 15, 'fifteen moon stages');
assert(!moonLit(0, 0, 10, 0, 0), 'a new-moon shape is dark');
assert(moonLit(0, 0, 10, 180, 0), 'a full-moon shape is lit');
assert(moonLit(5, 0, 10, 90, Math.PI / 2) && !moonLit(-5, 0, 10, 90, Math.PI / 2), 'first-quarter light is on the right when the limb points right');
const litCounts = Array.from({ length: 15 }, (_, index) => {
  const shape = (index + 0.5) * 24;
  let lit = 0;
  for (let y = -8; y <= 8; y += 1) {
    for (let x = -8; x <= 8; x += 1) if (moonLit(x, y, 8, shape, Math.PI / 2)) lit += 1;
  }
  return lit;
});
assert(litCounts[0] < litCounts[3] && litCounts[3] < litCounts[7], 'light grows from new toward full');
assert(litCounts[7] > litCounts[11] && litCounts[11] > litCounts[14], 'light shrinks from full toward the last crescent');

const limb = brightLimbRadians(30, 180, 30, 270);
assert(limb > 0.8 && limb < 2.2, `sun to the west of a south-facing moon lights the right side, got ${limb}`);

const center = galacticEquator(0, 0);
assert(Math.abs(center.ra - 266.4) < 1 && Math.abs(center.dec + 29) < 1, `galactic center ${center.ra}, ${center.dec}`);
const pole = galacticEquator(0, 90);
assert(pole.dec > 20 && pole.dec < 35, 'galactic north pole is the real one, not a made-up disc');

const october = showersOn(dateFromSeoul('2026-10-21', 12 * 60));
assert(october.some((shower) => shower.name.includes('오리온')), '21 October includes the Orionids');
assert(!october.some((shower) => shower.name.includes('페르세우스')), '21 October is outside the Perseids');
const january = showersOn(dateFromSeoul('2026-01-03', 12 * 60));
assert(january.some((shower) => shower.name.includes('사분의')), '3 January includes the Quadrantids across the year boundary');
assert(showersOn(dateFromSeoul('2026-07-01', 12 * 60)).length === 0, '1 July has none of these major showers');

const marks = skyMarks(evening, jeju.lat, jeju.lng, 300);
const names = new Set(marks.map((mark) => mark.name));
for (const name of ['일출', '일몰', '월출', '월몰', '황금시간', '블루아워', '시민 박명', '항해 박명', '천문 박명']) {
  assert(names.has(name), `mark ${name}`);
}
assert(marks.every((mark) => Number.isFinite(mark.azimuth) && mark.azimuth >= 0 && mark.azimuth < 360), 'event azimuths are computed');
const scene = skyBodies(evening, jeju.lat, jeju.lng, 300, marks);
const kinds = new Set(scene.icons.map((icon) => icon.kind));
for (const kind of ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'star', 'meteor', 'sunrise', 'galaxy']) {
  assert(kinds.has(kind), `icon ${kind}`);
}
assert(scene.icons.filter((icon) => icon.kind === 'star' && icon.altitude > 0).every((icon) => icon.diameterDeg === 0), 'stars stay points');
assert(scene.galaxy.some((sample) => sample.lat === 0) && scene.galaxy.some((sample) => sample.lat !== 0), 'milky way is a band around the equator');
assert(scene.showers.includes('오리온자리 유성우'), 'the scene names the shower that is actually active');
assert(formatAngle(sunDeg).includes('°'), 'sun size is printed in degrees');
assert(formatAngle(scene.icons.find((icon) => icon.kind === 'jupiter')?.diameterDeg ?? 1).includes('″') || formatAngle(scene.icons.find((icon) => icon.kind === 'jupiter')?.diameterDeg ?? 1).includes('′'), 'planet size is the real tiny disc');

const star = scene.icons.find((icon) => icon.name === '베가');
assert(star !== undefined && star.altitude > -90 && star.altitude < 90, 'Vega has a real altitude');
assert(Math.abs(bearingDegrees(33.3, 126.4, 33.34, 126.45) - flat.bearing) < 1e-6, 'bearing matches the map bearing');

if (failed) {
  console.error('\nsightline check failed');
  process.exit(1);
}
console.log(`sun ${sunDeg.toFixed(3)}° moon ${moonDeg.toFixed(3)}° stage ${moonStage(evening.getTime() ? 0 : 0).index}`);
console.log('\nsightline check ok');
