export function createEquipmentEngine({items, underwater}) {
  const slots = ['主武器','副武器','头盔','面部','胸甲','护腿','靴子','背包','内裤','项链','戒指','手饰','特殊工具'];
  const list = Object.values(items);
  const resolve = value => items[value] || list.find(item => item.name === value);
  const number = (value, fallback=0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const copy = value => JSON.parse(JSON.stringify(value));
  const implemented = new Set(['damageTakenPct','regenPerRound','roundFreeChance','trueDamage','trueDamagePct','virginBonus','fishDamagePct','underwaterDamagePct','underwaterAccuracy','bubbleShot','officeSlayer','valueDrain','radiate','harmony','chord','seaBlessing','soulSiphon','growthQuest','noUnderwaterUse']);
  const partial = {
    mermaidMagic:'仅水下最终伤害减少10%，向上取整；人鱼形态仍由叙事处理',
    asYouWish:'仅必中、阻止逃跑；形状变化与目标选择仍由叙事处理',
    ranged:'仅逃跑时的远程压制伤害；仍可按原规则逃跑，目标选择由叙事处理',
  };
  const equipped = unit => slots.map(slot => ({slot,item:resolve(unit.equipment?.[slot])})).filter(row => row.item);
  const traits = unit => equipped(unit).flatMap(({item}) => item.traits || []);
  const has = (unit,id) => traits(unit).some(trait => trait.id === id);
  const sum = (unit,id) => traits(unit).filter(trait => trait.id === id).reduce((n,trait) => n+number(trait.value),0);
  const marker = (equipment, prefix='') => Object.fromEntries(equipped({equipment}).map(({slot,item}) => {
    const handled=(item.traits || []).filter(trait=>implemented.has(trait.id) || partial[trait.id] || trait.scope==='frontend' || item.id==='COL-0159' && trait.name==='装备限制');
    return [prefix+slot,{物品ID:item.id,名称:item.name,特性:handled.map(trait=>({ID:trait.id,名称:trait.name,范围:partial[trait.id] || '整条'})),技能:(item.skills || []).filter(skill=>skill.kind==='active' || skill.name==='人寿保险').map(skill=>skill.name)}];
  }));
  const virginDefense = unit => unit.virgin === '是' ? sum(unit,'virginBonus') : 0;
  const freeRound = (unit,rng=Math.random) => traits(unit).filter(trait=>trait.id==='roundFreeChance').map(trait=>rng()<number(trait.value)/100).some(Boolean);
  const heal = (unit,amount) => {
    if (unit.hp<=0) return 0;
    const value=Math.min(unit.maxHp-unit.hp,Math.max(0,Math.ceil(amount*(has(unit,'seaBlessing')?1.25:1))));
    unit.hp+=value;return value;
  };
  const roundHeal = (unit,count=1) => {
    let total=0;
    for(let round=0;round<count;round++)for(const trait of traits(unit).filter(trait=>trait.id==='regenPerRound'))total+=heal(unit,Math.ceil(unit.maxHp*number(trait.value)/100));
    return total;
  };
  const dialogue = (unit,clock,combat) => {
    unit.effects ||= {};
    if(unit.effects.dialogue===clock)return 0;
    const previous=number(unit.effects.dialogue,clock-1);
    unit.effects.dialogue=clock;
    unit.effects.siphon=0;
    let healing=0;
    for(let turn=previous+1;turn<=clock;turn++){
      if(combat && has(unit,'chord'))healing+=heal(unit,Math.ceil((unit.maxHp-unit.hp)*0.06));
      const tide=unit.effects.tide;
      if(tide && turn>tide.start && turn<=tide.end)healing+=heal(unit,Math.ceil(unit.maxHp*0.1));
    }
    if(unit.effects.tide && clock>unit.effects.tide.end)delete unit.effects.tide;
    if(unit.effects.stunnedUntil<clock)delete unit.effects.stunnedUntil;
    return healing;
  };
  const die = (sides,rng) => sides>0 ? 1+Math.floor(rng()*Math.max(1,Math.floor(sides))) : 0;
  const damage = (source,target,raw,{map,area,clock,rng=Math.random,trueDamage=0,bonus=true}={}) => {
    let ordinary=Math.max(0,raw-die(target.defense,rng));
    if(bonus){
      ordinary*=1+sum(source,'fishDamagePct')/100*(target.fish?1:0);
      if(underwater(map,area))ordinary*=1+sum(source,'underwaterDamagePct')/100;
      if(map==='谷歌大厦' && target.kind==='NPC' && has(source,'officeSlayer'))ordinary*=1.5;
    }
    ordinary=Math.ceil(ordinary);
    for(const trait of traits(target).filter(trait=>trait.id==='damageTakenPct'))ordinary=Math.floor(ordinary*(1+number(trait.value)/100));
    if(underwater(map,area) && has(target,'mermaidMagic'))ordinary=Math.ceil(ordinary*0.9);
    if(underwater(map,area) && has(target,'harmony'))ordinary=Math.ceil(ordinary*0.8);
    if(target.effects?.tide && clock<=target.effects.tide.end)ordinary=Math.max(0,ordinary-3);
    const shield=Math.max(0,number(target.effects?.shield));
    if(shield){const absorbed=Math.min(shield,ordinary);target.effects.shield-=absorbed;ordinary-=absorbed;}
    const total=Math.max(0,ordinary)+Math.max(0,trueDamage),before=target.hp;let available=before;
    target.hp=Math.max(0,before-total);
    if(before>0 && target.hp<=0)target.killer=source.id;
    target.overkill=Math.max(0,total-before);
    if(before>0 && target.hp<=0 && target.id!=='hero' && target.kind==='玩家' && equipped(target).some(({item})=>(item.skills || []).some(skill=>skill.name==='人寿保险'))){
      target.effects ||= {};
      const fee=Math.ceil(target.maxHp*0.5*50),restore=Math.ceil(target.maxHp*0.5);
      if(!target.effects.lifeInsuranceUsed && Number.isFinite(target.money) && target.money>=fee){
        target.money-=fee;target.effects.lifeInsuranceUsed=true;
        available+=restore;target.hp=Math.max(0,restore-target.overkill);
        if(target.hp>0)delete target.killer;
      }
    }
    return Math.min(available,total);
  };
  const lifeSteal = (unit,dealt) => {
    if(!has(unit,'soulSiphon') || unit.hp<=0)return 0;
    unit.effects ||= {};
    const left=Math.max(0,Math.ceil(unit.maxHp*0.2)-number(unit.effects.siphon));
    const actual=Math.min(left,Math.ceil(dealt*0.25*(has(unit,'seaBlessing')?1.25:1)),unit.maxHp-unit.hp);
    unit.hp+=actual;unit.effects.siphon=number(unit.effects.siphon)+actual;return actual;
  };
  const engage = (source,target,area) => {
    for(const [unit,other] of [[source,target],[target,source]]){
      unit.effects ||= {};
      const prior=unit.effects.combat;
      unit.effects.combat={area,targets:[...new Set([...(prior?.area===area?prior.targets || []:[]),other.id])]};
    }
  };
  const aiOffer = (source,units,{map,area,clock,round,cooldown,friendly}) => {
    if(source.hp<=0 || source.effects?.stunnedUntil>=clock || source.effects?.combat?.area!==area)return null;
    const foes=units.filter(unit=>unit.id!==source.id && unit.hp>0 && !friendly(source,unit));
    const engaged=foes.filter(unit=>source.effects.combat.targets?.includes(unit.id))
      .sort((a,b)=>number(b.threat)-number(a.threat) || number(b.speed)-number(a.speed) || String(a.id).localeCompare(String(b.id)));
    if(!engaged.length)return null;
    for(const {item} of equipped(source))for(const skill of item.skills || []){
      if(skill.kind!=='active')continue;
      const cd=cooldown(skill),token=item.id+':'+skill.name,record=source.effects?.skillCooldowns?.[token];
      if(!cd || number(record?.readyAt)>({dialogue:clock,round}[record?.unit] ?? 0))continue;
      if(/需要在水下/.test(skill.text) && !underwater(map,area))continue;
      if(/需要在有水/.test(skill.text) && map!=='魔鬼海')continue;
      const gearValue=equipped(source).filter(({item})=>!item.traits?.some(trait=>trait.id==='soulbound')).reduce((sum,{item})=>sum+Math.max(0,number(item.value)),0);
      if(skill.name==='资本碾压' && (!Number.isFinite(source.money) || source.money<Math.ceil(gearValue*0.25)))continue;
      if(skill.name==='潮汐之佑' && source.effects.tide?.end>=clock)continue;
      const mode=skill.name==='定海一棒' && foes.length===1?'下劈':'横扫';
      const targets=skill.name==='潮汐之佑'?[source]:skill.name==='资本碾压' || skill.name==='定海一棒' && mode==='下劈'?[engaged[0]]:foes;
      return {item,skill,token,cooldown:cd,gearValue,mode,targets};
    }
    return null;
  };
  const attack = (source,targets,options={}) => {
    const {map,area,clock=0,rng=Math.random,skill='',mode='横扫',ambush=false,allUnits=targets}=options;
    if(source.hp<=0)throw Error('攻击者已倒下。');
    if(source.effects?.stunnedUntil>=clock)throw Error('眩晕期间无法还击。');
    const weapon=resolve(options.weapon || source.equipment?.主武器) || (!options.weapon && !skill ? {id:'unarmed',traits:[]} : null);
    if(!weapon || weapon.id!=='unarmed' && !equipped(source).some(row=>row.item.id===weapon.id))throw Error('武器已不在装备栏。');
    if(underwater(map,area) && (weapon.traits || []).some(trait=>trait.id==='noUnderwaterUse'))throw Error('这件武器无法在水下使用。');
    if(!targets.length || targets.some(target=>target.id===source.id || target.hp<=0))throw Error('请选择仍在场的目标。');
    const selected=Array.from(new Map(targets.map(target=>[target.id,target])).values());
    if((skill==='资本碾压' || skill==='定海一棒' && mode==='下劈') && selected.length!==1)throw Error('此技能只能选择一个目标。');
    if(skill==='泾龙王' && map!=='魔鬼海')throw Error('需要在有水的区域。');
    if(skill==='资本碾压' && number(source.money)<Math.ceil(number(options.gearValue)*0.25))throw Error('哈基币不足，无法发动。');
    if(skill==='资本碾压')source.money-=Math.ceil(number(options.gearValue)*0.25);
    if(!skill && !options.rangedEscape)for(const target of selected)engage(source,target,area);
    const bubble=!skill && (weapon.traits || []).some(trait=>trait.id==='bubbleShot');
    const hits=options.rangedEscape?1:skill==='资本碾压'?10:bubble?4:1;
    const guaranteed=options.rangedEscape || skill==='泾龙王' || skill==='定海一棒' || (weapon.traits || []).some(trait=>trait.id==='asYouWish');
    const trueHit=sum(source,'trueDamage')+Math.ceil(source.attack*sum(source,'trueDamagePct')/100);
    const lines=[];let dealt=0;
    for(const target of selected){
      let effective=0,landed=0;
      const insuredBefore=target.effects?.lifeInsuranceUsed;
      for(let hit=0;hit<hits && target.hp>0;hit++){
        const accuracy=underwater(map,area)?sum(source,'underwaterAccuracy')/100:0;
        const dodge=Math.min(1,Math.max(0,(target.speed-source.speed)/(2*Math.max(1,source.speed)))+Math.max(0,number(target.extraDodge))+(bubble?0.25:0)-accuracy);
        if(!guaranteed && rng()<Math.max(0,dodge))continue;
        const raw=options.rangedEscape?source.attack:skill==='资本碾压'?Math.ceil(number(options.gearValue)*0.01):skill==='泾龙王'?Math.ceil(source.attack*1.5):skill==='定海一棒'?Math.ceil(source.attack*(mode==='下劈'?4:2.5)):bubble?Math.ceil(source.attack*0.3):Math.ceil(die(source.attack,rng)*(ambush?1.5:1));
        effective+=damage(source,target,raw,{map,area,clock,rng,trueDamage:trueHit});landed++;
      }
      dealt+=effective;
      if(skill==='定海一棒'){target.effects ||= {};target.effects.stunnedUntil=clock;}
      if(target.hp<=0 && has(source,'valueDrain') && Number.isFinite(target.money)){
        const loot=Math.floor(Math.max(0,target.money)*0.03);source.money=number(source.money)+loot;target.money-=loot;
        if(loot)lines.push('价值掠夺：'+loot+' 哈基币。');
      }
      lines.push(target.name+'：命中 '+landed+'/'+hits+' 段，实际伤害 '+effective+'，血量 '+target.hp+'/'+target.maxHp+'。');
      if(!insuredBefore && target.effects?.lifeInsuranceUsed)lines.push(target.name+'的人寿保险已发动，花费 '+Math.ceil(target.maxHp*25)+' 哈基币，恢复 '+Math.ceil(target.maxHp*0.5)+' 点生命后继续承受溢出伤害。');
    }
    if((weapon.traits || []).some(trait=>trait.id==='radiate'))for(const target of allUnits.filter(unit=>unit.hp>0)){
      const effective=damage(source,target,Math.ceil(target.maxHp*0.1),{map,area,clock,rng,bonus:false});
      if(target.id!==source.id)dealt+=effective;
      lines.push('辐射：'+target.name+'实际受到 '+effective+' 点伤害。');
    }
    const healing=lifeSteal(source,dealt);
    if(healing)lines.push('灵魂虹吸：恢复 '+healing+' 点血量。');
    return {lines,dealt,hits};
  };
  const tide = (unit,{map,area,clock}) => {
    if(!underwater(map,area))throw Error('需要在水下。');
    unit.effects ||= {};unit.effects.tide={start:clock,end:clock+3};
    return '潮汐之佑：固定减伤3点，接下来3次对话开始时恢复10%血量。';
  };
  const stopsEscape = unit => has(unit,'asYouWish');
  return {slots,resolve,marker,equipped,traits,has,sum,virginDefense,freeRound,heal,roundHeal,dialogue,damage,attack,tide,engage,aiOffer,stopsEscape,implemented,partial};
}
