export const importFields = {
  date:'出発日', flight_number:'便名', origin:'出発空港', destination:'到着空港',
  departure:'出発時刻／日時', arrival:'到着時刻／日時', arrival_date:'到着日', duration:'所要時間',
  airline_name:'航空会社', registration:'機体番号', aircraft_type:'機種', seat:'座席', cabin:'クラス', status:'状態', notes:'メモ',
} as const;
export type ImportField = keyof typeof importFields;
export type ImportValues = Partial<Record<ImportField,string>>;
export type ImportMapping = Partial<Record<ImportField,string>>;
export type ImportEntry = {index:number;values:ImportValues;errors:string[];warnings:string[];record?:Record<string,any>;duplicate:boolean};
