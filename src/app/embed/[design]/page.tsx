import {notFound} from 'next/navigation';
import {api} from '@/lib/directus';
import {embedDesigns,embedOptions,type EmbedDesign} from '@/lib/embed';
import type {Archive,Row} from '@/lib/model';
import EmbedWidget from '@/components/embed-widget';
export const dynamic='force-dynamic';
export const metadata={title:'搭乗実績',robots:{index:false,follow:false}};

export default async function Page({params,searchParams}:{params:Promise<{design:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const {design}=await params;
  if(!Object.hasOwn(embedDesigns,design))notFound();
  const options=embedOptions(await searchParams);
  // Deliberately never read the viewer's session. Only public flight fields are sent to the widget.
  let data:Archive={flights:[],airports:[]},failed=false;
  try {
    const [flights,airports]=await Promise.all([
      api<Row[]>('/items/flights?limit=-1&filter[status][_eq]=flown&fields=id,flight_number,status,origin,destination,actual_departure,actual_arrival,scheduled_departure,scheduled_arrival'),
      api<Row[]>('/items/airports?limit=-1&fields=id,name,iata,icao,latitude,longitude,country,timezone'),
    ]);
    const ids=new Set(flights.flatMap(f=>[f.origin,f.destination]));
    data={flights,airports:airports.filter(a=>ids.has(a.id))};
  }catch{failed=true;}
  return <EmbedWidget design={design as EmbedDesign} data={data} {...options} failed={failed}/>;
}
