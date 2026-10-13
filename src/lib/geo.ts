export type Point = [number,number];
const rad = Math.PI/180;
export function distance(a:Point,b:Point) {
  const h = Math.sin((b[0]-a[0])*rad/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin((b[1]-a[1])*rad/2)**2;
  return 6371*2*Math.asin(Math.sqrt(Math.min(1,h)));
}
// Great-circle interpolation with unwrapped longitude, avoiding a line across the dateline.
export function routePoints(a:Point,b:Point):Point[] {
  const vector = ([lat,lon]:Point) => [Math.cos(lat*rad)*Math.cos(lon*rad),Math.cos(lat*rad)*Math.sin(lon*rad),Math.sin(lat*rad)];
  const u=vector(a),v=vector(b),omega=Math.acos(Math.max(-1,Math.min(1,u.reduce((sum,n,i)=>sum+n*v[i],0))));
  const result:Point[]=[];
  for(let i=0;i<=64;i++) {
    const t=i/64;
    let lat:number,lon:number;
    if(Math.abs(Math.sin(omega))<1e-6) {lat=a[0]+(b[0]-a[0])*t;lon=a[1]+((((b[1]-a[1])+540)%360)-180)*t;}
    else {
      const p=u.map((n,j)=>(Math.sin((1-t)*omega)*n+Math.sin(t*omega)*v[j])/Math.sin(omega));
      lat=Math.atan2(p[2],Math.hypot(p[0],p[1]))/rad;lon=Math.atan2(p[1],p[0])/rad;
    }
    const prev=result.at(-1)?.[1] ?? a[1];
    while(lon-prev>180) lon-=360;
    while(lon-prev< -180) lon+=360;
    result.push([lat,lon]);
  }
  // Keep outbound and return journeys in the same Pacific-centered world copy.
  const shift=360*Math.round((135-result[Math.floor(result.length/2)][1])/360);
  return result.map(([lat,lon])=>[lat,lon+shift]);
}
