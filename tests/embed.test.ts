import {test} from 'node:test';
import assert from 'node:assert/strict';
import {embedAddress,embedCode,embedOptions} from '../src/lib/embed';
test('embed URLs use an explicit public origin with validated options',()=>{
  const url=embedAddress('https://archive.example.com/manage','map','dark','2025');
  assert.equal(url,'https://archive.example.com/embed/map?theme=dark&year=2025');
  assert.match(embedCode(url,'map'),/theme=dark&amp;year=2025/);
  for(const origin of ['javascript:alert(1)','https://name:password@example.com','invalid'])assert.throws(()=>embedAddress(origin,'summary','light',''));
  assert.throws(()=>embedAddress('https://example.com','recent','light','2025"'));
});
test('unknown and repeated display options have safe defaults',()=>{
  assert.deepEqual(embedOptions({theme:'invalid',year:['2025','2026']}),{theme:'light',year:''});
  assert.deepEqual(embedOptions({theme:'dark',year:'2024'}),{theme:'dark',year:'2024'});
});
