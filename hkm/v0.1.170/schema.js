const HkmBattle = (() => {
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const copy = value => JSON.parse(JSON.stringify(value));
  const count = value => Math.max(0, Math.floor(Number(value) || 0));
  const id = run => run ? String(run.id || String(run.map) + ':' + String(run.startedAt)) : '';
  const npcEnemy = row => row && !HkmStateBoundary.friendly(row) && !['友善','友好','中立'].includes(row.attitude ?? row.态度 ?? row.状态)
    && (['敌对','中立-敌对'].includes(row.attitude ?? row.态度 ?? row.状态) || Number(row.attack ?? row.攻击力) > 0 || row.fishingMonster === true);
  const units = run => [...(run?.players || []).map(row => ({ row, kind:'玩家' })), ...(run?.npcs || []).map(row => ({ row, kind:'NPC' })), ...Object.values(object(run?.fishingDead)).map(row => ({ row, kind:'NPC' }))];
  const roster = run => {
    const next = { ...object(run?.battleRoster) };
    for (const {row,kind} of units(run)) if (row?.id && (kind === '玩家' || npcEnemy(row))) next[row.id] = kind;
    return next;
  };
  const summary = run => {
    const targets = roster(run), seen = object(run?.fishingKills?.seen);
    const players = Object.values(targets).filter(kind => kind === '玩家').length;
    const npcs = Object.values(targets).filter(kind => kind === 'NPC').length;
    const knownPlayers = Object.entries(seen).filter(([key,actor]) => actor === 'hero' && targets[key] === '玩家').length;
    const npcKills = Object.entries(seen).filter(([key,actor]) => actor === 'hero' && targets[key] === 'NPC').length;
    const legacy = run?.battleVersion === 1 ? count(run.legacyPlayerKills) : Math.max(0, count(run?.killCount) - knownPlayers);
    return { players, npcs, playerKills:Math.min(players,knownPlayers + legacy), npcKills:Math.min(npcs,npcKills) };
  };
  const register = run => {
    if (!run) return false;
    const before = JSON.stringify([run.battleVersion,run.battleRoster,run.legacyPlayerKills,run.killCount]);
    const next = summary(run);
    if (run.battleVersion !== 1) {
      const known = Object.entries(object(run.fishingKills?.seen)).filter(([key,actor]) => actor === 'hero' && roster(run)[key] === '玩家').length;
      run.legacyPlayerKills = Math.max(0,next.playerKills - known);
    }
    run.battleVersion = 1; run.battleRoster = roster(run); run.killCount = summary(run).playerKills;
    return before !== JSON.stringify([run.battleVersion,run.battleRoster,run.legacyPlayerKills,run.killCount]);
  };
  const clear = run => {
    const totals = summary(run);
    return totals.players > 0 && totals.playerKills >= Math.ceil(totals.players / 2)
      && (run?.players || []).every(row => row.alive === false || Number(row.hp) <= 0 || row.extracted === true);
  };
  const blank = () => ({ _对局ID:'', _玩家总数:0, _NPC敌人总数:0, _主角击杀玩家数:0, _主角击杀NPC数:0, 叙事击杀:{} });
  const project = (raw,run) => {
    if (!run) return blank();
    const current = id(run), totals = summary(run), events = {};
    for (const [key,row] of Object.entries(object(raw?.叙事击杀))) {
      if (key === row?.目标ID && row.对局ID === current && ['玩家','NPC'].includes(row.目标类型) && ['主角','其他','未知'].includes(row.击杀者)) events[key] = copy(row);
    }
    for (const {row,kind} of units(run)) {
      if (!row?.id || row.extracted || Number(row.hp) > 0 || kind === '玩家' && row.alive !== false) continue;
      const actor=object(run.fishingKills?.seen)[row.id];
      events[row.id]={目标ID:row.id,对局ID:current,目标类型:kind,击杀者:actor==='hero'?'主角':actor?'其他':'未知',确认死亡:true};
    }
    return { _对局ID:current, _玩家总数:totals.players, _NPC敌人总数:totals.npcs, _主角击杀玩家数:totals.playerKills, _主角击杀NPC数:totals.npcKills, 叙事击杀:events };
  };
  const narrative = (stat,run) => {
    if (!run || stat?.场景?.地图 !== run.map) return [];
    const events = project(stat.本局统计,run).叙事击杀, result = [];
    for (const [name,row] of Object.entries(object(stat.敌人))) {
      if (row?.地图 && row.地图 !== run.map || row?.区域 && row.区域 !== stat.场景.区域) continue;
      const key = row?._ID || row?.ID;
      const target = units(run).find(({row:unit,kind}) => (key ? unit.id === key : unit.name === (row?.名称 || name))
        && unit.region === stat.场景.区域 && !unit.extracted && (!row?._类型 || row._类型 === kind));
      if (!target) continue;
      const event = events[target.row.id], currentHp = String(row?.血量 ?? '').split('/')[0].trim();
      const zeroHp = /^0(?:\.0+)?$/.test(currentHp), confirmed = event?.确认死亡 === true && event.目标类型 === target.kind;
      const deadStatus = /^(死亡|已死亡|已死)$/.test(String(row?.状态 || '').trim());
      if (!confirmed && !zeroHp && !deadStatus) continue;
      result.push({ target:target.row, kind:target.kind, actor:confirmed
        ? event.击杀者 === '主角' ? 'hero' : event.击杀者 === '其他' ? 'other' : null : null });
    }
    return result;
  };
  const settlement = (stat,run) => {
    const ledger = { ...object(stat?.前端结算?.事件) }, stats = { ...object(stat?.统计信息) };
    let players = 0;
    for (const [target,actor] of Object.entries(object(run?.fishingKills?.seen))) {
      if (actor !== 'hero' || roster(run)[target] !== '玩家') continue;
      const key = 'kill:' + id(run) + ':' + target;
      if (ledger[key] === true) continue;
      ledger[key] = true; players++;
    }
    if (players) stats.历史击杀玩家总数 = count(stats.历史击杀玩家总数) + players;
    return { players, patch:{ 统计信息:stats, 前端结算:{ ...object(stat?.前端结算), 事件:ledger }, 本局统计:project(stat?.本局统计,run) } };
  };
  return {id,npcEnemy,roster,summary,register,clear,blank,project,narrative,settlement};
})();

const HkmStateBoundary = (() => {
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const matchesUnit = (key,row,unit) => {
    const id=row?._ID || row?.ID || row?.id;
    return id ? unit.id===id : unit.id===key || unit.name===(row?.名称 || row?.姓名 || key);
  };
  const friendly = row => {
    if(!row)return false;
    const tags=row.标签 ?? row.tags;
    const values=Array.isArray(tags)?tags:typeof tags==='object' && tags?Object.keys(tags).filter(key=>tags[key]):String(tags || '').split(/[、,，;；\s]+/);
    return row.友善===true || row.friendly===true || values.some(tag=>['友善','友好'].includes(String(tag)))
      || /^(友善|友好)$/.test(String(row.attitude ?? row.态度 ?? '')) || /(?:^|[·；;,，\s])(?:友善|友好)(?:$|[·；;,，\s])/.test(String(row.状态 ?? ''));
  };
  const npcRecord = (npc,map) => {
    const number=value=>Number.isFinite(Number(value))?Number(value):0;
    const attitude=friendly(npc)?'友善':npc.attitude || npc.态度 || (number(npc.attack)>0?'敌对':'中立');
    return {ID:npc.id,_ID:npc.id,_类型:'NPC',地图:map,区域:npc.region,名称:npc.name,
      血量:String(Math.max(0,number(npc.hp)))+'/'+String(Math.max(0,number(npc.maxHp))),攻击力:number(npc.attack),防御力:number(npc.defense),速度:number(npc.speed),
      态度:attitude,状态:attitude,标签:friendly(npc)?['友善']:[],威胁等级:number(npc.threat),
      描述:npc.kind+'·'+npc.faction+'（'+attitude+'）。'+(npc.desc?' '+npc.desc:''),来源:'NPC',离开区域:'否'};
  };
  const copy = value => JSON.parse(JSON.stringify(value));
  const pick = (value, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(object(value), key)).map(key => [key, copy(value[key])]));
  const equipmentSlots = ['主武器','副武器','头盔','面部','胸甲','护腿','靴子','背包','内裤','项链','戒指','手饰','特殊工具'];
  const equipment = stat => ({...Object.fromEntries(equipmentSlots.map(slot=>[slot,typeof stat?.装备?.[slot]==='string' ? stat.装备[slot] : '无'])),_前端处理:copy(object(stat?._装备处理)),_待结算:copy(Array.isArray(stat?._装备事件)?stat._装备事件:[])});
  const heroKeys = ['姓名','性别','处女状态','是否死亡','致命溢出伤害','当前血量'];
  const semantic = row => row?.前端判定 === '语义' || typeof row?.语义目标 === 'string' && !!row.语义目标;
  const frontendStatus = key => /^(恢复|负重|免轮|上限)-/.test(key);
  const migrate = raw => {
    const stat = copy(object(raw));
    if(stat.装备?._前端处理)stat._装备处理=copy(stat.装备._前端处理);
    if(Array.isArray(stat.装备?._待结算))stat._装备事件=copy(stat.装备._待结算);
    if(stat.装备){delete stat.装备._前端处理;delete stat.装备._待结算;}
    stat.任务 = {...object(stat.任务)};
    for (const [root, type] of [['系统任务','main'],['战局任务','battle'],['其他委托','commission']]) {
      for (const [key, value] of Object.entries(object(stat[root]))) {
        const row = object(value), id = String(row.任务ID || key);
        if (!Object.hasOwn(stat.任务, id)) stat.任务[id] = {...row,任务ID:id,类型:row.类型 || type};
      }
      delete stat[root];
    }
    for (const box of [stat.主角,stat.主角?.基础属性,stat.主角?.临时加成?.固定]) if (box && Object.hasOwn(box,'额外交互轮数上限')) {
      if (!Object.hasOwn(box,'额外水下行动值上限')) box.额外水下行动值上限 = box.额外交互轮数上限;
      delete box.额外交互轮数上限;
    }
    return stat;
  };
  const compose = (raw, privateStat, front = {}) => {
    if (!privateStat || !Object.keys(object(privateStat)).length) return {...migrate(raw),本局统计:HkmBattle.project(raw?.本局统计,front.run)};
    const stat = migrate(privateStat), current = object(raw);
    stat._装备事件=copy(Array.isArray(current.装备?._待结算)?current.装备._待结算:[]);
    stat.主角 = {...object(stat.主角),...pick(current.主角,heroKeys)};
    stat.场景 = {...object(stat.场景),...pick(current.场景,['是否战斗中'])};
    stat.统计信息 = {...object(stat.统计信息),...pick(current.统计信息,['哈基币','名望','风评'])};
    if (Object.hasOwn(current,'状态列表')) stat.状态列表 = {
      ...Object.fromEntries(Object.entries(object(stat.状态列表)).filter(([key])=>frontendStatus(key))),
      ...copy(Object.fromEntries(Object.entries(object(current.状态列表)).filter(([key])=>!frontendStatus(key)))),
    };
    const visible = visibleEnemies(stat,front);
    for (const [key, row] of Object.entries(object(current.敌人))) if (Object.hasOwn(visible,key)) {
      stat.敌人[key] = {...visible[key],...stat.敌人[key],...pick(row,['血量','状态','标签'])};
    }
    for (const [key, row] of Object.entries(object(current.任务))) if (semantic(stat.任务[key])) {
      stat.任务[key] = {...stat.任务[key],...pick(row,['语义进度','进度说明','语义完成','已完成步骤'])};
    }
    for (const row of Object.values(object(stat.敌人))) if (/^(死亡|已死亡|已死)$/.test(String(row?.状态 || '').trim())) {
      const upper=String(row.血量 || '').split('/')[1];
      if (upper) row.血量='0/'+upper;
    }
    if (stat.主角.是否死亡 === true) stat.主角.当前血量=0;
    else if (Number(stat.主角.当前血量)<=0) stat.主角.是否死亡=true;
    stat.本局统计 = HkmBattle.project(current.本局统计,front.run);
    return stat;
  };
  const visibleEnemies = (stat, front = {}) => {
    const scene = object(stat.场景), run = object(front.run), candidates={...object(stat.敌人)};
    if(run.map===scene.地图)for(const npc of run.npcs || []){
      if(npc.region!==scene.区域 || Number(npc.hp)<=0)continue;
      const entry=Object.entries(candidates).find(([key,row])=>matchesUnit(key,row,npc));
      const key=entry?.[0] || npc.name;
      candidates[key]={...npcRecord(npc,run.map),...entry?.[1],ID:npc.id,_ID:npc.id,_类型:'NPC'};
    }
    return Object.fromEntries(Object.entries(candidates).filter(([key,row]) => {
      if (row?.地图 && row.地图 !== scene.地图 || row?.区域 && row.区域 !== scene.区域 || row?.离开区域 === '是') return false;
      const player = (run.players || []).find(player => matchesUnit(key,row,player));
      if (player) return run.map === scene.地图 && player.region === scene.区域 && player.alive !== false && !player.extracted
        && (!player.crouched || Number.isFinite(player.revealedTurn) && player.revealedTurn === run.soundTurn || run.sight?.['hero:'+player.id]?.area === player.region && run.sight?.['hero:'+player.id]?.noticed === true);
      const npc = (run.npcs || []).find(npc => matchesUnit(key,row,npc));
      return npc ? run.map === scene.地图 && npc.region === scene.区域 && Number(npc.hp) > 0 : !!row?.区域 && row.区域 === scene.区域 && (!row.地图 || row.地图 === scene.地图);
    }));
  };
  const unitMeta = (key,row,front) => {
    const matches = p => matchesUnit(key,row,p);
    const player = (front.run?.players || []).find(matches);
    const npc = (front.run?.npcs || []).find(matches);
    return {ID:player?.id || npc?.id || row?._ID || row?.ID || key,类型:player?'玩家':npc?'NPC':row?._类型==='玩家' || row?.来源==='其他玩家'?'玩家':'NPC'};
  };
  const project = (stat, front = {}) => ({
    场景: pick(stat.场景,['是否战斗中']),
    主角: pick(stat.主角,heroKeys),
    装备: equipment(stat),
    敌人: Object.fromEntries(Object.entries(visibleEnemies(stat,front)).map(([key,row]) => [key,{...pick(row,['名称','血量','状态','标签','态度','来源']),_ID:unitMeta(key,row,front).ID,_类型:unitMeta(key,row,front).类型}])),
    状态列表: copy(Object.fromEntries(Object.entries(object(stat.状态列表)).filter(([key])=>!frontendStatus(key)))),
    任务: Object.fromEntries(Object.entries(object(stat.任务)).filter(([,row]) => semantic(row)).map(([key,row]) => [key,{...pick(row,['任务名称','语义目标','语义进度','进度说明']),语义完成:row.语义完成===true,已完成步骤:copy(object(row.已完成步骤))}])),
    统计信息: pick(stat.统计信息,['哈基币','名望','风评']),
    本局统计: HkmBattle.project(stat.本局统计,front.run),
  });
  const view = (stat, front = {}, equipment = {}) => ({
    场景: pick(stat.场景,['地图','区域','剩余交互轮数','剩余水下行动值','是否战斗中']),
    主角: pick(stat.主角,['姓名','性别','处女状态','是否死亡','当前血量','血量上限','攻击力','防御力','速度','当前负重','负重上限','水下行动值上限']),
    装备: copy(equipment),
    持续装备效果: Object.fromEntries(Object.entries(object(front.equipmentEffects)).filter(([,effect])=>effect.tide).map(([id,effect])=>[id,{潮汐之佑:copy(effect.tide),当前对话:front.dialogue?.count || 0}])),
    当前可见单位: Object.fromEntries(Object.entries(visibleEnemies(stat,front)).map(([key,row]) => [key,{...unitMeta(key,row,front),...pick(row,['名称','性别','血量','攻击力','防御力','速度','状态','标签',...(row?.来源 === '其他玩家' ? [] : ['描述'])])}])),
    状态列表: copy(object(stat.状态列表)),
    生涯: pick(stat.统计信息,['历史对局总数']),
    本局统计: HkmBattle.project(stat.本局统计,front.run),
  });
  const context = value => '<HkmViewContext version="1">\n' + JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e') + '\n</HkmViewContext>';
  return {compose,migrate,project,visibleEnemies,view,context,semantic,equipmentSlots,matchesUnit,friendly,npcRecord};
})();


export let Schema = null;

(async () => {
  const report = message => {
    try { console.error('[Zod Schema] ' + message); } catch (error) { void error; }
    try { if (typeof toastr === 'object' && toastr && typeof toastr.error === 'function') toastr.error(message, '[MVU]变量校验', { timeOut: 8000 }); } catch (error) { void error; }
  };
  const waitFor = async (check, timeoutMs) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      try { if (check()) return true; } catch (error) { void error; }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return false;
  };

  const ready = await waitFor(() => typeof z !== 'undefined' && z !== null && typeof z.object === 'function', 120000);
  if (!ready) {
    report('MVU 变量系统 120 秒内没有就绪，本次没有注册变量结构；请检查 MVU 脚本是否加载成功后再重新开局。');
    return;
  }

  let registerMvuSchema = null;
  try {
    ({ registerMvuSchema } = await import('https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js'));
  } catch (error) {
    report('校验器 mvu_zod.js 加载失败：' + (error && error.message ? error.message : error));
    return;
  }
  if (typeof registerMvuSchema !== 'function') {
    report('校验器没有导出 registerMvuSchema，本次没有注册变量结构。');
    return;
  }


  Schema = z.object({
    场景:z.object({是否战斗中:z.boolean().prefault(false)}).prefault({}),
    主角:z.object({姓名:z.string().prefault('未命名'),性别:z.enum(['女性','男性']).prefault('女性'),处女状态:z.enum(['是','否']).prefault('是'),是否死亡:z.boolean().prefault(false),致命溢出伤害:z.coerce.number().min(0).prefault(0),当前血量:z.coerce.number().prefault(20)}).prefault({}),
    装备:z.object({...Object.fromEntries(HkmStateBoundary.equipmentSlots.map(slot=>[slot,z.string().prefault('无')])),
      _前端处理:z.record(z.string(),z.object({物品ID:z.string(),名称:z.string(),特性:z.array(z.object({ID:z.string(),名称:z.string(),范围:z.string()})),技能:z.array(z.string())})).prefault({}),
      _待结算:z.array(z.object({ID:z.string(),来源:z.string(),目标:z.string(),类型:z.enum(['攻击','交战','治疗','护盾']).prefault('攻击'),武器:z.string().prefault(''),偷袭:z.boolean().prefault(false),额外闪避:z.coerce.number().min(0).max(1).prefault(0),数值:z.coerce.number().nonnegative().prefault(0)})).max(32).prefault([]),
    }).prefault({}),
    敌人:z.record(z.string(),z.object({_ID:z.string().prefault(''),_类型:z.enum(['玩家','NPC']).prefault('NPC'),名称:z.string().prefault(''),血量:z.string().prefault('0/0'),状态:z.string().prefault(''),标签:z.array(z.string()).prefault([]),态度:z.string().prefault(''),来源:z.string().prefault('')})).prefault({}),
    状态列表:z.record(z.string(),z.object({名称:z.string(),持续时间:z.string(),描述:z.string(),效果:z.string()})).prefault({}),
    任务:z.record(z.string(),z.object({任务名称:z.string().prefault(''),语义目标:z.string().prefault(''),语义进度:z.string().prefault('未开始'),进度说明:z.string().prefault(''),语义完成:z.boolean().prefault(false),已完成步骤:z.record(z.string(),z.boolean()).prefault({})})).prefault({}),
    统计信息:z.object({哈基币:z.coerce.number().prefault(0),名望:z.coerce.number().prefault(0),风评:z.coerce.number().prefault(0)}).prefault({}),
    本局统计:z.object({_对局ID:z.string().prefault(''),_玩家总数:z.coerce.number().int().nonnegative().prefault(0),_NPC敌人总数:z.coerce.number().int().nonnegative().prefault(0),_主角击杀玩家数:z.coerce.number().int().nonnegative().prefault(0),_主角击杀NPC数:z.coerce.number().int().nonnegative().prefault(0),叙事击杀:z.record(z.string(),z.object({目标ID:z.string(),对局ID:z.string(),目标类型:z.enum(['玩家','NPC']),击杀者:z.enum(['主角','其他','未知']),确认死亡:z.boolean().prefault(false)})).prefault({})}).prefault({}),
  });
  const migrateScope=async(read,write)=>{
    const data=await read();
    if(!data?.stat_data)return;
    const vars=getVariables({type:'chat'}) || {},front=vars.hkm_frontend_state || {};
    const full=HkmStateBoundary.compose(data.stat_data,data.hkm_game_data || front.gameData,front);
    const parsed=Schema.safeParse(HkmStateBoundary.project(full,front));
    if(!parsed.success)throw Error('变量迁移校验未通过，原数据保留。');
    if(full.场景?.地图){
      data.hkm_game_data=full;
      vars.hkm_frontend_state={...front,gameData:full};
      replaceVariables(vars,{type:'chat'});
    }
    data.stat_data=parsed.data;
    await write(data);
  };
  registerMvuSchema(Schema);
  try{
    if(typeof Mvu!=='undefined' && typeof getVariables==='function' && typeof replaceVariables==='function'){
      await migrateScope(()=>Mvu.getMvuData({type:'chat'}),data=>Mvu.replaceMvuData(data,{type:'chat'}));
      const target=typeof getLastMessageId==='function'?getLastMessageId():-1;
      if(Number.isInteger(target) && target>=0){const scope={type:'message',message_id:target};await migrateScope(()=>Mvu.getMvuData(scope),data=>Mvu.replaceMvuData(data,scope));}
    }
  }catch(error){report('变量迁移未完成：'+(error?.message || error));}
})().catch(error=>{try{console.error('[Zod Schema] '+(error?.stack || error));}catch(_){}});
