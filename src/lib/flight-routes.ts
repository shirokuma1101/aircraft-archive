import type {Row} from './model';
export function flightRoutes(flights:Row[]) {
  const routes=new Map<string,{key:string;origin:string;destination:string;flown:number;planned:number}>();
  for(const f of flights) {
    if(f.status!=='flown'&&f.status!=='planned')continue;
    const [origin,destination]=[f.origin,f.destination].sort();
    const key=JSON.stringify([origin,destination]);
    const route=routes.get(key)??{key,origin,destination,flown:0,planned:0};
    if(f.status==='flown')route.flown++;else route.planned++;
    routes.set(key,route);
  }
  return [...routes.values()];
}
export function routeColor(count:number,max:number,night=false) {
  const t=max<=1?0:Math.max(0,Math.min(1,(count-1)/(max-1)));
  const light=night?[53,124,169]:[111,159,210],dark=night?[125,235,255]:[20,45,78];
  return '#'+light.map((v,i)=>Math.round(v+(dark[i]-v)*Math.sqrt(t)).toString(16).padStart(2,'0')).join('');
}

export function routeWeight(count:number,max:number) {
  return max<=1?2:2+5*Math.max(0,Math.min(1,(count-1)/(max-1)));
}
