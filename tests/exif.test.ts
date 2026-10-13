import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {readExif,readGeo} from '../src/lib/exif';
const pixel={create:{width:48,height:32,channels:3 as const,background:'#568090'}};
const exif={IFD0:{Make:'Canon',Model:'Canon EOS R6',Artist:'DO NOT EXPOSE'},IFD2:{DateTimeOriginal:'2026:10:05 10:20:30',OffsetTimeOriginal:'+09:00',ExposureTime:'1/1000',FNumber:'56/10',ISOSpeedRatings:'400',FocalLength:'400/1',LensModel:'RF100-500mm',BodySerialNumber:'PRIVATE-SERIAL'}};
for(const format of ['jpeg','png','webp'] as const)test(`reads shooting EXIF from ${format} originals, excludes unrelated data`,async()=>{
  const bytes=await sharp(pixel).withExif(exif).toFormat(format).toBuffer();
  const result=await readExif(bytes),fields=Object.fromEntries(result.fields.map(f=>[f.label,f.value]));
  assert.equal(fields['カメラ'],'Canon EOS R6');assert.equal(fields['レンズ'],'RF100-500mm');
  assert.equal(fields['シャッター速度'],'1/1000 秒');assert.equal(fields['絞り'],'f/5.6');assert.equal(fields['ISO感度'],'400');assert.equal(fields['焦点距離'],'400 mm');
  assert.equal(fields['撮影日時'],'2026/10/05 10:20:30 (+09:00)');
  assert.equal(result.width,48);assert.equal(result.height,32);
  assert.ok(!JSON.stringify(result).includes('PRIVATE-SERIAL'));assert.ok(!JSON.stringify(result).includes('DO NOT EXPOSE'));
});
test('images without EXIF show empty fields and original dimensions',async()=>{
  const result=await readExif(await sharp(pixel).png().toBuffer());assert.deepEqual(result,{fields:[],width:48,height:32});
});
for(const format of ['jpeg','png','webp'] as const)test(`GPS coordinates and altitude extracted from ${format}`,async()=>{
  const bytes=await sharp(pixel).withExif({...exif,IFD3:{GPSLatitudeRef:'N',GPSLatitude:'35/1 33/1 0/1',GPSLongitudeRef:'E',GPSLongitude:'139/1 47/1 0/1',GPSAltitudeRef:'0',GPSAltitude:'15/1'}}).toFormat(format).toBuffer();
  const result=await readExif(bytes);
  assert.ok(result.geo);assert.equal(result.geo.latitude,35.55);assert.ok(Math.abs(result.geo.longitude-139.78333333333333)<1e-9);assert.equal(result.geo.altitude,15);
  assert.ok(!JSON.stringify(result).includes('PRIVATE-SERIAL'));
});
test('GPS hemisphere, zero coordinates and below-sea-level altitude',()=>{
  assert.deepEqual(readGeo({GPSLatitude:[33,30,0],GPSLatitudeRef:'S',GPSLongitude:[70,15,0],GPSLongitudeRef:'W',GPSAltitude:12,GPSAltitudeRef:1}),{latitude:-33.5,longitude:-70.25,altitude:-12});
  assert.deepEqual(readGeo({GPSLatitude:[0,0,0],GPSLatitudeRef:'N',GPSLongitude:[0,0,0],GPSLongitudeRef:'E'}),{latitude:0,longitude:0});
});
test('incomplete or invalid GPS never creates a misleading map position',()=>{
  const valid={GPSLatitude:[35,30,0],GPSLatitudeRef:'N',GPSLongitude:[139,30,0],GPSLongitudeRef:'E'};
  for(const patch of [{GPSLatitudeRef:undefined},{GPSLongitude:undefined},{GPSLatitude:[91,0,0]},{GPSLongitude:[180,1,0]},{GPSLatitude:[35,60,0]},{GPSLongitude:[NaN,0,0]}])assert.equal(readGeo({...valid,...patch}),undefined);
});
