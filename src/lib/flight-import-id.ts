import {createHash} from 'node:crypto';
import {flightKey} from './flight-import';
export function importId(record:Record<string,any>) {
  const hex=createHash('sha256').update(`flight-import-v1|${flightKey(record)}`).digest('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
}
