import assert from 'node:assert/strict';
import { placesToUpload, type ShootPoint } from '../src/shoot-points';

const place = (id: string): ShootPoint => ({
  id,
  region: '제주',
  name: id,
  lat: 33.3,
  lng: 126.5,
  savedAt: '2026-10-18T00:00:00.000Z',
});

const firstLogin = placesToUpload([place('a')], new Set(), false, new Set());
assert.deepEqual(firstLogin.map((point) => point.id), ['a']);

const alreadyThere = placesToUpload([place('a')], new Set(['a']), false, new Set());
assert.deepEqual(alreadyThere, []);

const loggedOutCopy = placesToUpload([place('a')], new Set(), true, new Set());
assert.deepEqual(loggedOutCopy, []);

const newWhileLoggedOut = placesToUpload([place('a'), place('b')], new Set(['a']), true, new Set(['b']));
assert.deepEqual(newWhileLoggedOut.map((point) => point.id), ['b']);

console.log('place upload checks passed');
