import {test} from 'node:test';
import assert from 'node:assert/strict';
import {flightDelay} from '../src/lib/flight-delay';
test('delay compares instants across dates and offsets',()=>{
  assert.equal(flightDelay('2026-01-01T23:55:00+09:00','2026-01-02T00:10:00+09:00').label,'15分遅延');
  assert.equal(flightDelay('2026-01-01T10:00:00+09:00','2026-01-01T01:00:00Z').label,'定刻');
});
test('early departure and arrival are distinct and seconds do not become on time',()=>{
  const planned='2026-01-01T10:00:00Z',early='2026-01-01T09:55:00Z';
  assert.equal(flightDelay(planned,early,'departure').label,'5分早発');
  assert.equal(flightDelay(planned,early).label,'5分早着');
  assert.equal(flightDelay(planned,'2026-01-01T10:00:30Z').label,'1分未満遅延');
  assert.equal(flightDelay(planned,'2026-01-01T10:01:30Z').label,'1分30秒遅延');
});
test('missing or invalid times cannot be classified as on time',()=>{
  for(const [planned,actual] of [[null,'2026-01-01T10:00:00Z'],['2026-01-01T10:00:00Z',null],['invalid','invalid']])assert.equal(flightDelay(planned,actual).kind,'unknown');
});
