import catalogData from '../../../curriculum/kanji-catalog.json' with {type:'json'};
import strokeData from '../../../curriculum/kanji-strokes.json' with {type:'json'};
import {Fault} from './errors.ts';
const catalog=catalogData as Record<string,Array<{character:string}>>;
const strokes=strokeData as Record<string,{character:string;paths:string[]}>;
export function animationLevel(path:string):string|undefined{
 const m=/^(?:kanji\/(n[2-5])\.json|strokes\/(n[2-5])\/[0-9a-f]{5}\.json)$/.exec(path);
 return (m?.[1]||m?.[2])?.toUpperCase();
}
// Caller must authenticate and verify the requested level before invoking this.
export function animationContent(path:string):unknown{
 const level=animationLevel(path);if(!level)throw new Fault(404,'Kanji unavailable');
 const entries=catalog[level.toLowerCase()];
 if(path.startsWith('kanji/'))return {level,entries};
 const id=path.split('/')[2].slice(0,-5),data=strokes[id];
 if(!data||!entries.some(e=>e.character===data.character))throw new Fault(404,'Kanji unavailable for this level');
 return data;
}
