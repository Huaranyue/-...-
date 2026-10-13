export const HkmRestraint = (() => {
  const weights = {人手禁锢:50,念控拘束器:80,触手束缚:60,触手boss:150,泗马拘束器:150};
  const count = value => Number.isFinite(Number(value)) ? Math.max(0,Math.floor(Number(value))) : 0;
  const sources = value => Object.fromEntries(Object.keys(weights).map(key=>[key,['念控拘束器','触手boss','泗马拘束器'].includes(key)?Math.min(1,count(value?.[key])):count(value?.[key])]));
  const strength = value => Object.entries(sources(value)).reduce((total,[key,amount])=>total+weights[key]*amount,0);
  const normalize = value => {
    const raw=value && typeof value==='object'?value:{}, origin=sources(raw.sources || raw.来源);
    const total=strength(origin), active=(raw.active ?? raw.生效)===true && total>0;
    return {active,strength:active?total:0,sources:active?origin:sources({}),strong:active && total>=150};
  };
  const create = origin => normalize({active:true,sources:origin});
  const active = value => normalize(value).active;
  const strong = value => normalize(value).strong;
  const toHero = value => {const state=normalize(value);return {生效:state.active,强度:state.strength,来源:state.sources,强效:state.strong};};
  const chance = value => {const state=normalize(value);return state.active && !state.strong?Math.max(0,Math.min(1,0.6-state.strength*0.004)):0;};
  const resist = (value,rng=Math.random) => {const before=normalize(value),success=before.active && !before.strong && rng()<chance(before);return {success,chance:chance(before),state:success?normalize({}):before};};
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
    for(const part of parts || []){const hit=part.match(/^(人手禁锢|念控拘束器|触手束缚|触手boss|泗马拘束器)\s*=\s*(\d+)$/);if(!hit || Object.hasOwn(result,hit[1]))return null;result[hit[1]]=Number(hit[2]);}
    return Object.keys(result).length?sources(result):null;
  };
  return {weights,sources,strength,normalize,create,active,strong,toHero,chance,resist,apply,requireFree,usable,names,parameters,parseSources};
})();
