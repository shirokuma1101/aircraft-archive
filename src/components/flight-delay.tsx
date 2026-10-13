import {flightDelay} from '@/lib/flight-delay';
import type {Row} from '@/lib/model';

export default function FlightDelay({flight}:{flight:Row}) {
  return <div className="flight-delays">{(['departure','arrival'] as const).map(phase=>{
    const result=flightDelay(flight[`scheduled_${phase}`],flight[`actual_${phase}`],phase);
    const severity=result.kind==='late'?(result.seconds!<=1800?'delay-yellow':result.seconds!<=3600?'delay-orange':'delay-red'):'';
    return <span key={phase} className={`flight-delay ${result.kind} ${severity}`} title={result.kind==='unknown'?'予定または実績の日時が未入力です':'実績日時 − 予定日時'}><span>{phase==='departure'?'出発':'到着'}</span><strong>{result.label}</strong></span>;
  })}</div>;
}
