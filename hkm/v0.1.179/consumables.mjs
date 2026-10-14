import {HkmRestraint} from './restraint.mjs';

export const HkmConsumables = (() => {
  const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const ids=new Set(['COL-0257','COL-0251','COL-0252','COL-0253','COL-0254','COL-0255','COL-0256']);
  const isNew=item=>ids.has(item?.id);
  const isInjection=item=>/针剂|注射/.test([item?.category,item?.name,item?.description,item?.usage,item?.details].join(' ')) || /针$/.test(String(item?.name));
  const useClass=item=>isInjection(item)?'针剂':isNew(item)?item.id:null;
  const chance=(hp,maxHp,factor,offset)=>Math.max(0,Math.min(1,(1-number(hp)/Math.max(1,number(maxHp,1)))*factor-offset));
  const bind=(target,{source,strength,factor,offset,token,rng=Math.random})=>{
    const probability=chance(target.hp,target.maxHp,factor,offset),roll=rng(),success=roll<probability;
    if(success)target.restraint=HkmRestraint.addSource(target.restraint,source+':'+token,strength);
    return {success,probability,roll,line:'对'+target.name+'使用'+source+'，成功率 '+(probability*100).toFixed(1)+'%，判定值 '+roll.toFixed(3)+'，'+(success?'拘束成功，拘束值 '+HkmRestraint.normalize(target.restraint).value:'拘束失败')+'。'};
  };
  const pulse=(source,target,{friendly,damage,turn,hasActed=false}={})=>{
    if(friendly){
      const entry=HkmRestraint.sourceEntries(target.restraint).find(([,row])=>number(row.拘束强度)<80);
      if(entry)target.restraint=HkmRestraint.removeSource(target.restraint,entry[0]);
      return {damage:0,released:entry?.[0],line:source.name+'对'+target.name+'使用脉冲新星，'+(entry?'解除拘束来源「'+entry[0]+'」（强度 '+entry[1].拘束强度+'）':'没有强度低于80的拘束来源')+'。'};
    }
    const raw=4+.12*Math.max(0,number(source.attack)),dealt=damage(source,target,raw),blocked=dealt>0 && !hasActed;
    if(blocked)target.pulseBlockedTurn=turn;
    return {damage:dealt,raw,blocked,line:source.name+'对'+target.name+'使用脉冲新星，折前伤害 '+raw.toFixed(2)+'，实际伤害 '+dealt+'，'+(dealt<=0?'未造成有效伤害':hasActed?'目标已行动，本回合行动不受影响':'目标本回合无法行动')+'。'};
  };
  const teleport=(map,from,{movable=[],enemies=[],tier=()=>0,rng=Math.random}={})=>{
    const grid=Array.isArray(map?.grid)?map.grid:[],positions=[];
    for(let y=0;y<grid.length;y++)for(let x=0;x<(grid[y]?.length || 0);x++){
      const cell=grid[y][x],area=typeof cell==='string'?cell:cell?.area || cell?.name;
      if(area)positions.push({area,x,y});
    }
    const origin=positions.find(row=>row.area===from);if(!origin)throw Error('当前区域没有地图坐标，无法转移。');
    const candidates=positions.filter(row=>row.area!==from && Math.abs(row.x-origin.x)<=2 && Math.abs(row.y-origin.y)<=2).map(row=>row.area);
    if(!candidates.length)throw Error('周围两格内没有可转移区域。');
    const occupied=new Set(enemies),safe=candidates.filter(area=>!occupied.has(area)),near=safe.filter(area=>movable.includes(area));
    const pool=near.length?near:safe.length?safe:candidates.filter(area=>tier(area)===Math.min(...candidates.map(tier)));
    return pool[Math.min(pool.length-1,Math.floor(rng()*pool.length))];
  };
  return {isNew,isInjection,useClass,chance,bind,pulse,teleport};
})();
