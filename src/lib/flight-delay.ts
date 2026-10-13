export function flightDelay(scheduled?:string|null,actual?:string|null,phase:'departure'|'arrival'='arrival') {
  if(!scheduled||!actual)return {kind:'unknown',label:'比較不可',seconds:null};
  const milliseconds=Date.parse(actual)-Date.parse(scheduled);
  if(!Number.isFinite(milliseconds))return {kind:'unknown',label:'比較不可',seconds:null};
  const seconds=Math.round(milliseconds/1000);
  if(seconds===0)return {kind:'ontime',label:'定刻',seconds};
  const duration=Math.abs(seconds)<60?'1分未満':`${Math.floor(Math.abs(seconds)/60)}分${Math.abs(seconds)%60?`${Math.abs(seconds)%60}秒`:''}`;
  return {kind:seconds>0?'late':'early',label:`${duration}${seconds>0?'遅延':phase==='departure'?'早発':'早着'}`,seconds};
}
