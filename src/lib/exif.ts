import sharp from 'sharp';
import exifr from 'exifr';

export type PhotoGeo = {latitude:number;longitude:number;altitude?:number};
export type ExifInfo = {fields: {label:string;value:string}[]; width?:number;height?:number;geo?:PhotoGeo};
const tags=['Make','Model','LensMake','LensModel','DateTimeOriginal','OffsetTimeOriginal','ExposureTime','FNumber','ISO','FocalLength','FocalLengthIn35mmFormat','ExposureCompensation','WhiteBalance'];
const gpsTags=['GPSLatitude','GPSLatitudeRef','GPSLongitude','GPSLongitudeRef','GPSAltitude','GPSAltitudeRef'];
const numeric=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:undefined;
const text=(value:unknown)=>typeof value==='string'?value.replace(/\0/g,'').trim().slice(0,250):'';
const decimal=(value:number)=>Number(value.toFixed(2)).toString();

export function readGeo(values:Record<string,unknown>):PhotoGeo|undefined {
  function coordinate(parts:unknown,ref:unknown,latitude:boolean) {
    if(!Array.isArray(parts)||parts.length!==3||!parts.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0))return;
    if(parts[1]>=60||parts[2]>=60||!(latitude?['N','S']:['E','W']).includes(String(ref)))return;
    const degrees=parts[0]+parts[1]/60+parts[2]/3600;
    if(degrees>(latitude?90:180))return;
    return degrees*(ref==='S'||ref==='W'?-1:1);
  }
  const latitude=coordinate(values.GPSLatitude,values.GPSLatitudeRef,true);
  const longitude=coordinate(values.GPSLongitude,values.GPSLongitudeRef,false);
  if(latitude===undefined||longitude===undefined)return;
  const geo:PhotoGeo={latitude,longitude};
  const altitude=numeric(values.GPSAltitude),rawRef=values.GPSAltitudeRef;
  const ref=rawRef instanceof Uint8Array&&rawRef.length===1?rawRef[0]:rawRef;
  if(altitude!==undefined&&altitude>=0&&(ref===0||ref===1))geo.altitude=altitude*(ref===1?-1:1);
  return geo;
}

export async function readExif(bytes:Buffer):Promise<ExifInfo> {
  const metadata=await sharp(bytes,{limitInputPixels:80000000}).metadata();
  const result:ExifInfo={fields:[],width:metadata.width,height:metadata.height};
  if(!metadata.exif)return result;
  // Sharp extracts the TIFF EXIF block consistently for JPEG, PNG and WebP.
  const tiff=metadata.exif.subarray(0,6).equals(Buffer.from('Exif\0\0'))?metadata.exif.subarray(6):metadata.exif;
  const values=await exifr.parse(tiff,{pick:[...tags,...gpsTags],gps:true,ifd1:false,xmp:false,iptc:false,icc:false,reviveValues:false,translateValues:false})||{};
  const geo=readGeo(values);if(geo)result.geo=geo;
  const add=(label:string,value:string)=>{if(value)result.fields.push({label,value});};
  const make=text(values.Make),model=text(values.Model);
  add('カメラ',model.toLowerCase().startsWith(make.toLowerCase())?model:[make,model].filter(Boolean).join(' '));
  add('レンズ',text(values.LensModel));
  const date=text(values.DateTimeOriginal);
  if(date)add('撮影日時',date.replace(/^(\d{4}):(\d{2}):(\d{2})/,'$1/$2/$3')+(text(values.OffsetTimeOriginal)?` (${text(values.OffsetTimeOriginal)})`:'（タイムゾーン未記録）'));
  const exposure=numeric(values.ExposureTime);
  if(exposure!==undefined&&exposure>0){const reciprocal=1/exposure;add('シャッター速度',exposure<1&&Math.abs(reciprocal-Math.round(reciprocal))<0.01?`1/${Math.round(reciprocal)} 秒`:`${Number(exposure.toPrecision(4))} 秒`);}
  const aperture=numeric(values.FNumber);if(aperture!==undefined&&aperture>0)add('絞り',`f/${decimal(aperture)}`);
  const iso=numeric(values.ISO);if(iso!==undefined)add('ISO感度',String(iso));
  const focal=numeric(values.FocalLength);if(focal!==undefined)add('焦点距離',`${decimal(focal)} mm`);
  const equivalent=numeric(values.FocalLengthIn35mmFormat);if(equivalent!==undefined&&equivalent>0)add('35mm換算',`${decimal(equivalent)} mm`);
  const compensation=numeric(values.ExposureCompensation);if(compensation!==undefined)add('露出補正',`${compensation>0?'+':''}${decimal(compensation)} EV`);
  const wb=values.WhiteBalance;
  if(wb===0||wb==='Auto')add('ホワイトバランス','オート');
  else if(wb===1||wb==='Manual')add('ホワイトバランス','マニュアル');
  else add('ホワイトバランス',text(wb));
  return result;
}
