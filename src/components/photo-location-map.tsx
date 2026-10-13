'use client';
import {MapContainer,TileLayer,CircleMarker,Tooltip} from 'react-leaflet';
import type {PhotoGeo} from '@/lib/exif';
export default function PhotoLocationMap({geo}:{geo:PhotoGeo}) {
  const point:[number,number]=[geo.latitude,geo.longitude];
  return <MapContainer center={point} zoom={13} minZoom={2} maxZoom={19} scrollWheelZoom={false} className="photo-location-map" aria-label="EXIFの撮影位置">
    <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'/>
    <CircleMarker center={point} radius={8} pathOptions={{color:'#fff',weight:3,fillColor:'#17796e',fillOpacity:1}}><Tooltip>EXIFに記録された位置</Tooltip></CircleMarker>
  </MapContainer>;
}
