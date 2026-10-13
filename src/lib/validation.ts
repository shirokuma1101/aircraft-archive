import {z} from 'zod';
import {schema} from './model';
export function validateRecord(collection: string, input: unknown) {
  const definition = schema[collection];
  if (!definition) throw new Error('Unknown collection');
  const fields: Record<string, z.ZodType> = {};
  for (const [name, field] of Object.entries(definition.fields)) {
    let value: z.ZodType = z.string().trim().max(field.type === 'text' ? 10000 : 500);
    if (field.required && ['string','text'].includes(field.type)) value = z.string().trim().min(1).max(500);
    if (field.type === 'uuid') value = z.uuid();
    if (field.type === 'float') value = z.number().finite();
    if (field.type === 'timestamp') value = z.iso.datetime({offset:true});
    if (field.type === 'date') value = z.iso.date();
    if (field.type === 'json') value = z.array(z.string().trim().min(1).max(60)).max(30);
    if (field.options) value = z.enum(field.options as [string,...string[]]);
    if (name === 'latitude') value = z.number().min(-90).max(90);
    if (name === 'longitude') value = z.number().min(-180).max(180);
    if (name === 'timezone') value = z.string().refine(v => {try {new Intl.DateTimeFormat('en',{timeZone:v}); return true;} catch {return false;}}, '有効なIANAタイムゾーンを入力してください');
    fields[name] = field.required ? value : value.nullable().optional();
  }
  const parsed = z.strictObject(fields).parse(input);
  if (collection === 'flights') {
    const row = parsed as Record<string,string>;
    const hasActualPair=Boolean(row.actual_departure&&row.actual_arrival);
    if (Boolean(row.scheduled_departure)!==Boolean(row.scheduled_arrival) && !(row.status==='flown'&&hasActualPair)) throw new Error('予定出発・到着日時は両方入力してください。実績が揃った搭乗済み記録では、判明している予定日時だけでも保存できます。');
    if (Boolean(row.actual_departure)!==Boolean(row.actual_arrival)) throw new Error('実際の出発・到着日時は両方入力してください。');
    if (!row.scheduled_departure && (!row.actual_departure || row.status==='planned')) throw new Error('搭乗予定には予定日時、それ以外には予定または実際の日時が必要です。');
    if (Date.parse(row.scheduled_arrival) <= Date.parse(row.scheduled_departure)) throw new Error('予定到着日時は予定出発日時より後にしてください。');
    if (row.actual_departure && row.actual_arrival && Date.parse(row.actual_arrival) <= Date.parse(row.actual_departure)) throw new Error('実際の到着日時は出発日時より後にしてください。');
    if (row.origin === row.destination) throw new Error('出発空港と到着空港を別にしてください。');
  }
  if (collection === 'aircraft_history' && parsed.start_date && parsed.end_date && String(parsed.end_date) < String(parsed.start_date)) throw new Error('履歴の終了日を確認してください。');
  return parsed;
}
