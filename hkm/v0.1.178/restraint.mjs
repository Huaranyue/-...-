export const HkmRestraint = (() => {
  const weights = {人手禁锢:50,念控拘束器:80,触手束缚:60,触手boss:150,泗马拘束器:150};
  const object = value => value && typeof value==='object' && !Array.isArray(value)?value:{};
  const amount = value => Number.isFinite(Number(value)) ? Math.max(0,Number(value)) : 0;
  const count = value => Math.floor(amount(value));
  const legacyKeys = value => Object.fromEntries(Object.entries(object(value)).flatMap(([key,value])=>{
    if(value && typeof value==='object')return amount(value.拘束强度 ?? value.strength)>0?[[key,{...value,拘束强度:amount(value.拘束强度 ?? value.strength)}]]:[];
    const total=(weights[key] || 1)*(['念控拘束器','触手boss','泗马拘束器'].includes(key)?Math.min(1,count(value)):weights[key]?count(value):amount(value));
    return total>0?[[key,{拘束强度:total}]]:[];
  }));
  const sourceKeys = value => Object.fromEntries(Object.entries(object(value)).flatMap(([key,row])=>{
    const total=amount(row && typeof row==='object'?row.拘束强度 ?? row.strength:row);
    return key && total>0?[[key,{...object(row),拘束强度:total}]]:[];
  }));
  const originOf = raw => {
    if(Object.hasOwn(raw,'拘束来源'))return sourceKeys(raw.拘束来源);
    if(Object.hasOwn(raw,'sourceKeys'))return sourceKeys(raw.sourceKeys);
    if(Object.hasOwn(raw,'来源') || Object.hasOwn(raw,'sources'))return (raw.active ?? raw.生效)===false?{}:legacyKeys(raw.sources ?? raw.来源);
    const total=amount(raw.强度 ?? raw.拘束强度 ?? raw.strength ?? raw.拘束值 ?? raw.value);
    return (raw.active ?? raw.生效)===true && total>0?{'既有拘束':{拘束强度:total}}:{};
  };
  const strength = value => Object.values(sourceKeys(value)).reduce((total,row)=>total+row.拘束强度,0);
  const sources = value => Object.fromEntries(Object.entries(legacyKeys(value)).map(([key,row])=>[key,weights[key]?row.拘束强度/weights[key]:row.拘束强度]));
  const normalize = value => {
    const raw=object(value),origin=originOf(raw),total=strength(origin);
    const state={active:total>0,sourceKeys:origin,value:total,strong:total>=150};
    Object.defineProperties(state,{strength:{get:()=>state.value},sources:{get:()=>state.sourceKeys}});
    return state;
  };
  const create = origin => normalize({sourceKeys:legacyKeys(origin)});
  const clear = () => normalize({sourceKeys:{}});
  const active = value => normalize(value).active;
  const strong = value => normalize(value).strong;
  const toHero = value => {const state=normalize(value);return {生效:state.active,拘束来源:state.sourceKeys,拘束值:state.value,强效:state.strong};};
  const sourceEntries = value => Object.entries(normalize(value).sourceKeys);
  const addSource = (value,key,total) => normalize({sourceKeys:{...normalize(value).sourceKeys,[key]:{拘束强度:amount(total)}}});
  const removeSource = (value,key) => normalize({sourceKeys:Object.fromEntries(sourceEntries(value).filter(([name])=>name!==key))});
  const afterCombat = value => normalize({sourceKeys:Object.fromEntries(sourceEntries(value).filter(([key])=>/^(?:拘束陷阱|拘束绳|驷马拘束器)(?::|$)/.test(key)))});
  const mergeNarrative = (value,origin) => create({...Object.fromEntries(sourceEntries(value).filter(([key])=>/^(?:拘束陷阱|拘束绳|驷马拘束器)(?::|$)/.test(key))),...origin});
  const chance = value => {const state=normalize(value);return state.active && !state.strong?Math.max(0,Math.min(1,0.6-state.value*0.004)):0;};
  const resist = (value,rng=Math.random) => {const before=normalize(value),success=before.active && !before.strong && rng()<chance(before);return {success,chance:chance(before),state:success?clear():before};};
  const apply = (stats,value) => {
    const next={...stats},state=normalize(value);
    if(!state.active)return next;
    for(const key of ['attack','defense','攻击力','防御力'])if(key in next)next[key]=Math.max(0,Number(next[key]) || 0)*(state.strong?0:0.5);
    if(state.strong)for(const key of ['speed','速度'])if(key in next)next[key]=0;
    return next;
  };
  const requireFree = value => {if(active(value))throw Error(strong(value)?'双手处于强效拘束，无法整理背包、替换装备、拾取或搜刮。':'双手被拘束，无法整理背包、替换装备、拾取或搜刮。');};
  const usable = item => item?.usableWhileRestrained===true || item?.restraintUsable===true || (item?.traits || []).some(row=>row.id==='usableWhileRestrained') || /(?:拘束|束缚)状态下仍(?:能|可)(?:以)?(?:发动|使用)/.test([item?.usage,item?.description,item?.details,...(item?.skills || []).map(row=>row.text)].filter(Boolean).join(' '));
  const names = (text,tag) => [...new Set([...String(text || '').matchAll(new RegExp('<'+tag+'>([^<>\\r\\n]+)</'+tag+'>','g'))].map(row=>row[1].trim()).filter(Boolean))];
  const parameters = (text,tag) => {
    const entries=new Map();
    for(const row of names(text,tag)){const [name,...parts]=row.split('|').map(part=>part.trim());if(name)entries.set(name,parts);}
    return entries;
  };
  const parseSources = parts => {
    const result={};
    for(const part of parts || []){
      const hit=part.match(/^([^=|<>\r\n]+?)\s*=\s*(\d+(?:\.\d+)?)$/);
      if(!hit || Object.hasOwn(result,hit[1].trim()))return null;
      const key=hit[1].trim();result[key]={拘束强度:Number(hit[2])};
    }
    return Object.keys(result).length?legacyKeys(result):null;
  };
  return {weights,sources,sourceKeys,strength,normalize,create,clear,active,strong,toHero,sourceEntries,addSource,removeSource,afterCombat,mergeNarrative,chance,resist,apply,requireFree,usable,names,parameters,parseSources};
})();
