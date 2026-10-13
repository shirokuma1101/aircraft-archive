export const cabinNames=['エコノミー','エコノミー＋','プレミアムエコノミー','ビジネス','ファースト','プライベート'];
export function cabinName(value:string|null|undefined,source?:string|null) {
  if(!value)return null;
  const codes:Record<string,string>=source==='myFlightradar24'
    ?{'1':'エコノミー','2':'ビジネス','3':'ファースト','4':'エコノミー＋','5':'プライベート'}
    :{Y:'エコノミー',P:'プレミアムエコノミー',C:'ビジネス',B:'ビジネス',F:'ファースト'};
  return codes[value]||value;
}
