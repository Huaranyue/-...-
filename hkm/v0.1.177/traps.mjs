export function createTrapEngine({items = {}} = {}) {
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const copy = value => JSON.parse(JSON.stringify(value));
  const definitions = {
    'COL-0250': {name:'捕鼠陷阱',chance:0.6,damage:10,slow:5,turns:2},
    'COL-0251': {name:'诡雷陷阱',chance:0.8,damagePct:0.4,slow:8,turns:3},
  };
  const definition = itemId => definitions[itemId] || items[itemId]?.useEffect?.trap || null;
  const place = (run, {area, ownerId, itemId, token} = {}) => {
    const effect = definition(itemId);
    if (!run || !area || !ownerId || !effect) return {ok:false};
    run.traps ||= {};
    const previous = run.traps[area] ? copy(run.traps[area]) : null;
    run.trapSerial = Math.max(0, number(run.trapSerial)) + 1;
    const trap = {id:token || 'TRAP-'+run.trapSerial,area,ownerId,itemId,...copy(effect)};
    run.traps[area] = trap;
    return {ok:true,trap,previous,line:(items[itemId]?.name || effect.name)+'已放置在'+area+'。'};
  };
  const undo = (run, area, trapId, previous = null) => {
    if (run?.traps?.[area]?.id !== trapId) return false;
    if (previous) run.traps[area] = copy(previous);
    else delete run.traps[area];
    return true;
  };
  const enter = (run, {area, unit, rng = Math.random, damageMultiplier = 1} = {}) => {
    const trap = run?.traps?.[area];
    if (!trap || !unit?.id || unit.id === trap.ownerId || number(unit.hp) <= 0) return {triggered:false};
    const roll = rng();
    if (roll >= trap.chance) return {triggered:false,roll,trapId:trap.id};
    const rawDamage = trap.damagePct ? Math.ceil(Math.max(1,number(unit.maxHp,1))*trap.damagePct) : number(trap.damage);
    const damage = Math.max(0,Math.floor(rawDamage*Math.max(0,number(damageMultiplier,1))));
    const before = Math.max(0,number(unit.hp));
    unit.hp = Math.max(0,before-damage);
    unit.overkill = Math.max(0,damage-before);
    if (unit.hp <= 0) unit.killer = trap.ownerId;
    const effects = unit.trapEffects ||= {};
    const slows = Array.isArray(effects.slows) ? effects.slows : [];
    effects.slows = [...slows,{id:trap.id,amount:trap.slow,remaining:trap.turns}];
    effects.skipActions = Math.max(1,number(effects.skipActions));
    delete run.traps[area];
    const name = unit.name || unit.id;
    return {triggered:true,roll,trapId:trap.id,ownerId:trap.ownerId,damage,dead:unit.hp<=0,
      line:name+'触发了'+trap.name+'，受到'+damage+'点伤害，速度降低'+trap.slow+'点（'+trap.turns+'回合），下次行动无法行动。'};
  };
  const beginAction = unit => {
    const effects = unit?.trapEffects;
    if (!effects || number(effects.skipActions) <= 0) return {blocked:false};
    effects.skipActions = Math.max(0,number(effects.skipActions)-1);
    return {blocked:true,line:(unit.name || unit.id || '玩家')+'受陷阱影响，本回合无法行动。'};
  };
  const endAction = unit => {
    const effects = unit?.trapEffects;
    if (!effects) return;
    effects.slows = (Array.isArray(effects.slows) ? effects.slows : [])
      .map(effect=>({...effect,remaining:Math.max(0,number(effect.remaining)-1)})).filter(effect=>effect.remaining>0);
    if (!effects.slows.length && !number(effects.skipActions)) delete unit.trapEffects;
  };
  const speedPenalty = unit => (Array.isArray(unit?.trapEffects?.slows) ? unit.trapEffects.slows : [])
    .filter(effect=>number(effect.remaining)>0).reduce((total,effect)=>total+Math.max(0,number(effect.amount)),0);
  return {definition,place,undo,enter,beginAction,endAction,speedPenalty};
}
