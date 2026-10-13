import {importId} from './flight-import-id';
import {cabinName} from './cabin';
import type {Row} from './model';
// Legacy records have no provenance field. The caller must explicitly confirm their source.
export function myFr24Migration(row:Row) {
  if(row.import_source&&row.import_source!=='myFlightradar24')return null;
  if(row.status!=='flown'||row.actual_departure||row.actual_arrival||!row.scheduled_departure||!row.scheduled_arrival)return null;
  if(row.id!==importId(row))return null;
  return {id:row.id,scheduled_departure:null,scheduled_arrival:null,actual_departure:row.scheduled_departure,actual_arrival:row.scheduled_arrival,cabin:cabinName(row.cabin,'myFlightradar24'),import_source:'myFlightradar24'};
}
