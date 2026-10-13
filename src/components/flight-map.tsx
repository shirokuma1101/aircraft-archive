'use client';
import {MapContainer,TileLayer,Polyline,CircleMarker,Tooltip,useMap} from 'react-leaflet';
import {flightRoutes,routeColor,routeWeight} from '@/lib/flight-routes';
import {useEffect} from 'react';
import {useTheme} from './theme-provider';
import type {Archive,Row} from '@/lib/model';
import {find,airportCode} from '@/lib/model';
import {routePoints, type Point} from '@/lib/geo';
function MapTheme({night}:{night:boolean}) {
  const map=useMap();
  useEffect(()=>{map.getContainer().classList.toggle('night-map',night);},[map,night]);
  return null;
}
function Bounds({points}:{points:Point[]}) {
  const map=useMap();
  const signature=JSON.stringify(points);
  useEffect(()=>{
    const fit=()=>{map.invalidateSize();if(points.length)map.fitBounds(points,{padding:[32,32],maxZoom:6,animate:false});};
    fit();
    const observer=new ResizeObserver(fit);observer.observe(map.getContainer());
    return ()=>observer.disconnect();
  },[signature,map]); // eslint-disable-line
  return null;
}
export default function FlightMap({data,flights,onRoute,night:overrideNight}:{data:Archive;flights:Row[];night?:boolean;onRoute?:(a:string,b:string)=>void}) {
  const {dark}=useTheme();
  const night=overrideNight??dark;
  const groups=flightRoutes(flights).sort((a,b)=>a.flown-b.flown);
  const max=Math.max(1,...groups.map(r=>r.flown));
  const routes=groups.flatMap(f=>{
    const a=find(data,'airports',f.origin),b=find(data,'airports',f.destination);
    if(!a || !b) return [];
    return [{flight:f,a,b,points:routePoints([a.latitude,a.longitude],[b.latitude,b.longitude])}];
  });
  const airports=Array.from(new Map(routes.flatMap(r=>[
    {airport:r.a,point:r.points[0]},
    {airport:r.b,point:r.points[r.points.length-1]},
  ]).map(({airport,point})=>[`${airport.id}-${point[1].toFixed(1)}`,{airport,point}])).values());
  return <MapContainer center={[32,135]} zoom={3} minZoom={2} maxZoom={12} scrollWheelZoom={false} className={`flight-map${night?' night-map':''}`} worldCopyJump>
    <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
    <MapTheme night={night}/>
    <Bounds points={routes.flatMap(r=>r.points)} />
    {routes.flatMap(({flight,a,b,points})=>(['planned','flown'] as const).filter(status=>flight[status]>0).map(status=><Polyline key={flight.key+status} positions={points} pathOptions={{color:status==='planned'?(night?'#fb923c':'#cd7439'):routeColor(flight.flown,max,night),weight:status==='planned'?(flight.flown?routeWeight(flight.flown,max)+3:2):routeWeight(flight.flown,max),opacity:status==='planned'?0.8:0.9,dashArray:status==='planned'?'7 8':undefined}} eventHandlers={{click:()=>onRoute?.(a.id,b.id)}}><Tooltip>{airportCode(a)} ↔ {airportCode(b)} · 搭乗済み {flight.flown}回{flight.planned>0&&` · 搭乗予定 ${flight.planned}回`}</Tooltip></Polyline>))}
    {airports.map(({airport:a,point})=><CircleMarker key={`${a.id}-${point[1]}`} center={point} radius={5} pathOptions={{color:'#fff',weight:2,fillColor:night?'#38bdf8':'#142d4e',fillOpacity:1}}><Tooltip>{airportCode(a)} · {a.name}</Tooltip></CircleMarker>)}
  </MapContainer>;
}
