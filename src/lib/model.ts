import raw from './schema.json';
export type Field = {label: string; type: string; required?: boolean; hidden?: boolean; relation?: string; options?: string[]};
export const schema = raw as Record<string, {label: string; fields: Record<string, Field>}>;
export const collections = Object.keys(schema);
export type Row = {id: string; [key: string]: any};
export type Archive = Record<string, Row[]>;
export const statuses: Record<string, string> = {planned:'搭乗予定',flown:'搭乗済み',cancelled:'欠航',not_taken:'未搭乗'};
export function label(row?: Row) {return row?.name || row?.title || row?.flight_number || row?.registration || row?.id || '未登録';}
export function find(data: Archive, collection: string, id?: string): Row | undefined {return data[collection]?.find(row => row.id === id);}
export function isPending(flight: Row, now = Date.now()) {return flight.status === 'planned' && Boolean(flight.scheduled_arrival) && new Date(flight.scheduled_arrival).getTime() < now;}
export function airportCode(airport?: Row) {return airport?.iata || airport?.icao || '—';}
