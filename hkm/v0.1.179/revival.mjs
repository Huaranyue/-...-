import {HkmRestraint} from './restraint.mjs';

export const HkmRevival = (() => {
  const itemId='COL-0258';
  const object=value=>value && typeof value==='object' && !Array.isArray(value)?value:{};
  const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const copy=value=>JSON.parse(JSON.stringify(value));
  const runId=run=>run?String(run.id || String(run.map)+':'+String(run.startedAt)):'';
  const matches=(value,resolve)=>resolve(String(value || ''))?.id===itemId;
  const held=(stat,resolve)=>{
    for(const [key,row] of Object.entries(object(stat?.背包?.携带收藏品)))if(matches(row?.名称 || key,resolve) && Math.floor(number(row?.数量,1))>0)return {where:'背包',key};
    for(const [key,name] of Object.entries(object(stat?.装备?.奇物)))if(matches(name,resolve))return {where:'奇物',key};
    if(matches(stat?.装备?.特殊工具,resolve))return {where:'特殊工具',key:'特殊工具'};
    return null;
  };
  const offer=(stat,front,snapshot,resolve)=>{
    const present=held(stat,resolve),visible=!!present || !!held(snapshot?.inventory,resolve);
    const sameRun=!snapshot?.runId || runId(front?.run)===snapshot.runId;
    const sameArea=snapshot?.map===stat?.场景?.地图 && snapshot?.area===stat?.场景?.区域;
    return {visible,enabled:!!present && !!snapshot && snapshot.phase!=='resolved' && stat?.主角?.是否死亡===true && sameRun && sameArea,where:present?.where || ''};
  };
  const negative=(key,row)=>{
    if(row?.性质==='负面')return true;
    if(['增益','中性'].includes(row?.性质))return false;
    if(row?.负面===true || row?.negative===true || row?.isDebuff===true || /^(negative|debuff|负面|减益)$/.test(String(row?.polarity || row?.type || '')))return true;
    if(/^(恢复|负重|免轮|上限)-/.test(key))return false;
    const name=[key,row?.名称].join(' '),effect=String(row?.效果 || ''),text=[name,row?.描述,effect].join(' ');
    if(/免疫|抗性|抵抗|防护|净化|(?:^|\s)抗(?:中毒|毒|眩晕|麻痹|流血|灼烧|冻结|寄生|催情)/.test(name) && !/失效|削弱|降低|丧失/.test(name))return false;
    if(/^(拘束|陷阱)-/.test(key) || /拘束|束缚|禁锢|眩晕|昏迷|中毒|流血|灼烧|冻伤|冻结|麻痹|减速|虚弱|衰弱|失明|致盲|瘫痪|感染|寄生|催情|发情|敏感|窒息|缺氧|负面|减益/.test(name))return true;
    if(/免疫|抗性|抵抗|免除|解除|清除|消除|抑制|净化/.test(effect) && !/仍然|依旧|持续受到/.test(effect))return false;
    return /无法行动|不能行动|禁止行动|每(?:轮|回合|秒).{0,12}(?:损失|扣除|失去|受到.{0,8}伤害)|(?:攻击力|防御力|速度|血量上限|负重上限|水下行动值上限)\s*[-−－]\s*\d|(?:攻击力|防御力|速度|血量上限|负重上限|水下行动值上限).{0,8}(?:降低|减少|下降)|中毒|流血|灼烧|眩晕|麻痹|触手寄生|催情|发情|敏感/.test(text);
  };
  const positiveBonuses=raw=>Object.fromEntries(Object.entries(object(raw)).map(([kind,box])=>[kind,Object.fromEntries(Object.entries(object(box)).map(([key,value])=>[key,Math.max(0,number(value))]))]));
  const plan=(stat,front,snapshot,{resolve,heroStats,waterCap})=>{
    if(!offer(stat,front,snapshot,resolve).enabled)throw Error('反魂蝶已不在身上，或死亡场景已变化，请重新确认。');
    const next=copy(stat),after={death:null},present=held(next,resolve);
    if(present.where==='背包'){
      const bag=next.背包.携带收藏品,row=bag[present.key],quantity=Math.floor(number(row?.数量,1));
      if(quantity===1)delete bag[present.key];else row.数量=quantity-1;
    }else{
      if(present.where==='奇物')delete next.装备.奇物[present.key];
      if(matches(next.装备.特殊工具,resolve))next.装备.特殊工具='无';
    }
    const removed=Object.entries(object(next.状态列表)).filter(([key,row])=>negative(key,row)).map(([key])=>key);
    next.状态列表=Object.fromEntries(Object.entries(object(next.状态列表)).filter(([key])=>!removed.includes(key)));
    const actor={...object(next.主角),是否死亡:false,致命溢出伤害:0,拘束状态:HkmRestraint.toHero(HkmRestraint.clear()),陷阱状态:{},临时加成:positiveBonuses(next.主角?.临时加成)};
    for(const key of ['trapEffects','trapBlockedFloor','pulseBlockedTurn','stunnedUntil','restraint'])delete actor[key];
    next.主角=actor;
    next.主角=heroStats(next,next.装备,next.背包);
    next.主角.当前血量=next.主角.血量上限;
    const cap=Math.max(0,number(waterCap(next)));
    next.场景={...object(next.场景),剩余水下行动值:String(cap),水下机制版本:1};
    if(front.run){after.run=copy(front.run);if(after.run.map==='魔鬼海')after.run.water=cap;}
    const effects=copy(object(front.equipmentEffects));
    if(effects.hero){delete effects.hero.stunnedUntil;delete effects.hero.pulseBlockedTurn;}
    after.equipmentEffects=effects;
    after.actionPenalty={...copy(object(front.actionPenalty)),events:{}};
    const patch={主角:next.主角,场景:next.场景,装备:next.装备,背包:next.背包,状态列表:next.状态列表};
    const line=String(next.主角?.姓名 || '主角')+'消耗反魂蝶×1，在'+next.场景.地图+'·'+next.场景.区域+'原地复活，血量 '+next.主角.当前血量+'/'+next.主角.血量上限+'，水下行动值 '+cap+'/'+cap+'；负面状态已清空，其他收藏品保留。';
    return {patch,after,line,removed,where:present.where};
  };
  return {itemId,held,offer,negative,positiveBonuses,plan};
})();
