import { lightIdea } from '../src/ideas';
import { PLACES, subjectAzimuth } from '../src/places';
import { getDaySky, moonPhaseName, skyPosition } from '../src/sky';
import { formatClock, formatRange, seoulDayStart } from '../src/time';
import { sampleTime, shotWindow } from '../src/windows';

const place = PLACES[0];
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
  const sky = getDaySky(place.lat, place.lng, place.elevationM, day);
  console.log(`\n${day === 0 ? '오늘' : '내일'} ${place.name}`);
  console.log(`일출 ${sky.sunrise && formatClock(sky.sunrise)}  일몰 ${sky.sunset && formatClock(sky.sunset)}`);
  console.log(
    `골든 아침 ${sky.sunrise && sky.goldenMorningEnd && formatRange(sky.sunrise, sky.goldenMorningEnd)}  저녁 ${sky.goldenEveningStart && sky.sunset && formatRange(sky.goldenEveningStart, sky.sunset)}`,
  );
  console.log(
    `블루 아침 ${sky.blueMorningStart && sky.sunrise && formatRange(sky.blueMorningStart, sky.sunrise)}  저녁 ${sky.sunset && sky.blueEveningEnd && formatRange(sky.sunset, sky.blueEveningEnd)}`,
  );
  console.log(`월출 ${sky.moonrise ? formatClock(sky.moonrise) : '없음'}  월몰 ${sky.moonset ? formatClock(sky.moonset) : '없음'}`);
  console.log(`달 ${moonPhaseName(sky.moonPhaseDegrees)} ${Math.round(sky.moonLitFraction * 100)}%`);

  assert(sky.sunrise !== null && sky.sunset !== null, 'sunrise and sunset exist');
  if (sky.sunrise && sky.sunset) {
    assert(sky.sunrise < sky.sunset, 'sunrise before sunset');
    assert(seoulHour(sky.sunrise) >= 5 && seoulHour(sky.sunrise) <= 8, `sunrise hour ${seoulHour(sky.sunrise)}`);
    assert(seoulHour(sky.sunset) >= 17 && seoulHour(sky.sunset) <= 20, `sunset hour ${seoulHour(sky.sunset)}`);
    const rise = skyPosition('sun', sky.sunrise, place.lat, place.lng, place.elevationM);
    const set = skyPosition('sun', sky.sunset, place.lat, place.lng, place.elevationM);
    console.log(`일출 방위 ${rise.azimuth.toFixed(1)} 고도 ${rise.altitude.toFixed(1)} / 일몰 방위 ${set.azimuth.toFixed(1)} 고도 ${set.altitude.toFixed(1)}`);
    assert(rise.azimuth > 40 && rise.azimuth < 140, 'sunrise is easterly');
    assert(set.azimuth > 220 && set.azimuth < 320, 'sunset is westerly');
    assert(Math.abs(rise.altitude) < 2 && Math.abs(set.altitude) < 2, 'rise and set are near the horizon');
  }
  if (sky.sunrise && sky.goldenMorningEnd) assert(sky.goldenMorningEnd > sky.sunrise, 'morning golden ends after sunrise');
  if (sky.goldenEveningStart && sky.sunset) assert(sky.goldenEveningStart < sky.sunset, 'evening golden starts before sunset');
  if (sky.blueMorningStart && sky.sunrise) assert(sky.blueMorningStart < sky.sunrise, 'blue hour starts before sunrise');
  if (sky.sunset && sky.blueEveningEnd) assert(sky.blueEveningEnd > sky.sunset, 'blue hour ends after sunset');
  assert(sky.moonPhaseDegrees >= 0 && sky.moonPhaseDegrees < 360, 'moon phase range');
  assert(sky.moonLitFraction >= 0 && sky.moonLitFraction <= 1, 'moon fraction range');
}

for (const item of PLACES) {
  const sky = getDaySky(item.lat, item.lng, item.elevationM, 0);
  for (const shot of item.shots) {
    const azimuth = subjectAzimuth(item, shot);
    const window = shotWindow(shot.window, sky);
    assert(shot.frame.stand.length > 0 && shot.frame.how.length > 0, `${shot.id} frame`);
    assert(shot.compositions.length > 0, `${shot.id} composition`);
    console.log(`\n${item.name} · ${shot.title} 피사체 방위 ${azimuth.toFixed(1)}°`);
    if (!window) {
      console.log('  이 날 창 없음');
      continue;
    }
    const at = sampleTime(shot.window, window);
    const body = shot.window === 'moon-40' ? 'moon' : 'sun';
    const position = skyPosition(body, at, item.lat, item.lng, item.elevationM);
    const idea = lightIdea({
      body,
      azimuth: position.azimuth,
      altitude: position.altitude,
      subjectName: shot.subject.name,
      subjectAzimuth: azimuth,
    });
    console.log(`  ${formatRange(window.start, window.end)}`);
    console.log(`  ${idea}`);
    assert(idea.includes('방위') && idea.includes('고도'), `${shot.id} idea uses position`);
    assert(window.end.getTime() > seoulDayStart(0).getTime() - 24 * 60 * 60 * 1000, 'window near today');
  }
}

if (failed) {
  console.error('\nsky check failed');
  process.exit(1);
}
console.log('\nsky check ok');
