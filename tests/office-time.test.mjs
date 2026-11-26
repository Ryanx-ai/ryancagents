import test from 'node:test';
import assert from 'node:assert/strict';
import {getOfficeTime} from '../lib/office-time.mjs';

test('Singapore daylight starts at exactly 07:00 and ends at exactly 19:00',()=>{
 for(const [utc,time,night] of [
  ['2026-11-25T22:59:59.999Z','06:59:59',true],
  ['2026-11-25T23:00:00.000Z','07:00:00',false],
  ['2026-11-26T10:59:59.999Z','18:59:59',false],
  ['2026-11-26T11:00:00.000Z','19:00:00',true],
 ])assert.deepEqual(getOfficeTime(Date.parse(utc)),{time,night});
});

test('Singapore midnight stays 00:00:00 and night across the date boundary',()=>{
 assert.deepEqual(getOfficeTime(new Date('2026-11-26T15:59:59Z')),{time:'23:59:59',night:true});
 assert.deepEqual(getOfficeTime(new Date('2026-11-26T16:00:00Z')),{time:'00:00:00',night:true});
 assert.deepEqual(getOfficeTime(new Date('2026-11-26T16:00:01Z')),{time:'00:00:01',night:true});
});
