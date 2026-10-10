import {GAME_DATA} from './game-data.mjs';
import {createEquipmentEngine} from './equipment.mjs';
export function mount(env) {
  const document=env.document,window=env.window,getCurrentMessageId=()=>env.messageId;
  const host=env.host,disposers=[],styles=new Set(),timeouts=new Set(),intervals=new Set(),frames=new Set();
  let disposed=false;
  const hkmCreateElement=(tag,...args)=>{const node=document.createElement(tag,...args);if(tag.toLowerCase()==='style')styles.add(node);return node;};
  const hkmPortal=document.createElement('div');hkmPortal.className='hkm-portal';document.body.append(hkmPortal);
  const hkmOwnTarget=target=>!!target && (host.contains(target)||hkmPortal.contains(target));
  const setTimeout=(fn,ms,...args)=>{if(disposed)return 0;const id=globalThis.setTimeout(()=>{timeouts.delete(id);if(!disposed)fn(...args);},ms);timeouts.add(id);return id;};
  const clearTimeout=id=>{timeouts.delete(id);globalThis.clearTimeout(id);};
  const setInterval=(fn,ms,...args)=>{if(disposed)return 0;const id=globalThis.setInterval(()=>{if(!disposed)fn(...args);},ms);intervals.add(id);return id;};
  const clearInterval=id=>{intervals.delete(id);globalThis.clearInterval(id);};
  const requestAnimationFrame=fn=>{if(disposed)return 0;const id=window.requestAnimationFrame(time=>{frames.delete(id);if(!disposed)fn(time);});frames.add(id);return id;};
  const cancelAnimationFrame=id=>{frames.delete(id);window.cancelAnimationFrame(id);};
  const hkmClampWindows=()=>{
    for(const node of hkmPortal.querySelectorAll('[data-win]')){
      if(node.hidden)continue;const rect=node.getBoundingClientRect();
      const width=window.visualViewport?.width || window.innerWidth,height=window.visualViewport?.height || window.innerHeight;
      node.style.left=Math.max(8,Math.min(rect.left,width-Math.min(rect.width,width-16)-8))+'px';
      node.style.top=Math.max(8,Math.min(rect.top,height-Math.min(rect.height,height-16)-8))+'px';
    }
  };
  window.addEventListener('resize',hkmClampWindows);window.visualViewport?.addEventListener('resize',hkmClampWindows);
  const hkmWindowObserver=new window.MutationObserver(hkmClampWindows);hkmWindowObserver.observe(hkmPortal,{subtree:true,attributes:true,attributeFilter:['hidden']});
  disposers.push(()=>{hkmWindowObserver.disconnect();window.removeEventListener('resize',hkmClampWindows);window.visualViewport?.removeEventListener('resize',hkmClampWindows);});
  const dispose=()=>{
    if(disposed)return;disposed=true;
    for(const fn of disposers.splice(0)){try{fn();}catch(_){}}
    for(const id of timeouts)globalThis.clearTimeout(id);timeouts.clear();
    for(const id of intervals)globalThis.clearInterval(id);intervals.clear();
    for(const id of frames)window.cancelAnimationFrame(id);frames.clear();
    for(const style of styles)style.remove();styles.clear();hkmPortal.remove();
    host.classList.remove('hkm-turn-locked','hkm-life-locked');host.replaceChildren();
    if(globalThis.__HKM_RESET_DISPOSERS===disposers)delete globalThis.__HKM_RESET_DISPOSERS;
  };
  const ready=(async()=>{
const HkmEquipment=createEquipmentEngine({items:GAME_DATA.collectibles,underwater:(map,area)=>HkmSea.cost(map,area,GAME_DATA.maps)>0});
const HkmFrontendMessage = (() => {
  const open = '<Frontend script input>', close = '</Frontend script input>';
  const wrap = text => open + '\n' + String(text ?? '').replace(/<\/?Frontend script input>/g, token => token.replace('<', '\x26lt;').replace('>', '\x26gt;')) + '\n' + close;
  const action = (text, type = 'records') => '<HkmFrontendAction type="'+(/^[a-z_]+$/.test(type)?type:'records')+'">\n'+String(text ?? '')+'\n</HkmFrontendAction>';
  const append = (original, generated, type = 'records') => String(original ?? '') + (String(generated ?? '').trim() ? '\n\n' + wrap(action(String(generated).trim(),type)) : '');
  const receipt = (message, revision) => {
    const text=String(message ?? '');
    if(!text.endsWith(close))throw Error('前端附加内容缺少统一结束标签');
    return text.slice(0,-close.length) + '<HkmPendingReceipt revision="' + String(revision) + '"/>\n' + close;
  };
  return { wrap, action, append, receipt };
})();

const HkmLifecycle = (() => {
  const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const num = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const copy = v => JSON.parse(JSON.stringify(v));
  const qty = row => Math.max(0, Math.floor(num(row?.数量, 1)));
  const trait = (item, key) => (item?.traits || []).some(t => (t?.key || t?.id || t?.trait) === key);
  const worn = (stat, resolve, id) => Object.values(obj(stat.装备)).some(name => resolve(String(name))?.id === id);
  const dead = stat => stat?.主角?.是否死亡 === true;
  const kept = (map, rules) => map === '哈基米空间' || rules?.keepInventory === true;
  const capture = (stat, run, rules, id) => ({
    id, phase: 'dead', map: String(stat?.场景?.地图 || ''), area: String(stat?.场景?.区域 || ''),
    runId: run?.id || (run ? String(run.map) + ':' + String(run.startedAt) : ''),
    keepInventory: kept(stat?.场景?.地图, rules), inventory: copy({ 装备: obj(stat.装备), 背包: obj(stat.背包), 藏匿物: obj(stat.藏匿物), 钥匙链:obj(stat.钥匙链) }),
    maxHp: Math.max(1, num(stat?.主角?.血量上限, 20)), overkill: Math.max(0, num(stat?.主角?.致命溢出伤害)),
    choices: {},
  });
  const ransom = (stat, run, snapshot, resolve) => {
    const equipped = worn(snapshot?.inventory || stat, resolve, 'COL-0103');
    const maxHp = Math.max(1, num(snapshot?.maxHp, num(stat?.主角?.血量上限, 20)));
    const fee = Math.ceil(maxHp * 25);
    const hp = Math.max(0, maxHp / 2 - Math.max(0, num(snapshot?.overkill)));
    return { visible: equipped, fee, hp, used: run?.lifeInsuranceUsed === true,
      enabled: equipped && !!run && run.map === snapshot?.map && (run.id || String(run.map)+':'+String(run.startedAt)) === snapshot?.runId && run.lifeInsuranceUsed !== true && num(stat?.统计信息?.哈基币) >= fee };
  };
  const protectedHidden = (row, resolve) => {
    const owner = resolve(String(row?.宿主 || ''));
    return !!owner && ['storagePants', 'storagePanties', 'hammerspace'].some(k => trait(owner, k));
  };
  const lossPlan = (snapshot, resolve, choices = {}) => {
    const src = snapshot.inventory;
    if (snapshot.keepInventory) return { inventory: copy(src), insured: [], dropped: [], paid: [], fee: 0, stashGrants: [] };
    const inventory = { 装备: {}, 背包: { ...copy(obj(src.背包)), 携带收藏品: {} }, 藏匿物: {}, 钥匙链:copy(obj(src.钥匙链)) };
    const insured = [], dropped = [], paid = [], stashGrants = [];
    let fee = 0;
    const keepRow = (where, key, row) => {
      if (where === '装备') inventory.装备[key] = row;
      else if (where === '背包') inventory.背包.携带收藏品[key] = row;
      else inventory.藏匿物[key] = row;
    };
    const handle = (where, key, row) => {
      const name = where === '装备' ? String(row) : String(row?.名称 || key);
      const item = resolve(name);
      const token = where + ':' + key;
      if (name === '无' || !name) { keepRow(where, key, where === '装备' ? '无' : row); return; }
      if ((where==='装备' && key==='特殊工具') || trait(item, 'soulbound') || (where === '藏匿物' && protectedHidden(row, resolve))) { keepRow(where, key, row); return; }
      if (where === '装备') inventory.装备[key] = '无';
      const quantity = where === '装备' ? 1 : qty(row);
      const value = Math.max(0, num(where === '装备' ? item?.value : row?.价值, num(item?.value)));
      if (trait(item, 'insured')) {
        const entry = { token, where, name, quantity, rarity: item?.rarity || row?.稀有度 || '寻常', fee: value * quantity };
        if (!['pay', 'waive'].includes(choices[token])) { insured.push(entry); return; }
        if (choices[token] === 'pay') {
          fee += entry.fee; paid.push(entry);
          stashGrants.push({ 名称: name, 数量: quantity, 稀有度: row?.稀有度 || item?.rarity || '寻常', 描述: row?.描述 || item?.description || '', 价值: value, 重量: num(row?.重量, num(item?.weight)) });
          return;
        }
      }
      dropped.push({ where, name, quantity, rarity: item?.rarity || row?.稀有度 || '寻常' });
    };
    for (const [key, row] of Object.entries(obj(src.装备))) handle('装备', key, row);
    for (const [key, row] of Object.entries(obj(src.背包?.携带收藏品))) handle('背包', key, row);
    for (const [key, row] of Object.entries(obj(src.藏匿物))) handle('藏匿物', key, row);
    return { inventory, insured, dropped, paid, fee, stashGrants };
  };
  const inventory = (stat, resolve) => {
    const rows = Object.create(null);
    const add = (name, quantity, row, item) => {
      if (!name || name === '无' || quantity <= 0) return;
      if (!rows[name]) rows[name] = { name, quantity: 0, value: Math.max(0, num(row?.价值, num(item?.value))), rarity: String(row?.稀有度 || item?.rarity || '寻常') };
      rows[name].quantity += quantity;
    };
    for (const name of Object.values(obj(stat.装备))) { const item = resolve(String(name)); add(item?.name || String(name), 1, {}, item); }
    for (const box of [stat?.背包?.携带收藏品, stat?.藏匿物]) for (const [key, row] of Object.entries(obj(box))) add(String(row?.名称 || key), qty(row), row, resolve(String(row?.名称 || key)));
    for (const [key,row] of Object.entries(obj(stat.钥匙链))) add(String(row?.名称 || key),1,row,resolve(String(row?.名称 || key)));
    for(const rod of Object.values(obj(stat.渔具状态?.instances))) {
      if(!['背包','藏匿物','装备:特殊工具'].includes(rod.where))continue;
      for(const component of [rod.line,rod.hook])if(component){
        const item=resolve(component.itemId);
        if(item){const max=item.fishingGear?.maxDurability;add(item.name,1,max ? {价值:Math.round(item.value*Math.min(1,Math.max(0,Number(component.durability ?? max))/max)*100)/100}:{},item);}
      }
    }
    return rows;
  };
  const extraction = (stat, baseline, resolve) => {
    const all = inventory(stat, resolve);
    const rows = Object.values(all).map(row => ({ ...row, quantity: Math.max(0, row.quantity - num(baseline?.[row.name]?.quantity)) })).filter(row => row.quantity > 0);
    return { rows, value: rows.reduce((s,r) => s + r.value * r.quantity, 0), counts: Object.fromEntries(['奇异','至宝','神秘'].map(k => [k, rows.filter(r=>r.rarity===k).reduce((s,r)=>s+r.quantity,0)])) };
  };
  const endStats = (stats, success, brought = {}) => {
    const next = { ...obj(stats) };
    next.历史对局总数 = Math.max(0, Math.floor(num(next.历史对局总数))) + 1;
    if (success) {
      next.历史成功撤离总数 = Math.max(0, Math.floor(num(next.历史成功撤离总数))) + 1;
      next.历史带出总价值 = Math.max(0, num(next.历史带出总价值)) + Math.max(0, num(brought.value));
      for (const k of ['奇异','至宝','神秘']) next['历史带出'+k+'收藏品总数'] = Math.max(0, Math.floor(num(next['历史带出'+k+'收藏品总数']))) + Math.max(0, Math.floor(num(brought.counts?.[k])));
    }
    return next;
  };
  const gamerule = text => {
    const parts = String(text || '').trim().replace(/^\//, '').split(/\s+/);
    if (parts[0]?.toLowerCase() !== 'gamerule' || !parts[1] || parts.length > 3) throw Error('用法：/gamerule list 或 /gamerule <规则> <值>');
    if (parts[1].toLowerCase() === 'list') return { list: true };
    const key = parts[1];
    if (parts.length === 2) return { query: true, key };
    if (key === 'keepInventory' || key === 'femaleFutanari') {
      if (!['true', 'false'].includes(parts[2])) throw Error(key + ' 只能为 true 或 false');
      return { query: false, key, value: parts[2] === 'true' };
    }
    if (key === 'aiMaleProbability') {
      const value = Number(parts[2]);
      if (!Number.isInteger(value) || value < 0 || value > 100) throw Error('aiMaleProbability 必须是 0-100 的整数');
      return { query: false, key, value };
    }
    throw Error('未知 gamerule：' + key);
  };
  return { obj, num, copy, trait, dead, kept, capture, ransom, lossPlan, inventory, extraction, endStats, gamerule };
})();

const HkmCodex = (() => {
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const validId = id => /^COL-\d{4}$/.test(id);
  const defaults = () => ({ version: 1, counts: {}, unlocked: {} });
  const normalize = raw => {
    const next = defaults();
    for (const [id, count] of Object.entries(object(raw?.counts))) if (validId(id) && Number.isSafeInteger(count) && count > 0) next.counts[id] = count;
    for (const [id, lit] of Object.entries(object(raw?.unlocked))) if (validId(id) && lit === true && next.counts[id] > 0) next.unlocked[id] = true;
    return next;
  };
  const validate = raw => {
    if (raw == null) return;
    if (object(raw) !== raw || raw.version !== 1 || object(raw.counts) !== raw.counts || object(raw.unlocked) !== raw.unlocked) throw Error('图鉴数据格式无效。');
    for (const [id, count] of Object.entries(raw.counts)) if (!validId(id) || !Number.isSafeInteger(count) || count < 0) throw Error('图鉴带出数量无效。');
    for (const [id, lit] of Object.entries(raw.unlocked)) if (!validId(id) || typeof lit !== 'boolean' || (lit && !(raw.counts[id] > 0))) throw Error('图鉴点亮记录无效。');
  };
  const record = (raw, rows, resolve) => {
    const next = normalize(raw);
    for (const row of rows) {
      const item = resolve(row.name), count = row.quantity;
      if (!validId(item?.id || '') || !Number.isSafeInteger(count) || count <= 0) continue;
      const total = (next.counts[item.id] || 0) + count;
      if (!Number.isSafeInteger(total)) throw Error('图鉴带出数量超过上限。');
      next.counts[item.id] = total;
    }
    return next;
  };
  const pending = (raw, id) => (raw?.counts?.[id] || 0) > 0 && raw?.unlocked?.[id] !== true;
  const claim = (raw, id, stars) => {
    const next = normalize(raw);
    if (!pending(next, id)) return null;
    const balance = Number(stars ?? 0);
    if (!Number.isSafeInteger(balance) || balance < 0 || !Number.isSafeInteger(balance + 1)) throw Error('星光余额无效，点亮已停止。');
    next.unlocked[id] = true;
    return { codex: next, stars: balance + 1 };
  };
  const catalog = (items, maps) => Object.values(items).map(item => {
    const categories = [...new Set(String(item.category || '其他').split(/[/-]/).filter(Boolean))];
    const sources = object(item.sources), locations = new Set(Object.keys(object(sources.loot)));
    for (const map of sources.collectionLists || []) if (maps.includes(map)) locations.add(map);
    for (const map of Object.keys(object(sources.keySpawns))) if (maps.includes(map)) locations.add(map);
    if ((sources.shops || []).length) locations.add('哈基米空间');
    return { ...item, categories, maps: [...locations].filter(map => maps.includes(map)) };
  }).sort((a, b) => a.id.localeCompare(b.id));
  const query = (items, raw, filters = {}, page = 1, pageSize = 24) => {
    const rows = items.filter(item => (!filters.rarity || item.rarity === filters.rarity) && (!filters.category || item.categories.includes(filters.category)) && (!filters.map || (filters.map === '其他' ? !item.maps.length : item.maps.includes(filters.map))))
      .sort((a, b) => Number(pending(raw, b.id)) - Number(pending(raw, a.id)) || a.id.localeCompare(b.id));
    const pages = Math.max(1, Math.ceil(rows.length / pageSize)), current = Math.max(1, Math.min(pages, Math.floor(page) || 1));
    return { rows: rows.slice((current - 1) * pageSize, current * pageSize), total: rows.length, pages, page: current };
  };
  return { defaults, normalize, validate, record, pending, claim, catalog, query };
})();


const HkmRunContext = (() => {
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const pick = (value, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(object(value),key)).map(key => [key,value[key]]));
  const peek = (stat, front, chatKey, equipment = {}) => {
    const run=front?.run, runId=HkmBattle.id(run), sent=front?.runContextReceipt;
    if(!runId || stat?.场景?.地图!==run.map || sent?.runId===runId && sent?.chatKey===chatKey) return {text:'',receipt:null};
    const value={场景:pick(stat.场景,['地图','区域']),主角:pick(stat.主角,['血量上限','攻击力','防御力','速度'])};
    const gear=Object.fromEntries(Object.entries(object(equipment)).filter(([,row])=>row && row!=='无'));
    if(Object.keys(gear).length)value.装备=gear;
    const text='<HkmRunContext version="1">\n'+JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e')+'\n</HkmRunContext>';
    return {text,receipt:{runId,chatKey}};
  };
  const acknowledge = (front, receipt, chatKey) => {
    if(!receipt || receipt.chatKey!==chatKey || receipt.runId!==HkmBattle.id(front?.run))return false;
    front.runContextReceipt={runId:receipt.runId,chatKey};return true;
  };
  return {peek,acknowledge};
})();

const HkmBattle = (() => {
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const copy = value => JSON.parse(JSON.stringify(value));
  const count = value => Math.max(0, Math.floor(Number(value) || 0));
  const id = run => run ? String(run.id || String(run.map) + ':' + String(run.startedAt)) : '';
  const npcEnemy = row => row && row.friendly !== true && row.友善 !== true && !['友善','友好','中立'].includes(row.attitude)
    && (['敌对','中立-敌对'].includes(row.attitude) || Number(row.attack) > 0 || row.fishingMonster === true);
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
      if (key === row?.目标ID && row.对局ID === current && ['玩家','NPC'].includes(row.目标类型) && ['主角','其他'].includes(row.击杀者)) events[key] = copy(row);
    }
    return { _对局ID:current, _玩家总数:totals.players, _NPC敌人总数:totals.npcs, _主角击杀玩家数:totals.playerKills, _主角击杀NPC数:totals.npcKills, 叙事击杀:events };
  };
  const narrative = (stat,run) => {
    if (!run || stat?.场景?.地图 !== run.map) return [];
    const events = project(stat.本局统计,run).叙事击杀, result = [];
    for (const [key,event] of Object.entries(events)) {
      if (event.确认死亡 !== true || object(run.fishingKills?.seen)[key]) continue;
      const target = units(run).find(({row,kind}) => row.id === key && kind === event.目标类型 && row.region === stat.场景.区域 && !row.extracted);
      if (!target) continue;
      const visible = Object.entries(object(stat.敌人)).find(([name,row]) => {
        const recordId = row?.ID || row?._ID;
        return recordId ? recordId === key : key === name || row?.名称 === target.row.name || name === target.row.name;
      });
      const currentHp = visible ? String(visible[1]?.血量 ?? '').split('/')[0].trim() : '';
      const hp = /^\d+(?:\.\d+)?$/.test(currentHp) ? Number(currentHp) : NaN;
      if (!visible || !Number.isFinite(hp) || hp !== 0) continue;
      result.push({ target:target.row, kind:target.kind, actor:event.击杀者 === '主角' ? 'hero' : 'other' });
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
      stat.敌人[key] = {...stat.敌人[key],...pick(row,['血量','状态','标签'])};
    }
    for (const [key, row] of Object.entries(object(current.任务))) if (semantic(stat.任务[key])) {
      stat.任务[key] = {...stat.任务[key],...pick(row,['语义进度','进度说明','语义完成','已完成步骤'])};
    }
    stat.本局统计 = HkmBattle.project(current.本局统计,front.run);
    return stat;
  };
  const visibleEnemies = (stat, front = {}) => {
    const scene = object(stat.场景), run = object(front.run);
    return Object.fromEntries(Object.entries(object(stat.敌人)).filter(([key,row]) => {
      if (row?.地图 && row.地图 !== scene.地图 || row?.区域 && row.区域 !== scene.区域 || row?.离开区域 === '是') return false;
      const player = (run.players || []).find(player => player.id === key || player.name === (row?.名称 || key));
      if (player) return run.map === scene.地图 && player.region === scene.区域 && player.alive !== false && !player.extracted
        && (!player.crouched || Number.isFinite(player.revealedTurn) && player.revealedTurn === run.soundTurn || run.sight?.['hero:'+player.id]?.area === player.region && run.sight?.['hero:'+player.id]?.noticed === true);
      const npc = (run.npcs || []).find(npc => npc.id === key || npc.id === row?.ID || npc.name === (row?.名称 || key));
      return npc ? run.map === scene.地图 && npc.region === scene.区域 && Number(npc.hp) > 0 : !!row?.区域 && row.区域 === scene.区域 && (!row.地图 || row.地图 === scene.地图);
    }));
  };
  const unitMeta = (key,row,front) => {
    const matches = p => row?.ID ? p.id===row.ID : p.id===key || p.name===(row?.名称 || key);
    const player = (front.run?.players || []).find(matches);
    const npc = (front.run?.npcs || []).find(matches);
    return {ID:player?.id || npc?.id || row?.ID || key,类型:player?'玩家':'NPC'};
  };
  const project = (stat, front = {}) => ({
    场景: pick(stat.场景,['是否战斗中']),
    主角: pick(stat.主角,heroKeys),
    装备: equipment(stat),
    敌人: Object.fromEntries(Object.entries(visibleEnemies(stat,front)).map(([key,row]) => [key,{...pick(row,['名称','血量','状态','标签']),_ID:unitMeta(key,row,front).ID,_类型:unitMeta(key,row,front).类型}])),
    状态列表: copy(Object.fromEntries(Object.entries(object(stat.状态列表)).filter(([key])=>!frontendStatus(key)))),
    任务: Object.fromEntries(Object.entries(object(stat.任务)).filter(([,row]) => semantic(row)).map(([key,row]) => [key,{...pick(row,['任务名称','语义目标','语义进度','进度说明']),语义完成:row.语义完成===true,已完成步骤:copy(object(row.已完成步骤))}])),
    统计信息: pick(stat.统计信息,['哈基币','名望','风评']),
    本局统计: HkmBattle.project(stat.本局统计,front.run),
  });
  const view = (stat, front = {}, equipment = {}) => ({
    场景: pick(stat.场景,['地图','区域','剩余交互轮数','剩余水下行动值','是否战斗中']),
    主角: pick(stat.主角,['姓名','性别','处女状态','是否死亡','当前血量','血量上限','攻击力','防御力','速度','当前负重','负重上限','水下行动值上限']),
    装备: copy(equipment),
    当前可见单位: Object.fromEntries(Object.entries(visibleEnemies(stat,front)).map(([key,row]) => [key,{...unitMeta(key,row,front),...pick(row,['名称','性别','血量','攻击力','防御力','速度','状态','标签',...(row?.来源 === '其他玩家' ? [] : ['描述'])])}])),
    状态列表: copy(object(stat.状态列表)),
    生涯: pick(stat.统计信息,['历史对局总数']),
    本局统计: HkmBattle.project(stat.本局统计,front.run),
  });
  const context = value => '<HkmViewContext version="1">\n' + JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e') + '\n</HkmViewContext>';
  return {compose,migrate,project,visibleEnemies,view,context,semantic,equipmentSlots};
})();

const HkmSave = (() => {
  const format = 'hkm-frontend-save', gameId = 'hkm-sdt', maxBytes = 8 * 1024 * 1024;
  const locations = {"哈基米空间":["中转站","哈基米军需店","安全屋","玩家自由贸易区","模拟都市","特勤处"],"谷歌大厦":["天台撤离点","基米数据机房","顶层报告厅","基米服务器室","总裁会议室","总裁会客厅","废弃档案室","打卡区","医务室","员工通道","综合办公室","基米办公室","经理办公室","打印复印室","食堂","茶室","中央通道","健身房","娱乐区","员工休息室","员工更衣室","卸货区","物流分拣区","备用仓库","设备维护间","后勤办公室","大厦配电室","大厦前台撤离点"],"魔鬼海":["礁石海岸","度假海滩","巨蚌钓台撤离点","海滨别墅","诡异灵宅","不老泉","落星山","废弃渔场","浅海巨藻林","珊瑚礁群","锦鳞海","回响洞窟","神秘洞穴","望月井","渔人野冢","热液喷口","潜水艇残骸","鲨鱼域","深海幽境","洞潜者埋骨地","提丰遗骸","古代文明遗迹","触手母巢","精液繁殖场","无光海渊","渊海祭坛","安康鱼巢穴","无底深坑"]};
  const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const uiKeys = new Set(['winPos','sellBatch','debugOpen']);
  const host = () => { try { return window.parent?.SillyTavern ? window.parent : window; } catch (_) { return window; } };
  const context = () => host().SillyTavern?.getContext?.();
  const copy = value => {
    let nodes = 0;
    const visit = (v,depth) => {
      if (++nodes > 250000 || depth > 80) throw Error('存档结构过大或层级过深。');
      if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (Array.isArray(v)) return v.map(x=>visit(x,depth+1));
      if (!object(v)) throw Error('存档包含无法保存的数据。');
      const next={};
      for (const [k,x] of Object.entries(v)) {
        if (['__proto__','prototype','constructor'].includes(k)) throw Error('存档包含不安全的字段名。');
        next[k]=visit(x,depth+1);
      }
      return next;
    };
    return visit(value,0);
  };
  const defaults = () => ({
    游戏规则:{keepInventory:false,aiMaleProbability:50,femaleFutanari:false},前端结算:{回执:{},事件:{},经验对象:{}},本局统计:HkmBattle.blank(),
    场景:{地图:'哈基米空间',区域:'中转站',剩余交互轮数:'0',剩余水下行动值:'0',水下机制版本:0,是否战斗中:false},
    主角:{姓名:'未命名',性别:'女性',处女状态:'是',是否死亡:false,致命溢出伤害:0,当前血量:20,血量上限:20,攻击力:6,防御力:0,速度:10,当前负重:0,负重上限:40,水下行动值上限:8,额外水下行动值上限:0,
      基础属性:{已校准:'否',攻击力:6,防御力:0,血量上限:20,速度:10,负重上限:40,额外水下行动值上限:0},
      临时加成:{固定:{攻击力:0,防御力:0,血量上限:0,速度:0,负重上限:0,额外水下行动值上限:0},百分比:{攻击力:0,防御力:0,血量上限:0,速度:0}}},
    渔具状态:{version:1,serial:0,instances:{}},敌人:{},装备:Object.fromEntries(['主武器','副武器','头盔','面部','胸甲','护腿','靴子','背包','内裤','项链','戒指','手饰','特殊工具'].map(k=>[k,'无'])),
    状态列表:{},藏匿物:{},散落物品:{},背包:{携带收藏品:{}},任务:{},
    任务档案:{已完成任务:{},重复任务完成次数:{},任务条件标签:{}},
    统计信息:Object.fromEntries(['哈基币','星光','总资产','经验人数','历史对局总数','历史成功撤离总数','历史击杀玩家总数','历史带出总价值','历史带出奇异收藏品总数','历史带出至宝收藏品总数','历史带出神秘收藏品总数','钓到奇异鱼总数','钓到至宝鱼总数','钓到神秘鱼总数','风评','名望'].map(k=>[k,0])),
    特勤处:{健身房:0,潜水中心:0,生命强化:0,臂力强化:0,解锁记录:{水下耗尽:false}},
    安全屋:{收藏品:{}}
  });
  const roots=Object.keys(defaults());
  const mergeDefaults = (base,raw,label) => {
    if (raw === undefined) return copy(base);
    if (object(base)) {
      if (!object(raw)) throw Error(label+'应当是一组字段。');
      const out=copy(raw);
      for (const [k,v] of Object.entries(base)) out[k]=mergeDefaults(v,raw[k],label+'.'+k);
      return out;
    }
    if (typeof base === 'number') {
      if (!['number','string'].includes(typeof raw) || String(raw).trim()==='' || !Number.isFinite(Number(raw))) throw Error(label+'不是有效数字。');
      return Number(raw);
    }
    if (typeof base === 'boolean' && typeof raw !== 'boolean') throw Error(label+'应当是 true 或 false。');
    if (typeof base === 'string' && !['string','number'].includes(typeof raw)) throw Error(label+'应当是文本。');
    return typeof base === 'string' ? String(raw) : raw;
  };
  const googleAliases = {"四层东侧楼梯":"废弃档案室","总裁档案室":"废弃档案室","三层东侧楼梯":"打印复印室","二层东侧楼梯":"员工更衣室","一层东侧楼梯":"大厦前台撤离点"};
  const migrateGoogle = value => {
    const rename = text => {
      if (Object.hasOwn(googleAliases,text)) return googleAliases[text];
      if (text.startsWith('谷歌大厦::')) {
        const parts=text.split('::');parts[1]=googleAliases[parts[1]] || parts[1];return parts.join('::');
      }
      return text;
    };
    const visit = data => {
      if (typeof data==='string') return rename(data);
      if (Array.isArray(data)) return data.map(visit);
      if (!object(data)) return data;
      const next={};
      for (const [key,entry] of Object.entries(data)) {
        const target=rename(key),mapped=visit(entry);
        if (Object.hasOwn(next,target) && typeof next[target]==='number' && typeof mapped==='number') next[target]=Math.min(next[target],mapped);
        else if (Object.hasOwn(next,target) && typeof next[target]==='boolean' && typeof mapped==='boolean') next[target]=next[target] || mapped;
        else if (Object.hasOwn(next,target) && object(next[target]) && object(mapped)) {
          const prior=next[target];next[target]={...prior,...mapped};
          if (prior.名称===mapped.名称 && Number.isFinite(prior.数量) && Number.isFinite(mapped.数量)) next[target].数量=prior.数量+mapped.数量;
        }
        else next[target]=mapped;
      }
      return next;
    };
    return visit(value);
  };
  const normalizeStat = raw => {
    raw=migrateGoogle(copy(raw));
    if (!object(raw) || !object(raw.主角) || !object(raw.场景)) throw Error('缺少主角或场景变量，不是完整的游戏存档。');
    raw=HkmStateBoundary.migrate(HkmSea.migrate(raw).stat);
    const base=defaults(),out={};
    for (const k of roots) out[k]=mergeDefaults(base[k],raw[k],k);
    if (!locations[out.场景.地图]?.includes(out.场景.区域)) throw Error('存档的地图或区域不受本卡支持。');
    if (!['女性','男性'].includes(out.主角.性别)) throw Error('主角性别仅限男性或女性。');
    if (!['是','否'].includes(out.主角.处女状态)) throw Error('主角处女状态仅限是或否。');
    for (const bag of [out.背包.携带收藏品,out.安全屋.收藏品,out.藏匿物,out.散落物品]) {
      if (!object(bag)) throw Error('物品表格式无效。');
      for (const row of Object.values(bag)) {
        if (!object(row)) throw Error('物品条目格式无效。');
        for (const k of ['数量','价值','重量']) if (row[k] !== undefined) {if(!['number','string'].includes(typeof row[k]) || String(row[k]).trim()==='' || !Number.isFinite(Number(row[k])) || Number(row[k])<0)throw Error('物品'+k+'无效。');row[k]=k==='重量'?Math.round((Number(row[k])+Number.EPSILON)*100)/100:Number(row[k]);}
      }
    }
    for(const key of ['剩余交互轮数','剩余水下行动值','水下机制版本'])if(!Number.isFinite(Number(out.场景[key])) || Number(out.场景[key])<0)throw Error('场景计数无效。');
    for(const name of ['健身房','潜水中心','生命强化','臂力强化'])if(!Number.isInteger(out.特勤处[name]) || out.特勤处[name]<0 || out.特勤处[name]>3)throw Error('特勤处等级须为 0–3。');
    if(!Number.isSafeInteger(out.统计信息.星光) || out.统计信息.星光<0)throw Error('星光余额无效。');
    return out;
  };
  const frontend = raw => {
    if (!object(raw)) throw Error('前端数据格式无效。');
    const out=migrateGoogle(copy(raw));
    HkmCodex.validate(out.codex);
    out.codex=HkmCodex.normalize(out.codex);
    if (out.version != null && (!Number.isInteger(out.version) || out.version>19 || out.version<1)) throw Error('不支持此版本的前端数据。');
    if (out.lifecycleJournal?.phase === 'prepared') throw Error('存档含未完成结算，请完成结算后重新保存。');
    for (const k of uiKeys) delete out[k];
    for (const k of ['tiers','visited','specials','market','carts','keychain','keyDurability','itemCounters','containerLedger','settleAcks']) if (out[k]!=null && !object(out[k])) throw Error('前端 '+k+' 格式无效。');
    if (out.run != null) {
      if (!object(out.run) || !locations[out.run.map] || !Array.isArray(out.run.players)) throw Error('对局数据格式无效。');
      for (const k of ['npcs','registered']) if (out.run[k]!=null && !Array.isArray(out.run[k])) throw Error('对局 '+k+' 格式无效。');
      if (out.run.boxes!=null && !object(out.run.boxes)) throw Error('战利品盒格式无效。');
      if(out.run.upgradeUses!=null && (!Number.isSafeInteger(out.run.upgradeUses) || out.run.upgradeUses<0 || out.run.upgradeUses>3))throw Error('升星次数记录无效。');
      if(out.run.homeIncome!=null && (!object(out.run.homeIncome) || ['boxes','cats'].some(key=>!Number.isSafeInteger(out.run.homeIncome[key]) || out.run.homeIncome[key]<0)))throw Error('家具收益记录无效。');
    }
    if(out.home!=null){const h=out.home;if(!object(h) || h.schemaVersion!==1 || !object(h.placed) || !object(h.cats) || !Array.isArray(h.unlockedRecipes))throw Error('安全屋陈设数据格式无效。');for(const [id,count] of Object.entries(h.placed))if(!/^COL-\d{4}$/.test(id) || !Number.isSafeInteger(count) || count<0)throw Error('陈设数量无效。');for(const key of ['temporary','permanent'])if(!Number.isSafeInteger(h.cats[key]) || h.cats[key]<0)throw Error('安全屋住客数量无效。');if(h.unlockedRecipes.some(id=>typeof id!=='string' || !/^[a-z][a-z0-9-]{0,60}$/.test(id)))throw Error('配方解锁记录无效。');}
    for (const k of ['usePending','aiLog']) if (out[k]!=null && !Array.isArray(out[k])) throw Error('前端 '+k+' 格式无效。');
    return out;
  };
  const identity = () => {
    const ctx=context();
    if (ctx?.chatId==null || String(ctx.chatId)==='') throw Error('当前对话还没有独立编号，请先创建对话。');
    const card=ctx.groupId ? 'group:'+ctx.groupId : ctx.characters?.[ctx.characterId]?.avatar;
    if (!card) throw Error('无法识别角色卡，已停止存档，避免与其他对话混用。');
    return JSON.stringify([String(card),String(ctx.chatId)]);
  };
  const assertScope = scope => { if(identity()!==scope)throw Error('对话已切换，本次存档操作停止。'); };
  const variables = () => {
    if (typeof getVariables!=='function' || typeof replaceVariables!=='function') throw Error('酒馆助手变量接口不可用。');
    return getVariables({type:'chat'}) || {};
  };
  const pending = () => variables().hkm_save_restore || null;
  const flush = async (scope,check) => {
    assertScope(scope);check();
    const ctx=context();
    if(typeof ctx?.saveMetadata!=='function')throw Error('缺少对话保存接口。');
    await ctx.saveMetadata();assertScope(scope);check();
  };
  const messageId = () => {
    let id;try {if(typeof getCurrentMessageId==='function')id=getCurrentMessageId();}catch(_){}
    if(id==null || id==='' || Number(id)<0)try{id=window.frameElement?.closest('.mes')?.getAttribute('mesid');}catch(_){}
    if(id==null || id==='' || !Number.isInteger(Number(id)) || Number(id)<0)throw Error('无法确定当前消息楼层。');
    return Number(id);
  };
  const timestamp = () => new Date().toISOString();
  const profile = name => ({id:globalThis.crypto?.randomUUID?.() || 'hkm-'+Date.now()+'-'+Math.random().toString(36).slice(2),name:String(name || '未命名存档').trim().slice(0,60),createdAt:timestamp()});
  const normalize = raw => {
    const value=copy(raw);
    if(value.format!==format || value.gameId!==gameId || value.schemaVersion!==1)throw Error('存档格式或版本不受支持；请选择本卡导出的游戏存档 JSON。');
    if(!object(value.profile) || typeof value.profile.id!=='string' || !value.profile.id || typeof value.profile.name!=='string' || !value.profile.name.trim() || !Number.isFinite(Date.parse(value.profile.createdAt)) || !Number.isFinite(Date.parse(value.savedAt)))throw Error('存档名称或时间信息不完整。');
    if(!object(value.payload))throw Error('缺少游戏数据。');
    const migrated=HkmSea.migrate(value.payload.stat_data,value.payload.frontend);
    return {format,gameId,schemaVersion:1,cardVersion:'v0.1.153',profile:{id:value.profile.id.slice(0,120),name:value.profile.name.trim().slice(0,60),createdAt:value.profile.createdAt},savedAt:value.savedAt,
      payload:{stat_data:normalizeStat(migrated.stat),frontend:frontend(migrated.front),opening:object(value.payload.opening)?copy(value.payload.opening):{}}};
  };
  const parse = text => {
    if(typeof text!=='string' || new Blob([text]).size>maxBytes)throw Error('存档文件超过 8 MB。');
    let raw;try{raw=JSON.parse(text);}catch(_){throw Error('文件不是有效的 JSON，原存档未改动。');}
    return normalize(raw);
  };
  const create = (name,stat,front={},opening={}) => normalize({format,gameId,schemaVersion:1,profile:profile(name),savedAt:timestamp(),payload:{stat_data:stat,frontend:front,opening}});
  const capture = stat => {
    const vars=variables();
    if(vars.hkm_save_restore)throw Error('上一次读档尚未完成，请先重试读档。');
    const p=object(vars.hkm_save_profile)?vars.hkm_save_profile:profile(stat?.主角?.姓名 || '已有游戏');
    return normalize({format,gameId,schemaVersion:1,profile:p,savedAt:timestamp(),payload:{stat_data:stat,frontend:vars.hkm_frontend_state || {},opening:vars.hkm_opening_profile || {}}});
  };
  const storage = () => host().localStorage;
  const bankKey = scope => 'hkm:sdt:saves:v1:'+encodeURIComponent(scope);
  const readBank = scope => {
    assertScope(scope);
    let text;try{text=storage().getItem(bankKey(scope));}catch(_){throw Error('浏览器禁止使用本地缓存；请导出文件备份。');}
    if(!text)return {schemaVersion:1,auto:null,slots:Array(5).fill(null)};
    let bank;try{bank=JSON.parse(text);}catch(_){throw Error('本对话的存档缓存损坏，未覆盖缓存；可以导入备份文件。');}
    if(bank.schemaVersion!==1 || !Array.isArray(bank.slots) || bank.slots.length!==5)throw Error('本对话的存档缓存版本或快照栏位无效。');
    try {bank.auto=bank.auto===null?null:normalize(bank.auto);bank.slots=bank.slots.map(save=>save===null?null:normalize(save));}
    catch(_){throw Error('本对话的存档缓存含无效数据，未覆盖缓存；可以导入备份文件。');}
    return bank;
  };
  const writeBank = (scope,bank) => {
    assertScope(scope);
    try{storage().setItem(bankKey(scope),JSON.stringify(bank));}catch(_){throw Error('本地缓存未保存：空间不足或被浏览器禁止；请导出文件备份。');}
  };
  const saveLocal = (scope,save,slot=null) => {
    const value=normalize(save),bank=readBank(scope);
    if(slot===null)bank.auto=value;
    else {if(!Number.isInteger(slot)||slot<0||slot>4)throw Error('快照栏位无效。');bank.slots[slot]=value;}
    writeBank(scope,bank);return value;
  };
  const readGame = async target => {
    const scope={type:'message',message_id:target};
    if(typeof Mvu!=='undefined' && typeof Mvu?.getMvuData==='function' && typeof Mvu?.replaceMvuData==='function')return {data:copy(await Mvu.getMvuData(scope)),write:data=>Mvu.replaceMvuData(data,scope)};
    if(typeof getVariables==='function' && typeof replaceVariables==='function')return {data:copy(await getVariables(scope)),write:data=>replaceVariables(data,scope)};
    throw Error('缺少消息变量读写接口。');
  };
  const rebind = save => {
    const value=normalize(save),front=value.payload.frontend,ctx=context();
    const count=(ctx?.chat || []).filter(x=>x?.is_user===true || x?.role==='user').length;
    const last=(ctx?.chat?.length || 0)-1;
    const oldCount=Number(front.dialogue?.count) || 0;
    for(const buff of Object.values(front.run?.waterBuffs || {}))buff.expiresAt=count+Math.max(0,(Number(buff.expiresAt) || 0)-oldCount);
    for (const effect of Object.values(front.equipmentEffects || {})) {
      if(effect.tide){effect.tide.start+=count-oldCount;effect.tide.end+=count-oldCount;}
      if(Number.isFinite(effect.stunnedUntil))effect.stunnedUntil+=count-oldCount;
      if(Number.isFinite(effect.dialogue))effect.dialogue+=count-oldCount;
    }
    for(const effect of Object.values(front.equipmentEffects || {})) {
      for(const skill of Object.values(effect.skillCooldowns || {}))if(skill.unit==='dialogue')skill.readyAt=count+Math.max(0,Number(skill.readyAt || 0)-oldCount);
      delete effect.aiSkillFloor;
      if(Number.isFinite(effect.aiSkillDialogue))effect.aiSkillDialogue+=count-oldCount;
    }
    for (const skill of Object.values(front.skillCooldowns || {})) if (skill.unit === 'dialogue') skill.readyAt = count + Math.max(0, Number(skill.readyAt || 0) - oldCount);
    front.dialogue={count,previous:count,updatedAt:Date.now()};front.replayAfter=last;
    if(front.run)front.run.startMessageId=last;
    for(const row of front.usePending || [])row.roundKey='R'+messageId();
    return value;
  };
  const restore = async (raw,{scope=identity(),target=messageId(),check=()=>{}}={}) => {
    const save=rebind(raw);
    const guard=()=>{assertScope(scope);check();if(messageId()!==target)throw Error('消息楼层已变化，读档停止。');};
    guard();
    const existing=variables().hkm_save_restore;
    if(existing && (existing.scope!==scope || existing.target!==target || existing.save.profile.id!==save.profile.id))throw Error('有未完成的读档，请先恢复它。');
    if(!existing){
      const vars=variables();vars.hkm_save_restore={scope,target,save};replaceVariables(vars,{type:'chat'});
      await flush(scope,guard);
    }
    const tx=variables().hkm_save_restore;
    if(!tx || tx.scope!==scope || tx.target!==target)throw Error('读档记录发生变化，已停止。');
    const intended=normalize(tx.save);
    const row=await readGame(target);guard();
    const stat=copy(intended.payload.stat_data);
    const next={...row.data,stat_data:HkmStateBoundary.project(stat,intended.payload.frontend),hkm_game_data:copy(stat)};
    try{await row.write(next);}catch(error){guard();const reread=await readGame(target);guard();if(JSON.stringify(reread.data.hkm_game_data)!==JSON.stringify(stat))throw error;}
    guard();
    const verified=await readGame(target);guard();
    if(roots.some(k=>JSON.stringify(verified.data.hkm_game_data?.[k])!==JSON.stringify(stat[k])) || JSON.stringify(verified.data.stat_data)!==JSON.stringify(next.stat_data))throw Error('读档变量没有完整写入，保留读档记录供重试。');
    const vars=variables();
    vars.hkm_frontend_state={...copy(intended.payload.frontend),gameData:copy(stat)};vars.hkm_save_profile=copy(intended.profile);
    vars.hkm_opening_profile=copy(intended.payload.opening);vars.hkm_opening_game_rules=copy(intended.payload.stat_data.游戏规则);
    replaceVariables(vars,{type:'chat'});await flush(scope,guard);
    const finalVars=variables();delete finalVars.hkm_save_restore;delete finalVars.hkm_tutorial_pending;delete finalVars.hkm_opening_launch;
    replaceVariables(finalVars,{type:'chat'});
    try{await flush(scope,guard);}catch(error){
      if(identity()===scope){const retry=variables();retry.hkm_save_restore=tx;replaceVariables(retry,{type:'chat'});}
      throw error;
    }
    guard();return intended;
  };
  const recover = async options => {
    const tx=pending();if(!tx)return false;
    if(tx.scope!==identity() || tx.target!==messageId())throw Error('未完成读档属于另一个消息楼层，请回到原楼层完成读档。');
    return restore(tx.save,{...options,scope:tx.scope,target:tx.target});
  };
  const rememberProfile = save => {
    const vars=variables();if(!vars.hkm_save_profile){vars.hkm_save_profile=copy(save.profile);replaceVariables(vars,{type:'chat'});}
  };
  const summary = save => save ? save.profile.name+' · '+new Date(save.savedAt).toLocaleString()+' · '+save.payload.stat_data.场景.地图+' / '+save.payload.stat_data.场景.区域+' · '+save.payload.stat_data.统计信息.哈基币+' 哈基币' : '空栏位';
  const download = raw => {
    const save=normalize(raw),url=URL.createObjectURL(new Blob([JSON.stringify(save,null,2)+'\n'],{type:'application/json'}));
    const a=hkmCreateElement('a');a.href=url;a.download=save.profile.name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_')+'-'+save.savedAt.replace(/[:.]/g,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const mount = ({capture:captureCurrent,apply,writable=()=>true,dispose=()=>{}}) => {
    const style=hkmCreateElement('style');style.textContent='.hkm-save-ui{box-sizing:border-box;width:min(680px,94vw);max-height:88vh;overflow:auto;border:1px solid #63e3ff;border-radius:12px;background:#0d1b24;color:#e7f7ff;padding:18px;font:14px/1.6 system-ui,sans-serif}.hkm-save-ui::backdrop{background:rgba(0,0,0,.7)}.hkm-save-ui *{box-sizing:border-box;overflow-wrap:anywhere}.hkm-save-ui h2{margin:0 0 8px}.hkm-save-ui button{min-height:44px;margin:4px 6px 4px 0;padding:7px 12px;border:1px solid #63e3ff;border-radius:8px;background:#12303f;color:#e7f7ff;font:inherit;cursor:pointer}.hkm-save-ui button:disabled{opacity:.4;cursor:default}.hkm-save-ui button:focus-visible{outline:2px solid white;outline-offset:2px}.hkm-save-row{padding:10px 0;border-top:1px solid #315362}.hkm-save-ui [data-error="true"]{color:#ffb3bd}.hkm-save-preview{border:1px solid #ffc857;padding:12px;border-radius:8px;margin:8px 0}.hkm-save-ui [hidden]{display:none!important}';document.head.append(style);
    const dialog=hkmCreateElement('dialog');dialog.className='hkm-save-ui';dialog.setAttribute('aria-label','游戏存档管理');
    const el=(tag,text)=>{const n=hkmCreateElement(tag);if(text)n.textContent=text;return n;};
    const title=el('h2','游戏存档'),notice=el('p','存档保存在当前浏览器，仅恢复本对话的游戏进度，不回退聊天正文。');
    const status=el('p');status.setAttribute('aria-live','polite');
    const list=el('div'),preview=el('div');preview.className='hkm-save-preview';preview.hidden=true;
    let scope=null,busy=false,selected=null,opener=null;
    const report=(text,error=false)=>{status.textContent=text;status.dataset.error=String(error);};
    const task=fn=>async()=>{if(busy)return;busy=true;try{if(!writable())throw Error('请使用当前对话的最新楼层。');assertScope(scope);await fn();}catch(e){report(e.message,true);}finally{busy=false;render();}};
    const button=(text,fn)=>{const b=el('button',text);b.type='button';b.addEventListener('click',task(fn));return b;};
    const stage=raw=>{selected=normalize(raw);preview.replaceChildren(el('strong','将读取：'+summary(selected)),el('p','这会替换当前游戏进度，聊天记录和其他扩展数据保持原样。'),button('确认读档',async()=>{const restored=await apply(selected);assertScope(scope);preview.hidden=true;selected=null;try{const fresh=restored || await captureCurrent();assertScope(scope);saveLocal(scope,fresh);report('读档完成。可以从酒馆输入框继续游戏。');}catch(e){report('游戏读档已完成，但缓存未写入：'+e.message,true);}}),button('取消读档',()=>{selected=null;preview.hidden=true;}));preview.hidden=false;};
    const file=el('input');file.type='file';file.accept='.json,application/json';file.hidden=true;file.setAttribute('aria-label','选择游戏存档文件');
    file.addEventListener('change',task(async()=>{const f=file.files?.[0];file.value='';if(!f)return;if(f.size>maxBytes)throw Error('存档文件超过 8 MB。');const text=await f.text();assertScope(scope);stage(parse(text));report('文件校验通过，请确认是否读取。');}));
    const render=()=>{
      list.replaceChildren();if(!scope)return;
      let bank;try{assertScope(scope);bank=readBank(scope);}catch(e){report(e.message,true);return;}
      const auto=el('div');auto.className='hkm-save-row';auto.append(el('strong','自动存档'),el('p',bank.auto?summary(bank.auto):'暂无自动存档'));
      const load=button('读取自动存档',()=>stage(bank.auto));load.disabled=!bank.auto;auto.append(load);list.append(auto);
      for(let i=0;i<5;i++){
        const row=el('div');row.className='hkm-save-row';row.append(el('strong','快照 '+(i+1)),el('p',bank.slots[i]?summary(bank.slots[i]):'空栏位'));
        const save=button('保存快照 '+(i+1),async()=>{
          const next=await captureCurrent();assertScope(scope);
          if(bank.slots[i]){selected=null;preview.replaceChildren(el('p','覆盖快照 '+(i+1)+'：'+summary(bank.slots[i])+'？'),button('确认覆盖',()=>{saveLocal(scope,next,i);preview.hidden=true;report('快照 '+(i+1)+' 已保存。');}),button('取消覆盖',()=>{preview.hidden=true;}));preview.hidden=false;return;}
          saveLocal(scope,next,i);report('快照 '+(i+1)+' 已保存。');
        });
        const read=button('读取快照 '+(i+1),()=>stage(bank.slots[i]));read.disabled=!bank.slots[i];
        const exp=button('导出快照 '+(i+1),()=>download(bank.slots[i]));exp.disabled=!bank.slots[i];row.append(save,read,exp);list.append(row);
      }
    };
    dialog.append(title,notice,
      button('立即保存',async()=>{const save=await captureCurrent();assertScope(scope);saveLocal(scope,save);report('当前游戏已保存到本对话的自动存档。');}),
      button('导出当前存档',async()=>{const save=await captureCurrent();assertScope(scope);download(save);report('存档文件已导出。');}),
      button('导入文件读档',()=>file.click()),file,preview,status,list);
    const close=el('button','关闭');close.type='button';close.addEventListener('click',()=>{if(!busy)dialog.close();});dialog.append(close);
    dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>opener?.focus?.());hkmPortal.append(dialog);
    dispose(()=>{dialog.remove();style.remove();});
    return {get busy(){return busy;},open(){try{scope=identity();opener=document.activeElement;selected=null;preview.hidden=true;report('');render();if(!dialog.open)dialog.showModal();}catch(e){report(e.message,true);if(!dialog.open)dialog.showModal();}},report,render,dialog};
  };
  return {readGame,format,gameId,roots,migrateGoogle,defaults,copy,identity,assertScope,messageId,context,variables,pending,profile,normalize,parse,create,capture,saveLocal,readBank,bankKey,restore,recover,rememberProfile,summary,download,mount,maxBytes};
})();

const HkmHome = (() => {
  const copy=value=>structuredClone(value);
  const object=value=>value!==null && typeof value==='object' && !Array.isArray(value);
  const integer=(value,label,min=0)=>{if(!Number.isSafeInteger(value) || value<min)throw Error(label+'必须是'+(min?'正':'非负')+'整数。');return value;};
  const add=(a,b)=>integer(a+b,'数量');
  const defaults=()=>({schemaVersion:1,placed:{},unlockedRecipes:[],cats:{temporary:0,permanent:0}});
  const normalize=raw=>{
    if(raw==null)return defaults();
    if(!object(raw) || raw.schemaVersion!==1 || !object(raw.placed) || !object(raw.cats) || !Array.isArray(raw.unlockedRecipes))throw Error('安全屋陈设数据无效。');
    const next=copy(raw);
    for(const [id,quantity] of Object.entries(next.placed)){if(!/^COL-\d{4}$/.test(id))throw Error('家具编号无效。');integer(quantity,'陈设数量');}
    for(const key of ['temporary','permanent'])integer(next.cats[key],'安全屋住客数量');
    if(next.unlockedRecipes.some(id=>typeof id!=='string' || !/^[a-z][a-z0-9-]{0,60}$/.test(id)))throw Error('配方解锁记录无效。');
    next.unlockedRecipes=[...new Set(next.unlockedRecipes)];
    return next;
  };
  const recipes=[
    {id:'coffee',name:'咖啡',station:'COL-0070',costs:[{id:'COL-0011',quantity:1}],outputs:[{id:'COL-0050',quantity:2}]},
    {id:'lucky-coin',name:'幸运硬币',station:'COL-0054',blueprint:'COL-0033',costs:[{id:'COL-0048',quantity:1}],outputs:[{id:'COL-0032',quantity:1}]},
    {id:'coconut-latte',name:'生椰拿铁',station:'COL-0150',herb:'COL-0123',base:'COL-0050',result:'COL-0144',byproduct:'COL-0110'},
    {id:'water-breathing',name:'水肺药水',station:'COL-0150',herb:'COL-0137',base:'COL-0039',result:'COL-0126'},
    {id:'strong-water-breathing',name:'强效水肺药水',station:'COL-0150',herb:'COL-0139',base:'COL-0126',result:'COL-0148'}
  ];
  const recipeById=id=>{const recipe=recipes.find(row=>row.id===id);if(!recipe)throw Error('该合成配方不存在。');return recipe;};
  const inSafe=stat=>stat?.场景?.地图==='哈基米空间' && stat?.场景?.区域==='安全屋';
  const requireSafe=stat=>{if(!inSafe(stat))throw Error('请先进入安全屋。');};
  const isFurniture=item=>String(item?.category || '').split('/').includes('家居物品');
  const bucket=(stat,where)=>where==='安全屋'?(stat?.安全屋?.收藏品 || {}):(stat?.背包?.携带收藏品 || {});
  const count=(stat,name,where)=>Object.entries(bucket(stat,where)).filter(([key,row])=>key===name || row?.名称===name).reduce((sum,[,row])=>add(sum,integer(Number(row.数量),'物品数量')),0);
  const owned=(stat,name)=>add(count(stat,name,'安全屋'),count(stat,name,'背包'));
  const take=(source,name,quantity)=>{
    let left=quantity;
    for(const [key,row] of Object.entries(source)){
      if(key!==name && row?.名称!==name)continue;
      const have=integer(Number(row.数量),'物品数量'),amount=Math.min(have,left);
      if(amount===have)delete source[key];else source[key]={...row,数量:have-amount};
      left-=amount;if(!left)break;
    }
    return quantity-left;
  };
  const grant=(source,item,quantity)=>{
    integer(quantity,'产物数量',1);
    if(!item?.name)throw Error('收藏品资料缺失。');
    const key=Object.keys(source).find(key=>key===item.name || source[key]?.名称===item.name) || item.name;
    const old=source[key];
    source[key]={名称:item.name,稀有度:item.rarity,描述:item.description,价值:item.value,重量:item.weight,...old,数量:add(old?integer(Number(old.数量),'物品数量'):0,quantity)};
  };
  const inventoryPatch=(stat,costs,outputs,resolve,from=null)=>{
    const safe=copy(bucket(stat,'安全屋')),bag=copy(bucket(stat,'背包'));
    for(const cost of costs){
      const item=resolve(cost.id);if(!item)throw Error('材料资料缺失。');
      integer(cost.quantity,'材料数量',1);
      let left=cost.quantity;
      if(from!=='背包')left-=take(safe,item.name,left);
      if(left && from!=='安全屋')left-=take(bag,item.name,left);
      if(left)throw Error('材料不足：'+item.name+'。');
    }
    for(const output of outputs)grant(safe,resolve(output.id),output.quantity);
    return {安全屋:{...stat.安全屋,收藏品:safe},背包:{...stat.背包,携带收藏品:bag}};
  };
  const requirements=(recipe,batches=1,baseCount=1)=>{
    integer(batches,'制造批次',1);integer(baseCount,'每批原料数量',1);
    if(recipe.herb){if(baseCount>3)throw Error('每份药材最多处理三份原料。');return {costs:[{id:recipe.herb,quantity:batches},{id:recipe.base,quantity:batches*baseCount}],outputs:[{id:recipe.result,quantity:batches*baseCount},...(recipe.byproduct?[{id:recipe.byproduct,quantity:batches}]:[])]};}
    return {costs:recipe.costs.map(row=>({...row,quantity:row.quantity*batches})),outputs:recipe.outputs.map(row=>({...row,quantity:row.quantity*batches}))};
  };
  const planPlace=(stat,raw,id,where,quantity,resolve)=>{
    requireSafe(stat);integer(quantity,'陈设数量',1);
    if(!['背包','安全屋'].includes(where))throw Error('家具来源无效。');
    const item=resolve(id);if(!isFurniture(item))throw Error('这件收藏品不能作为家具陈设。');
    const home=normalize(raw),patch=inventoryPatch(stat,[{id,quantity}],[],resolve,where);
    home.placed[id]=add(home.placed[id] || 0,quantity);
    return {home,patch,item,quantity};
  };
  const planStore=(stat,raw,id,quantity,resolve)=>{
    requireSafe(stat);integer(quantity,'收纳数量',1);
    const home=normalize(raw),item=resolve(id);
    if(!isFurniture(item) || (home.placed[id] || 0)<quantity)throw Error('已陈设家具数量不足。');
    home.placed[id]-=quantity;if(!home.placed[id])delete home.placed[id];
    const patch=inventoryPatch(stat,[],[{id,quantity}],resolve);
    return {home,patch,item,quantity};
  };
  const planUnlock=(stat,raw,id,resolve)=>{
    requireSafe(stat);const recipe=recipeById(id),home=normalize(raw);
    if(!recipe.blueprint)throw Error('该配方无需图纸。');
    if(home.unlockedRecipes.includes(id))throw Error('该配方已经解锁。');
    const patch=inventoryPatch(stat,[{id:recipe.blueprint,quantity:1}],[],resolve);
    home.unlockedRecipes.push(id);return {home,patch,recipe};
  };
  const planCraft=(stat,raw,id,batches,baseCount,resolve)=>{
    requireSafe(stat);const recipe=recipeById(id),home=normalize(raw);
    if(!(home.placed[recipe.station]>0))throw Error('需要先陈设'+resolve(recipe.station).name+'。');
    if(recipe.blueprint && !home.unlockedRecipes.includes(id))throw Error('需要先消耗图纸解锁配方。');
    const req=requirements(recipe,batches,baseCount),patch=inventoryPatch(stat,req.costs,req.outputs,resolve);
    return {home,patch,recipe,...req};
  };
  const planKeep=(stat,raw,quantity)=>{
    requireSafe(stat);integer(quantity,'留住数量',1);const home=normalize(raw);
    if(home.cats.temporary<quantity)throw Error('没有足够的猫娘可以留住。');
    home.cats.temporary-=quantity;home.cats.permanent=add(home.cats.permanent,quantity);return {home,patch:{}};
  };
  const incomeSnapshot=raw=>{const home=normalize(raw);return {boxes:home.placed['COL-0106'] || 0,cats:Math.max(0,(home.placed['COL-0093'] || 0)-home.cats.permanent)};};
  const projection=(raw,resolve)=>{const home=normalize(raw);return {家具:Object.fromEntries(Object.entries(home.placed).map(([id,n])=>[resolve(id)?.name || id,n])),猫娘:{待下次入局转换:home.cats.temporary,常住:home.cats.permanent},已解锁配方:home.unlockedRecipes.map(id=>recipes.find(row=>row.id===id)?.name || id)};};
  return {defaults,normalize,recipes,recipeById,inSafe,requireSafe,isFurniture,count,owned,requirements,inventoryPatch,planPlace,planStore,planUnlock,planCraft,planKeep,incomeSnapshot,projection};
})();

const HkmFacilities = (() => {
  const object=value=>value!==null && typeof value==='object' && !Array.isArray(value);
  const copy=value=>structuredClone(value);
  const number=(value,label)=>{
    const result=Number(value);
    if(!['number','string'].includes(typeof value) || String(value).trim()==='' || !Number.isFinite(result) || result<0)throw Error(label+'无效。');
    return result;
  };
  const definitions=[
    {name:'健身房',description:'提升负重上限。',levels:[
      {effect:'负重上限 +2',weight:2,condition:'none',money:100,costs:[{name:'建筑材料',quantity:3}]},
      {effect:'负重上限 +4',weight:4,condition:'extract3',money:500,costs:[{name:'大豆蛋白粉',quantity:3}]},
      {effect:'负重上限 +8',weight:8,condition:'extract10',money:3000,costs:[]}
    ]},
    {name:'潜水中心',description:'提升水下速度与水下行动值上限。',levels:[
      {effect:'水下速度 +1 · 水下行动值上限 +1',speed:1,rounds:1,condition:'none',money:200,costs:[]},
      {effect:'水下速度 +2 · 水下行动值上限 +2',speed:2,rounds:2,condition:'oxygen',money:500,costs:[{name:'遗珠',quantity:2}]},
      {effect:'水下速度 +2 · 水下行动值上限 +4',speed:2,rounds:4,condition:'treasure',money:3000,costs:[]}
    ]},
    {name:'生命强化',description:'提升血量上限。',levels:[
      {effect:'血量上限 +3',hp:3,condition:'none',money:350,costs:[{name:'幸运苹果',quantity:1}]},
      {effect:'血量上限 +6',hp:6,condition:'value',money:1000,costs:[{name:'古代金币',quantity:2}]},
      {effect:'血量上限 +10',hp:10,condition:'kills',money:5000,costs:[{name:'金手表',quantity:3}]}
    ]},
    {name:'臂力强化',levels:[
      {effect:'钓鱼力量 +2',power:2,condition:'none',money:500,stars:4,costs:[]},
      {effect:'钓鱼力量 +4',power:4,condition:'none',money:1000,stars:8,costs:[]},
      {effect:'钓鱼力量 +6',power:6,condition:'none',money:2000,stars:16,costs:[]}
    ]}
  ];
  const normalize=raw=>{
    if(raw!==undefined && !object(raw))throw Error('特勤处数据无效。');
    const result=copy(raw || {});
    for(const {name} of definitions){
      const level=number(result[name] ?? 0,name+'等级');
      if(!Number.isInteger(level) || level>3)throw Error(name+'等级须为 0–3。');
      result[name]=level;
    }
    if(result.解锁记录!==undefined && !object(result.解锁记录))throw Error('特勤处解锁记录无效。');
    result.解锁记录={...result.解锁记录,水下耗尽:result.解锁记录?.水下耗尽 ?? false};
    if(typeof result.解锁记录.水下耗尽!=='boolean')throw Error('水下耗尽记录无效。');
    return result;
  };
  const underwater=(scene,maps)=>scene?.地图==='魔鬼海' && ['浅海区域','深海区域','渊海区域'].some(group=>maps?.魔鬼海?.areaGroups?.[group]?.includes(scene.区域));
  const observe=(stat,maps)=>{
    const result=normalize(stat.特勤处),scene=stat.场景;
    if(underwater(scene,maps) && scene.剩余水下行动值!==undefined && Number(scene.剩余水下行动值)===0)result.解锁记录.水下耗尽=true;
    return result;
  };
  const bonuses=(stat,maps)=>{
    const levels=normalize(stat.特勤处),gym=definitions[0].levels[levels.健身房-1],dive=definitions[1].levels[levels.潜水中心-1],life=definitions[2].levels[levels.生命强化-1];
    return {钓鱼力量:definitions[3].levels[levels.臂力强化-1]?.power || 0,负重上限:gym?.weight || 0,血量上限:life?.hp || 0,速度:underwater(stat.场景,maps)?dive?.speed || 0:0,额外水下行动值上限:stat.场景?.地图==='魔鬼海'?dive?.rounds || 0:0};
  };
  const condition=(stat,key)=>{
    const stats=stat.统计信息 || {},record=normalize(stat.特勤处).解锁记录;
    const progress=(label,value,target)=>({text:label+' '+Number(value || 0)+'/'+target,ok:Number(value || 0)>=target});
    if(key==='extract3')return progress('成功撤离',stats.历史成功撤离总数,3);
    if(key==='extract10')return progress('成功撤离',stats.历史成功撤离总数,10);
    if(key==='value')return progress('历史带出价值',stats.历史带出总价值,5000);
    if(key==='kills')return progress('玩家击杀',stats.历史击杀玩家总数,50);
    if(key==='treasure')return progress('带出至宝',stats.历史带出至宝收藏品总数,1);
    if(key==='oxygen')return {text:'水下行动值耗尽 '+(record.水下耗尽?'已达成':'未达成'),ok:record.水下耗尽};
    return {text:'无',ok:true};
  };
  const bucket=(stat,where)=>where==='安全屋'?(stat.安全屋?.收藏品 || {}):(stat.背包?.携带收藏品 || {});
  const count=(stat,name)=>['安全屋','背包'].reduce((total,where)=>total+Object.entries(bucket(stat,where)).filter(([key,row])=>key===name || row?.名称===name).reduce((sum,[,row])=>sum+number(row.数量,name+'数量'),0),0);
  const availability=(stat,definition,target)=>{
    const level=normalize(stat.特勤处)[definition.name];
    if(level>=3)return {ok:false,reason:'已满级'};
    if(target!==level+1)return {ok:false,reason:'等级已变化'};
    const config=definition.levels[level];
    if(!condition(stat,config.condition).ok)return {ok:false,reason:'未解锁'};
    if(number(stat.统计信息?.哈基币 ?? 0,'哈基币')<config.money)return {ok:false,reason:'哈基币不足'};
    if(config.stars && number(stat.统计信息?.星光 ?? 0,'星光')<config.stars)return {ok:false,reason:'星光不足'};
    if(config.costs.some(cost=>count(stat,cost.name)<cost.quantity))return {ok:false,reason:'材料不足'};
    return {ok:true,reason:''};
  };
  const take=(source,name,quantity)=>{
    let left=quantity;
    for(const [key,row] of Object.entries(source)){
      if(key!==name && row?.名称!==name)continue;
      const have=number(row.数量,name+'数量'),amount=Math.min(have,left);
      if(amount===have)delete source[key];else source[key]={...row,数量:have-amount};
      left-=amount;if(!left)break;
    }
    return quantity-left;
  };
  const planUpgrade=(stat,name,target)=>{
    if(stat.场景?.地图!=='哈基米空间' || stat.场景?.区域!=='特勤处')throw Error('请先前往特勤处。');
    if(stat.主角?.是否死亡===true)throw Error('主角已死亡。');
    const definition=definitions.find(row=>row.name===name);
    if(!definition)throw Error('设施不存在。');
    const available=availability(stat,definition,target);
    if(!available.ok)throw Error(available.reason+'。');
    const config=definition.levels[target-1],levels=normalize(stat.特勤处),safe=copy(bucket(stat,'安全屋')),bag=copy(bucket(stat,'背包'));
    for(const cost of config.costs){let left=cost.quantity;left-=take(safe,cost.name,left);if(left)left-=take(bag,cost.name,left);if(left)throw Error('材料不足。');}
    levels[name]=target;
    return {特勤处:levels,统计信息:{...stat.统计信息,哈基币:number(stat.统计信息.哈基币,'哈基币')-config.money,...(config.stars?{星光:number(stat.统计信息.星光,'星光')-config.stars}:{})},安全屋:{...stat.安全屋,收藏品:safe},背包:{...stat.背包,携带收藏品:bag}};
  };
  return {definitions,normalize,underwater,observe,bonuses,condition,count,availability,planUpgrade};
})();

  const HkmSea = (() => {
  const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
  const clamp=(value,cap)=>Math.max(0,Math.min(cap,number(value)));
  const cost=(map,area,maps)=>{
    if(map!=='魔鬼海')return 0;
    const groups=maps?.魔鬼海?.areaGroups || {};
    for(const [key,value] of [['渊海区域',3],['深海区域',2],['浅海区域',1]])if(groups[key]?.includes(area))return value;
    return 0;
  };
  const oxygen=(map,area,maps)=>map==='魔鬼海' && maps?.魔鬼海?.areaGroups?.有氧气的区域?.includes(area)===true;
  const statusBonus=stat=>Object.values(stat.状态列表 || {}).reduce((sum,row)=>{
    const match=String(row.效果 || '').match(/水下行动值上限\s*[+＋]\s*(\d+(?:\.\d+)?)/);
    return sum+(match?number(match[1]):0);
  },0);
  const cap=stat=>Math.max(8,8+number(stat.主角?.额外水下行动值上限)+statusBonus(stat));
  const spend=(scene,{maps,waterCap=8,costArea=scene.区域,free=false,extra=0,penalty=0}={})=>{
    const sea=scene.地图==='魔鬼海',waterCost=cost(scene.地图,costArea,maps)+(sea && cost(scene.地图,costArea,maps)>0?penalty:0);
    const roundCost=free?0:1+extra+(sea?0:penalty);
    const arrivingOxygen=oxygen(scene.地图,scene.区域,maps);
    return {scene:{...scene,剩余交互轮数:String(Math.max(0,number(scene.剩余交互轮数)-roundCost)),...(sea?{剩余水下行动值:String(arrivingOxygen?waterCap:clamp(number(scene.剩余水下行动值)-waterCost,waterCap)),水下机制版本:1}:{})},cost:roundCost,waterCost,arrivingOxygen};
  };
  const refill=(value,limit,ratio)=>clamp(number(value)+Math.max(1,Math.round(limit*ratio)),limit);
  const suffocate=(scene,hp,maxHp,maps)=>{
    const current=Math.max(0,number(hp)),active=cost(scene.地图,scene.区域,maps)>0 && number(scene.剩余水下行动值)<=0;
    const damage=active && current>0?Math.ceil(Math.max(1,number(maxHp,20))*0.45):0;
    return {hp:Math.max(0,current-damage),damage,overkill:Math.max(0,damage-current)};
  };
  const migrate=(raw,frontend={})=>{
    const stat=structuredClone(raw),front=structuredClone(frontend),scene=stat.场景 || {},sea=scene.地图==='魔鬼海';
    for(const key of ['剩余交互轮数','剩余水下行动值','水下机制版本'])if(scene[key]!==undefined && (!['number','string'].includes(typeof scene[key]) || String(scene[key]).trim()==='' || !Number.isFinite(Number(scene[key])) || Number(scene[key])<0))throw Error('场景'+key+'无效。');
    if(scene.水下机制版本!==undefined && (!Number.isInteger(Number(scene.水下机制版本)) || Number(scene.水下机制版本)>1))throw Error('不支持此水下计数版本。');
    if(number(scene.水下机制版本)<1){
      const rename=box=>{if(!box)return;if(box.额外交互轮数上限!==undefined)box.额外水下行动值上限=number(box.额外交互轮数上限);else box.额外水下行动值上限=number(box.额外水下行动值上限);delete box.额外交互轮数上限;};
      rename(stat.主角);rename(stat.主角?.基础属性);rename(stat.主角?.临时加成?.固定);
      for(const row of Object.values(stat.状态列表 || {}))if(/本局交互轮数上限/.test(String(row.效果))){for(const key of ['名称','描述','效果'])row[key]=String(row[key] || '').replaceAll('交互轮数上限','水下行动值上限').replaceAll('轮数上限','水下行动值上限');}
      scene.剩余水下行动值=String(sea?Math.max(0,number(scene.剩余交互轮数)):0);
      if(sea)scene.剩余交互轮数='35';
      scene.水下机制版本=1;
    }
    const run=front.run;
    if(run?.map==='魔鬼海' && number(run.seaClockVersion)<1){
      run.water=sea?number(scene.剩余水下行动值):number(run.rounds);run.roundCap=35;run.rounds=sea?number(scene.剩余交互轮数):35;run.seaClockVersion=1;
      for(const player of run.players || []){
        player.waterCap=8+number(player.extraCap);player.water=clamp(player.rounds,player.waterCap);
        player.baseRounds=35;player.roundCap=35;player.rounds=35;player.seaClockVersion=1;
      }
      for(const record of front.usePending || []){
        const undo=record.undo || {};
        if(['小型氧气罐','大型氧气罐'].includes(record.item) && undo.rounds!==undefined){undo.water=undo.rounds;delete undo.rounds;}
        if(['水肺药水','强效水肺药水'].includes(record.item))delete undo.runRoundCap;
      }
    }
    return {stat,front};
  };
  return {cost,oxygen,cap,statusBonus,spend,refill,suffocate,migrate};
})();


  const HKM_ATTR_REGISTRY = {"attrs":{"attack":{"name":"攻击力","target":"主角.攻击力","modes":["flat","pct"]},"defense":{"name":"防御力","target":"主角.防御力","modes":["flat","pct"]},"maxHp":{"name":"血量上限","target":"主角.血量上限","modes":["flat","pct"]},"speed":{"name":"速度","target":"主角.速度","modes":["flat","pct"]},"weightCap":{"name":"负重上限","target":"主角.负重上限","modes":["flat","pct"]},"waterCap":{"name":"水下行动值上限","target":"主角.额外水下行动值上限","modes":["flat"],"scope":"map"}},"traits":{"soulbound":{"name":"灵魂绑定","scope":"frontend","effect":"no-loss","informLlm":true},"insured":{"name":"保险","scope":"frontend","effect":"insurance","informLlm":false},"curseBind":{"name":"绑定诅咒","scope":"frontend","effect":"lock-equip","informLlm":true},"storagePants":{"name":"储物内裤","scope":"frontend","effect":"stash","informLlm":false,"params":{"slots":1,"maxWeight":3,"pokeable":true}},"storagePanties":{"name":"性感内裤","scope":"frontend","effect":"stash","informLlm":false,"params":{"slots":2,"maxWeight":2,"pokeable":true}},"hammerspace":{"name":"四次元空间","scope":"frontend","effect":"stash","informLlm":false,"params":{"slots":0,"maxWeight":8,"pokeable":false}},"chastityGuard":{"name":"贞洁守护","scope":"llm"},"charisma":{"name":"好感度提升","scope":"llm"},"lustAura":{"name":"侵犯倾向","scope":"llm"},"radiate":{"name":"辐射","scope":"llm"},"disguise":{"name":"人靠衣装","scope":"llm"},"photography":{"name":"摄影","scope":"llm"},"identityVeil":{"name":"身份认知障碍","scope":"llm"},"officeSlayer":{"name":"打工人克星","scope":"llm"},"valueDrain":{"name":"价值掠夺","scope":"llm"},"mermaidMagic":{"name":"人鱼的魔法","scope":"llm"},"tideResonance":{"name":"同潮共振","scope":"llm"},"asYouWish":{"name":"如心意","scope":"llm"},"bubbleShot":{"name":"泡泡弹","scope":"llm"},"harmony":{"name":"和谐","scope":"llm"},"chord":{"name":"和音","scope":"llm"},"seaBlessing":{"name":"海之庇护","scope":"llm"},"soulSiphon":{"name":"灵魂虹吸","scope":"llm"},"ranged":{"name":"远程武器","scope":"llm"},"multiTarget":{"name":"多目标攻击","scope":"llm"},"noUnderwaterUse":{"name":"水下禁用","scope":"llm"},"regenPerRound":{"name":"每轮回血","scope":"llm","value":"percent"},"roundFreeChance":{"name":"免轮概率","scope":"llm","value":"percent"},"damageTakenPct":{"name":"受伤害修正","scope":"llm","value":"percent"},"fishDamagePct":{"name":"对鱼类增伤","scope":"llm","value":"percent"},"underwaterDamagePct":{"name":"水下增伤","scope":"llm","value":"percent"},"underwaterAccuracy":{"name":"水下命中","scope":"llm","value":"percent"},"trueDamage":{"name":"真实伤害","scope":"llm","value":"number"},"trueDamagePct":{"name":"攻击力比例真伤","scope":"llm","value":"percent"},"virginBonus":{"name":"处子加成","scope":"llm","note":"条件来自叙事状态，交给 LLM 判"},"growthQuest":{"name":"成长任务","scope":"llm"},"flavor":{"name":"风味描述","scope":"llm"},"other":{"name":"其他特性","scope":"llm"}},"fields":{"name":"text","rarity":"enum(稀有度)","category":"enum(类别)","description":"text","value":"int(哈基币)","weight":"number(负重，最多两位小数)","drawWeight":"int(抽签权重)","kind":"enum(equipment/consumable/key/prop/general)","slots":"array(装备部位名，装备类才有)","details":"text(显示用原文，不参与计算)","useEffect":"object(前端使用结算)","attribs":"array(属性条目)","traits":"array(固有特性)","useAttribs":"array(使用后永久属性)","skills":"array(主动/被动技能)","limits":"object(次数限制)","specials":"array(特殊事件)","durability":"int(钥匙耐久：每次开卡 -1，归零由前端移除并告知 LLM；非钥匙不写)","sources":"object(结构化来源：loot=按地图的稀有度+具体区域、collectionLists、areas、allAreas、shops、containers、bottle、tasks)"}};

  const HKM_COLLECTIBLES = {"version":3,"generatedFrom":"搜打撤一定要吃鸡...吧 ？v0.1.061.json","lite":true,"items":{"COL-0002":{"useEffect":{"kind":"heal","percent":0.33,"label":"恢复较少血量"}},"COL-0005":{"useEffect":{"kind":"heal","percent":0.13,"label":"恢复少量血量"}},"COL-0007":{"useEffect":{"kind":"heal","percent":0.4,"label":"恢复中等血量"}},"COL-0008":{"useEffect":{"kind":"heal","percent":0.5,"label":"恢复一半血量"}},"COL-0012":{"useEffect":{"kind":"weightShield","turns":3,"full":false,"label":"三回合内免疫超重负面"}},"COL-0013":{"useEffect":{"kind":"regen","turns":3,"percent":0.15,"label":"三回合内每回合恢复15%血量"}},"COL-0020":{"useEffect":{"kind":"water","map":"魔鬼海","percent":0.4,"label":"恢复40%水下行动值"}},"COL-0025":{"useEffect":{"kind":"freeRound","label":"下次行动不消耗交互轮数"}},"COL-0027":{"useEffect":{"kind":"heal","percent":0.8,"label":"恢复大量血量"}},"COL-0030":{"useEffect":{"kind":"weightShield","turns":5,"full":true,"label":"五回合内免疫超重与完全超重负面"}},"COL-0031":{"useEffect":{"kind":"regen","turns":5,"percent":0.25,"label":"五回合内每回合恢复25%血量"}},"COL-0035":{"useEffect":{"kind":"heal","percent":0.25,"label":"恢复一定血量"}},"COL-0095":{"useEffect":{"kind":"maxHp","delta":1,"label":"血量上限永久+1"}},"COL-0126":{"useEffect":{"kind":"waterCap","map":"魔鬼海","delta":2,"turns":24,"label":"本局水下行动值上限+2"}},"COL-0143":{"useEffect":{"kind":"water","map":"魔鬼海","percent":1,"label":"恢复全部水下行动值"}},"COL-0148":{"useEffect":{"kind":"waterCap","map":"魔鬼海","delta":4,"turns":15,"label":"本局水下行动值上限+4"}},"COL-0149":{"useEffect":{"kind":"cleanse","label":"消除催情类持续效果"}},"COL-0154":{"useEffect":{"kind":"cleanse","label":"抑制触手相关效果"}},"COL-0176":{"useEffect":{"kind":"cleanse","label":"抑制触手相关效果"}}}};
  if (!host || disposed || !env.isCurrent()) return;

  globalThis.__HKM_RESET_DISPOSERS = disposers;
  const hkmListen = (target, type, listener, options) => {
    target.addEventListener(type, listener, options);
    disposers.push(() => target.removeEventListener(type, listener, options));
  };
  const hkmOwnNodes = (...nodes) => disposers.push(() => { for (const node of nodes) node.remove(); });
  hkmListen(env.scriptWindow, 'pagehide', dispose, { once: true });
  const helperReady=()=>typeof getVariables==='function' && typeof replaceVariables==='function';
  if(!helperReady()){
    const loading=hkmCreateElement('p');loading.className='hkm-reset-status';loading.textContent='正在加载酒馆助手…';host.replaceChildren(loading);
    for(let attempt=0;attempt<50 && !helperReady();attempt++)await new Promise(resolve=>setTimeout(resolve,200));
    if(!helperReady())throw Error('酒馆助手变量接口未就绪，请启用酒馆助手后重试。');
  }


  const hudAction = handler => function(...args) {
    try { const result=handler.apply(this,args); return result?.catch ? result.catch(error=>setStatus(error?.message || String(error))) : result; }
    catch(error) { setStatus(error?.message || String(error)); }
  };
  const make = (tag, className, text) => {
    const node = hkmCreateElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };
  const clear = node => { while (node.firstChild) node.removeChild(node.firstChild); };
  const textOf = (value, fallback = '—') => {
    if (value === undefined || value === null || value === '') return fallback;
    return String(value);
  };
  const modelSafeDetails = value => textOf(value, '')
    .split(/\r?\n/)
    .filter(line => !/^\s*(?:编号|产出区域|产出地图|获取区域)\s*[:：]/.test(line))
    .join('\n')
    .trim();
  const modelEffectLines = item => textOf(item?.details, '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => {
      if (!line || /^[{[\]},，、]+$/.test(line)) return false;
      if (/^["“].+["”]\s*[:：]\s*$/.test(line)) return false;
      return !/^(?:编号|稀有度|类别|描述|价值|重量|数量|来源|产出区域|产出地图|获取区域|被抽取时的权重|钓鱼被抽取时的权重|军需店出售价格|军需店解锁条件|出售价格|解锁条件|配方详细)\s*[:：]/.test(line);
    });
  const modelItemLines = (item, quantity = 1) => [
    '· ' + textOf(item?.name, '未知收藏品') + '（' + textOf(item?.rarity, '未知') + '）×' + Math.max(1, Number(quantity) || 1) + '｜' + textOf(item?.category, '未分类'),
    textOf(item?.description, '')
  ].filter(Boolean);
  const modelSafeItemPayload = item => item ? {
    name: item.name,
    rarity: item.rarity,
    category: item.category,
    value: item.value,
    weight: item.weight,
    description: item.description,
    details: modelSafeDetails(item.details)
  } : null;

  const modelBriefItemPayload = item => item ? {
    name: item.name,
    rarity: item.rarity,
    category: item.category,
    value: item.value,
    weight: item.weight,
    description: item.description
  } : null;
  const modelBriefResultPayload = result => ({
    rarity: result?.rarity,
    quantity: Math.max(1, Number(result?.quantity) || 1),
    source: textOf(result?.source, ''),
    item: modelBriefItemPayload(result?.item)
  });



  const HUD_RARITY_TONE = { 寻常: '#deeaf1', 少见: '#56f49c', 珍稀: '#4ca4ff', 奇异: '#cd66ff', 至宝: '#ffca3e', 神秘: '#ff4070' };


  const itemRefLines = (results, title) => {
    const list = (results || []).filter(result => result && result.item);
    if (!list.length) return [];
    return [
      '',
      '<HkmItemRefs>',
      ...list.map(result => '<HkmItem name="' + textOf(result.item.name, '') + '" rarity="' + textOf(result.item.rarity, '') + '" qty="' + Math.max(1, Number(result.quantity) || 1) + '" tone="' + textOf(HUD_RARITY_TONE[textOf(result.item.rarity, '')], '#deeaf1') + '"/>'),
      '</HkmItemRefs>'
    ];
  };
  const wrapSearchResultMessage = message => '<HkmFrontendSearchResult>\n' + message + '\n</HkmFrontendSearchResult>';
  const wrapMoveEncounterMessage = message => '<HkmFrontendMoveEncounter>\n' + message + '\n</HkmFrontendMoveEncounter>';
  const asObject = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const entriesOf = value => Object.entries(asObject(value));
  const field = (label, value) => {
    const box = make('div', 'hkm-reset-kv');
    box.append(make('div', 'hkm-reset-kv-label', label), make('div', 'hkm-reset-kv-value', textOf(value)));
    return box;
  };
  let sectionSerial = 0;
  const section = (title, note = '', options = {}) => {
    const box = make('section', 'hkm-reset-section');
    const heading = make('h3', 'hkm-reset-section-title');
    heading.append(make('span', '', title));
    if (note) heading.append(make('span', 'hkm-reset-section-note', note));
    const body = make('div', 'hkm-reset-section-body');
    if (options.collapsible) {
      const bodyId = 'hkm-reset-section-body-' + (++sectionSerial);
      const startOpen = options.open === true;
      body.id = bodyId;
      body.hidden = !startOpen;
      const toggle = make('button', 'hkm-reset-section-toggle', startOpen ? '收起' : '展开');
      toggle.type = 'button';
      toggle.setAttribute('aria-expanded', String(startOpen));
      toggle.setAttribute('aria-controls', bodyId);
      toggle.setAttribute('aria-label', '展开或折叠' + title);
      toggle.addEventListener('click', () => {
        const expanded = body.hidden;
        body.hidden = !expanded;
        toggle.textContent = expanded ? '收起' : '展开';
        toggle.setAttribute('aria-expanded', String(expanded));
      });
      heading.append(toggle);
    }
    box.append(heading, body);
    return { box, body };
  };
  const rarityClass = rarity => ({寻常:'common',少见:'uncommon',珍稀:'rare',奇异:'epic',至宝:'legendary',神秘:'mystic'}[rarity] || 'common');
  const currentStat = async () => {
    try {
      const scope = { type: 'message', message_id: mvuMessageId() };
      if (typeof Mvu !== 'undefined' && typeof Mvu?.getMvuData === 'function') {
        const data = await Mvu.getMvuData(scope);
        if (data?.stat_data && typeof data.stat_data === 'object') return HkmStateBoundary.compose(data.stat_data,data.hkm_game_data || (!isLatestHudLayer() && data.stat_data?.场景?.地图 ? null : getVariables({type:'chat'})?.hkm_frontend_state?.gameData),getVariables({type:'chat'})?.hkm_frontend_state);
      }
      if (typeof getVariables === 'function') {
        const data = await getVariables(scope);
        if (data?.stat_data && typeof data.stat_data === 'object') return HkmStateBoundary.compose(data.stat_data,data.hkm_game_data || (!isLatestHudLayer() && data.stat_data?.场景?.地图 ? null : getVariables({type:'chat'})?.hkm_frontend_state?.gameData),getVariables({type:'chat'})?.hkm_frontend_state);
      }

      if (typeof getAllVariables === 'function') {
        const all = await getAllVariables();
        if (all?.stat_data && typeof all.stat_data === 'object') return HkmStateBoundary.compose(all.stat_data,all.hkm_game_data || (!isLatestHudLayer() && all.stat_data?.场景?.地图 ? null : getVariables({type:'chat'})?.hkm_frontend_state?.gameData),getVariables({type:'chat'})?.hkm_frontend_state);
      }
    } catch (_) {}
    return {};
  };
  const stateKey = 'hkm_frontend_state';
  let hkm103AutoTimer=null, hkm103AutoSignature='', hkm103CacheError='';
  let hkm103Scope=null;
  try { hkm103Scope=HkmSave.identity(); } catch (_) {}
  const hkm103Autosave = async () => {
    if(!hkm103Scope || hudReadOnly || !isLatestHudLayer() || hkm098Busy || hkm098Refreshing || hkm098RefreshQueued || searchBusy || moveBusy || launchBusy || purchaseBusy || specialBusy || state.lifecycleJournal?.phase==='prepared' || hkmFishingEngine || hkmTurnLocked() || HkmSave.pending())return;
    HkmSave.assertScope(hkm103Scope);
    const stat=await currentStat();
    HkmSave.assertScope(hkm103Scope);
    if(hkmTurnLocked() || !isLatestHudLayer() || hkm098Busy || hkm098Refreshing || hkm098RefreshQueued || state.lifecycleJournal?.phase==='prepared' || !stat.主角 || !stat.场景)return;
    const save=HkmSave.capture(stat);
    const signature=JSON.stringify([save.profile,save.payload]);
    if(signature===hkm103AutoSignature)return;
    if(!hkm103AutoSignature) {
      const bank=HkmSave.readBank(hkm103Scope);
      if(bank.auto) {
        hkm103AutoSignature=signature;HkmSave.rememberProfile(save);
        if(JSON.stringify(bank.auto.payload)!==JSON.stringify(save.payload))setStatus('本对话已有本地自动存档；如需恢复，请打开「存档 / 读档」读取。');
        return;
      }
    }
    HkmSave.saveLocal(hkm103Scope,save);HkmSave.rememberProfile(save);
    hkm103AutoSignature=signature;hkm103CacheError='';
  };
  const hkm103ScheduleSave = () => {
    clearTimeout(hkm103AutoTimer);
    hkm103AutoTimer=setTimeout(()=>hkm103Autosave().catch(e=>{
      if(e.message!==hkm103CacheError){hkm103CacheError=e.message;setStatus('自动存档未完成：'+e.message);}
    }),700);
  };


  const useRecordsOf = raw => (Array.isArray(raw) ? raw : [])
    .map((row, index) => {
      const value = asObject(row);
      return {
        id: textOf(value.id, 'USE-' + (index + 1)),
        text: textOf(value.text, ''),
        item: textOf(value.item, ''),
        useClass: textOf(value.useClass, ''),
        roundKey: textOf(value.roundKey, ''),
        sent: value.sent === true,
        undo: asObject(value.undo),
      };
    })
    .filter(row => row.text);

const hkm095Object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const hkm095Own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const versions = value => Array.isArray(value) ? value.filter(x=>typeof x==='string') : typeof value==='string' ? [value] : [];

function runIdentity(run) {
  if (!run || typeof run.map !== 'string' || !Number.isFinite(run.startedAt)) throw Error('缺少已保存的本局标识');
  return JSON.stringify([run.map, run.startedAt]);
}

function hkmSilentSettlement(key, text) {
  return /^(fishing-mod:|box-action:)/.test(String(key)) || ['渔具装配已完成。', '战利品盒操作已由前端完成；盒内余量与背包、装备或地面数据以当前变量为准，不重复领取。'].includes(String(text || '').trim());
}

function mergeDurableState(current, stored) {
  current=hkm095Object(current); stored=hkm095Object(stored);
  const ledger={...hkm095Object(stored.containerLedger)};
  for (const [key,row] of Object.entries(hkm095Object(current.containerLedger))) {
    const prior=ledger[key];

    if (!prior || prior.phase !== 'opened') ledger[key]=row;
  }
  const acks={};
  for (const source of [stored.settleAcks,current.settleAcks]) for (const [key,value] of Object.entries(hkm095Object(source))) {
    acks[key]=[...new Set([...versions(acks[key]),...versions(value)])];
  }
  const pending={};

  for (const source of [stored.insuranceLog,current.insuranceLog]) for (const [key,text] of Object.entries(hkm095Object(source))) {
    if (!hkmSilentSettlement(key, text) && !versions(acks[key]).includes(text)) pending[key]=text;
  }
  return {...current,achievements:HkmAchievements.merge(current.achievements,stored.achievements),containerLedger:ledger,settleAcks:acks,insuranceLog:pending};
}

function acknowledgeSettlement(current, sent) {
  const result={...current,insuranceLog:{...hkm095Object(current.insuranceLog)},settleAcks:{...hkm095Object(current.settleAcks)}};
  for (const [key,text] of Object.entries(hkm095Object(sent))) {

    if (result.insuranceLog[key] === text) {
      result.settleAcks[key]=[...new Set([...versions(result.settleAcks[key]),text])];
      delete result.insuranceLog[key];
    }
  }
  return result;
}

function containerKey(run, id) {
  if (!id || typeof id !== 'string') throw Error('缺少容器ID');
  return JSON.stringify([runIdentity(run),id]);
}

function containerTransaction(current, id) {
  return hkm095Object(current.containerLedger)[containerKey(current.run,id)] || null;
}

function claimContainer(current, id) {
  const key=containerKey(current.run,id);
  if (hkm095Own(hkm095Object(current.containerLedger),key)) throw Error('本局已开启或有待核验的开启事务');
  return {...current,containerLedger:{...hkm095Object(current.containerLedger),[key]:{phase:'claimed'}}};
}

function completeContainer(current, id) {
  const key=containerKey(current.run,id);
  if (!hkm095Own(hkm095Object(current.containerLedger),key)) throw Error('不能完成未占位的容器');
  return {...current,containerLedger:{...hkm095Object(current.containerLedger),[key]:{phase:'opened'}}};
}

async function createThenAcknowledge({message,create,acknowledge,trigger,enterGuard,leaveGuard}) {
  enterGuard();
  try {
    await create(message);
    await acknowledge();
    if (trigger) await trigger();
  } finally { leaveGuard(); }
}

function receiptMatches({message,revision,originChat,currentChat}) {
  return !!revision && !!originChat && originChat === currentChat && message?.is_user === true && String(message.mes || '').includes('<HkmPendingReceipt revision="'+revision+'"/>');
}

function isLatestOwner({mine,assistantIds}) {
  return Number.isInteger(mine) && mine >= 0 && assistantIds.length > 0 && mine === Math.max(...assistantIds);
}







  const HUD_CORE_BASE_KEYS = ['攻击力', '防御力', '血量上限', '速度', '负重上限', '额外水下行动值上限'];
  const HUD_ITEM_LIMITS = {
    'COL-0095': { maxUses: 10 },
    'COL-0165': { maxUses: 20 },
    'COL-0183': { maxUses: 2 },
    'COL-0162': { maxEffects: 2, progressPerEffect: 5, tier: 4, grant: { 速度: 2, 防御力: 2 } },
  };
  const hudHostChat = () => {
    try {
      const context = typeof hkm095HostContext === 'function' ? hkm095HostContext() : null;
      return Array.isArray(context?.chat) ? context.chat : null;
    } catch (_) { return null; }
  };
  const hudDialogueCount = () => {
    const chat = hudHostChat();
    if (!chat) return Math.max(0, aiNum(asObject(state.dialogue).count, 0));
    let count = 0;
    for (const message of chat) if (message && message.is_user === true) count += 1;
    return count;
  };
  const hudDialogueSync = () => {
    const count = hudDialogueCount();
    const previous = Math.max(0, aiNum(asObject(state.dialogue).count, 0));
    const delta = count > previous ? count - previous : 0;
    if (previous !== count) {
      state.dialogue = { count, previous, updatedAt: Date.now() };
      try { saveFrontendState(state); } catch (_) {}
    }
    return { count, delta };
  };
  const hudDialogueTag = () => {
    const count = Math.max(0, aiNum(asObject(state.dialogue).count, 0));
    return count ? '（前端结算 · 第 ' + count + ' 次对话）' : '（前端结算）';
  };
  const hudItemCounter = id => {
    const box = asObject(asObject(state.itemCounters)[textOf(id, '')]);
    return {
      uses: Math.max(0, aiNum(box.uses, 0)),
      effects: Math.max(0, aiNum(box.effects, 0)),
      progress: Math.max(0, aiNum(box.progress, 0)),
      pendingGrant: box.pendingGrant === true,
      appleRound: textOf(box.appleRound, ''),
      appleRoll: typeof box.appleRoll === 'number' && Number.isFinite(box.appleRoll) && box.appleRoll >= 0 && box.appleRoll < 1 ? box.appleRoll : null,
      gambleRound: textOf(box.gambleRound, ''),
      gambleRoll: typeof box.gambleRoll === 'number' && Number.isFinite(box.gambleRoll) && box.gambleRoll >= 0 && box.gambleRoll < 1 ? box.gambleRoll : null,
    };
  };
  const hudItemCounterSet = (id, next) => {
    const key = textOf(id, '');
    if (!key) return;
    state.itemCounters = { ...asObject(state.itemCounters), [key]: { ...hudItemCounter(key), ...next } };
  };
  const hudItemCounterClear = id => {
    const key = textOf(id, '');
    if (!key) return;
    const box = { ...asObject(state.itemCounters) };
    delete box[key];
    state.itemCounters = box;
  };

  const hudGrantBase = (stat, deltas) => {
    const equipment = asObject(stat?.装备);
    const box = asObject(deltas);
    const base = { ...hudHeroBaseOf(asObject(stat?.主角), hudGearBonus(equipment)) };
    const applied = [], deltasApplied = {};
    for (const key of HUD_CORE_BASE_KEYS) {
      const delta = aiNum(box[key], 0);
      if (!delta) continue;
      const before = aiNum(base[key], HUD_BASE_DEFAULTS[key]);
      base[key] = Math.max(0, before + delta);
      deltasApplied[key] = base[key] - before;
      applied.push(key + (deltasApplied[key] > 0 ? '+' : '') + deltasApplied[key]);
    }
    return { patch: applied.length ? { 主角: hudHeroWithBase(stat, base, equipment) } : {}, applied, base, deltasApplied };
  };

  const hudMaskEquipped = stat => {
    const name = textOf(itemById('COL-0162')?.name, '');
    if (!name) return false;
    return textOf(asObject(asObject(stat?.装备)).面部, '').includes(name);
  };


  const hudMaskCountSearch = (stat, mapName, area, tier) => {
    if (hudReadOnly) return false;
    const config = HUD_ITEM_LIMITS['COL-0162'];
    if (!config) return false;
    if (!hudMaskEquipped(stat)) { if (hudItemCounter('COL-0162').progress) hudItemCounterClear('COL-0162'); return false; }


    const level = Number.isFinite(Number(tier)) ? aiNum(tier, 0) : getTier(mapName, area, GAME_DATA.maps?.[mapName]);
    if (level !== aiNum(config.tier, 4)) return false;
    const counter = hudItemCounter('COL-0162');
    if (counter.effects >= aiNum(config.maxEffects, 0)) return false;
    const need = Math.max(1, aiNum(config.progressPerEffect, 5));
    const progress = counter.progress + 1;
    if (progress >= need) hudItemCounterSet('COL-0162', { progress: progress - need, pendingGrant: true });
    else hudItemCounterSet('COL-0162', { progress });
    return true;
  };

  const hudSettleMaskGrowth = async stat => {
    const config = HUD_ITEM_LIMITS['COL-0162'];
    if (!config) return false;
    const counter = hudItemCounter('COL-0162');
    if (!counter.pendingGrant) return false;
    if (!hudMaskEquipped(stat)) {
      hudItemCounterClear('COL-0162');
      try { saveFrontendState(state); } catch (_) {}
      return false;
    }
    if (counter.effects >= aiNum(config.maxEffects, 0)) {
      hudItemCounterSet('COL-0162', { pendingGrant: false });
      try { saveFrontendState(state); } catch (_) {}
      return false;
    }
    const granted = hudGrantBase(stat, config.grant);

    const text = '古代面膜成长：累计成功搜索 ' + aiNum(config.progressPerEffect, 5) + ' 次价值等级 ' + aiNum(config.tier, 4)
      + ' 的区域，永久提升 ' + granted.applied.join('、') + '（第 ' + (counter.effects + 1) + '/' + aiNum(config.maxEffects, 0) + ' 次生效）。' + hudDialogueTag();
    await hkm098Transact('mask-growth:'+String(counter.effects+1),granted.patch,{itemCounters:{...asObject(state.itemCounters),'COL-0162':{...counter,pendingGrant:false,effects:counter.effects+1}}},text);
    setStatus(text);
    return true;
  };
  const aiNum = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };
  const aiRoll = range => randomInt(Array.isArray(range) ? range : [range, range]);
  const HkmAchievements = (() => {
    const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const definition = (id, name, description, kind, target, reward, extra = {}) => ({ id, name, description, kind, target, reward, ...extra });
    const defs = [
      definition('first_common', '首银', '第一次摸到寻常物品!', 'searchRarity', 1, { stars: 1 }, { rarity: '寻常' }),
      definition('first_uncommon', '绿的都拿!', '第一次摸到少见物品!', 'searchRarity', 1, { stars: 1 }, { rarity: '少见' }),
      definition('first_rare', '蓝的也很值钱', '第一次摸到珍稀物品!', 'searchRarity', 1, { stars: 1 }, { rarity: '珍稀' }),
      definition('first_epic', '奇异藏品!', '第一次摸到奇异物品!', 'searchRarity', 1, { stars: 2 }, { rarity: '奇异' }),
      definition('first_legendary', '大金!', '第一次摸到至宝物品!', 'searchRarity', 1, { stars: 3 }, { rarity: '至宝' }),
      definition('common_haul', '捡破烂的', '这你都吃', 'singleExtractRarity', 10, { stars: 1, coins: 100 }, { rarity: '寻常' }),
      definition('uncommon_haul', '跑刀仔', '等我攒够哈基币', 'singleExtractRarity', 8, { stars: 2, coins: 200 }, { rarity: '少见' }),
      definition('rare_haul', '吃上好的了', '肥肥撤离', 'singleExtractRarity', 6, { stars: 3, coins: 400 }, { rarity: '珍稀' }),
      definition('epic_haul', '老板肥不肥', '很肥很肥很肥', 'singleExtractRarity', 4, { stars: 4, coins: 800 }, { rarity: '奇异' }),
      definition('legendary_haul', '双大金!', '塞回收...呃，你的安全裤塞的下吗？', 'singleExtractRarity', 2, { stars: 5, coins: 1600 }, { rarity: '至宝' }),
      definition('mystic_haul', '奇迹红光', '最高的稀有度...吗？', 'singleExtractRarity', 1, { stars: 6, coins: 3200 }, { rarity: '神秘' }),
      definition('coins_1k', 'A4', '你的cash flow还不够猛攻一把魔鬼海的', 'coins', 1000, { stars: 1 }),
      definition('coins_10k', '万元户', '终于不用担心破产了', 'coins', 10000, { stars: 4 }),
      definition('coins_100k', '富翁', '您买至宝砍价吗?', 'coins', 100000, { stars: 8 }),
      definition('coins_1m', '哈基米之神', '你完成了哈基米行动的目标......', 'coins', 1000000, { stars: 16, randomRarity: '神秘' }),
      definition('assets_3k', '低保户', '如果你花了很多对局才完成它，那还不如去卖', 'assets', 3000, { stars: 2, randomRarity: '珍稀' }),
      definition('assets_30k', 'A5', '现在你的现金流支持起全套奇异了吗。', 'assets', 30000, { stars: 4, randomRarity: '奇异' }),
      definition('assets_300k', '富甲一方', '或许你离那个目标很近了。', 'assets', 300000, { stars: 8, randomRarity: '至宝' }),
      definition('stash_mouse', '屯屯鼠', '不要的东西为什么不卖...', 'stashRatio', 10, { stars: 3 }),
      definition('lost_legendary', '幻光...', '你曾经拥有它......', 'lostRarity', 1, { stars: 2 }, { rarity: '至宝' }),
      definition('lost_mystic', '创造理赔', '你会选择回档还是理赔呢?', 'lostRarity', 1, { stars: 5 }, { rarity: '神秘' }),
      definition('virginity', '破处!', '失去自己的处女膜。', 'virginity', 1, { stars: 1 }),
      definition('reputation', '好女孩!', '我真的不是cbz。', 'reputation', -50, { stars: 3 }),
      definition('virgin_hundred', '好婊子', '完成“难道她真的是好女孩?”。', 'taskCompleted', 1, { stars: 0 }, { taskId: 'MAIN-S-19' }),
      definition('insurance_legendary', '合法赎回', '保险，小子!', 'insuredRarity', 1, { stars: 2 }, { rarity: '至宝' }),
      definition('clear_map', '清图!', '本局击杀至少半数其他玩家，成为场上最后一名存活的玩家。', 'clearMap', 1, { stars: 2 }),
      definition('four_player_kills', '天才少女!', '很有实力。', 'singleRunKills', 4, { stars: 4 }),
      definition('no_living_units', '准星之中无活物', '本局击杀至少半数其他玩家及三分之一NPC敌人，场上无活物后成功撤离。', 'noLivingUnits', 1, { stars: 6 }),
      definition('bottle_one_line', '滚木!', '这漂流瓶怎么真是漂流瓶啊。', 'bottleOneLine', 1, { stars: 1 }),
      definition('fish_rare_first', '大货!', '好难拉!', 'fishFirst', 1, { stars: 1 }, { rarity: '珍稀' }),
      definition('fish_rare_8_a', '珍稀猎手', '算是个合格的钓鱼佬了。', 'fishCount', 8, { stars: 2, coins: 400 }, { rarity: '珍稀' }),
      definition('fish_epic_first', '紧俏货!', '你是说你用两条手拉上来这玩意?', 'fishFirst', 1, { stars: 2 }, { rarity: '奇异' }),
      definition('fish_epic_6', '奇异猎手', '算是个合格的钓鱼佬了。', 'fishCount', 6, { stars: 4, coins: 1000 }, { rarity: '奇异' }),
      definition('fish_legendary_first', '金色传说!', '你忍住不去想钓这种鱼时它跑了多少次', 'fishFirst', 1, { stars: 3 }, { rarity: '至宝' }),
      definition('fish_legendary_3', '至宝猎手', '强大......', 'fishCount', 3, { stars: 8, coins: 2500 }, { rarity: '至宝' }),
      definition('fish_mystic_1', '一闪而过的红光', '怎么钓上它的???', 'fishCount', 1, { stars: 10, base: { 负重上限: 3 } }, { rarity: '神秘' }),
      definition('carry_100', '搬砖的', '捡破烂也挺有意思的，不是吗?', 'carryItems', 100, { stars: 2, base: { 负重上限: 1 } }),
      definition('carry_mystic', '心脏挖出来还能跳两年', '好吧，其实没那么刺激。', 'carryRarity', 1, { stars: 4 }, { rarity: '神秘' }),
      definition('extract_3k', '三千撤离！', '很肥很肥很肥。', 'lastExtractValue', 3000, { stars: 2 }),
      definition('extract_10k', '一万撤离!', '你吃了什么？？？', 'lastExtractValue', 10000, { stars: 5 }),
      definition('carry_value_10k', '里程碑', '希望这是一个很好的开始。', 'carryValue', 10000, { stars: 2, base: { 负重上限: 1 } }),
      definition('carry_value_100k', '哈基米高手', '憧憬成为哈基米高手。', 'carryValue', 100000, { stars: 4, base: { 攻击力: 1 } }),
      definition('fish_broken', '崩线!', '我的鱼钩......', 'fishBroken', 1, { stars: 1 }),
      definition('fish_recall_20', '空军!', '才没有空均呢', 'fishRecall', 20, { stars: 1, coins: 250 }),
      definition('fish_total_10', '钓鱼新手', '要走的路还很长。', 'fishTotal', 10, { stars: 1, fishingPower: 1 }),
      definition('fish_total_100', '钓鱼老手', '现在你可以在帖子里教萌新钓鱼了。', 'fishTotal', 100, { stars: 3, fishingPower: 2 }),
      definition('fish_total_1000', '钓鱼专家', '天呐，你比我更懂钓鱼.....', 'fishTotal', 1000, { stars: 9, fishingPower: 3 }),
      definition('fish_total_10000', '钓鱼宗师', '你到底在追寻什么......', 'fishTotal', 10000, { stars: 27, fishingPower: 4 }),
    ];
    const aliases = {fish_rare_8_b:'fish_rare_8_a',fish_rare_8_c:'fish_rare_8_a',fish_epic_6_b:'fish_epic_6'};
    const defaults = () => ({ version: 4, previousVirginity: null, unlocked: {}, claimed: {}, stats: { search: {}, bestExtract: {}, extracts: 0, carryValue: 0, carryItems: 0, carryRarity: {}, maps: {}, fish: {}, fishTotal: 0, fishBroken: 0, fishRecall: 0, lost: {}, insured: {}, bottleOneLine: 0, lastExtractValue: 0, lastExtractItems: {}, runKills: 0, clearMap: 0, noLivingUnits: 0, virginityLoss: 0 } });
    const normalize = raw => {
      const source = object(raw), next = defaults(), stats = object(source.stats);
      next.previousVirginity = ['是','否'].includes(source.previousVirginity) ? source.previousVirginity : null;
      for (const [key, value] of Object.entries(object(source.unlocked))) if (value === true) next.unlocked[key] = true;
      for (const [key, value] of Object.entries(object(source.claimed))) if (value === true) { next.unlocked[key] = true; next.claimed[key] = true; }
      for (const [oldId,newId] of Object.entries(aliases)) {
        if (next.unlocked[oldId]) next.unlocked[newId]=true;
        if (next.claimed[oldId]) { next.unlocked[newId]=true;next.claimed[newId]=true; }
      }
      for (const key of ['search', 'bestExtract', 'carryRarity', 'maps', 'fish', 'lost', 'insured']) next.stats[key] = Object.fromEntries(Object.entries(object(stats[key])).map(([k, v]) => [k, Math.max(0, Math.floor(Number(v) || 0))]));
      for (const key of ['extracts', 'carryItems', 'fishTotal', 'fishBroken', 'fishRecall', 'bottleOneLine', 'runKills', 'clearMap', 'noLivingUnits', 'virginityLoss']) next.stats[key] = Math.max(0, Math.floor(Number(stats[key]) || 0));
      for (const key of ['carryValue', 'lastExtractValue']) next.stats[key] = Math.max(0, Number(stats[key]) || 0);
      next.stats.lastExtractItems = Object.fromEntries(Object.entries(object(stats.lastExtractItems)).map(([k, v]) => [k, Math.max(0, Math.floor(Number(v) || 0))]));
      return next;
    };
    const merge = (current, stored) => {
      const next = normalize(current), prior = normalize(stored);
      if (next.previousVirginity === null) next.previousVirginity = prior.previousVirginity;
      Object.assign(next.unlocked, prior.unlocked);
      Object.assign(next.claimed, prior.claimed);
      for (const key of Object.keys(next.stats)) {
        if (['lastExtractValue', 'lastExtractItems'].includes(key)) continue;
        if (next.stats[key] && typeof next.stats[key] === 'object') {
          for (const [name, value] of Object.entries(prior.stats[key])) next.stats[key][name] = Math.max(Number(next.stats[key][name]) || 0, Number(value) || 0);
        } else next.stats[key] = Math.max(next.stats[key], prior.stats[key]);
      }
      return next;
    };
    const reconcile = (raw, receipts) => {
      const next = normalize(raw);
      for (const def of defs) if (object(receipts)['achievement:claim:' + def.id] === true) { next.unlocked[def.id] = true; next.claimed[def.id] = true; }
      for (const [oldId,newId] of Object.entries(aliases)) if (object(receipts)['achievement:claim:' + oldId] === true) { next.unlocked[newId]=true;next.claimed[newId]=true; }
      return next;
    };
    const addRows = (box, rows) => {
      for (const row of Array.isArray(rows) ? rows : []) {
        const rarity = String(row?.rarity || row?.item?.rarity || '寻常'), quantity = Math.max(0, Math.floor(Number(row?.quantity) || 0));
        if (quantity) box[rarity] = (box[rarity] || 0) + quantity;
      }
    };
    const observeSearch = (raw, rows) => {
      const next = normalize(raw);
      addRows(next.stats.search, rows);
      return next;
    };
    const observeExtraction = (raw, brought, mapName, context = {}) => {
      const next = normalize(raw), rows = Array.isArray(brought?.rows) ? brought.rows : [], value = Math.max(0, Number(brought?.value) || 0);
      next.stats.extracts += 1; next.stats.carryValue += value; next.stats.carryItems += rows.reduce((sum, row) => sum + Math.max(0, Math.floor(Number(row?.quantity) || 0)), 0);
      next.stats.lastExtractValue = value; next.stats.lastExtractItems = {}; addRows(next.stats.lastExtractItems, rows); addRows(next.stats.carryRarity, rows);
      for (const row of rows) if (row?.rarity === '神秘') next.stats.carryRarity.神秘 = (next.stats.carryRarity.神秘 || 0);
      if (mapName) next.stats.maps[String(mapName)] = true;
      next.stats.runKills = Math.max(next.stats.runKills, Math.floor(Number(context.runKills) || 0));
      next.stats.clearMap = Math.max(next.stats.clearMap, context.clearMap ? 1 : 0);
      next.stats.noLivingUnits = Math.max(next.stats.noLivingUnits, context.noLivingUnits ? 1 : 0);
      return next;
    };
    const observeLoss = (raw, plan) => {
      const next = normalize(raw);
      for (const row of plan?.dropped || []) {
        const rarity = String(row?.rarity || row?.item?.rarity || '寻常');
        next.stats.lost[rarity] = (next.stats.lost[rarity] || 0) + Math.max(1, Math.floor(Number(row?.quantity) || 1));
      }
      for (const row of plan?.paid || []) {
        const rarity = String(row?.rarity || row?.item?.rarity || '寻常');
        next.stats.insured[rarity] = (next.stats.insured[rarity] || 0) + Math.max(1, Math.floor(Number(row?.quantity) || 1));
      }
      return next;
    };
    const observeFishing = (raw, row) => {
      const next = normalize(raw), rarity = String(row?.rarity || '');
      if (row?.success) { next.stats.fishTotal += 1; if (rarity) next.stats.fish[rarity] = (next.stats.fish[rarity] || 0) + 1; }
      if (row?.broken) next.stats.fishBroken += 1;
      if (row?.recalled === true && !row.success && !row.broken) next.stats.fishRecall += 1;
      return next;
    };
    const observeBottle = (raw, matched) => {
      const next = normalize(raw); if (matched === true) next.stats.bottleOneLine += 1; return next;
    };
    const stashValue = stat => Object.values(object(stat?.安全屋?.收藏品)).reduce((sum, row) => sum + Math.max(0, Number(row?.价值) || 0) * Math.max(0, Math.floor(Number(row?.数量) || 0)), 0);
    const values = (data, stat, codex) => {
      const stats = data.stats, game = object(stat?.统计信息), fish = stats.fish;
      return {
        searchRarity: rarity => stats.search[rarity] || 0,
        singleExtractRarity: rarity => stats.lastExtractItems[rarity] || 0,
        coins: Number(game.哈基币) || 0,
        assets: Number(game.总资产) || 0,
        stashRatio: Number(game.哈基币) > 3000 ? stashValue(stat) / Math.max(1, Number(game.哈基币)) : 0,
        lostRarity: rarity => stats.lost[rarity] || 0,
        insuredRarity: rarity => stats.insured[rarity] || 0,
        virginity: stats.virginityLoss,
        reputation: Number(game.风评) || 0,
        taskCompleted: id => stat?.任务档案?.已完成任务?.[id] === true ? 1 : 0,
        clearMap: stats.clearMap,
        singleRunKills: stats.runKills,
        noLivingUnits: stats.noLivingUnits,
        bottleOneLine: stats.bottleOneLine,
        fishFirst: rarity => fish[rarity] || 0,
        fishCount: rarity => fish[rarity] || 0,
        fishBroken: stats.fishBroken,
        fishRecall: stats.fishRecall,
        fishTotal: stats.fishTotal,
        carryItems: stats.carryItems,
        carryRarity: rarity => stats.carryRarity[rarity] || 0,
        lastExtractValue: stats.lastExtractValue,
        carryValue: stats.carryValue,
      };
    };
    const valueOf = (def, data, stat, codex) => {
      const v = values(data, stat, codex);
      if (def.kind === 'searchRarity' || def.kind === 'singleExtractRarity' || def.kind === 'lostRarity' || def.kind === 'insuredRarity' || def.kind === 'fishFirst' || def.kind === 'fishCount' || def.kind === 'carryRarity') return v[def.kind](def.rarity);
      if (def.kind === 'reputation') return v.reputation;
      if (def.kind === 'taskCompleted') return v.taskCompleted(def.taskId);
      return v[def.kind];
    };
    const evaluate = (raw, stat, codex) => {
      const next = normalize(raw), newly = [], valuesMap = {};
      const currentVirginity = stat?.主角?.处女状态;
      if (next.previousVirginity === '是' && currentVirginity === '否') next.stats.virginityLoss = 1;
      if (['是','否'].includes(currentVirginity)) next.previousVirginity = currentVirginity;
      for (const def of defs) {
        const current = valueOf(def, next, stat, codex);
        valuesMap[def.id] = current;
        const ok = def.kind === 'reputation' ? current <= def.target : def.kind === 'coins' ? current > def.target : current >= def.target;
        if (!next.unlocked[def.id] && ok) { next.unlocked[def.id] = true; newly.push(def); }
      }
      return { next, newly, values: valuesMap };
    };
    const pending = raw => defs.filter(def => raw?.unlocked?.[def.id] === true && raw?.claimed?.[def.id] !== true);
    const claim = (raw, id) => {
      const next = normalize(raw), def = defs.find(row => row.id === id);
      if (!def || !next.unlocked[id] || next.claimed[id]) return null;
      next.claimed[id] = true; return { state: next, definition: def };
    };
    return { defs, normalize, merge, reconcile, observeSearch, observeExtraction, observeLoss, observeFishing, observeBottle, evaluate, pending, claim, valueOf };
  })();
  const defaultState = () => ({ version: 19, runContextReceipt: null, achievements: null, fishing:{serial:0,cast:null}, extendedMove:{enabled:false,strategy:'default'}, rules: { keepInventory: false, aiMaleProbability: 50, femaleFutanari: false }, rulesInitialized: false, death: null, lifecycleJournal: null, dialogue: { count: 0, previous: 0, updatedAt: 0 }, itemCounters: {}, insurance: null, insuranceLog: {}, keychain: {}, keyDurability: {}, stashLog: { in: [], out: [] }, winPos: {}, sellBatch: { open: false, list: {}, rarities: [], categories: [] }, tiers: {}, visited: {}, specials: {}, bottleSnapshot: null, lastMap: '', lastArea: '', market: {}, carts: { system: {}, random: {} }, tasks: null, run: null, home: HkmHome.defaults(), stash: {}, notices: { list: [] }, burdenNotified: '正常', gearPending: {}, usePending: [], itemMoves: {}, pins: {}, aiLog: [], debugOpen: false });
  const readFrontendState = () => {
    let stored = null;
    try {
      if (typeof getVariables === 'function') stored = getVariables({ type: 'chat' })?.[stateKey] || null;
    } catch (_) {}
    const result = defaultState();
    if (stored && typeof stored === 'object') {
      Object.assign(result, stored);
      result.version = 19;
      result.home = HkmHome.normalize(stored.home);
      result.codex = HkmCodex.normalize(stored.codex);
      result.achievements = HkmAchievements.normalize(stored.achievements);
      result.rules = {
        keepInventory: stored.rules?.keepInventory === true,
        aiMaleProbability: Number.isInteger(stored.rules?.aiMaleProbability) ? Math.max(0, Math.min(100, stored.rules.aiMaleProbability)) : 50,
        femaleFutanari: stored.rules?.femaleFutanari === true,
      };
      result.rulesInitialized = stored.rulesInitialized === true;
      result.death = stored.death && typeof stored.death === "object" ? stored.death : null;
      result.lifecycleJournal = stored.lifecycleJournal && typeof stored.lifecycleJournal === "object" ? stored.lifecycleJournal : null;
      result.tiers = asObject(stored.tiers);
      result.visited = asObject(stored.visited);
      result.specials = asObject(stored.specials);
      result.bottleSnapshot = stored.bottleSnapshot == null ? null : Number(stored.bottleSnapshot);
      result.lastMap = textOf(stored.lastMap, '');
      result.lastArea = textOf(stored.lastArea, '');
      result.market = asObject(stored.market);
      const carts = asObject(stored.carts);
      result.carts = { fixed: asObject(carts.fixed || carts.system), random: asObject(carts.random), trade:asObject(carts.trade) };
      result.tasks = stored.tasks && typeof stored.tasks === 'object' ? stored.tasks : null;
      result.run = stored.run && typeof stored.run === 'object' ? stored.run : null;
      result.stash = asObject(stored.stash);
      result.stashMigrated = stored.stashMigrated === true;
      const notices = asObject(stored.notices);
      result.notices = { list: Array.isArray(notices.list) ? notices.list.map(line => textOf(line, '')).filter(Boolean) : [] };
      result.burdenNotified = textOf(stored.burdenNotified, '正常');
      const dialogueBox = asObject(stored.dialogue);
      result.dialogue = { count: Math.max(0, aiNum(dialogueBox.count, 0)), previous: Math.max(0, aiNum(dialogueBox.previous, 0)), updatedAt: Math.max(0, aiNum(dialogueBox.updatedAt, 0)) };
      result.itemCounters = asObject(stored.itemCounters);
      result.gearPending = gearPendingOf(stored.gearPending);
      result.usePending = useRecordsOf(stored.usePending);
      result.itemMoves = asObject(stored.itemMoves);
      result.insurance = stored.insurance && typeof stored.insurance === 'object' ? stored.insurance : null;
      result.insuranceLog = asObject(stored.insuranceLog);
      result.containerLedger = asObject(stored.containerLedger);
      result.settleAcks = asObject(stored.settleAcks);
      if (result.run) for (const [key,value] of Object.entries(result.specials)) {
        if (key.startsWith('container:') && value) {
          try {result.containerLedger[containerKey(result.run,key.slice(10))]={phase:'opened'};} catch (_) {}
        }
      }
      result.insuranceLog = mergeDurableState(result,stored).insuranceLog;
      result.keychain = asObject(stored.keychain);
      result.keyDurability = asObject(stored.keyDurability);
      result.stashLog = asObject(stored.stashLog);
      result.winPos = asObject(stored.winPos);
      result.sellBatch = asObject(stored.sellBatch);
      result.pins = asObject(stored.pins);
      result.aiLog = Array.isArray(stored.aiLog) ? stored.aiLog.map(line => textOf(line, '')).filter(Boolean) : [];
      result.debugOpen = stored.debugOpen === true;
      const extended = asObject(stored.extendedMove);
      result.extendedMove = { enabled: extended.enabled === true, strategy: ['default','retaliate_extra','retaliate_round','escape_threat','escape','attack_extra'].includes(textOf(extended.strategy, '')) ? textOf(extended.strategy, '') : 'default' };
    }
    result.codex = HkmCodex.normalize(result.codex);
    result.achievements = HkmAchievements.normalize(result.achievements);
    result.actionPenalty = hkmActionPenaltyOf(result.actionPenalty);
    return HkmSave.migrateGoogle(result);
  };
  const saveFrontendState = (current, allowSend = false) => {
    if(saveFrontendState.drafting)return current;
    if (hkmTurnLocked() && !allowSend) throw Error('等待回复，当前前端已锁定。');
    if (hudReadOnly || !isLatestHudLayer()) throw new Error('旧楼层不能写入聊天状态');
    if(hkm103Scope) HkmSave.assertScope(hkm103Scope);
    if(HkmSave.pending())throw Error('读档尚未完成，请先重试读档。');
    if (typeof getVariables !== 'function' || typeof replaceVariables !== 'function') throw new Error('缺少可整体替换的聊天变量接口');
    const vars={...(getVariables({type:'chat'}) || {})};
    const next=mergeDurableState(current,vars[stateKey]);
    vars[stateKey]=next;
    replaceVariables(vars,{type:'chat'});
    Object.assign(current,next);
    hkm103ScheduleSave();
    return current;
  };
  const hkm095HostContext = () => (window.parent?.SillyTavern || window.SillyTavern)?.getContext?.();
  const hkm095Flush = async () => {
    const context=hkm095HostContext(), chat=context?.chatId;
    if (!chat || typeof context.saveMetadata !== 'function') throw new Error('缺少聊天持久化接口');
    await context.saveMetadata();
    if (hkm095HostContext()?.chatId !== chat) throw new Error('聊天已切换，停止后续结算');
  };
  const hkm095Opened = config => {
    const latest=readFrontendState();
    if (latest.run?.map !== config.map) return true;
    try { return !!containerTransaction(latest,config.id) || !!latest.specials['container:'+config.id]; }
    catch (_) { return true; }
  };


  const gearPendingOf = raw => {
    const result = {};
    for (const [slot, entry] of Object.entries(asObject(raw))) {
      const row = asObject(entry);
      const key = textOf(row.部位, slot);
      const current = textOf(row.当前, '');
      if (!key || !current) continue;
      result[key] = { 部位: key, 当前: current, 原始: textOf(row.原始, '无') || '无' };
    }
    return result;
  };





  const isLatestHudLayer = () => {
    try {
      if(disposed || !env.isCurrent())return false;
      const hostDocument=document, mine=host.closest('.mes');
      if (!mine) return false;
      const id=Number(mine.getAttribute('mesid'));
      const ids=[...hostDocument.querySelectorAll('#chat .mes[is_user="false"]')]
        .map(node=>Number(node.getAttribute('mesid'))).filter(Number.isInteger);
      return isLatestOwner({mine:id,assistantIds:ids});
    } catch (_) { return false; }
  };
  if(isLatestHudLayer() && HkmSave.pending()) {
    try { await HkmSave.recover({check:()=>{if(!isLatestHudLayer())throw Error('楼层已变化，恢复读档停止。');}}); }
    catch(error) {
      const message=hkmCreateElement('p');message.textContent='读档恢复未完成：'+error.message+'。请保持当前对话，解决保存接口问题后重试。';
      const retry=hkmCreateElement('button');retry.textContent='重试读档恢复';retry.type='button';retry.addEventListener('click',()=>env.retry());
      host.replaceChildren(message,retry);return;
    }
  }
  const hkmTurnOrigin = (() => {
    let id;
    try { if (typeof getCurrentMessageId === 'function') id = getCurrentMessageId(); } catch (_) {}
    if (id == null || id === '' || !Number.isInteger(Number(id)) || Number(id) < 0) {
      try { id = window.frameElement?.closest('.mes')?.getAttribute('mesid'); } catch (_) {}
    }
    return id != null && id !== '' && Number.isInteger(Number(id)) && Number(id) >= 0 ? Number(id) : -1;
  })();
  const hkmTurnChat = hkm095HostContext()?.chatId;
  let hkmTurnPhase = 'idle';
  const hkmTurnHasUser = () => {
    const context = hkm095HostContext();
    return hkmTurnOrigin >= 0 && context?.chatId === hkmTurnChat && Array.isArray(context?.chat)
      && context.chat.some((message, index) => index > hkmTurnOrigin && message?.is_user === true);
  };
  const hkmTurnLocked = () => hkmTurnPhase !== 'idle' || hkmTurnHasUser();

  let hudReadOnly = !isLatestHudLayer();
  const state = readFrontendState();


  if (!hudReadOnly && !hkmTurnLocked()) saveFrontendState(state);

  const root = make('section', 'hkm-reset-hud');
  host.replaceChildren(root);
  const head = make('header', 'hkm-reset-head');
  const titleBox = make('div');
  titleBox.append(make('div', 'hkm-reset-title', '哈基米行动 · 单人作战 HUD'));
  const roundLabel = make('div', 'hkm-reset-round');
  head.append(titleBox, roundLabel);
  const toolbar = make('div', 'hkm-reset-toolbar');
  const overviewTab = make('button', 'hkm-reset-tab', '行动概览');
  const taskTab = make('button', 'hkm-reset-tab', '任务与交易');
  overviewTab.type = 'button';
  taskTab.type = 'button';
  const liveStatus = make('div', 'hkm-reset-status', '正在读取干员状态…');
  const searchButton = make('button', 'hkm-reset-search', '搜索');
  searchButton.type = 'button';
  const saveButton=make('button','hkm-reset-tab','存档 / 读档');saveButton.type='button';
  saveButton.addEventListener('click',()=>hkm103SaveUI.open());
  toolbar.append(liveStatus);
  root.append(head, toolbar);

  const body = make('div', 'hkm-reset-body');
  const overviewView = make('div', 'hkm-reset-view');
  const taskView = make('div', 'hkm-reset-view');
  body.append(overviewView, taskView);
  root.append(body);
  const mapPanel = section('地图导航');
  const statePanel = section('当前行动');
  const characterPanel = section('干员面板', '血量与负重', { collapsible: true, open: true });
  const equipmentPanel = section('装备列表', '12 个栏位', { collapsible: true, open: true });
  const enemyPanel = section('当前区域敌人', '视线内的活物');
  const bagPanel = section('携带收藏品', '悬停看详情，列表内可滚轮', { collapsible: true, open: true });

  const sellAllButton = make('button', 'hkm-reset-mini hkm-reset-sellall', '一键售出');
  sellAllButton.type = 'button';
  sellAllButton.title = '批量出售携带收藏品（只在哈基米空间可用；支持按稀有度/类别挑选）';
  sellAllButton.addEventListener('click', hudAction(async () => {
    if (specialBusy) return;
    specialBusy = true;
    try {
      hudOpenBatchWindow(await currentStat());
    } finally {
      specialBusy = false;
    }
  }));
  bagPanel.box.querySelector('.hkm-reset-section-title')?.append(sellAllButton);

    const consoleButton = make('button', 'hkm-reset-mini hkm-reset-sellall', '控制台');
    consoleButton.type = 'button';
    consoleButton.title = '打开控制台：/give <玩家名> <物品ID> <数量> 等指令';
    consoleButton.addEventListener('click', () => hudOpenConsole());
    const keychainButton = make('button', 'hkm-reset-mini hkm-reset-sellall', '钥匙链');
    keychainButton.type = 'button';
    keychainButton.title = '打开钥匙链：装备/卸下钥匙（对局中锁定）';
    keychainButton.addEventListener('click', () => { if (hudReadOnly) { setStatus('这是旧楼层的状态栏，只能查看。'); return; } hudRenderKeychain(currentStatSnapshot || {}); });
    const storeAllButton = make('button', 'hkm-reset-mini hkm-reset-sellall', '一键入库');
    storeAllButton.type = 'button';
    storeAllButton.title = '批量把携带收藏品放进安全屋（只在哈基米空间可用；穿戴中的装备不受影响）';
    storeAllButton.addEventListener('click', hudAction(async () => {
      if (specialBusy) return;
      specialBusy = true;
      try { hudOpenBatchWindow(await currentStat(), { where: '背包', mode: 'store' }); } finally { specialBusy = false; }
    }));
    bagPanel.box.querySelector('.hkm-reset-section-title')?.append(storeAllButton);
    bagPanel.box.querySelector('.hkm-reset-section-title')?.append(keychainButton);
    bagPanel.box.querySelector('.hkm-reset-section-title')?.append(consoleButton);

  const bagStatusBox = make('div', 'hkm-reset-bagstatus');
  const bagListBox = make('div', 'hkm-reset-baglist');
  const scatterBox = make('div', 'hkm-reset-scatter');
  bagPanel.body.append(bagStatusBox, bagListBox, scatterBox);
  const stashPanel = section('安全屋收藏品', '点任意一条打开详情面板', { collapsible: true });

    const stashSellAllButton = make('button', 'hkm-reset-mini hkm-reset-sellall', '一键售出');
    stashSellAllButton.type = 'button';
    stashSellAllButton.title = '批量出售安全屋收藏品（只在哈基米空间可用；支持按稀有度/类别挑选）';
    stashSellAllButton.addEventListener('click', hudAction(async () => {
      if (specialBusy) return;
      specialBusy = true;
      try { hudOpenBatchWindow(await currentStat(), { where: '安全屋', mode: 'sell' }); } finally { specialBusy = false; }
    }));
    stashPanel.box.querySelector('.hkm-reset-section-title')?.append(stashSellAllButton);
  const statsPanel = section('统计信息', '', { collapsible: true });
  const specialPanel = section('特殊交互', '');
  const taskPanel = section('任务列表', '');
  const shopPanel = section('区域商店 / 自由贸易摊位', '商品与摊位');
  const cartPanel = section('购物车', '已选商品');

  const agentRow = make('div', 'hkm-reset-agentrow');
  characterPanel.box.dataset.role = 'agent';
  equipmentPanel.box.dataset.role = 'equipment';
  bagPanel.box.dataset.role = 'bag';
  agentRow.append(characterPanel.box, equipmentPanel.box, bagPanel.box);
  overviewView.append(mapPanel.box, statePanel.box, enemyPanel.box, agentRow, specialPanel.box);
  taskView.append(taskPanel.box, statsPanel.box, stashPanel.box, shopPanel.box, cartPanel.box);
  const empty = text => make('div', 'hkm-reset-empty', text);
  let currentContext = { mapName: '哈基米空间', area: '安全屋', tier: 0 };
  let searchBusy = false;
  let moveBusy = false;
  let launchBusy = false;
  let purchaseBusy = false;
  let specialBusy = false;
  let currentStatSnapshot = {};
  const MONSTER_SEA_SPECIAL_SEARCH_AREAS = new Set(['精液繁殖场', '诡异灵宅', '无底深坑']);


  const areaKey = (mapName, area) => mapName + '::' + area;
  const getMovableAreas = (mapName, area) => {
    const map = GAME_DATA.maps[mapName];
    const grid = Array.isArray(map?.grid) ? map.grid : [];
    let rowIndex = -1;
    let colIndex = -1;
    for (let row = 0; row < grid.length; row += 1) {
      for (let col = 0; col < (Array.isArray(grid[row]) ? grid[row].length : 0); col += 1) {
        if (textOf(grid[row][col]?.name, '') === area) {
          rowIndex = row;
          colIndex = col;
        }
      }
    }
    const result = new Set();
    if (rowIndex < 0 || colIndex < 0) return result;
    if (Array.isArray(map.movementEdges)) {
      for (const edge of map.movementEdges) {
        if (!Array.isArray(edge) || edge.length < 2) continue;
        if (edge[0] === area) result.add(edge[1]);
        if (edge[1] === area) result.add(edge[0]);
      }
      return result;
    }
    for (const [rowDelta, colDelta] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const next = grid[rowIndex + rowDelta]?.[colIndex + colDelta];
      const name = textOf(next?.name, '');
      if (name) result.add(name);
    }
    for (const edge of Array.isArray(map.blockedMovementEdges) ? map.blockedMovementEdges : []) {
      if (!Array.isArray(edge) || edge.length < 2) continue;
      if (edge[0] === area) result.delete(edge[1]);
      if (edge[1] === area) result.delete(edge[0]);
    }
    return result;
  };
  const hkmExtendedMoveState = () => {
    const raw = asObject(state.extendedMove);
    const strategies = ['default','retaliate_extra','retaliate_round','escape_threat','escape','attack_extra'];
    if (!strategies.includes(textOf(raw.strategy, ''))) raw.strategy = 'default';
    raw.enabled = raw.enabled === true;
    state.extendedMove = raw;
    return raw;
  };
  const hkmTwoStepTargets = (mapName, area) => {
    const out = new Map();
    for (const hop of getMovableAreas(mapName, area)) {
      for (const target of getMovableAreas(mapName, hop)) {
        if (target && target !== area && !getMovableAreas(mapName, area).has(target) && !out.has(target)) out.set(target, hop);
      }
    }
    return out;
  };
  const hkmTwoStepPath = (mapName, fromArea, targetArea) => {
    const hop = hkmTwoStepTargets(mapName, fromArea).get(targetArea);
    return hop ? [fromArea, hop, targetArea] : null;
  };

  const randomInt = range => {
    const values = Array.isArray(range) ? range : [range, range];
    const min = Math.ceil(Number(values[0]) || 0);
    const max = Math.floor(Number(values[1] ?? values[0]) || min);
    return min + Math.floor(Math.random() * Math.max(1, max - min + 1));
  };
  const enemyRecord = (name, hp, attack, defense, speed, description, source) => ({
    名称: name,
    血量: String(hp) + '/' + String(hp),
    攻击力: attack,
    防御力: defense,
    速度: speed,
    状态: '待处理',
    描述: description,
    来源: source,
  });
  const buildNpcEncounter = (rule, count) => {
    const enemies = [];
    for (let index = 0; index < count; index += 1) {
      const label = count > 1 ? rule.name + ' ' + (index + 1) : rule.name;
      enemies.push(enemyRecord(label, rule.hp, rule.attack, rule.defense, rule.speed, (rule.attitude ? '态度：' + rule.attitude + '。' : '') + textOf(rule.description, ''), '地图NPC'));
    }
    for (let index = 0; index < Number(rule.companions || 0); index += 1) {
      enemies.push(enemyRecord('安保队员 ' + (index + 1), 6, 4, 0, 6, '随安保队长一同出现的安保队员。', '地图NPC伴随'));
    }
    return enemies;
  };
  const pickNpcRule = rules => {
    let cursor = 0;
    const roll = Math.random();
    for (const rule of Array.isArray(rules) ? rules : []) {
      cursor += Number(rule.chance || 0);
      if (roll < cursor) return rule;
    }
    return null;
  };
  const rollMonsterSeaNpc = targetArea => {
    const config = GAME_DATA.encounters?.npc?.['魔鬼海'];
    const map = GAME_DATA.maps?.['魔鬼海'];
    if (!config || !map || config.excludedGenericAreas?.includes(targetArea)) return [];
    if (targetArea === '安康鱼巢穴') {
      if (Math.random() < Number(config.anglerDen?.chance || 0)) {
        const boss = config.anglerDen?.boss;
        return boss ? buildNpcEncounter(boss, Number(boss.count || 1)) : [];
      }
      const fallback = pickNpcRule(config.abyss);
      return fallback ? buildNpcEncounter(fallback, 1) : [];
    }
    const special = config.special?.[targetArea];
    if (Array.isArray(special)) return special.flatMap(rule => buildNpcEncounter(rule, Number(rule.count || 1)));
    let group = '';
    for (const name of ['浅海区域', '深海区域', '渊海区域']) {
      if (map.areaGroups?.[name]?.includes(targetArea)) group = name;
    }
    const rules = group === '浅海区域' ? config.shallow : group === '深海区域' ? config.deep : group === '渊海区域' ? config.abyss : [];
    const picked = pickNpcRule(rules);
    return picked ? buildNpcEncounter(picked, 1) : [];
  };
  const hudAreaEnemyRows = (mapName, area, stat) => {
    const rows = state.run && state.run.map === mapName
      ? aiEnemiesWithMonsters(mapName, area, stat).map(row => [textOf(row.record?.名称, ''), row.record])
      : entriesOf(stat?.敌人);
    return rows.filter(([, item]) => {
      const name = textOf(item?.名称 ?? item?.姓名, '');
      const rawHp = textOf(item?.血量, '');
      const hp = rawHp ? Number(rawHp.split('/')[0]) : NaN;
      return name && name !== '无' && (!Number.isFinite(hp) || hp > 0)
        && textOf(item?.离开区域, '否') !== '是' && !/^(死亡|已死亡|阵亡|已阵亡)$/.test(textOf(item?.状态, ''));
    });
  };
  const readAreaEncounter = (mapName, area, stat) => ({
    mapName, area,
    enemies: hudAreaEnemyRows(mapName, area, stat).map(([, record]) => record),
  });
  const formatEncounterLines = encounter => {
    const lines = ['当前区域敌人（' + encounter.mapName + ' / ' + encounter.area + '）：'];
    if (!encounter.enemies.length) return [...lines, '无。'];
    for (const [index, enemy] of encounter.enemies.entries()) {
      lines.push((index + 1) + '. ' + textOf(enemy.名称 ?? enemy.姓名, '未知敌人')
        + '；血量 ' + textOf(enemy.血量, '未知') + '；攻击力 ' + textOf(enemy.攻击力, '0')
        + '；防御力 ' + textOf(enemy.防御力, '0') + '；速度 ' + textOf(enemy.速度, '0')
        + '；状态 ' + textOf(enemy.状态, '待处理')
        + (enemy.来源 === '其他玩家' ? '' : '；' + textOf(enemy.描述, '')));
    }
    return lines;
  };
  const hudPlayerName = stat => textOf(asObject(stat).主角?.姓名, '') || '{{user}}';
  let hkm095QueueSerial=0;
  const sendFrontendUserMessage = async (message, payload, options = {}) => {
    hkm098RequireAlive();
    await hkm154SyncBattle(await currentStat());
    if (hudReadOnly) throw new Error('这是旧楼层的状态栏，只能查看；操作请用最新一条消息里的状态栏。');



    const HKM_QUEUE_ONLY_ACTIONS = ['purchase', 'monster_sea_deep_shell', 'key_container', 'monster_sea_cave_altar', 'monster_sea_special_search', 'monster_sea_bottle'];
    if (HKM_QUEUE_ONLY_ACTIONS.includes(textOf(payload?.action, ''))) {
      const recordKey=payload.action==='key_container'
        ? 'key_container:'+containerKey(readFrontendState().run,payload.containerId)
        : payload.action+':'+Date.now()+':'+(++hkm095QueueSerial);
      queueSettleRecord(recordKey,String(message || '').replace(/\s*\n+\s*/g,'；'));
      await hkm095Flush();
      setStatus('操作完成。');
      return { queued: true };
    }
    if (typeof createChatMessages !== 'function' || typeof triggerSlash !== 'function') throw new Error('酒馆助手消息接口不可用');
    await hkm160PrepareSend();
    const pendingNotices = Array.isArray(state.notices?.list) ? state.notices.list.slice() : [];
    if (pendingNotices.length) message = String(message).replace(/\s*$/, '') + '\n\n' + [...new Set(pendingNotices)].join('\n');
    let prepared;
    let created = false;
    hkmTurnPhase = 'sending';
    hkmTurnSyncUI();
    setFrontendMessageSendGuard(true);
    try {
      hkm098AssertOwner(false, true);
      saveFrontendState(state, true);
      await hkm095Flush();
      hkm098AssertOwner(false, true);
      prepared = preparePendingQuestAttachment(message, options.additionalTasks, true, options.coveredSettlementIds, await currentStat(), payload?.action || 'records');
      await createChatMessages([{ role: 'user', message: prepared.message, data: { hkm_frontend: payload } }]);
      created = true;
      hkmTurnPhase = 'sent';
      hkmTurnSyncUI();
      hkm098AssertOwner(false, true);
      for (const notice of pendingNotices) { const index=state.notices.list.indexOf(notice); if (index>=0) state.notices.list.splice(index,1); }
      saveFrontendState(state, true);
      finalizePendingQuestAttachment(prepared.consumedPendingIds,prepared.consumedGearSlots,prepared.consumedUseIds,prepared.consumedMoveNames,prepared.consumedInsuranceKeys,prepared.consumedInsuranceSnapshot, true, prepared.consumedActionSnapshot, prepared.consumedBagSnapshot, prepared.consumedRunContext);
      await hkm095Flush();
      hkm098AssertOwner(false, true);
      try { await triggerSlash('/trigger'); }
      catch(error) { throw Object.assign(Error('消息已创建，但生成未启动：'+error.message+'；请在原聊天继续生成，无需再次执行已结算操作。'), {messageCreated:true}); }
      return {created:true,triggered:true};
    } catch (error) {
      if (!created && hkmTurnHasUser()) created = true;
      if (created) error.messageCreated = true;
      throw error;
    } finally {
      hkmTurnPhase = created ? 'sent' : 'idle';
      setFrontendMessageSendGuard(false);
      hkmTurnSyncUI();
    }
  };
  const launchMission = async mission => {
    if (launchBusy || moveBusy || searchBusy || specialBusy || purchaseBusy) return;
    hkm098RequireAlive();
    const configured = (GAME_DATA.missionLaunches || []).find(row => row.map === mission?.map);
    if (!configured) throw Error('远征入口没有对应地图。');
    launchBusy = true;
    try {
      const latest = await currentStat(); hkm098RequireAlive();
      if (latest.场景?.地图 !== '哈基米空间' || state.run) return;
      hkmFishingEntry(latest);
      const coins = aiMoney(latest), cost = Math.max(0, aiNum(configured.cost, 0));
      const homeCredit=HkmHome.normalize(state.home).cats.temporary*50;
      if (coins+homeCredit < cost) throw Error('进入' + configured.map + '需要 ' + cost + ' 哈基币，当前可用 ' + (coins+homeCredit) + '。');
      const draft = hudDraftMission(latest, configured.map);
      const tasks = normalizeQuestState(state.tasks);
      const runKey = Math.max(0, Math.floor(aiNum(latest.统计信息?.历史对局总数,0))) + ':' + configured.map;
      tasks.battle = { runKey, map:configured.map, rolledIds:rollBattleTasks(questCatalog, configured.map).map(task=>task.id) };
      const autoTasks = tasks.battle.rolledIds.map(id=>questById.get(id)).filter(task=>task?.autoAccept && questUnlockSatisfied(task, latest, {mapName:configured.map,area:''}));
      const acceptedQuestPatch = questAcceptancePatch(latest, autoTasks);
      const log = hudPlayerName(latest) + '选择进入' + configured.map + '地图，开始了一场新的游戏对局。';
      await hkm098Transact(hkm098RunId(draft.run)+':entry', {
        ...acceptedQuestPatch,
        场景:{...asObject(latest.场景),地图:configured.map,区域:draft.area,剩余交互轮数:String(draft.run.rounds),剩余水下行动值:String(draft.run.water || 0),水下机制版本:1,行动结算消息:mvuMessageId(),是否战斗中:false},
        统计信息:{...asObject(latest.统计信息),哈基币:coins-cost}, 主角:draft.hero, 敌人:draft.enemies, 散落物品:draft.scatter,
      }, {run:draft.run,tasks,tiers:{},visited:{[areaKey(configured.map,draft.area)]:true},specials:{},lastMap:configured.map,lastArea:draft.area}, log);
      await refresh();
      const lines = [textOf(state.insuranceLog[hkm098RunId(draft.run)+':entry'],log)];
      try {
        await sendFrontendUserMessage(lines.join('\n'), {action:'join_mission',map:configured.map,cost,balanceBefore:coins,balanceAfter:aiMoney(await currentStat()),spawn:draft.area,runSize:draft.run.players.length+1,autoAcceptedQuestIds:autoTasks.map(task=>task.id)}, {coveredSettlementIds:[hkm098RunId(draft.run)+':entry']});
        setStatus('已进入'+configured.map+'·'+draft.area+'。');
      } catch(error) { setStatus('入局已完成：'+error.message+(error.messageCreated ? '' : '；入局记录与任务保留在待发队列。')); }
    } finally { launchBusy=false; await refresh(); }
  };

  const moveTo = async (mapName, fromArea, targetArea) => {
    hkm098RequireAlive();
    if (specialBusy || purchaseBusy || launchBusy || moveBusy || hudReadOnly || mapName !== currentContext.mapName || fromArea !== currentContext.area) return;
    const movable = getMovableAreas(mapName, fromArea);
    const extendedConfig = hkmExtendedMoveState();
    const directMove = movable.has(targetArea);
    const path = directMove ? [fromArea, targetArea] : (extendedConfig.enabled ? hkmTwoStepPath(mapName, fromArea, targetArea) : null);
    if (!path) {
      setStatus('只能移动到当前区域的相邻节点；拓展移动需先启用。');
      return;
    }
    const extendedMove = path.length === 3;
    const quietMove = extendedConfig.enabled && directMove;
    moveBusy = true;
    try {
    updateSearchButton();
    const stat = await currentStat();
    const hopArea = extendedMove ? path[1] : null;
    const targetKey = areaKey(mapName, targetArea);


    await hudSettleCombatFlag(stat);

    const isNewArea = !state.visited[targetKey];
    const isMission = textOf(GAME_DATA.maps?.[mapName]?.kind, '') === 'mission';
    const runActive = isMission && state.run && state.run.map === mapName;
    if (hkm139LootEscape(stat)) {
      await hkm139BlockedEscape(stat);
      await sendFrontendUserMessage('', { action:'blocked_escape', map:mapName, from:fromArea, to:fromArea, attemptedTo:targetArea, escape:{ok:false,blockedByLoot:true} });
      setStatus('开溜失败，仍停留在 ' + fromArea + '。');
      return;
    }
    const useEscape = runActive && hudInCombat(stat) && hkm142EscapeTargets(stat).length > 0 && (!extendedMove || ['escape_threat','escape'].includes(extendedConfig.strategy));
    const escape = useEscape ? { ...(await hudEscape(stat, mapName, fromArea, targetArea)), from: fromArea, to: targetArea } : null;
    let arrived = !escape || escape.ok;
    let destination = arrived ? targetArea : fromArea, spent = null, moveBlocked = false;

    let encounter;
    let caveResult = [];
    const lines = [hudPlayerName(stat) + (escape ? '选择逃离' + fromArea + '，前往' : '选择前往') + targetArea + '。', ''];
    if (extendedMove) lines.push('拓展移动路径：' + fromArea + ' → ' + hopArea + ' → ' + targetArea + '；消耗2轮交互。', '');
    if (quietMove) lines.push('静步移动：不产生可传递脚步声。', '');
    if (escape) lines.push(...hudEscapeLines(escape), '');






    let tradeMarket = null;
    if (mapName === '哈基米空间' && targetArea === TRADE_AREA) ensureTradeMarket(stat);
      let movePatch = {};
      let moveSettlementId;
      if (runActive) {
        let resolved = null;
        if (arrived && extendedMove && hopArea) {
          const intermediateStat = await currentStat();
          const intermediate = aiResolveTurn(mapName, {
            mode: 'extended_move',
            heroFrom: fromArea,
            heroTo: hopArea,
            area: hopArea,
            stat: intermediateStat,
            passiveOnly: true,
            quiet: false,
          });
          destination = intermediate.heroArea || hopArea;
          moveBlocked = intermediate.heroMoveBlocked === true;
          if (moveBlocked) resolved = intermediate;
          else {
          lines.push('中间区域所见所得（' + hopArea + '）：', ...aiObservedLines(intermediate?.observed, hopArea));
          const intermediateEncounter = readAreaEncounter(mapName, hopArea, { ...intermediateStat, 敌人: aiEnemyPatch(mapName, hopArea, await currentStat()).敌人, 场景:{...asObject(intermediateStat.场景),地图:mapName,区域:hopArea} });
          lines.push('', ...formatEncounterLines(intermediateEncounter));
          if (Array.isArray(state.aiLog) && state.aiLog.length) lines.push('', '中间区域战斗日志：', ...state.aiLog.slice(-8).map(line => '· ' + line));
          const intermediateCombat = hkmExtendedMoveCombat(intermediateStat, mapName, hopArea, extendedConfig.strategy, lines);
          if(intermediateCombat.heroPatch)await hudCommit(intermediateCombat.heroPatch);
          if (intermediateCombat.extraCombat) {
            const extra = aiResolveTurn(mapName, {
              mode: 'extended_move',
              heroFrom: hopArea,
              heroTo: hopArea,
              area: hopArea,
              stat: await currentStat(),
              passiveOnly: true,
              quiet: false,
              noticeMode: 'combat',
            });
            lines.push('额外战斗判定：', ...aiObservedLines(extra?.observed, hopArea));
          }
          resolved = aiResolveTurn(mapName, {
            mode: 'move',
            heroFrom: hopArea,
            heroTo: arrived ? targetArea : fromArea,
            area: arrived ? targetArea : fromArea,
            stat: await currentStat(),
            quiet: false,
          });
          }
        } else {
          resolved = aiResolveTurn(mapName, {
            mode: 'move',
            heroFrom: fromArea,
            heroTo: arrived ? targetArea : fromArea,
            area: arrived ? targetArea : fromArea,
            stat: await currentStat(),
            quiet: quietMove,
            noticeMode: quietMove ? (hudInCombat(stat) ? 'combat' : 'quiet') : '',
          });
        }
        destination = resolved?.heroArea || destination;
        moveBlocked ||= resolved?.heroMoveBlocked === true;
        arrived = destination === targetArea;
        const patch = aiEnemyPatch(mapName, destination, await currentStat());
        if (resolved?.scatter) patch.散落物品 = resolved.scatter;
        Object.assign(patch, resolved?.heroPatch || {});
        movePatch = patch;
        lines.push(...aiObservedLines(resolved?.observed, destination));


        {
          const rows = aiAlive().filter(player => player.region === destination && aiCanSee('hero', player)).map(aiEnemyRecord);
          if (rows.length) lines.push('', '同区域玩家：', ...rows.map(row => '· ' + row.名称 + '｜' + row.血量 + '｜攻' + row.攻击力 + '｜防' + row.防御力 + '｜速' + row.速度 + '｜' + row.描述));
        }
      }




      spent = runActive ? await hudSpendRounds(stat, mapName, destination, extendedMove ? 1 : 0, { costArea: fromArea, skipAiOnDeath: true }) : null;
      if (spent) lines.push(hudRoundSpendText(spent), '');
      if (arrived && mapName === '魔鬼海' && targetArea === '神秘洞穴' && isNewArea && !state.specials['monsterSea.caveAltar']) caveResult = resolveCaveAltar();
      if (caveResult.length) lines.push('', ...formatLootActionLines('神秘洞穴首次进入·石台刷新', caveResult, []));
      {
        const freshScene = await currentStat();
        const cavePatch = hudExchangePatch({...freshScene,...movePatch},[],caveResult,'背包');
        encounter = readAreaEncounter(mapName, destination, {...freshScene,...movePatch,场景:{...asObject(freshScene.场景),地图:mapName,区域:destination}});
        lines.push('', ...formatEncounterLines(encounter));
        const log = lines.filter(Boolean).join('；');
        moveSettlementId='move:'+Date.now()+':'+(++hkm095QueueSerial);
        await hkm098Transact(moveSettlementId, {...movePatch,...cavePatch,场景:{...asObject(freshScene.场景),地图:mapName,区域:destination,是否战斗中:moveBlocked ? aiAlive().some(player => player.region === destination && !aiPeaceful(player.id, 'hero') && player.mode === 'fight') || hudCombatFlagOn(freshScene) : arrived ? false : hudCombatFlagOn(freshScene)}}, {run:HkmLifecycle.copy(state.run),visited:{...state.visited,...(arrived ? {[targetKey]:true} : {})},specials:{...state.specials,...(caveResult.length ? {'monsterSea.caveAltar':true} : {})}}, log);
        await refresh();
        currentStatSnapshot = null;
      }
      if (arrived) state.visited[targetKey] = true;
      if (caveResult.length) state.specials['monsterSea.caveAltar'] = true;
      saveFrontendState(state);
      await sendFrontendUserMessage(wrapMoveEncounterMessage(lines.join('\n')), { action: 'move', map: mapName, from: fromArea, to: destination, attemptedTo: targetArea, movementBlocked: moveBlocked, encounter: encounter.enemies, escape: escape ? { ok: escape.ok, chance: escape.chance, advantage: escape.advantage } : null, rounds: spent ? { cost: spent.cost, left: spent.rounds, cap: spent.cap, costArea: spent.costArea, refill: !!spent.arrivingOxygen } : null, extendedMove: extendedMove ? { enabled:true, path, hop:hopArea, strategy:extendedConfig.strategy, quiet:false } : (quietMove ? { enabled:true, path, quiet:true, strategy:extendedConfig.strategy } : null), specialLoot: caveResult.map(modelBriefResultPayload), tradeMarket }, {coveredSettlementIds:[moveSettlementId]});
      setStatus(spent?.dead ? '水下缺氧，生命值归零。' : arrived ? '已移动到 ' + targetArea + '。' : moveBlocked ? '迎面相遇，停留在 ' + destination + '。' : '逃脱失败，仍停留在 ' + destination + '。');
    } catch (error) {
      setStatus('移动消息未能发送：' + (error?.message || error));
    } finally {
      moveBusy = false;
      updateSearchButton();
      await refresh();
    }
  };

  const setStatus = text => { liveStatus.textContent = (hkmTurnLocked() ? '等待回复 · 当前前端已锁定。' : '') + textOf(text, ''); };
  const hkmTurnSyncUI = () => {
    const locked = hkmTurnLocked();
    for(const node of [host,hkmPortal])node.classList.toggle('hkm-turn-locked',locked);
    root.inert = locked;
    root.dataset.awaitingReply = String(locked);
    root.setAttribute('aria-busy', String(locked));
    if (locked && !liveStatus.textContent.startsWith('等待回复')) setStatus('');
  };
  const hkmTurnGuard = event => {
    if (!hkmTurnLocked() || !hkmOwnTarget(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    hkmTurnSyncUI();
  };
  for (const type of ['click', 'pointerdown', 'keydown', 'input', 'change', 'submit']) {
    document.addEventListener(type, hkmTurnGuard, true);
    disposers.push(() => document.removeEventListener(type, hkmTurnGuard, true));
  }

  const getTier = (mapName, area, map) => {
    const key = `${mapName}::${area}`;
    if (Object.prototype.hasOwnProperty.call(state.tiers, key)) return Math.max(0, Number(state.tiers[key]) || 0);
    return Math.max(0, Number(map?.tiers?.[area] ?? 0) || 0);
  };
  const HUD_TIER_LABEL = { 0: '低价值区域', 1: '低价值区域', 2: '一般区域', 3: '中价值区域', 4: '高价值区域', 5: '宝藏区域', 6: '皇冠区域' };
  const hudAreaNote = (mapName, area) => {
    const map = asObject(GAME_DATA.maps?.[mapName]);
    const tier = Math.max(0, aiNum(map?.tiers?.[area], 0));
    const extract = Array.isArray(map?.extractAreas) && map.extractAreas.includes(area);
    if (extract) return '撤离点 · ' + (HUD_TIER_LABEL[tier] || '低价值区域');
    if (textOf(map?.kind, '') !== 'mission') {
      const desc = textOf(asObject(map?.areaDescriptions)[area], '');
      const short = desc.split(/[，。;；]/)[0] || '';
      return short.slice(0, 14) || '安全区';
    }
    return HUD_TIER_LABEL[tier] || '低价值区域';
  };
  const hudRenderTokens = new WeakMap();
  const hudRenderChanged = (node, data) => {
    const token=JSON.stringify(data);
    if (hudRenderTokens.get(node) === token && node.childNodes.length) return false;
    hudRenderTokens.set(node,token); return true;
  };
  const hkmExtendedMoveCombat = (stat, mapName, area, strategy, lines) => {
    const players = aiAlive().filter(player => player.region === area && !hkm139Friendly(player));
    const npcs = aiNpcsAlive().filter(npc => npc.region === area && !hkm139NpcFriendly(npc));
    const targets = [...players.map(player => ({ kind: 'player', target: player, threat: hkm139PlayerThreat(player) })), ...npcs.map(npc => ({ kind: 'npc', target: npc, threat: aiNum(npc.threat, 0) }))].sort((left, right) => right.threat - left.threat);
    if (!targets.length) return { targets: 0, extraCombat: false };
    const primary = targets[0];
    if (strategy === 'escape_threat' && primary.threat <= 3) {
      lines.push('中间区域存在低威胁目标，按逃跑判定继续移动。');
      return { targets: targets.length, escaped: true, extraCombat: false };
    }
    if (strategy === 'escape') {
      lines.push('中间区域存在目标，按逃跑判定继续移动。');
      return { targets: targets.length, escaped: true, extraCombat: false };
    }
    if (strategy === 'default') {
      lines.push('中间区域存在目标，但拓展移动未主动攻击。');
      return { targets: targets.length, extraCombat: false };
    }
    const hero = asObject(stat?.主角);
    const damage = hkm163HeroHit(stat,primary.target,mapName,area);
    const killed = primary.target.hp <= 0;
    lines.push((strategy === 'attack_extra' ? '主动攻击' : '受到攻击后还击') + textOf(primary.target.name, '目标') + '，造成' + damage + '点伤害' + (killed ? '并击杀。' : '。'));
    if (killed) {
      if (primary.kind === 'player') { HkmFishing.recordKill(state.run, primary.target.id, 'hero', true); aiKillPlayer(mapName, primary.target, '被主角击杀'); }
      else aiNpcKill(primary.target, false, 'hero');
    }
    return { targets: targets.length, target: primary.target.name, damage, killed, heroPatch:{主角:stat.主角}, extraCombat: !killed && ['retaliate_extra', 'attack_extra'].includes(strategy) };
  };

  const extendedMoveOptions = [
    ['default', '受到攻击时顺利移动'],
    ['retaliate_extra', '受到攻击时还击后再进行一轮额外战斗判定'],
    ['retaliate_round', '受到攻击时还击，不进行额外战斗判定，只消耗一轮交互轮数'],
    ['escape_threat', '受到攻击时威胁等级小于等于3则继续移动'],
    ['escape', '受到攻击时继续移动'],
    ['attack_extra', '主动攻击对方并再进行一轮额外战斗判定'],
  ];
  const extendedMoveCard = make('div', 'hkm-reset-extended-move');
  const extendedMoveToggle = make('button', 'hkm-reset-extended-toggle', '✓');
  extendedMoveToggle.type = 'button';
  extendedMoveToggle.setAttribute('aria-label', '启用拓展移动');
  const extendedMoveLabel = make('span', 'hkm-reset-extended-label', '拓展移动');
  const extendedMoveGear = make('button', 'hkm-reset-extended-gear', '⚙');
  extendedMoveGear.type = 'button';
  extendedMoveGear.setAttribute('aria-label', '拓展移动配置');
  extendedMoveGear.setAttribute('aria-expanded', 'false');
  extendedMoveGear.title = '拓展移动配置';
  const extendedMoveOptionsBox = make('div', 'hkm-reset-extended-options');
  extendedMoveOptionsBox.setAttribute('role', 'menu');
  extendedMoveOptionsBox.hidden = true;
  const extendedMoveInputs = new Map();
  for (const [value, label] of extendedMoveOptions) {
    const row = make('label', 'hkm-reset-extended-option');
    row.setAttribute('role', 'menuitemradio');
    const input = make('input');
    input.type = 'radio';
    input.name = 'hkm-extended-move-strategy-' + Math.random().toString(36).slice(2);
    input.value = value;
    row.append(input, make('span', '', label));
    extendedMoveOptionsBox.append(row);
    extendedMoveInputs.set(value, input);
    input.addEventListener('change', () => {
      if (!input.checked) return;
      hkmExtendedMoveState().strategy = value;
      saveFrontendState(state);
      renderExtendedMoveCard();
    });
  }
  extendedMoveCard.append(extendedMoveToggle, extendedMoveLabel, extendedMoveGear);
  const extendedMoveSlot = make('div', 'hkm-reset-extended-slot');
  extendedMoveSlot.append(extendedMoveCard, extendedMoveOptionsBox);
  extendedMoveToggle.addEventListener('click', () => {
    const next = hkmExtendedMoveState();
    next.enabled = !next.enabled;
    saveFrontendState(state);
    renderExtendedMoveCard();
    renderState(currentStatSnapshot || {}, currentContext.mapName, currentContext.area, currentContext.tier);
    renderMap(currentContext.mapName, currentContext.area);
  });
  extendedMoveGear.addEventListener('click', () => {
    extendedMoveOptionsBox.hidden = !extendedMoveOptionsBox.hidden;
    extendedMoveGear.setAttribute('aria-expanded', String(!extendedMoveOptionsBox.hidden));
    if (!extendedMoveOptionsBox.hidden) extendedMoveInputs.get(hkmExtendedMoveState().strategy)?.focus?.();
  });
  const renderExtendedMoveCard = () => {
    const config = hkmExtendedMoveState();
    extendedMoveCard.classList.toggle('is-enabled', config.enabled);
    extendedMoveToggle.setAttribute('aria-pressed', String(config.enabled));
    for (const [value, input] of extendedMoveInputs) input.checked = config.strategy === value;
  };
  renderExtendedMoveCard();

  const renderMap = (mapName, area) => {
    const extendedConfig = hkmExtendedMoveState();
    if (!hudRenderChanged(mapPanel.body,[mapName,area,moveBusy,launchBusy,hudReadOnly,currentStatSnapshot?.统计信息?.哈基币,state.home?.cats,extendedConfig.enabled])) return;
    clear(mapPanel.body);
    const map = GAME_DATA.maps[mapName] || GAME_DATA.maps['哈基米空间'];
    const intro = make('div', 'hkm-reset-small', textOf(map.intro, '当前地图没有额外说明。'));
    mapPanel.body.append(intro);
    const purpose = textOf(asObject(map.areaDescriptions)[area], '');
    if (purpose) mapPanel.body.append(make('p', 'hkm-reset-area-purpose', purpose));
    mapPanel.body.append(make('div', 'hkm-reset-divider'));
    if (!Array.isArray(map.grid)) {
      mapPanel.body.append(empty('当前地图没有可显示的导航数据。'));
      return;
    }
    const movable = getMovableAreas(mapName, area);
    const extendedTargets = extendedConfig.enabled ? hkmTwoStepTargets(mapName, area) : new Map();
    const grid = make('div', 'hkm-reset-map');
    for (const row of map.grid) {
      const rowNode = make('div', 'hkm-reset-map-row');
      rowNode.style.gridTemplateColumns = 'repeat(' + Math.max(1, row.length) + ',minmax(108px,1fr))';
      rowNode.style.minWidth = Math.max(360, row.length * 114) + 'px';
      for (const nodeData of row) {
        const node = make('button', 'hkm-reset-map-node');
        node.type = 'button';
        const nodeName = textOf(nodeData.name, '未知区域');
        const tier = Number(nodeData.tier) || 0;
        const isCurrent = nodeName === area;
        const isExtended = !isCurrent && !movable.has(nodeName) && extendedTargets.has(nodeName);
        const canMove = !isCurrent && (movable.has(nodeName) || isExtended) && !moveBusy && !hudReadOnly;
        node.dataset.current = String(isCurrent);
        node.dataset.movable = String(canMove);
        node.dataset.extended = String(isExtended);
        node.dataset.tier = String(tier);
        node.disabled = !canMove;
        const nodePurpose = textOf(asObject(map.areaDescriptions)[nodeName], '');
        node.title = (isCurrent ? '当前区域' : (isExtended ? '点击拓展移动到 ' + nodeName : (canMove ? '点击移动到 ' + nodeName : '仅当前区域的相邻节点可移动'))) + (nodePurpose ? '\n' + nodePurpose : '');
        node.append(make('span', 'hkm-reset-map-node-label', nodeName), make('span', 'hkm-reset-map-node-tier', hudAreaNote(mapName, nodeName)));
        node.addEventListener('click', () => { if (canMove) void moveTo(mapName, area, nodeName).catch(error=>setStatus(error.message)); });
        rowNode.append(node);
      }
      grid.append(rowNode);
    }
    mapPanel.body.append(grid);
    if (mapName === '哈基米空间') {
      const rail = make('div', 'hkm-reset-expedition-rail');
      rail.append(make('div', 'hkm-reset-expedition-title', '远征入口'));
      const buttons = make('div', 'hkm-reset-expedition-actions');
      const stats = asObject(currentStatSnapshot?.统计信息);
      const homeCredit=HkmHome.normalize(state.home).cats.temporary*50;
      const coins = (Number(stats.哈基币) || 0)+homeCredit;
      if(homeCredit)rail.append(make('div','hkm-reset-small','本次入局可用 '+coins+' 哈基币（含猫娘转换 '+homeCredit+'）'));
      for (const mission of GAME_DATA.missionLaunches || []) {
        const cost = Math.max(0, Number(mission.cost) || 0);
        const allowed = coins >= cost && !moveBusy && !launchBusy && !hudReadOnly;
        const button = make('button', 'hkm-reset-expedition-button hkm-reset-expedition-' + textOf(mission.theme, 'google'));
        button.type = 'button';
        button.disabled = !allowed;
        button.title = allowed ? ('点击加入' + mission.map + '；入局消耗：' + cost + '哈基币') : ('入局消耗：' + cost + '哈基币；当前余额不足（' + coins + '）');
        button.append(make('span', 'hkm-reset-expedition-name', mission.map), make('span', 'hkm-reset-expedition-cost', '入局消耗 ' + cost + ' 哈基币'));
        button.addEventListener('click', () => { if (allowed) void launchMission(mission).catch(error=>setStatus(error.message)); });
        buttons.append(button);
      }
      rail.append(buttons);
      mapPanel.body.append(rail);
    }
  };

  const renderState = (stat, mapName, area, tier) => {
    const extendedConfig = hkmExtendedMoveState();
    if (!hudRenderChanged(statePanel.body,[mapName,area,tier,stat.场景,extendedConfig.enabled,extendedConfig.strategy])) return;
    clear(statePanel.body);
    const scene = asObject(stat.场景);
    const grid = make('div', 'hkm-reset-grid hkm-reset-state-grid');
    renderExtendedMoveCard();
    grid.append(hkmMapToggle,field('地图', mapName), field('区域', area), extendedMoveSlot, field('当前价值等级', tier), field('剩余交互轮数', scene.剩余交互轮数),searchButton);
    statePanel.body.append(grid);
  };

  const hudBar = (label, now, max, tone, extra = '') => {
    const safeMax = Math.max(1, aiNum(max, 1));
    const value = Math.max(0, aiNum(now, 0));
    const ratio = value / safeMax;
    const bar = make('div', 'hkm-reset-bar');
    bar.dataset.tone = tone;
    const head = make('div', 'hkm-reset-bar-head');
    head.append(
      make('span', '', label + (extra ? '（' + extra + '）' : '')),
      make('b', '', (Math.round(value * 10) / 10) + ' / ' + (Math.round(safeMax * 10) / 10) + ' · ' + Math.round(ratio * 100) + '%'),
    );
    const track = make('div', 'hkm-reset-bar-track');
    const fill = make('div', 'hkm-reset-bar-fill');
    fill.style.width = Math.max(2, Math.min(100, ratio * 100)) + '%';
    track.append(fill);
    bar.append(head, track);
    return bar;
  };
  const renderCharacter = stat => {
    if (!hudRenderChanged(characterPanel.body,stat.主角)) return;
    clear(characterPanel.body);
    const actor = asObject(stat.主角);
    const who = make('div', 'hkm-reset-small', textOf(actor.姓名, '主角') + (textOf(actor.性别, '') ? ' · ' + textOf(actor.性别, '') : ''));
    who.style.marginBottom = '7px';
    characterPanel.body.append(who);
    const hpNow = aiNum(actor.当前血量, 0);
    const hpMax = Math.max(1, aiNum(actor.血量上限, 1));
    const loadNow = aiNum(actor.当前负重, 0);
    const loadMax = Math.max(1, aiNum(actor.负重上限, 1));
    const hpRatio = hpNow / hpMax;
    const loadRatio = loadNow / loadMax;
    const bars = make('div', 'hkm-reset-bars');
    bars.append(hudBar('血量', hpNow, hpMax, hpRatio >= 0.6 ? 'hp-good' : (hpRatio >= 0.3 ? 'hp-mid' : 'hp-low')));
    bars.append(hudBar('负重', loadNow, loadMax, loadRatio > 1 ? 'load-over' : (loadRatio >= 0.8 ? 'load-near' : 'load-good'), loadRatio > 1 ? '已超重' : (loadRatio >= 0.8 ? '接近上限' : '')));
    characterPanel.body.append(bars);
    const chips = make('div', 'hkm-reset-chips');
    for (const [label, value] of [['攻击', actor.攻击力], ['防御', actor.防御力], ['速度', actor.速度], ['水下行动值上限', HkmSea.cap(stat)]]) {
      chips.append(make('span', 'hkm-reset-chipstat', label + ' ' + textOf(value, '0')));
    }
    characterPanel.body.append(chips);
  };
  const hudSlotLabel=slot=>slot==='特殊工具'?'奇物':slot;
  const renderEquipment = stat => {
    if (!hudRenderChanged(equipmentPanel.body,[stat.装备,state.gearPending,hudReadOnly])) return;
    clear(equipmentPanel.body);
    const equipment = asObject(stat.装备);
    const equipGrid = make('div', 'hkm-reset-grid');
    for (const [name, value] of Object.entries(equipment)) {
      if(name==='特殊工具')continue;

      const cell = make('div', 'hkm-reset-kv hkm-reset-gearcell');
      cell.append(make('div', 'hkm-reset-kv-label', name));
      const line = make('div', 'hkm-reset-gearline');
      const gearName = make('span', 'hkm-reset-gearname', hudGearName(value));

      const gearItem = itemByName(hudGearName(value));
      if (gearItem && textOf(gearItem.rarity, '')) gearName.style.color = hudTone(textOf(gearItem.rarity, ''));
      line.append(gearName);
      const worn = textOf(value, '');
      if (worn && worn !== '无') {
        const off = make('button', 'hkm-reset-mini', '卸下');
        off.type = 'button';
        off.title = '把「' + hudGearName(worn) + '」放回背包';
        off.addEventListener('click', hudAction(async () => {
          if (specialBusy) return;
          specialBusy = true;
          try {
            await hudUnequipItem(name, await currentStat());
          } finally {
            specialBusy = false;
          }
        }));
        line.append(off);
      }
      if(gearItem?.fishingGear?.type==='rod' && !hudReadOnly){const mod=make('button','hkm-reset-mini','装配');mod.addEventListener('click',hudAction(()=>hkmFishingOpenMods(gearItem.name,'装备')));line.append(mod);}
      cell.append(line);

      if (worn && worn !== '无') hudAttachItemPanel(cell, hudGearName(worn), '装备', { where: '装备', slot: name }, { hover: true });
      equipGrid.append(cell);
    }
    equipmentPanel.body.append(equipGrid);

  };

  const renderStatusStrip = stat => {
    if (!hudRenderChanged(bagStatusBox,stat.状态列表)) return;
    clear(bagStatusBox);
    const effectsList = entriesOf(asObject(stat?.状态列表)).filter(([, item]) => textOf(item?.名称, '无') !== '无');
    bagStatusBox.hidden = !effectsList.length;
    if (!effectsList.length) return;
    bagStatusBox.append(make('div', 'hkm-reset-bagstatus-title', '持续状态 · ' + effectsList.length + ' 项'));
    const grid = make('div', 'hkm-reset-statusgrid');
    for (const [key, item] of effectsList) {
      const card = make('div', 'hkm-reset-statuscard');
      card.append(
        make('b', '', textOf(item?.名称, key)),
        make('span', 'hkm-reset-statuscard-time', textOf(item?.持续时间, '—')),
        make('span', 'hkm-reset-statuscard-note', textOf(item?.效果, '') || textOf(item?.描述, '')),
      );
      grid.append(card);
    }
    bagStatusBox.append(grid);
  };
  const HKM_PLAYER_AVATARS = {"猛攻哥":{"均衡":"data:image/webp;base64,UklGRiQGAABXRUJQVlA4IBgGAADwGQCdASpQAEcAPlUkjUSjoiEVKwdIOAVEoAs7OOkMyVLQ2nJAMMTb987lpxkCd6P/quIVEj7G4F5g2AP608XembmleYWhooAtHLbf//+IiI4vNBR32D1gpDBRTkqBdyGDm357c0X9JsHQLTJ9iUcMTpvvmukwEF53lzdCJo4vrUfCeSMLEEj1v+VB8o1LUG/42PdlSR9P6yNn1rxERLc9pZGUniGzluGmVG817K1nrBZfMLUM7mXBofgklPuNxKXtViOXMMTwGU6MOcijm9Rs6yqCPAlTprAA/v9WR8o0mAXl99gazEseT8HunI93X9ZNYk5XHphF28zDo0W382uXtYUDQ2aBbWd9BqYNaM1v/71tUlfc3XXoFGodb0KG/cd3uxxt/kcL4H7jWz7ExO+R7kz+iFmVxHjh4vyiCikw9bFLcl2+NQ0pdOyPubfFfA798dM1QqAlge6+ZHE88+ArU+m6GW/7swrh2KJKc5IItLF3ZqgAYnAceR7hT9ZOPNsbExSMjP30sWRl/w8C414GMsiiAMSzaPK9QXmFh9DBsP+lN41CkcDDfZw3IH9r3xEUq1wKvtp6937+TlMrGN5FXSjOn5zLU90Y4QmYHZjLqLLch48QzQ9rSeJwpj533rIikrO62ZMHR2dMTPVvJwELcyPoC+j3XMFXk3J3jZL9O74R+WXjYMi/NcXIhp1u3uFzcQ8kzO83wTlsTrXNRiD02tkX7+iQs2TV+l7SqKC829XGmpMqer6r/P1Fev6nMr/E7bqcFOPDMkvYYwY58CZQEM/MWvVi5equJYxNrCRSt3a5UMVKZveK69L5erENvT4J+5wWg4FaKPm/VJ+/38OnV8Jv2jDXF7sdc13rzpFTZfAmId1g6GRph4iUtbrV3Y6RKq7tkk7O5EweBRHwA2ClHOkx65NgmgIbkmeNKZ/w2hq8swU4UM0dNsNU4R9G8W3T+cy6L4VBBqq2h3P4s7o9+UEyEFkMCTjVYs8jHFa0ENe9N7z21JngDBk6VBef0QqOsYCD4eLgX/P+8+qJ/r5KoCNQ6ua3ngfSeZzUKzx+9Gthv/xMXHef/epfFXfGTHb57ULPx+Q870Gm4ifqIonBI/62dsI87J+wK/0zmyHTjqRg+REdDnrIpIdegEgEBJt8WIFGrm4AFk0HX5NQXjAdH4oNqjsrHXBpuoxEbOrm9TpCSavJQkn9sfCLubLZQERYis/VuYFI63cN7XJKEbfZn/JR1H9Png6XQOmo7Dpz45tvJr+tlJ0+BCj5dWtVVoZ5p6H4yKGY4qYVaiBQdfbIsZOaS6rt8ZmcRads4E79uee5bSCtNjqrsZ7eq0fYriQt6Xu7Xo9qyzR9Iv3L/adjBu3Zt1p+FqknuS62Arut0yiLKOmjSaaHWWbI4sY9W1OUnIaWOAQq5KD7BquMQtUoInPkRvD3bxi3lvxzvqQbarBuQ+oQJ+EeZlyhNlhpw4M9yKkGkEKEK+/ZIaL08DARbbHxLEcQ3fqBWiW0xwf388wsFfsScPOvLsEjARp8Htp8AH+iBKeW42Qv96XOpyQj8ai4V8dOBGKvNsJEICFqSrTVAokGk2QvPH9BnqUmt7dbCUSdtyCRg0tZCX55MUfv7y7wXImQ85jbBYE660qIamCDnV/ZnHX9eOwXHbBM+EC+Y7R8HJ+fAzZbwm12n9ktxXq8//3ZA3O3CJ0dvgnQB9cHfrXHArBXtHNVgiz5xCwPePf37ykvJwllV5OyYQZcY717O8DufnCjUkg5TXT1+32ZHOBaV43SHismSfo4cyRk8FV3eXGqdOUCic/E9z0T2yKUju9kVziUryyeFctxKbVfl0S7eQvKhgkhmKvc4shIqHJ+mzsuXNoH3yVwVf2WT3E77PwEO2JgsoZAM8RjoG8lvIBf2boDCB/PSOs/Ru7rdIrzGn3XOrbQelQxGm6TwcNpV5m7zdERuAj0B3fTuCdqsQwHQzp8bK+dJYqatB3RFos3dhcGQEEjMQlIL0VlMdyfoO9n8Rx/269KD1C67XzUxhvNCJUaa5YV85WDGFp56PJrAor/AcZgFhqgc8lapEEYVAt2AAA=","霸道":"data:image/webp;base64,UklGRggJAABXRUJQVlA4IPwIAABQIwCdASpQAEoAPlUijUQjoiEXDc4AOAVEsQBf8e1Hhki27uCBd4VG2550v0ebz7+2/sAdLT/ibSk4jfk/xc82/Cf6g9y+R1EU+T/fX9n5oeCPxeygf6HfmQC/l39N4mPrx6J/6d/qeSHoD/mj/s/4P2S89v1N7Bn6477My8SAh3lUQNszZVqoVNXbEUUZ5q+hP9LF5blxaCbojDuE3jL9DkjzB0yMSdXte9LZr3oymq5T90bPZLQzfw0DISxIq74kRk5M+Num+fOoYTGxzr9NSife0Qzg+bO56EmCsKIWb+OgA12HTzRA39f1hgLyJrOSJvb1zSrLAJtZ1Dx0KQpsfxzz+p8n7lNUoQvyIfuR4zC/IqyV8xsp6WHljU2Acg1gMAAA/vwinJJZDgfZ7Z2wk/dkBKNNkv6TlqkGLVu/7pE3h+LB1r2F4b0EcCUvv1+TRNml8YYjKTYs+2zuNfb9JvheH49NblsM0pjR74w90ndxA2fgn76Ya05pP/vw2Hq3tJMf27emH3vlXy5wY0HGNUxZGxkPhjdifFMgthU7VT8I519mE20aE6TYwdih2VsxW/E02YUjcVEJqWPrXnoQtXULnJNMqq5JB1yU1kC8tmwhql1rAvYbh3Tvd3PeJoOJQgel7peqX/+hNF34iWNmd9M+kN+/XT/C4dCw1ab0MeeNC/mMz0jZG0Msf5I4wTb+uV+StXeV4tW2kYT+yoBnEFvo9xRx3sV8BGXLKEcTOqtjPd+hm9FDVjupkL0uCxSq4Dr29HiuqMLWFwWVSfnozFYqMZRPd1a35XALjhDbBOSV3VpDZ1AFs/lUApRgjYgjlRXdyL8WD7l0CuHEJ8fHPvEydWGYwXqgpc7QnmSanTUuXX45FOC4u/N7dRqM/V6crr5V5qDjWrLzep/aibcWLaj8oJS+v/Q+WBINk2MMnQov7PTV+/tR/ChUQZDy9PsCWe7/Rl8L3k39sMFGPZwBDZB8VKlkEh0BtZka2x/xrpnqzhD9mF50euCfAAvO02eI4VBcRrvvJLTNDLLvFQCy2JSNmV4ZJOpfu8ViemvUUXFgEF79ofGvuB0ajvTvpNKfmQ0O9tyIQwqMS0YJhzPR6GGF52PDGgA+X4rNByqEzPAG7CaBFJkb6YVIvEMzoHYtFB/llc7MhbXoY9XaFLatcQtSgf33IKeUIXERlsP78DvSkm6CzrpuOGzzw3SPvxgOuvgJ7a5CjwlvVbWHO3AWuOOPw3t2Tc812WBcbMdL7uGFtdfiG/EQLz3dVztYhUt4EzJNtI/TH1KYxjJtHQb5/Y0nh1lraBibScg5Te6lkj4qSkzsdqekh1bsZft9MPaiXe/7+PU73JA7BvMw0lhdv1PukYXbqw5pe5i1VLHMI3uh7dO7ZraPCfP8n4ZObH9RQ9BNL/BdoonU3KFahE+cNmwiRyPNMKp8n67+NOkMn+vc5XMNpA/kx863ebQS3MFSKD+F8c4yLjBmSlXdFEnW+rH3ozRC2ce7zeBmMmtpTsOKgwJdSla6QWMGP301/2SEegi6fbXZVhfZk6U4fqH++60U2x9sV67Q30aggncCiYu1La6hQqJtiVmDmLBGlVWQcF2H64qdJrzoeU39BobyYe77mGr7vD7eYgP+qtNKpymavOkLaw2InH+2bq351q/+5SLBxAbcD/IqdagiYUGi7NKMVfYqenF2OYEilLwEnf4OR12QDG9tTYjkYAaMnvx5PYDz4vYOIJBL3bQhUVvFxNi4C6FWYtvA79OkyXAH1+m3W0zGn/cbqcHL+ivlIguGkx76ST7HeBCgE5uavd1bxCFByFihAoLFs04Ks1n6eIGdkM1kvWACPrkUbSNbpn833TNqwppooh+oUOfIutOdfoJIAXyJYAE//sbxm5mRxuL+6JcoDD/MsfYNOhzffrVHumGVlyzc3ofj/zz+Vfq0nfuvGRjHtfSZNdqL0VtZ8rURnhSm37HPiVG6WoqPPGR0p4CEWYfmWwzRJitfKu0+463r6KR81HmUC1yHHTi1YeEIg+G1zD1AH1yyig9IkuKFaOmOjJ8tWo/kjYYnoID653AbGsJuAfY6aRp+Jxw8R2J8jcU7NWiDnQilMzhMJ8x05JJm0HhNqpu+Z6xpRrQdjH6FjseVEkHZDcpSr49i/F4wS8ck4JTl1ch+z37tzaT5ZZf2vz3jF/Iz9qftBV3edDxjLoKsxb3UUwHffnAaC0Yu2PEFLo4daeyNfZWeXaTioL99O4g758fy4mmCloIEAg/HMsXMzMOZ2Kjq208OdnEPYzCNafmgJ8VombSD6tMMd7/nMd3m8/NwES/F+Yxf2mbs2noWRor5XrTHoLjQgoKRwE+OmNcTjiTyVxe7jwfgaVQhbKrAlcQynasvMCiaoL1jlJmZFZt9p12am7P2Fx+81N6mbpjjRBPM/HNSMZVysv+jfH5wxdUn89ch7ysgS4LIo7vZhfPRxLcu5vnhK+ZxovurUiuOvWPrptNBTDJ1TtrHnHey7dmVTcdzi5PgzsGMW0f0KUyvg7O3kVRDwW++fcOOglNCNVVRPlPFSuRNsdUezDHrK8E03Sn+nEkf7/kwj3Os/utt0DuglOPUAxG/hgxFLP9w+cbGzFNqvyOHLrmfh2zAODfM4Y6mOf1S7EgCs/XXUjdN3xjxAQm26gAUbe5kM7droyklW7rPkTyhRu30NI6T9aPpLP41NFDzYbWe+0iqvaRXfnHQCME0lKIowfaI/z8UNDc3tf7/wl2Z47w//8qqkXY3iiphG1FlPoOcDQbneDufBlhWqEXfkcSPD7E2r9R3JLzjYc9twD3ngszzshluxQ5fgn2nXrxZNkT7shXMkA/y9HNIiBpgC25FM8lf1UjAd5VuUlDR4S+bs13YTfmxqHI6qU4QMQ7CTRr0yZb3VQS1u+ge7/Njo2T4++P1BmiHlCyW61CGwVSzTCvqQVfSiAaq9yhNa5xAzfGwBKwH4MDwex1IitPEZWi9fcw/CTHe8XkB6XRNvmrb/BrWa8QdMkpB3CPJ/WARTj+uh91o0MLa4K2UQKGfzn7uivimph8awgAAAA==","谨慎":"data:image/webp;base64,UklGRjwFAABXRUJQVlA4IDAFAADwFgCdASpQAE0APlUkjkWjoiEVKgYcOAVEsoBfIDImaGkfj2793EvbZlPcuncnDy7iPvH/C9NtOpjg9E76M9En1x7Bn6vHk23Gq6PNomipisydUx1OTqTvd79OjZo4WinuSkFW5erltuEzDPrJ7v0jV6zqlftvdxCzsKCSmcJM0OvDPGM3HnxHMjKSZWaQuWvjSJP9DnOmw88KlehpyoyvjWQU6Lo9VUEC+YMBKQbhbJiHznpLhyeoEjzgHj8zRIAA/vfknU+B/ncUKsT2Dg6Q5SBCAa1vg5TQ42bko07q23HwlISQWLnWv9V7HGGhmtkpTbW+q95bl/eygYu/W8gjJGF7Yxz9UB0YkryJWzWWsDZlU6Mi9HtRynoXsHMgtlw2a9lwpP7Jx5nLHRmmjSC3W9Vjz/KVXEYcOGOyjtkJSb/6p/v3D0FAQcEmj79JzOUp0gcRnNu0nzCno2KA6m2KBBHGH19JW2J+/UGmfgICGczBK+aDOyqpaDhteVhXsokmQRP+3jsisxepAxDO3RuF1IgEf37Gg2BHwIdkvUTQ2QzrdrxnrAlt1kOxr8/N/tuw5gz4mQLESSB0L7T0OcfZ/wQ8M3rhfMUI5B5dkIxKfCy6R6o4afTpFtJgQryPDx0dentR21baLK8rqkgHn6xN+5UnuUur3FYzn3DMXh9iQ78t95ZHJXI7QQIUM2K3UkQ03urPlijW+MCv1INEUjke1OWcVQtlg1MdzYp1s3GtLiUtjWw/dXHA9UXNPec077JoXnNDUn7ced+COeQsQzFZPlwhIgegqfJs2wi9Hjgf41PNGIhjTHRV+h4BF/pQ9Q2JyXVNypZWk5NpxAbn3By0200VRxvAm9Vu5NQdmSYuPoCHUCqo5k9CsKzdnnWvC/d7KJScQQqdsnLDe3qW1h96cmSQZ1518LL0sJ/fd6a0vg55z/frUuG3EHFLK+fWVDabmoqGzpYecHuwn4yCOfI8c4xSDYwzD4t612AvojNgFro1HHglpWli3YHNCnccMag5Ccv/55Kgi/3xdVigXX75SGFtCH17Ze6tkIH0VlT7EgBTQQFkre1I/mq27VfeaZG7PEGFtutl0UrolHyL8e+U/jkGD+kKiW0tbyxy2xVo2rmUl+QLWW0GH23OmOVj32gMpEjVHhAjcwJossRKh+2peOHZrN85g7FJ5xj1TQ4zZHbin2I59cntDKjrr0e6vJCVMCy1wNsNQ1oBo5+bxnEUf3nw7h4lhzRdyGY09wR/yeZY1lN2K34j7qZUs7U8cUIXUAbwoL3ACar/h72s+vb3Rcn51nUF9AAm9LebxA7EoMEjUgXKOrvi7Z5d+KNKsaXII1F/9QwkaGxrovQv3A338EEfPQVDh0k9pVdlXV/FjPnL5RgzU6DY0qOeWyuMZanriNDiDYGdG0naQlBRkUKLOhpHmgnxbmdhv59sAulOLumAVHa+J/iEDAy5smdNFNKVWPCaz2nPApxyYKsYlHWfz9GJVUpH0MVkkvWOXMykpu1pa4rT2jXG0VHNFkR9P+eXyk8V/0JFQJfMoojxiODWCoohzfmFT78Vo9PI/fU/UcHoR/X1XYxeZYvJC4C/3vnllQsm5xnOkjlohZ43jtO7DibhOMbfwz3YRmoT6302E/ApHXf+KF9QCmPKS26bM35BOFV0yKTE5pAUciDswWAjNzOhTw+LnwmiLC7GOs6kY6ZQ8j7l2ailInh7a86zKexeJddGRb4a6lcrrPtKm/hiWYIPiQAt2Cz/KFRnFA5AAA==","嘉豪":"data:image/webp;base64,UklGRqAKAABXRUJQVlA4IJQKAAAQKwCdASpNAFAAPlEei0QjoaEaPX3EOAUEsYBi/jigCtAjcbeTnb/ShvAG83f43DBpAeZfgf4HvR3tN6x38B4o+ff9n+QHuR/J/uX+Z/s37jexn+n8VfjJqBfiv8t/xn5h/lhyNQA/zf+of7/+7/ul/evSd1F+9P+z9wD+Wfz//Per/7AeKZ9u/3XsBf0H+8f9P/Ae6v/R/+D/O+db9B/xv/T9wb+Zf17/jeud7Pv2u9nX9zm79mLpY10fNQeA/lrD9Y8P5bhzNG/f6K68oOopmJeaPQKws4K5G1He72YxjJ0i2remU88TiVRxFMa7/nqgo9P7cT7eSZ0ozGnxBYGUfrkh4XBeMeqfJTRy8tPFfoTaqJpzS56hqur1y/tlX90xKoDVFhXxt7GZ2XmETPs0qxvBIcKwyp1jMvaozZG1ZIfuQuQopAdlrYYVKqQHHcpKAKeBQ2YhWGiw/Hl/tTPSAAD+8e70897oOsPSZ910oo7FJ6jyoDP5n3cR27H6MPogWTgZaArudeiKRw8VQLW4YtD2/TFOzFiQimTCY9EZ/EkJzkMK+HoOnDyaB9j2JKJ1e+PHuxpwIiZkn3h9qFV1Z+q8ouiuYjxsPBnTJ6ffzh8CSzo91Y6gBtGHo0wv1ESqGnaBHU4AfoIbi04AeovJAMQa0hVdCpyGZgoKXLSvSdgtsA1ENqfnxFZMReiDxfyn/+vPb8QaK2Xi2am4qQtxMSOkWiltpEk6A57gkC2fFXHRiUYEmqT76GWHqwlHJHJ6mvoY6SCCysmcOfN75WfvfWEPLqRhph1yfRg/Jl7m6lGHtyu6w6+i0dw5L+RlB+hrH+MTfm/FtD4qHMFBeoQGZT2zubYzaKKKY/xrc2hhU5cus/x4GLX6PhPn6qQ4FUMwnv8WI1o/CJgO8gthH9mXzT/g9hPGaS6kmfe/vvO3woN+d8Vth9BeAn5aZVHqz8jtJQE7tAecYvBNrClbpvfckuNqHZ3JSnY6afyv4Hx92f75S5vIeyORiEPoXRG8PLbrOdVwyqC5DqAbt4Bf9EM05JQZWRJNag6OrVTEDI6qeycZqaZPgJk6nTB9zM2knhLvV9uyIEhS8kKuyE+bnJtiYu69PzajPz7GYGy0Zcky+SMjdP+EJ065s/zfu/hANhs2Ju/lQ5/dr02OO5p3rfEKbCsfZDKShuKXTp10VKkh3OMuOcOhduzn66afwQUv0vJrCjX+vh6JjpizqXX8FIgTIMIjuKvLilcIpV4H4zHaQ6aqR3IhR4nu+RiQ7PVlv9E7O6YiMsFoYUHwTqQkLABYEaj1QYor9yUa6HyzbUsZ7+3mXr+7O1vvVzJSltKnuD/3TPk00zFmhQGT5J/lHewxR+r4ksqjSiJNBJTPU6Dh3jtHgjoh6HYSWoLqLT2+hQZdkr1PdRuf1Lp3ZbFeyo6VPxL36KF+EDkugTvgEdg2FtNtys7OT4Sm+xVC0xr3lkxJWRJnF2blqLVbcPV48WY6OY0DRFJPIRV84sSAqLI1SqokkKQ9jgwFbp/DymdaWfwFdOdOO+dCg3/SST7McBanJYnDwddd1RBrYopICsIo7ilH+G9+Yjbf1M40RV8eYh3geFpf/uwID8TaiySKq/77hCC2vzKp1vimP/PP2U2vPbMCjZOyKGQ6PgMpUcMCXX1uTc5kNIuRF5fzWfqlBPuevrf3lAp3PP4qwjIHJQf/acnhrNA8w9WdgvM31bNTJIDb6R0ITOBRlniGBmRunya06hDG8paO1iMjg943YCnprLOVD5h6bv0OssmcfKsEuN9KWpoE2FlKcxilgi5Qw5xqH166WR594uD4OPCxPX2jRDlnomEv6Tmdrqf5FfvVMM1mSiSsTnSOOyJzOMTw4CEb4DxMqx++wV1rS6SEE79S3QiNa36UChrutN0XzQSctaBrX0QDd+y9o2YyOZjcWe74Gx+e+GmNwknBSNS2MUfEbLOYeaN1zo1aRKwmQeEofKkG5AS9EPz4NHuswpqubAJAdzEsmegbdKktVE3RimEC1v59YsHdtCwgsqifz4v7F7PZfnGH/QAOwBKDWjiMW6qmhKV+iKwTP+TDCbeMfKgseMCbMP8p+0aeNOvZJupGRBZiDKQegBztAZf2zPPssNy+zeIdVR7FBGqQOhrPpU7v9nKyxQJbrBVx8Xd+EHlFgXjXWLQgj8rckxb4HtYFyotcoAwlHNjBPBGdlwGqon3iYeGOAEzgvV/+cXeimJ62O/E2C5nMAoUQ3jhetpp+z58MsaaizNNrb3EjAeA8eD/YZrlD1aPsYDWtQ91WeFH5XXx9rv4dAigK3l50rQU4k+LckwClvqZcrZz085NqHk1aeyVIKQr7GYC7NOJe/1WZfiQ9Cmkvc26sglyRWjdP+mrydr58sFudfYoML2PL8YRyo0LmKXX434eciXKQK8vIqyP7gZnvn/ZuPxORORiBqYksapEZOmKPhp+E9xRsk2wrcuQN/mz3uUQFbdY6CUeatMiQOy3fXjW1qE1FLvRKXD0f2eSylUgFzNaruUVr+W+aq9s+jttqXg05y53G/cT8xTg+g6QnEN71GSHWVAwH4uWO8JHdNoPZA40frcgtczoSlGqAwv2Lofsjv04VWH++WxaO3EsYyazhUTX0mbUmW19IdjbG9IgiWuLvaDfUCfOLRxy0/D5lBMS0OAvdMhffn0kaizBydUqASNG58j/9FyJT7coezPPfwotLYYFNgZUX7YKqvd35cjAGwt9T5nDBqrp/bLRe5uzHaQs6Plx2EN1WG+YtgM24o/ve6+k0cFl5WwgDWJQV0+uDZqKwEkKDYid4o6umqVsopRkaMEWr7Kd+47IRn8nakb4uWXVUwiuhD5/HQ1RUVLPLENmqi/pWcFBakcdB/tEsvT1a+DNPUxuogJ3RO7xu0O2dCpOTBFNLVuyM9WXbwUEdd6wRgEj2Taz8DdMpYTnBMvxubGuDrVsLCqAdWLzz6gHFoyqSV7rpZdGX89Mj9abMsHp5makeXWYcFT4bgISHrrMrcIde8FJQTlRdnAXae0N3SXIy5sokUGa5Rh2XzxGGVwKWwQFDKZOHp4bTpbYq+Hrbk0afix4tC+UGXEjTwtdeT6PkdEdgDFjhPSSeHh83EW3f0F23vmyh2vAYEg2tY8p4fGfOlxloTIlA2Qq8tnhTtJ1AbRQY23Kx9IzkMcn04mvO4jGXKV7DRrvBH3sPqo+wZiP02ri8bIfKYYIH9WyE74NfXQRjtZvBcDVtLEtkYz1m/eSR31ivjSdp0+5ANBb5MxXc33+3G462h+JfcaQBNAbfNUrJZv19x/ud+Jb+fvO59TI1IHBEANyMsgTG233Z+B6z2m3X1dn5+e6e6stXfT4pB+vMuXc2W7pGzIfzBUWcy7a+yJI3lpjekvJBKYSMoe4ZrV2c2LvSLTVtie04mn3kWCRtx6Wi1sWt/40ZWmJYvW/uPmHkatmxJRpHxK1ELqQ9gc3V2ng/oOIZ+QUYLaSgn/GRy1BRku49wpbXGEHbBttQveMUjbv9OHKwfowW+9q/+l7QuzvQ+0WTDa9g+Tpyadh/PEJgiv6RKhiAPFecYRfLnUqXyLb7j0e0pEk0AiIIR0XiWIyAAA==","菜鸡":"data:image/webp;base64,UklGRiQHAABXRUJQVlA4IBgHAABQHwCdASpQAEcAPlUkj0WjoaETOzZkOAVEsYBYj32onkn8395+X7op9P0dbc7clb0BvRFeV/cvxE83fxL6f/X8PbpLzH+qj7vzN8BfjPlM3iEAXVO6pqyIdi/1/LNqILCe72f8aEjFz6pOSNVWwKO9/qRxOVR5NPq+MYaM3NLQMW52aomYALD7sf70rrulU4sz2n+GfwNldiEeRmrLZAvV2kqWjFjALKZFDDgXqp3BR5NmDoUeJ2kX+KNY5q9n+dxaulHmPbwWYTjx/GUwJpMF1hccAYEjs+1l7hw4gIcvkQSPld5kBRIKftU4IEL3eclAStxYu9KWn4yPYI6Mw5kDy1AAAP7/pxy1EZqtpZrdU9+5hKSp3Hipmf/iI6xaDF+wlvmINfCT5JtyApqSG9Fv4aU2ZqAGMdfb35ciEzgWS7CLkP1/N4837feM0T2KpWpQsj/q3PKj7UMDzitlvHoUIypOipHPTDi5AwiJTGzK+PKnvwxRIPVeeGxsVM19rgF1IDHh9MrNbgYyobdBdjH9kLm6I/sprEvRIEim628E2Tx6Yo8wGE0ezuCTq3bBH7Ci3Ph9LVNxsDA/cGTMpGa5DKchb1RXue5lmOOHJBuwtcX5+YAJed6f/M/upwjUG2DoxrJ4ZbpD2sfARm8RibFazHWukSuLTK6pbQcJyRTZcA5Sobp7zbzWFZIH29RB9ZjAjUs0AwbSDZxt2QGGDQ5W5udZ4oM0YpZfpibLYTyAemWKQIcA5cu9N3B4E1fHVWS1as4qcsCwXbc4HDyeMGGIvI8fK8kedTrnYD4OpbzTFW1rRFfdqehdsiRYyw8HSRGn/eGlYfQde1+zBdHdmqlDc6KrjJfSJwzZBY2qLNXJpW2luL/gbadhhgyzajroO6icVdp+K/J61aKsE0CFr6P2fPMZQ9cmRyZDKzqdwz6YwSGXdw8GUEkgd/vbEC63LXWZZBWKNAOLvK5HLB2WWmRTotfMb/UOwYzUg3C9VSaifPmt8jPMRq/C0uoKp7Qh4NHR0uTJH5/KZfgcNA7d/oJ7lZGquoEvMsAuk4FG2feNR0ppkJwcFOs07nt87VVeS99EivxMDTVbH9RMMdbLWkLn6znusSNRvRxr4maweW06VOrSu6T0BFtVIIxInxsFnTPT1xaa+8/aj2syMIGUslYMpbje4yoTMjTLIvuOPh32RaEJeTiFOVBPv9TiNSwAE3ImYqmLDGYlg6PKW1oRnDfwoL3q0LrNfIQM+cLqWdv2TS5B4bmJspA4GvW/3SeNuL5jruepZx9BzqtX9Pi4uxQNz0NpP5oghcJowExRH5iDyKwbnA+Cdzsx707ziBjdiA4QxSUDSYN97AnGL5sfTseN2dPPR4OIvTFrMSW5kvHLbVkyV3TVbizin0/KnWa9CQTFWVrcBQ7HBCxbjymwuShC2yU7rU0drNh4Wc/AD/CNhYXNxihAWt4JLPXlSCoAUhpMR8oQu7AHBeB+WOU0PMx1fH9SgRaYgCcjaePfv2gHnXfiCdOTYgIOLDGM18ly1GAPxT6g7ldGCl9zwnITc0MPLp+oQdxaIOMb5MKSTb8agFcCZyBQsxe9IFzlMlBfpxT3qvjxS6Eu5ZsQj1ySTVhdQU8WbcYLXxZTv+mJCNj7+vU0hIIaCDHj4MzM+BJa4qtVlP8Xukz0JXtA/2kERnOKWPRvZblDuZ5U4XIJCi28xK9JFQ5vgscusZnXSiAnsTFkGNruxHaUIP5egvlQNTxVe+uPpjcJWMa7OB+AUg2mgK0LeWk3bJFMeYQtj4eCJJIx2EOkqzyV2+Ct+tQf71ugbW8QeY46Bv2jMHA4DCr4ont3OGn8mXSmK97AdoRast0+ySYV9KcK3PzR5cnENFNrkq8tQtzq1einlTmuo9zPL7SYFmfAo73GUfz81juS+IU8V1ygVHN3EfceijDp/KMkP87l7+SCDFLUF57Qujd9HFiSsBzZqsgNSvfJfEBw0kkvkrJ84ixTBKfbqL7IbIxXIpNCpdDuHMdaubpvWldlAav4mLonvatL7aKuqELw0CvwA+rS61EMrN0yugqVkaYSXUFlYw9hQ1WI8fU1GMTs0WqLSEHNLTU2JtOFukMt1CPXaCjuQsMXeUcM3oliSgvfEkartkXXXIq39APZsz7WwuxYerkSTF64/Yj/HIs2KqRrhmz2Dk8Fj418QIo4DqHfyz71yv26f/7RpanwFcC8WR34Qnfcvb0GZ03jNl4Pp9Vw9PodTve2J/gGFL9qtW+4ZG5dq8+I4BKaYNbFZQhIbWyCtDEW+bvasza16fqhma7MF8e+6dRN3YvhepebJLZIDgXwZUmnCje290e75IYWKbxBXP/ydrxriB2kdwRWGnwIZBp080PIt9SVMfPvc1gN8yJTKN5jbwRRuoO2ISZTplBkk5PpZkAA"},"鼠鼠":{"跑刀":"data:image/webp;base64,UklGRvICAABXRUJQVlA4IOYCAACwEwCdASpQAEcAPk0gi0QioiEbiq5IKATEs4BlGOqSkf9MD8jBoUifFz7ftj29f8xyueAuU8CmT43Wf4JriAZ3bvF+Uj+sJuMtyXOffxUDq6ruwLSJ+ELAjdyND+uwLwI4wYcfcPuDgLutzYJp+qM/nxV2kDKPigI9u63mebSXhomxmIfovTK8f0HUzBF54MBmYxxWPAy5S/xBIWvYAzvQ/X/1r/nwAP7rjErUmwTgF97ll7q9dTPPsOWLqHdW/rDWY3n6l+yqihp1elnlWdM1YWH0nT3SvFbbQFagf4NWuaOKDVHwspSNgKvzPbVQc+k7HvHfcbis1ZyB41lc8KxTvUf8OYn+wzZF9Nb3sssa2DLFkzlLSYkfqAHYZofJiSPWeQ9Ea9zm/2LnG/8mQBHaGzRL1RRjHec43azPspqi0RljWjMOQ0fUbVBFrx5y5r+3oDrYqGw9kd0LBnLL02vG6EQMWUvox4JeEzAlnB5StH3GuTtrkg4aMGHaVI/7XfP6Mp7Ph6RXfCcH7xsPTjBM7YHfc7Ycu53JaDgizpXfvhJXQl1XnPYIw3W8Y00bN4KU/OGtw10Jrvmb3qWUIcUD0MmBXVVexWO8QI21dK2hiGlj8C4VBPuZ4ln8Id2nNj09eqtaoPXuQYfLMIqRfjdczWto8yUuvBk1vbetKRCVxyIFTuWqOeA+5Y2Tpdo/Gk//x1SwjCvIysUGxGOpNqkCg+7YQh3jzgMYSnkLVyo4BP51oNrUxYTyvP+CxpeIksc6Q2AXwLR1vAmBipDa3mU1D9vSaiwHbxIV3KUxBKL1qO0MrFMNZL5n8CKqhxAy4Z4aVaIJ95d67//l/tBLrZ+oAzgevUUUCxikmMfNw6L12NG6BVpabXvbLIPzc9+JIBmkzCe8nDJzDBltfPFy5+hNHu0D0pQS+ZT+5IbXEu4PPnChU7AOML+AOOHeFJrf4VF4YtaIq0WMHPVxmbPGNLaiPQ2PfgAA","谨慎":"data:image/webp;base64,UklGRuADAABXRUJQVlA4INQDAACQFACdASpQAEkAPlUgjEQjoiEa2l2AOAVEsoBiaCgE/1/2QUz80qD7QL5I4vSDlAEpnKYy2RKUe2pQ3sLd/m5C1veDm/Lpvq/8QOtRmehSCni1Px3fsJzXbckfIjmP6ZR4KPBRjw18UBI8eB/2ll65DrmUt/9x5XZElQllWo8BvJNitRnccFDLLZ8yXVnwBT14DqVGE1uI9eavdUfIUoihglatzFzaFeZ7w4mOAAD++qP5/cx/XOjyj3jVv9yhmnNkkow5HSreabAip7P9CKhoezVWMqD/v00N1+UfR23tVMkh3HWY6ZPzoqtkTjfElfuNzGkzVOVbih5J952FyARkJDZmm4LPFUTD0/BBbPuGMvLh0pqIuslh6EdaGVg/hY9Yz4TWm2Fjqic1treQ8/9C0uFlbtGvqin3Nrm45D+TDLxxl1aZUqma+0xP4BwD6gYlubfbhXQM5VTw6Uqq0yKRgiYbvmef3LTnSCGny7kj/TfAo/7GZEyKLzP1xu4Qi+yhLthHgYnAE+WCKhCoZbKlAgqQ6x1Du+Ufkog85noAQTBxVQ+WItuHwB4BFofdh9fHRgReYRsMfG1BULs+N5u0iJBr24aBcDMyEjcfN/KLmLHCg9NNEVaUigwfscSmsjo/aZk63VYHlNLa5rjl+1EoY38X6FYrK/tmq1oD47sCZUUBHZgAtlbkRFC0+DCMgE8ISXMHm9aWVz/WmsxrJDZMTtJXWBofwkq+Gqzecrx8UaMLg/0EXl1FXQpPkcPDX6fLW3QkawwE2Z6nuSnY1l7Tr0M6K0I8UhPt90x2aesf/aELrDxdg7qY62ujfAEMzXl6biBemYLzwk4p5CbHUrierLFLhiwSVLHyA1VuFxUj2rCmB5E7Ev68YbwEDmR70Zp4MgbewcUylNzJ2rYYY/xqMICNl+mCny4+tg2z5R4dcvZlvOwxuakJANpUfG8AZn5RUFHQJqoilS4YEczScrteJfBOjQYxyPcfrTQfJWj3T05bbOZWSEMomDxp455jI7P9AjpDaaqIzdv1dMpDcBtYIZ9Me3BcpyKLDJ6OU9KiSi2hrIytLKLtuO/HABNE2NoqUlLMXIbeXT5zk5ivjOsuULf1Wwzm8vBt7prepdePbifcqsREC3XiBejt519XibNTT22WkjdPVCq+uIKBmy8qRnY7J5pfDG3zZOf1JwkrOyWlgbfbZIW/oS7M/zIj5zh3Hr7grA2QesaV1PiiRRy/Z6BR7tHZyWmtC3upSLYIrqhYof20VBZbq248jrX0bRCjl/OGqOcRTJLTnvmofzgMwOCAAA==","贪吃":"data:image/webp;base64,UklGRhYDAABXRUJQVlA4IAoDAAAQFACdASpQAEYAPlEgjUQjoiGaOQeMOAUEs4BiLGQI+L3/KfxBsc4RwZ6y8kav5tWvznSnjPCwYPKjCzL4/aZ9JoavSC/SbeSC5IKqa1mr9laJnZTDBcP/ZyAWOSJxr9X3ORaHOicXs+Fz51UL7kxOzbvVLT+iLJ7mAyaxgwNE8V9BXaBLWnF3IggktlXenFrNIZ9S7yeowRV1Sj9AZ0CwCFabYLs9YXrQAP77yA6Mf9QlI1Qx6DDtFv2XXrcfuBcMvGYQwSygaXHhcR8ckKcob7B5sd9HLuHI05pySAxls1Nah5vJ5zs7OF+NP9QRN4gVNMBvJlOp4IzImDg5ejpizEeZAmRBPUGVfgVKWShqQ97fEnqxfHxdZT/v+iuERMZT8WU0s6JyJMnvt7KQfm/6Qyhmt09qH4DoPhfaZspXQ8NiLTfKkDeYoB1XsPQWDaJxcRHBawWDQ/R9umo8Qiwk2HquBuOc9hOr1sSqf4IMvTQQ0/AGnZ/sglFyc1dFP6XJn/mtgpHoGKMqTIDz/LGmHsqTCrQ4vyjwTcDRbOl6b7Fo7lyRSDgwiJExrq6DRaJE6t9ir4kyrE8mbkyAeRV0A5uy/e3yNpLTcr+nLVpw0k68WoDOnFamY+TWSZ89Un+fN3uRauprjyZVK/YcrFssWTQKgrQL0r2PTNMmbdnPIKDVrdzWZ+SUds29iF9PntJnrqTGRrL9886sofCaVuVUkis8RLj29bLFa8RHhDpsalrp7c+W/yM6suiYdi0wZywchFsK1g5/kudgqqQ6AVwgGjEJ8Rd1/bsqBwzbstpxn6qiXU2iHBZegmnRKCkoEfBMIc2qImWVHK2/DYIeYBZFuiBrE9Sf+hsE1EW1axD1f10VZg6ikXgM/39J7Akm8DRXYFG2f6kzbChNu6BmRh6BsFqXLvcLPpzgJJtx/l4zSY5AAc/CLll5ApUmV2xab+F+SmhxaEC4W9bSNOmRVFbIj2GZawSt7pXjBNQJwpj0TTqtniE+OQQvLOqnfDI/v6QvBbLKifU8AAAA","自保":"data:image/webp;base64,UklGRvgDAABXRUJQVlA4IOwDAABQFgCdASpQAEwAPlEgjUQjoiEa2eYAOAUEs4BihiRfFfC7GC17uJ2t7hqZtD1JXI2/E/nB//8FmMylPuTwWE9nMCrC7IMTptQti0HF8adn6QbvKBcS4U6jc6vHBlxU0y/S1KFxcIbc0RXGaiXT3wncBZoIuOdy6zHvmxorhpZrhPnFryvV0kUUqrpiUFYXLmn7qPYUDBN3yXBBWCLsaJYD8/vXez4y7JoBVeG+I4zQB+bONEbP+IFdCxdgAP79UKUzo2zGFMErkhocYjR4eALprulnLxvBvmWMfUYkI8K7dT1F1KiQ4CllN2VNS9sek0sgW3dxwqvvrUkA7k043Hzvvz320YVQpOoOVeG8lA6xD8vtFlqWZ4PGdXGv2+jp3zk6l+ouv7AuoGvFKyMwemhn/mESx04moZOBncQw1Y17+4EE6++/JAjukpXLWOZs6JFvcgE4a5goTxbGaBvWA/mB1YizrCYOpqk6ibKqvxHZ7aFXaHCJN3JrXCt7rr4jHiHVtS2Fshuz9iUbka3DvvVjftkKhrG0iIsKHavc3xssyYXe4OfhE9qghU6TzyyypB5rzHPZ256Fd/qblaG60CGyvYZhiqg+S4pP5CzzJEutCUmjl0fh4r6/aytQ752bv8wGoTplz2Kq8Nko74jr90/Vw62kK8CyX46GgACi0Xi06tZG0gxVp5PPxsyDX0s8yju/PaY8TUbzt7rGwwY2LcXwtFnZO1VqXXP30KPpCxPcLuBi9ycR52Nx5BnCKgZPjyLVdaZo+K149W7uer1pocO9XOZQPzzC2jaacBGuaPaERN1QwWCkSs0pBy64tht9lEVgh6gk+ET608TH9Y+Kzc1iIjRWsAmwX6u/QetK8r+rUdl4RYMfUlGseagplwON2nm1hunYjKxp0K2WxpoDCk8GfO1ImnZ3LwTHoFmKr2LMezEDjqJtNtieUwjpR0pI8uJtIWz5FPPxNuRbQD42W2nWce9ANWq9omUvzTA/k3q7fADtIyDXjR77aD5qCHuB/Ow1DWS5TwbmzU7UpVtQKyw4f5cHldRc11iw3vm3X0oR9HYzTbSQGh97yi+tV+Pd3IXH0+b+SCHwecuT6ccODp70iaB4HDRB+f+T86eegRVQXmyrlEftBocRSkdo3fEqMFD4zKPgwUIY9qaxeLf/VQpVN7v7u41eDE0oXq/BM1JMjF0VL8U8O70/BIrD99E0V/a+UeNzVZ8ugJLOTWw7SC9l2Uq9ssk5DFysKwgdN/HYVzY3C15WubOuOLvl6Twcgn2/sQ0Gq9A2RTYqg5RKwZacxJyiMJMGFHSaHZog8nzto0hl2BBsjlOkGAAAAA=="}};
  const hkmPlayerPresentation = (key,item) => {
    const players=Array.isArray(state.run?.players)?state.run.players:[];
    const player=players.find(row=>row?.id===key || row?.name===textOf(item?.名称 ?? item?.姓名,key));
    const description=textOf(item?.描述,'');
    let meta=player?.meta,sub=player?.sub;
    if(!player && item?.来源==='其他玩家'){
      const parts=description.split('；',1)[0].split('·');meta=parts[0];sub=parts[1];
    }
    const group=Object.hasOwn(HKM_PLAYER_AVATARS,meta)?HKM_PLAYER_AVATARS[meta]:null;
    const avatar=group && Object.hasOwn(group,sub)?group[sub]:null;
    if(!avatar)return {avatar:null,description};
    const prefixes=[meta+'·'+sub];
    const prefix=prefixes.find(value=>description===value || description.startsWith(value+'；'));
    return {avatar,description:prefix ? description.slice(prefix.length).replace(/^；/,''):description};
  };

  const renderEnemies = stat => {
    if (!hudRenderChanged(enemyPanel.body,[stat.敌人,stat.场景,state.run?.players])) return;
    clear(enemyPanel.body);
    const grid = make('div', 'hkm-reset-card-grid');
    const mapName = textOf(stat?.场景?.地图, '');
    const area = textOf(stat?.场景?.区域, '');
    const list = hudAreaEnemyRows(mapName, area, stat);
    if (!list.length) grid.append(empty('当前区域暂时安静。'));
    for (const [key, item] of list) {
      const name = textOf(item?.名称 ?? item?.姓名, key);
      const card = make('article', 'hkm-reset-card hkm-reset-enemy');
      const presentation=hkmPlayerPresentation(key,item);
      const meta = make('div', 'hkm-reset-card-meta');
      meta.append(make('span', 'hkm-reset-chip', '血量 ' + textOf(item?.血量, '0/0')), make('span', 'hkm-reset-chip', '攻 ' + textOf(item?.攻击力, '0')), make('span', 'hkm-reset-chip', '防 ' + textOf(item?.防御力, '0')), make('span', 'hkm-reset-chip', '速 ' + textOf(item?.速度, '0')));

      if(presentation.avatar){
        card.classList.add('hkm-player-card');
        const avatar=hkmCreateElement('img');avatar.className='hkm-player-avatar';avatar.src=presentation.avatar;avatar.alt='';avatar.width=36;avatar.height=36;avatar.decoding='async';
        const identity=make('div','hkm-player-identity'),heading=make('h4','',name);heading.title=name;identity.append(heading);
        if(textOf(item?.状态,''))identity.append(make('p','','状态：'+textOf(item?.状态)));
        card.append(avatar,identity,meta);
        if(presentation.description)card.append(make('p','hkm-reset-small',presentation.description));
      }else{
        card.append(make('h4', '', name), meta);
        if (textOf(item?.状态, '')) card.append(make('p', '', '状态：' + textOf(item?.状态)));
        if (textOf(item?.描述, '')) card.append(make('p', 'hkm-reset-small', textOf(item?.描述)));
      }
      grid.append(card);
    }
    enemyPanel.body.append(grid);
  };
  const renderCollectionCards = (target, value, emptyText, where = '背包', options = {}) => {
    if (!hudRenderChanged(target.body,[value,where,options,hudReadOnly,hudInMatch(),state.pins,state.sellBatch,state.usePending,state.keychain,state.keyDurability,currentStatSnapshot?.渔具状态,currentStatSnapshot?.主角,currentStatSnapshot?.场景])) return;
    clear(target.body);
    const grid = make('div', 'hkm-reset-tiles');
    const list = entriesOf(value).filter(([, item]) => textOf(item?.名称, '无') !== '无' && textOf(item?.名称, '') !== '');

    const pins = asObject(state.pins);
    if (Object.keys(pins).length) {
      list.sort((left, right) => {
        const weightOf = row => (pins[textOf(itemByName(textOf(row[1]?.名称, ''))?.id, '') || textOf(row[1]?.名称, '')] ? 0 : 1);
        return weightOf(left) - weightOf(right);
      });
    }
    if (!list.length) grid.append(empty(emptyText));
    for (const [key, item] of list) {
      const rarity = textOf(item?.稀有度, '寻常');
      const name = textOf(item?.名称, key);
      const source = itemByName(name);

      const tile = make('div', 'hkm-reset-tile');
      tile.setAttribute('role', 'button');
      tile.tabIndex = 0;
      tile.style.borderLeftColor = hudTone(rarity);
      const gem = make('span', 'hkm-reset-tile-gem');
      gem.style.color = hudTone(rarity);
      const body = make('span', 'hkm-reset-tile-body');
      body.append(
        make('span', 'hkm-reset-tile-name', name),
        make('span', 'hkm-reset-tile-meta', '×' + textOf(item?.数量, '1') + ' · 价值 ' + hudDurableUnitValue(item,currentStatSnapshot,where==='散落'? '散落物品:'+key:where) + ' · 重量 ' + textOf(item?.重量, '0')),
      );
      const pinnedKey = textOf(source?.id, '') || name;
      const main = make('div', 'hkm-reset-tile-main');
      main.append(gem, body);
      if (asObject(state.pins)[pinnedKey]) main.append(make('span', 'hkm-reset-tile-pin', '★'));
      tile.append(main);

      hudAttachItemButtons(tile, source || { id: '', category: '' }, name, where);

      if (!hudReadOnly && hudBatchOf().open && where === hudBatchOf().where) {
        const pickActions = tile.querySelector('.hkm-reset-card-actions') || make('div', 'hkm-reset-card-actions');
        const add = make('button', 'hkm-reset-mini hkm-reset-plus', '＋');
        add.type = 'button';
        add.title = hudBatchOf().mode === 'store' ? '加入批量入库清单（不会立刻从背包移除）' : '加入批量出售清单（不会立刻从背包移除）';
        add.addEventListener('click', event => {
          event.stopPropagation();
          hudBatchAdjust(name, 1);
        });
        pickActions.append(add);

        if (Math.max(0, aiNum(hudBatchOf().list[name], 0)) > 0) {
          const less = make('button', 'hkm-reset-mini hkm-reset-minus', '−');
          less.type = 'button';
          less.title = '从待处理清单里减少一个（减到 0 就移出清单；物品不受影响）';
          less.addEventListener('click', event => {
            event.stopPropagation();
            hudBatchAdjust(name, -1);
          });
          pickActions.append(less);
        }
        if (!pickActions.parentNode) tile.append(pickActions);
      }
      hudAttachItemPanel(tile, name, '收藏品', { where, quantity: textOf(item?.数量, '1') }, { hover: true });
      grid.append(tile);
    }

    if (options.scroll) {
      const box = make('div', 'hkm-reset-scrollbox');
      box.append(grid);
      target.body.append(box);
    } else {
      target.body.append(grid);
    }
  };
  const questMetric = task => {
  const id = String(task?.id || '');
  const metrics = {
    'DAILY-02': { kind: 'player_kill' },
    'DAILY-05': { kind: 'extract_items' },
    'DAILY-10': { kind: 'extract_count' },
    'DAILY-17': { kind: 'extract_high_rarity', map: '任意任务地图', rarity: '奇异' },
    'MAIN-A-1': { kind: 'search', map: '谷歌大厦' },
    'MAIN-A-2': { kind: 'extract', map: '谷歌大厦', area: '天台撤离点' },
    'MAIN-B-1': { kind: 'search', map: '魔鬼海' },
    'MAIN-B-2': { kind: 'extract', map: '魔鬼海', area: '巨蚌钓台撤离点' },
    'MAIN-B-4': { kind: 'search', map: '魔鬼海', area: '古代文明遗迹' },
    'MAIN-B-5': { kind: 'extract_high_rarity', map: '魔鬼海', rarity: '至宝' },
    'MAIN-S-09': { kind: 'reputation_below', value: -50 },
    'MAIN-S-11': { kind: 'inventory_count', item: '一份精液' },
    'MAIN-S-18': { kind: 'stat_reach', path: '统计信息.经验人数' },
    'MATCH-GOOGLE-01': { kind: 'extract_category', category: '资料情报' },
  };
  return metrics[id] || null;
};

  const questHeroPlayerKills = run => {
    const players = Array.isArray(run?.players) ? run.players : [], seen = asObject(run?.fishingKills?.seen);
    const recorded = players.filter(player => seen[player.id] === 'hero' && player.alive === false && aiNum(player.hp, 0) <= 0).length;
    return Math.min(players.length, Math.max(recorded, Math.max(0, Math.floor(aiNum(run?.killCount, 0)))));
  };
  const questRewardEvidence = record => {
    const run = state.run, identity = hkm098RunId(run);
    if (!run || record?.接取对局标识 && record.接取对局标识 !== identity) return asObject(record?.结算证据);
    const players = Array.isArray(run.players) ? run.players : [], kills = questHeroPlayerKills(run);
    return {对局标识:identity,玩家击杀:kills,明确清图:players.length > 0 && kills === players.length && players.every(player => player.alive === false && aiNum(player.hp, 0) <= 0 && player.extracted !== true)};
  };
  const questRewardSpec = (task, stat = {}, record = {}) => {
  const text = String(task?.reward || '');
  const spec = { coins: 0, fame: 0, reputation: 0, items: [] };
  const coin = text.match(/(?:^|[^\d])(\d[\d,]*)\s*哈基币/);
  if (coin) spec.coins = Number(coin[1].replaceAll(',', '')) || 0;
  else if (String(task?.id || '') === 'DAILY-04') spec.coins = 150;
  const fame = text.match(/([+-]?\d+)\s*名望/);
  if (fame) spec.fame = Number(fame[1]) || 0;
  const reputation = text.match(/([+-]?\d+)\s*风评/);
  if (reputation) spec.reputation = Number(reputation[1]) || 0;
  if (task.id === 'DAILY-03' && record.语义完成 === true && asObject(record.已完成步骤)['2'] === true) spec.coins = 60;
  if (task.id === 'DAILY-04' && questRewardEvidence(record).明确清图 === true) spec.coins = 350;
  if (task.id === 'MATCH-GOOGLE-02') spec.coins = 50 * Math.max(0, Math.floor(aiNum(questRewardEvidence(record).玩家击杀, 0)) - Math.max(0, Math.floor(aiNum(record.接取玩家击杀, 0))));
  for (const name of ['幸运硬币', '小型氧气罐', '挂满避孕套的丁字裤']) {
    const match = text.match(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[×*]\\s*(\\d+)'));
    if (match) spec.items.push({ name, quantity: Math.max(1, Number(match[1]) || 1) });
  }
  if (task.id === 'MAIN-A-4') spec.items.push({name:'幸运硬币制作图纸',quantity:1});
  if (task.id === 'MAIN-A-5') {
    const rarity = Math.random() < .9 ? '奇异' : '至宝', pool = (GAME_DATA.lootTables?.谷歌大厦?.[rarity] || []).map(itemById).filter(Boolean);
    if (!pool.length) throw Error('任务奖励收藏品池为空。');
    spec.items.push({name:pool[Math.floor(Math.random() * pool.length)].name,quantity:1});
  }
  return spec;
};

  const questRecord = (task, stat = currentStatSnapshot) => {
  const metric = questMetric(task);
  const semantic = !metric || ['DAILY-17'].includes(String(task?.id || ''));
  return {
    任务ID: String(task.id || ''),
    类型: String(task.type || 'main'),
    任务名称: String(task.name || task.id || '无'),
    描述: String(task.description || '无'),
    报酬: String(task.reward || '无'),
    当前进度: 0,
    目标进度: Math.max(1, Number(task.target) || 1),
    进度单位: String(task.unit || '次'),
    进度说明: '未开始',
    进度: '0%',
    前端判定: semantic ? '语义' : '量化',
    接取消息楼层: Math.max(-1, Math.floor(aiNum(hudMessageApi()?.getLastMessageId?.(), mvuMessageId()))),
    结算周期: Math.max(0, Math.floor(aiNum(stat?.任务档案?.重复任务完成次数?.[task.id], 0))),
    ...(['DAILY-04','MATCH-GOOGLE-02'].includes(task.id) ? {接取对局标识:hkm098RunId(state.run),接取玩家击杀:questHeroPlayerKills(state.run)} : {}),
    ...(semantic ? { 语义目标: task.id === 'DAILY-03' ? '1. 必选：以仅穿内衣或全裸的样子在中转站绕广场一圈。\n2. 可选：完成本次绕行时全裸。' : String(task.description || ''), 语义进度: '未开始', 语义完成: false, 已完成步骤: {} } : {}),
  };
};

  const questTableForType = () => '任务';
  const questSemanticTask = task => !questMetric(task) || ['DAILY-17'].includes(String(task?.id || ''));
  const questAcceptancePatch = (stat, tasks) => {
  const patch = {};
  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (!task?.id || activeQuestIds(stat).has(String(task.id))) continue;
    const table = questTableForType(task.type);
    const rows = { ...asObject(patch[table] || stat?.[table]) };
    rows[String(task.id)] = questRecord(task, stat);
    patch[table] = rows;
  }
  return patch;
};

  const questRewardPatch = (stat, task, record = {}) => {
  const reward = questRewardSpec(task, stat, record);
  const stats = { ...asObject(stat?.统计信息) };
  stats.哈基币 = aiNum(stats.哈基币, 0) + reward.coins;
  stats.名望 = aiNum(stats.名望, 0) + reward.fame;
  stats.风评 = aiNum(stats.风评, 0) + reward.reputation;
  const bag = { ...asObject(stat?.背包), 携带收藏品: { ...asObject(stat?.背包?.携带收藏品) } };
  for (const grant of reward.items) {
    const item = itemByName(grant.name);
    if (item) aiGrantBucket(bag.携带收藏品, item, grant.quantity);
  }
  return { 统计信息: stats, 背包: bag };
};

  const questEventDelta = (task, metric, event, stat) => {
  if (!metric || !event) return null;
  const map = String(event.map || '');
  if (metric.kind === 'search') return map === metric.map ? Math.max(0, Number(event.count) || 0) : 0;
  if (metric.kind === 'extract') return map === metric.map && (!metric.area || String(event.area || '') === metric.area) ? 1 : 0;
  if (metric.kind === 'player_kill') return Math.max(0, Number(event.count) || 0);
  if (metric.kind === 'extract_items') return event.kind === 'extract' ? Math.max(0, Number(event.itemCount) || 0) : 0;
  if (metric.kind === 'extract_count') return event.kind === 'extract' ? 1 : 0;
  if (metric.kind === 'extract_high_rarity') {
    if (event.kind !== 'extract' || (metric.map !== '任意任务地图' && map !== metric.map)) return 0;
    return Array.isArray(event.broughtRows) && event.broughtRows.some(row => ['奇异', '至宝', '神秘'].includes(String(row.rarity || ''))) && (metric.rarity === '至宝' ? event.broughtRows.some(row => ['至宝', '神秘'].includes(String(row.rarity || ''))) : true) ? 1 : 0;
  }
  if (metric.kind === 'extract_category') {
    return event.kind === 'extract' ? event.broughtRows.filter(row => String(row.category || '').includes(metric.category)).reduce((sum, row) => sum + Math.max(0, Number(row.quantity) || 0), 0) : 0;
  }
  if (metric.kind === 'reputation_below') return aiNum(stat?.统计信息?.风评, 0) <= metric.value ? Math.max(0, Number(task.target) || 1) : 0;
  if (metric.kind === 'inventory_count') return Object.values(asObject(stat?.背包?.携带收藏品)).filter(row => String(row?.名称 || '') === metric.item).reduce((sum, row) => sum + Math.max(0, Number(row?.数量) || 0), 0);
  if (metric.kind === 'stat_reach') return Math.max(0, Number(readPath(stat, metric.path)) || 0);
  return 0;
};

  const questProgressPatch = (stat, event, basePatch = {}) => {
  const patch = {};
  const completed = { ...asObject(stat?.任务档案?.已完成任务) };
  const repeats = { ...asObject(stat?.任务档案?.重复任务完成次数) };
  const active = {};
  {
    const table = '任务';
    const rows = { ...asObject(stat?.[table]) };
    let changed = false;
    for (const [id, raw] of Object.entries(rows)) {
      const task = questById?.get(String(raw?.任务ID || id));
      const metric = questMetric(task);
      if (!task || !metric || questSemanticTask(task)) {
        if (task && event?.kind === 'extract' && ['DAILY-04','MATCH-GOOGLE-02'].includes(task.id)) { rows[id] = {...raw,结算证据:questRewardEvidence(raw)}; changed = true; }
        active[table] = rows; continue;
      }
      const delta = questEventDelta(task, metric, event, { ...stat, ...basePatch });
      if (delta == null || delta <= 0) { active[table] = rows; continue; }
      const current = Math.max(0, Number(raw?.当前进度) || 0);
      const target = Math.max(1, Number(raw?.目标进度) || Number(task.target) || 1);
      const nextCurrent = Math.min(target, Math.max(current, metric.kind === 'inventory_count' || metric.kind === 'stat_reach' || metric.kind === 'reputation_below' ? delta : current + delta));
      const next = { ...raw, 当前进度: nextCurrent, 目标进度: target, 进度: Math.round(nextCurrent * 100 / target) + '%', 进度说明: '前端已结算 ' + nextCurrent + ' / ' + target + ' ' + String(raw?.进度单位 || task.unit || '次') };
      if (nextCurrent >= target) {
        delete rows[id];
        if (task.type === 'main') completed[id] = true;
        else repeats[id] = Math.max(0, Number(repeats[id]) || 0) + 1;
        const reward = questRewardPatch({ ...stat, ...basePatch, ...patch }, task);
        for (const [key, value] of Object.entries(reward)) patch[key] = value;
      } else rows[id] = next;
      changed = true;
    }
    if (changed || Object.keys(rows).length) patch[table] = rows;
    active[table] = rows;
  }
  if (Object.keys(completed).length || Object.keys(repeats).length) patch.任务档案 = { ...asObject(stat?.任务档案), 已完成任务: completed, 重复任务完成次数: repeats };
  return patch;
};

  const activeQuestIds = stat => {
  const result = new Set();
  for (const [recordKey, value] of Object.entries(asObject(stat?.任务))) {
    const id = String(value?.任务ID || recordKey || '');
    if (id && value?.任务名称 !== '无') result.add(id);
  }
  return result;
};

  const questUnlockSatisfied = (task, stat, context = {}) => {
  const rule = task?.unlock || {};
  const archive = stat?.任务档案 || {};
  const completed = archive.已完成任务 || {};
  const tags = archive.任务条件标签 || {};
  const protagonist = stat?.主角 || {};
  const mapName = String(context.mapName ?? stat?.场景?.地图 ?? '');
  const area = String(context.area ?? stat?.场景?.区域 ?? '');
  const historyGames = Math.max(0, Math.floor(Number(stat?.统计信息?.历史对局总数) || 0));
  if ((rule.completedAll || []).some(id => completed[id] !== true)) return false;
  if (rule.completedAny?.length) {
    const need = Math.max(1, Number(rule.completedAnyCount) || 1);
    if (rule.completedAny.filter(id => completed[id] === true).length < need) return false;
  }
  if (rule.gender) {
    const value = String(protagonist.性别 || '').toLowerCase();
    const female = value === '女性' || value === '女' || value === 'female' || value === 'f';
    if (rule.gender === 'female' && !female) return false;
  }
  if (rule.virginState && String(protagonist.处女状态 || '未知') !== String(rule.virginState)) return false;
  if (rule.conditionTag && tags[rule.conditionTag] !== true) return false;
  if (rule.minHistoryGames != null && historyGames < Math.max(0, Number(rule.minHistoryGames) || 0)) return false;
  if (rule.map && mapName !== rule.map) return false;
  if (rule.area && area !== rule.area) return false;
  return true;
};

  const weightedSample = (tasks, count, rng = Math.random) => {
  const pool = tasks.map(task => ({ task, weight: Math.max(0, Number(task.weight) || 0) }));
  const result = [];
  while (pool.length && result.length < count) {
    const total = pool.reduce((sum, row) => sum + row.weight, 0);
    let index = 0;
    if (total > 0) {
      let needle = Math.max(0, Math.min(0.999999999, Number(rng()) || 0)) * total;
      for (let i = 0; i < pool.length; i += 1) {
        needle -= pool[i].weight;
        if (needle < 0) { index = i; break; }
      }
    } else {
      index = Math.floor(Math.max(0, Math.min(0.999999999, Number(rng()) || 0)) * pool.length);
    }
    result.push(pool.splice(index, 1)[0].task);
  }
  return result;
};

  const rollBattleTasks = (tasks, mapName, rng = Math.random) => tasks
  .filter(task => task.type === 'battle' && task.map === mapName)
  .filter(task => Math.max(0, Math.min(1, Number(task.probability) || 0)) >= (Number(rng()) || 0));

  const normalizeQuestState = raw => {
  const value = raw && typeof raw === 'object' ? raw : {};
  return {
    schemaVersion: 1,
    daily: {
      historyGames: Number.isFinite(Number(value.daily?.historyGames)) ? Number(value.daily.historyGames) : null,
      candidateIds: Array.isArray(value.daily?.candidateIds) ? [...new Set(value.daily.candidateIds.map(String))] : [],
    },
    battle: {
      runKey: String(value.battle?.runKey || ''),
      map: String(value.battle?.map || ''),
      rolledIds: Array.isArray(value.battle?.rolledIds) ? [...new Set(value.battle.rolledIds.map(String))] : [],
    },
    pendingIds: Array.isArray(value.pendingIds) ? [...new Set(value.pendingIds.map(String))] : [],
  };
};

  const syncQuestSnapshots = (raw, tasks, stat, context = {}, rng = Math.random) => {
  const next = normalizeQuestState(raw);
  let changed = false;
  const historyGames = Math.max(0, Math.floor(Number(stat?.统计信息?.历史对局总数) || 0));
  if (next.daily.historyGames !== historyGames) {
    next.daily.historyGames = historyGames;
    next.daily.candidateIds = weightedSample(
      tasks.filter(task => task.type === 'daily' && questUnlockSatisfied(task, stat, context)),
      2,
      rng,
    ).map(task => task.id);
    changed = true;
  }
  const mapName = String(context.mapName ?? stat?.场景?.地图 ?? '');
  const isMission = mapName && mapName !== '哈基米空间';
  const runKey = isMission ? `${historyGames}:${mapName}` : '';
  if (isMission && next.battle.runKey !== runKey) {
    next.battle = { runKey, map: mapName, rolledIds: rollBattleTasks(tasks, mapName, rng).map(task => task.id) };
    changed = true;
  }
  return { state: next, changed };
};

  const buildAcceptanceInjection = (original, tasks, semanticTasks = []) => {
  const accepted = (Array.isArray(tasks) ? tasks : []).filter(task => questSemanticTask(task));
  const contextTasks = [...semanticTasks, ...accepted].filter(Boolean).reduce((map, task) => {
    const id = String(task.id || task.任务ID || '');
    if (!id) return map;
    const record = task.任务ID ? task : questRecord(task);
    map.set(id, {
      id,
      name: String(record.任务名称 || task.name || id),
      goal: String(record.语义目标 || record.描述 || task.description || ''),
      progress: String(record.语义进度 || record.进度说明 || '未开始'),
    });
    return map;
  }, new Map());
  if (!contextTasks.size) return String(original || '');
  const payload = JSON.stringify({
    acceptedTasks: accepted.map(task => ({
      id: String(task.id),
      type: String(task.type || 'main'),
      name: String(task.name || task.id),
      semanticGoal: String(task.description || ''),
    })),
    semanticTasks: [...contextTasks.values()],
  });
  return `${String(original || '')}\n\n<HkmQuestContext version="2">\n${payload}\n</HkmQuestContext>`;
};

  const prepareQuestAttachment = ({ original, pendingTasks = [], additionalTasks = [], semanticTasks = [], gearChanges = [], useRecords = [], itemMoves = {}, insuranceLog = {}, frontendInput = false, coveredSettlementIds = [], actionPenalty = {}, bagChanges = {}, initialContext = '', frontendAction = 'records' }) => {
  const merged = new Map();
  for (const task of [...(Array.isArray(pendingTasks) ? pendingTasks : []), ...(Array.isArray(additionalTasks) ? additionalTasks : [])]) {
    if (task?.id) merged.set(String(task.id), task);
  }
  const tasks = [...merged.values()];
  const changes = (Array.isArray(gearChanges) ? gearChanges : []).filter(change => change && textOf(change.部位, ''));
  let message = '';
  if (tasks.length || semanticTasks.length) message = buildAcceptanceInjection(message, tasks, semanticTasks);
  const covered=frontendInput ? new Set(Array.isArray(coveredSettlementIds) ? coveredSettlementIds : []) : new Set();
  const coveredLog=Object.fromEntries(Object.entries(asObject(insuranceLog)).filter(([key,text])=>covered.has(key) && textOf(text,'')));
  const visibleLog=Object.fromEntries(Object.entries(asObject(insuranceLog)).filter(([key])=>!covered.has(key)));
  const changeLog = buildChangeLogInjection(message, changes, useRecords, itemMoves, visibleLog, actionPenalty, bagChanges);
  const insuranceKeys=[...changeLog.insuranceKeys,...Object.keys(coveredLog)];
  const generated=[initialContext,changeLog.message].filter(value=>String(value || '').trim()).join('\n\n');
  message = frontendInput ? HkmFrontendMessage.wrap(HkmFrontendMessage.action(String(original || '')+(generated?'\n\n'+generated:''),frontendAction)) : HkmFrontendMessage.append(original,generated,initialContext?'run_context':'records');
  return {
    message,
    consumedActionSnapshot: actionPenalty,
    consumedBagSnapshot: hkm140BagSnapshot(bagChanges),
    consumedMoveNames: changeLog.moveNames,
    taskIds: tasks.map(task => String(task.id)),
    consumedPendingIds: (Array.isArray(pendingTasks) ? pendingTasks : []).map(task => String(task?.id || '')).filter(id => id && merged.has(id)),
    consumedGearSlots: changes.map(change => textOf(change.部位, '')),
    consumedUseIds: changeLog.useIds,
    consumedInsuranceKeys: insuranceKeys,
    consumedInsuranceSnapshot: Object.fromEntries(insuranceKeys.map(key=>[key,insuranceLog[key]])),
  };
};




  const buildChangeLogInjection = (original, changes, useRecords, itemMoves = {}, insuranceLog = {}, actionPenalty = {}, bagChanges = {}) => {
  const gear = (Array.isArray(changes) ? changes : []).filter(change => change && textOf(change.部位, ''));
  const uses = useRecordsOf(useRecords).filter(record => record.sent !== true);

  const moves = Object.entries(itemMovesOf(itemMoves))
    .filter(([, row]) => textOf(row?.start, '') && textOf(row?.start, '') !== textOf(row?.to, ''))
    .map(([name, row]) => ({ name, from: textOf(row.from, ''), to: textOf(row.to, '') }));
  const lines = [];
  if (gear.length) {
    lines.push('装备记录：');
    for (const change of gear) {
      const current = textOf(change.当前, '无') || '无';
      const origin = textOf(change.原始, '无') || '无';
      const label = current === '无'
        ? '卸下「' + origin + '」'
        : (origin === '无' ? '换上「' + current + '」' : '换上「' + current + '」、换下「' + origin + '」');
      const item = itemByName(current==='无' ? origin : current) || {};
      lines.push('- ' + hudPlayerName(currentStatSnapshot) + '选择' + label + '（' + textOf(item.rarity,'未知') + '；部位：' + textOf(change.部位,'') + '）');
    }
  }
  const ordinaryUses = uses.filter(record => record.useClass !== 'activeSkill');
  if (ordinaryUses.length) {
    lines.push('使用：');
    for (const text of new Set(ordinaryUses.map(record => record.text))) lines.push('- ' + text);
  }
  if (moves.length) {
    lines.push('物品移动：');
    for (const row of moves) lines.push('- ' + hudPlayerName(currentStatSnapshot) + '选择将「' + row.name + '」从' + row.from + '移至' + row.to + '。');
  }

  const insurances = Object.entries(asObject(insuranceLog)).filter(([key,text])=>!hkmSilentSettlement(key,text)).map(([key, text]) => ({ key, text: textOf(text, '') })).filter(row => row.text);
  const ordinaryInsurances=insurances.filter(row=>!row.key.startsWith('player-leave:'));
  if (ordinaryInsurances.length) {
    lines.push('已结算记录：');
    for (const text of new Set(ordinaryInsurances.map(row=>row.text))) lines.push('- '+text);
  }
  lines.push(...new Set(insurances.filter(row=>row.key.startsWith('player-leave:')).map(row=>row.text)));



  lines.push(...hkm140BagLines(bagChanges));
  const penaltyText = hkmActionPenaltyText(actionPenalty);
  if (penaltyText) lines.push('战斗行动修正：', '- ' + penaltyText);
  const skillBlocks = [...new Set(uses.filter(record => record.useClass === 'activeSkill').map(record => record.text))].join('\n');
  if (!lines.length && !skillBlocks) return { message: String(original || ''), useIds: [], moveNames: [], insuranceKeys: [] };
  const block = (lines.length ? '<HkmChangeLog version="2">\n' + lines.join('\n') + '\n</HkmChangeLog>' : '') + (skillBlocks ? '\n' + skillBlocks : '');
  return { message: String(original || '') + '\n\n' + block, useIds: uses.map(record => record.id), moveNames: moves.map(row => row.name), insuranceKeys: insurances.map(row => row.key) };
};

  const injectPendingBeforeGeneration = ({ type, dryRun, tasks, gearChanges = [], useRecords = [], itemMoves = {}, insuranceLog = {}, original, write }) => {
  if (dryRun || ['regenerate', 'swipe', 'quiet', 'continue', 'impersonate'].includes(String(type || ''))) return { applied: false, reason: 'non_native_generation' };
  const hasTasks = Array.isArray(tasks) && tasks.length > 0;
  const changes = (Array.isArray(gearChanges) ? gearChanges : []).filter(change => change && textOf(change.部位, ''));
  const uses = useRecordsOf(useRecords).filter(record => record.sent !== true);
  const moves = itemMovesOf(itemMoves);
  const insurances = asObject(insuranceLog);
  if (!hasTasks && !changes.length && !uses.length && !Object.keys(moves).length && !Object.keys(insurances).length) return { applied: false, reason: 'no_pending_tasks' };
  if (!String(original || '').trim()) return { applied: false, reason: 'empty_native_input' };
  if (String(original).includes('<HkmQuestAcceptance version="') || String(original).includes('<HkmChangeLog version="') || String(original).includes('<HkmGearChange version="')) return { applied: false, reason: 'already_injected' };
  const prepared = prepareQuestAttachment({ original, pendingTasks: hasTasks ? tasks : [], gearChanges: changes, useRecords: uses, itemMoves: moves, insuranceLog: insurances });
  if (typeof write !== 'function' || write(prepared.message) !== true) return { applied: false, reason: 'write_failed', injected: prepared.message };
  return { applied: true, reason: 'injected', injected: prepared.message, prepared };
};

  const taskProgressValues = item => {
    const current = Math.max(0, Number(item?.当前进度) || 0);
    const target = Math.max(1, Number(item?.目标进度) || 1);
    return { current, target, percent: Math.max(0, Math.min(100, current * 100 / target)) };
  };
  const appendProgress = (card, item) => {
    const progress = taskProgressValues(item);
    const unit = textOf(item?.进度单位, '次');
    const label = make('div', 'hkm-reset-progress-label', progress.current + ' / ' + progress.target + ' ' + unit);
    const track = make('div', 'hkm-reset-progress-track');
    const fill = make('div', 'hkm-reset-progress-fill');
    fill.style.width = progress.percent + '%';
    track.append(fill);
    card.append(label, track);
    const note = textOf(item?.进度说明, textOf(item?.进度, ''));
    if (note) card.append(make('p', 'hkm-reset-small', '进度说明：' + note));
  };
  const questCatalog = Array.isArray(GAME_DATA.tasks) ? GAME_DATA.tasks : [];
  const questById = new Map(questCatalog.map(task => [task.id, task]));
  const displayTaskRows = stat => {
    const rows = [];
    for (const [key, raw] of entriesOf(stat?.任务)) {
      const item = asObject(raw);
      const name = textOf(item.任务名称, '');
      if (!name || name === '无') continue;
      const type = textOf(item.类型, 'main');
      const label = ({ main: '主线', daily: '日常', battle: '战局', commission: '委托' })[type] || '任务';
      rows.push({ id: textOf(item.任务ID, key), type, label, item });
    }
    return rows;
  };
  const pendingQuestIds = () => normalizeQuestState(state.tasks).pendingIds;
  const commitQuestState = next => {
    state.tasks = normalizeQuestState(next);
    saveFrontendState(state);
  };
  const syncQuestState = (stat, context) => {
    const synced = syncQuestSnapshots(state.tasks, questCatalog, stat, context);
    if (synced.changed || !state.tasks) commitQuestState(synced.state);
    else state.tasks = synced.state;
    return synced.state;
  };
  const frontendSendGuardKey = '__HKM_FRONTEND_MESSAGE_SEND_DEPTH_V013__';
  const setFrontendMessageSendGuard = active => {
    const hostWindow = window.parent && window.parent !== window ? window.parent : window;
    const depth = Math.max(0, Number(hostWindow[frontendSendGuardKey]) || 0);
    hostWindow[frontendSendGuardKey] = active ? depth + 1 : Math.max(0, depth - 1);
  };
  const preparePendingQuestAttachment = (message, additionalTasks = [], frontendInput = false, coveredSettlementIds = [], stat = currentStatSnapshot, frontendAction = 'records') => {
    const latest = readFrontendState();
    const equipment={...Object.fromEntries(HkmEquipment.slots.filter(slot=>stat?.装备?.[slot] && stat.装备[slot]!=='无').map(slot=>{const name=stat.装备[slot],item=hkm098Resolve(name);return [slot,{名称:name,...(item?{描述:item.description,特性:(item.traits || []).filter(row=>HKM_ATTR_REGISTRY.traits[row.id]?.scope==='llm' || HKM_ATTR_REGISTRY.traits[row.id]?.informLlm),技能:item.skills || []}:{})}];})),_前端处理:hkm163Marker(stat,latest),_待结算:[]};
    const initial=HkmRunContext.peek(stat || {},latest,HkmSave.identity(),equipment);
    const allActions = hkmActionPenaltyOf(latest.actionPenalty).events;
    const blocked = Object.values(allActions).find(event => event.kind === 'blockedEscape');
    if (blocked) {
      const log = asObject(latest.insuranceLog),text=[blocked.text,initial.text].filter(Boolean).join('\n\n');
      return {
        message: frontendInput ? HkmFrontendMessage.wrap(HkmFrontendMessage.action(text,'blocked_escape')) : HkmFrontendMessage.append(message,text,'blocked_escape'),
        consumedRunContext:initial.receipt,
        consumedActionSnapshot: allActions, consumedPendingIds: [], consumedGearSlots: Object.keys(gearPendingOf(latest.gearPending)),
        consumedUseIds: useRecordsOf(latest.usePending).filter(row => !row.sent).map(row => row.id), consumedMoveNames: Object.keys(asObject(latest.itemMoves)),
        consumedInsuranceKeys: Object.keys(log), consumedInsuranceSnapshot: { ...log }, taskIds: [],
      };
    }
    const pendingIds = normalizeQuestState(latest.tasks).pendingIds;
    const semanticTasks = displayTaskRows(stat)
      .map(row => ({ ...questById.get(row.id), ...row.item, id: row.id }))
      .filter(task => questSemanticTask(task));
    return {...prepareQuestAttachment({
      original: String(message || ''), frontendInput, coveredSettlementIds, initialContext:initial.text, frontendAction,
      pendingTasks: pendingIds.map(id => questById.get(id)).filter(Boolean),
      additionalTasks,
      semanticTasks,
      gearChanges: Object.values(gearPendingOf(latest.gearPending)),
      useRecords: useRecordsOf(latest.usePending),
      itemMoves: asObject(latest.itemMoves),
      insuranceLog: asObject(latest.insuranceLog),
      actionPenalty: hkmActionPenaltySnapshot(latest, stat),
      bagChanges: asObject(latest.playerBagPending),
    }),consumedRunContext:initial.receipt};
  };
  const finalizePendingQuestAttachment = (consumedIds, consumedGearSlots = [], consumedUseIds = [], consumedMoveNames = [], consumedInsuranceKeys = [], consumedInsuranceSnapshot = {}, allowSend = false, consumedActionSnapshot = {}, consumedBagSnapshot = {}, consumedRunContext = null) => {
    const consumed = new Set(Array.isArray(consumedIds) ? consumedIds : []);
    const slots = new Set((Array.isArray(consumedGearSlots) ? consumedGearSlots : []).map(slot => textOf(slot, '')).filter(Boolean));
    const useIds = new Set((Array.isArray(consumedUseIds) ? consumedUseIds : []).map(id => textOf(id, '')).filter(Boolean));


    const moveNames = new Set((Array.isArray(consumedMoveNames) ? consumedMoveNames : []).map(name => textOf(name, '')).filter(Boolean));

    const insuranceKeys = new Set((Array.isArray(consumedInsuranceKeys) ? consumedInsuranceKeys : []).map(key => textOf(key, '')).filter(Boolean));
    if (!consumed.size && !slots.size && !useIds.size && !moveNames.size && !insuranceKeys.size && !Object.keys(asObject(consumedActionSnapshot)).length && !Object.keys(asObject(consumedBagSnapshot)).length && !consumedRunContext) return;
    const latest = readFrontendState();
    const next = normalizeQuestState(latest.tasks);
    next.pendingIds = next.pendingIds.filter(id => !consumed.has(id));
    const gearPending = gearPendingOf(latest.gearPending);
    for (const slot of slots) delete gearPending[slot];

    const usePending = useRecordsOf(latest.usePending).map(record => (useIds.has(record.id) ? { ...record, sent: true } : record));
    const itemMoves = asObject(latest.itemMoves);
    for (const name of moveNames) delete itemMoves[name];
    latest.itemMoves = itemMoves;
    const acknowledged=acknowledgeSettlement(latest,consumedInsuranceSnapshot);
    const insuranceLog=acknowledged.insuranceLog;
    latest.insuranceLog=insuranceLog;
    latest.settleAcks=acknowledged.settleAcks;
    latest.tasks = next;
    latest.gearPending = gearPending;
    latest.usePending = usePending;
    hkmActionPenaltyAcknowledge(latest, consumedActionSnapshot);
    hkm140BagAcknowledge(latest, consumedBagSnapshot);
    HkmRunContext.acknowledge(latest,consumedRunContext,HkmSave.identity());
    state.runContextReceipt=latest.runContextReceipt;
    saveFrontendState(latest, allowSend);
    state.actionPenalty = latest.actionPenalty;
    state.playerBagPending = latest.playerBagPending;
    state.playerBagAcks = latest.playerBagAcks;
    state.tasks = next;
    state.gearPending = gearPending;
    state.usePending = usePending;

    state.itemMoves = itemMoves;
    state.insuranceLog = insuranceLog;
    state.settleAcks = latest.settleAcks;
    if (currentStatSnapshot) renderTasks(currentStatSnapshot);
  };
  const nativeHookKey = '__HKM_QUEST_BEFORE_GENERATION_V095__';
  const installNativeQuestInterceptor = () => {
    try {
      const hostWindow=window.parent || window, hostDocument=hostWindow.document;
      const context=hostWindow.SillyTavern?.getContext?.(), eventSource=context?.eventSource, types=context?.eventTypes;
      if (!isLatestHudLayer() || !eventSource?.on || !types?.GENERATION_AFTER_COMMANDS || !types?.MESSAGE_SENT) return false;
      for (const old of ['__HKM_QUEST_NATIVE_SEND_V011__','__HKM_QUEST_BEFORE_GENERATION_V012__','__HKM_QUEST_BEFORE_GENERATION_V013__']) {
        hostWindow[old]?.destroy?.();
      }
      const api={
        floor:hkmTurnOrigin,
        sent:()=>{ if (hkmTurnHasUser()) { hkmTurnPhase='sent'; hkmTurnSyncUI(); } },
        prepare: async original=>{ hkm098RequireAlive(); const stat=await hkm160PrepareSend(true); hkm098RequireAlive(); return preparePendingQuestAttachment(original, [], false, [], stat); },
        clear: async prepared=>{
          finalizePendingQuestAttachment(prepared.consumedPendingIds,prepared.consumedGearSlots,prepared.consumedUseIds,prepared.consumedMoveNames,prepared.consumedInsuranceKeys,prepared.consumedInsuranceSnapshot,true,prepared.consumedActionSnapshot,prepared.consumedBagSnapshot,prepared.consumedRunContext);
          await hkm095Flush();
        },
        report: text=>setStatus(text),
      };
      disposers.push(() => {
        if (hostWindow[nativeHookKey]?.api === api) hostWindow[nativeHookKey].destroy?.();
      });
      const existing=hostWindow[nativeHookKey];
      if (existing?.version===160) { if(existing.api?.floor!==api.floor){existing.waiting=null;existing.intentAt=0;} existing.api=api; return true; }
      existing?.destroy?.();
      const hook={version:160,api,waiting:null,intentAt:0,serial:0,busy:false};
      const currentContext=()=>hostWindow.SillyTavern?.getContext?.();
      const captureIntent=event=>{
        if (event.type==='click' && event.target.closest?.('#send_but')) hook.intentAt=Date.now();
        if (event.type==='keydown' && event.target.id==='send_textarea' && event.key==='Enter' && !event.shiftKey && !event.isComposing) hook.intentAt=Date.now();
        if (hook.waiting && hook.intentAt && !String(hostDocument.querySelector('#send_textarea')?.value || '').includes('revision="'+hook.waiting.revision+'"')) hook.waiting=null;
      };
      const before=async (type,params,dryRun)=>{
        if (hook.busy || hook.waiting || Number(hostWindow[frontendSendGuardKey])>0 || dryRun || ['regenerate','swipe','quiet','continue','impersonate'].includes(String(type || ''))) return;
        if (!hook.intentAt || Date.now()-hook.intentAt>12000) return;
        const textarea=hostDocument.querySelector('#send_textarea'), original=String(textarea?.value || '');
        if (!original.trim() || /<Hkm(?:QuestAcceptance|ChangeLog|PendingReceipt)\b/.test(original)) return;
        const chat=currentContext()?.chatId;
        if (!chat) return;
        hook.busy=true;
        let injectedMessage=null;
        try {
          hook.intentAt=0;
          const prepared=await hook.api.prepare(original);
          if (prepared.message===original) return;
          if (currentContext()?.chatId !== chat || textarea.value !== original) return;
          const revision='hkm095-'+Date.now()+'-'+(++hook.serial);
          const message=HkmFrontendMessage.receipt(prepared.message,revision);
          injectedMessage=message;
          textarea.value=message; textarea.dispatchEvent(new hostWindow.Event('input',{bubbles:true}));
          if (textarea.value!==message) throw Error('输入框写回失败');
          if (params && typeof params==='object') params.prompt=message;
          hook.waiting={chat,revision,prepared};
          hook.intentAt=0;

        } catch (error) {
          if (currentContext()?.chatId === chat && injectedMessage !== null && textarea.value === injectedMessage) { textarea.value=original; textarea.dispatchEvent(new hostWindow.Event('input',{bubbles:true})); }
          hook.waiting=null; hook.api.report('注入失败，待发记录保留：'+error.message);
          throw error;
        } finally { hook.busy=false; }
      };
      const sent=async id=>{
        const tx=hook.waiting, now=currentContext();
        hook.api.sent();
        if (!tx || !receiptMatches({message:now?.chat?.[id],revision:tx.revision,originChat:tx.chat,currentChat:now?.chatId})) return;
        hook.waiting=null;
        try { await hook.api.clear(tx.prepared); }
        catch (error) { hook.api.report('消息已创建，但待发记录持久化未确认：'+error.message); }
      };
      const changed=()=>{hook.waiting=null;hook.intentAt=0;};
      hostDocument.addEventListener('click',captureIntent,true);
      hostDocument.addEventListener('keydown',captureIntent,true);
      eventSource.on(types.GENERATION_AFTER_COMMANDS,before);
      eventSource.on(types.MESSAGE_SENT,sent);
      if(types.CHAT_CHANGED)eventSource.on(types.CHAT_CHANGED,changed);
      hook.destroy=()=>{
        hostDocument.removeEventListener('click',captureIntent,true);hostDocument.removeEventListener('keydown',captureIntent,true);
        eventSource.removeListener?.(types.GENERATION_AFTER_COMMANDS,before);eventSource.removeListener?.(types.MESSAGE_SENT,sent);
        if(types.CHAT_CHANGED)eventSource.removeListener?.(types.CHAT_CHANGED,changed);
        if(hostWindow[nativeHookKey]===hook)delete hostWindow[nativeHookKey];
      };
      hostWindow[nativeHookKey]=hook;return true;
    } catch (_) {return false;}
  };
  let nativeQuestHookReady = installNativeQuestInterceptor();
  const queueQuest = (task, stat) => {
    nativeQuestHookReady = installNativeQuestInterceptor();
    const active = activeQuestIds(stat);
    const next = normalizeQuestState(state.tasks);
    if (active.has(task.id) || next.pendingIds.includes(task.id)) return;
    const activeMain = displayTaskRows(stat).filter(row => row.type === 'main').length;
    const pendingMain = next.pendingIds.filter(id => questById.get(id)?.type === 'main').length;
    const activeDaily = displayTaskRows(stat).filter(row => row.type === 'daily').length;
    const pendingDaily = next.pendingIds.filter(id => questById.get(id)?.type === 'daily').length;
    const total = displayTaskRows(stat).length + next.pendingIds.length;
    if (total >= 6 || (task.type === 'main' && activeMain + pendingMain >= 4) || (task.type === 'daily' && activeDaily + pendingDaily >= 2)) {
      setStatus('任务栏容量不足：总计最多6个，其中主线最多4个、日常最多2个。');
      return;
    }
    const patch = questAcceptancePatch(stat, [task]);
    hkm098Transact('quest-accept:' + task.id + ':' + Date.now(), patch, {}, '接取任务：' + task.name + '。')
      .then(async () => { await refresh(); setStatus('已接取“' + task.name + '”。'); })
      .catch(error => setStatus('接取失败：' + error.message));
  };
  const cancelPendingQuest = (id, stat) => {
    const next = normalizeQuestState(state.tasks);
    next.pendingIds = next.pendingIds.filter(value => value !== id);
    commitQuestState(next);
    renderTasks(stat);
  };
  const availableQuestRows = stat => {
    const context = { mapName: currentContext.mapName, area: currentContext.area };
    const active = activeQuestIds(stat);
    const completed = asObject(asObject(stat?.任务档案).已完成任务);
    const snapshots = normalizeQuestState(state.tasks);
    const dailySet = new Set(snapshots.daily.candidateIds);
    const battleSet = new Set(snapshots.battle.rolledIds);
    return questCatalog.filter(task => {
      if (active.has(task.id) || snapshots.pendingIds.includes(task.id)) return false;
      if (!task.repeatable && completed[task.id] === true) return false;
      if (task.type === 'daily' && !dailySet.has(task.id)) return false;
      if (task.type === 'battle' && !battleSet.has(task.id)) return false;
      if (task.autoAccept) return false;
      return questUnlockSatisfied(task, stat, context);
    });
  };
  const renderQuestCard = (task, stat, pending = false) => {
    const card = make('article', 'hkm-reset-card hkm-reset-task ' + (pending ? 'hkm-reset-task-pending' : ''));
    const meta = make('div', 'hkm-reset-card-meta');
    meta.append(make('span', 'hkm-reset-chip', ({ main: '主线', daily: '日常', battle: '战局', commission: '委托' })[task.type] || '任务'));
    card.append(make('h4', '', task.name), meta, make('p', '', task.description), make('p', 'hkm-reset-small', '报酬：' + task.reward));
    if (task.unlockText) card.append(make('p', 'hkm-reset-small', '接取条件：' + task.unlockText));
    const actions = make('div', 'hkm-reset-task-action-row');
    const button = make('button', 'hkm-reset-task-action' + (pending ? ' hkm-reset-task-cancel' : ''), pending ? '撤销暂存' : '接取任务');
    button.type = 'button';
    button.disabled = false;
    button.addEventListener('click', () => pending ? cancelPendingQuest(task.id, stat) : queueQuest(task, stat));
    actions.append(button); card.append(actions);
    return card;
  };
  const renderTasks = stat => hkmPagedTasks(stat);
  const renderStats = stat => hkmPagedStats(stat);

  const readPath = (value, dottedPath) => dottedPath.split('.').reduce((current, key) => asObject(current)[key], value);
  const completedTasks = stat => asObject(asObject(stat.任务档案).已完成任务);
  const isTaskCompleted = (stat, taskId, taskName) => {
    const completed = completedTasks(stat);
    return completed[taskId] === true || completed[taskId] === 'true' || completed[taskName] === true || completed[taskName] === 'true';
  };
  const evaluateUnlock = (unlock, stat) => {
    if (!unlock) return { allowed: true, label: '已解锁' };
    if (unlock.kind === 'stat_min') return { allowed: Number(readPath(stat, unlock.path)) >= Number(unlock.min), label: unlock.label };
    if (unlock.kind === 'completed_task') return { allowed: isTaskCompleted(stat, unlock.taskId, unlock.taskName), label: unlock.label };
    return { allowed: false, label: unlock.label || '未知解锁条件' };
  };
const hkm130TradeContract = (raw, market) => {
  if (!raw || !/^[\w:.-]{1,80}$/.test(raw.id || '')) return null;
  const booth = market.booths.find(row => row.id === raw.boothId);
  if (!booth || !Array.isArray(raw.items) || !raw.items.length || raw.items.length > 3 || !Array.isArray(raw.steps) || raw.steps.length > 20) return null;
  const items = [], seen = new Set();
  for (const row of raw.items) {
    const stock = booth.items.find(stock => stock.id === row?.itemId && !stock.sold);
    const item = stock && resolveTradeStock(stock);
    if (!item || seen.has(item.id) || row.quantity !== 1) return null;
    seen.add(item.id); items.push({item:HkmLifecycle.copy(item),quantity:1,askingPrice:stock.askingPrice});
  }
  const quote = items.reduce((sum,row) => sum + row.askingPrice * row.quantity, 0);
  const price = raw.price;
  if (!Number.isSafeInteger(price) || price < 0 || price > Math.ceil(quote * (booth.personality === '重利' ? 1.6 : 1))) return null;
  let maxDiscount = booth.personality === '弱气' ? quote * .15 : booth.personality === '理性' ? quote * .30 : 0;
  if (booth.personality === '好色') {
    const plans = {touch:[.10,200],private15:[.15,200],private20:[.20,200],private25:[.25,200],private30:[.30,200],hotel:[.60,1000],longterm:[.85,Infinity],bulk:[.85,Infinity]};
    const plan = plans[raw.plan]; if (!plan) return null;
    maxDiscount = Math.min(quote * plan[0], plan[1]);
  }
  if (price < Math.ceil(quote - maxDiscount)) return null;
  const steps = raw.steps.map(text => typeof text === 'string' ? text.trim() : '').filter(Boolean);
  if (steps.length !== raw.steps.length || steps.some(text => text.length > 800)) return null;
  const name = items.map(row => row.item.name).join('、');
  return {
    任务ID:raw.id, 类型:'commission', 任务名称:'临时交易契约·' + name,
    描述:steps.concat('缴纳 ' + price + ' 哈基币。').map((step,i) => (i+1) + '. ' + step).join('\n'),
    报酬:items.map(row => row.item.name + ' ×' + row.quantity).join('、'),
    当前进度:0, 目标进度:steps.length+1, 进度单位:'步', 进度说明:steps[0] || '缴纳 ' + price + ' 哈基币。', 进度:'0%',
    前端判定:'语义', 语义目标:steps.map((step,i) => (i+1) + '. ' + step).join('\n') || '无其他步骤', 语义进度:steps[0] || '未开始', 语义完成:false, 已完成步骤:{},
    交易:{marketKey:market.successCount,boothId:booth.id,items,price},
  };
};
const hkm130PayTradeContract = async id => {
  hkm098AssertOwner(); hkm098RequireAlive();
  const stat = await currentStat(), task = asObject(stat.任务)[id], trade = asObject(state.tradeContracts)[id];
  if (!task || !trade || asObject(stat.前端结算?.事件)['trade-paid:' + id]) throw Error('契约不存在或已结算。');
  if (stat.场景?.地图 !== '哈基米空间') throw Error('请返回哈基米空间缴费。');
  if (aiNum(task.当前进度,0) < trade.target - 1) throw Error('请先完成契约中的其他步骤。');
  if (aiMoney(stat) < trade.price) throw Error('哈基币不足。');
  const storage = HkmLifecycle.copy(asObject(stat.安全屋?.收藏品));
  for (const row of trade.items) aiGrantBucket(storage, row.item, row.quantity);
  const tasks = {...asObject(stat.任务)}; delete tasks[id];
  const contracts = {...asObject(state.tradeContracts)}; delete contracts[id];
  const market = HkmLifecycle.copy(asObject(state.market));
  if (market.trade?.successCount === trade.marketKey) {
    const booth = market.trade.booths.find(row => row.id === trade.boothId);
    for (const stock of booth?.items || []) if (trade.items.some(row => row.item.id === stock.id)) stock.sold = true;
  }
  const ledger = {...asObject(stat.前端结算?.事件),['trade-paid:' + id]:true};
  await hkm098Transact('trade-payment:' + id, {
    统计信息:{...asObject(stat.统计信息),哈基币:aiMoney(stat)-trade.price},
    安全屋:{...asObject(stat.安全屋),收藏品:storage}, 任务:tasks,
    前端结算:{...asObject(stat.前端结算),事件:ledger},
  }, {market,tradeContracts:contracts}, '主角缴纳 ' + trade.price + ' 哈基币，完成「' + task.任务名称 + '」，获得' + task.报酬 + '。', '', 1, stat);
  setStatus('契约已完成。'); await refresh();
};
const hkm130IngestContracts = async stat => {
  if (hudReadOnly) return false;
  const last = hudLatestAssistantTexts().at(-1); if (!last) return false;
  const ledger = {...asObject(stat.前端结算?.事件)}, tasks = {...asObject(stat.任务)}, contracts = {...asObject(state.tradeContracts)};
  let changed = false;
  for (const block of last.text.matchAll(/<HkmTradeContract\s+version="1">([\s\S]*?)<\/HkmTradeContract>/g)) {
    let raw; try {raw = JSON.parse(block[1]);} catch (_) {continue;}
    if (!raw || ledger['trade-contract:' + raw.id] || Object.keys(tasks).length >= 3 || stat.场景?.地图 !== '哈基米空间') continue;
    const market = asObject(state.market?.trade); if (!Array.isArray(market.booths)) continue;
    const task = hkm130TradeContract(raw, market); if (!task || tasks[task.任务ID]) continue;
    if (Object.values(contracts).some(trade => trade.marketKey === market.successCount && trade.boothId === task.交易.boothId && trade.items.some(row => task.交易.items.some(next => next.item.id === row.item.id)))) continue;
    tasks[task.任务ID] = {...task,接取消息楼层:last.id}; contracts[task.任务ID] = {...task.交易,target:task.目标进度};
    ledger['trade-contract:' + task.任务ID] = true; changed = true;
  }
  for (const [id,trade] of Object.entries(contracts)) {
    const task = tasks[id];
    if (!task) {delete contracts[id]; changed = true; continue;}
    if (aiNum(task.当前进度,0) >= trade.target) {tasks[id] = {...task,当前进度:trade.target-1,进度:'待缴费',进度说明:'缴纳 ' + trade.price + ' 哈基币。'}; changed = true;}
  }
  if (!changed) return false;
  return hkm098Transact('trade-contracts:' + last.id + ':' + Date.now() + ':' + (++hkm095QueueSerial), {任务:tasks,前端结算:{...asObject(stat.前端结算),事件:ledger}}, {tradeContracts:contracts,carts:{...HkmLifecycle.copy(asObject(state.carts)),trade:Object.fromEntries(Object.entries(asObject(state.carts?.trade)).filter(([,row]) => !Object.values(contracts).some(trade => trade.marketKey === row.marketKey && trade.boothId === row.boothId && trade.items.some(item => item.item.id === row.itemId))))}});
};
const hkmSemanticTaskSync = async stat => {
  if (hudReadOnly) return false;
  const last = hudLatestAssistantTexts().at(-1); if (!last) return false;
  const tasks = {...asObject(stat.任务)}, archive = asObject(stat.任务档案), completed = {...asObject(archive.已完成任务)}, repeats = {...asObject(archive.重复任务完成次数)};
  const receipts = {...asObject(stat.前端结算?.回执)}, patch = {};
  let changed = false;
  for (const [key, raw] of Object.entries(tasks)) {
    const id = textOf(raw?.任务ID, key), accepted = Math.max(-1, Math.floor(aiNum(raw?.接取消息楼层, -1)));
    if (last.id <= accepted) continue;
    const trade = asObject(state.tradeContracts)[id];
    if (trade) {
      const target = Math.max(1, Math.floor(aiNum(trade.target, 1))), count = target - 1, steps = asObject(raw?.已完成步骤);
      const marked = Array.from({length:count}, (_, index) => steps[String(index + 1)] === true).filter(Boolean).length;
      const progress = Math.min(count, Math.max(0, Math.floor(aiNum(raw?.当前进度, 0)), raw?.语义完成 === true ? count : marked));
      if (progress !== aiNum(raw?.当前进度, 0)) {
        tasks[key] = {...raw,当前进度:progress,目标进度:target,进度:progress === count ? '待缴费' : Math.round(progress * 100 / target) + '%',进度说明:progress === count ? '缴纳 ' + trade.price + ' 哈基币。' : textOf(raw.语义进度,raw.进度说明)};
        changed = true;
      }
      continue;
    }
    const task = questById.get(id);
    if (!task || !questSemanticTask(task) || raw?.语义完成 !== true) continue;
    const cycle = Math.max(0, Math.floor(aiNum(raw.结算周期, aiNum(repeats[id], 0)))), receipt = 'semantic-task:' + id + ':' + cycle;
    const permanent = task.type === 'main' && task.repeatable !== true;
    const paid = receipts[receipt] === true || (permanent ? completed[id] === true : aiNum(repeats[id], 0) > cycle);
    if (id === 'MATCH-GOOGLE-02' && aiNum(questRewardEvidence(raw).玩家击杀, 0) <= aiNum(raw.接取玩家击杀, 0)) continue;
    if (!paid) Object.assign(patch, questRewardPatch({...stat,...patch}, task, raw));
    if (permanent) completed[id] = true;
    else repeats[id] = Math.max(Math.floor(aiNum(repeats[id], 0)), cycle + 1);
    receipts[receipt] = true; delete tasks[key]; changed = true;
  }
  if (!changed) return false;
  Object.assign(patch, {任务:tasks,任务档案:{...archive,已完成任务:completed,重复任务完成次数:repeats},前端结算:{...asObject(stat.前端结算),回执:receipts}});
  return hkm098Transact('semantic-tasks:' + last.id + ':' + (++hkm095QueueSerial), patch, {}, '', '', 1, stat);
};


const hkm163HeroUnit = (stat,front=state) => ({
  id:'hero',name:hudPlayerName(stat),kind:'玩家',hp:aiNum(stat.主角?.当前血量),maxHp:Math.max(1,aiNum(stat.主角?.血量上限,20)),
  attack:aiNum(stat.主角?.攻击力),defense:aiNum(stat.主角?.防御力),speed:aiNum(stat.主角?.速度,10),virgin:stat.主角?.处女状态,
  money:aiMoney(stat),equipment:Object.fromEntries(HkmEquipment.slots.map(slot=>[slot,hkm098Resolve(stat.装备?.[slot])?.id])),
  effects:HkmLifecycle.copy(asObject(front.equipmentEffects?.hero)),
});
const hkm163Units = (stat,front=state) => {
  const units=[hkm163HeroUnit(stat,front)],seen=new Set(['hero']);
  const run=front.run?.map===stat.场景?.地图?front.run:null;
  for(const [kind,rows] of [['玩家',run?.players],['NPC',run?.npcs]])for(const row of rows || []){
    if(seen.has(row.id) || row.region!==stat.场景?.区域 || row.alive===false || row.extracted || aiNum(row.hp)<=0)continue;
    seen.add(row.id);
    const record=Object.values(asObject(stat.敌人)).find(enemy=>enemy.ID===row.id || enemy._ID===row.id || enemy.名称===row.name);
    const currentHp=record?.血量?aiNum(String(record.血量).split('/')[0],row.hp):aiNum(row.hp);
    units.push({id:row.id,name:row.name,kind,hp:currentHp,maxHp:Math.max(1,aiNum(row.maxHp,20)),attack:aiNum(row.attack),defense:aiNum(row.defense),speed:aiNum(row.speed,10),equipment:{...asObject(row.equip)},
      fish:row.fish===true || /鱼|鲨|鲸|鳗|海马/.test(String(row.kind || '')+' '+String(row.name || '')),
      money:Number.isFinite(row.money)?row.money:undefined,effects:HkmLifecycle.copy(asObject(front.equipmentEffects?.[row.id] || row.equipmentEffects)),row});
  }
  return units;
};
const hkm163Marker = (stat,front=state) => {
  const mark=HkmEquipment.marker(hkm163HeroUnit(stat,front).equipment);
  const visible=HkmStateBoundary.visibleEnemies(stat,front);
  for(const unit of hkm163Units(stat,front).slice(1))if(Object.values(visible).some(row=>row._ID===unit.id || row.ID===unit.id || row.名称===unit.name))Object.assign(mark,HkmEquipment.marker(unit.equipment,unit.id+':'));
  return mark;
};
const hkm163Result = (stat,front,units) => {
  const hero=units[0],enemies=HkmLifecycle.copy(asObject(stat.敌人)),effects={...asObject(front.equipmentEffects)};
  for(const unit of units){
    effects[unit.id]=unit.effects;
    if(unit.row){
      unit.row.hp=unit.hp;
      if(Number.isFinite(unit.money))unit.row.money=unit.money;
      for(const row of Object.values(enemies))if(row.ID===unit.id || row._ID===unit.id || row.名称===unit.name){row.血量=unit.hp+'/'+unit.maxHp;if(unit.hp<=0)row.状态='死亡';}
      if(unit.hp<=0 && unit.killer){
        HkmFishing.recordKill(front.run,unit.id,unit.killer,unit.kind==='玩家');
        unit.row.equipmentDeath={killer:unit.killer};
      }
    }
  }
  front.equipmentEffects=effects;
  return {patch:{_装备处理:hkm163Marker(stat,front),_装备事件:[],敌人:enemies,主角:{...asObject(stat.主角),当前血量:hero.hp,致命溢出伤害:hero.overkill ?? aiNum(stat.主角?.致命溢出伤害)},统计信息:{...asObject(stat.统计信息),哈基币:hero.money}},after:{run:front.run,equipmentEffects:effects}};
};
const hkm163Targets = stat => {
  const present=new Set(hkm163Units(stat).slice(1).map(unit=>unit.id));
  return Object.entries(HkmStateBoundary.visibleEnemies(stat,state)).map(([key,row])=>({id:row.ID || row._ID || state.run?.players?.find(unit=>unit.name===row.名称)?.id || state.run?.npcs?.find(unit=>unit.name===row.名称)?.id || key,name:row.名称 || key})).filter(row=>present.has(row.id));
};
const hkm163PickTargets = (stat,skill) => new Promise(resolve=>{
  const mask=hudPromptMask(),box=make('div','hkm-reset-prompt');
  box.append(make('div','hkm-reset-prompt-title',skill.name));
  let mode='横扫';
  if(skill.name==='定海一棒'){
    const select=hkmCreateElement('select');select.setAttribute('aria-label','攻击方式');
    for(const text of ['横扫','下劈']){const option=hkmCreateElement('option');option.value=text;option.textContent=text;select.append(option);}
    select.addEventListener('change',()=>{mode=select.value;});box.append(select);
  }
  const checks=[];
  const targets=skill.name==='潮汐之佑'?[{id:'hero',name:hudPlayerName(stat)+'（自身）'}]:hkm163Targets(stat);
  for(const target of targets){
    const label=make('label','hkm-reset-prompt-row'),input=hkmCreateElement('input');input.type='checkbox';input.setAttribute('aria-label',target.name);checks.push({input,id:target.id});label.append(input,make('span','',target.name));box.append(label);
    if(target.id==='hero')input.checked=true;
  }
  if(!checks.length)box.append(make('p','','当前区域没有可攻击目标。'));
  const actions=make('div','hkm-reset-prompt-actions'),cancel=make('button','hkm-reset-mini','取消'),confirm=make('button','hkm-reset-mini','发动');confirm.disabled=!checks.length;
  const close=result=>{mask.remove();resolve(result);};
  cancel.addEventListener('click',()=>close(null));mask.addEventListener('click',event=>{if(event.target===mask)close(null);});
  confirm.addEventListener('click',()=>{
    const ids=checks.filter(row=>row.input.checked).map(row=>row.id);
    if(!ids.length){setStatus('请选择目标。');return;}
    if((skill.name==='资本碾压' || skill.name==='定海一棒' && mode==='下劈') && ids.length!==1){setStatus('此技能只能选择一个目标。');return;}
    close({ids,mode});
  });
  actions.append(cancel,confirm);box.append(actions);mask.append(box);hkmPortal.append(mask);
});
const hkm163GearValue = stat => HkmEquipment.slots.reduce((total,slot)=>{
  const item=hkm098Resolve(stat.装备?.[slot]);return total+(item && !hkmSoulbound(item)?Math.max(0,aiNum(item.value)):0);
},0);
const hkm163ProcessDeaths = () => {
  for(const row of [...(state.run?.players || []),...(state.run?.npcs || [])])if(row.equipmentDeath){
    const killer=row.equipmentDeath.killer;delete row.equipmentDeath;
    if(state.run.players.includes(row)){aiKillPlayer(state.run.map,row,'在战斗中阵亡');row.mode='dead';}
    else aiNpcKill(row,false,killer);
  }
};
const hkm163AiUnits = (player,stat,front=state) => {
  const rows=[...(front.run?.players || []),...(front.run?.npcs || [])].filter(row=>row.region===player.region && row.alive!==false && !row.extracted && row.hp>0);
  const units=rows.map(row=>({id:row.id,name:row.name,kind:front.run.players.includes(row)?'玩家':'NPC',hp:row.hp,maxHp:row.maxHp,attack:row.attack,defense:row.defense,speed:row.speed || 10,threat:aiNum(row.threat),equipment:row.equip || {},effects:HkmLifecycle.copy(asObject(front.equipmentEffects?.[row.id] || row.equipmentEffects)),money:Number.isFinite(row.money)?row.money:undefined,fish:row.fish===true || /鱼|鲨|鲸|鳗|海马/.test(String(row.kind || '')+' '+row.name),row}));
  const heroArea=front===state && aiTurnContext?aiTurnContext.heroTo:stat?.场景?.区域;
  if(front.run?.map===stat?.场景?.地图 && player.region===heroArea && aiNum(stat.主角?.当前血量)>0)units.push({...hkm163HeroUnit(stat,front),threat:HKM_HERO_THREAT});
  return units;
};
const hkm163AiFriendly = (source,target,stat,front) => {
  const record=Object.values(asObject(stat?.敌人)).find(row=>row.ID===target.id || row._ID===target.id || row.名称===target.name);
  return hkm139Friendly(target.row) || hkm139Friendly(record) || !!front.run?.truces?.[[source.id,target.id].sort().join(':')]
    || target.id==='hero' && hkm139Friendly(source.row);
};
const hkm163AiCast = (source,units,stat,front,clock) => {
  source.effects ||= {};
  if(source.kind!=='玩家' || source.effects.aiSkillFloor===hkmTurnOrigin || source.effects.aiSkillDialogue===clock)return null;
  const prior=source.effects.skillClock,remaining=aiNum(source.row?.rounds);
  const round=aiNum(prior?.elapsed)+Math.max(0,aiNum(prior?.remaining,remaining)-remaining);
  source.effects.skillClock={remaining,elapsed:round};
  const offer=HkmEquipment.aiOffer(source,units,{map:front.run.map,area:source.row.region,clock,round,cooldown:HkmActiveSkills.cooldown,friendly:(a,b)=>hkm163AiFriendly(a,b,stat,front)});
  if(!offer)return null;
  HkmEquipment.dialogue(source,clock,true);
  let lines;
  try{
    lines=offer.skill.name==='潮汐之佑'?[HkmEquipment.tide(source,{map:front.run.map,area:source.row.region,clock:clock-1})]
      :HkmEquipment.attack(source,offer.targets,{map:front.run.map,area:source.row.region,clock,skill:offer.skill.name,weapon:offer.item.id,mode:offer.mode,gearValue:offer.gearValue,allUnits:units.filter(unit=>!hkm163AiFriendly(source,unit,stat,front))}).lines;
  }catch(_){return null;}
  source.effects.skillCooldowns={...asObject(source.effects.skillCooldowns),[offer.token]:{unit:offer.cooldown.unit,readyAt:({dialogue:clock,round}[offer.cooldown.unit])+offer.cooldown.amount}};
  source.effects.aiSkillFloor=hkmTurnOrigin;
  source.effects.aiSkillDialogue=clock;
  const names=offer.targets.map(unit=>unit.name).join('、');
  const text=source.name+'发动「'+offer.skill.name+'」'+(offer.skill.name==='定海一棒'?'（'+offer.mode+'）':'')+'，目标：'+names+'。\n'+lines.join('\n');
  return {offer,lines,text,record:{id:'AI-SKILL:'+hkm098RunId(front.run)+':'+hkmTurnOrigin+':'+source.id,text:'<HkmActiveSkill>\n'+text+'\n上述效果已经结算，无需重复修改血量、哈基币或状态。\n</HkmActiveSkill>',item:source.id+':'+offer.token,useClass:'aiActiveSkill',roundKey:hudRoundKey(),sent:false,undo:{}}};
};
const hkm163AiHit = (source,target,ambush=false) => {
  const map=state.run?.map,area=source.region,clock=hudDialogueCount()+1;
  const heroStat=aiTurnContext?.stat,units=hkm163AiUnits(source,heroStat);
  const attacker=units.find(unit=>unit.id===source.id),victim=units.find(unit=>unit.id===target.id);
  if(!attacker || !victim){const damage=Math.max(0,aiNum(source.attack)-Math.floor(aiNum(target.defense)/2));target.hp=Math.max(0,target.hp-damage);return damage;}
  for(const unit of units)HkmEquipment.dialogue(unit,clock,true);
  const beforeHp=victim.hp,cast=hkm163AiCast(attacker,units,heroStat,state,clock);
  let result;try{result=cast || HkmEquipment.attack(attacker,[victim],{map,area,clock,ambush,allUnits:units});}catch(_){return 0;}
  if(cast){state.usePending=useRecordsOf(state.usePending).concat(cast.record);source.equipmentSkillAction=cast.text;aiEventLine(cast.text);}
  for(const unit of units){
    state.equipmentEffects={...asObject(state.equipmentEffects),[unit.id]:unit.effects};
    if(unit.row){
      unit.row.hp=unit.hp;unit.row.equipmentEffects=unit.effects;if(Number.isFinite(unit.money))unit.row.money=unit.money;
      if(unit.hp<=0 && unit.killer && unit!==victim){HkmFishing.recordKill(state.run,unit.id,unit.killer,unit.kind==='玩家');unit.row.equipmentDeath={killer:unit.killer};}
    }else if(unit.id==='hero' && heroStat){heroStat.主角={...heroStat.主角,当前血量:unit.hp,致命溢出伤害:unit.overkill || 0};aiTurnContext.equipmentHeroTouched=true;}
  }
  hkm163ProcessDeaths();
  return beforeHp-victim.hp;
};
const hkm163HeroHit = (stat,target,map,area) => {
  const units=hkm163Units({...stat,场景:{...stat.场景,地图:map,区域:area}}),hero=units[0],victim=units.find(unit=>unit.id===target.id);
  if(!victim)return 0;
  const result=HkmEquipment.attack(hero,[victim],{map,area,clock:hudDialogueCount()+1,allUnits:units});
  for(const unit of units){
    state.equipmentEffects={...asObject(state.equipmentEffects),[unit.id]:unit.effects};
    if(unit.row){unit.row.hp=unit.hp;unit.row.equipmentEffects=unit.effects;if(Number.isFinite(unit.money))unit.row.money=unit.money;
      if(unit!==victim && unit.hp<=0 && unit.killer){HkmFishing.recordKill(state.run,unit.id,unit.killer,unit.kind==='玩家');unit.row.equipmentDeath={killer:unit.killer};}
    }
  }
  hkm163ProcessDeaths();
  stat.主角={...stat.主角,当前血量:hero.hp,致命溢出伤害:hero.overkill || 0};
  state.equipmentEffects={...asObject(state.equipmentEffects),hero:hero.effects};
  return result.dealt;
};
const hkm163RangedEscape = async (stat,targets,map,area) => {
  const front=HkmLifecycle.copy(state),units=hkm163Units(stat,front),hero=units[0],lines=[];
  for(const row of targets){
    const source=units.find(unit=>unit.id===row.player?.id);if(!source || source.hp<=0 || hero.hp<=0)continue;
    const weapon=HkmEquipment.equipped(source).find(({item})=>item.traits?.some(trait=>trait.id==='ranged'))?.item;
    if(!weapon || row.player.mode!=='fight')continue;
    try{lines.push(...HkmEquipment.attack(source,[hero],{map,area,clock:hudDialogueCount()+1,weapon:weapon.id,rangedEscape:true,allUnits:units}).lines);}catch(_){continue;}
  }
  if(!lines.length)return [];
  const result=hkm163Result(stat,front,units);
  await hkm098Transact('ranged-escape:'+Date.now()+':'+(++hkm095QueueSerial),result.patch,result.after,lines.join('\n'));
  Object.assign(stat,result.patch);hkm163ProcessDeaths();
  if(hero.hp<=0)throw Error('逃跑时被远程压制击倒。');
  return lines;
};
const hkm163SkillPlan = (stat,item,skill,selection,front=HkmLifecycle.copy(state)) => {
  const units=hkm163Units(stat,front),hero=units[0],clock=hudDialogueCount()+1;
  const map=stat.场景?.地图,area=stat.场景?.区域;
  let lines=[];
  if(skill.name==='潮汐之佑'){
    if(selection.ids.length!==1 || selection.ids[0]!=='hero')throw Error('此技能只能选择自身。');
    lines=[HkmEquipment.tide(hero,{map,area,clock:clock-1})];
  }
  else{
    const allowed=new Set(hkm163Targets(stat).map(row=>row.id));
    if(selection.ids.some(id=>!allowed.has(id)))throw Error('目标已离开或不可见，请重新选择。');
    const targets=selection.ids.map(id=>units.find(unit=>unit.id===id));
    if(targets.some(target=>!target))throw Error('目标资料未就绪。');
    HkmEquipment.dialogue(hero,clock,stat.场景?.是否战斗中===true);
    const result=HkmEquipment.attack(hero,targets,{map,area,clock,skill:skill.name,weapon:item.id,mode:selection.mode,gearValue:hkm163GearValue(stat),allUnits:units});lines=result.lines;
    for(const target of targets)if(target.hp<=0)target.killer='hero';
  }
  const result=hkm163Result(stat,front,units);
  if(skill.name!=='潮汐之佑')result.patch.场景={...asObject(stat.场景),是否战斗中:units.slice(1).some(unit=>unit.hp>0)};
  return {...result,lines};
};
const hkm163PrepareAiSkills = async stat => {
  if(!state.run || state.run.map!==stat.场景?.地图 || HkmLifecycle.dead(stat))return stat;
  const front=HkmLifecycle.copy(state),units=hkm163Units(stat,front),clock=hudDialogueCount()+1,records=[];
  units[0].threat=HKM_HERO_THREAT;
  for(const unit of units.slice(1))unit.threat=aiNum(unit.row?.threat);
  const actors=units.filter(unit=>unit.row?.llm && front.run.players.includes(unit.row)).sort((a,b)=>b.speed-a.speed || b.threat-a.threat);
  for(const actor of actors){
    if(actor.hp<=0 || actor.effects?.stunnedUntil>=clock)continue;
    const opening=actor.row.equipmentOpeningAttack;
    if(opening?.area===stat.场景.区域 && opening.floor<hkmTurnOrigin && hudCombatFlagOn(stat) && !hkm163AiFriendly(actor,units[0],stat,front))HkmEquipment.engage(actor,units[0],stat.场景.区域);
    const cast=hkm163AiCast(actor,units,stat,front,clock);
    if(cast){actor.row.lastAction=cast.text;records.push(cast.record);}
  }
  if(!records.length)return stat;
  const result=hkm163Result(stat,front,units);
  const hero=units[0];
  if(hero.hp<=0 || !units.slice(1).some(unit=>unit.hp>0 && unit.effects?.combat?.targets?.includes('hero')))result.patch.场景={...asObject(stat.场景),是否战斗中:false};
  await hkm098Transact('ai-skills:'+hkm098RunId(front.run)+':'+hkmTurnOrigin,result.patch,{...result.after,usePending:useRecordsOf(state.usePending).concat(records)},'', '',1,stat);
  hkm163ProcessDeaths();
  return currentStat();
};
const hkm163EquipmentSync = async stat => {
  if(hudReadOnly || hkm098Busy)return false;
  const front=HkmLifecycle.copy(state),units=hkm163Units(stat,front),clock=hudDialogueCount();
  if(front.equipmentRun!==hkm098RunId(front.run)){
    front.equipmentEffects={};front.equipmentRun=hkm098RunId(front.run);
    for(const unit of units)unit.effects={};
  }
  let changed=false,lines=[],events=Array.isArray(stat._装备事件)?stat._装备事件:[];
  const receipt='equipment-events:'+hkm098RunId(front.run)+':'+mvuMessageId();
  if(events.length && !stat.前端结算?.回执?.[receipt]){
    const visible=new Set(['hero',...hkm163Targets(stat).map(row=>row.id)]);
    const seen=new Set(),pairs=new Set();
    const queue=events.slice(0,32).filter(event=>{
      if(!event || typeof event.ID!=='string' || seen.has(event.ID) || !visible.has(event.来源) || !visible.has(event.目标))return false;
      const pair=event.来源+':'+event.目标;
      if((!event.类型 || event.类型==='攻击') && pairs.has(pair))return false;
      if(!event.类型 || event.类型==='攻击')pairs.add(pair);
      seen.add(event.ID);return true;
    }).sort((left,right)=>aiNum(units.find(unit=>unit.id===right.来源)?.speed)-aiNum(units.find(unit=>unit.id===left.来源)?.speed));
    for(const unit of units)HkmEquipment.dialogue(unit,clock,stat.场景?.是否战斗中===true || queue.some(event=>event.类型==='攻击' || !event.类型));
    for(const event of queue){
      const source=units.find(unit=>unit.id===event.来源),target=units.find(unit=>unit.id===event.目标);
      if(!source || !target || source.hp<=0 || target.hp<=0 || source.effects?.stunnedUntil>=clock)continue;
      if(source.id!=='hero' && source.effects?.aiSkillDialogue===clock && (!event.类型 || event.类型==='攻击'))continue;
      if(GAME_DATA.maps[stat.场景?.地图]?.kind!=='mission')continue;
      try{
        if(event.类型==='治疗')lines.push(target.name+'恢复 '+HkmEquipment.heal(target,Math.max(0,aiNum(event.数值)))+' 点血量。');
        else if(event.类型==='护盾'){target.effects.shield=aiNum(target.effects.shield)+Math.ceil(Math.max(0,aiNum(event.数值))*(HkmEquipment.has(target,'seaBlessing')?1.25:1));lines.push(target.name+'获得护盾。');}
        else{
          target.extraDodge=Math.max(0,Math.min(1,aiNum(event.额外闪避)));
          const result=HkmEquipment.attack(source,[target],{map:stat.场景?.地图,area:stat.场景?.区域,clock,weapon:event.武器 || source.equipment.主武器,ambush:event.偷袭===true,allUnits:units});lines.push(...result.lines);if(target.hp<=0)target.killer=source.id;
          if(source.id==='hero' || target.id==='hero')stat={...stat,场景:{...stat.场景,是否战斗中:source.hp>0 && target.hp>0}};
        }
      }catch(error){lines.push('攻击未执行：'+error.message);}
    }
    changed=true;
  }
  for(const unit of units){
    const before=JSON.stringify(unit.effects);
    const healed=HkmEquipment.dialogue(unit,clock,stat.场景?.是否战斗中===true);
    if(healed)lines.push(unit.name+'恢复 '+healed+' 点血量。');
    if(before!==JSON.stringify(unit.effects))changed=true;
  }
  const marker=hkm163Marker(stat,front);
  if(JSON.stringify(stat._装备处理)!==JSON.stringify(marker))changed=true;
  if(!changed && !events.length)return false;
  const result=hkm163Result(stat,front,units);
  if(events.length)result.patch.场景=stat.场景;
  const id=events.length?(stat.前端结算?.回执?.[receipt]?receipt+':clear':receipt):'equipment-sync:'+hkm098RunId(front.run)+':'+mvuMessageId()+':'+clock+':'+JSON.stringify(marker);
  if(stat.前端结算?.回执?.[id] && !events.length)return false;
  await hkm098Transact(id,result.patch,{...result.after,equipmentRun:front.equipmentRun},lines.join('\n'));
  hkm163ProcessDeaths();
  return true;
};

const HkmActiveSkills = (() => {
  const cooldown = skill => {
    const text = String(skill?.text || '');
    const match = /冷却(?:时间)?(?:为|是)?\s*([0-9一二两三四五六七八九十]+)\s*(?:个)?\s*(次对话|轮交互轮数|交互轮数|轮交互)/.exec(text);
    if (!match) return null;
    const digits = {一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10};
    const amount = Number(match[1]) || digits[match[1]];
    return amount > 0 ? { amount, unit: match[2] === '次对话' ? 'dialogue' : 'round' } : null;
  };
  const key = (item, skill) => item.id + ':' + skill.name;
  const remaining = (record, clocks) => Math.max(0, Number(record?.readyAt || 0) - Number(clocks[record?.unit] || 0));
  const message = (item, skill) => {
    const line = String(item.details || '').split('\n').find(text => text.startsWith('主动技能-' + skill.name + ':') || text.startsWith('主动技能-' + skill.name + '：'));
    return '<HkmActiveSkill>\n' + (line || '主动技能-' + skill.name + '：' + skill.text) + '\n主角发动了主动技能' + skill.name + '。\n</HkmActiveSkill>';
  };
  return { cooldown, key, remaining, message };
})();

const hkm130SkillClock = stat => {
  const prior = asObject(state.skillClock), runId = hkm098RunId(state.run);
  const remaining = aiNum(stat.场景?.剩余交互轮数, 0);
  const elapsed = aiNum(prior.elapsed, 0) + (runId && prior.runId === runId ? Math.max(0, aiNum(prior.remaining, remaining) - remaining) : 0);
  const next = { runId, remaining, elapsed };
  if (JSON.stringify(prior) !== JSON.stringify(next)) { state.skillClock = next; saveFrontendState(state); }
  return { dialogue: hudDialogueCount(), round: elapsed };
};
const hkm130SkillAvailability = (item, skill, stat) => {
  const cooldown = HkmActiveSkills.cooldown(skill);
  if (!cooldown) return { ok:false, label:'冷却信息缺失' };
  const clocks = hkm130SkillClock(stat), token = HkmActiveSkills.key(item, skill);
  const remaining = HkmActiveSkills.remaining(asObject(state.skillCooldowns)[token], clocks);
  if (useRecordsOf(state.usePending).some(row => row.useClass === 'activeSkill' && row.item === token && !row.sent)) return { ok:false, label:'已准备发动' };
  if (remaining) return { ok:false, label:'冷却 ' + remaining + (cooldown.unit === 'dialogue' ? ' 次对话' : ' 交互轮数') };
  if (!HkmEquipment.slots.some(slot=>hkm098Resolve(stat.装备?.[slot])?.id===item.id)) return { ok:false, label:'未装备' };
  if (/需要在水下/.test(skill.text) && aiWaterCost(stat.场景?.地图, stat.场景?.区域) <= 0) return { ok:false, label:'需要在水下' };
  if (/需要在有水/.test(skill.text) && stat.场景?.地图 !== '魔鬼海') return { ok:false, label:'需要在有水的区域' };
  if(GAME_DATA.maps[stat.场景?.地图]?.kind!=='mission')return {ok:false,label:'仅对局中可发动'};
  if(skill.name==='资本碾压' && aiMoney(stat)<Math.ceil(hkm163GearValue(stat)*0.25))return {ok:false,label:'哈基币不足'};
  return { ok:true, label:'发动 ' + skill.name, cooldown, clocks, token };
};
const hkm130ActivateSkill = async (itemId, skillName) => {
  hkm098AssertOwner();hkm098RequireAlive();
  const item=itemById(itemId),skill=item?.skills?.find(row=>row.kind==='active' && row.name===skillName);
  if(!skill)throw Error('主动技能不存在。');
  const first=await currentStat(),initial=hkm130SkillAvailability(item,skill,first);
  if(!initial.ok)throw Error(initial.label);
  const selection=await hkm163PickTargets(first,skill);
  if(!selection)return;
  hkm098AssertOwner();hkm098RequireAlive();
  const stat=await currentStat(),offer=hkm130SkillAvailability(item,skill,stat);
  if(!offer.ok)throw Error(offer.label);
  const plan=hkm163SkillPlan(stat,item,skill,selection),id='skill:'+Date.now()+':'+(++hkm095QueueSerial);
  const text='<HkmActiveSkill>\n主角发动「'+skill.name+'」。\n'+plan.lines.join('\n')+'\n上述效果已经结算，无需重复修改血量、哈基币或状态。\n</HkmActiveSkill>';
  const record={id,item:offer.token,text,useClass:'activeSkill',roundKey:hudRoundKey(),sent:false,undo:{}};
  await hkm098Transact(id,plan.patch,{...plan.after,skillCooldowns:{...asObject(state.skillCooldowns),[offer.token]:{unit:offer.cooldown.unit,readyAt:offer.clocks[offer.cooldown.unit]+offer.cooldown.amount}},usePending:useRecordsOf(state.usePending).concat(record)},'', '',1,stat);
  hkm163ProcessDeaths();setStatus('已发动「'+skill.name+'」。');
};


const hkm130TradeShop = {id:'PLAYER-TRADE',kind:'trade',name:'玩家自由贸易区',area:'玩家自由贸易区'};
const hkm130TradeCartKey = (boothId,itemId) => boothId + ':' + itemId;
const hkm130TradeReserved = (market,boothId,itemId) => Object.values(asObject(state.tradeContracts)).some(trade => trade.marketKey === market.successCount && trade.boothId === boothId && trade.items.some(row => row.item.id === itemId));
const hkm130TradeOffer = (market,boothId,itemId) => {
  const booth = market.booths?.find(row => row.id === boothId);
  const stock = booth?.items.find(row => row.id === itemId && !row.sold);
  const item = stock && resolveTradeStock(stock);
  if (!item || hkm130TradeReserved(market,boothId,itemId)) throw Error('商品已售出或已有交易契约。');
  return {booth,stock,item};
};
const hkm130AddTradeCart = (boothId,itemId,marketKey) => {
  hkm098AssertOwner(); hkm098RequireAlive();
  const market = asObject(state.market?.trade);
  if (market.successCount !== marketKey || currentContext.mapName !== '哈基米空间' || currentContext.area !== TRADE_AREA) throw Error('摊位已变化，请重新选择商品。');
  const {stock,item} = hkm130TradeOffer(market,boothId,itemId);
  addToCart(hkm130TradeShop,{...item,id:hkm130TradeCartKey(boothId,itemId),itemId,boothId,marketKey},stock.askingPrice);
};
const hkm130PurchaseTradeCart = async (stat,shop,items) => {
  hkm098AssertOwner(); hkm098RequireAlive();
  const market = HkmLifecycle.copy(ensureTradeMarket(stat));
  const rows = [], seen = new Set();
  let total = 0;
  for (const row of items) {
    if (row.marketKey !== market.successCount || row.quantity !== 1 || row.id !== hkm130TradeCartKey(row.boothId,row.itemId) || seen.has(row.id)) throw Error('购物车商品已变化，请重新选择。');
    const offer = hkm130TradeOffer(market,row.boothId,row.itemId);
    if (!Number.isSafeInteger(offer.stock.askingPrice) || offer.stock.askingPrice < 0 || row.unitPrice !== offer.stock.askingPrice) throw Error('商品报价已变化，请重新选择。');
    seen.add(row.id); total += offer.stock.askingPrice;
    offer.stock.sold = true; rows.push({item:offer.item,quantity:1});
  }
  const balance = aiMoney(stat);
  if (balance < total) throw Error('哈基币不足：需要 ' + total + '，当前只有 ' + balance + '。');
  const patch = hudExchangePatch(stat,[],rows,'背包');
  patch.统计信息 = {...asObject(stat.统计信息),哈基币:balance-total};
  await hkm098Transact('trade-purchase:' + Date.now() + ':' + (++hkm095QueueSerial),patch,{
    market:{...HkmLifecycle.copy(state.market),trade:market},
    carts:{...HkmLifecycle.copy(state.carts),[shop.kind]:{}},
  });
  setStatus('购买成功，商品已放入背包。');
};
let hkm130BargainBusy = false;
const hkm130NegotiateTrade = async (boothId,itemId,marketKey) => {
  if (hkm130BargainBusy || purchaseBusy) return;
  hkm130BargainBusy = true;
  try {
    hkm098AssertOwner(); hkm098RequireAlive();
    const stat = await currentStat();
    if (stat.场景?.地图 !== '哈基米空间' || stat.场景?.区域 !== TRADE_AREA) throw Error('请前往玩家自由贸易区。');
    const market = ensureTradeMarket(stat);
    if (market.successCount !== marketKey) throw Error('摊位已变化，请重新选择商品。');
    const {booth,stock,item} = hkm130TradeOffer(market,boothId,itemId);
    if (displayTaskRows(stat).filter(row => row.type === 'commission').length >= 3) throw Error('特殊契约已满。');
    const payload = tradeMarketPayload(market,stat);
    payload.booths = payload.booths.filter(row => row.id === boothId).map(row => ({...row,items:row.items.filter(item => item.itemId === itemId)}));
    const message = '<HkmTradeBargain>\n主角对「' + item.name + '」提出砍价。\n' + formatTradeMarketLines(payload).join('\n') + '\n</HkmTradeBargain>';
    await sendFrontendUserMessage(message,{action:'trade_bargain',boothId,itemId,askingPrice:stock.askingPrice});
    setStatus('已提出砍价。');
  } finally {hkm130BargainBusy = false;}
};


  const TRADE_AREA = '玩家自由贸易区';
  const TRADE_MARKET_SCHEMA_VERSION = 4;
  const TRADE_PERSONALITY_WEIGHTS = [
    { value: '好色', weight: 0.40 },
    { value: '弱气', weight: 0.15 },
    { value: '冷漠', weight: 0.15 },
    { value: '重利', weight: 0.15 },
    { value: '理性', weight: 0.15 },
  ];
  const TRADE_STALL_COUNT = 4;
  const TRADE_RARITY_WEIGHTS = [
    { value: '少见', weight: 0.50 }, { value: '珍稀', weight: 0.40 }, { value: '奇异', weight: 0.07 }, { value: '至宝', weight: 0.03 },
  ];
  const TRADE_MARKUP_RANGES = { 少见: [10, 30], 珍稀: [20, 50], 奇异: [75, 150], 至宝: [120, 300] };
  const weightedTradePick = rules => {
    const entries = Array.isArray(rules) ? rules : [];
    const total = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.weight) || 0), 0);
    if (!entries.length || total <= 0) return '';
    let cursor = Math.random() * total;
    for (const entry of entries) {
      cursor -= Math.max(0, Number(entry.weight) || 0);
      if (cursor < 0) return entry.value;
    }
    return entries[entries.length - 1].value;
  };
  const tradeHistoryMetrics = stat => {
    const stats = asObject(stat.统计信息);
    const historyGames = Math.max(0, Math.floor(Number(stats.历史对局总数) || 0));
    const successfulExtractions = Math.min(historyGames, Math.max(0, Math.floor(Number(stats.历史成功撤离总数) || 0)));
    return {
      historyGames,
      successfulExtractions,
      extractionRatePercent: historyGames > 0 ? Number((successfulExtractions * 100 / historyGames).toFixed(1)) : 0,
      hakimiCoins: Number(stats.哈基币) || 0,
      totalAssets: Number(stats.总资产) || 0,
      fame: Number(stats.名望) || 0,
      reputation: Number(stats.风评) || 0,
    };
  };
  const makeTradeItem = (rarity, usedIds) => {
    const all = Object.values(asObject(GAME_DATA.collectibles)).filter(item => !item.acquisition?.militaryShopOnly && !item.acquisition?.googleSearchOnly && item?.id && item?.name);
    let pool = all.filter(item => item.rarity === rarity && !usedIds.has(item.id));
    if (!pool.length) pool = all.filter(item => item.rarity === rarity);
    if (!pool.length) pool = all.filter(item => !usedIds.has(item.id) && ['少见', '珍稀', '奇异', '至宝'].includes(item.rarity));
    const item = pool[Math.floor(Math.random() * pool.length)];
    if (!item) return null;
    usedIds.add(item.id);
    const markupPercent = randomInt(TRADE_MARKUP_RANGES[item.rarity] || TRADE_MARKUP_RANGES[rarity] || [10, 30]);
    const askingPrice = Math.max(1, Math.ceil((Number(item.value) || 1) * (1 + markupPercent / 100)));
    return { id: item.id, markupPercent, askingPrice, itemSnapshot: { id: item.id, name: item.name, rarity: item.rarity, category: item.category, description: item.description, value: item.value, weight: item.weight, details: modelSafeDetails(item.details) } };
  };
  const resolveTradeStock = stock => {
    const snapshot = asObject(stock?.itemSnapshot);
    if (snapshot.id && snapshot.name) return snapshot;
    const direct = GAME_DATA.collectibles?.[stock?.id];
    if (direct) return direct;
    return Object.values(asObject(GAME_DATA.collectibles)).find(item => item?.id === stock?.id) || null;
  };
  const tradeSnapshotIsValid = (market, metrics) => {
    if (Number(market.schemaVersion) !== TRADE_MARKET_SCHEMA_VERSION || Number(market.successCount) !== metrics.successfulExtractions || !Array.isArray(market.booths)) return false;
    if (market.booths.length !== TRADE_STALL_COUNT) return false;
    return market.booths.every(booth => Array.isArray(booth.items) && booth.items.length >= 1 && booth.items.length <= 3 && booth.items.every(stock => Boolean(resolveTradeStock(stock))));
  };
  const ensureTradeMarket = stat => {
    const metrics = tradeHistoryMetrics(stat);
    const previous = asObject(asObject(state.market).trade);
    if (tradeSnapshotIsValid(previous, metrics)) return previous;
    const usedIds = new Set();
    const booths = [];
    for (let stallIndex = 0; stallIndex < TRADE_STALL_COUNT; stallIndex += 1) {
      const items = [];
      const itemCount = randomInt([1, 3]);
      for (let itemIndex = 0; itemIndex < itemCount; itemIndex += 1) {
        const rarity = weightedTradePick(TRADE_RARITY_WEIGHTS);
        const item = makeTradeItem(rarity, usedIds);
        if (item) items.push(item);
      }
      if (!items.length) {
        const fallback = makeTradeItem(weightedTradePick(TRADE_RARITY_WEIGHTS), usedIds);
        if (fallback) items.push(fallback);
      }
      booths.push({ id: 'FT-' + String(stallIndex + 1).padStart(2, '0'), personality: weightedTradePick(TRADE_PERSONALITY_WEIGHTS), items });
    }
    const market = { schemaVersion: TRADE_MARKET_SCHEMA_VERSION, successCount: metrics.successfulExtractions, booths };
    state.market = { ...asObject(state.market), trade: market };
    state.carts = {...asObject(state.carts),trade:{}};
    saveFrontendState(state);
    return market;
  };
  const tradeMarketPayload = (market, stat) => ({
    schemaVersion: market.schemaVersion,
    refreshKey: { successfulExtractions: market.successCount },
    stallCount: market.booths.length,
    protagonistHistory: tradeHistoryMetrics(stat),
    booths: market.booths.map((booth, boothIndex) => ({
      id: booth.id,
      label: ['①', '②', '③', '④'][boothIndex] || String(boothIndex + 1),
      personality: booth.personality,
      items: booth.items.filter(stock => !stock.sold).map(stock => {
        const item = resolveTradeStock(stock);
        return item ? { ...modelSafeItemPayload(item), itemId:stock.id, details: modelSafeDetails(item.details), markupPercent: stock.markupPercent, askingPrice: stock.askingPrice } : null;
      }).filter(Boolean),
    })),
  });
  const formatTradeMarketLines = payload => {
    const lines = ['【玩家自由贸易区·本轮摊位快照】', '刷新依据：成功撤离 ' + payload.refreshKey.successfulExtractions + ' 次后重新铺货；固定 ' + payload.stallCount + ' 个摊位', '主角历史摘要：历史对局 ' + payload.protagonistHistory.historyGames + '；成功撤离 ' + payload.protagonistHistory.successfulExtractions + '；成功率 ' + payload.protagonistHistory.extractionRatePercent + '%；哈基币 ' + payload.protagonistHistory.hakimiCoins + '；总资产 ' + payload.protagonistHistory.totalAssets + '；名望 ' + payload.protagonistHistory.fame + '；风评 ' + payload.protagonistHistory.reputation];
    if (!payload.booths.length) {
      lines.push('摊位：无。本轮没有任何摊主摆出实质性的摊位。');
    } else {
      for (const booth of payload.booths) {
        lines.push('', '摊位 ' + booth.label + '｜摊位ID：' + booth.id + '｜摊主性格：' + booth.personality);
        booth.items.forEach((item, index) => lines.push((index + 1) + '. ' + item.name + '｜物品ID：' + item.itemId + '｜' + item.rarity + '｜' + item.category + '｜原价值 ' + item.value + '｜重量 ' + item.weight + '｜溢价 ' + item.markupPercent + '%｜报价 ' + item.askingPrice + ' 哈基币｜描述：' + item.description + '｜完整信息：' + item.details));
      }
    }
    return lines;
  };
  const renderTradeMarket = stat => {
    const market = ensureTradeMarket(stat);
    const payload = tradeMarketPayload(market, stat);
    shopPanel.body.append(make('div', 'hkm-reset-small', '本轮固定 ' + market.booths.length + ' 个摊位 · 已经成功撤离 ' + market.successCount + ' 次后重新铺货。'));
    if (!payload.booths.length) {
      shopPanel.body.append(empty('本轮没有任何摊主摆出实质性的摊位。'));
      return;
    }
    for (const booth of payload.booths) {
      const group = make('section', 'hkm-reset-task-group');
      const title = make('h3', 'hkm-reset-task-group-title', '摊位 ' + booth.label + ' · ' + booth.personality + '摊主');
      group.append(title);
      const grid = make('div', 'hkm-reset-card-grid');
      for (const item of booth.items) {
        if (!item?.name) continue;
        const cardNode = make('article', 'hkm-reset-card hkm-reset-rarity-' + rarityClass(item.rarity));
        const meta = make('div', 'hkm-reset-card-meta');
        meta.append(make('span', 'hkm-reset-chip', item.rarity), make('span', 'hkm-reset-chip', item.category), make('span', 'hkm-reset-chip', '重量 ' + item.weight));
        cardNode.append(make('h4', '', item.name), meta, make('p', '', item.description || '无描述'), make('p', 'hkm-reset-small', '原价值：' + item.value + ' · 完整信息：' + modelSafeDetails(item.details)), make('p', 'hkm-reset-shop-price', '溢价 ' + item.markupPercent + '% · 摊主报价 ' + item.askingPrice + ' 哈基币'));
        const reserved = hkm130TradeReserved(market,booth.id,item.itemId);
        const inCart = currentCart(hkm130TradeShop)[hkm130TradeCartKey(booth.id,item.itemId)];
        const actions = make('div','hkm-reset-shop-actions');
        const add = make('button','hkm-reset-shop-button',reserved ? '已订立契约' : inCart ? '已在购物车' : '加入购物车');
        add.type = 'button'; add.disabled = hudReadOnly || purchaseBusy || reserved || !!inCart;
        add.addEventListener('click',hudAction(() => hkm130AddTradeCart(booth.id,item.itemId,market.successCount)));
        const bargain = make('button','hkm-reset-shop-button','砍价');
        bargain.type = 'button'; bargain.disabled = hudReadOnly || purchaseBusy || reserved;
        bargain.addEventListener('click',hudAction(() => hkm130NegotiateTrade(booth.id,item.itemId,market.successCount)));
        actions.append(add,bargain);cardNode.append(actions);
        hudAttachItemPanel(cardNode, item.name, '摊位', { boothId:booth.id,itemId:item.itemId,marketKey:market.successCount,reserved, markupPercent:item.markupPercent,askingPrice:item.askingPrice,fallback:item });
        grid.append(cardNode);
      }
      if (!grid.childElementCount) grid.append(empty('该摊位当前没有可显示的收藏品。'));
      group.append(grid);
      shopPanel.body.append(group);
    }
  };
  const shopForArea = area => area === TRADE_AREA ? hkm130TradeShop : Object.values(asObject(GAME_DATA.shops)).find(shop => shop.kind === 'fixed' && shop.area === area) || null;
  const currentCart = shop => asObject(state.carts?.[shop.kind]);
  const cartEntries = shop => Object.values(currentCart(shop)).filter(item => item && Number(item.quantity) > 0);
  const cartTotal = shop => cartEntries(shop).reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0), 0);
  const addToCart = (shop, item, unitPrice) => {
    const cart = currentCart(shop);
    const previous = asObject(cart[item.id]);
    const maxQuantity = ['random','trade'].includes(shop.kind) ? 1 : 99;
    const quantity = Math.min(maxQuantity, (Number(previous.quantity) || 0) + 1);
    cart[item.id] = { ...item, quantity, unitPrice, shopId: shop.id, shopName: shop.name };
    state.carts[shop.kind] = cart;
    saveFrontendState(state);
    renderShop(currentStatSnapshot, currentContext.mapName, currentContext.area);
    renderCart(currentStatSnapshot, currentContext.area);
  };
  const removeFromCart = (shop, id) => {
    const cart = currentCart(shop);
    delete cart[id];
    state.carts[shop.kind] = cart;
    saveFrontendState(state);
    renderShop(currentStatSnapshot, currentContext.mapName, currentContext.area);
    renderCart(currentStatSnapshot, currentContext.area);
  };
  const renderShop = (stat, mapName, area) => {
    if (!hudRenderChanged(shopPanel.body,[stat,mapName,area,state.market,state.tradeContracts,state.carts,purchaseBusy,hudReadOnly])) return;
    clear(shopPanel.body);
    if (mapName === '哈基米空间' && area === TRADE_AREA) {
      renderTradeMarket(stat);
      return;
    }
    const shop = shopForArea(area);
    if (mapName !== '哈基米空间' || !shop) {
      shopPanel.body.append(empty('当前区域不开放商店。请前往哈基米军需店或玩家自由贸易区。'));
      return;
    }
    const balance = Number(asObject(stat.统计信息).哈基币) || 0;
    shopPanel.body.append(make('div', 'hkm-reset-small', shop.name + ' · 当前哈基币 ' + balance));
    const stock = (shop.stockIds || []).map(id => ({id,price:Number(GAME_DATA.collectibles[id]?.shopPrice)||0}));
    const grid = make('div', 'hkm-reset-card-grid');
    for (const stockItem of stock) {
      const item = GAME_DATA.collectibles[stockItem.id];
      if (!item) continue;
      const unlock = shop.kind === 'fixed' ? evaluateUnlock(item.unlock, stat) : { allowed: true, label: '' };
      const inCart = Number(currentCart(shop)[item.id]?.quantity) || 0;
      const cardNode = make('article', 'hkm-reset-card hkm-reset-rarity-' + rarityClass(item.rarity));
      const meta = make('div', 'hkm-reset-card-meta');
      meta.append(make('span', 'hkm-reset-chip', item.rarity), make('span', 'hkm-reset-chip', item.category), make('span', 'hkm-reset-chip', '重量 ' + item.weight));
      cardNode.append(make('h4', '', item.name), meta, make('p', '', item.description || '无描述'), make('p', 'hkm-reset-shop-price', '售价 ' + stockItem.price + ' 哈基币'));
      if (!unlock.allowed) cardNode.append(make('p', 'hkm-reset-small hkm-reset-lock', '未解锁：' + unlock.label));
      const actions = make('div', 'hkm-reset-shop-actions');
      const addButton = make('button', 'hkm-reset-shop-button', inCart ? '已在购物车 ×' + inCart : '加入购物车');
      addButton.type = 'button';
      addButton.disabled = !unlock.allowed || purchaseBusy || (shop.kind === 'random' && inCart >= 1);
      addButton.addEventListener('click', () => addToCart(shop, item, stockItem.price));
      hudAttachItemPanel(cardNode, item.name, '商店', { shopId: shop.id, price: stockItem.price, allowed: unlock.allowed, lockNote: unlock.label, fallback: item });
      actions.append(addButton);
      cardNode.append(actions);
      grid.append(cardNode);
    }
    if (!grid.childElementCount) grid.append(empty('当前商店没有可显示的商品。'));
    shopPanel.body.append(grid);
  };
  const purchaseCart = async shop => {
    if (purchaseBusy) return;
    hkm098RequireAlive(); purchaseBusy=true;
    try {
      const stat = await currentStat(); hkm098RequireAlive();
      const mapName=stat.场景?.地图, area=stat.场景?.区域, actual=shopForArea(area);
      if (mapName !== '哈基米空间' || !actual || actual.id !== shop?.id) throw Error('商店区域已变化，请重新打开购物车。');
      const items=cartEntries(actual);
      if (!items.length) return;
      if (actual.kind === 'trade') {await hkm130PurchaseTradeCart(stat,actual,items);return;}
      const balance=aiMoney(stat), total=items.reduce((sum,row)=>sum+Number(row.unitPrice)*Number(row.quantity),0);
      if (!Number.isFinite(total) || total < 0 || items.some(row=>!Number.isInteger(Number(row.quantity)) || Number(row.quantity)<1 || !Number.isFinite(Number(row.unitPrice)) || Number(row.unitPrice)<0)) throw Error('购物车数量或价格无效。');
      if (balance < total) throw Error('哈基币不足：需要 '+total+'，当前只有 '+balance+'。');
      const patch=hudExchangePatch(stat,[],items.map(item=>({item,quantity:item.quantity})),'背包');
      patch.统计信息={...asObject(stat.统计信息),哈基币:balance-total};
      const carts={...HkmLifecycle.copy(state.carts),[actual.kind]:{}};
      const after={carts};
      if (actual.kind === 'random') after.market={...HkmLifecycle.copy(state.market),items:(state.market.items||[]).filter(row=>!items.some(item=>item.id===row.id))};
      const log=hudPlayerName(stat)+'选择在'+actual.name+'购买'+items.map(row=>row.name+'×'+row.quantity).join('、')+'；物品已入背包，花费 '+total+' 哈基币，余额 '+(balance-total)+'。';
      await hkm098Transact('purchase:'+Date.now()+':'+(++hkm095QueueSerial),patch,after,log);
      setStatus('购买成功，商品已放入背包。');
    } catch(error) { setStatus('购买未完成：'+error.message); }
    finally { purchaseBusy=false; await refresh(); }
  };
  const renderCart = (stat, area) => {
    if (!hudRenderChanged(cartPanel.body,[stat,area,currentContext.mapName,state.carts,purchaseBusy,hudReadOnly])) return;
    clear(cartPanel.body);

    const shop = shopForArea(area);
    if (currentContext.mapName !== '哈基米空间' || !shop) {
      cartPanel.body.append(empty('购物车仅在指定商店区域开放。'));
      return;
    }
    const items = cartEntries(shop);
    const grid = make('div', 'hkm-reset-card-grid');
    for (const item of items) {
      const cardNode = make('article', 'hkm-reset-card hkm-reset-rarity-' + rarityClass(item.rarity));
      const meta = make('div', 'hkm-reset-card-meta');
      meta.append(make('span', 'hkm-reset-chip', item.rarity), make('span', 'hkm-reset-chip', '数量 ' + item.quantity), make('span', 'hkm-reset-chip', '单价 ' + item.unitPrice));
      cardNode.append(make('h4', '', item.name), meta, make('p', '', '类别：' + item.category + ' · 价值：' + item.value + ' · 重量：' + item.weight), make('p', 'hkm-reset-cart-details', textOf(item.description, '') + '（点卡片看完整信息）'));
      const removeButton = make('button', 'hkm-reset-cart-button', '移出购物车');
      removeButton.type = 'button';
      removeButton.disabled = purchaseBusy;
      removeButton.addEventListener('click', () => removeFromCart(shop, item.id));
      hudAttachItemPanel(cardNode, item.name, '购物车', { shopId: shop.id, cartId:item.id, unitPrice: item.unitPrice, fallback: item });
      cardNode.append(removeButton);
      grid.append(cardNode);
    }
    if (!items.length) grid.append(empty('购物车为空。'));
    cartPanel.body.append(grid);
    const total = cartTotal(shop);
    const balance = Number(asObject(stat.统计信息).哈基币) || 0;
    cartPanel.body.append(make('div', 'hkm-reset-cart-total', '合计消耗：' + total + ' 哈基币 · 当前：' + balance));
    const confirm = make('button', 'hkm-reset-cart-button', '确定购买');
    confirm.type = 'button';
    confirm.disabled = purchaseBusy || !items.length || balance < total;
    confirm.title = balance < total ? '现有哈基币不足' : '确认购买购物车中的商品';
    confirm.addEventListener('click', () => void purchaseCart(shop, stat));
    cartPanel.body.append(confirm);
  };

  const weightedPick = list => {
    const candidates = Array.isArray(list) ? list : [];
    if (!candidates.length) return null;
    const total = candidates.reduce((sum, item) => sum + Math.max(0, Number(item.drawWeight) || 0 || 1), 0);
    let cursor = Math.random() * total;
    for (const item of candidates) {
      cursor -= Math.max(0, Number(item.drawWeight) || 0 || 1);
      if (cursor <= 0) return item;
    }
    return candidates[candidates.length - 1];
  };


  const hkmLootMeta = (item, tableName) => asObject(asObject(asObject(item?.sources).loot)[textOf(tableName, '')]);
  const areaMatches = (item, map, area, tableName) => {

    const meta = hkmLootMeta(item, tableName);
    if (Object.keys(meta).length) {
      if (meta.allAreas === true) return true;
      const areas = (Array.isArray(meta.areas) ? meta.areas : []).map(name => textOf(name, ''));
      return areas.length === 0 || areas.includes(textOf(area, ''));
    }
    const raw = textOf(item.areasByList?.[tableName], '');
    if (!raw || raw.includes('全部区域')) return true;
    if (raw.includes(area)) return true;
    for (const [label, areas] of Object.entries(asObject(map.areaGroups))) {
      if (Array.isArray(areas) && areas.includes(area) && raw.includes(label)) return true;
    }
    return false;
  };

const HkmUpgrade = (() => {
  const number = value => Number.isFinite(Number(value)) ? Math.max(0,Math.floor(Number(value))) : 0;
  const runId = run => run ? String(run.id || String(run.map)+':'+String(run.startedAt)) : '';
  const quantity = row => number(row?.数量);
  const eligible = (row,run) => runId(run) && row?.摸出对局 === runId(run) ? Math.min(quantity(row),number(row.摸出数量)) : 0;
  const proof = (row,count,run) => ({数量:number(count),摸出对局:runId(run),摸出数量:Math.min(number(count),eligible(row,run))});
  const merge = (current,incoming,count,run) => ({摸出对局:runId(run),摸出数量:Math.min(number(count),eligible(current,run)+eligible(incoming,run))});
  const take = (row,count,run) => ({摸出对局:runId(run),摸出数量:Math.max(0,eligible(row,run)-number(count))});
  const excluded = item => !!(item?.acquisition?.starlightShopOnly || item?.acquisition?.militaryShopOnly || item?.acquisition?.googleSearchOnly);
  const candidates = (game,item) => {
    const rank=game.rarityOrder.indexOf(item?.rarity);
    if(rank<0 || rank>3 || item?.id==='COL-0039')return {items:[],fallback:false,rarity:null};
    const rarity=game.rarityOrder[rank+1];
    const next=Object.values(game.collectibles).filter(row=>row.rarity===rarity && !excluded(row));
    const triple=next.filter(row=>Number(row.value)>=Math.max(0,Number(item.value)||0)*3);
    if(triple.length)return {items:triple,fallback:false,rarity};
    const highest=Math.max(...next.map(row=>Number(row.value)||0));
    return {items:next.filter(row=>(Number(row.value)||0)===highest),fallback:true,rarity};
  };
  const rows = (stat,run,game) => Object.values(stat.背包?.携带收藏品 || {}).map(row=>({row,item:game.collectibles[row.名称] || Object.values(game.collectibles).find(item=>item.name===row.名称 || item.aliases?.includes(row.名称)),count:eligible(row,run)})).filter(row=>row.item && row.count>=3 && candidates(game,row.item).items.length);
  const choose = (game,item,rng=Math.random) => {const pool=candidates(game,item);if(!pool.items.length)throw Error('该收藏品不能升星。');return {...pool,item:pool.items[Math.min(pool.items.length-1,Math.max(0,Math.floor(rng()*pool.items.length)))]};};
  return {runId,quantity,eligible,proof,merge,take,candidates,rows,choose,excluded};
})();

  const HKM_ITEM_CACHE = {};
  const itemById = id => {
    const key = textOf(id, '');
    if (!key) return null;
    if (HKM_ITEM_CACHE[key]) return HKM_ITEM_CACHE[key];

    const base = GAME_DATA.collectibles?.[key] || null;
    const extra = asObject(asObject(HKM_COLLECTIBLES).items)[key] || null;
    const item = base ? (extra ? { ...base, ...extra } : base) : (extra ? { id: key, ...extra } : null);
    if (item) HKM_ITEM_CACHE[key] = item;
    return item;
  };


  const itemLookupName = value => textOf(value, '')
    .replace(/[（(]\s*(?:寻常|少见|珍稀|奇异|至宝|神秘)\s*[）)]\s*$/, '')
    .trim();
  const itemByName = name => {
    const raw = textOf(name, '');
    if (!raw) return null;
    const list = Object.values(asObject(GAME_DATA.collectibles));
    const found = list.find(item => item?.name === raw || item?.aliases?.includes(raw))
      || list.find(item => item?.name === itemLookupName(raw) || item?.aliases?.includes(itemLookupName(raw)))
      || null;
    return found ? itemById(found.id) : null;
  };
  const resultOf = (item, quantity = 1, source = '') => item ? { rarity: item.rarity, item, quantity: Math.max(1, Number(quantity) || 1), source } : null;
  const candidatesFor = (mapName, area, rarity) => {
    const map = GAME_DATA.maps[mapName];
    const tableName = map?.lootTable;
    const ids = Array.isArray(GAME_DATA.lootTables?.[tableName]?.[rarity]) ? GAME_DATA.lootTables[tableName][rarity] : [];
    const all = ids.map(itemById).filter(item => item && !item.acquisition?.militaryShopOnly && (!item.acquisition?.googleSearchOnly || mapName==='谷歌大厦'));
    const regional = all.filter(item => areaMatches(item, map, area, tableName));
    return regional;
  };
  const pickFromDistribution = (order, weights) => {
    const roll = Math.random();
    let cursor = 0;
    for (let index = 0; index < order.length; index += 1) {
      cursor += Number(weights[index] || 0);
      if (roll < cursor) return order[index];
    }
    return order[order.length - 1];
  };
  const drawBySpec = (mapName, area, spec) => {
    const count = randomInt(spec.count || [1, 1]);
    const results = [];
    for (let index = 0; index < count; index += 1) {
      const rarity = pickFromDistribution(spec.rarityOrder || GAME_DATA.rarityOrder, spec.rarity || []);
      const pool=candidatesFor(mapName,area,rarity).filter(item=>(spec.includeSearchOnly || !item.acquisition?.googleSearchOnly) && (!spec.categoryPrefix || textOf(item.category,'').startsWith(spec.categoryPrefix)));
      results.push(resultOf(weightedPick(pool),1,spec.label || '标准化抽取'));
    }
    return results.filter(Boolean);
  };
  const rollKeySpawn = () => {
    const config=GAME_DATA.specialMechanics?.keySpawns;
    if(!config || Math.random()>=config.chance)return [];
    const rarity=pickFromDistribution(config.rarityOrder,config.rarity);
    const pool=[...new Set((GAME_DATA.specialMechanics?.keyContainers || []).map(box=>box.keyId))]
      .map(itemById).filter(item=>item?.category==='钥匙卡片' && item.rarity===rarity && hkmIsKeyItem(item));
    const row=resultOf(weightedPick(pool),1,'刷卡点搜索');
    return row ? [row] : [];
  };
  const hudSeedKeyPoints = (run, scatter) => {
    if(!run || run.keySpawnSeeded)return scatter;
    const areas=asObject(GAME_DATA.specialMechanics?.keySpawns?.areas?.[run.map]);
    for(const [area,count] of Object.entries(areas))for(let index=0;index<count;index++){
      for(const row of rollKeySpawn())scatter=hudScatterMerge(scatter,run.map,area,{...row.item,摸出对局:HkmUpgrade.runId(run),摸出数量:row.quantity,数量:row.quantity},row.quantity);
    }
    run.keySpawnSeeded=true;
    return scatter;
  };
  const drawSearch = (mapName, area, tier, includeSearchOnly = true) => {
    const rule = GAME_DATA.searchRules[String(tier)] || GAME_DATA.searchRules['0'];
    const results = drawBySpec(mapName, area, { count: rule.draws, rarityOrder: GAME_DATA.rarityOrder, rarity: rule.rarity, label: '区域搜索',includeSearchOnly });
    const bonus = GAME_DATA.specialMechanics?.monsterSea?.starColor;
    if (mapName === '魔鬼海' && bonus?.areas?.includes(area) && Math.random() < Number(bonus.chance || 0)) {
      results.push(resultOf(itemById(bonus.itemId), bonus.quantity, '额外0.5%星之彩判定'));
    }
    return results.filter(Boolean);
  };
  const rollOutcome = outcomes => {
    const roll = Math.random();
    let cursor = 0;
    for (const outcome of Array.isArray(outcomes) ? outcomes : []) {
      cursor += Number(outcome.chance || 0);
      if (roll < cursor) return outcome;
    }
    return outcomes?.[outcomes.length - 1] || null;
  };
  const resolveCaveAltar = () => {
    const config = GAME_DATA.specialMechanics?.monsterSea?.caveAltar;
    const outcome = rollOutcome(config?.outcomes);
    return outcome ? [resultOf(itemById(outcome.itemId), outcome.quantity, '神秘洞穴石台')].filter(Boolean) : [];
  };
  const resolveDeepShell = () => {
    const config = GAME_DATA.specialMechanics?.monsterSea?.deepShell;
    const outcome = rollOutcome(config?.outcomes);
    return outcome ? [resultOf(itemById(outcome.itemId), outcome.quantity, '深海幽境大贝壳')].filter(Boolean) : [];
  };
  const ownedQuantity = (stat, itemId) => {
    const target = itemById(itemId);
    if (!target) return 0;
    return entriesOf(stat?.背包?.携带收藏品).reduce((sum, [key, item]) => {
      const same = textOf(item?.编号 ?? item?.id, '') === itemId || textOf(item?.名称, key) === target.name;
      return sum + (same ? Math.max(0, Number(item?.数量 ?? 1) || 0) : 0);
    }, 0);
  };
  const hasActiveEnemies = stat => entriesOf(stat?.敌人).some(([, item]) => {
    const name = textOf(item?.名称 ?? item?.姓名, '');
    return name && name !== '无' && !hkm139Friendly(item) && !aiAlive().some(player => player.name === name && (aiPeaceful('hero', player.id) || !aiCanSee('hero', player)));
  });
  const formatLootActionLines = (title, results, costs) => {
    const lines = ['【获得物品】', '机制：' + title];
    for (const cost of costs || []) lines.push('消耗：' + cost.name + '×' + cost.quantity);
    if (!results.length) lines.push('结果：本次没有获得收藏品。');
    results.forEach((result, index) => {
      if (index > 0) lines.push('');
      lines.push(...modelItemLines(result.item, result.quantity, textOf(result.source, title)));
    });
    lines.push(...itemRefLines(results, title));
    lines.push('所得与消耗已结算。');
    return lines;
  };
  const sendLootAction = async (action, title, results, costs, extra = {}) => {
    const list = (results || []).filter(Boolean);
    const where = extra.target === '安全屋' ? '安全屋' : hudGrantWhere(extra.map || currentContext.mapName);
    const originStat=await currentStat();
    const patch = hkm138Mark(hudExchangePatch(originStat, costs, list, where),list,originStat);
    const granted = {ok:true}, consumed = granted;
    const lines = [hudPlayerName(currentStatSnapshot)+'选择'+title+'。', ...formatLootActionLines(title, list, costs)];
    const notes = [];
    if (granted.ok && list.length) notes.push('收藏品已放入' + where + '。');
    if (consumed.ok && (costs || []).length) notes.push('消耗品已扣除。');
    if (notes.length) lines.splice(lines.length - 1, 0, notes.join(''));
    if (extra.roundLine) lines.splice(lines.length - 1, 0, extra.roundLine);
    const message = lines.join('\n');
    const safePayload = {
      action,
      title,
      results: list.map(modelBriefResultPayload),
      costs: (costs || []).map(cost => ({ name: cost.name, quantity: cost.quantity })),
      settledByFrontend: Boolean(granted.ok),
      ...extra
    };
    const specials={...state.specials};
    if (action==='monster_sea_deep_shell') specials[GAME_DATA.specialMechanics.monsterSea.deepShell.stateKey]=true;
    if (action==='monster_sea_cave_altar') specials[GAME_DATA.specialMechanics.monsterSea.caveAltar.stateKey]=true;
    await hkm098Transact(action+':'+Date.now()+':'+(++hkm095QueueSerial),patch,{specials},message,list.length ? 'loot' : '');
    await refresh();
  };
  const playerKillTotal = stat => Math.max(0, Number(asObject(stat?.统计信息).历史击杀玩家总数) || 0);
  const weirdHouseSearchQuota = stat => {
    const total = playerKillTotal(stat);
    const baselineValue = Number(state.specials['monsterSea.playerKillBaseline']);
    const baseline = Number.isFinite(baselineValue) ? Math.max(0, baselineValue) : total;
    const earned = Math.max(0, total - baseline);
    const used = Math.max(0, Number(state.specials['monsterSea.weirdHouseSearchesUsed']) || 0);
    return { total, baseline, earned, used, remaining: Math.max(0, earned - used) };
  };
  const sendMonsterSeaSpecialSearch = async (subtype, title, context, results, encounter, extra = {}) => {
    const tierCost = Math.max(0, Number(extra.tierCost) || 0);
    const tierLine = tierCost > 0 ? '本次搜索价值等级：' + context.tier + '（已消耗' + tierCost + '级）' : '本次搜索后区域价值等级不下降。';
    const where = extra.target === '安全屋' ? '安全屋' : hudGrantWhere(context.mapName);
    const originStat=await currentStat();
    const patch = hkm138Mark(hudExchangePatch(originStat, [], results, where),results,originStat);
    const lines = [hudPlayerName(currentStatSnapshot)+'选择在'+context.mapName+'的'+context.area+'进行'+title+'。', tierLine];
    if (!results.length) lines.push('结果：本次一无所得。');
    results.forEach((result, index) => {
      if (index > 0) lines.push('');
      lines.push(...modelItemLines(result.item, result.quantity, textOf(result.source, title)));
    });
    lines.push(...formatEncounterLines(encounter));
    if (extra.roundLine) lines.push(extra.roundLine);
    for (const line of Array.isArray(extra.extraLines) ? extra.extraLines : []) lines.push(line);
    lines.push(...itemRefLines(results, title));
    if (results.length) lines.push('所得已入' + where + '。');
    const specials={...state.specials}, tiers={...state.tiers};
    if (subtype==='诡异灵宅') specials['monsterSea.weirdHouseSearchesUsed']=weirdHouseSearchQuota(await currentStat()).used+1;
    if (subtype==='无底深坑') { specials['monsterSea.bottomlessPitSearched']=true; tiers[areaKey(context.mapName,context.area)]=Math.max(0,context.tier-tierCost); }
    await hkm098Transact('special_search:'+Date.now()+':'+(++hkm095QueueSerial),patch,{specials,tiers},lines.join('；'),'search');
    await refresh();
  };
  const runMonsterSeaSpecialSearch = async (subtype, stat) => {
    if (specialBusy || currentContext.mapName !== '魔鬼海' || currentContext.area !== subtype) return;
    const latestStat = await currentStat();
    const context = { ...currentContext };
    const quota = weirdHouseSearchQuota(latestStat);
    if (subtype === '诡异灵宅' && quota.remaining < 1) return;
    if (subtype === '无底深坑' && state.specials['monsterSea.bottomlessPitSearched']) return;
    specialBusy = true;
    try {
    let results = [];
    if (subtype === '精液繁殖场') {
      results = [resultOf(itemById('COL-0039'), 5, '精液繁殖场特殊搜索')].filter(Boolean);
    } else if (subtype === '诡异灵宅') {
      results = drawSearch(context.mapName, context.area, context.tier);
      results.forEach(result => { result.source = '诡异灵宅击杀额度搜索'; });
    } else if (subtype === '无底深坑' && Math.random() < 0.05) {
      results = [resultOf(itemById('COL-0186'), 1, '无底深坑特殊搜索')].filter(Boolean);
    }

    const runActive = Boolean(state.run && state.run.map === context.mapName);
    const spent = runActive ? await hudSpendRounds(latestStat, context.mapName, context.area) : null;
    if(spent?.dead){setStatus('水下缺氧，生命值归零。');return;}
    let observed = [];
    if (runActive) {

      const resolved = aiResolveTurn(context.mapName, { mode: 'search', heroFrom: context.area, heroTo: context.area, area: context.area, stat: latestStat });
      observed = Array.isArray(resolved?.observed) ? resolved.observed : [];
      const enemyPatch = aiEnemyPatch(context.mapName, context.area, latestStat);
      if (resolved?.scatter) enemyPatch.散落物品 = resolved.scatter;
      Object.assign(enemyPatch, resolved?.heroPatch || {});
      await hudCommit(enemyPatch);
    }
    const playerRows = runActive ? aiAlive().filter(player => player.region === context.area && aiCanSee('hero', player)).map(aiEnemyRecord) : [];
      const tierCost = subtype === '无底深坑' ? 1 : 0;
      const encounter = readAreaEncounter(context.mapName, context.area, await currentStat());
      await sendMonsterSeaSpecialSearch(subtype, '魔鬼海·' + subtype + '特殊搜索', context, results, encounter, {
        tierCost,
        roundLine: spent ? hudRoundSpendText(spent) : '',
        extraLines: [
          ...aiObservedLines(observed, context.area),
          ...(playerRows.length ? ['', '同区域玩家：', ...playerRows.map(row => '· ' + row.名称 + '｜' + row.血量 + '｜攻' + row.攻击力 + '｜防' + row.防御力 + '｜速' + row.速度 + '｜' + row.描述)] : []),
        ],
        ...(subtype === '诡异灵宅' ? { playerKillCreditSpent: 1 } : {}),
      });
      setStatus(subtype + '特殊搜索结果已发送；' + (tierCost > 0 ? '区域价值等级已消耗' + tierCost + '级。' : '区域价值等级保持不变。'));
    } catch (error) {
      setStatus(subtype + '特殊搜索未完整结束（已结算项保留）：' + (error?.message || error));
    } finally {
      specialBusy = false;
      renderSpecial(latestStat, currentContext.mapName, currentContext.area);
      updateSearchButton();
    }
  };
  const openKeyContainer = async config => {
    if (specialBusy) return;
    hkm098RequireAlive(); specialBusy=true;
    let settled = false;
    try {
      const stat=await currentStat(); hkm098RequireAlive();
      const latest=readFrontendState();
      if (latest.run?.map !== config.map || stat.场景?.地图 !== config.map || stat.场景?.区域 !== config.area) throw Error('不在该钥匙容器所在的有效对局与区域。');
      if (hkm095Opened(config)) throw Error('本局已开启，或旧开启事务待核验，不能重复开箱。');
      const keyName=textOf(itemById(config.keyId)?.name,''), where=hkmKeyWhere(stat,keyName);
      if (!where) throw Error('缺少对应钥匙。');
      const now=Math.max(0,hkmKeyDurOf(keyName,stat)-1), keychain=HkmLifecycle.copy(asObject(latest.keychain)), keyDurability=HkmLifecycle.copy(asObject(latest.keyDurability));
      const results=drawBySpec(config.map,config.area,config);
      if(config.extraKeySpawn)results.push(...rollKeySpawn());
      const patch=hkm138Mark(hudExchangePatch(stat, where==='背包' && now===0 ? [{name:keyName,quantity:1}] : [],results,'背包'),results,stat);
      if (where==='钥匙链') { if(now>0) keychain[keyName]={...keychain[keyName],耐久:now,价值:HkmFishing.durabilityValue(itemByName(keyName),now,HKM_KEY_MAX)}; else delete keychain[keyName]; }
      else if(now>0){
        const bag=HkmLifecycle.copy(asObject(patch.背包?.携带收藏品 || stat.背包?.携带收藏品)),row=bag[keyName],durs=hkmKeyDurs(row);
        durs[0]=now;bag[keyName]={...row,钥匙耐久:durs};patch.背包={...asObject(stat.背包),...asObject(patch.背包),携带收藏品:bag};
      }
      delete keyDurability[keyName];
      const completed=completeContainer(claimContainer(latest,config.id),config.id);
      const log=hudPlayerName(stat)+'选择用「'+keyName+'」打开'+config.label+'。'+formatLootActionLines(config.map+'·'+config.label,results,[]).join('；')+'；钥匙耐久 -1，剩余 '+now+'/'+HKM_KEY_MAX+'。'+(now===0 ? '该钥匙已从'+where+'移除。' : '');
      await hkm098Transact('container:'+containerKey(latest.run,config.id),patch,{keychain,keyDurability,containerLedger:completed.containerLedger,specials:{...state.specials,['container:'+config.id]:true},achievements:HkmAchievements.observeSearch(state.achievements,results)},log,'use');
      settled = true;
      await hkmShowSearch(config.label, results);
      setStatus(config.label+'已入账，钥匙耐久已扣除，本局不能再次开启。');
    } catch(error) { setStatus((settled ? config.label+'已入账，搜索展示中止：' : '开卡未完整结算：')+error.message); }
    finally { specialBusy=false; await refresh(); }
  };
  const openDeepShell = async stat => {
    const config = GAME_DATA.specialMechanics?.monsterSea?.deepShell;
    if (specialBusy || !config || state.specials[config.stateKey]) return;
    specialBusy = true;
    try {
    const results = resolveDeepShell();
    const spent = await hudSpendRounds(stat, config.map, config.area);
    if(spent?.dead){setStatus('水下缺氧，生命值归零。');return;}
      await sendLootAction('monster_sea_deep_shell', '魔鬼海·深海幽境大贝壳', results, [], { map: config.map, area: config.area, tierCost: 0, interactionRoundCost: spent.cost, underwaterActionCost:spent.waterCost, roundLine:hudRoundSpendText(spent) });
      state.specials[config.stateKey] = true;
      saveFrontendState(state);
      setStatus('大贝壳已打开，区域价值等级不变。');
    } catch (error) {
      setStatus('大贝壳结果未能发送：' + (error?.message || error));
    } finally {
      specialBusy = false;
      renderSpecial(stat, currentContext.mapName, currentContext.area);
    }
  };
  const settleCaveAltar = async stat => {
    const config = GAME_DATA.specialMechanics?.monsterSea?.caveAltar;
    if (specialBusy || !config || state.specials[config.stateKey]) return;
    specialBusy = true;
    const results = resolveCaveAltar();
    try {
      await sendLootAction('monster_sea_cave_altar', '魔鬼海·神秘洞穴首次进入石台', results, [], { map: config.map, area: config.area, tierCost: 0 });
      state.specials[config.stateKey] = true;
      saveFrontendState(state);
      setStatus('石台上的物品已收取。');
    } catch (error) {
      setStatus('石台结果未能发送：' + (error?.message || error));
    } finally {
      specialBusy = false;
      renderSpecial(stat, currentContext.mapName, currentContext.area);
    }
  };
  const useBottles = async (count, stat) => {
    const config = GAME_DATA.specialMechanics?.monsterSea?.bottle;
    const available = ownedQuantity(stat, config?.itemId);
    const limit = Math.min(aiNum(config?.maxPerAction, 5), available);
    if (specialBusy || !config || count < 1 || count > limit) return;
    if (hudInCombat(stat)) {
      setStatus('交战中无法开启漂流瓶。');
      return;
    }
    specialBusy = true;
    const results = [];
    const messages = [];
    for (let index = 0; index < count; index += 1) {
      const outcome = rollOutcome(config.outcomes);
      if (outcome?.kind === 'message') messages.push('漂流瓶 ' + (index + 1) + '：获得一道随机留言（仅作为剧情文字，不附加收藏品）。');
      else if (outcome?.kind === 'weighted_epic_under_3') {
        const pool = candidatesFor('魔鬼海', currentContext.area, '奇异').filter(item => Number(item.weight) <= 3);
        const item = weightedPick(pool);
        if (item) results.push(resultOf(item, 1, '漂流瓶3%奇异收藏品'));
      } else if (outcome?.itemId) results.push(resultOf(itemById(outcome.itemId), outcome.quantity, '漂流瓶'));
    }
    const bottle = itemById(config.itemId);
    const costs = [{ id: bottle.id, name: bottle.name, quantity: count }];
    const gained = results.filter(Boolean);
    try {
      const patch = hudExchangePatch(await currentStat(), costs, gained, '背包');
      const lines = [hudPlayerName(currentStatSnapshot)+'选择开启'+count+'个漂流瓶。', ...formatLootActionLines('漂流瓶×' + count, gained, costs)];
      if (messages.length) lines.splice(lines.length - 1, 0, ...messages);
      await hkm098Transact('bottle:'+Date.now()+':'+(++hkm095QueueSerial),patch,{achievements:HkmAchievements.observeSearch(HkmAchievements.observeBottle(state.achievements,messages.length===1 && gained.length===0),gained)},lines.join('；'),'use',count);
      setStatus('已开启 ' + count + ' 个漂流瓶，结果已直接入账。');
    } catch (error) {
      setStatus('漂流瓶结果未能发送：' + (error?.message || error));
    } finally {
      specialBusy = false;
      await refresh();
    }
  };




  const hudScatterKey = (mapName, area, name) => textOf(mapName, '') + '::' + textOf(area, '') + '::' + textOf(name, '');
  const hudScatterHere = (stat, mapName, area) => entriesOf(asObject(stat?.散落物品))
    .filter(([, row]) => textOf(row?.地图, '') === textOf(mapName, '') && textOf(row?.区域, '') === textOf(area, '') && textOf(row?.名称, '') && textOf(row?.名称, '') !== '无')
    .map(([key, row]) => ({ key, row }));
  const hudScatterMerge = (all, mapName, area, item, quantity = 1) => {
    const name = textOf(item?.name ?? item?.名称, '');
    if (!name) return all;
    const key = hudScatterKey(mapName, area, name);
    const current = asObject(all[key]);
    all[key] = {
      地图: textOf(mapName, ''),
      区域: textOf(area, ''),
      名称: name,
      稀有度: textOf(item?.rarity ?? item?.稀有度 ?? current.稀有度, '寻常'),
      数量: Math.max(1, aiNum(current.数量, 0) + Math.max(1, aiNum(quantity, 1))),
      价值: aiNum(item?.value ?? item?.价值 ?? current.价值, 0),
      重量: aiNum(item?.weight ?? item?.重量 ?? current.重量, 0),
      描述: textOf(item?.description ?? item?.描述 ?? current.描述, ''),
      ...HkmUpgrade.merge(current,item,aiNum(current.数量,0)+Math.max(1,aiNum(quantity,1)),state.run),
      ...(hkmIsKeyItem(itemByName(name)) ? {钥匙耐久:[...hkmKeyDurs(current,aiNum(current.数量,0)),...hkmKeyDurs(item,Math.max(1,aiNum(quantity,1)))]}:{}),
    };
    return all;
  };
  const hudScatterOf = (stat, mapName, area, item, quantity = 1) => hudScatterMerge({ ...asObject(stat?.散落物品) }, mapName, area, item, quantity);








  const hudMissionScatterKeys = (stat, keepMap) => {
    const keep = textOf(keepMap, '');
    return entriesOf(asObject(stat?.散落物品)).filter(([key, row]) => {
      const map = textOf(row?.地图, '') || textOf(String(key).split('::')[0], '');
      if (textOf(asObject(GAME_DATA.maps?.[map]).kind, '') !== 'mission') return false;
      return map !== keep;
    }).map(([key]) => key);
  };







  const hudCombatFlagOn = stat => {
    const raw = asObject(stat?.场景).是否战斗中;
    if (raw === true || raw === 1) return true;
    return ['是', '真', 'true', '1'].indexOf(textOf(raw, '').toLowerCase()) >= 0;
  };
  const hudLootLocked = stat => hudCombatFlagOn(stat);
  const HUD_LOOT_LOCK_NOTE = '战斗中无法搜刮或拾取物品，先脱离交战。';
  const hudRequireLoot = async (session = null) => {
    hkm098RequireAlive();
    const stat = await currentStat();
    hkm098RequireAlive();
    if (hudLootLocked(stat)) throw Error(HUD_LOOT_LOCK_NOTE);
    if (session) {
      const row = hudBoxWindowOf(session.boxId) || session;
      if (state.run?.map !== stat.场景?.地图 || textOf(row.area, '') !== textOf(stat.场景?.区域, '')) throw Error('战利品盒不在当前区域。');
    }
    return stat;
  };

  const hudSettleCombatFlag = async stat => {
    if (hudReadOnly || !hudCombatFlagOn(stat) || hasActiveEnemies(stat)) { autoWriteSettle('combatFlag'); return false; }
    if (!autoWriteAllowed('combatFlag', 'no-enemy')) return false;
    const result = await aiWriteVars({ 场景: { ...asObject(stat?.场景), 是否战斗中: false } },stat);
    if (!result.ok) return false;
    autoWriteSettle('combatFlag');
    currentStatSnapshot = null;
    return true;
  };




  const hudReusableToy = item => {
    const category = textOf(item?.category, '');
    return category.indexOf('情趣用品') >= 0 && category.indexOf('消耗品') < 0 && category.indexOf('武器装备') < 0;
  };




  const HUD_NPC_THREAT = {
    '[谷歌总裁]耄耋': 5,
    '安保队长': 3,
    '安保队员': 2,
    '泰坦安康鱼': 5,
    '触手boss': 5,
    '触手怪': 3,
    '鲨鱼': 3,
    '电鳗': 2,
    '荧光水母': 2,
    '海豚': 2,
  };
  const hudNpcThreat = name => {
    const raw = textOf(name, '').trim();
    if (Object.hasOwn(HUD_NPC_THREAT, raw)) return aiNum(HUD_NPC_THREAT[raw], 2);
    const base = raw.replace(/[\s_-]*\d+\s*$/, '').trim();
    return aiNum(HUD_NPC_THREAT[base], 2);
  };




  const hudDraftMission = (stat, mapName, existing = null) => {
    const previous = state.run;
    try {
      state.run = existing ? HkmLifecycle.copy(existing) : aiStartRun(mapName, stat);
      const run = state.run;
      if (!run) throw Error('目标地图没有对局配置。');
      let scatter = { ...asObject(stat.散落物品) };
      if (!run.scatterSeeded?.['*all*']) {
        hudMissionScatterKeys(stat, '').forEach(key => delete scatter[key]);
        let seededAreas = 0;
        for (const area of aiMapAreas(mapName)) {
          const tier = aiBaseTier(mapName, area), chance = tier <= 0 ? 0 : Math.min(1, 0.10 + 0.05 * (tier - 1));
          if (chance <= 0 || Math.random() >= chance) continue;
          const batches = 1;
          let hit = false;
          for (let index=0; index<batches; index+=1) for (const row of drawSearch(mapName, area, tier, false)) {
            if (!row?.item) continue;
            scatter = hudScatterMerge(scatter, mapName, area, {...row.item,摸出对局:HkmUpgrade.runId(run),摸出数量:row.quantity,数量:row.quantity}, row.quantity); hit = true;
          }
          if (hit) seededAreas += 1;
        }
        run.scatterSeeded = { '*all*':true }; run.seededAreas = seededAreas;
      }
      scatter=hudSeedKeyPoints(run,scatter);
      aiNpcSpawnAll(mapName, stat, false);
      const area = existing && stat.场景?.地图 === mapName ? textOf(stat.场景?.区域, run.spawn) : run.spawn;
      const enemies = aiEnemyPatch(mapName, area, { ...stat, 敌人:{} }).敌人;
      const oldHero=hudHeroStats(stat,asObject(stat.装备));
      const hero=hudHeroStats({...stat,主角:oldHero,场景:{...asObject(stat.场景),地图:mapName,区域:area}},asObject(stat.装备));
      const cap=aiRoundCapFor(mapName,{...stat,主角:hero});
      if (!existing) {run.rounds=cap;if(mapName==='魔鬼海')run.water=HkmSea.cap({...stat,主角:hero});}
      run.pendingEntry = false; run.entered = mapName;
      return { run, area, scatter, enemies, hero, cap };
    } finally { state.run = previous; }
  };
  const hudPickScatter = async (key, stat) => {
    stat = await hudRequireLoot();
    const row = asObject(asObject(stat?.散落物品)[key]);
    const name = textOf(row.名称, '');
    if (!name) return;
    if (row.地图 !== stat.场景?.地图 || row.区域 !== stat.场景?.区域) throw Error('该物品不在当前区域。');
    const quantity = Math.max(1, aiNum(row.数量, 1));
    const item = itemByName(name) || { name, rarity: textOf(row.稀有度, '寻常'), value: aiNum(row.价值, 0), weight: aiNum(row.重量, 0), description: textOf(row.描述, '') };
    const bag = { ...hudBucketOf(stat, '背包') };
    aiGrantBucket(bag, item, quantity,row);
    const all = { ...asObject(stat?.散落物品) };
    delete all[key];
    const bagBox = { ...asObject(stat?.背包), 携带收藏品: bag };
    await hudCommit({ 背包: bagBox, 散落物品: all, 主角: hudBurdenPatch(stat, bagBox) }, 'loot');
    queueItemMove(name, '地上', '背包');
    setStatus('已拾取「' + name + '」×' + quantity + '。');
  };
  const hudPickAllScatter = async (stat, mapName, area) => {
    stat = await hudRequireLoot();
    if (mapName !== stat.场景?.地图 || area !== stat.场景?.区域) throw Error('区域已变化，请使用当前区域的拾取按钮。');
    const rows = hudScatterHere(stat, mapName, area);
    if (!rows.length) return;
    const bag = { ...hudBucketOf(stat, '背包') };
    const all = { ...asObject(stat?.散落物品) };
    const taken = [];
    for (const row of rows) {
      const name = textOf(row.row.名称, '');
      const quantity = Math.max(1, aiNum(row.row.数量, 1));
      const item = itemByName(name) || { name, rarity: textOf(row.row.稀有度, '寻常'), value: aiNum(row.row.价值, 0), weight: aiNum(row.row.重量, 0), description: textOf(row.row.描述, '') };
      aiGrantBucket(bag, item, quantity,row.row);
      delete all[row.key];
      taken.push(name + '×' + quantity);
    }
    const bagBox = { ...asObject(stat?.背包), 携带收藏品: bag };
    await hudCommit({ 背包: bagBox, 散落物品: all, 主角: hudBurdenPatch(stat, bagBox) }, 'loot');
    setStatus('已拾取地上的 ' + taken.length + ' 项：' + taken.join('、') + '。');
  };

  const renderScatter = (stat, mapName, area) => {
    clear(scatterBox);
    const head = make('div', 'hkm-reset-scatter-head');
    head.append(make('span', 'hkm-reset-scatter-title', '当前区域散落'));
    scatterBox.append(head);
    const boxes = renderLootBoxes(stat, scatterBox);
    const rows = hudScatterHere(stat, mapName, area);
    head.append(make('span', 'hkm-reset-small', '战利品盒 ' + boxes + ' · 物品 ' + rows.length));
    if (rows.length > 1) {
      const all = make('button', 'hkm-reset-mini', '全部拾取');
      all.type = 'button';
      all.disabled = hudLootLocked(stat) || hudReadOnly;
      all.title = hudLootLocked(stat) ? HUD_LOOT_LOCK_NOTE : '把地上这 ' + rows.length + ' 项一起捡回背包（不消耗交互轮数）';
      all.addEventListener('click', hudAction(async () => {
        if (specialBusy) return;
        specialBusy = true;
        try { await hudPickAllScatter(await currentStat(), mapName, area); } finally { specialBusy = false; }
      }));
      head.append(all);
    }
    if (!rows.length) {
      return;
    }
    const grid = make('div', 'hkm-reset-tiles');
    for (const row of rows) {
      const rarity = textOf(row.row.稀有度, '寻常');
      const name = textOf(row.row.名称, '');
      const source = itemByName(name);
      const tile = make('div', 'hkm-reset-tile');
      tile.setAttribute('role', 'button');
      tile.tabIndex = 0;
      tile.style.borderLeftColor = hudTone(rarity);
      const gem = make('span', 'hkm-reset-tile-gem');
      gem.style.color = hudTone(rarity);
      const body = make('span', 'hkm-reset-tile-body');
      body.append(
        make('span', 'hkm-reset-tile-name', name),
        make('span', 'hkm-reset-tile-meta', '×' + textOf(row.row.数量, '1') + ' · 价值 ' + textOf(row.row.价值, '0') + ' · 重量 ' + textOf(row.row.重量, '0')),
      );
      const main = make('div', 'hkm-reset-tile-main');
      main.append(gem, body);
      tile.append(main);
      tile.title = name + '：地上的散落物，可以捡回背包';
      const actions = make('div', 'hkm-reset-card-actions');
      const pick = make('button', 'hkm-reset-mini', '拾取');
      pick.type = 'button';
      pick.disabled = hudLootLocked(stat) || hudReadOnly;
      pick.title = hudLootLocked(stat) ? HUD_LOOT_LOCK_NOTE : '捡回背包并重新计算负重（不消耗交互轮数）';
      pick.addEventListener('click', hudAction(async () => {
        if (specialBusy) return;
        specialBusy = true;
        try { await hudPickScatter(row.key, await currentStat()); } finally { specialBusy = false; }
      }));
      actions.append(pick);
      tile.append(actions);
      hudAttachItemPanel(tile, name, '散落', { where: '散落', key: row.key, quantity: textOf(row.row.数量, '1') }, { hover: true });
      grid.append(tile);
    }
    scatterBox.append(grid);
  };
  const renderSpecial = (stat, mapName, area) => {
    if (!hudRenderChanged(specialPanel.body,[stat,mapName,area,state.run,state.specials,state.tiers,state.keychain,state.keyDurability,specialBusy,hudReadOnly])) return;
    clear(specialPanel.body);

    let cards = 0;
    const addActionCard = (title, detail, buttonLabel, disabled, handler) => {
      cards += 1;
      const card = make('article', 'hkm-reset-card');
      card.append(make('h4', '', title), make('p', 'hkm-reset-small', detail));
      if (buttonLabel) {
        const button = make('button', 'hkm-reset-shop-button', buttonLabel);
        button.type = 'button';
        button.disabled = Boolean(disabled || specialBusy);
        button.addEventListener('click', handler);
        card.append(button);
      }
      specialPanel.body.append(card);
    };

    if(mapName==='魔鬼海' && GAME_DATA.fishing.areas.includes(area)){
      const resume=state.fishing?.cast?.active;
      addActionCard('深水战术垂钓','抛钩消耗一份精液；钓上海怪或断线消耗1轮交互。',resume?'继续垂钓':'钓鱼',hudInCombat(stat),hudAction(hkmFishingOpen));
      specialPanel.body.lastElementChild.querySelector('button')?.classList.add('hkm-fishing-entry');
    }
    for (const box of (GAME_DATA.specialMechanics?.keyContainers || [])) {
      if (box.map !== mapName || box.area !== area) continue;
      const keyName = textOf(itemById(box.keyId)?.name, textOf(box.keyId, ''));
      const opened = hkm095Opened(box);
      const where = hkmKeyWhere(stat, keyName);
      const detail = opened ? '本局已经打开。'
        : (where ? '用「' + keyName + '」（在' + where + '，耐久 ' + hkmKeyDurOf(keyName) + '/' + HKM_KEY_MAX + '）开启：消耗 1 点耐久，不消耗区域价值等级。'
          : '需要「' + keyName + '」：可从背包或钥匙链使用；局内不能移入或移出钥匙链。');
      const extra=box.extraKeySpawn ? ' 同次开卡额外判定25%出卡，出卡后少见/珍稀/奇异为60%/30%/10%，计为搜索所得。' : box.categoryPrefix ? ' 仅产出武器装备类收藏品。' : '';
      addActionCard(box.label, detail+extra, opened ? '已打开' : (where ? '开卡' : '缺钥匙'), opened || !where, () => void openKeyContainer(box, stat));
    }
    if (mapName === '魔鬼海' && area === '精液繁殖场') {
      addActionCard('精液繁殖场特殊搜索', '每次固定获得“一份精液”×5；可重复搜索；区域价值等级不下降。', '特殊搜索', false, () => void runMonsterSeaSpecialSearch('精液繁殖场', stat));
    }
    if (mapName === '魔鬼海' && area === '诡异灵宅') {
      const quota = weirdHouseSearchQuota(stat);
      const detail = '本局每击杀一名玩家获得1次搜索额度；已获得 ' + quota.earned + ' 次，已使用 ' + quota.used + ' 次，剩余 ' + quota.remaining + ' 次；区域价值等级不下降。';
      addActionCard('诡异灵宅特殊搜索', detail, quota.remaining > 0 ? '特殊搜索' : '暂无击杀额度', quota.remaining < 1, () => void runMonsterSeaSpecialSearch('诡异灵宅', stat));
    }
    if (mapName === '魔鬼海' && area === '无底深坑') {
      const searched = Boolean(state.specials['monsterSea.bottomlessPitSearched']);
      addActionCard('无底深坑特殊搜索', searched ? '本局已经搜索过。' : '每局仅可搜索1次；95%一无所得，5%获得“狱门疆·表”；成功结算后消耗1级区域价值。', searched ? '本局已搜索' : '特殊搜索', searched, () => void runMonsterSeaSpecialSearch('无底深坑', stat));
    }
    const deepShell = GAME_DATA.specialMechanics?.monsterSea?.deepShell;
    if (mapName === deepShell?.map && area === deepShell?.area) {
      const opened = Boolean(state.specials[deepShell.stateKey]);
      addActionCard('显眼的大贝壳', opened ? '本局已经打开。' : '消耗1轮交互轮数（受深海翻倍影响），不消耗区域价值等级。', opened ? '已打开' : '打开大贝壳', opened, () => void openDeepShell(stat));
    }
    const caveAltar = GAME_DATA.specialMechanics?.monsterSea?.caveAltar;
    if (mapName === caveAltar?.map && area === caveAltar?.area && !state.specials[caveAltar.stateKey]) {
      addActionCard('首次进入石台', '本局首次进入神秘洞穴时，可收取石台上的物品。', '结算石台', false, () => void settleCaveAltar(stat));
    }

    const extractAreas = Array.isArray(GAME_DATA.maps?.[mapName]?.extractAreas) ? GAME_DATA.maps[mapName].extractAreas : [];
    if (textOf(GAME_DATA.maps?.[mapName]?.kind, '') === 'mission' && extractAreas.includes(area)) {
      const payment = hudExtractPayment(stat, mapName, area), { rule, owned } = payment;
      const killRule=HkmFishing.extraction(state.run,mapName,area);
      const ruleOk = killRule.ok && payment.ok;
      const fighting = hudInCombat(stat);
      const plan = hudExtractionPlan(stat);
      const detail = '条件：' + (killRule.text ? killRule.text+'；' : '') + (rule ? textOf(rule.label, '无') + '（现在有 ' + owned + '）' : '无（站在撤离点即可撤离）')
        + '。撤离后回到哈基米空间·中转站并恢复全部状态；'
        + (plan.length ? '局内限定物品会折成哈基币：' + plan.map(row => row.name + '（' + row.value + '）').join('、') + '。' : '当前没有需要折算的局内限定物品。')
        + (fighting ? '战斗中不能撤离，先脱离交战。' : '');
      addActionCard('撤离点：' + area, detail, fighting ? '战斗中无法撤离' : (ruleOk ? '撤离' : '条件不足'), fighting || !ruleOk, () => void hudRunExtraction(stat, mapName, area));
    }
    if (mapName === '魔鬼海' && monsterMapNote(area)) {
      addActionCard('区域机制', monsterMapNote(area), '', true, () => {});
    }
    if (!cards) specialPanel.body.append(empty('当前区域没有额外可做的事。'));
  };
  const monsterMapNote = area => {
    const map = GAME_DATA.maps?.['魔鬼海'];
    const notes = [];
    if (map?.nonDepletingAreas?.includes(area)) notes.push('本区域搜索后价值等级不会下降。');
    if (map?.starColorAreas?.includes(area)) notes.push('每次搜索额外执行0.5%星之彩判定。');
    if (map?.fishingAreas?.includes(area)) notes.push('本区域为钓鱼点。');
    return notes.join(' ');
  };
  const hudDraftSearchCounters = (stat,context) => {
    const previous=state.itemCounters;
    try { state.itemCounters=HkmLifecycle.copy(previous); hudMaskCountSearch(stat,context.mapName,context.area,context.tier); return HkmLifecycle.copy(state.itemCounters); }
    finally { state.itemCounters=previous; }
  };
  const HKM_SEARCH_MS = { 寻常: 500, 少见: 750, 珍稀: 1250, 奇异: 2000, 至宝: 3000, 神秘: 3000 };
  const hkmSearchSpan = item => aiNum(item?.weight, 0) >= 7 ? 3 : aiNum(item?.weight, 0) >= 3.5 ? 2 : 1;
  const hkmSearchDuration = item => {
    const base = HKM_SEARCH_MS[textOf(item?.rarity, '')] || HKM_SEARCH_MS.寻常;
    const span = hkmSearchSpan(item);
    const key = (GAME_DATA.specialMechanics?.keyContainers || []).some(container => container.keyId === item?.id);
    return base * (span === 3 ? 2.5 : span === 2 ? 1.6 : 1) + (key ? 2000 : 0);
  };
  let hkmSearchView = null;
  const hkmSearchIcon = item => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 64 64');
    svg.setAttribute('aria-hidden', 'true');
    const category = textOf(item?.category, '');
    const shape = category.includes('武器') ? 'M10 23h32v9H25l-4 13h-8l4-13H10z M42 25h12v5H42 M32 32v8h7v-8'
      : category.includes('装备') ? 'M22 10l10 5 10-5 12 14-9 8-3-5v27H22V27l-3 5-9-8z'
      : /鱼|水产/.test(category) ? 'M12 32c10-17 28-17 38 0-10 17-28 17-38 0z M12 32L4 22v20z M37 28h1'
      : /药|医|食|饮/.test(category) ? 'M23 9h18v8l6 8v28H17V25l6-8z M26 34h12 M32 28v12'
      : 'M12 20l20-10 20 10v24L32 54 12 44z M12 20l20 10 20-10 M32 30v24';
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', shape);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linejoin', 'round');
    svg.append(path);
    return svg;
  };
  const hkmShowSearch = (title, results) => {
    hkm098AssertOwner();
    if (hkmSearchView) hkmSearchView.dispose();
    const found = (Array.isArray(results) ? results : []).filter(row => row?.item);
    const mask = hudPromptMask();
    mask.className = 'hkm-search-mask';
    const panel = make('section', 'hkm-search-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', title);
    panel.tabIndex = -1;
    const head = make('div', 'hkm-search-head');
    const heading = make('div', 'hkm-search-heading');
    heading.append(make('span', 'hkm-search-kicker', '容器搜索'), make('h3', '', title));
    const close = make('button', 'hkm-search-close', found.length ? '搜索中…' : '确定');
    close.type = 'button';
    close.disabled = found.length > 0;
    head.append(heading, close);
    const meter = make('div', 'hkm-search-meter');
    meter.setAttribute('role', 'status');
    const status = make('span', '', found.length ? '正在搜索' : '容器为空');
    const count = make('span', '', '0 / ' + found.length);
    meter.append(status, count);
    const grid = make('div', 'hkm-search-grid');
    const board = make('div', 'hkm-search-board');
    grid.append(board);
    const maxSpan = Math.max(1, ...found.map(row => hkmSearchSpan(row.item)));
    let layoutKey = '';
    const layout = () => {
      const style = window.getComputedStyle(grid), gap = parseFloat(window.getComputedStyle(board).columnGap) || 8;
      const available = Math.max(118, grid.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0));
      const columns = Math.max(1, Math.floor((available + gap) / (118 + gap)));
      const key = columns + ':' + available + ':' + gap;
      if (layoutKey === key) return;
      layoutKey = key;
      board.style.setProperty('--search-columns', String(Math.max(maxSpan, columns)));
      board.style.setProperty('--search-cell-width', Math.max(118, (available - gap * (columns - 1)) / columns) + 'px');
      slots.forEach((slot, index) => {
        const span = hkmSearchSpan(found[index].item);
        slot.style.gridColumn = (span >= columns ? '1 / ' : '') + 'span ' + span;
      });
    };
    const layoutObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(layout) : null;
    const slots = found.map((row, index) => {
      const slot = make('div', 'hkm-search-slot');
      slot.style.setProperty('--search-span', String(hkmSearchSpan(row.item)));
      slot.setAttribute('aria-label', '未搜索物品 ' + (index + 1));
      slot.append(make('span', 'hkm-search-index', String(index + 1).padStart(2, '0')), make('span', 'hkm-search-cover'));
      board.append(slot);
      return slot;
    });
    if (!found.length) board.append(make('p', 'hkm-search-empty', '未发现物品'));
    panel.append(head, meter, grid);
    mask.append(panel);
    const previousFocus = document.activeElement;
    let searchTimer = 0, ownerTimer = 0, index = 0, settled = false, disposed = false, pendingImage = null;
    let complete = found.length === 0;
    panel.setAttribute('aria-busy', String(!complete));
    let resolveDone, rejectDone;
    const done = new Promise((resolve, reject) => { resolveDone = resolve; rejectDone = reject; });
    const view = { dispose: () => {
      if (disposed) return;
      disposed = true;
      clearTimeout(searchTimer);
      layoutObserver?.disconnect();
      window.removeEventListener('resize', layout);
      clearInterval(ownerTimer);
      document.removeEventListener('keydown', onKey, true);
      mask.remove();
      if (hkmSearchView === view) hkmSearchView = null;
      if (!settled) { settled = true; rejectDone(Error('搜索展示已中止；已结算物品保留。')); }
      if (mask.contains(document.activeElement) || document.activeElement === document.body) {
        if (previousFocus?.isConnected) previousFocus.focus();
      }
    } };
    const onKey = event => {
      if (!mask.contains(event.target)) return;
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation();
      } else if (event.key === 'Tab') {
        event.preventDefault(); event.stopImmediatePropagation();
        (close.disabled ? panel : close).focus();
      }
    };
    const checkOwner = () => {
      try { hkm098AssertOwner(); }
      catch (_) { view.dispose(); }
    };
    const begin = () => {
      const slot = slots[index];
      const duration = hkmSearchDuration(found[index].item);
      slot.style.setProperty('--search-duration', duration + 'ms');
      slot.classList.add('is-scanning');
      slot.setAttribute('aria-label', '正在搜索物品 ' + (index + 1));
      slot.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const picture = hudItemPicture(found[index].item);
      pendingImage = picture ? make('img') : null;
      if (pendingImage) { pendingImage.decoding = 'async'; pendingImage.src = picture; }
      searchTimer = setTimeout(revealNext, duration);
    };
    const reveal = () => {
      hkm098AssertOwner();
      const row = found[index], item = row.item, slot = slots[index];
      const rarity = textOf(item.rarity, '寻常'), quantity = Math.max(1, Number(row.quantity) || 1);
      const tone = textOf(HUD_RARITY_TONE[rarity], '#deeaf1');
      clear(slot);
      slot.classList.remove('is-scanning');
      slot.classList.add('is-revealed');
      slot.style.setProperty('--search-tone', tone);
      slot.style.setProperty('--search-wash', hudWash(rarity));
      slot.setAttribute('aria-label', item.name + '，' + rarity + '，数量 ' + quantity);
      const visual = make('div', 'hkm-search-visual');
      const fallback = hkmSearchIcon(item);
      visual.append(fallback);
      if (pendingImage) {
        const image = pendingImage;
        image.alt = textOf(item.name, '物品');
        image.hidden = true;
        const loaded = () => { if (image.naturalWidth > 0) { image.hidden = false; fallback.setAttribute('hidden', ''); } };
        image.addEventListener('load', loaded, { once: true });
        image.addEventListener('error', () => { image.remove(); fallback.removeAttribute('hidden'); }, { once: true });
        visual.append(image);
        if (image.complete) loaded();
      }
      const foot = make('div', 'hkm-search-foot');
      foot.append(make('span', 'hkm-search-rarity', rarity), make('span', 'hkm-search-qty', '×' + quantity));
      slot.append(visual, make('div', 'hkm-search-name', textOf(item.name)), foot);
      count.textContent = (index + 1) + ' / ' + found.length;
    };
    const revealNext = () => {
      searchTimer = 0;
      if (disposed) return;
      try {
        reveal();
        index += 1;
        if (index === found.length) {
          complete = true;
          panel.setAttribute('aria-busy', 'false');
          status.textContent = '搜索完成';
          close.textContent = '确定'; close.disabled = false;
          return;
        }
        begin();
      } catch (error) {
        if (!settled) { settled = true; rejectDone(error); }
        view.dispose();
      }
    };
    hkmSearchView = view;
    close.addEventListener('click', () => {
      if (!complete || disposed) return;
      try { hkm098AssertOwner(); }
      catch (_) { view.dispose(); return; }
      settled = true; resolveDone(); view.dispose();
    });
    document.addEventListener('keydown', onKey, true);
    hkmPortal.append(mask);
    layout();
    if (layoutObserver) layoutObserver.observe(grid);
    else window.addEventListener('resize', layout);
    panel.focus();
    ownerTimer = setInterval(checkOwner, 250);
    if (found.length) begin();
    return done;
  };
  disposers.push(() => hkmSearchView?.dispose());
  const sendSearchResults = async (context, results, encounter, options = {}) => {
    const stat = await currentStat();
    const where = options.target === '安全屋' ? '安全屋' : hudGrantWhere(context.mapName);
    const patch = hkm138Mark(hudExchangePatch(stat, [], results, where),results,stat);
    const found=results.filter(row=>row?.item);
    const lines=[hudPlayerName(stat)+'选择在'+context.mapName+'的'+context.area+'搜索。','【搜索】等级'+context.tier];
    for(const result of found) {
      const item=result.item;
      lines.push('· '+item.name+'（'+textOf(item.rarity,'未知')+'）×'+Math.max(1,Number(result.quantity)||1)+'｜'+textOf(item.category,'未分类'));
      if(item.description) lines.push('  '+item.description);
    }
    if(!found.length) lines.push('未获得收藏品。');
    lines.push(...itemRefLines(found,'搜索所得'));
    if(options.roundLine) lines.push(options.roundLine);
    lines.push(...(Array.isArray(options.extraLines) ? options.extraLines : []),...formatEncounterLines(encounter));
    if(found.length) lines.push('所得已入'+where+'。');
    const nonDepleting=context.mapName==='魔鬼海' && GAME_DATA.maps['魔鬼海']?.nonDepletingAreas?.includes(context.area);
    const tiers={...state.tiers,[areaKey(context.mapName,context.area)]:nonDepleting ? context.tier : Math.max(0,context.tier-1)};
    const settlementId='search:'+Date.now()+':'+(++hkm095QueueSerial);
    const questPatch = questProgressPatch(stat, { kind: 'search', map: context.mapName, area: context.area, count: 1 }, patch);
    await hkm098Transact(settlementId,{...patch,...questPatch},{tiers,itemCounters:hudDraftSearchCounters(stat,context),achievements:HkmAchievements.observeSearch(state.achievements,found)},lines.join('；'),'search');
    await refresh();
    if (options.showContainer) await hkmShowSearch(context.mapName + ' · ' + context.area, found);
    lines.push('搜索完成，变量已由前端写入无需重复更改，请描写搜索的过程');
    await sendFrontendUserMessage(wrapSearchResultMessage(lines.join('\n')), { action:'search_results',map:context.mapName,area:context.area,tier:context.tier,results:results.map(modelBriefResultPayload),encounter:encounter?.enemies || [],grantedTo:where }, {coveredSettlementIds:[settlementId]});
    setStatus('搜索完成。');
  };
  const updateSearchButton = () => {
    const map = GAME_DATA.maps[currentContext.mapName];
    const isSpecialSearchArea = currentContext.mapName === '魔鬼海' && MONSTER_SEA_SPECIAL_SEARCH_AREAS.has(currentContext.area);
    const enabled = Boolean(!isSpecialSearchArea && map?.searchable && currentContext.tier > 0 && GAME_DATA.lootTables[map.lootTable]);
    searchButton.disabled = !enabled || searchBusy || moveBusy || hudReadOnly;
    searchButton.title = isSpecialSearchArea ? '该区域需要走特殊交互' : enabled ? '在该区域搜寻收藏品' : '当前区域无法搜寻';
    searchButton.dataset.valueTier=String(Math.max(0,Math.min(6,Number(currentContext.tier)||0)));
    searchButton.textContent = searchBusy ? '搜寻中…' : '搜寻';
  };
  searchButton.addEventListener('click', hudAction(async () => {
    if (searchBusy || searchButton.disabled) return;
    searchBusy = true;
    try {
    updateSearchButton();
    const before = currentContext.tier;
    const context = { ...currentContext };
    const stat = await currentStat();
    const isMission = textOf(GAME_DATA.maps?.[context.mapName]?.kind, '') === 'mission';
    const runActive = Boolean(isMission && state.run && state.run.map === context.mapName);
    const spent = runActive ? await hudSpendRounds(stat, context.mapName, context.area) : null;
    if(spent?.dead){setStatus('水下缺氧，生命值归零。');return;}
    let observed = [];
    if (runActive) {

      const resolved = aiResolveTurn(context.mapName, { mode: 'search', heroFrom: context.area, heroTo: context.area, area: context.area, stat });
      observed = Array.isArray(resolved?.observed) ? resolved.observed : [];
      const enemyPatch = aiEnemyPatch(context.mapName, context.area, stat);
      if (resolved?.scatter) enemyPatch.散落物品 = resolved.scatter;
      Object.assign(enemyPatch, resolved?.heroPatch || {});
      await hudCommit(enemyPatch);
    }
    const results = drawSearch(context.mapName, context.area, before);
    const encounter = readAreaEncounter(context.mapName, context.area, await currentStat());
    const playerRows = runActive ? aiAlive().filter(player => player.region === context.area && aiCanSee('hero', player)).map(aiEnemyRecord) : [];
      await sendSearchResults(context, results, encounter, {
        showContainer: true,
        roundLine: spent ? hudRoundSpendText(spent) : '',
        extraLines: [
          ...aiObservedLines(observed, context.area),
          ...(playerRows.length ? ['', '同区域玩家：', ...playerRows.map(row => '· ' + row.名称 + '｜' + row.血量 + '｜攻' + row.攻击力 + '｜防' + row.防御力 + '｜速' + row.速度 + '｜' + row.描述)] : []),
        ],
      });
      const key = areaKey(context.mapName, context.area);
      const nonDepleting = context.mapName === '魔鬼海' && GAME_DATA.maps['魔鬼海']?.nonDepletingAreas?.includes(context.area);
      const nextTier = nonDepleting ? before : Math.max(0, before - 1);
      currentContext.tier = nextTier;
      setStatus('搜索完成，获得 ' + results.length + ' 项收藏品。' + (nonDepleting ? ' 本区域价值等级保持不变。' : ''));
    } catch (error) {
      setStatus('搜索未完整结束：' + (error?.message || error) + '；已结算的物品与价值等级保留，不重复领取。');
    } finally {
      searchBusy = false;
      await refresh();
      updateSearchButton();
    }
  }));







  const AI_TYPES = {
    猛攻哥: {
      threat: 4,
      behaviors: { 均衡: 0.4, 嘉豪: 0.15, 稳健: 0.15, 霸道: 0.15, 菜鸡: 0.15 },
      judge: {
        均衡: { holdTier: 3, roamTier: 2, crouch: 0.25, back: 0.75, healAt: 0.5 },
        嘉豪: { holdTier: 4, roamTier: 3, crouch: 0.0, back: 1.0, healAt: 0.3 },
        稳健: { holdTier: 3, roamTier: 2, crouch: 0.4, back: 0.6, healAt: 0.7 },
        霸道: { holdTier: 5, roamTier: 2, crouch: 0.15, back: 0.85, healAt: 0.5 },
        菜鸡: { holdTier: 2, roamTier: 1, crouch: 0.32, back: 0.75, healAt: 0.5 },
      },
      weaponRarity: [['珍稀', 0.75], ['奇异', 0.25]],
      armorRarity: '珍稀',
      fixedItems: [['COL-0007', 4]],
      extraByMap: { 魔鬼海: [['COL-0143', 3]] },
      stats: {
        谷歌大厦: { attack: [4, 8], defense: [2, 4], hp: [20, 30], speed: [8, 12], rounds: 30 },
        魔鬼海: { attack: [6, 12], defense: [3, 5], hp: [25, 40], speed: [10, 14], rounds: 35 },
      },
      heals: ['COL-0027', 'COL-0007', 'COL-0005'],
    },
  };
  AI_TYPES.鼠鼠 = {
    threat: 2,
    behaviors: { 贪吃: 0.25, 谨慎: 0.25, 跑刀: 0.25, 自保: 0.25, 摆烂: 0.25 },
    judge: Object.fromEntries(['贪吃', '谨慎', '跑刀', '自保', '摆烂'].map(sub => [sub, { holdTier: 2, roamTier: 2, crouch: 0, healAt: 0.5 }])),
    fixedItems: AI_TYPES.猛攻哥.fixedItems,
    extraByMap: AI_TYPES.猛攻哥.extraByMap,
    stats: AI_TYPES.猛攻哥.stats,
    heals: AI_TYPES.猛攻哥.heals,
  };
  AI_TYPES.萌新 = {
    threat: 1,
    behaviors: { 小白: 0.25, 胆小: 0.25, 弱气: 0.25, 鲁莽: 0.25 },
    judge: {
      小白: { holdTier: 1, roamTier: 1, crouch: 0, healAt: 0.5 },
      胆小: { holdTier: 1, roamTier: 1, crouch: 0, healAt: 0.5 },
      弱气: { holdTier: 1, roamTier: 1, crouch: 0, healAt: 0.5 },
      鲁莽: { holdTier: 1, roamTier: 1, crouch: 0, healAt: 0.5 },
    },
    fixedItems: AI_TYPES.猛攻哥.fixedItems,
    extraByMap: AI_TYPES.猛攻哥.extraByMap,
    stats: AI_TYPES.猛攻哥.stats,
    heals: AI_TYPES.猛攻哥.heals,
  };
  const AI_START_SLOTS = ['主武器', '头盔', '胸甲', '护腿', '靴子', '背包'];
  const AI_ALL_SLOTS = ['主武器', '副武器', '头盔', '面部', '胸甲', '护腿', '靴子', '背包', '内裤', '项链', '戒指', '手饰', '特殊工具'];
  const AI_WEIGHT_MAX = 40;
  const AI_ESCAPE_BASE = 0.5;
  const AI_ESCAPE_PER_SPEED = 0.05;
  const AI_MONSTER_SEA_SPAWN_AREAS = ['礁石海岸', '度假海滩', '巨蚌钓台撤离点', '海滨别墅', '诡异灵宅', '不老泉', '落星山', '回响洞窟', '废弃渔场', '浅海巨藻林', '珊瑚礁群', '锦鳞海', '神秘洞穴', '望月井'];
  const AI_MONSTER_SEA_PLAYERS = [6, 8];
  const AI_MONSTER_SEA_OXYGEN_AREAS = new Set(['礁石海岸', '度假海滩', '巨蚌钓台撤离点', '海滨别墅', '诡异灵宅', '不老泉', '落星山', '古代文明遗迹', '触手母巢', '精液繁殖场', '回响洞窟']);
  const AI_MONSTER_SEA_DEEP_AREAS = new Set(['渔人野冢', '热液喷口', '潜水艇残骸', '鲨鱼域', '深海幽境', '洞潜者埋骨地', '提丰遗骸']);
  const AI_MONSTER_SEA_ABYSS_AREAS = new Set(['无光海渊', '渊海祭坛', '安康鱼巢穴', '无底深坑']);
  const AI_OXYGEN_ITEM_IDS = ['COL-0020', 'COL-0143'];
  const AI_OXYGEN_ITEM_EFFECT = { 'COL-0020': 0.4, 'COL-0143': 1.0 };
  const AI_MONSTER_SEA_TANK_LOW = 4;
  const AI_MONSTER_SEA_EXTRACT_RATIO = 0.66;
  const AI_MONSTER_SEA_TANK_KEEP = 1;
  const AI_EXTRACT_SCAN_RATIO = 0.5;
  const AI_EQUIP_ARMOR_SLOTS = ['头盔', '胸甲', '护腿', '靴子', '背包'];
  const aiPoolCache = {};
  const aiRarityRank = rarity => {
    const index = GAME_DATA.rarityOrder.indexOf(textOf(rarity, ''));
    return index < 0 ? 0 : index;
  };
  const aiPickOne = list => (list.length ? list[Math.floor(Math.random() * list.length)] : null);
  const aiPickWeighted = pairs => {
    const rows = (Array.isArray(pairs) ? pairs : []).map(([value, weight]) => [value, Math.max(0, Number(weight) || 0)]).filter(([, weight]) => weight > 0);
    const total = rows.reduce((sum, [, weight]) => sum + weight, 0);
    if (!total) return rows.length ? rows[rows.length - 1][0] : '';
    const roll = Math.random() * total;
    let cursor = 0;
    for (const [value, weight] of rows) {
      cursor += weight;
      if (roll < cursor) return value;
    }
    return rows.at(-1)?.[0] || '';
  };
  const aiPickUnique = (pool, count) => {
    const rest = pool.slice();
    const drawn = [];
    while (drawn.length < count && rest.length) {
      drawn.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);
    }
    return drawn;
  };
  const aiSlotOf = item => {
    if (GAME_DATA.fishing.allowedRodIds.includes(item?.id) || item?.id==='COL-0245') return '特殊工具';
    const category = textOf(item?.category, '');
    if (!category.startsWith('武器装备-')) return '';
    for (const part of category.slice('武器装备-'.length).split('/')) {
      if (AI_ALL_SLOTS.includes(part)) return part;
    }
    return '';
  };
  const aiPoolFor = mapName => {
    if (aiPoolCache[mapName]) return aiPoolCache[mapName];
    const ids = new Set();
    for (const source of [mapName, '哈基米系统']) {
      const lists = asObject(GAME_DATA.collectionLists?.[source]);
      for (const rarity of GAME_DATA.rarityOrder) {
        for (const id of Array.isArray(lists[rarity]) ? lists[rarity] : []) ids.add(id);
      }
    }
    for (const shop of Object.values(asObject(GAME_DATA.shops))) {
      for (const key of ['stockIds', 'poolIds']) {
        for (const id of Array.isArray(shop?.[key]) ? shop[key] : []) ids.add(id);
      }
    }
    aiPoolCache[mapName] = [...ids].map(itemById).filter(item=>item && !item.acquisition?.militaryShopOnly && !item.acquisition?.googleSearchOnly);
    return aiPoolCache[mapName];
  };
  const aiPickSlotItem = (mapName, slot, rarity) => {
    const ladder = ['寻常', '少见', '珍稀', '奇异', '至宝'];
    const rolled = ladder.indexOf(textOf(rarity, ''));

    for (let index = rolled < 0 ? 2 : rolled; index >= 0; index -= 1) {
      const pool = aiPoolFor(mapName).filter(item => aiSlotOf(item) === slot && item.rarity === ladder[index]);
      if (pool.length) return aiPickOne(pool);
    }
    return null;
  };




  const HKM_ATTR_STAT_KEYS = { attack: '攻击力', defense: '防御力', maxHp: '血量上限', speed: '速度', weightCap: '负重上限' };

  const hkmUnderwaterArea = area => {
    const groups = asObject(GAME_DATA.maps?.['魔鬼海']?.areaGroups);
    const oxygen = Array.isArray(groups['有氧气的区域']) ? groups['有氧气的区域'] : [];
    return Object.keys(groups).length > 0 && !oxygen.includes(textOf(area, ''));
  };
  const hkmAttrApplies = (entry, context) => {
    if (!entry) return false;
    if (entry.map && textOf(entry.map, '') !== textOf(context?.map, '')) return false;
    if (entry.when === 'underwater' && !(textOf(context?.map, '') === '魔鬼海' && hkmUnderwaterArea(context?.area))) return false;
    return true;
  };

  const hkmStructuredBonuses = (item, context) => {
    if (!Array.isArray(item?.attribs)) return null;
    const flat = { 攻击力: 0, 防御力: 0, 血量上限: 0, 速度: 0, 负重上限: 0 };
    const percent = { 攻击力: 0, 防御力: 0, 血量上限: 0, 速度: 0 };
    for (const entry of item.attribs) {
      const key = HKM_ATTR_STAT_KEYS[textOf(entry?.attr, '')];
      if (!key || !hkmAttrApplies(entry, context)) continue;
      const value = aiNum(entry.value, 0);
      if (entry.mode === 'pct') { if (key in percent) percent[key] += value / 100; continue; }
      flat[key] += value;
    }
    return { flat, percent };
  };

  const hkmStructuredRoundCap = (item, mapName) => {
    if (!Array.isArray(item?.attribs)) return null;
    let total = 0;
    for (const entry of item.attribs) {
      if (textOf(entry?.attr, '') !== 'waterCap') continue;
      if (entry.map && textOf(entry.map, '') !== textOf(mapName, '')) continue;
      total += aiNum(entry.value, 0);
    }
    return total;
  };
  const hkmItemTraits = item => (Array.isArray(item?.traits) ? item.traits : []);
  const hkmItemHasTrait = (item, id) => hkmItemTraits(item).some(entry => textOf(entry?.id, '') === id);

  const hkmSoulbound = item => (Array.isArray(item?.traits) ? hkmItemHasTrait(item, 'soulbound') : /灵魂绑定/.test(textOf(item?.details, '')));

  const hkmAttrsText = item => (Array.isArray(item?.attribs) ? item.attribs : []).map(entry => {
    const registry = (typeof HKM_ATTR_REGISTRY !== 'undefined' && HKM_ATTR_REGISTRY) ? HKM_ATTR_REGISTRY : null;
    const label = textOf(asObject(asObject(registry).attrs)[entry.attr]?.name, textOf(entry.attr, ''));
    const value = aiNum(entry.value, 0);
    const suffix = entry.map ? '（' + textOf(entry.map, '') + '地图限定）' : (entry.when === 'underwater' ? '（水下）' : '');
    return (value >= 0 ? '+' : '') + value + (entry.mode === 'pct' ? '%' : '') + label + suffix;
  }).filter(Boolean).join('、');

  const hudGearContext = (stat = currentStatSnapshot) => ({
    map: textOf(asObject(stat?.场景).地图, '') || textOf(state.run?.map, ''),
    area: textOf(asObject(stat?.场景).区域, ''),
  });

  const aiItemEffectText = item => {

    const rendered = hkmAttrsText(item);
    if (rendered) return rendered;
    const match = textOf(item?.details, '').match(/装备后效果[^:：\n]*[:：]([^\n]*)/);
    return match ? match[1].replace(/[。\s]+$/, '').trim() : '';
  };




  const aiItemBonuses = (item, context) => {
    const viaTable = hkmStructuredBonuses(item, context);
    if (viaTable) return viaTable;
    const flat = { 攻击力: 0, 防御力: 0, 血量上限: 0, 速度: 0, 负重上限: 0 };
    const percent = { 攻击力: 0, 防御力: 0, 血量上限: 0, 速度: 0 };


    const signed = part => {
      const hit = part.match(/^([+＋\-－])\s*(\d+(?:\.\d+)?)\s*%?\s*(攻击力|防御力|血量上限|速度|负重上限|负重)(?![0-9])/);
      if (!hit) return null;
      const sign = hit[1] === '+' || hit[1] === '＋' ? 1 : -1;
      const value = aiNum(hit[2], 0) * sign;
      const isPercent = part.slice(0, hit[0].indexOf(hit[3])).includes('%');
      return { value, key: hit[3] === '负重' ? '负重上限' : hit[3], isPercent };
    };
    for (const raw of aiItemEffectText(item).split(/[，,、；;]/)) {
      const parsed = signed(raw.trim());
      if (!parsed) continue;
      if (parsed.isPercent) {
        if (parsed.key in percent) percent[parsed.key] += parsed.value / 100;
        continue;
      }
      flat[parsed.key] += parsed.value;
    }
    return { flat, percent };
  };


  const aiRoundCapBonusOf = (item, mapName) => {
    const viaTable = hkmStructuredRoundCap(item, mapName);
    if (viaTable !== null) return viaTable;
    const text = aiItemEffectText(item);
    if (!text || mapName !== '魔鬼海') return 0;
    let total = 0;
    const pattern = /(?:水下行动值上限\s*[+＋]\s*(\d+(?:\.\d+)?)|[+＋]\s*(\d+(?:\.\d+)?)\s*水下行动值上限)/g;
    let hit = pattern.exec(text);
    while (hit) {
      total += aiNum(hit[1] ?? hit[2], 0);
      hit = pattern.exec(text);
    }
    return total;
  };

  const aiRecalcStats = player => {
    if (!player) return player;
    if (player.meta === '鼠鼠' || player.meta === '萌新') player.threat = hkm139PlayerThreat(player);
    if (!player.base) player.base = { attack: player.attack, defense: player.defense, maxHp: player.maxHp, speed: player.speed };
    const flat = { 攻击力: 0, 防御力: 0, 血量上限: 0, 速度: 0, 负重上限: 0 };
    const percent = { 攻击力: 0, 防御力: 0, 血量上限: 0, 速度: 0 };
    for (const slot of AI_ALL_SLOTS) {
      const item = itemById(player.equip?.[slot]);
      if (!item) continue;
      const bonus = aiItemBonuses(item, { map: textOf(player.map || state.run?.map, ''), area: player.region });
      for (const key of Object.keys(flat)) flat[key] += bonus.flat[key];
      for (const key of Object.keys(percent)) percent[key] += bonus.percent[key];
    }
    const apply = (base, key, minimum) => Math.max(minimum, Math.round((aiNum(base, 0) + aiNum(flat[key], 0)) * (1 + aiNum(percent[key], 0))));
    player.attack = apply(player.base.attack, '攻击力', 0);
    player.defense = apply(player.base.defense, '防御力', 0);
    player.maxHp = apply(player.base.maxHp, '血量上限', 1);
    player.speed = apply(player.base.speed, '速度', 0);
    player.hp = Math.min(Math.max(0, aiNum(player.hp, player.maxHp)), player.maxHp);

    let extraCap = 0;
    for (const slot of AI_ALL_SLOTS) {
      const item = itemById(player.equip?.[slot]);
      if (item) extraCap += aiRoundCapBonusOf(item, textOf(player.map || state.run?.map, ''));
    }
    player.extraCap = extraCap;
    player.roundCap = Math.max(1, aiNum(player.baseRounds, aiNum(player.roundCap, 30)));
    if (textOf(player.map || state.run?.map, '') === '魔鬼海' || player.waterCap !== undefined) {
      player.roundCap=35;player.baseRounds=35;
      player.waterCap=Math.max(8,8+extraCap);
      player.water=Math.max(0,Math.min(aiNum(player.water,player.waterCap),player.waterCap));
    }
    player.rounds = Math.min(aiNum(player.rounds, player.roundCap), player.roundCap);
    player.bonus = { flat, percent, extraCap };
    return player;
  };


  const hudGearBonus = (equipment, context) => {
    const arena = context || hudGearContext();
    const flat = { 攻击力: 0, 防御力: 0, 血量上限: 0, 速度: 0, 负重上限: 0 };
    const percent = { 攻击力: 0, 防御力: 0, 血量上限: 0, 速度: 0 };
    let extraCap = 0;
    for (const slot of AI_ALL_SLOTS) {
      const item = itemByName(textOf(asObject(equipment)[slot], '无'));
      if (!item) continue;
      const bonus = aiItemBonuses(item, arena);
      for (const key of Object.keys(flat)) flat[key] += bonus.flat[key];
      for (const key of Object.keys(percent)) percent[key] += bonus.percent[key];
      extraCap += aiRoundCapBonusOf(item, arena.map);
    }
    return { flat, percent, extraCap };
  };
  const aiBagEntry = (item, quantity = 1, keep = false) => {
    const entry = { id: item.id, quantity: Math.max(1, aiNum(quantity, 1)) };
    if (keep) entry.keep = true;
    return entry;
  };
  const aiItemWeightOf = entry => {
    const item = itemById(entry?.id);
    return item ? Math.max(0, aiNum(item.weight, 0)) * Math.max(1, aiNum(entry.quantity, 1)) : 0;
  };
  const aiPlayerWeight = player => {
    let total = player.bag.reduce((sum, entry) => sum + aiItemWeightOf(entry), 0);
    for (const slot of AI_ALL_SLOTS) {
      const id = player.equip?.[slot];
      if (!id) continue;
      const item = itemById(id);
      if (item) total += Math.max(0, aiNum(item.weight, 0));
    }
    return Math.round(total * 100) / 100;
  };
  const aiBagCount = (player, ids) => player.bag
    .filter(entry => ids.includes(entry.id))
    .reduce((sum, entry) => sum + Math.max(0, aiNum(entry.quantity, 1)), 0);
  const aiConsume = (player, ids, quantity = 1) => {
    let left = quantity;
    for (const entry of player.bag) {
      if (left < 1) break;
      if (!ids.includes(entry.id)) continue;
      const take = Math.min(left, Math.max(0, aiNum(entry.quantity, 1)));
      entry.quantity -= take;
      left -= take;
    }
    player.bag = player.bag.filter(entry => aiNum(entry.quantity, 0) > 0);
    return quantity - left;
  };
  const aiAddItem = (player, mapName, item, quantity = 1, keep = false) => {
    if (!item) return;
    let remaining = Math.max(1, aiNum(quantity, 1));
    const slot = aiSlotOf(item);
    if (slot) {
      const current = player.equip?.[slot] || '';
      const currentItem = itemById(current);
      if (!current || aiRarityRank(item.rarity) > aiRarityRank(currentItem?.rarity)) {
        player.equip[slot] = item.id;
        remaining -= 1;
        if (current) player.bag.push(aiBagEntry(currentItem || { id: current }, 1));
        aiRecalcStats(player);
      }
    }
    if (remaining <= 0) return;
    const existing = player.bag.find(entry => entry.id === item.id);
    if (existing) {
      existing.quantity += remaining;
      if (keep) existing.keep = true;
    } else player.bag.push(aiBagEntry(item, remaining, keep));
  };

  const aiWeightCap = player => Math.max(0, aiNum(player?.weightMax, AI_WEIGHT_MAX + Math.max(0, aiNum(player?.kitWeight, 0))));
  const aiDropToFit = player => {
    player.weight = aiPlayerWeight(player);
    const cap = aiWeightCap(player) * ((player.meta === '鼠鼠' || player.meta === '萌新') ? (AI_MOUSE_RULES[player.sub]?.burden || 1) : 1);
    if (player.weight <= cap) return [];
    const dropped = [];
    const candidates = player.bag
      .map(entry => {
        const item = itemById(entry.id);
        return { entry, item };
      })
      .filter(entry => entry.item && !entry.entry.keep && aiRarityRank(entry.item.rarity) < aiRarityRank('珍稀'))
      .map(entry => {
        const weight = Math.max(0, aiNum(entry.item.weight, 0)) * Math.max(1, aiNum(entry.entry.quantity, 1));
        const value = aiNum(entry.item.value, 0) * Math.max(1, aiNum(entry.entry.quantity, 1));
        return { ...entry, weight, ratio: weight > 0 ? value / weight : Number.POSITIVE_INFINITY };
      })
      .sort((left, right) => left.ratio - right.ratio);
    for (const candidate of candidates) {
      if (player.weight <= cap) break;
      player.bag = player.bag.filter(entry => entry !== candidate.entry);
      dropped.push({ id: candidate.item.id, name: candidate.item.name, quantity: candidate.entry.quantity });
      player.weight = aiPlayerWeight(player);
    }
    return dropped;
  };
  const aiMapAreas = mapName => {
    const grid = Array.isArray(GAME_DATA.maps?.[mapName]?.grid) ? GAME_DATA.maps[mapName].grid : [];
    const names = [];
    for (const row of grid) {
      for (const cell of Array.isArray(row) ? row : []) {
        const name = textOf(cell?.name, '');
        if (name && !names.includes(name)) names.push(name);
      }
    }
    return names;
  };
  const aiBaseTier = (mapName, area) => Math.max(0, aiNum(GAME_DATA.maps?.[mapName]?.tiers?.[area], 0));
  const aiRoundCap = mapName => Math.max(0, aiNum(GAME_DATA.maps?.[mapName]?.baseRounds, 0));
  const aiIsOxygenArea = (mapName, area) => mapName === '魔鬼海' && AI_MONSTER_SEA_OXYGEN_AREAS.has(area);
  const aiRoundMultiplier = () => 1;
  const aiWaterCost = (mapName,area) => HkmSea.cost(mapName,area,GAME_DATA.maps);
  const aiSpawnPlan = mapName => {
    if (mapName === '魔鬼海') return { total: randomInt(AI_MONSTER_SEA_PLAYERS), areas: AI_MONSTER_SEA_SPAWN_AREAS.slice() };
    const configured = Array.isArray(GAME_DATA.maps?.[mapName]?.spawnAreas) ? GAME_DATA.maps[mapName].spawnAreas : [];
    return { total: 5, areas: configured.length ? configured.slice() : aiMapAreas(mapName) };
  };
  const aiConsumableScale = (meta, sub, stat) => {
    if (meta === '鼠鼠') return 0.4;
    if (meta === '萌新') {
      const games = Math.max(0, Math.floor(aiNum(stat?.统计信息?.历史对局总数, 0)));
      return games === 0 ? 0.2 : 0.2 + Math.random() * 1.2;
    }
    return { 均衡: 1, 嘉豪: 1.35, 稳健: 1.15, 霸道: 1.4, 菜鸡: 0.7 }[sub] || 1;
  };
  const aiSpawnWeights = (stat, mapName) => {
    const games = Math.max(0, Math.floor(aiNum(stat?.统计信息?.历史对局总数, 0)));
    const successes = Math.max(0, Math.floor(aiNum(stat?.统计信息?.历史成功撤离总数, 0)));
    let history = state.aiSpawnHistory;
    if (!history || games < history.games || successes < history.successes) history = { games, successes, streak: 0 };
    const completed = games - history.games, wins = successes - history.successes;
    if (completed > 0) history.streak = wins === completed ? history.streak + wins : 0;
    history.games = games;
    history.successes = successes;
    state.aiSpawnHistory = history;
    const cappedGames = Math.min(10, games);
    const novice = Math.max(0, 40 - 2 * cappedGames) - (mapName === '魔鬼海' ? 20 : 0);
    const aggressor = 10 + 2 * cappedGames + history.streak * 15;
    const mouse = Math.max(0, 40 + cappedGames - (mapName === '魔鬼海' ? 20 : 0));
    return { 萌新: Math.max(0, novice), 猛攻哥: Math.max(0, aggressor), 鼠鼠: Math.max(0, mouse) };
  };
  const aiBirthItem = (mapName, meta, sub, slot) => {
    let choice;
    if (meta === '猛攻哥') {
      choice = sub === '菜鸡'
        ? aiPickWeighted(slot === '主武器' ? [['珍稀', 0.6], ['少见', 0.4]] : [['珍稀', 0.5], ['少见', 0.5]])
        : slot === '主武器' ? aiPickWeighted(AI_TYPES.猛攻哥.weaponRarity) : AI_TYPES.猛攻哥.armorRarity;
    } else if (sub === '跑刀' || sub === '贪吃' || sub === '摆烂' || sub === '弱气') {
      choice = slot === '主武器' ? aiPickWeighted([['', 0.5], ['COL-0001', 0.5]])
        : slot === '背包' ? sub === '贪吃' ? '珍稀' : aiPickWeighted([['少见', 0.6], ['珍稀', 0.4]]) : '';
    } else if (sub === '谨慎' || sub === '胆小') {
      choice = slot === '主武器' ? aiPickWeighted([['COL-0001', 0.5], ['少见', 0.5]]) : aiPickWeighted([['寻常', 0.4], ['', 0.6]]);
    } else if (sub === '小白') {
      choice = '';
    } else {
      choice = aiPickWeighted(slot === '主武器' ? [['少见', 0.7], ['珍稀', 0.3]] : [['少见', 0.25], ['寻常', 0.75]]);
    }
    return !choice ? null : choice === 'COL-0001' ? itemById(choice) : aiPickSlotItem(mapName, slot, choice);
  };
  const AI_PLAYER_SURNAMES = [...'赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹苏潘葛范彭鲁韦马任袁柳唐罗薛雷贺倪顾孟黄萧尹宋杜林陆叶程徐胡高郭邵白莫季乔江夏温方余钟梁'];
  const AI_PLAYER_GIVEN_NAMES = ['宁','安','远','晨','川','泽','澄','晴','悦','言','岚','舟','青','云','羽','秋','星','月','舒','予','南','北','夏','冬','乔','昕','墨','景','晗','微','然','清','瑶','琳','轩','涵','霖','桐','航','嘉','子安','云舒','知远','雨桐','景行','思宁','星河','若溪','清禾','书言','明川','予安','亦舟','嘉宁','晨曦','沐阳','南星','可心','语岚','文轩','安然','清越','云帆','映雪','之恒','念初','子墨','思源','嘉禾','若宁','一诺','晚晴','知夏','雨辰','星澜','明月','海棠','亦辰','书瑶','锦年'];
  const aiPlayerName = (stat, usedNames = new Set(aiPlayers().map(player => player.name))) => {
    usedNames.add(textOf(stat?.主角?.姓名,''));
    for (const [key, enemy] of entriesOf(stat?.敌人)) usedNames.add(textOf(enemy?.名称 ?? enemy?.姓名,key));
    const total = AI_PLAYER_SURNAMES.length * AI_PLAYER_GIVEN_NAMES.length;
    const start = Math.floor(Math.random() * total);
    for (let offset = 0; offset < total; offset++) {
      const index = (start + offset) % total;
      const name = AI_PLAYER_SURNAMES[Math.floor(index / AI_PLAYER_GIVEN_NAMES.length)] + AI_PLAYER_GIVEN_NAMES[index % AI_PLAYER_GIVEN_NAMES.length];
      if (!usedNames.has(name)) { usedNames.add(name); return name; }
    }
    throw Error('无法生成新的玩家姓名。');
  };
  const aiMakePlayer = (mapName, area, serial, stat, usedNames, forcedMeta = null, spawnWeights = null) => {
    const weights = spawnWeights || aiSpawnWeights(stat, mapName);
    const weighted = Object.entries(weights);
    const totalWeight = weighted.reduce((sum, [, weight]) => sum + Math.max(0, aiNum(weight, 0)), 0);
    const meta = forcedMeta || (totalWeight > 0 ? aiPickWeighted(weighted.map(([name, weight]) => [name, Math.max(0, aiNum(weight, 0)) / totalWeight])) : '鼠鼠');
    const type = AI_TYPES[meta], sub = aiPickWeighted(Object.entries(type.behaviors));
    const stats = type.stats[mapName] || type.stats['谷歌大厦'];
    const scale = meta === '鼠鼠' ? 0.7 : meta === '萌新' ? 0.6 : sub === '菜鸡' ? 0.85 : 1;
    const maxHp = aiRoll(stats.hp) * scale;
    const equip = Object.fromEntries(AI_ALL_SLOTS.map(slot => [slot, '']));
    for (const slot of AI_START_SLOTS) {
      const item = aiBirthItem(mapName, meta, sub, slot);
      if (item) equip[slot] = item.id;
    }
    const player = {
      id: 'AIP-' + serial, map: mapName, name: aiPlayerName(stat,usedNames), meta, sub, threat: type.threat,
      region: area, spawn: area, prev: '', visited: [area], hp: maxHp, maxHp,
      base: { attack: aiRoll(stats.attack) * scale, defense: aiRoll(stats.defense) * scale, maxHp, speed: aiRoll(stats.speed) * scale },
      attack: 0, defense: 0, speed: 0, rounds: aiRoundCap(mapName),
      ...(mapName === '魔鬼海' ? { water: 8, waterCap: 8, seaClockVersion: 1 } : {}),
      roundCap: aiRoundCap(mapName), baseRounds: aiRoundCap(mapName), equip, bag: [], weight: 0,
      alive: true, extracted: false, llm: false, mode: 'roam', lastAction: '待命',
      gender: Math.random() < Math.max(0, Math.min(100, aiNum(state.rules?.aiMaleProbability, 50))) / 100 ? '男性' : '女性',
      futanari: false,
      spawnTurn: aiNum(state.run?.soundTurn, 0),
      consumableScale: aiConsumableScale(meta, sub, stat),
    };
    if (player.gender === '女性') player.futanari = state.rules?.femaleFutanari === true;
    for (const [id, quantity] of type.fixedItems) {
      const amount = Math.max(1, Math.round(quantity * player.consumableScale));
      aiAddItem(player, mapName, itemById(id), amount, true);
    }
    for (const [id, quantity] of (type.extraByMap[mapName] || [])) {
      const minimum = mapName === '魔鬼海' && AI_OXYGEN_ITEM_IDS.includes(id) ? 2 : 1;
      const amount = Math.max(minimum, Math.round(quantity * player.consumableScale));
      aiAddItem(player, mapName, itemById(id), amount, true);
    }
    aiRecalcStats(player);
    player.hp = player.maxHp;
    if (mapName === '魔鬼海') player.water = player.waterCap;
    player.weight = aiPlayerWeight(player);
    player.kitWeight = player.weight;
    player.weightMax = AI_WEIGHT_MAX + Math.max(0, aiNum(player.kitWeight, 0));
    return player;
  };











  const HUD_NPC_FACTION = (mapName, npc) => {

    const map = textOf(mapName, '');
    if (map === '谷歌大厦') return '大厦';
    const name = textOf(npc?.name ?? npc?.名称, '');
    if (/鲨鱼|电鳗|海豚|金枪鱼|河豚|鮟鱇|鲑鱼|鲟鱼|鳕鱼|鲷|螃蟹|水母|鳐/.test(name)) return '海兽-' + name.replace(/[0-9]+/g, '');
    if (/触手/.test(name)) return '触手';
    return '魔鬼海-' + name.replace(/[0-9]+/g, '');
  };




  const HUD_NPC_NEUTRAL = ['海豚'];
  const hudNpcAttitude = npc => {
    if (hkm139Friendly(npc)) return '友善';
    const explicit = textOf(npc?.态度, '') || (textOf(npc?.状态, '').match(/(?:^|[；;,，\s])(中立-敌对|敌对|中立|友善|友好)(?:$|[；;,，\s])/) || [])[1] || textOf(npc?.attitude, '')
      || (textOf(npc?.描述 ?? npc?.desc, '').match(/(?:态度[：:]\s*|（)(中立-敌对|敌对|中立|友善|友好)/) || [])[1] || '';
    if (explicit) return explicit === '友好' ? '友善' : explicit;
    const name = textOf(npc?.name ?? npc?.名称, '').replace(/[0-9]+/g, '');
    if (HUD_NPC_NEUTRAL.includes(name)) return '中立';
    return aiNum(npc?.attack ?? npc?.攻击力, 0) <= 0 ? '中立' : '敌对';
  };
  const aiNpcsAlive = () => (Array.isArray(state.run?.npcs) ? state.run.npcs : []).filter(npc => npc && npc.hp > 0);

  const aiNpcHealth = (row, fallback = null) => {
    const parts = String(row?.血量 ?? row?.hp ?? '').split('/');
    const number = (value, otherwise) => value == null || String(value).trim() === '' ? otherwise : aiNum(value, otherwise);
    const maxHp = Math.max(1, number(row?.血量上限 ?? row?.maxHp ?? parts[1], fallback ? aiNum(fallback.maxHp, 20) : number(parts[0], 20)));
    const hp = Math.max(0, Math.min(maxHp, number(row?.当前血量 ?? parts[0], aiNum(fallback?.hp, maxHp))));
    return { hp, maxHp };
  };
  const aiNpcSpawnAll = (mapName, stat, persist = true) => {
    const run = state.run;
    if (!run || run.map !== mapName) return 0;
    if (run.noNpcs === true) return 0;
    run.npcSpawned = asObject(run.npcSpawned);


    if (run.npcSpawned['*all*'] && Array.isArray(run.npcs)) return 0;
    run.npcSpawned['*all*'] = true;
    if (!Array.isArray(run.npcs)) run.npcs = [];
    let count = 0;
    for (const area of aiMapAreas(mapName)) {
      let rows = [];
      if (textOf(mapName, '') === '魔鬼海' && typeof rollMonsterSeaNpc === 'function') rows = rollMonsterSeaNpc(area) || [];
      else {
        const rules = Array.isArray(GAME_DATA.encounters?.npc?.[mapName]) ? GAME_DATA.encounters.npc[mapName] : [];
        const tier = aiBaseTier(mapName, area);
        for (const rule of rules) {
          if (rule.area && rule.area !== area) continue;
          if (rule.tier && Number(rule.tier) !== tier) continue;
          let number = 0;
          if (Array.isArray(rule.countRolls)) {
            const roll = Math.random();
            if (roll < Number(rule.countRolls[0])) number = 1;
            else if (roll < Number(rule.countRolls[1])) number = 2;
          } else if (Math.random() < Number(rule.chance || 0)) number = Number(rule.count || 1);
          if (number > 0 && typeof buildNpcEncounter === 'function') rows = rows.concat(buildNpcEncounter(rule, number) || []);
        }
      }
      for (const row of rows) {
        const name = textOf(row?.名称 ?? row?.name, '');
        if (!name) continue;
        count += 1;
        run.npcs.push({
          id: 'NPC-' + count,
          name,
          region: area,
          faction: HUD_NPC_FACTION(mapName, row),
          attitude: hudNpcAttitude(row),
          kind: hudNpcThreat(name) >= 5 ? '首领' : (hudNpcThreat(name) === 3 ? '精英' : '普通'),
          threat: hudNpcThreat(name),
          ...aiNpcHealth(row),
          attack: aiNum(row?.攻击力 ?? row?.attack, 3),
          defense: aiNum(row?.防御力 ?? row?.defense, 0),
          speed: aiNum(row?.速度 ?? row?.speed, 8),
          desc: textOf(row?.描述 ?? row?.desc, ''),
        });
      }
    }
    HkmBattle.register(run);
    if (persist) saveFrontendState(state);
    return count;
  };
  const aiNpcRecord = npc => ({
    ID: npc.id,
    地图: state.run?.map,
    区域: npc.region,
    名称: npc.name,
    血量: String(Math.max(0, aiNum(npc.hp, 0))) + '/' + String(Math.max(0, aiNum(npc.maxHp, 0))),
    攻击力: aiNum(npc.attack, 0),
    防御力: aiNum(npc.defense, 0),
    速度: aiNum(npc.speed, 0),
    状态: hkm139NpcFriendly(npc) ? '友善' : npc.attitude,
    标签: hkm139NpcFriendly(npc) ? ['友善'] : [],
    威胁等级: aiNum(npc.threat, hudNpcThreat(npc.name)),
    描述: npc.kind + '·' + npc.faction + '（' + (hkm139NpcFriendly(npc) ? '友善' : npc.attitude) + '）。' + (npc.desc ? ' ' + npc.desc : ''),
    来源: 'NPC',
    离开区域: '否',
  });

  const aiNpcEnemyRecords = (mapName, area) => {
    const out = {};
    for (const npc of aiNpcsAlive()) {
      if (npc.region !== area) continue;
      out[npc.name] = aiNpcRecord(npc);
    }
    return out;
  };

  const aiNpcSyncHp = stat => {
    const mapName = textOf(stat?.场景?.地图, ''), area = textOf(stat?.场景?.区域, '');
    if (!area || state.run?.map !== mapName) return;
    let changed = false;
    for (const [key, record] of entriesOf(asObject(stat?.敌人))) {
      if ((record?.地图 && record.地图 !== mapName) || (record?.区域 && record.区域 !== area)) continue;
      const id = textOf(record?.ID ?? record?.id, '') || (/^NPC-/.test(key) ? key : '');
      const name = textOf(record?.名称 ?? record?.姓名, key);
      const npc = aiNpcsAlive().find(row => row.region === area && (id ? row.id === id : row.name === name));
      if (!npc) continue;
      if (hkm139Friendly(record) && !hkm139NpcFriendly(npc)) { npc.friendly = true; changed = true; }
      const { hp, maxHp } = aiNpcHealth(record, npc);
      if (hp !== npc.hp || maxHp !== npc.maxHp) { npc.hp = hp; npc.maxHp = maxHp; changed = true; }
      if (hp <= 0) { aiNpcKill(npc, true); changed = true; }
    }
    if (changed) saveFrontendState(state);
  };

  const aiNpcKill = (npc, quiet, killer) => {
    const run = state.run;
    if (!run || !Array.isArray(run.npcs)) return;
    HkmBattle.register(run);
    npc.hp = 0;
    run.npcs = run.npcs.filter(row => row !== npc);
    hkmFishingDeath(npc, killer);
    if (!quiet && !npc.fishingMonster) {
      const tier = aiBaseTier(textOf(run.map, ''), npc.region);
      const entries = drawSearch(textOf(run.map, ''), npc.region, tier, false).map(row => ({ id: row.item?.id, quantity: row.quantity })).filter(row => row.id);
      if (entries.length) aiDropLootBox(textOf(run.map, ''), npc.region, npc.name, entries);
    }
    saveFrontendState(state);
  };

  const aiNpcHit = (target, npc) => Math.max(1, aiNum(npc.attack, 0) - Math.floor(aiNum(target.defense, 0) / 2));

  const aiNpcTurn = (mapName, heroArea, stat) => {
    const rows = [];
    if (!Array.isArray(state.aiLog)) state.aiLog = [];
    const hero = textOf(heroArea, '');

    const actors = aiNpcsAlive().slice().sort((left, right) => aiNum(right.speed, 0) - aiNum(left.speed, 0));
    for (const npc of actors) {
      if (!npc || npc.hp <= 0 || !['敌对','中立-敌对'].includes(npc.attitude)) continue;
      const here = textOf(npc.region, '');
      if (!here) continue;
      const inHeroArea = here === hero;


      const pool = [];
      if (!inHeroArea) for (const player of aiAlive()) {
        if (textOf(player.region, '') !== here || hkm139Friendly(player)) continue;
        pool.push({ kind: '其他玩家', threat: aiNum(player.threat, 0), target: player });
      }
      for (const peer of aiNpcsAlive()) {
        if (peer === npc || peer.hp <= 0 || peer.region !== here || peer.faction === npc.faction) continue;
        pool.push({ kind: 'NPC', threat: aiNum(peer.threat, 0), target: peer });
      }
      if (!pool.length) continue;

      pool.sort((left, right) => ((left.kind === '其他玩家' ? 0 : 1) - (right.kind === '其他玩家' ? 0 : 1)) || (right.threat - left.threat));
      const pick = pool[0];
      const damage = hkm163AiHit(npc,pick.target);
      const downed = pick.target.hp <= 0;
      const line = npc.name + '（' + npc.kind + '·敌对）主动攻击了' + pick.target.name + '，造成 ' + damage + ' 点伤害' + (downed ? '（击倒）' : '');
      if (downed) {
        if (pick.kind === '其他玩家') aiKillPlayer(mapName, pick.target, '被' + npc.name + '击杀');
        else aiNpcKill(pick.target, false);
      }

      if (inHeroArea) rows.push({ name: npc.name, line, entered: false, loot: [] });
      else state.aiLog.push(line);
    }
    if (Array.isArray(state.aiLog) && state.aiLog.length > 40) state.aiLog = state.aiLog.slice(-40);
    saveFrontendState(state);
    return rows;
  };

  const aiNpcRetaliate = (attacker, npc) => {
    if (!npc || npc.hp <= 0) return '';
    const damage = hkm163AiHit(npc,attacker);
    const line = npc.name + '（' + npc.attitude + '）还手打了 ' + attacker.name + '，造成 ' + damage + ' 点伤害' + (attacker.hp <= 0 ? '（击倒）' : '');
    if (attacker.hp <= 0) aiKillPlayer(textOf(state.run?.map, ''), attacker, '被' + npc.name + '还手击杀');
    saveFrontendState(state);
    return line;
  };

  const aiNpcTargetsFor = (player, mapName) => {
    const rows = [];
    const aggressive = textOf(player.meta, '') === '猛攻哥';
    for (const npc of aiNpcsAlive()) {
      if (npc.region !== player.region) continue;
      if (npc.faction === player.faction) continue;
      if (hkm139Friendly(player) || hkm139NpcFriendly(npc) || player.meta === '鼠鼠' && aiNum(npc.threat, 0) >= 5) continue;
      if (!aggressive && !player.npcGrudge) continue;
      rows.push({ npc, record: aiNpcRecord(npc) });
    }
    return rows;
  };
  const aiPlayers = () => (Array.isArray(state.run?.players) ? state.run.players : []);
  const aiAlive = () => aiPlayers().filter(player => player.alive && !player.extracted);
  const hudExtraRoundCap = (stat = currentStatSnapshot) => Math.max(0, aiNum(asObject(stat?.主角).额外水下行动值上限, 0));

  const aiRoundCapFor = (mapName, stat) => {
    const runCap = state.run?.map === mapName ? aiNum(state.run?.roundCap, 0) : 0;
    return mapName==='魔鬼海'?35:Math.max(aiRoundCap(mapName),runCap);
  };




  const aiStartRun = (mapName, stat) => {
    const map = GAME_DATA.maps?.[mapName];
    if (!map || map.kind !== 'mission') { state.run = null; return null; }
    const plan = aiSpawnPlan(mapName);
    const games = Math.max(0, Math.floor(aiNum(stat?.统计信息?.历史对局总数, 0)));
    const spawnWeights = aiSpawnWeights(stat, mapName);
    const drawn = aiPickUnique(plan.areas, Math.min(plan.total, plan.areas.length));
    const players = [], usedNames = new Set();
    for (let index = 1; index < drawn.length; index += 1) {
      players.push(aiMakePlayer(mapName, drawn[index], index, stat, usedNames, games < 2 ? '萌新' : null, spawnWeights));
    }
    state.run = {
      map: mapName,
      spawn: drawn[0] || '',
      roundCap: aiRoundCap(mapName),
      rounds: aiRoundCap(mapName),
      ...(mapName==='魔鬼海'?{water:8,seaClockVersion:1}:{}),
      players,
      boxes: {},
      boxSerial: 0,
      killSeen: {},
      registered: [],
      registeredArea: '',
      killCount: 0,
      overweightNotice: '',
      gamesAtStart: games,
      spawnWeights,
      noNpcs: games === 0,
      startedAt: Date.now(),
      startMessageId: hudMessageApi()?.getLastMessageId?.() ?? -1,
      pendingEntry: stat?.场景?.地图 !== mapName,
      lifeInsuranceUsed: false,
      entryInventory: HkmLifecycle.inventory({...stat,钥匙链:hudValuedKeychain(stat)}, hkm098Resolve),
      entryKeychainKnown: true,
      upgradeUses: 0,
    };
    HkmBattle.register(state.run);
    return state.run;
  };

  const aiEndRun = () => {
    const run = state.run;
    state.run = null;
    if (!run) return null;
    return { map: run.map, removedEnemies: Array.isArray(run.registered) ? run.registered.slice() : [] };
  };
  const aiEnemiesWithMonsters = (mapName, area, stat) => {
    const rows = [];
    for (const player of aiAlive()) {
      if (player.region !== area || !aiCanSee('hero', player)) continue;
      rows.push({ player, record: aiEnemyRecord(player) });
    }
    for (const [key, value] of entriesOf(stat?.敌人)) {
      const name = textOf(value?.名称 ?? value?.姓名, '');
      if (!name || name === '无') continue;
      if (rows.some(row => row.record.名称 === name) || aiPlayers().some(player => player.name === name || player.id === key)) continue;
      rows.push({ player: null, key, record: { ...value, 名称: name } });
    }
    return rows;
  };


  const aiEnemyRecord = player => {
    return {
      ID: player.id,
      名称: player.name,
      性别: player.gender || '女性',
      女性扶她性征: player.gender === '女性' && player.futanari === true ? '是' : '否',
      血量: String(Math.max(0, aiNum(player.hp, 0))) + '/' + String(Math.max(0, aiNum(player.maxHp, 0))),
      攻击力: aiNum(player.attack, 0),
      防御力: aiNum(player.defense, 0),
      速度: aiNum(player.speed, 0) + (player.ambushTurn === state.run?.soundTurn && player.ambushTarget === 'hero' ? 5 : 0),
      标签: hkm139Friendly(player) || aiPeaceful('hero', player.id) ? ['友善'] : [],
      威胁等级: hkm139PlayerThreat(player),
      状态: hkm139Friendly(player) ? '友善' : aiPeaceful('hero', player.id) ? '求饶成功' : player.mode === 'extract' ? '撤离中' : player.crouched ? '蹲伏中' : player.mode === 'fight' ? '交战中' : '待处理',
      描述: player.meta + '·' + player.sub + (aiPeaceful('hero', player.id) ? '；本局与主角互不主动攻击' : '') + (player.mode === 'extract' ? '；' + player.lastAction : '') + (player.crouched ? '；蹲伏中' : '') + (player.ambushTurn === state.run?.soundTurn && player.ambushTarget === 'hero' ? '；从蹲伏中对主角发动偷袭' : '') + (state.run?.map==='魔鬼海'?'；交互轮数 '+player.rounds+'/35；水下行动值 '+player.water+'/'+player.waterCap:''),
      剩余交互轮数: player.rounds,
      ...(state.run?.map==='魔鬼海'?{剩余水下行动值:player.water,水下行动值上限:player.waterCap}:{}),
      来源: '其他玩家',
      离开区域: '否',
    };
  };
  const aiSortTargets = rows => rows.slice().sort((left, right) => {
    const threatOf = row => aiNum(row.player?.threat, hudNpcThreat(row.record?.名称 ?? row.record?.姓名));
    const leftThreat = threatOf(left);
    const rightThreat = threatOf(right);
    return rightThreat - leftThreat;
  });
  const aiGrantBucket = (bucket, item, quantity, origin = null) => {
    if (!item) return;
    const key = item.name;
    const current = bucket[key];
    const amount = Math.max(1, aiNum(quantity, 1));
    if (current) bucket[key] = { ...current, 数量: Math.max(0, aiNum(current.数量, 0)) + amount };
    else {
      bucket[key] = {
        名称: item.name,
        稀有度: item.rarity,
        数量: amount,
        描述: item.description,
        价值: aiNum(item.value, 0),
        重量: aiNum(item.weight, 0),
      };
    }
    if(hkmIsKeyItem(itemByName(key)))bucket[key].钥匙耐久=[...hkmKeyDurs(current,current ? aiNum(current.数量,0):0),...hkmKeyDurs(origin || item,amount)];
    Object.assign(bucket[key],HkmUpgrade.merge(current,origin,Math.max(0,aiNum(bucket[key].数量,0)),state.run));
  };
  const aiTakeBucket = (bucket, name, quantity) => {
    const key = Object.keys(asObject(bucket)).find(candidate => candidate === name) || '';
    if (!key) return 0;
    const current = bucket[key];
    const have = Math.max(0, aiNum(current.数量, 0));
    const take = Math.min(have, Math.max(1, aiNum(quantity, 1)));
    if (take >= have) delete bucket[key];
    else bucket[key] = { ...current, 数量: have - take, ...HkmUpgrade.take(current,take,state.run),...(hkmIsKeyItem(itemByName(name)) ? {钥匙耐久:hkmKeyDurs(current).slice(take)}:{}) };
    return take;
  };
  const aiDropLootBox = (mapName, area, owner, entries) => {
    if (!state.run || !entries.length) return null;
    state.run.boxes = asObject(state.run.boxes);
    if (!Array.isArray(state.run.boxes[area])) state.run.boxes[area] = [];
    state.run.boxSerial = aiNum(state.run.boxSerial, 0) + 1;
    const box = { id: 'BOX-' + state.run.boxSerial, owner, entries: entries.map(row=>({...row,摸出对局:HkmUpgrade.runId(state.run),摸出数量:owner===hudPlayerName(currentStatSnapshot)?0:Math.max(1,aiNum(row.quantity,1))})), looted: false };
    state.run.boxes[area].push(box);
    return box;
  };





  const HUD_KILL_BOX_RE = /<HkmKillBox\s+name="([^"]{1,40})"(?:\s+area="([^"]{1,40})")?(?:\s+killer="([^"]{1,80})")?\s*\/?>/gi;
  const hudMessageApi = () => {
    const hostWindow = window.parent && window.parent !== window ? window.parent : window;
    const hostTavern = hostWindow.TavernHelper || hostWindow.SillyTavern?.getContext?.() || {};
    const boxes = [globalThis, hostWindow, hostTavern];
    for (const box of boxes) {
      if (box && typeof box.getChatMessages === 'function' && typeof box.getLastMessageId === 'function') return box;
    }
    return null;
  };
  const hudLatestAssistantTexts = () => {
    const api = hudMessageApi();
    if (!api) return [];
    const texts = [];
    try {
      const last = aiNum(api.getLastMessageId(), -1);
      for (let id = Math.max(0, last - 2); id <= last; id += 1) {
        if(state.replayAfter!=null && id<=state.replayAfter)continue;
        const rows = api.getChatMessages(id);
        const row = Array.isArray(rows) ? rows[rows.length - 1] : rows;
        if (!row) continue;
        if (row.is_user === true || textOf(row.role, '') === 'user') continue;
        texts.push({ id, text: textOf(row.message ?? row.mes, '') });
      }
    } catch (_) {}
    return texts;
  };
  const hudIngestKillBoxes = async (stat, mapName) => {
    const run = state.run;
    if (!run || run.map !== mapName) return false;
    const areaNow = textOf(stat?.场景?.区域, '');
    const seen = asObject(run.killSeen);
    let created = 0, changed = false;
    for (const row of hudLatestAssistantTexts()) {
      if (run.startMessageId != null && row.id <= run.startMessageId) continue;
      HUD_KILL_BOX_RE.lastIndex = 0;
      let hit = HUD_KILL_BOX_RE.exec(row.text);
      while (hit) {
        const name = textOf(hit[1], '').trim();
        const area = textOf(hit[2], '').trim() || areaNow;
        const key = name + '@' + area;
        const player = aiPlayers().find(candidate => textOf(candidate.name, '') === name && candidate.region === area);
        const npc = run.npcs?.find(candidate => candidate.name === name && candidate.region === area);
        const dead = Object.values(asObject(run.fishingDead)).find(candidate => candidate.name === name && candidate.region === area);
        const killer = ['主角', stat.主角?.姓名].includes(hit[3]) ? 'hero' : aiPlayers().find(candidate => candidate.name === hit[3])?.id;
        if (player && player.hp !== 0) { player.hp = 0; changed = true; }
        if (npc) { aiNpcKill(npc, true, killer); changed = true; }
        if (HkmFishing.recordKill(run, (player || npc || dead)?.id, killer, Boolean(player))) changed = true;
        if (Object.values(asObject(state.run?.fishingDead)).some(npc=>npc.name===name && npc.region===area && npc.fishingMonster)) { seen[key]=true; hit=HUD_KILL_BOX_RE.exec(row.text); continue; }
        if (name && !seen[key]) {
          if (player && !player.alive) {

            seen[key] = true;
          } else {
            const entries = player ? aiPlayerEntries(player) : drawSearch(mapName, area, getTier(mapName, area, GAME_DATA.maps[mapName]), false).map(item => ({ id: item.item?.id, quantity: item.quantity }));
            if (player) {
              player.alive = false;
              player.lastAction = '在' + area + '阵亡';
            }

            aiDropLootBox(mapName, area, name, entries.filter(entry => entry.id && !hkmSoulbound(itemById(entry.id))));
            seen[key] = true;
            created += 1;
          }
        }
        hit = HUD_KILL_BOX_RE.exec(row.text);
      }
    }
    if (!created && !changed) return false;
    run.killSeen = seen;
    saveFrontendState(state);
    return true;
  };
  const aiBoxesHere = (mapName, area) => {
    const boxes = asObject(state.run?.boxes)[area];
    return Array.isArray(boxes) ? boxes.filter(box => !box.looted) : [];
  };
  const aiPlayerEntries = player => {
    if (HkmLifecycle.kept(state.run?.map, state.rules)) return [];
    const droppable = id => Boolean(id) && !hkmSoulbound(itemById(id));
    const entries = player.bag.filter(entry => droppable(entry?.id));
    for (const slot of AI_ALL_SLOTS) {
      const id = player.equip?.[slot];
      if (slot!=='特殊工具' && droppable(id)) entries.push({ id, quantity: 1 });
    }
    return entries;
  };
  const aiBegAllItems = player => {
    const entries = [];
    for (const slot of AI_ALL_SLOTS) {
      const id = player.equip?.[slot];
      if (id) entries.push({ id, quantity: 1 });
      if (id) player.equip[slot] = '';
    }
    for (const entry of Array.isArray(player.bag) ? player.bag : []) {
      if (entry?.id && aiNum(entry.quantity, 0) > 0) entries.push({ id: entry.id, quantity: Math.max(1, aiNum(entry.quantity, 1)) });
    }
    player.bag = [];
    return entries;
  };
  const aiBegChance = player => {
    const quantity = Array.isArray(player?.begOffer) ? player.begOffer.reduce((sum, row) => sum + Math.max(0, aiNum(row.quantity, 0)), 0) : 0;
    const value = Array.isArray(player?.begOffer) ? player.begOffer.reduce((sum, row) => sum + Math.max(0, aiNum(itemById(row.id)?.value, 0)) * Math.max(0, aiNum(row.quantity, 0)), 0) : 0;
    return Math.max(0, Math.min(1, 0.5 + quantity * 0.01 + Math.floor(value / 50) * 0.01));
  };
  const aiKillPlayer = (mapName, player, reason) => {
    if (!player.alive) return null;
    player.alive = false;
    player.lastAction = reason;
    return aiDropLootBox(mapName, player.region, player.name, aiPlayerEntries(player));
  };
  const aiHeal = (player, ratio) => {
    const amount = Math.max(1, Math.ceil(Math.round(aiNum(player.maxHp, 1)*ratio)*(HkmEquipment.has({equipment:player.equip},'seaBlessing')?1.25:1)));
    player.hp = Math.min(aiNum(player.maxHp, 1), aiNum(player.hp, 0) + amount);
  };
  const aiUseHeal = (player, mapName, chart) => {
    if (aiNum(player.hp, 0) >= aiNum(player.maxHp, 1) * aiNum(chart.healAt, 0.5)) return false;
    const type = AI_TYPES[player.meta];
    for (const id of type.heals) {
      if (aiConsume(player, [id], 1)) {
        const ratio = { 'COL-0027': 0.8, 'COL-0007': 0.4, 'COL-0005': 0.13 }[id] || 0.2;
        aiHeal(player, ratio);
        player.lastAction = '使用' + textOf(itemById(id)?.name, '治疗道具');
        return true;
      }
    }
    return false;
  };
  const aiUseOxygen = (player, mapName) => {
    for (const id of AI_OXYGEN_ITEM_IDS) {
      if (!aiConsume(player, [id], 1)) continue;
      const ratio = AI_OXYGEN_ITEM_EFFECT[id] || 0.4;
      player.water = HkmSea.refill(player.water,player.waterCap,ratio);
      player.lastAction = '使用' + textOf(itemById(id)?.name, '氧气罐');
      return true;
    }
    return false;
  };

  const aiWantsLoot = row => {
    const rank = aiRarityRank(textOf(row?.稀有度 ?? row?.rarity, ''));
    const value = aiNum(row?.价值 ?? row?.value, 0);
    const weight = Math.max(0, aiNum(row?.重量 ?? row?.weight, 0));
    if (rank >= 2) return true;
    if (value <= 0) return false;
    if (weight <= 0) return value >= 30;
    return value >= 30 && value / weight >= 15;
  };


  const aiLootLocked = (mapName, player) => {
    if (!player?.alive || player.extracted || aiNum(player.hp, 0) <= 0) return true;
    const area = textOf(player.region, ''), stat = asObject(aiTurnContext?.stat);
    if (!area || state.run?.map !== mapName) return true;
    if (stat.场景?.地图 === mapName && stat.场景?.区域 === area && hudCombatFlagOn(stat)) return true;
    if (aiAlive().some(other => other !== player && other.region === area && aiNum(other.hp, 0) > 0 && aiCanSee(player.id, other) && !aiPeaceful(player.id, other.id))) return true;
    if (aiNpcTargetsFor(player, mapName).length) return true;
    return aiNpcsAlive().some(npc => npc.region === area && npc.attitude === '敌对' && aiNum(npc.hp, 0) > 0);
  };
  const aiScavengeArea = (mapName, player) => {
    if (aiLootLocked(mapName, player)) return;
    const stat = aiTurnContext?.stat || {};
    const area = textOf(player.region, '');
    const record = { taken: [], placed: [], boxes: false, names: [] };
    for (const [key, row] of entriesOf(asObject(stat?.散落物品))) {
      if (textOf(row?.地图, '') !== mapName || textOf(row?.区域, '') !== area) continue;
      if (!aiWantsLoot(row)) continue;
      const quantity = Math.max(1, aiNum(row?.数量, 1));
      const item = itemByName(textOf(row?.名称, '')) || {
        name: textOf(row?.名称, ''), rarity: textOf(row?.稀有度, '寻常'),
        value: aiNum(row?.价值, 0), weight: aiNum(row?.重量, 0), description: textOf(row?.描述, ''),
      };
      if (!textOf(item.name, '')) continue;
      aiAddItem(player, mapName, item, quantity);
      record.taken.push(key);
      record.names.push(item.name + (quantity > 1 ? '×' + quantity : ''));
    }
    const boxes = asObject(state.run?.boxes)[area];
    for (const box of Array.isArray(boxes) ? boxes : []) {
      if (box.looted || !Array.isArray(box.entries)) continue;
      const keep = [];
      for (const entry of box.entries) {
        const item = itemById(entry.id);
        if (!item || !aiWantsLoot({ 稀有度: item.rarity, 价值: item.value, 重量: item.weight })) { keep.push(entry); continue; }
        aiAddItem(player, mapName, item, Math.max(1, aiNum(entry.quantity, 1)));
        record.names.push(item.name + (aiNum(entry.quantity, 1) > 1 ? '×' + aiNum(entry.quantity, 1) : ''));
      }
      if (keep.length !== box.entries.length) record.boxes = true;
      box.entries = keep;
      if (!keep.length) box.looted = true;
    }

    for (const dropped of aiDropToFit(player)) {
      const item = itemByName(dropped.name) || { name: dropped.name, rarity: '寻常', value: 0, weight: 0, description: '' };
      record.placed.push({ item, quantity: Math.max(1, aiNum(dropped.quantity, 1)) });
    }
    if (record.names.length) player.lastScavenged = record.names;
    player.scavenged = record;
  };



  const aiRouteTo = (mapName, from, targets, player = aiTurnContext?.player) => {
    const start = textOf(from, '');
    const goals = (Array.isArray(targets) ? targets : []).map(area => textOf(area, '')).filter(Boolean);
    if (!start || !goals.length || goals.includes(start)) return null;
    const queue = [start];
    const seen = {};
    seen[start] = '';
    while (queue.length) {
      const current = queue.shift();
      for (const next of aiMovableFrom(mapName, current, player)) {
        if (seen[next] !== undefined) continue;
        seen[next] = current;
        if (goals.includes(next)) {
          let hop=next,distance=1;
          while(seen[hop] && seen[hop]!==start){hop=seen[hop];distance++;}
          return {hop,target:next,distance};
        }
        queue.push(next);
      }
    }
    return null;
  };
  const aiMovableFrom = (mapName, area, player = aiTurnContext?.player) => [...getMovableAreas(mapName, area)].filter(next=>!hkm160Avoids(player,next));



  const aiAreaTier = (mapName, area) => getTier(mapName, area, GAME_DATA.maps?.[mapName]);
  const aiSpendAreaTier = (mapName, area) => {
    const map = GAME_DATA.maps?.[mapName];
    if (Array.isArray(map?.nonDepletingAreas) && map.nonDepletingAreas.includes(area)) return;
    const key = areaKey(mapName, area);
    state.tiers[key] = Math.max(0, getTier(mapName, area, map) - 1);
    saveFrontendState(state);
  };
  const aiSearchHere = (mapName, player) => {
    player.crouched = false;
    player.soundWait = null;
    const tier = aiAreaTier(mapName, player.region);
    const loot = drawSearch(mapName, player.region, tier);
    player.lastLoot = loot.map(row => textOf(row.item?.name, '') + (aiNum(row.quantity, 1) > 1 ? '×' + aiNum(row.quantity, 1) : '')).filter(Boolean);
    for (const result of loot) aiAddItem(player, mapName, result.item, result.quantity);
    const dropped = aiDropToFit(player);

    aiSpendAreaTier(mapName, player.region);
    player.lastAction = '在' + player.region + '搜索，获得' + loot.length + '项' + (dropped.length ? '，丢弃' + dropped.map(row => row.name).join('、') : '');
    return loot;
  };





  const HKM_HERO_THREAT = 4;
  const aiMovementPriority = (left, right) =>
    aiNum(right.threat, HKM_HERO_THREAT) - aiNum(left.threat, HKM_HERO_THREAT)
    || aiNum(right.speed, 10) - aiNum(left.speed, 10);
  const aiResolveHeroCrossing = (player, from, before) => {
    const context = aiTurnContext;
    if (!context?.heroMoving || context.heroMoveBlocked || from !== context.heroTarget
      || player.region !== context.heroFrom || aiPeaceful(player.id, 'hero')
      || player.heroDecisionTurn === context.turn) return;
    const hero = { threat: HKM_HERO_THREAT, speed: aiNum(context.stat?.主角?.速度, 10) };
    context.crossed.add(player.id);
    if (aiMovementPriority(player, hero) < 0) {
      context.heroTo = context.heroFrom;
      context.heroMoveBlocked = true;
      context.sounds = context.sounds.filter(sound => sound.actor !== 'hero');
      aiEmitSound(state.run.map, 'hero', context.heroTo, context.heroQuiet);
      aiEventLine('主角与' + player.name + '迎面相遇，移动未完成，仍在' + context.heroTo + '。');
    } else {
      player.region = from;
      player.prev = before.prev;
      player.visited = before.visited;
      player.soundPursuit = null;
      player.lastAction = '移动未完成，仍在' + from;
      aiEventLine(player.name + '与主角迎面相遇，移动未完成，仍在' + from + '。');
    }
  };
  const aiHeroEncounter = (mapName, player) => {
    if (!aiHeroPresent(player) || player.heroDecisionTurn === aiTurnContext.turn) return;
    if (aiMouseProfile(player) && aiMouseEncounter(mapName, player)) return;
    player.heroDecisionTurn = aiTurnContext.turn;
    if (aiExtractionLocked(player) && aiExtractStep(mapName, player)) return;
    if (player.meta === '猛攻哥') aiAttackPlayer(mapName, player, 'hero');
    else {
      player.lastAction = '遇见主角';
      aiEventLine(player.name + '与主角在' + player.region + '相遇。');
    }
  };
  const aiSoundAreas = (mapName, area) => {
    const grid = GAME_DATA.maps?.[mapName]?.grid || [];
    const result = new Set();
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < (grid[r]?.length || 0); c++) {
        if (textOf(grid[r][c]?.name, '') !== area) continue;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const name = textOf(grid[r + dr]?.[c + dc]?.name, '');
          if (name) result.add(name);
        }
      }
    }
    return result;
  };
  const aiEmitSound = (mapName, actor, area, quiet = false) => {
    if (!aiTurnContext || quiet || !area || aiTurnContext.sounds.some(sound => sound.actor === actor && sound.area === area)) return;
    const sourceOxygen = mapName === '魔鬼海' && aiIsOxygenArea(mapName, area);
    const heardIn = new Set([...aiSoundAreas(mapName, area)].filter(destination => !(mapName === '魔鬼海' && sourceOxygen && !aiIsOxygenArea(mapName, destination))));
    aiTurnContext.sounds.push({
      actor, area, kind: mapName === '魔鬼海' && !sourceOxygen ? '游动声' : '脚步声',
      heardIn,
    });
  };
  const aiMarkArrival = (actor, from, to, quiet = false) => {
    if (!from || from === to) return;
    for (const key of Object.keys(state.run?.sight || {})) if (key.startsWith(actor + ':') || key.endsWith(':' + actor)) delete state.run.sight[key];
    aiEmitSound(state.run?.map, actor, to, quiet);
    for (const player of aiAlive()) {
      if (player.id === actor || player.region !== to || !player.crouched) continue;
      player.ambushTargets = [...new Set([...(player.ambushTargets || []), actor])];
    }
  };
  const aiTakeAmbush = (player, target) => {
    if (!player.crouched || !(player.ambushTargets || []).includes(target) || aiPeaceful(player.id, target)) return false;
    aiReveal(player);
    player.ambushTargets = [];
    player.ambushTurn = aiNum(state.run?.soundTurn, 0);
    player.ambushTarget = target;
    return true;
  };
  const aiSoundDecision = (mapName, player, chart) => {
    const context = aiTurnContext;
    if (!context) return false;
    const heard = context.sounds.filter(sound => sound.actor !== player.id && !aiPeaceful(player.id, sound.actor) && sound.heardIn.has(player.region));
    const direct = aiMovableFrom(mapName, player.region);
    const sub = textOf(player.sub, '均衡');
    const previous = player.soundWait;
    const remember = (sound, choice) => {
      const line = player.name + '听到了' + (sound.actor === 'hero' ? '主角' : textOf(aiPlayers().find(other => other.id === sound.actor)?.name, '玩家'))
        + '在' + sound.area + '的' + sound.kind + '，选择' + choice + '。';
      player.soundReaction = line;

    };
    const crouch = sound => {
      player.crouched = true;
      player.mode = 'crouch';
      player.soundWait = { area: sound.area, turn: context.turn };
      player.lastAction = '在' + player.region + '原地蹲伏';
      remember(sound, '留在' + player.region + '蹲伏');
      aiUseHeal(player, mapName, chart);
      if (mapName === '魔鬼海' && player.water < Math.min(AI_MONSTER_SEA_TANK_LOW, player.waterCap)) aiUseOxygen(player, mapName);
      return true;
    };
    const pursue = (sound, continuing = false) => {
      const route = aiRouteTo(mapName, player.region, [sound.area]);
      player.crouched = false;
      player.soundWait = null;
      if (!route) { player.soundPursuit = null; remember(sound, '找不到通路，继续正常行动'); return false; }
      player.prev = player.region;
      player.region = route.hop;
      if (!player.visited.includes(player.region)) player.visited.push(player.region);
      player.mode = route.hop === sound.area ? 'fight' : 'pursue';
      player.soundPursuit = route.hop === sound.area ? null : { actor: sound.actor, area: sound.area, kind: sound.kind };
      player.lastAction = '循声经' + route.hop + '前往' + sound.area + (route.hop === sound.area ? '准备攻击' : '');
      if (continuing) {
        player.soundReaction = player.name + '继续追踪先前在' + sound.area + '听到的' + sound.kind + '，本合移动至' + route.hop + '。';

      } else remember(sound, '前往' + sound.area + '攻击，本合移动至' + route.hop);
      return true;
    };
    if (player.meta === '猛攻哥') {
      if (sub === '谨慎' && heard.length) return crouch(heard[heard.length - 1]);
      if (sub === '均衡' || sub === '菜鸡') {
        const confirmed = previous && previous.turn === context.turn - 1
          ? heard.find(sound => sound.area === previous.area && direct.includes(sound.area)) : null;
        if (confirmed) return pursue(confirmed);
        if (previous) {
          player.crouched = false;
          player.soundWait = null;
          player.mode = 'roam';
          player.lastAction = '脚步消失，恢复正常行动';
          return false;
        }
        const reachable = heard.filter(sound => direct.includes(sound.area));
        if (reachable.length) return crouch(reachable[reachable.length - 1]);
      }
      if (sub === '霸道' || sub === '嘉豪') {
        if (heard.length) return pursue(heard[heard.length - 1]);
        if (player.soundPursuit && !aiPeaceful(player.id, player.soundPursuit.actor) && player.soundPursuit.area !== player.region) return pursue(player.soundPursuit, true);
        player.soundPursuit = null;
      }
    }
    if (previous) { player.soundWait = null; player.crouched = false; player.mode = 'roam'; }
    return false;
  };

  const aiObserverRegion = actor => actor === 'hero'
    ? textOf(aiTurnContext?.planningPlayer ? aiTurnContext.heroFrom : aiTurnContext?.heroTo, textOf(state.run?.registeredArea, textOf(currentStatSnapshot?.场景?.区域, '')))
    : textOf(aiPlayers().find(player => player.id === actor)?.region, '');
  const aiSightKey = (actor, target) => actor + ':' + target;
  const aiCanSee = (actor, target) => {
    if (!target?.alive || target.extracted || aiObserverRegion(actor) !== target.region) return false;
    if (actor !== 'hero' && target.id === 'hero' && aiTurnContext?.heroNoticeChance != null) {
      const key = actor + ':quiet-hero';
      if (aiTurnContext.noticeRolls?.[key] === undefined) {
        const observer = aiPlayers().find(player => player.id === actor);
        let chance = Math.max(0, Math.min(1, Number(aiTurnContext.heroNoticeChance) || 0));
        if (/搜索/.test(textOf(observer?.mode, '') + ' ' + textOf(observer?.lastAction, ''))) chance = 0.8;
        else if (observer?.mode === 'fight' || /交战/.test(textOf(observer?.lastAction, ''))) chance = 0.5;
        if (observer?.meta === '猛攻哥' && observer.sub === '稳健') chance *= 0.4;
        if (observer?.meta === '鼠鼠' && observer.sub === '谨慎') chance *= 0.7;
        aiTurnContext.noticeRolls ||= {};
        aiTurnContext.noticeRolls[key] = Math.random() >= chance;
      }
      return aiTurnContext.noticeRolls[key];
    }
    if (actor === target.id || !target.crouched) return true;
    const observer = aiPlayers().find(player => player.id === actor);
    if (observer?.meta === '猛攻哥' && observer.sub === '稳健') return true;
    const turn = aiNum(state.run?.soundTurn, aiNum(aiTurnContext?.turn, 0));
    if (target.revealedTurn === turn) return true;
    const sight = state.run.sight || (state.run.sight = {});
    const key = aiSightKey(actor, target.id), previous = sight[key];
    if (previous?.turn === turn && previous.area === target.region) return previous.noticed;
    if (!aiTurnContext) return previous?.area === target.region && previous.noticed === true;
    const stays = previous?.area === target.region && previous.turn === turn - 1 ? Math.min(3, previous.stays + 1) : 1;
    const unnoticed = Math.min(0.75, stays * 0.25);
    const noticed = Math.random() >= unnoticed;
    sight[key] = { area: target.region, turn, stays, unnoticed, noticed };
    return noticed;
  };
  const aiReveal = player => {
    player.revealedTurn = aiNum(aiTurnContext?.turn, aiNum(state.run?.soundTurn, 0));
    for (const key of Object.keys(state.run?.sight || {})) if (key.endsWith(':' + player.id)) delete state.run.sight[key];
    player.crouched = false;
    player.mouseHiding = false;
    player.mouseQuiet = 0;
    player.soundWait = null;
    player.ambushTargets = [];
  };
  const aiPeaceful = (left, right) => {
    const key = [left, right].sort().join(':');
    return !!state.run?.truces?.[key] || [left, right].some(actor => actor !== 'hero' && hkm139Friendly(aiPlayers().find(player => player.id === actor)));
  };
  const aiVisiblePlayers = player => aiAlive().filter(other => other !== player && other.region === player.region && aiCanSee(player.id, other) && !aiPeaceful(player.id, other.id));
  const aiHeroPresent = player => player.region === aiObserverRegion('hero') && !HkmLifecycle.dead(asObject(aiTurnContext?.stat)) && !aiPeaceful(player.id, 'hero');
  const aiEventLine = line => {
    if (aiTurnContext) aiTurnContext.soundLines.push(line);
  };
  const aiAttackPlayer = (mapName, player, target) => {
    const id = target === 'hero' ? 'hero' : target.id;
    if (aiPeaceful(player.id, id)) return;
    const ambush = aiTakeAmbush(player, id);
    aiReveal(player);
    player.mode = 'fight';
    if (id === 'hero') {
      player.equipmentOpeningAttack={area:player.region,floor:hkmTurnOrigin};
      player.lastAction = ambush ? '从蹲伏中对主角发动偷袭' : '准备攻击主角';
      aiEventLine(player.name + (ambush ? '从蹲伏中对主角发动偷袭。' : '选择攻击主角。'));
      return;
    }
    const damage = hkm163AiHit(player,target,ambush);
    player.lastAction = '攻击' + target.name;
    player.lastHit = { target: target.name, damage, killed: target.hp <= 0, ambush };
    if (target.hp <= 0) { HkmFishing.recordKill(state.run, target.id, player.id, true); aiKillPlayer(mapName, target, '被' + player.name + '击杀'); }
  };
  const AI_MOUSE_RULES = {
    跑刀: { quiet: 1, scan: 0.4, burden: 1.5, hiding: [['attack', 0.3], ['beg', 0.35], ['hide', 0.35]], meeting: [['escape', 0.5], ['attack', 0.25], ['beg', 0.25]] },
    谨慎: { quiet: 2, scan: 0.4, burden: 1.5, hiding: [['hide', 0.5], ['beg', 0.5]], meeting: [['escape', 0.6], ['beg', 0.4]] },
    自保: { quiet: 1, scan: 0.4, burden: 1, hiding: [['attack', 0.75], ['hide', 0.25]], meeting: [['attack', 0.5], ['escape', 0.5]] },
    鲁莽: { quiet: 1, scan: 0.4, burden: 1, hiding: [['attack', 0.75], ['hide', 0.25]], meeting: [['attack', 0.5], ['escape', 0.5]] },
    贪吃: { quiet: 0, scan: 0.5, burden: 1, hiding: [], meeting: [['escape', 0.8], ['beg', 0.2]] },
    摆烂: { quiet: 0, scan: 0.4, burden: 1.5, hiding: [['beg', 1]], meeting: [['beg', 1]] },
    胆小: { quiet: 2, scan: 0.4, burden: 1.5, hiding: [['hide', 0.5], ['beg', 0.5]], meeting: [['escape', 0.6], ['beg', 0.4]] },
    弱气: { quiet: 0, scan: 0.4, burden: 1.5, hiding: [['beg', 1]], meeting: [['beg', 1]] },
  };
  const aiHideMouse = player => {
    player.crouched = true;
    player.mouseHiding = true;
    player.mouseQuiet = 0;
    player.mode = 'crouch';
    player.lastAction = '在' + player.region + '蹲伏躲藏';
  };
  const aiQuietAreas = (mapName, player) => aiMovableFrom(mapName, player.region).filter(area => !(aiTurnContext?.sounds || []).some(sound => sound.actor !== player.id && sound.heardIn.has(area)));
  const aiMouseSoundPlan = (mapName, player) => {
    const distancesFrom = start => {
      const distances = new Map([[start, 0]]), queue = [start];
      for (let index = 0; index < queue.length; index++) {
        const area = queue[index];
        for (const next of aiMovableFrom(mapName, area)) {
          if (distances.has(next)) continue;
          distances.set(next, distances.get(area) + 1);
          queue.push(next);
        }
      }
      return distances;
    };
    const threats = (aiTurnContext?.sounds || [])
      .filter(sound => sound.actor !== player.id && !aiPeaceful(player.id, sound.actor) && sound.heardIn.has(player.region))
      .map(sound => ({ sound, distances: distancesFrom(sound.area) }))
      .filter(threat => threat.distances.has(player.region))
      .map(threat => ({ ...threat, rounds: threat.distances.get(player.region) }))
      .sort((left, right) => left.rounds - right.rounds);
    const movable = aiMovableFrom(mapName, player.region);
    if (!threats.length) return { sounds: [], exits: movable };
    const toCurrent = distancesFrom(player.region), forbidden = new Set();
    for (const threat of threats) {
      for (const [area, rounds] of threat.distances) {
        if (area !== player.region && rounds + toCurrent.get(area) === threat.rounds) forbidden.add(area);
      }
    }
    const urgency = [...new Set(threats.map(threat => threat.rounds))];
    const ranked = movable.filter(area => !forbidden.has(area)).map(area => ({
      area,
      rank: [
        ...urgency.map(rounds => Math.min(...threats.filter(threat => threat.rounds === rounds).map(threat => threat.distances.get(area) ?? Infinity))),
        threats.some(threat => threat.sound.heardIn.has(area)) ? 0 : 1,
      ],
    }));
    const compare = (left, right) => {
      for (let index = 0; index < left.rank.length; index++) {
        if (left.rank[index] !== right.rank[index]) return left.rank[index] > right.rank[index] ? -1 : 1;
      }
      return 0;
    };
    ranked.sort(compare);
    return { sounds: threats.map(threat => threat.sound), exits: ranked.filter(row => compare(row, ranked[0]) === 0).map(row => row.area) };
  };
  const aiMouseEscape = (mapName, player, target) => {
    const exits = player.meta === '鼠鼠' ? aiMouseSoundPlan(mapName, player).exits : aiMovableFrom(mapName, player.region);
    const quiet = player.meta === '鼠鼠' ? exits : aiQuietAreas(mapName, player);
    const speed = target === 'hero' ? aiNum(aiTurnContext?.stat?.主角?.速度, 10) : aiNum(target?.speed, 10);
    const chance = Math.min(0.95, AI_ESCAPE_BASE + Math.max(0, aiNum(player.speed, 0) - speed) * AI_ESCAPE_PER_SPEED);
    if (exits.length && Math.random() < chance) {
      player.prev = player.region;
      player.region = aiPickOne(quiet.length ? quiet : exits);
      aiReveal(player);
      player.mode = 'roam';
      player.llm = false;
      if (!player.visited.includes(player.region)) player.visited.push(player.region);
      player.lastAction = '脱离交战，前往' + player.region;
    } else player.lastAction = '试图逃跑但失败';
    if (target === 'hero') aiEventLine(player.name + (player.lastAction === '试图逃跑但失败' ? '试图逃跑但失败。' : '逃离到' + player.region + '。'));
    return true;
  };
  const aiMouseOffer = player => {
    const entries = [];
    const weapon = itemById(player.equip?.主武器);
    if (weapon) { entries.push({ item: weapon, quantity: 1 }); player.equip.主武器 = ''; }
    const pool = [];
    for (const slot of AI_ALL_SLOTS) {
      const item = itemById(player.equip?.[slot]);
      if (item) pool.push({ item, slot });
    }
    for (const entry of player.bag) {
      const item = itemById(entry.id);
      if (item && entry.quantity > 0) pool.push({ item, entry });
    }
    pool.sort((left, right) => aiNum(right.item.value, 0) - aiNum(left.item.value, 0) || aiRarityRank(right.item.rarity) - aiRarityRank(left.item.rarity));
    const highest = pool[0];
    if (highest) {
      if (highest.slot) player.equip[highest.slot] = '';
      else highest.entry.quantity -= 1;
      entries.push({ item: highest.item, quantity: 1 });
    }
    player.bag = player.bag.filter(entry => entry.quantity > 0);
    return { entries, highest: highest?.item || weapon || null };
  };
  const aiMouseBegChance = (mapName, area, item) => {
    const rarityBonus = Math.max(0, aiRarityRank(item?.rarity) - aiRarityRank('珍稀')) * 0.15;
    const valueBonus = Math.floor(Math.max(0, aiNum(item?.value, 0)) / 80) * 0.01;
    return Math.max(0, Math.min(1, (0.3 + rarityBonus + valueBonus) * (aiBaseTier(mapName, area) >= 5 ? 0.25 : 1)));
  };
  const aiMouseBeg = (mapName, player, target) => {
    if (target === 'hero' && aiPeaceful(player.id,'hero')) return false;
    const offer = player.sub === '摆烂' || player.sub === '弱气'
      ? { entries: aiBegAllItems(player) }
      : aiMouseOffer(player);
    player.begOffer = offer.entries;
    const id = target === 'hero' ? 'hero' : target.id;
    if (id === 'hero' && offer.entries.length) player.tributeToHero = true;
    const success = id !== 'hero' && (player.sub === '摆烂' || player.sub === '弱气' ? Math.random() < aiBegChance(player) : Math.random() < aiMouseBegChance(mapName, player.region, offer.highest));
    aiReveal(player);
    const scatterBeg = player.sub === '摆烂' || player.sub === '弱气';
    if (scatterBeg) {
      player.scavenged = {
        taken: [],
        placed: offer.entries.map(row => ({ item: itemById(row.id), quantity: row.quantity })).filter(row => row.item),
        boxes: false,
        names: offer.entries.map(row => itemById(row.id)?.name).filter(Boolean),
      };
      aiRecalcStats(player);
      player.weight = aiPlayerWeight(player);
    } else {
      for (const row of offer.entries) {
        if (id === 'hero') aiTurnContext.heroGifts.push({...row,map:mapName,area:player.region});
        else aiAddItem(target, mapName, row.item, row.quantity);
      }
    }
    aiRecalcStats(player);
    player.weight = aiPlayerWeight(player);
    if (id !== 'hero') target.weight = aiPlayerWeight(target);
    if (success) {
      state.run.truces = state.run.truces || {};
      state.run.truces[[player.id, id].sort().join(':')] = true;
    }
    player.mode = 'roam';
    const recipient = id === 'hero' ? '主角' : target.name;
    player.lastAction = '向' + recipient + '上供求饶' + (id === 'hero' ? '' : success ? '成功' : '失败');
    const names = offer.entries.map(row => itemById(row.id)?.name + '×' + row.quantity).join('、');
    const line = player.name + '向' + recipient + '上供' + (names || '未能交出物品') + '并求饶' + (id === 'hero' ? '。' : success ? '，求饶成功，本局双方不会主动攻击对方。' : '，求饶失败。');
    if (id === 'hero' || aiObserverRegion('hero') === player.region && aiCanSee('hero', player)) aiEventLine(line);
    return true;
  };
  const aiMouseEncounterWeights = (weights, target) => {
    const actor = target === 'hero' ? (aiTurnContext?.stat || currentStatSnapshot)?.主角 : target;
    const maxHp = aiNum(target === 'hero' ? actor?.血量上限 : actor?.maxHp, 0);
    const hp = aiNum(target === 'hero' ? actor?.当前血量 : actor?.hp, maxHp);
    const loss = maxHp > 0 ? Math.max(0, Math.min(1, 1 - hp / maxHp)) : 0;
    const attack = weights.reduce((sum, [action, weight]) => sum + (action === 'attack' ? weight : 0), 0);
    const available = weights.reduce((sum, [action, weight]) => sum + (action === 'escape' || action === 'beg' ? weight : 0), 0);
    const increase = Math.min(available, attack * loss);
    if (!increase) return weights;
    return weights.map(([action, weight]) => [action, action === 'attack' ? weight * (1 + increase / attack)
      : action === 'escape' || action === 'beg' ? weight * (1 - increase / available) : weight]);
  };
  const aiMouseProfile = player => player?.meta === '鼠鼠' || player?.meta === '萌新' && ['弱气', '鲁莽', '胆小'].includes(player.sub);
  const aiMouseEncounter = (mapName, player) => {
    if (!aiMouseProfile(player)) return false;
    const rules = AI_MOUSE_RULES[player.sub] || AI_MOUSE_RULES.跑刀;
    const visible = aiVisiblePlayers(player);
    const hero = aiHeroPresent(player);
    const targets = [...(hero ? ['hero'] : []), ...visible];
    if (!targets.length) return false;
    let target;
    if (player.mouseHiding || player.crouched) {
      target = targets.find(other => (player.ambushTargets || []).includes(other === 'hero' ? 'hero' : other.id));
      if (!target) return false;
      const id = target === 'hero' ? 'hero' : target.id;
      player.ambushTargets = (player.ambushTargets || []).filter(actor => actor !== id);
      if (id === 'hero') player.heroDecisionTurn = aiNum(aiTurnContext?.turn,0);
      const action = aiPickWeighted(aiMouseEncounterWeights(rules.hiding, target));
      if (action === 'attack') { if (!player.ambushTargets.includes(id)) player.ambushTargets.push(id); aiAttackPlayer(mapName, player, target); return true; }
      if (action === 'beg') return aiMouseBeg(mapName, player, target);
      aiHideMouse(player);
      return true;
    }
    target = hero ? 'hero' : aiSortTargets(visible.map(other => ({ player: other, record: aiEnemyRecord(other) })))[0].player;
    if (target === 'hero') player.heroDecisionTurn = aiNum(aiTurnContext?.turn,0);
    const action = aiPickWeighted(aiMouseEncounterWeights(rules.meeting, target));
    if (action === 'attack') { aiAttackPlayer(mapName, player, target); return true; }
    if (action === 'beg') return aiMouseBeg(mapName, player, target);
    return aiMouseEscape(mapName, player, target);
  };
  const aiMouseSoundDecision = (mapName, player, chart) => {
    if (!aiMouseProfile(player) || player.sub === '贪吃' || player.sub === '摆烂' || player.sub === '弱气' || player.sub === '鲁莽') return false;
    const rules = AI_MOUSE_RULES[player.sub] || AI_MOUSE_RULES.跑刀;
    const plan = player.meta === '鼠鼠' ? aiMouseSoundPlan(mapName, player) : null;
    const heard = plan ? plan.sounds : (aiTurnContext?.sounds || []).filter(sound => sound.actor !== player.id && sound.heardIn.has(player.region));
    if (player.mouseHiding) {
      player.mouseQuiet = heard.length ? 0 : aiNum(player.mouseQuiet, 0) + 1;
      if (player.mouseQuiet < rules.quiet) {
        player.lastAction = '在' + player.region + '继续躲藏';
        aiUseHeal(player, mapName, chart);
        if (mapName === '魔鬼海' && player.water < Math.min(AI_MONSTER_SEA_TANK_LOW, player.waterCap)) aiUseOxygen(player, mapName);
        return true;
      }
      player.mouseHiding = false;
      player.crouched = false;
      player.mode = 'roam';
      player.lastAction = '脚步消失，离开躲藏状态';
      return false;
    }
    if (!heard.length) return false;
    const quiet = plan ? plan.exits : aiQuietAreas(mapName, player);
    const last = plan ? heard[0] : heard[heard.length - 1];
    if (quiet.length) {
      player.prev = player.region;
      player.region = aiPickOne(quiet);
      player.crouched = false;
      player.mode = 'roam';
      player.llm = false;
      if (!player.visited.includes(player.region)) player.visited.push(player.region);
      player.lastAction = '避开脚步，前往' + player.region;
    } else aiHideMouse(player);
    player.soundReaction = player.name + '听到了' + (last.actor === 'hero' ? '主角' : textOf(aiPlayers().find(other => other.id === last.actor)?.name, '玩家')) + '在' + last.area + '的' + last.kind + '，选择' + (quiet.length ? '前往' + player.region + '避开响动。' : '原地蹲伏躲藏。');

    return true;
  };
  const aiHeroGiftPatch = baseScatter => {
    const gifts = aiTurnContext?.heroGifts || [];
    if (!gifts.length) return {};
    const scatter = {...asObject(baseScatter || aiTurnContext.stat?.散落物品)};
    for (const row of gifts) hudScatterMerge(scatter,row.map,row.area,row.item,row.quantity);
    return {散落物品:scatter};
  };

  const aiTreasureAreas = mapName => aiMapAreas(mapName).filter(area => aiBaseTier(mapName, area) >= 5);
  const aiTreasureSearchOverride = (mapName, player) =>
    (player.meta === '猛攻哥' && player.sub !== '霸道' || player.meta === '萌新' && player.sub === '鲁莽')
    && aiBaseTier(mapName, player.region) >= 5 && aiAreaTier(mapName, player.region) === 5;
  const aiTreasureRoute = (mapName, player) => {
    const limit = player.meta === '鼠鼠' ? { 跑刀: 1, 贪吃: 2, 摆烂: 0, 谨慎: 1, 自保: 1 }[player.sub]
      : player.meta === '萌新' ? (player.sub === '鲁莽' ? 1 : 0)
      : player.meta === '猛攻哥' ? { 均衡: 2, 稳健: 1, 嘉豪: 3, 霸道: 4 }[player.sub] || 2 : 0;
    if (!limit || player.mode === 'extract') return null;
    const areas = aiTreasureAreas(mapName);
    const visited = new Set([...(player.visited || []), player.region]);
    if (areas.filter(area => visited.has(area)).length >= limit) return null;
    return areas.filter(area => !visited.has(area))
      .map(area => ({ route: aiRouteTo(mapName, player.region, [area]), tier: aiAreaTier(mapName, area) }))
      .filter(row => row.route)
      .sort((left, right) => right.tier - left.tier || left.route.distance - right.route.distance)[0]?.route || null;
  };
  const aiNoviceBasicStep = (mapName, player) => {
    if (!hkmSeaAiSpend(mapName, player)) return true;
    const elapsed = Math.max(0, aiNum(state.run?.soundTurn, 0) - aiNum(player.spawnTurn, 0));
    if (player.sub === '胆小' && elapsed >= 5) {
      player.mode = 'extract';
      if (aiExtractStep(mapName, player)) return true;
    }
    if (player.sub === '胆小' && aiMouseSoundDecision(mapName, player, AI_TYPES.萌新.judge.胆小)) return true;
    const movable = aiMovableFrom(mapName, player.region);
    const next = movable.filter(area => !player.visited.includes(area))[0] || movable[0];
    if (next && next !== aiTurnContext?.heroTo) {
      player.prev = player.region;
      player.region = next;
      if (!player.visited.includes(next)) player.visited.push(next);
      player.lastAction = '前往' + next;
      return true;
    }
    if (aiAreaTier(mapName, player.region) >= 1) aiSearchHere(mapName, player);
    else player.lastAction = '在' + player.region + '徘徊';
    return true;
  };

  const aiExtractionLocked = player => player.mode === 'extract' && !(player.meta === '猛攻哥' && player.sub === '嘉豪');
  const aiUpdateExtraction = (mapName, player) => {
    if (aiExtractionLocked(player)) return;
    const tanks = aiBagCount(player, AI_OXYGEN_ITEM_IDS);
    const scanRatio = (player.meta === '鼠鼠' || player.meta === '萌新') ? (AI_MOUSE_RULES[player.sub]?.scan || AI_EXTRACT_SCAN_RATIO) : AI_EXTRACT_SCAN_RATIO;
    if (mapName === '魔鬼海') {
      const route = aiRouteTo(mapName, player.region, GAME_DATA.maps?.[mapName]?.extractAreas || []);
      if (player.rounds <= (route?.distance || 1) + 2 || player.rounds < player.roundCap * scanRatio || (player.water <= player.waterCap * AI_MONSTER_SEA_EXTRACT_RATIO && tanks <= AI_MONSTER_SEA_TANK_KEEP)) player.mode = 'extract';
    } else if (player.rounds < player.roundCap * scanRatio) player.mode = 'extract';
  };
  const aiExtractStep = (mapName, player, stat = asObject(aiTurnContext?.stat)) => {
    if (!aiExtractionLocked(player)) return false;
    player.crouched = false;
    player.soundWait = null;
    player.soundPursuit = null;
    player.ambushTargets = [];
    player.mouseHiding = false;
    const goals = GAME_DATA.maps?.[mapName]?.extractAreas || [];
    const route = aiRouteTo(mapName, player.region, goals);
    const here = aiVisiblePlayers(player);
    const npcs = aiNpcsAlive().filter(npc => npc.region === player.region && npc.faction !== player.faction && npc.attitude === '敌对');
    const hero = player.region === aiObserverRegion('hero') && (hudCombatFlagOn(stat) || aiTurnContext?.crossed?.has(player.id)) && !HkmLifecycle.dead(stat) && !aiPeaceful(player.id, 'hero');
    if (here.length || npcs.length || hero) {
      const exits = aiMovableFrom(mapName, player.region);
      const slowest = Math.min(...here.map(other => aiNum(other.speed, player.speed)), ...npcs.map(npc => aiNum(npc.speed, player.speed)), ...(hero ? [aiNum(stat.主角?.速度, player.speed)] : []));
      const chance = Math.min(0.95, AI_ESCAPE_BASE + Math.max(0, aiNum(player.speed, 0) - slowest) * AI_ESCAPE_PER_SPEED);
      if (exits.length && Math.random() < chance) {
        const next = route?.hop || exits.slice().sort((left, right) => (aiRouteTo(mapName, left, goals)?.distance ?? (goals.includes(left) ? 0 : Infinity)) - (aiRouteTo(mapName, right, goals)?.distance ?? (goals.includes(right) ? 0 : Infinity)))[0];
        player.prev = player.region;
        player.region = next;
        player.llm = false;
        if (!player.visited.includes(next)) player.visited.push(next);
        player.lastAction = '脱离交战，向' + next + '撤离';
        return true;
      }
      if (player.meta === '鼠鼠' || player.meta === '萌新') {
        player.lastAction = '撤离时逃脱失败，留在原地';
        if (hero) aiEventLine(player.name + '撤离时逃脱失败，仍留在原区域。');
        return true;
      }
      const type = AI_TYPES[player.meta] || AI_TYPES['猛攻哥'];
      aiUseHeal(player, mapName, type.judge[player.sub] || type.judge['均衡']);
      if (hero) {
        player.lastAction = '撤离时逃脱失败，准备还击主角';
        aiTurnContext?.soundLines.push(player.name + '撤离时逃脱失败，选择还击主角。');
      } else if (here.length) {
        const target = aiSortTargets(here.map(other => ({ player: other, record: aiEnemyRecord(other) })))[0]?.player;
        const damage = hkm163AiHit(player,target,false);
        player.lastAction = '撤离时逃脱失败，还击' + target.name;
        player.lastHit = { target: target.name, damage, killed: target.hp <= 0, ambush: false };
        if (target.hp <= 0) { HkmFishing.recordKill(state.run, target.id, player.id, true); aiKillPlayer(mapName, target, '被' + player.name + '击杀'); }
      } else {
        const target = aiSortTargets(npcs.map(npc => ({ player: npc, record: aiNpcRecord(npc) })))[0]?.player;
        const damage = hkm163AiHit(player,target,false);
        const back = target.hp > 0 ? aiNpcRetaliate(player, target) : '';
        player.lastAction = '撤离时逃脱失败，还击' + target.name + '，造成 ' + damage + ' 点伤害' + (target.hp <= 0 ? '（击杀）' : '') + (back ? '；' + back : '');
        if (target.hp <= 0) aiNpcKill(target, false, player.id);
      }
      return true;
    }
    if (mapName === '魔鬼海' && aiWaterCost(mapName, player.region) > 0 && player.water < Math.min(AI_MONSTER_SEA_TANK_LOW, player.waterCap) && aiUseOxygen(player, mapName)) return true;
    if (goals.includes(player.region)) {
      if (HkmFishing.extraction(state.run, mapName, player.region, player.id).ok && (mapName !== '魔鬼海' || aiBagCount(player, ['COL-0039']) >= 1)) {
        if (mapName === '魔鬼海') aiConsume(player, ['COL-0039'], 1);
        player.extracted = true;
        player.lastAction = '从' + player.region + '成功撤离';
      } else aiSearchHere(mapName, player);
      return true;
    }
    if (route) {
      player.prev = player.region;
      player.region = route.hop;
      player.llm = false;
      if (!player.visited.includes(player.region)) player.visited.push(player.region);
      player.lastAction = route.hop === route.target ? '向' + route.target + '撤离' : '经' + route.hop + '前往撤离点' + route.target;
    } else player.lastAction = '找不到通往撤离点的路';
    return true;
  };

  const aiStepExtendedMove = (mapName, player) => {
    if (!hkmSeaAiSpend(mapName, player)) return;
    if (player.meta === '鼠鼠' && aiMouseSoundDecision(mapName, player, AI_TYPES.鼠鼠.judge[player.sub] || AI_TYPES.鼠鼠.judge.跑刀)) return;
    const movable = aiMovableFrom(mapName, player.region);
    const route = player.mode === 'extract'
      ? aiRouteTo(mapName, player.region, GAME_DATA.maps?.[mapName]?.extractAreas || [])
      : null;
    const next = route?.hop || movable.filter(area => !player.visited?.includes(area))
      .sort((left, right) => aiBaseTier(mapName, right) - aiBaseTier(mapName, left))[0] || movable[0];
    if (next && next !== aiTurnContext?.heroTo) {
      player.prev = player.region;
      player.region = next;
      if (!Array.isArray(player.visited)) player.visited = [];
      if (!player.visited.includes(next)) player.visited.push(next);
      player.crouched = false;
      player.soundWait = null;
      player.lastAction = '拓展移动经' + next;
    } else {
      player.lastAction = '在' + player.region + '保持行动';
    }
  };

  const aiStep = (mapName, player) => {
    const type = AI_TYPES[player.meta] || AI_TYPES['猛攻哥'];
    const chart = type.judge[player.sub] || type.judge.跑刀 || type.judge['均衡'];
    if (player.meta === '萌新' && (player.sub === '小白' || player.sub === '胆小')) return aiNoviceBasicStep(mapName, player);
    const treasureSearch = aiTreasureSearchOverride(mapName, player);
    const retainExtraction = treasureSearch && aiExtractionLocked(player);



    if (!treasureSearch) aiUpdateExtraction(mapName, player);
    if (!hkmSeaAiSpend(mapName,player)) return;
    if (hkm139MouseBossEscape(mapName, player)) return;
    if (!treasureSearch) aiUpdateExtraction(mapName, player);
    if (aiMouseProfile(player) && aiHeroPresent(player) && aiMouseEncounter(mapName,player)) return;
    if (!treasureSearch && aiExtractStep(mapName, player)) return;
    if (aiMouseProfile(player) && (aiMouseEncounter(mapName, player) || aiMouseSoundDecision(mapName, player, chart))) return;
    if (!aiMouseProfile(player) && player.region === aiTurnContext?.heroTo && aiTakeAmbush(player, 'hero')) {
      if (!retainExtraction) player.mode = 'fight';
      player.lastAction = '从蹲伏中对主角发动偷袭';
      aiTurnContext.soundLines.push(player.name + '从蹲伏中对进入' + player.region + '的主角发动偷袭。');
      return;
    }
    const coLocated = aiVisiblePlayers(player).length > 0;
    if (!aiMouseProfile(player) && !treasureSearch && !coLocated && player.region !== aiTurnContext?.heroTo && !aiNpcTargetsFor(player, mapName).length && aiSoundDecision(mapName, player, chart)) return;
    const tanks=aiBagCount(player,AI_OXYGEN_ITEM_IDS);
    if(mapName==='魔鬼海'){
      if(aiWaterCost(mapName,player.region)>0 && player.water<Math.min(AI_MONSTER_SEA_TANK_LOW,player.waterCap) && tanks>0 && !hudCombatFlagOn(asObject(aiTurnContext?.stat)) && !aiNpcTargetsFor(player,mapName).length){
        aiUseOxygen(player,mapName);return;
      }
    }
    if (!treasureSearch) aiUpdateExtraction(mapName, player);

    const here = aiVisiblePlayers(player);


    if (!here.length) {
      const npcTargets = aiNpcTargetsFor(player, mapName);
      if (npcTargets.length) {
        if (!retainExtraction) player.mode = 'fight';
        const pick = aiSortTargets(npcTargets.map(row => ({ player: row.npc, record: row.record }))).map(row => row.player).find(Boolean);
        if (pick) {
          player.crouched = false;
          player.soundWait = null;
          const damage = hkm163AiHit(player,pick,false);
          const back = pick.hp > 0 ? aiNpcRetaliate(player, pick) : '';
          player.lastAction = '攻击' + pick.name + '，造成 ' + damage + ' 点伤害' + (pick.hp <= 0 ? '（击杀）' : '') + (back ? '；' + back : '');
          if (pick.hp <= 0) aiNpcKill(pick, false, player.id);
          return;
        }
      }
    }
    if (here.length) {
      if (!retainExtraction) player.mode = 'fight';
      aiUseHeal(player, mapName, chart);
      const order = aiSortTargets(here.map(other => ({ player: other, record: aiEnemyRecord(other) })));
      const target = order[0];
      const hurt = aiNum(player.hp, 0) < aiNum(player.maxHp, 1) * aiNum(chart.healAt, 0.5);
      if (hurt && !type.heals.some(id => aiBagCount(player, [id]) > 0) && Math.random() < AI_ESCAPE_BASE) {
        const ownSpeed = aiNum(player.speed, 0);
        const slowest = Math.min(...here.map(other => aiNum(other.speed, ownSpeed)));
        const chance = Math.min(0.95, AI_ESCAPE_BASE + Math.max(0, ownSpeed - slowest) * AI_ESCAPE_PER_SPEED);
        const exits = aiMovableFrom(mapName, player.region);
        if (exits.length && Math.random() < chance) {
          player.prev = player.region;
          player.region = aiPickOne(exits);
          if (!player.visited.includes(player.region)) player.visited.push(player.region);
          player.lastAction = '脱离交战，撤往' + player.region;
          return;
        }
        player.lastAction = '试图脱离交战但失败';
      }
      if (target?.player) {
        const ambush = aiTakeAmbush(player, target.player.id);
        player.crouched = false;
        player.soundWait = null;
        const damage = hkm163AiHit(player,target.player,ambush);
        player.lastAction = '攻击' + target.player.name;
        const downed = aiNum(target.player.hp, 0) <= 0;
        player.lastHit = { target: target.player.name, damage, killed: downed, ambush };
        if (downed) { HkmFishing.recordKill(state.run,target.player.id,player.id,true); aiKillPlayer(mapName, target.player, '被' + player.name + '击杀'); }
      }
      return;
    }
    aiScavengeArea(mapName, player);
    if (treasureSearch) {
      aiUseHeal(player, mapName, chart);
      player.soundPursuit = null;
      aiSearchHere(mapName, player);
      return;
    }
    if (player.mode === 'extract') {
      const extractAreas = Array.isArray(GAME_DATA.maps?.[mapName]?.extractAreas) ? GAME_DATA.maps[mapName].extractAreas : [];
      if (!extractAreas.length) { player.mode = 'roam'; }
      else if (extractAreas.includes(player.region) && HkmFishing.extraction(state.run,mapName,player.region,player.id).ok && (mapName!=='魔鬼海' || aiBagCount(player,['COL-0039'])>=1)) {
        if(mapName==='魔鬼海')aiConsume(player,['COL-0039'],1);
        player.extracted = true;
        player.lastAction = '从' + player.region + '成功撤离';
        return;
      } else {
        if(extractAreas.includes(player.region)){player.mode='roam';aiSearchHere(mapName,player);return;}
        player.prev = player.region;


        const route = aiRouteTo(mapName, player.region, extractAreas);
        if (route) {
          player.prev = player.region;
          player.region = route.hop;
          player.lastAction = route.hop === route.target ? '向' + route.target + '撤离' : '经' + route.hop + '前往撤离点' + route.target;
          return;
        }

        player.lastAction = '找不到通往撤离点的路，先在' + player.region + '搜索';
        aiSearchHere(mapName, player);
        return;
        return;
      }
    }
    aiUseHeal(player, mapName, chart);
    const tier = aiAreaTier(mapName, player.region);
    if (tier >= aiNum(chart.holdTier, 3)) {
      aiSearchHere(mapName, player);
      return;
    }
    const treasureRoute = aiTreasureRoute(mapName, player);
    const movable = aiMovableFrom(mapName, player.region);

    const fresh = movable.filter(area => !player.visited.includes(area));


    if (tier <= aiNum(chart.roamTier, 2) && fresh.length) {
      const ranked = fresh.slice().sort((left, right) => aiBaseTier(mapName, right) - aiBaseTier(mapName, left));
      if (treasureRoute) ranked.unshift(treasureRoute.hop);
      player.prev = player.region;
      player.region = ranked[0];
      if (!player.visited.includes(player.region)) player.visited.push(player.region);
      player.lastAction = treasureRoute ? '前往' + treasureRoute.target + '寻宝，本合移动至' + player.region : '前往未探索的' + player.region;
      return;
    }
    if (movable.some(area => !player.visited.includes(area))) {
      const next = treasureRoute?.hop || movable.filter(area => !player.visited.includes(area))
        .sort((left, right) => aiBaseTier(mapName, right) - aiBaseTier(mapName, left))[0];
      player.prev = player.region;
      player.region = next;
      player.visited.push(next);
      player.lastAction = treasureRoute ? '前往' + treasureRoute.target + '寻宝，本合移动至' + player.region : '继续前往未探索的' + next;
      return;
    }
    if (Math.random() < aiNum(chart.crouch, 0.25)) {
      player.crouched = true;
      player.mode = 'crouch';
      player.lastAction = '在' + player.region + '原地蹲伏';
      return;
    }
    if (treasureRoute || player.prev && movable.includes(player.prev)) {
      const back = treasureRoute?.hop || player.prev;
      player.prev = player.region;
      player.region = back;
      player.lastAction = treasureRoute ? '前往' + treasureRoute.target + '寻宝，本合移动至' + player.region : '原路返回' + back;
      return;
    }
    if (player.meta === '鼠鼠' || player.meta === '猛攻哥' && player.sub === '菜鸡') {
      player.crouched = false;
      player.mode = 'roam';
      player.lastAction = '留在' + player.region;
      return;
    }
    player.crouched = true;
    player.mode = 'crouch';
    player.lastAction = '在' + player.region + '原地蹲伏';
  };

  const aiActionLine = (player, from, to) => {
    const who = textOf(player.name, '玩家');
    const action = textOf(player.lastAction, '');
    const hit = asObject(player.lastHit);
    if (hit.target) return who + (player.mode === 'extract' && action.includes('逃脱失败') ? '撤离时逃脱失败，' : '') + (hit.ambush ? '偷袭了' : '攻击了') + hit.target + '，造成 ' + aiNum(hit.damage, 0) + ' 点有效伤害' + (hit.killed ? '（击倒对方）' : '');
    if (from !== to) return who + '：' + from + ' → ' + to;
    const loot = Array.isArray(player.lastLoot) ? player.lastLoot.filter(Boolean) : [];
    if (loot.length) return who + '在 ' + to + ' 搜索获得了 ' + loot.join('、');
    const scavenged = Array.isArray(player.lastScavenged) ? player.lastScavenged.filter(Boolean) : [];
    if (scavenged.length) return who + '在 ' + to + ' 顺手捡走了 ' + scavenged.join('、');
    if (player.extracted) return who + '从 ' + to + ' 成功撤离';
    if (player.alive === false) return who + '倒在 ' + to + '（' + action + '）';
    return who + '在 ' + to + '：' + (action || '待命');
  };

  const hkm140LatestText = () => {
    const last = hudLatestAssistantTexts().at(-1);
    return last?.id === hkmTurnOrigin && (state.run?.startMessageId == null || last.id > state.run.startMessageId) ? last : null;
  };

  const hkm160Advance = (run, floor = hkmTurnOrigin) => {
    if (run.playerDecisionFloor !== floor) {
      run.playerDecisionTurn = aiNum(run.playerDecisionTurn, 0) + 1;
      run.playerDecisionFloor = floor;
    }
    for (const player of run.players || []) if (player.avoidRegion && aiNum(run.playerDecisionTurn, 0) > player.avoidRegion.until) delete player.avoidRegion;
  };
  const hkm160Avoids = (player, area) => player?.avoidRegion?.area === area && aiNum(state.run?.playerDecisionTurn, 0) <= player.avoidRegion.until;
  const hkm160IngestDeparture = async stat => {
    const run = state.run, message = hudHostChat()?.[hkmTurnOrigin];
    const last = message && message.is_user !== true && hkmTurnOrigin > aiNum(run?.startMessageId,-1) && hkmTurnOrigin > aiNum(state.replayAfter,-1)
      ? {id:hkmTurnOrigin,text:String(message.mes ?? message.message ?? '')} : null;
    if (!last || !run || run.map !== stat?.场景?.地图) return false;
    const names = new Set([...last.text.matchAll(/<HkmPlayerLeave>([^<>\r\n]+)<\/HkmPlayerLeave>/g)].map(row=>row[1]));
    const draft = HkmLifecycle.copy(run), ledger = {...asObject(draft.playerDepartureLedger)};
    let changed = false;
    for (const name of names) {
      const matches = (draft.players || []).filter(player=>player.name === name && player.alive !== false && !player.extracted && aiNum(player.hp,0)>0);
      if (matches.length !== 1) continue;
      const player = matches[0], key = last.id + ':' + player.id;
      const visible = Object.entries(asObject(stat.敌人)).some(([key,row])=>key === player.name || key === player.id || row?.名称 === player.name);
      if (ledger[key] || !visible || player.llm !== true || player.region !== stat.场景.区域 || !aiCanSee('hero',player)) continue;
      ledger[key] = true;
      player.llm = false;
      player.departure = {pending:true,origin:player.region,source:last.id};
      player.avoidRegion = {area:player.region,until:aiNum(draft.playerDecisionTurn,0)+3};
      changed = true;
    }
    if (!changed) return false;
    draft.playerDepartureLedger = ledger;
    await hkm098Transact('player-leave-request:'+hkm098RunId(run)+':'+last.id,{}, {run:draft},'', '',1,stat);
    hkm098RefreshQueued = true;
    return true;
  };
  const hkm160DepartureStep = (mapName, player) => {
    if (!player.departure?.pending) return false;
    player.departure.pending = false;
    player.llm = false;
    const from = player.region, exits = aiMovableFrom(mapName,from,player);
    const goals = player.mode === 'extract' ? GAME_DATA.maps?.[mapName]?.extractAreas || [] : aiMapAreas(mapName).filter(area=>area!==from && !player.visited?.includes(area));
    const route = aiRouteTo(mapName,from,goals,player);
    const next = route?.hop || exits[0];
    if (!next) return true;
    player.prev = from; player.region = next;
    player.mode = player.mode === 'extract' ? 'extract' : 'roam';
    player.crouched = false; player.soundWait = null; player.soundPursuit = null; player.ambushTargets = [];
    player.visited = [...new Set([...(player.visited || []),next])];
    player.lastAction = '前往'+next;
    player.departure.notice = {from,to:next};
    return true;
  };
  const hkm160PrepareSend = async (heal = false) => {
    let stat = await currentStat();
    if (hudReadOnly || !state.run || state.run.map !== stat.场景?.地图 || HkmLifecycle.dead(stat)) return stat;
    await hkm163EquipmentSync(stat);
    stat=await currentStat();
    await hkm098SyncPlayers(stat);
    stat = await currentStat();
    await hkm160IngestDeparture(stat);
    stat = await currentStat();
    const original = state.run, run = HkmLifecycle.copy(original), uses = useRecordsOf(state.usePending), log = {...asObject(state.insuranceLog)};
    const enemies = {...asObject(stat.敌人)};
    let enemiesChanged = false;
    state.run = run;
    try {
      hkm160Advance(run);
      for (const player of run.players || []) {
        if (player.alive === false || player.extracted || aiNum(player.hp,0)<=0) continue;
        if (hkm160DepartureStep(run.map,player)) {
          for (const [key,row] of Object.entries(enemies)) if (player.region !== stat.场景.区域 && (key === player.name || key === player.id || row?.名称 === player.name)) {delete enemies[key];enemiesChanged=true;}
        }
        const notice = player.departure?.notice;
        if (notice) {
          if (stat.场景.区域 === notice.from) log['player-leave:'+hkm098RunId(run)+':'+player.departure.source+':'+player.id] = '玩家'+player.name+' 移动到了 '+notice.to;
          delete player.departure.notice;
        }
      }
      if (heal && run.playerHealSendFloor !== hkmTurnOrigin) {
        run.playerHealSendFloor = hkmTurnOrigin;
        for (const player of run.players || []) {
          if (!player.llm || player.region !== stat.场景.区域 || player.alive === false || player.extracted || aiNum(player.hp,0)<=0 || !aiCanSee('hero',player)) continue;
          aiRecalcStats(player);
          const type = AI_TYPES[player.meta] || AI_TYPES['猛攻哥'], chart = type.judge[player.sub] || type.judge.跑刀 || type.judge['均衡'];
          const before = new Map((player.bag || []).map(row=>[row.id,aiBagCount(player,[row.id])]));
          if (!aiUseHeal(player,run.map,chart)) continue;
          const id = type.heals.find(id=>aiBagCount(player,[id]) < (before.get(id)||0));
          const item = itemById(id);
          uses.push({id:'AI-HEAL:'+hkm098RunId(run)+':'+hkmTurnOrigin+':'+player.id,text:'玩家'+player.name+'使用「'+textOf(item?.name,'治疗道具')+'」×1，血量恢复至'+player.hp+'/'+player.maxHp+'。',item:textOf(item?.name,''),useClass:'aiHeal',roundKey:hudRoundKey(),sent:false,undo:{}});
          const key = Object.keys(enemies).find(key=>key===player.name || key===player.id || enemies[key]?.名称===player.name);
          if (key) {enemies[key]=aiEnemyRecord(player);enemiesChanged=true;}
        }
      }
    } finally {state.run = original;}
    if (JSON.stringify(run)!==JSON.stringify(original) || JSON.stringify(log)!==JSON.stringify(state.insuranceLog) || enemiesChanged) {
      await hkm098Transact('player-send:'+hkm098RunId(run)+':'+hkmTurnOrigin+':'+run.playerDecisionTurn+':'+(heal?'heal':'move'),enemiesChanged?{敌人:enemies}:{},{run,usePending:uses,insuranceLog:log},'', '',1,stat);
    }
    return hkm163PrepareAiSkills(await currentStat());
  };

  const hkm140Offered = player => player?.tributeToHero === true || /向主角上供/.test(textOf(player?.lastAction, ''));
  const hkm140BagTarget = (id, stat, requireTag = true) => {
    const run = state.run, player = run?.players?.find(row => row.id === id);
    if (!run || run.map !== stat?.场景?.地图 || !player || player.alive === false || player.extracted || aiNum(player.hp, 0) <= 0 || player.region !== stat?.场景?.区域 || !hkm140Offered(player)) return null;
    if (requireTag && !hkm140LatestText()?.text.includes('<' + player.name + '的背包>')) return null;
    return player;
  };
  const hkm140IngestSpared = async stat => {
    const last = hkm140LatestText(), run = state.run;
    if (!last || !run || run.map !== stat?.场景?.地图) return false;
    const draft = HkmLifecycle.copy(run), changed = [];
    for (const player of draft.players || []) {
      if (player.meta !== '鼠鼠' || player.alive === false || player.extracted || aiNum(player.hp, 0) <= 0 || player.region !== stat.场景.区域 || hkm139Friendly(player)) continue;
      if (!last.text.includes('<放过' + player.name + '>')) continue;
      player.friendly = true;
      player.tags = [...new Set([...(Array.isArray(player.tags) ? player.tags : []), '友善'])];
      draft.truces = {...asObject(draft.truces), [[player.id, 'hero'].sort().join(':')]: true};
      changed.push(player);
    }
    if (!changed.length) return false;
    const enemies = {...asObject(stat.敌人)};
    for (const player of changed) {
      const key = Object.keys(enemies).find(key => key === player.id || key === player.name || enemies[key]?.名称 === player.name);
      if (key) enemies[key] = aiEnemyRecord(player);
    }
    await hkm098Transact('mouse-spared:' + hkm098RunId(run) + ':' + last.id + ':' + changed.map(player => player.id).join(','), {敌人: enemies}, {run: draft}, '', '', 1, stat);
    hkm098RefreshQueued = true;
    return true;
  };
  const hkm140BagSnapshot = pending => Object.fromEntries(Object.entries(asObject(pending)).filter(([, row]) => Object.values(asObject(row?.changes)).some(quantity => Number.isSafeInteger(quantity) && quantity !== 0)).map(([key,row]) => [key,HkmLifecycle.copy(row)]));
  const hkm140BagLines = pending => {
    const lines = [];
    for (const record of Object.values(hkm140BagSnapshot(pending))) {
      const incoming = [], outgoing = [];
      for (const [id, quantity] of Object.entries(asObject(record.changes))) {
        const item = itemById(id);
        if (!item) continue;
        (quantity > 0 ? incoming : outgoing).push('· ' + item.name + ' ×' + Math.abs(quantity));
      }
      if (!incoming.length && !outgoing.length) continue;
      lines.push(record.name + '的背包检查结果（以该玩家背包为准）：');
      if (incoming.length) lines.push('移入（来自主角背包）：', ...incoming);
      if (outgoing.length) lines.push('移出（进入主角背包）：', ...outgoing);
    }
    return lines;
  };
  const hkm140BagAcknowledge = (latest, snapshot) => {
    const pending = HkmLifecycle.copy(asObject(latest.playerBagPending));
    const acks = {...asObject(latest.playerBagAcks)};
    for (const [key, sent] of Object.entries(asObject(snapshot))) {
      const ack = key + ':' + (sent.revision || sent.rev);
      if (acks[ack]) continue;
      acks[ack] = true;
      const now = pending[key];
      if (!now) continue;
      if (JSON.stringify(now) === JSON.stringify(sent)) { delete pending[key]; continue; }
      const changes = {...asObject(now.changes)};
      for (const [id, quantity] of Object.entries(asObject(sent.changes))) {
        changes[id] = (Number(changes[id]) || 0) - quantity;
        if (!changes[id]) delete changes[id];
      }
      pending[key] = {...now,changes};
    }
    latest.playerBagPending = pending;
    latest.playerBagAcks = acks;
  };
  const hkm140Transfer = async (playerId, itemId, quantity, direction) => {
    hkm098RequireAlive();
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || !['in','out'].includes(direction)) throw Error('请输入有效数量。');
    const stat = await currentStat();
    hkm098RequireAlive();
    const player = hkm140BagTarget(playerId, stat), item = itemById(itemId);
    if (!player || !item) throw Error('当前无法检查该玩家的背包。');
    const run = HkmLifecycle.copy(state.run), target = run.players.find(row => row.id === playerId);
    const bag = HkmLifecycle.copy(asObject(stat.背包?.携带收藏品));
    if (!Array.isArray(target.bag)) target.bag = [];
    if (direction === 'out') {
      const rows = target.bag.filter(row => row.id === itemId);
      const available = rows.reduce((sum,row) => sum + Math.max(0,Math.floor(aiNum(row.quantity,0))),0);
      if (quantity > available) throw Error('对方背包中的数量不足。');
      let remaining = quantity;
      for (const row of rows) {
        const take = Math.min(remaining, row.quantity);
        if (!take) continue;
        const origin = HkmUpgrade.proof({...row,数量:row.quantity},take,run);
        aiGrantBucket(bag,item,take,origin);
        Object.assign(row,HkmUpgrade.take({...row,数量:row.quantity},take,run));
        row.quantity -= take;
        remaining -= take;
      }
      target.bag = target.bag.filter(row => row.quantity > 0);
    } else {
      const key = Object.keys(bag).find(key => (itemByName(bag[key]?.名称 || key)?.id) === itemId && aiNum(bag[key]?.数量,0) >= quantity);
      if (!key) throw Error('主角背包中的数量不足。');
      const origin = HkmUpgrade.proof(bag[key],quantity,run);
      const row = target.bag.find(row => row.id === itemId);
      if (row) {
        Object.assign(row,HkmUpgrade.merge({...row,数量:row.quantity},origin,row.quantity+quantity,run));
        row.quantity += quantity;
      } else target.bag.push({...aiBagEntry(item,quantity),...HkmUpgrade.merge(null,origin,quantity,run)});
      aiTakeBucket(bag,key,quantity);
    }
    aiRecalcStats(target);
    target.weight = aiPlayerWeight(target);
    const latest = readFrontendState(), pending = HkmLifecycle.copy(asObject(latest.playerBagPending));
    const key = hkm098RunId(run) + ':' + playerId, before = asObject(pending[key]);
    const changes = {...asObject(before.changes)};
    changes[itemId] = (Number(changes[itemId]) || 0) + (direction === 'in' ? quantity : -quantity);
    if (!changes[itemId]) delete changes[itemId];
    const transactionId = 'player-bag:' + Date.now() + ':' + (++hkm095QueueSerial);
    pending[key] = {runId:hkm098RunId(run),playerId,name:target.name,rev:aiNum(before.rev,0)+1,revision:transactionId,changes};
    const bagBox = {...asObject(stat.背包),携带收藏品:bag};
    await hkm098Transact(transactionId, {背包:bagBox,主角:hudBurdenPatch(stat,bagBox)}, {run,playerBagPending:pending}, '', '', 1, stat);
    await refresh();
    return true;
  };
  let hkm140BagId = '', hkm140BagFocus = null, hkm140BagBusy = false, hkm140BagSignature = '';
  let hkm140BagPortalStyle = null;
  const hkm140BagStyle = make('style','',`
    .hkm-player-bag-mask[hidden],.hkm-player-bag-entry[hidden]{display:none!important}.hkm-player-bag-mask{position:fixed;inset:0;z-index:105;background:#000b;display:grid;place-items:center;padding:12px}.hkm-player-bag-dialog{box-sizing:border-box;width:min(760px,100%);max-height:calc(100dvh - 24px);display:flex;flex-direction:column;border:1px solid #456474;border-radius:12px;background:#0b1821;color:#e7f7ff;font:13px/1.55 system-ui,"Microsoft YaHei",sans-serif}.hkm-player-bag-dialog *{box-sizing:border-box;min-width:0;overflow-wrap:anywhere}.hkm-player-bag-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;border-bottom:1px solid #29434f}.hkm-player-bag-head h2{font-size:17px;margin:0}.hkm-player-bag-body{overflow:auto;padding:14px;overscroll-behavior:contain}.hkm-player-bag-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.hkm-player-bag-card{padding:10px;margin:8px 0;border:1px solid #29434f;border-radius:8px}.hkm-player-bag-card p{margin:5px 0}.hkm-player-bag-controls{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.hkm-player-bag-dialog button,.hkm-player-bag-entry button{min-height:40px;padding:7px 10px;border:1px solid #456474;border-radius:7px;background:#122e3c;color:#e7f7ff;font:inherit;cursor:pointer}.hkm-player-bag-dialog input{width:76px;min-height:40px;border:1px solid #456474;border-radius:6px;background:#07131b;color:#e7f7ff;padding:7px;font:inherit}.hkm-player-bag-dialog button:focus-visible,.hkm-player-bag-dialog input:focus-visible{outline:2px solid #83e2c6;outline-offset:2px}.hkm-player-bag-dialog button:disabled{opacity:.45;cursor:default}.hkm-player-bag-note{white-space:pre-wrap;padding:10px 16px;margin:0;border-top:1px solid #29434f;color:#afccd7}.hkm-player-bag-note[data-error="true"]{color:#ffb7ba}.hkm-player-bag-entry{display:flex;gap:7px;flex-wrap:wrap}@media(max-width:600px){.hkm-player-bag-columns{grid-template-columns:1fr}}
  `);
  document.head.append(hkm140BagStyle);
  const hkm140BagEntries = make('div','hkm-player-bag-entry'); hkm140BagEntries.hidden = true; toolbar.append(hkm140BagEntries);
  const hkm140BagMask = make('div','hkm-player-bag-mask'); hkm140BagMask.hidden = true;
  const hkm140BagDialog = make('section','hkm-player-bag-dialog');
  hkm140BagDialog.setAttribute('role','dialog'); hkm140BagDialog.setAttribute('aria-modal','true'); hkm140BagDialog.setAttribute('aria-labelledby','hkm-player-bag-title');
  const hkm140BagHead = make('div','hkm-player-bag-head'), hkm140BagTitle = make('h2'); hkm140BagTitle.id = 'hkm-player-bag-title';
  const hkm140BagDone = make('button','','完成'); hkm140BagDone.type = 'button';
  hkm140BagHead.append(hkm140BagTitle,hkm140BagDone);
  const hkm140BagBody = make('div','hkm-player-bag-body'), hkm140BagNote = make('p','hkm-player-bag-note'); hkm140BagNote.setAttribute('aria-live','polite');
  hkm140BagDialog.append(hkm140BagHead,hkm140BagBody,hkm140BagNote); hkm140BagMask.append(hkm140BagDialog); hkmPortal.append(hkm140BagMask);
  const hkm140BagClose = () => { hkm140BagMask.hidden = true; hkm140BagId = ''; hkm140BagSignature = ''; hkm140BagPortalStyle?.remove(); hkm140BagPortalStyle = null; if (hkm140BagMask.ownerDocument !== document) hkmPortal.append(hkm140BagMask); if (hkm140BagFocus?.isConnected) hkm140BagFocus.focus(); hkm140BagFocus = null; };
  hkm140BagDone.addEventListener('click',hkm140BagClose);
  hkm140BagMask.addEventListener('click',event => { if (event.target === hkm140BagMask) hkm140BagClose(); });
  hkm140BagMask.addEventListener('keydown',event => {
    if (event.key === 'Escape') { event.preventDefault(); hkm140BagClose(); return; }
    if (event.key !== 'Tab') return;
    const controls = [...hkm140BagDialog.querySelectorAll('button:not(:disabled),input:not(:disabled)')];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && hkm140BagMask.ownerDocument.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && hkm140BagMask.ownerDocument.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  const hkm140BagRender = stat => {
    const player = hkm140BagTarget(hkm140BagId,stat);
    if (!player || hudReadOnly || hkmTurnLocked() || HkmLifecycle.dead(stat) || HkmSave.pending()) { hkm140BagClose(); return; }
    const signature = JSON.stringify([player.id,player.bag,stat.背包?.携带收藏品,state.playerBagPending,hkm140BagBusy]);
    if (signature === hkm140BagSignature) return;
    hkm140BagSignature = signature;
    hkm140BagTitle.textContent = player.name + '的背包';
    hkm140BagBody.replaceChildren();
    const columns = make('div','hkm-player-bag-columns');
    for (const direction of ['out','in']) {
      const side = make('section'); side.append(make('h3','',direction === 'out' ? player.name + '的背包' : hudPlayerName(stat) + '的背包'));
      const rows = direction === 'out' ? (player.bag || []).map(row=>({item:itemById(row.id),quantity:row.quantity})) : entriesOf(stat.背包?.携带收藏品).map(([key,row])=>({item:itemByName(row.名称 || key),quantity:row.数量}));
      const quantities = new Map();
      for (const row of rows) if (row.item && row.quantity > 0) { const old = quantities.get(row.item.id); quantities.set(row.item.id,{item:row.item,quantity:aiNum(old?.quantity,0)+Math.floor(row.quantity)}); }
      if (!quantities.size) side.append(make('p','hkm-reset-small','背包为空。'));
      for (const row of quantities.values()) {
        const card = make('div','hkm-player-bag-card'); card.append(make('strong','',row.item.name + ' ×' + row.quantity),make('p','hkm-reset-small',row.item.rarity + ' · 重量 ' + row.item.weight),make('p','hkm-reset-small',row.item.description));
        const controls = make('div','hkm-player-bag-controls'), label = make('label','','数量 '), count = make('input');
        count.type = 'number'; count.min = '1'; count.max = String(row.quantity); count.step = '1'; count.value = '1'; label.append(count);
        const transfer = make('button','',direction === 'out' ? '移入我的背包' : '放入对方背包'); transfer.type = 'button'; transfer.disabled = hkm140BagBusy;
        transfer.addEventListener('click',async()=>{
          if (hkm140BagBusy) return;
          hkm140BagBusy = true; transfer.disabled = true; hkm140BagNote.dataset.error = 'false';
          try { await hkm140Transfer(player.id,row.item.id,Number(count.value),direction); }
          catch (error) { hkm140BagNote.textContent = error.message; hkm140BagNote.dataset.error = 'true'; }
          finally { hkm140BagBusy = false; hkm140BagSignature = ''; if (!hkm140BagMask.hidden) { const failure = hkm140BagNote.dataset.error === 'true' ? hkm140BagNote.textContent : ''; hkm140BagRender(currentStatSnapshot || stat); if (failure) { hkm140BagNote.textContent = failure; hkm140BagNote.dataset.error = 'true'; } } }
        });
        controls.append(label,transfer); card.append(controls); side.append(card);
      }
      columns.append(side);
    }
    hkm140BagBody.append(columns);
    const record = asObject(state.playerBagPending)[hkm098RunId(state.run) + ':' + player.id];
    hkm140BagNote.dataset.error = 'false'; hkm140BagNote.textContent = hkm140BagLines(record ? {current:record} : {}).join('\n') || '选择数量，将物品在双方背包间转移。';
  };
  const hkm140BagOpen = (id, opener = null) => {
    if (!hkm140BagTarget(id,currentStatSnapshot) || hudReadOnly || !isLatestHudLayer() || hkmTurnLocked() || hkm098Busy || HkmLifecycle.dead(currentStatSnapshot) || HkmSave.pending()) return false;
    const targetDoc = opener?.ownerDocument?.body ? opener.ownerDocument : document;
    if (hkm140BagMask.hidden) hkm140BagFocus = opener || document.activeElement;
    if (hkm140BagMask.ownerDocument !== targetDoc) {
      hkm140BagPortalStyle?.remove(); hkm140BagPortalStyle = null;
      if (targetDoc !== document) {
        hkm140BagPortalStyle = hkm140BagStyle.cloneNode(true);
        hkm140BagPortalStyle.textContent += '\n.hkm-player-bag-mask{z-index:2147483001}';
        (targetDoc.head || targetDoc.body).append(hkm140BagPortalStyle);
      }
      hkmPortal.append(hkm140BagMask);
    }
    hkm140BagId = id; hkm140BagMask.hidden = false; hkm140BagRender(currentStatSnapshot); hkm140BagDone.focus(); return true;
  };
  root.__HKM_PLAYER_BAG = {
    open: (name, opener, messageId) => {
      if (!Number.isInteger(messageId) || messageId !== hkmTurnOrigin) return false;
      const players = aiAlive().filter(player => player.name === name && hkm140BagTarget(player.id,currentStatSnapshot));
      return players.length === 1 && hkm140BagOpen(players[0].id,opener);
    },
  };
  const hkm140BagSync = stat => {
    hkm140BagEntries.replaceChildren();
    const available = !hudReadOnly && !hkmTurnLocked() && !HkmLifecycle.dead(stat) && !HkmSave.pending() ? aiAlive().filter(player=>hkm140BagTarget(player.id,stat)) : [];
    hkm140BagEntries.hidden = !available.length;
    for (const player of available) {
      const button = make('button','',player.name + '的背包'); button.type = 'button'; button.addEventListener('click',()=>hkm140BagOpen(player.id)); hkm140BagEntries.append(button);
    }
    if (!hkm140BagMask.hidden) hkm140BagRender(stat);
  };
  disposers.push(()=>{hkm140BagClose();delete root.__HKM_PLAYER_BAG;hkm140BagMask.remove();hkm140BagStyle.remove();hkm140BagEntries.remove();});

  let aiTurnContext = null;




  const aiResolveTurn = (mapName, options = {}) => {
    const run = state.run;
    if (!run || run.map !== mapName) return { released: [], observed: [] };
    let area = textOf(options.area, '') || textOf(options.heroTo, '') || textOf(options.heroFrom, '');
    const turn = aiNum(run.soundTurn, 0) + 1;
    run.soundTurn = turn;
    hkm160Advance(run,options.decisionFloor ?? hkmTurnOrigin);
    aiTurnContext = {
      turn, sounds: [], soundLines: [], heroGifts: [], noticeRolls: {},
      heroNoticeChance: options.noticeMode === 'searching' ? 0.8 : options.noticeMode === 'combat' ? 0.5 : options.noticeMode === 'quiet' ? 0.2 : null,
      mode: textOf(options.mode, 'move'),
      heroFrom: textOf(options.heroFrom, ''),
      heroTo: textOf(options.heroTo, '') || area,
      stat: options.stat || null,
      heroTarget: textOf(options.heroTo, '') || area,
      heroMoving: ['move','extended_move'].includes(options.mode) && !!options.heroFrom && !!options.heroTo && options.heroFrom !== options.heroTo,
      heroMoveBlocked: false, crossed: new Set(), heroQuiet: options.quiet === true,
    };

    for (const player of aiAlive()) {
      const record = asObject(options.stat?.敌人)[player.name] || asObject(options.stat?.敌人)[player.id];
      if (hkm139Friendly(record)) player.friendly = true;
      aiRecalcStats(player);
      if (player.crouched === undefined) player.crouched = /原地蹲伏/.test(textOf(player.lastAction, ''));
      player.ambushTargets = (player.ambushTargets || []).filter(id => id === 'hero' ? player.region === area : aiAlive().some(other => other.id === id && other.region === player.region));
      delete player.soundReaction;
    }
    const heroCrouched = options.crouched === true || Object.entries(asObject(options.stat?.状态列表)).some(([name, row]) => /蹲伏/.test(name + ' ' + textOf(row?.名称, '')));
    const heroQuiet = options.quiet === true || options.mode === 'crouch' || ['use', 'action'].includes(options.mode) && heroCrouched;
    if (!HkmLifecycle.dead(asObject(options.stat))) aiEmitSound(mapName, 'hero', area, heroQuiet);
    const stayedOwned = new Set(aiAlive().filter(player => player.llm === true && textOf(player.region, '') === area && aiCanSee('hero', player)).map(player => textOf(player.name, '')));
    const acted = [];
    const actors = aiTurnContext.heroMoving ? aiAlive().slice().sort(aiMovementPriority)
      : options.passiveOnly ? aiAlive().slice().sort((left, right) => aiNum(right.speed, 0) - aiNum(left.speed, 0)) : aiAlive();
    for (const player of actors) {
      if (!player.alive || player.extracted || aiNum(player.hp, 0) <= 0) continue;
      const name = textOf(player.name, '');
      const from = textOf(player.region, '');
      aiTurnContext.player = player;
      const before = { prev: player.prev, visited: [...(player.visited || [])] };
      aiTurnContext.planningPlayer = aiTurnContext.heroMoving && !aiTurnContext.heroMoveBlocked && from === aiTurnContext.heroTarget;
      const departing = hkm160DepartureStep(mapName,player);
      if (!departing) {
        if (!stayedOwned.has(name)) options.passiveOnly ? aiStepExtendedMove(mapName, player) : aiStep(mapName, player);
        else hkm098OwnedStep(mapName, player, asObject(options.stat));
      }
      delete aiTurnContext.planningPlayer;
      aiResolveHeroCrossing(player, from, before);
      area = aiTurnContext.heroTo;
      if (departing) player.departedThisTurn = true;
      if(mapName==='魔鬼海' && player.alive && aiIsOxygenArea(mapName,player.region))player.water=player.waterCap;
      acted.push(player);
      const to = textOf(player.region, '');
      if (from !== to) {
        if (!Array.isArray(player.visited)) player.visited = [];
        if (!player.visited.includes(to)) player.visited.push(to);
        player.crouched = false;
        player.soundWait = null;
        aiMarkArrival(player.id, from, to);
        aiRecalcStats(player);
      }
      if (player.alive && !player.extracted) aiEmitSound(mapName, player.id, to, player.crouched === true);
      player.turnFrom = from;
    }
    if (aiTurnContext.heroMoving) aiMarkArrival('hero', aiTurnContext.heroFrom, area, options.quiet === true);
    for (const player of acted) {
      if (!player.alive || player.extracted || aiNum(player.hp, 0) <= 0 || player.region !== area
        || !aiTurnContext.crossed.has(player.id) && (stayedOwned.has(player.name) || !aiTurnContext.heroMoving && player.turnFrom === area)) continue;
      const from = player.region;
      aiTurnContext.player = player;
      aiHeroEncounter(mapName, player);
      if (from !== player.region) {
        aiMarkArrival(player.id, from, player.region);
        aiRecalcStats(player);
      }
    }
    for(const player of acted)if(player.equipmentSkillAction){player.lastAction=player.equipmentSkillAction;delete player.equipmentSkillAction;}
    state.aiLog = acted.filter(player => !player.departedThisTurn && (player.turnFrom !== area && player.region !== area || !player.crouched || aiCanSee('hero', player)))
      .flatMap(player => [...(player.soundReaction ? [player.soundReaction] : []), aiActionLine(player, player.turnFrom, player.region)]).slice(-40);

    delete aiTurnContext.player;
    const scavenged = aiScavengePatch(mapName, acted);

    if (!options.passiveOnly) aiNpcTurn(mapName, area, asObject(aiTurnContext?.stat));
    const released = aiReleaseToLlm(mapName, area);

    const observed = acted.filter(player=>!player.departedThisTurn && (!player.crouched || aiCanSee('hero',player))).map(player => ({
      name: textOf(player.name, ''),
      from: textOf(player.turnFrom, ''),
      to: textOf(player.region, ''),
    })).filter(row => row.name && row.from && row.to && row.from !== row.to && (row.from === area || row.to === area));
    const heroPatch = aiHeroGiftPatch(scavenged);
    if(aiTurnContext.equipmentHeroTouched)heroPatch.主角={...asObject(aiTurnContext.stat.主角),...asObject(heroPatch.主角)};
    const soundLines = [...aiTurnContext.soundLines, ...hkm139HeroSoundLines(mapName, area, aiTurnContext)];
    observed.push(...soundLines.map(soundLine => ({ soundLine })));
    if (soundLines.length && ['action', 'fishing'].includes(aiTurnContext.mode)) {
      state.insuranceLog = { ...asObject(state.insuranceLog), ['sound:' + textOf(run.startedAt, 'run') + ':' + turn]: soundLines.join('；') };
    }
    for (const player of acted) {
      delete player.departedThisTurn;
      delete player.lastHit;
      delete player.lastLoot;
      delete player.swapHold;
      delete player.standoff;
    }
    const heroMoveBlocked = aiTurnContext.heroMoveBlocked;
    aiTurnContext = null;
    saveFrontendState(state);
    return { released, observed, soundLines, scatter: scavenged, heroPatch, heroArea: area, heroMoveBlocked };
  };

  const aiScavengePatch = (mapName, players) => {
    const stat = asObject(aiTurnContext?.stat);
    let scatter = null;
    let boxesChanged = false;
    for (const player of Array.isArray(players) ? players : []) {
      const record = asObject(player.scavenged);
      for (const key of Array.isArray(record.taken) ? record.taken : []) {
        if (!scatter) scatter = { ...asObject(stat.散落物品) };
        delete scatter[key];
      }
      for (const put of Array.isArray(record.placed) ? record.placed : []) {
        if (!scatter) scatter = { ...asObject(stat.散落物品) };
        hudScatterMerge(scatter, mapName, textOf(player.region, ''), put.item, put.quantity);
      }
      if (record.boxes) boxesChanged = true;
      delete player.scavenged;
    }
    if (boxesChanged) saveFrontendState(state);
    return scatter;
  };

  const aiObservedLines = (observed, heroArea) => {
    const all = Array.isArray(observed) ? observed : [];
    const rows = all.filter(row => textOf(row?.name, '') && row.from && row.to && row.from !== row.to && (row.from === heroArea || row.to === heroArea));
    const sounds = all.map(row => textOf(row?.soundLine, '')).filter(Boolean);
    return [...(rows.length ? ['', '可见动向：', ...rows.map(row => '· ' + row.name + '：' + row.from + ' → ' + row.to + '。')] : []), ...sounds];
  };
  const aiReleaseToLlm = (mapName, area) => {
    const released = [];
    for (const player of aiAlive()) {
      const sameRegion = player.region === area && !player.departure?.pending;
      player.llm = sameRegion;
      if (sameRegion && aiCanSee('hero', player)) released.push(player);
      else player.llm = false;
    }
    state.run.registeredArea = area;
    return released;
  };



  const autoWriteState = {};
  const autoWriteAllowed = (key, signature) => {
    const entry = autoWriteState[key];
    if (entry && entry.signature === signature) {
      entry.repeats += 1;
      return entry.repeats <= 3;
    }
    autoWriteState[key] = { signature, repeats: 1 };
    return true;
  };
  const autoWriteSettle = key => { delete autoWriteState[key]; };
  const aiEnemyPatch = (mapName, area, stat) => {
    const next={};
    for(const player of aiAlive())if(player.region===area && aiCanSee('hero',player))next[player.name]=aiEnemyRecord(player);
    state.run.registered=Object.keys(next);
    return {敌人:{...next,...aiNpcEnemyRecords(mapName,area)}};
  };

  const aiEnsurePlayerRows = async (stat, mapName, area) => {
    const run = state.run;
    if (!run || run.map !== mapName) return false;
    const present = new Set(entriesOf(stat?.敌人).map(([, record]) => textOf(record?.名称 ?? record?.姓名, '')).filter(Boolean));
    const missing = aiAlive().filter(player => player.region === area && aiCanSee('hero', player) && !present.has(player.name));
    const hidden = entriesOf(stat?.敌人).filter(([key, record]) => aiAlive().some(player => (player.name === (record?.名称 || key) || player.id === key) && !aiCanSee('hero', player))).map(([key]) => key);
    if (!missing.length && !hidden.length) {
      autoWriteSettle('rows');
      return false;
    }
    if (!autoWriteAllowed('rows', [...missing.map(player => player.name + '@' + player.region), ...hidden.map(key => 'hide:' + key)].sort().join('|'))) return false;
    const enemies = { ...asObject(stat?.敌人) };
    for (const key of hidden) delete enemies[key];
    for (const player of missing) enemies[player.name] = aiEnemyRecord(player);
    await hudCommit({ 敌人: enemies });
    return true;
  };



  const mvuMessageId = () => {
    let id;
    try { if (typeof getCurrentMessageId === 'function') id = getCurrentMessageId(); } catch (_) {}
    if (!Number.isInteger(Number(id)) || id == null || id === '' || Number(id) < 0) {
      try { id = window.frameElement?.closest('.mes')?.getAttribute('mesid'); } catch (_) {}
    }
    if (id == null || id === '' || !Number.isInteger(Number(id)) || Number(id) < 0) throw Error('无法确定当前状态栏的消息楼层，停止变量写入。');
    return Number(id);
  };
  let hkm099WriteTail = Promise.resolve();
  const aiWriteVars = (patch, expected = null) => {
    const internal=hkm098Internal>0;
    const result=hkm099WriteTail.then(()=>hkm099WriteVarsBody(patch,expected,internal));
    hkm099WriteTail=result.catch(()=>{}); return result;
  };
  const hkm099WriteVarsBody = async (patch, expected, internal) => {
    hkm098AssertOwner();
    if (!internal && (hkm098Locked() || hkm098Busy)) return {ok:false,via:'death-locked'};
    const target=mvuMessageId(),scope={type:'message',message_id:target};
    const check=()=>{
      hkm098AssertOwner();
      if(mvuMessageId()!==target)throw Error('消息楼层已变化，停止写入。');
      if(!internal && (hkm098Locked() || hkm098Busy))throw Error('死亡或结算锁已生效，旧写入停止。');
    };
    const sources=[];
    if(typeof Mvu!=='undefined' && typeof Mvu?.getMvuData==='function' && typeof Mvu?.replaceMvuData==='function')sources.push({name:'Mvu',read:()=>Mvu.getMvuData(scope),write:data=>Mvu.replaceMvuData(data,scope)});
    if(typeof getVariables==='function' && typeof replaceVariables==='function')sources.push({name:'variables',read:()=>getVariables(scope),write:data=>replaceVariables(data,scope)});
    for(const source of sources){
      let next=null;
      try{
        const data=HkmLifecycle.copy(await source.read());check();
        if(!data?.stat_data)continue;
        const full=HkmStateBoundary.compose(data.stat_data,data.hkm_game_data || state.gameData,state);
        if(expected && JSON.stringify(full)!==JSON.stringify(expected)){hkm098RefreshQueued=true;return {ok:false,via:'stale-snapshot'};}
        next={...full,...HkmLifecycle.copy(patch)};
        data.hkm_game_data=HkmStateBoundary.migrate(next);
        data.stat_data=HkmStateBoundary.project(next,state);
        check();await source.write(data);check();
        state.gameData=HkmLifecycle.copy(data.hkm_game_data);saveFrontendState(state);
        hkm098RefreshQueued=true;return {ok:true,via:source.name};
      }catch(error){
        check();
        if(next)try{
          const reread=await source.read();check();
          if(JSON.stringify(reread?.hkm_game_data)===JSON.stringify(HkmStateBoundary.migrate(next)) && JSON.stringify(reread?.stat_data)===JSON.stringify(HkmStateBoundary.project(next,state))){
            state.gameData=HkmLifecycle.copy(reread.hkm_game_data);saveFrontendState(state);
            hkm098RefreshQueued=true;return {ok:true,via:source.name+'-readback'};
          }
        }catch(_){check();}
      }
    }
    return {ok:false,via:'none'};
  };
  const aiMoney = stat => aiNum(asObject(stat?.统计信息).哈基币, 0);

  const HUD_USE_EFFECTS = {
    "COL-0048": { kind: "friendlyGift", label: "赠送大厦原住民，40%概率获得本局友善" },
    "COL-0002": { kind: "heal", percent: 0.33, label: "恢复较少血量" },
    "COL-0005": { kind: "heal", percent: 0.13, label: "恢复少量血量" },
    "COL-0007": { kind: "heal", percent: 0.4, label: "恢复中等血量" },
    "COL-0008": { kind: "heal", percent: 0.5, label: "恢复一半血量" },
    "COL-0012": { kind: "weightShield", turns: 3, full: false, label: "三回合内免疫超重负面" },
    "COL-0013": { kind: "regen", turns: 3, percent: 0.15, label: "三回合内每回合恢复15%血量" },
    "COL-0020": { kind: "water", map: "魔鬼海", percent: 0.4, label: "恢复40%水下行动值" },
    "COL-0025": { kind: "freeRound", label: "下次行动不消耗交互轮数" },
    "COL-0027": { kind: "heal", percent: 0.8, label: "恢复大量血量" },
    "COL-0030": { kind: "weightShield", turns: 5, full: true, label: "五回合内免疫超重与完全超重负面" },
    "COL-0031": { kind: "regen", turns: 5, percent: 0.25, label: "五回合内每回合恢复25%血量" },
    "COL-0035": { kind: "heal", percent: 0.25, label: "恢复一定血量" },
    "COL-0095": { kind: "maxHp", delta: 1, label: "血量上限永久+1" },
    "COL-0126": { kind: "waterCap", map: "魔鬼海", delta: 2, turns: 24, label: "本局水下行动值上限+2" },
    "COL-0143": { kind: "water", map: "魔鬼海", percent: 1, label: "恢复全部水下行动值" },
    "COL-0148": { kind: "waterCap", map: "魔鬼海", delta: 4, turns: 15, label: "本局水下行动值上限+4" },
    "COL-0149": { kind: "cleanse", label: "消除催情类持续效果" },
    "COL-0154": { kind: "cleanse", label: "抑制触手相关效果" },
    "COL-0176": { kind: "cleanse", label: "抑制触手相关效果" },
    "COL-0183": { kind: "permAttrib", grant: { 血量上限: 5, 负重上限: 3 }, label: "血量上限永久+5、负重上限永久+3" },
    "COL-0225": { kind: "permAttrib", grant: { 额外水下行动值上限: 2 }, fishingPower: 4, label: "水下行动值上限永久+2、钓鱼力量永久+4" },
    "COL-0165": { kind: "gamble", label: "45%攻击力永久+1 / 50%当场死亡 / 5%全属性各自永久+1" },
  };
  const HUD_EFFECT_TEXT = new Set(['医疗用品', '消耗品', '食品饮料', '情趣用品', '渔获道具']);


  const hudToLlmItems = new Set(['COL-0129', 'COL-0175', 'COL-0166', 'COL-0032', 'COL-0193', 'COL-0182', 'COL-0050', 'COL-0144', 'COL-0067', 'COL-0092']);



  const HUD_SETTLED_KINDS = new Set(['heal', 'regen', 'weightShield', 'water', 'waterCap', 'cleanse', 'maxHp', 'freeRound', 'permAttrib', 'gamble', 'friendlyGift']);



  const HUD_USE_CLASS_OVERRIDE = { 'COL-0020': '氧气罐', 'COL-0143': '氧气罐' };
  const hudUseClass = item => {
    const id = textOf(item?.id, '');
    if (HUD_USE_CLASS_OVERRIDE[id]) return HUD_USE_CLASS_OVERRIDE[id];
    const parts = textOf(item?.category, '').split('/').map(part => part.trim()).filter(Boolean);
    if (parts.length >= 2) return parts.join('/');
    if (parts.length === 1 && parts[0] !== '消耗品') return parts[0];
    return textOf(item?.name, '未分类');
  };

  const hudRoundKey = () => {
    try {
      if (typeof getCurrentMessageId === 'function') {
        const id = getCurrentMessageId();
        if (id !== undefined && id !== null) return 'R' + String(id);
      }
    } catch (_) {}
    return 'R?';
  };
  const hudEffectSettledByFrontend = item => {
    const id = textOf(item?.id, '');
    const effect = HUD_USE_EFFECTS[id];
    return Boolean(effect) && HUD_SETTLED_KINDS.has(effect.kind) && !hudToLlmItems.has(id);
  };
  const hudIsContainerKey = id => Boolean(id) && (GAME_DATA.specialMechanics?.keyContainers || []).some(config => config.keyId === id);
  const hudIsBottle = id => Boolean(id) && GAME_DATA.specialMechanics?.monsterSea?.bottle?.itemId === id;

  const hudAskQuantity = options => {
    const max = Math.max(1, Math.round(aiNum(options?.max, 1)));
    const mask = hudPromptMask();
    const box = make('div', 'hkm-reset-prompt');
    box.append(make('div', 'hkm-reset-prompt-title', textOf(options?.title, '要开几个？')));
    const input = hkmCreateElement('input');
    input.type = 'number';
    input.min = '1';
    input.max = String(max);
    input.value = String(Math.min(max, Math.max(1, Math.round(aiNum(options?.initial, max)))));
    const row = make('div', 'hkm-reset-prompt-row');
    row.append(input, make('span', 'hkm-reset-small', '最多 ' + max + ' 个'));
    const actions = make('div', 'hkm-reset-prompt-actions');
    const cancel = make('button', 'hkm-reset-mini', '取消');
    const confirm = make('button', 'hkm-reset-mini', '确定');
    const close = () => mask.remove();
    cancel.addEventListener('click', close);
    mask.addEventListener('click', event => {
      if (event.target === mask) close();
    });
    confirm.addEventListener('click', () => {
      const value = Math.max(1, Math.min(max, Math.round(aiNum(input.value, 1))));
      close();
      if (typeof options?.onConfirm === 'function') options.onConfirm(value);
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') confirm.click();
      if (event.key === 'Escape') close();
    });
    actions.append(cancel, confirm);
    box.append(row, actions);
    mask.append(box);
    hkmPortal.append(mask);
    hkmOwnNodes(mask);
    input.focus();
    input.select();
  };
  const hudBucketKey = where => (where === '安全屋' ? '安全屋' : '背包');
  const hudBucketOf = (stat, where) => asObject(hudBucketKey(where) === '安全屋' ? stat?.安全屋?.收藏品 : stat?.背包?.携带收藏品);
  const hudBucketLabel = where => (hudBucketKey(where) === '安全屋' ? '安全屋' : '携带收藏品');
  const hudNotices = () => {
    if (!state.notices || !Array.isArray(state.notices.list)) state.notices = { list: [] };
    return state.notices;
  };
  const hudNotice = line => {
    const text = textOf(line, '');
    if (!text) return;
    const list = hudNotices().list;
    if (!list.includes(text)) list.push(text);
  };
  const HUD_STASH_RULES = {
    'COL-0024': { label: '贞操裤', verb: '塞入贞操裤', slots: 1, maxWeight: 3 },
    'COL-0153': { label: '蕾丝内内', verb: '塞入蕾丝内内', slots: 2, maxWeight: 2 },
    'COL-0184': { label: '四次元空间', verb: '塞进裙子底下', slots: 6, maxWeight: 8, totalWeight: 8 },
  };
  const hudEquippedWeight = stat => {
    let total = 0;
    for (const [, value] of entriesOf(stat?.装备)) {
      const name = textOf(value, '');
      if (!name || name === '无') continue;
      const item = itemByName(name);
      if (item) total += Math.max(0, aiNum(item.weight, 0));
    }
    for(const rod of Object.values(asObject(stat.渔具状态?.instances)))if(rod.where==='装备:特殊工具')for(const component of [rod.line,rod.hook])if(component)total+=Math.max(0,aiNum(itemById(component.itemId)?.weight,0));
    return Math.round(total * 100) / 100;
  };
  const hudStashOwner = stat => {
    const item = itemByName(textOf(stat?.装备?.内裤, ''));
    return item && HUD_STASH_RULES[item.id] ? { id: item.id, rule: HUD_STASH_RULES[item.id] } : null;
  };
  const hudStashNames = ownerId => {
    state.stash = asObject(state.stash);
    const list = state.stash[ownerId];
    return Array.isArray(list) ? list.map(entry => textOf(entry, '')).filter(Boolean) : [];
  };
  const hudWeightOf = stat => {
    const owner = hudStashOwner(stat);
    const hidden = new Set(owner ? hudStashNames(owner.id) : []);
    let total = 0;
    for (const [key, item] of entriesOf(stat?.背包?.携带收藏品)) {

      total += Math.max(0, aiNum(item?.重量, 0)) * Math.max(1, aiNum(item?.数量, 1));
    }
    for(const rod of Object.values(asObject(stat.渔具状态?.instances)))if(rod.where==='背包')for(const component of [rod.line,rod.hook])if(component)total+=Math.max(0,aiNum(itemById(component.itemId)?.weight,0));
    return Math.round((total + hudEquippedWeight(stat)) * 100) / 100;
  };

  const hudBurdenPatch = (stat, bagBox) => ({ ...asObject(stat?.主角), 当前负重: hudWeightOf({ ...asObject(stat), 背包: bagBox }) });



  const hudHiddenOf = stat => asObject(stat?.藏匿物);
  const hudHiddenEntry = (stat, name) => asObject(hudHiddenOf(stat)[name]);
  const hudHiddenNames = stat => Object.keys(hudHiddenOf(stat)).filter(name => textOf(asObject(hudHiddenOf(stat)[name]).名称, name) !== '无');
  const hudHiddenWeight = stat => Math.round((hudHiddenNames(stat).reduce((sum, name) => sum + Math.max(0, aiNum(hudHiddenEntry(stat, name).重量, 0)), 0) + Number.EPSILON) * 100) / 100;
  const hudHideItem = async (name, item, stat) => {
    const owner = hudStashOwner(stat);
    if (!owner) {
      setStatus('身上没有装备能藏东西的收藏品。');
      return;
    }
    const hidden = { ...hudHiddenOf(stat) };
    if (textOf(asObject(hidden[name]).名称, '')) {
      await hudUnhideItem(name, stat, '背包');
      return;
    }
    const bag = { ...hudBucketOf(stat, '背包') };
    const entry = Object.values(bag).find(row => textOf(row?.名称, '') === name) || null;
    if (!entry || Math.max(0, aiNum(entry?.数量, 0)) < 1) {
      setStatus('背包里没有「' + name + '」，没法藏。');
      return;
    }
    const weight = Math.max(0, aiNum(item?.weight ?? entry?.重量, 0));
    const names = hudHiddenNames(stat);
    const cap = aiNum(owner.rule.totalWeight, owner.rule.slots * owner.rule.maxWeight);
    if (names.length >= owner.rule.slots) {
      setStatus(owner.rule.label + '只有 ' + owner.rule.slots + ' 个槽位，已经满了。');
      return;
    }
    if (weight > owner.rule.maxWeight) {
      setStatus('「' + name + '」太重了，' + owner.rule.verb + '放不进去。');
      return;
    }
    if (Math.round((hudHiddenWeight(stat) + weight + Number.EPSILON) * 100) / 100 > cap) {
      setStatus(owner.rule.label + '的总重量上限是 ' + cap + '，放不下「' + name + '」。');
      return;
    }
    aiTakeBucket(bag, name, 1);
    hidden[name] = {
      名称: name,
      稀有度: textOf(item?.rarity ?? entry?.稀有度, '寻常'),
      数量: 1,
      价值: aiNum(item?.value ?? entry?.价值, 0),
      重量: weight,
      描述: textOf(item?.description ?? entry?.描述, ''),
      宿主: owner.id,
      ...hkm138Proof(entry,1),
    };
    const bagBox = { ...asObject(stat?.背包), 携带收藏品: bag };
    await hudCommit({ 背包: bagBox, 藏匿物: hidden, 主角: hudBurdenPatch(stat, bagBox) });
    queueItemMove(name, '背包', owner.rule.label);
    hudStashLogRecord(name, 'in');
    setStatus('已' + owner.rule.verb + '：' + name + ' ×1（每件最多藏 1 个，这个不计负重）');
  };
  const hudUnhideItem = async (name, stat, where = '背包') => {
    const hidden = { ...hudHiddenOf(stat) };
    const row = asObject(hidden[name]);
    if (!textOf(row.名称, '')) return;
    delete hidden[name];
    const item = itemByName(name) || { name, rarity: textOf(row.稀有度, '寻常'), value: aiNum(row.价值, 0), weight: aiNum(row.重量, 0), description: textOf(row.描述, '') };
    const toSafe = where === '安全屋' && !hudInMatch();
    const bag = { ...hudBucketOf(stat, '背包') };
    const safe = { ...asObject(stat?.安全屋?.收藏品) };
    if (toSafe) aiGrantBucket(safe, item, 1,row);
    else aiGrantBucket(bag, item, 1,row);
    const bagBox = { ...asObject(stat?.背包), 携带收藏品: bag };
    await hudCommit({
      背包: bagBox,
      安全屋: { ...asObject(stat?.安全屋), 收藏品: safe },
      藏匿物: hidden,
      主角: hudBurdenPatch(stat, bagBox),
    });
    queueItemMove(name, '藏匿物', toSafe ? '安全屋' : '背包');
    hudStashLogRecord(name, 'out');
    setStatus(toSafe ? '已把「' + name + '」从藏匿处移入安全屋。' : '已取出「' + name + '」×1（重新计入负重）。');
  };
  const hudUseHiddenItem = async (name, stat) => {

    await hudUnhideItem(name, stat, '背包');
    await hudUseItem(name, await currentStat());
  };
  const hudDiscardHiddenItem = async (name, stat) => {
    const hidden = { ...hudHiddenOf(stat) };
    const row = asObject(hidden[name]);
    if (!textOf(row.名称, '')) return;
    delete hidden[name];
    const mapName = textOf(stat?.场景?.地图, '');
    const area = textOf(stat?.场景?.区域, '');
    const item = itemByName(name) || { name, rarity: textOf(row.稀有度, '寻常'), value: aiNum(row.价值, 0), weight: aiNum(row.重量, 0), description: textOf(row.描述, '') };
    const scatter = hudScatterMerge({ ...asObject(stat?.散落物品) }, mapName, area, {...item,...hkm138Proof(row,1)}, 1);
    await hudCommit({ 藏匿物: hidden, 散落物品: scatter });
    hudStashLogRecord(name, 'out');
    setStatus('把藏着的「' + name + '」丢到了 ' + area + ' 的地上。');
  };

  const hudToggleStash = async (name, item, stat) => {
    if (textOf(hudHiddenEntry(stat, name).名称, '')) {
      await hudUnhideItem(name, stat, '背包');
      return;
    }
    await hudHideItem(name, item, stat);
  };

  const hudApplyWinPos = (node, key, fallback) => {
    const saved = asObject(asObject(state.winPos)[key]);
    node.style.left = textOf(saved.left, '') || fallback.left;
    node.style.top = textOf(saved.top, '') || fallback.top;
    node.style.right = 'auto';
    node.dataset.win = key;requestAnimationFrame(hkmClampWindows);
  };
  const hudMakeDraggable = (node, key) => {


    if (!node) return;
    const handle = node.querySelector('.hkm-reset-drag') || node.querySelector('.hkm-reset-stashwin-head') || node.querySelector('.hkm-reset-boxwin-head');
    if (!handle) return;
    if (handle.dataset.dragBound === 'true') return;
    handle.dataset.dragBound = 'true';
    let drag = null;
    handle.style.cursor = 'move';
    handle.addEventListener('pointerdown', event => {
      const target = event.target;
      if (target && typeof target.closest === 'function' && target.closest('button')) return;
      const rect = node.getBoundingClientRect();
      drag = { dx: Math.round(event.clientX - rect.left), dy: Math.round(event.clientY - rect.top) };
      try { handle.setPointerCapture(event.pointerId); } catch (_) {}
      event.preventDefault();
    });
    handle.addEventListener('pointermove', event => {
      if (!drag) return;
      const width = node.offsetWidth || 380;
      const maxLeft = Math.max(8,(window.innerWidth || 1200)-Math.min(width,(window.innerWidth || 1200)-16)-8);
      const maxTop = Math.max(0, (window.innerHeight || 800) - 40);
      const left = Math.max(0, Math.min(maxLeft, event.clientX - drag.dx));
      const top = Math.max(0, Math.min(maxTop, event.clientY - drag.dy));
      node.style.left = Math.round(left) + 'px';
      node.style.top = Math.round(top) + 'px';
      node.style.right = 'auto';
      void width;
    });
    const stop = () => {
      if (!drag) return;
      drag = null;
      state.winPos = { ...asObject(state.winPos), [key]: { left: node.style.left, top: node.style.top } };
      saveFrontendState(state);
    };
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
    handle.addEventListener('lostpointercapture', stop);
  };
  const hudDefaultWinPos = (index = 0) => ({
    left: Math.round(Math.max(12, (window.innerWidth || 1200) - 410)) + 'px',
    top: Math.round(70 + index * 26) + 'px',
  });
  const stashWindow = make('section', 'hkm-reset-stashwin');
  stashWindow.hidden = true;
  hudApplyWinPos(stashWindow, 'stash', hudDefaultWinPos(0));
  hkmPortal.append(stashWindow);
  hkmOwnNodes(stashWindow);
  const hudRenderStashWindow = stat => {
    const owner = hudStashOwner(stat || currentStatSnapshot || {});

    if (hudReadOnly || !owner) {
      stashWindow.hidden = true;
      return;
    }
    stashWindow.hidden = false;
    clear(stashWindow);
    const names = hudHiddenNames(stat);
    const cap = aiNum(owner.rule.totalWeight, owner.rule.slots * owner.rule.maxWeight);
    const head = make('div', 'hkm-reset-stashwin-head hkm-reset-drag');
    head.title = '按住这里可以拖动窗口（位置会记住）';
    head.append(make('h3', 'hkm-reset-stashwin-title', '藏匿物 · ' + owner.rule.label));
    head.append(make('span', 'hkm-reset-small', names.length + '/' + owner.rule.slots + ' 格 · ' + (Math.round(hudHiddenWeight(stat) * 100) / 100) + '/' + cap + ' 重量'));
    stashWindow.append(head);
    stashWindow.append(make('div', 'hkm-reset-small', '藏在这里的收藏品不计负重，也不会出现在携带收藏品里。'));
    if (!names.length) {
      stashWindow.append(empty('还没有藏东西：在携带收藏品里点「藏匿」放进来。'));
      return;
    }
    const grid = make('div', 'hkm-reset-tiles');
    for (const name of names) {
      const row = hudHiddenEntry(stat, name);
      const item = itemByName(name) || {
        name, rarity: textOf(row.稀有度, '寻常'), value: aiNum(row.价值, 0),
        weight: aiNum(row.重量, 0), description: textOf(row.描述, ''),
      };
      const rarity = textOf(item.rarity, '寻常');
      const tile = make('div', 'hkm-reset-tile');
      tile.style.borderLeftColor = hudTone(rarity);
      const gem = make('span', 'hkm-reset-tile-gem');
      gem.style.color = hudTone(rarity);
      const body = make('span', 'hkm-reset-tile-body');
      body.append(
        make('span', 'hkm-reset-tile-name', name),
        make('span', 'hkm-reset-tile-meta', '×1 · 价值 ' + textOf(item.value, '0') + ' · 重量 ' + textOf(item.weight, '0')),
      );
      const main = make('div', 'hkm-reset-tile-main');
      main.append(gem, body);
      tile.append(main);
      const actions = make('div', 'hkm-reset-card-actions');
      const act = (label, title, run) => {
        const button = make('button', 'hkm-reset-mini', label);
        button.type = 'button';
        button.title = title;
        button.addEventListener('click', hudAction(async () => {
          if (specialBusy) return;
          specialBusy = true;
          try { await run(await currentStat()); } finally { specialBusy = false; }
        }));
        actions.append(button);
      };
      act('使用', '取出 1 个并立刻使用（消耗品判定与使用记录照旧）', fresh => hudUseHiddenItem(name, fresh));
      act('取出', '回到携带收藏品，重新计入负重', fresh => hudUnhideItem(name, fresh, '背包'));
      act('丢弃', '丢到当前区域的地上（可在「当前区域散落」里捡回）', fresh => hudDiscardHiddenItem(name, fresh));
      if (!hudInMatch()) act('移入安全屋', '从藏匿处直接进安全屋（不计负重）', fresh => hudUnhideItem(name, fresh, '安全屋'));
      tile.append(actions);
      hudAttachItemPanel(tile, name, '收藏品', { where: '藏匿物', quantity: '1' }, { hover: true });
      grid.append(tile);
    }
    stashWindow.append(grid);
    hudMakeDraggable(stashWindow, 'stash');
  };



  const hudEvictStash = (stat, nextEquipment, bagBox) => {
    const before = hudStashOwner({ ...asObject(stat), 装备: asObject(stat?.装备) });
    const after = hudStashOwner({ ...asObject(stat), 装备: nextEquipment });
    if (!before) return null;
    if (after && textOf(after.id, '') === textOf(before.id, '')) return null;
    const hidden = { ...hudHiddenOf(stat) };
    const names = hudHiddenNames(stat).filter(name => {
      const host = textOf(hudHiddenEntry(stat, name).宿主, '');
      return !host || host === textOf(before.id, '');
    });
    if (!names.length) return null;
    const mapName = textOf(stat?.场景?.地图, '');
    const area = textOf(stat?.场景?.区域, '');
    let bag = { ...asObject(bagBox?.携带收藏品) };
    let scatter = { ...asObject(stat?.散落物品) };
    const limit = Math.max(1, aiNum(stat?.主角?.负重上限, 40));
    const report = { bag: [], ground: [] };
    const rows = names
      .map(name => ({ name, row: hudHiddenEntry(stat, name) }))
      .sort((left, right) => aiNum(right.row.价值, 0) - aiNum(left.row.价值, 0));
    for (const { name, row } of rows) {
      const item = itemByName(name) || {
        name, rarity: textOf(row.稀有度, '寻常'), value: aiNum(row.价值, 0),
        weight: aiNum(row.重量, 0), description: textOf(row.描述, ''),
      };
      delete hidden[name];
      const weightNow = hudWeightOf({ ...asObject(stat), 装备: nextEquipment, 背包: { ...asObject(bagBox), 携带收藏品: bag } });
      if (Math.round((weightNow + Math.max(0, aiNum(item.weight, 0)) + Number.EPSILON) * 100) / 100 <= limit) {
        aiGrantBucket(bag, item, 1,hkm138Proof(row,1));
        report.bag.push(name);
      } else {
        scatter = hudScatterMerge(scatter, mapName, area, {...item,...hkm138Proof(row,1)}, 1);
        report.ground.push(name);
      }
    }
    return { 藏匿物: hidden, 背包: { ...asObject(bagBox), 携带收藏品: bag }, 散落物品: scatter, report, owner: before.rule.label };
  };



  const hudStashLogOf = () => {
    const log = asObject(state.stashLog);
    return { in: Array.isArray(log.in) ? log.in.map(n => textOf(n, '')).filter(Boolean) : [], out: Array.isArray(log.out) ? log.out.map(n => textOf(n, '')).filter(Boolean) : [] };
  };
  const hudStashLogText = () => {
    const log = hudStashLogOf();
    const parts = [];
    if (log.in.length) parts.push('藏入：' + log.in.join('、'));
    if (log.out.length) parts.push('取出/吐出：' + log.out.join('、'));
    return parts.length ? '【藏匿】本轮' + parts.join('；') + '。' : '';
  };
  const hudStashLogSync = () => {
    if (!state.notices || !Array.isArray(state.notices.list)) state.notices = { list: [] };
    const kept = state.notices.list.filter(line => !String(line).startsWith('【藏匿】'));
    const line = hudStashLogText();
    state.notices.list = line ? kept.concat([line]) : kept;
  };
  const hudStashLogRecord = (name, direction) => {
    const item = textOf(name, '');
    if (!item) return;
    const log = hudStashLogOf();
    const other = direction === 'in' ? 'out' : 'in';

    if (log[other].includes(item)) log[other] = log[other].filter(row => row !== item);
    else if (!log[direction].includes(item)) log[direction].push(item);
    state.stashLog = log;
    saveFrontendState(state);
    hudStashLogSync();
  };
  const hudReportEvict = (evict, stat) => {
    const area = textOf(stat?.场景?.区域, '');
    const parts = [];
    if (evict.report.bag.length) parts.push('放回背包：' + evict.report.bag.join('、'));
    if (evict.report.ground.length) parts.push('背包塞不下，落到 ' + area + ' 地上：' + evict.report.ground.join('、'));
    for (const name of [...evict.report.bag, ...evict.report.ground]) hudStashLogRecord(name, 'out');
    const text = '【藏匿】' + evict.owner + '被卸下，藏匿物已取出（' + parts.join('；') + '）。';
    setStatus(text);
  };

  const hudMigrateStash = async stat => {
    if (state.stashMigrated) return false;

    const legacy = asObject(state.stash);
    const owners = Object.keys(legacy);
    if (!owners.length) { state.stashMigrated=true; saveFrontendState(state); return false; }
    const bag = { ...hudBucketOf(stat, '背包') };
    const hidden = { ...asObject(stat?.藏匿物) };
    let moved = 0;
    for (const ownerId of owners) {
      for (const name of (Array.isArray(legacy[ownerId]) ? legacy[ownerId] : []).map(entry => textOf(entry, '')).filter(Boolean)) {
        const entry = Object.values(bag).find(row => textOf(row?.名称, '') === name);
        if (!entry || textOf(asObject(hidden[name]).名称, '')) continue;
        aiTakeBucket(bag, name, 1);
        hidden[name] = {
          名称: name, 稀有度: textOf(entry.稀有度, '寻常'), 数量: 1,
          价值: aiNum(entry.价值, 0), 重量: aiNum(entry.重量, 0), 描述: textOf(entry.描述, ''), 宿主: ownerId,
        };
        moved += 1;
      }
    }
    if (!moved) { state.stash={}; state.stashMigrated=true; saveFrontendState(state); return false; }
    const bagBox = { ...asObject(stat?.背包), 携带收藏品: bag };
    await hkm098Transact('legacy-stash-migration',{背包:bagBox,藏匿物:hidden,主角:hudBurdenPatch(stat,bagBox)},{stash:{},stashMigrated:true},'旧版藏匿物已由前端迁入变量，不重复搬运。');
    return true;
  };

  const hudStoreEntries = async (stat, entries) => {
    const rows = (Array.isArray(entries) ? entries : []).filter(row => row && textOf(row.name, '') && aiNum(row.quantity, 0) > 0);
    if (!rows.length) return 0;
    const bag = { ...hudBucketOf(stat, '背包') };
    const stash = { ...asObject(asObject(stat?.安全屋).收藏品) };
    let moved = 0;
    for (const entry of rows) {
      const row = Object.values(bag).find(item => textOf(item?.名称, '') === entry.name);
      if (!row) continue;
      const have = Math.max(1, aiNum(row.数量, 1));
      const take = Math.min(have, Math.max(1, aiNum(entry.quantity, 1)));
      aiTakeBucket(bag, entry.name, take);
      const into = stash[entry.name] || { 名称: entry.name, 稀有度: textOf(row.稀有度, '寻常'), 数量: 0, 描述: textOf(row.描述, ''), 价值: aiNum(row.价值, 0), 重量: aiNum(row.重量, 0) };
      into.数量 = Math.max(0, aiNum(into.数量, 0)) + take;
      stash[entry.name] = into;
      moved += take;
      queueItemMove(entry.name, '背包', '安全屋');
    }
    if (!moved) return 0;
    const bagBox = { ...asObject(stat?.背包), 携带收藏品: bag };
    await hudCommit({ 背包: bagBox, 安全屋: { ...asObject(stat?.安全屋), 收藏品: stash }, 主角: hudBurdenPatch(stat, bagBox) });
    return moved;
  };

  const hudAssetsTotal = stat => {
    let total = 0;
    const addBucket = (rows,where) => {
      for (const row of Object.values(asObject(rows))) total += hudDurableValues(row,stat,where).reduce((sum,value)=>sum+value,0);
    };
    addBucket(hudBucketOf(stat, '背包'),'背包');
    addBucket(asObject(asObject(stat?.安全屋).收藏品),'安全屋');
    addBucket(hudHiddenOf(stat),'藏匿物');
    for(const [name,row]of Object.entries(hudKeychainOf()))total+=hudDurableUnitValue({...row,名称:name,数量:1},stat,'钥匙链');
    for(const rod of Object.values(asObject(stat?.渔具状态?.instances)))if(rod.line && !String(rod.where).startsWith('散落物品:')){
      const item=itemById(rod.line.itemId);total+=HkmFishing.durabilityValue(item,rod.line.durability,item?.fishingGear?.maxDurability);
    }
    for(const [id,quantity] of Object.entries(HkmHome.normalize(state.home).placed))total+=Math.max(0,aiNum(itemById(id)?.value,0))*quantity;
    for (const slot of AI_ALL_SLOTS) {
      const item = itemByName(textOf(asObject(stat?.装备)[slot], '无'));
      if (item) total += Math.max(0, aiNum(item.value, 0));
    }
    return Math.round(total * 100) / 100;
  };

  const hudSettleTotalAssets = async stat => {
    const next = hudAssetsTotal(stat);
    const current = aiNum(asObject(stat?.统计信息).总资产, 0);
    if (Math.abs(next - current) < 0.01) { autoWriteSettle('totalAssets'); return false; }
    if (!autoWriteAllowed('totalAssets', String(next))) return false;
    const result = await aiWriteVars({ 统计信息: { ...asObject(stat?.统计信息), 总资产: next } },stat);
    if (!result.ok) return false;
    autoWriteSettle('totalAssets');
    currentStatSnapshot = null;
    return true;
  };
  const hudBurdenState = stat => {
    const limit = Math.max(1, aiNum(stat?.主角?.负重上限, 40));
    const current = hudWeightOf(stat);
    const ratio = current / limit;
    const level = ratio >= 1.5 ? '完全超重' : ratio >= 1 ? '超重' : '正常';
    return { current, limit, ratio, level };
  };
  const HUD_BURDEN_NOTICE = '【负重提示】';
  const hudCheckBurden = stat => {
    const info = hudBurdenState(stat);


    const burdenLines = line => String(line).startsWith(HUD_BURDEN_NOTICE);
    const list = hudNotices().list.filter(line => !burdenLines(line));
    const line = info.level === '完全超重'
      ? HUD_BURDEN_NOTICE + '主角负重 ' + info.current + '/' + info.limit + '，处于完全超重状态（受伤+20%、造成伤害-20%，每轮固定额外消耗1轮）。'
      : (info.level === '超重'
        ? HUD_BURDEN_NOTICE + '主角负重 ' + info.current + '/' + info.limit + '，处于超重状态（受伤+10%、造成伤害-10%，每轮30%概率额外消耗1轮）。'
        : HUD_BURDEN_NOTICE + '主角负重 ' + info.current + '/' + info.limit + '，已恢复正常状态（超重惩罚解除）。');
    const level = info.level;


    if (level === textOf(state.burdenNotified, '')) {
      if (hudNotices().list.some(burdenLines)) state.notices.list = list.concat([line]);
      return info;
    }
    state.burdenNotified = level;
    state.notices.list = list.concat([line]);
    return info;
  };
  const hudCommit = async (patch, actionKind = '', actionId = '', after = {}) => {
    hkm098RequireAlive();
    if (hudReadOnly) {
      setStatus('这是旧楼层的状态栏，只能查看；操作请用最新一条消息里的状态栏。');
      return { ok: false, via: 'readonly' };
    }
    patch=hkmFishingPreparePatch(await currentStat(),patch);
    let result;
    if (actionKind) {
      const id = actionId || 'action:'+Date.now()+':'+(++hkm095QueueSerial);
      await hkm098Transact(id, patch, after, '', actionKind);
      result = { ok: true, via: 'transaction', actionId: id };
    } else result = await aiWriteVars(patch);
    if (result.ok) {
      currentStatSnapshot = null;
      await refresh();


      if (!currentStatSnapshot) await refresh();
    } else {
      throw Error('变量写入失败，本次操作未完成；请检查变量接口后重试。');
    }
    return result;
  };
  const hudWeightOfBucket = bucket => {
    let total = 0;
    for (const [, item] of entriesOf(bucket)) {
      total += Math.max(0, aiNum(item?.重量, 0)) * Math.max(1, aiNum(item?.数量, 1));
    }
    return Math.round(total * 100) / 100;
  };
  const hudGrantWhere = (mapName, fallback = '背包') => (textOf(mapName, '') === '哈基米空间' ? '安全屋' : fallback);
  const hudExchangePatch = (stat, costs = [], results = [], where = '背包', consumeWhere = '背包') => {
    const patch = {}, buckets = {};
    const bucketFor = location => { const key=hudBucketKey(location); return buckets[key] ||= HkmLifecycle.copy(hudBucketOf(stat,location)); };
    for (const cost of costs.filter(row=>row?.name)) {
      const quantity = Math.max(1,aiNum(cost.quantity,1));
      if (aiTakeBucket(bucketFor(consumeWhere),cost.name,quantity) < quantity) throw Error('消耗品不足：'+cost.name+'；本次未扣除任何物品。');
    }
    for (const row of results.filter(row=>row?.item)) aiGrantBucket(bucketFor(where),row.item,row.quantity,row.origin);
    for (const [key,bucket] of Object.entries(buckets)) {
      if (key === '安全屋') patch.安全屋 = {...asObject(stat.安全屋),收藏品:bucket};
      else {
        patch.背包 = {...asObject(stat.背包),携带收藏品:bucket};
        patch.主角 = {...asObject(stat.主角),当前负重:Math.round((hudWeightOfBucket(bucket)+hudEquippedWeight(stat))*100)/100};
      }
    }
    return patch;
  };
  const hudExchangeResults = async (stat,costs,results,where = '背包') => {
    const patch = hudExchangePatch(stat,costs,results,where);
    return Object.keys(patch).length ? hudCommit(patch) : {ok:true,via:'noop'};
  };
  const hudGrantResults = (stat,results,where = '背包') => hudExchangeResults(stat,[],results,where);
  const hudConsumeResults = async (stat,costs,where = '背包') => {
    const patch=hudExchangePatch(stat,costs,[],where,where);
    return Object.keys(patch).length ? hudCommit(patch) : {ok:true,via:'noop'};
  };
  const hudStatusList = stat => ({ ...asObject(stat?.状态列表) });
  const hudUseItem = async (name, stat) => {
    const bucket = hudBucketOf(stat, '背包');
    const entry = Object.values(bucket).find(item => textOf(item?.名称, '') === name);
    if (!entry) return;
    const item = itemByName(name) || { name, rarity: textOf(entry?.稀有度, '寻常'), category: '', value: aiNum(entry?.价值, 0), weight: aiNum(entry?.重量, 0), description: textOf(entry?.描述, '') };
    const bottleConfig = GAME_DATA.specialMechanics?.monsterSea?.bottle;
    if (item.id && bottleConfig?.itemId === item.id) {
      const owned = Math.max(0, Math.round(aiNum(entry?.数量, 1)));
      const max = Math.max(1, Math.min(Math.round(aiNum(bottleConfig?.maxPerAction, 5)) || 5, owned));
      if (owned <= 1) {
        await useBottles(1, stat);
        return;
      }
      hudAskQuantity({
        title: '要开几个' + item.name + '？',
        max,
        initial: max,
        onConfirm: count => {
          useBottles(count, stat).catch(error => setStatus('漂流瓶开启失败：' + (error?.message || error)));
        },
      });
      return;
    }
    const container = (GAME_DATA.specialMechanics?.keyContainers || []).find(config => config.keyId === item.id);
    if (container) {
      if (state.specials['container:' + container.id]) {
        setStatus(container.label + '本局已经开启过了。');
        return;
      }
      const scene = asObject(stat?.场景);
      if (textOf(scene.地图, '') !== container.map || textOf(scene.区域, '') !== container.area) {
        setStatus(container.label + '需要抵达 ' + container.map + ' / ' + container.area + ' 才能开启。');
        return;
      }
      await openKeyContainer(container, stat);
      return;
    }
    const effect = HUD_USE_EFFECTS[item.id] || { kind: 'llm', label: '交由系统判定效果' };

    const effectLimit = HUD_ITEM_LIMITS[item.id];
    if (effectLimit && aiNum(effectLimit.maxUses, 0) > 0 && hudItemCounter(item.id).uses >= aiNum(effectLimit.maxUses, 0)) {
      setStatus('「' + name + '」的生效次数已用满（' + aiNum(effectLimit.maxUses, 0) + ' 次），不能再使用。');
      return;
    }
    const mapName = textOf(stat?.场景?.地图, '');
    const hero = asObject(stat?.主角);
    if (effect.kind === 'friendlyGift' && (mapName !== '谷歌大厦' || state.run?.map !== mapName || !aiNpcsAlive().some(npc => npc.region === stat.场景?.区域 && npc.faction === '大厦'))) {
      setStatus('请在谷歌大厦有原住民的区域赠送幸运苹果。');
      return;
    }

    const useClass = hudUseClass(item);
    const roundKey = hudRoundKey();
    const sameClass = useRecordsOf(state.usePending)
      .find(record => record.useClass === useClass && (!record.roundKey || record.roundKey === roundKey));
    if (sameClass) {
      setStatus('本轮已经用过同类的「' + textOf(sameClass.item, '消耗品') + '」：同类消耗品一轮只能用一次，可以先在浮窗里撤回它。');
      return;
    }
    const patch = {};
    const undo = {};
    const reusable = hudReusableToy(item);
    let waterBuff=null, friendlyRun=null;
    const after = { ...bucket };

    if (!reusable) {
      aiTakeBucket(after, name, 1);
      patch.背包 = { ...asObject(stat?.背包), 携带收藏品: after };
    }
    const lines = [];
    if (effect.kind === 'friendlyGift') {
      const counter = hudItemCounter(item.id);
      const roll = counter.appleRound === roundKey && counter.appleRoll != null ? aiNum(counter.appleRoll, 1) : Math.random();
      undo.appleRoll = roll;
      undo.appleNpcTags = Object.fromEntries(state.run.npcs.filter(npc => npc.faction === '大厦').map(npc => [npc.id, npc.tags == null ? null : HkmLifecycle.copy(npc.tags)]));
      const success = roll < 0.4;
      if (success) {
        const nextRun = HkmLifecycle.copy(state.run);
        for (const npc of nextRun.npcs) if (npc.faction === '大厦') npc.tags = [...new Set([...(Array.isArray(npc.tags) ? npc.tags : []), '友善'])];
        friendlyRun = nextRun;
        patch.敌人 = Object.fromEntries(entriesOf(stat.敌人).map(([key,row]) => {
          const npc = nextRun.npcs.find(npc => npc.id === row.ID || npc.name === (row.名称 || key));
          return [key, npc?.faction === '大厦' ? aiNpcRecord(npc) : row];
        }));
        for (const npc of nextRun.npcs) if (npc.faction === '大厦' && npc.region === stat.场景?.区域 && npc.hp > 0) patch.敌人[npc.name] = aiNpcRecord(npc);
      }
      lines.push('将幸运苹果赠送给谷歌大厦原住民，' + (success ? '成功获得本局友善；大厦原住民标记为友善，本局双方不能主动攻击对方。' : '未获得友善。'));
    } else if (effect.kind === 'heal') {
      const maxHp = Math.max(1, aiNum(hero.血量上限, 1));
      const healed = Math.max(1, Math.ceil(Math.round(maxHp * effect.percent)*(HkmEquipment.has(hkm163HeroUnit(stat),'seaBlessing')?1.25:1)));
      const now = Math.min(maxHp, aiNum(hero.当前血量, 0) + healed);
      patch.主角 = { ...hero, 当前血量: now };
      undo.hp = -(now - aiNum(hero.当前血量, 0));
      lines.push('使用' + name + '：恢复' + healed + '点血量，当前血量 ' + now + '/' + maxHp + '。');
    } else if (effect.kind === 'regen') {
      const status = hudStatusList(stat);
      status['恢复-' + name] = { 名称: name + '·持续恢复', 持续时间: effect.turns + '轮', 描述: effect.label, 效果: '每轮恢复' + Math.round(effect.percent * 100) + '%血量上限' };
      undo.statusKeys = ['恢复-' + name];
      patch.状态列表 = status;
      lines.push('使用' + name + '：' + effect.label + '。');
    } else if (effect.kind === 'weightShield') {
      const status = hudStatusList(stat);
      status['负重-' + name] = { 名称: name + '·负重免疫', 持续时间: effect.turns + '轮', 描述: effect.label, 效果: effect.full ? '免疫超重与完全超重负面' : '免疫超重负面' };
      undo.statusKeys = ['负重-' + name];
      patch.状态列表 = status;
      lines.push('使用' + name + '：' + effect.label + '。');
    } else if (effect.kind === 'water') {
      if(mapName!==effect.map){setStatus('该物品只能在'+effect.map+'使用。');return;}
      const cap=HkmSea.cap(stat),before=aiNum(stat.场景?.剩余水下行动值,0),now=HkmSea.refill(before,cap,effect.percent);
      patch.场景={...asObject(stat.场景),剩余水下行动值:String(now)};
      undo.water=-(now-before);

      lines.push('使用'+name+'：'+effect.label+'，当前水下行动值 '+now+'/'+cap+'。');
    } else if (effect.kind === 'waterCap') {
      if(mapName!==effect.map || !aiIsOxygenArea(mapName,stat.场景?.区域)){setStatus('请在魔鬼海的有氧区域使用。');return;}
      const status=hudStatusList(stat);
      status['上限-'+name]={名称:name+'·水下行动值上限',持续时间:effect.turns+'轮',描述:effect.label,效果:'本局水下行动值上限+'+aiNum(effect.delta,0)};
      undo.statusKeys=['上限-'+name];patch.状态列表=status;
      waterBuff={name,expiresAt:hudDialogueCount()+effect.turns};
      lines.push('使用'+name+'：'+effect.label+'，当前水下行动值上限 '+HkmSea.cap({...stat,状态列表:status})+'。');
    } else if (effect.kind === 'cleanse') {
      const status = hudStatusList(stat);
      const removedKeys = {};
      let removed = 0;
      for (const key of Object.keys(status)) {
        if (/催情|发情|敏感|触手寄生|寄生/.test(textOf(status[key]?.名称, '') + textOf(status[key]?.描述, ''))) {
          removedKeys[key] = status[key];
          delete status[key];
          removed += 1;
        }
      }
      undo.statusRestore = removedKeys;
      patch.状态列表 = status;
      lines.push('使用' + name + '：' + effect.label + '，解除' + removed + '项持续效果。');
    } else if (effect.kind === 'maxHp') {
      const delta = Math.max(1, Math.round(aiNum(effect.delta, 1)));

      const baseBox = { ...hudHeroBaseOf(hero, hudGearBonus(asObject(stat?.装备))) };
      baseBox.血量上限 = Math.max(1, aiNum(baseBox.血量上限, 20) + delta);
      patch.主角 = hudHeroWithBase(stat, baseBox, asObject(stat?.装备));
      undo.maxHp = -delta;
      lines.push('使用' + name + '：血量上限永久+' + delta + '，现在 ' + String(Math.max(1, aiNum(hero.血量上限, 1) + delta)) + '。');
    } else if (effect.kind === 'freeRound') {
      const status = hudStatusList(stat);
      status['免轮-' + name] = { 名称: name + '·免轮', 持续时间: '1次行动', 描述: effect.label, 效果: '下一次行动不消耗交互轮数' };
      undo.statusKeys = ['免轮-' + name];
      patch.状态列表 = status;
      lines.push('使用' + name + '：' + effect.label + '。');
    } else if (effect.kind === 'permAttrib') {
      const granted = hudGrantBase(stat, effect.grant);
      Object.assign(patch, granted.patch);
      undo.baseDeltas = granted.deltasApplied;
      if(effect.fishingPower){patch.主角={...hero,...asObject(patch.主角),额外钓鱼力量:aiNum(hero.额外钓鱼力量,0)+effect.fishingPower};undo.fishingPower=effect.fishingPower;}
      lines.push('使用' + name + '：' + textOf(effect.label, '永久属性提升') + '（' + granted.applied.join('、') + '）。' + hudDialogueTag());
    } else if (effect.kind === 'gamble') {

      const counter = hudItemCounter(item.id);
      const roll = counter.gambleRound === roundKey && counter.gambleRoll !== null ? counter.gambleRoll : Math.random();
      undo.gambleRoll = roll;
      if (roll < 0.45) {
        const granted = hudGrantBase(stat, { 攻击力: 1 });
        Object.assign(patch, granted.patch);
        undo.baseDeltas = granted.deltasApplied;
        lines.push('使用' + name + '：判定值 ' + roll.toFixed(3) + '（<0.45）—— 攻击力永久+1。' + hudDialogueTag());
      } else if (roll < 0.95) {
        patch.主角 = { ...hero, 当前血量: 0 };
        undo.hp = aiNum(hero.当前血量, 0);
        lines.push('使用' + name + '：判定值 ' + roll.toFixed(3) + '（0.45–0.95）—— 当场死亡，当前血量归零。' + hudDialogueTag());
      } else {
        const granted = hudGrantBase(stat, { 攻击力: 1, 防御力: 1, 血量上限: 1, 速度: 1, 负重上限: 1 });
        Object.assign(patch, granted.patch);
        undo.baseDeltas = granted.deltasApplied;
        lines.push('使用' + name + '：判定值 ' + roll.toFixed(3) + '（≥0.95）—— 全属性各自永久+1（' + granted.applied.join('、') + '）。' + hudDialogueTag());
      }
    } else {
      lines.push('使用' + name + '：' + textOf(item.description, '') + '。');
      const attached = modelEffectLines(item);
      if (attached.length) lines.push(...attached);
    }
    const counters = { ...asObject(state.itemCounters) };
    if (effectLimit && aiNum(effectLimit.maxUses, 0) > 0) {
      const counter = hudItemCounter(item.id);
      counters[item.id] = { ...counter, uses: counter.uses + 1 };
      lines.push('（本件累计生效 ' + (counter.uses + 1) + '/' + aiNum(effectLimit.maxUses, 0) + ' 次）');
      undo.itemUse = item.id;
    }
    if (effect.kind === 'friendlyGift') counters[item.id] = { ...hudItemCounter(item.id), appleRound: roundKey, appleRoll: undo.appleRoll };
    if (effect.kind === 'gamble') counters[item.id] = { ...hudItemCounter(item.id), ...asObject(counters[item.id]), gambleRound: roundKey, gambleRoll: undo.gambleRoll };
    const actionId = 'use:'+Date.now()+':'+(++hkm095QueueSerial);
    undo.actionId = actionId;
    const settled = hudEffectSettledByFrontend(item);
    const recordLines = [hudPlayerName(stat)+'选择使用'+name+'：'+textOf(item.description, '')]
      .concat(modelEffectLines(item))
      .concat([reusable ? '可重复使用，数量不变。' : '已消耗一件。']);
    const record = { id: 'USE-'+actionId, text: settled ? hudPlayerName(stat)+'选择'+lines.join('') : recordLines.join('；'), item: name, useClass, roundKey, sent: false, undo: settled ? undo : { actionId } };
    const afterState = { usePending: useRecordsOf(state.usePending).concat(record), itemCounters: counters };
    if (friendlyRun) afterState.run = friendlyRun;
    if (waterBuff && state.run) afterState.run = { ...HkmLifecycle.copy(state.run), waterBuffs: { ...asObject(state.run.waterBuffs), [waterBuff.name]: { expiresAt: waterBuff.expiresAt } } };
    if (undo.water !== undefined && state.run) afterState.run = { ...HkmLifecycle.copy(state.run), ...asObject(afterState.run), water: aiNum(patch.场景?.剩余水下行动值, 0) };
    hkm098RequireAlive();
    await hkm098Transact(actionId, patch, afterState, '', 'use');
    currentStatSnapshot = null;
    await refresh();
    hudCheckBurden(currentStatSnapshot || stat);
    setStatus(settled ? '已使用「' + name + '」：' + lines.join('') : '已使用「' + name + '」：下次行动时生效，行动前可撤回。');
    renderUsedPanel();
  };


  const hudUseUndoOf = record => {
    if (record?.useClass === 'activeSkill') return null;
    const undo = { ...asObject(record?.undo) };
    const item = itemByName(record?.item), effect = HUD_USE_EFFECTS[item?.id];
    if (effect?.kind === 'permAttrib' && !undo.baseDeltas) undo.baseDeltas = { ...asObject(effect.grant) };
    if (effect?.kind === 'gamble' && undo.gambleRoll === undefined) return null;
    return undo;
  };
  const hudUndoUseRecord = async (id, stat) => {
    const list = useRecordsOf(state.usePending);
    const record = list.find(row => row.id === id);
    if (!record) return;
    if (record.sent) {
      setStatus('「' + textOf(record.item, '该消耗品') + '」已经生效，不能再撤回。');
      return;
    }
    const undo = hudUseUndoOf(record);
    if (!undo) { setStatus('该随机判定缺少撤回数据，无法撤回。'); return; }
    const patch = {}, afterState = {};
    const counters = { ...asObject(state.itemCounters) };
    const hero = { ...asObject(stat?.主角) };
    if (undo.appleNpcTags && state.run) {
      afterState.run = HkmLifecycle.copy(state.run);
      for (const npc of afterState.run.npcs) if (Object.hasOwn(undo.appleNpcTags, npc.id)) {
        if (undo.appleNpcTags[npc.id] == null) delete npc.tags;
        else npc.tags = HkmLifecycle.copy(undo.appleNpcTags[npc.id]);
      }
      patch.敌人 = Object.fromEntries(entriesOf(stat.敌人).map(([key,row]) => {
        const npc = afterState.run.npcs.find(npc => npc.id === row.ID || npc.name === (row.名称 || key));
        if (npc?.faction !== '大厦') return [key,row];
        return [key,aiNpcRecord(npc)];
      }));
    }
    if (aiNum(undo.hp, 0)) hero.当前血量 = Math.max(0, aiNum(hero.当前血量, 0) + aiNum(undo.hp, 0));
    const baseDeltas = { ...asObject(undo.baseDeltas) };
    if (aiNum(undo.maxHp, 0)) baseDeltas.血量上限 = aiNum(baseDeltas.血量上限, 0) - aiNum(undo.maxHp, 0);
    if (Object.keys(baseDeltas).length) {
      const baseBox = { ...hudHeroBaseOf(hero, hudGearBonus(asObject(stat?.装备))) };
      for (const key of HUD_CORE_BASE_KEYS) {
        if (!aiNum(baseDeltas[key], 0)) continue;
        baseBox[key] = Math.max(key === '血量上限' || key === '负重上限' ? 1 : 0, aiNum(baseBox[key], HUD_BASE_DEFAULTS[key]) - aiNum(baseDeltas[key], 0));
      }
      Object.assign(hero, hudHeroWithBase({ ...stat, 主角: hero }, baseBox, asObject(stat?.装备)));
    }
    if(undo.fishingPower)hero.额外钓鱼力量=Math.max(0,aiNum(hero.额外钓鱼力量,0)-aiNum(undo.fishingPower,0));
    hero.当前血量 = Math.min(Math.max(1, aiNum(hero.血量上限, 1)), Math.max(0, aiNum(hero.当前血量, 0)));
    if (aiNum(undo.water,0)) {
      const scene={...asObject(stat.场景)};
      scene.剩余水下行动值=String(Math.min(HkmSea.cap(stat),Math.max(0,aiNum(scene.剩余水下行动值,0)+aiNum(undo.water,0))));
      patch.场景=scene;
      if(state.run)afterState.run={...HkmLifecycle.copy(state.run),water:aiNum(scene.剩余水下行动值,0)};
    }
    const undoItem = textOf(undo.itemUse, '');
    if (undoItem) {
      const counter = hudItemCounter(undoItem);
      if (counter.uses > 0) counters[undoItem] = { ...counter, uses: counter.uses - 1 };
    }
    afterState.itemCounters = counters;
    const keys = Array.isArray(undo.statusKeys) ? undo.statusKeys.map(key => textOf(key, '')).filter(Boolean) : [];
    const restore = asObject(undo.statusRestore);
    if (keys.length || Object.keys(restore).length) {
      const status = hudStatusList(stat);
      for (const key of keys) delete status[key];
      for (const [key, value] of Object.entries(restore)) status[key] = value;
      patch.状态列表 = status;
    }
    const bucket = { ...hudBucketOf(stat, '背包') };

    const refund = itemByName(record.item) || { name: record.item, rarity: '寻常', value: 0, weight: 0, description: '' };
    if (!hudReusableToy(refund)) aiGrantBucket(bucket, refund, 1);
    const bagBox = { ...asObject(stat?.背包), 携带收藏品: bucket };
    patch.背包 = bagBox;
    patch.主角 = { ...hero, 当前负重: hudWeightOf({ ...asObject(stat), 背包: bagBox }) };
    const penalty = hkmActionPenaltyOf(state.actionPenalty);
    if (textOf(undo.actionId, '')) delete penalty.events[undo.actionId];
    afterState.actionPenalty = penalty;
    afterState.usePending = list.filter(row => row.id !== id);
    await hkm098Transact('undo-use:'+record.id, patch, afterState);
    await refresh();
    setStatus('已撤回「' + textOf(record.item, '消耗品') + '」的使用' + (hudReusableToy(refund) ? '（本就是可复用的，数量没有变动）' : '，物品已放回背包') + '，数值改回使用前。');
    renderUsedPanel();
  };

  const usedPanel = make('section', 'hkm-reset-used');
  usedPanel.hidden = true;
  hkmPortal.append(usedPanel);
  hkmOwnNodes(usedPanel);
  const renderUsedPanel = () => {
    clear(usedPanel);
    if (hudReadOnly) { usedPanel.hidden = true; return; }
    const roundKey = hudRoundKey();
    const rows = useRecordsOf(state.usePending).filter(record => record.useClass !== 'activeSkill' && (!record.roundKey || record.roundKey === roundKey));
    if (!rows.length) { usedPanel.hidden = true; return; }
    usedPanel.hidden = false;
    usedPanel.append(make('div', 'hkm-reset-used-title', '本轮已使用（同类一轮只能用一个）'));
    for (const record of rows) {
      const row = make('div', 'hkm-reset-used-row');
      row.append(make('span', 'hkm-reset-used-name', textOf(record.item, record.text)));
      if (record.sent) row.append(make('span', 'hkm-reset-used-tag', '已生效'));
      if (!record.sent && !hudUseUndoOf(record)) row.append(make('span', 'hkm-reset-used-tag', '不可撤回'));
      if (!record.sent && hudUseUndoOf(record)) {
        const back = make('button', 'hkm-reset-mini', '撤回');
        back.type = 'button';
        back.title = '把数值改回使用前，并把物品放回背包';
        back.addEventListener('click', hudAction(async () => {
          if (specialBusy) return;
          specialBusy = true;
          try {
            await hudUndoUseRecord(record.id, await currentStat());
          } finally {
            specialBusy = false;
          }
        }));
        row.append(back);
      }
      usedPanel.append(row);
    }
  };
  const hudDiscardItem = async (name, stat) => {
    const after = { ...hudBucketOf(stat, '背包') };
    const item = itemByName(name) || Object.values(after).find(row => textOf(row?.名称, '') === name) || { name, value: 0, weight: 0, description: '' };
    const origin=hkm138Proof(after[name],1);
    const taken = aiTakeBucket(after, name, 1);
    if (!taken) return;
    const mapName = textOf(stat?.场景?.地图, '');
    const area = textOf(stat?.场景?.区域, '');

    const scatter = hudScatterOf(stat, mapName, area, { name, rarity: textOf(item?.rarity ?? item?.稀有度, '寻常'), value: aiNum(item?.价值 ?? item?.value, 0), weight: aiNum(item?.重量 ?? item?.weight, 0), description: textOf(item?.描述 ?? item?.description, ''),...origin }, 1);
    const bagBox = { ...asObject(stat?.背包), 携带收藏品: after };
    await hudCommit({ 背包: bagBox, 散落物品: scatter, 主角: hudBurdenPatch(stat, bagBox) });
    queueItemMove(name, '背包', '丢弃（地上）');
    setStatus('已丢掉 1 个「' + name + '」，它落在 ' + area + ' 的地上（可在「当前区域散落」里捡回来）。');
  };

  const hudInMatch = () => textOf(GAME_DATA.maps?.[currentContext?.mapName]?.kind, '') === 'mission';
  const hudBagEntryToItem = (name, entry) => {
    const source = itemByName(name);
    if (source) return { name: source.name, rarity: source.rarity, value: source.value, weight: source.weight, description: source.description };
    return {
      name,
      rarity: textOf(entry?.稀有度, '寻常'),
      value: aiNum(entry?.价值, 0),
      weight: aiNum(entry?.重量, 0),
      description: textOf(entry?.描述, ''),
    };
  };









  const HUD_BASE_DEFAULTS = { 攻击力: 6, 防御力: 0, 血量上限: 20, 速度: 10, 负重上限: 40, 额外水下行动值上限: 0 };
  const HUD_PERCENT_KEYS = ['攻击力', '防御力', '血量上限', '速度'];


  const hudTempBonusOf = actor => {
    const temp = asObject(asObject(actor)?.临时加成);
    const flat = { 攻击力: 0, 防御力: 0, 血量上限: 0, 速度: 0, 负重上限: 0, 额外水下行动值上限: 0 };
    const percent = { 攻击力: 0, 防御力: 0, 血量上限: 0, 速度: 0 };
    for (const key of Object.keys(flat)) flat[key] = aiNum(asObject(temp.固定)[key], 0);
    for (const key of Object.keys(percent)) {
      const raw = aiNum(asObject(temp.百分比)[key], 0);
      percent[key] = raw !== 0 && Math.abs(raw) < 1 ? raw : raw / 100;
    }
    return { flat, percent };
  };


  const hudCalibrateBase = (actor, gear) => {
    const base = { 已校准: '是' };
    for (const key of ['攻击力', '防御力', '血量上限', '速度']) {
      const current = aiNum(actor?.[key], HUD_BASE_DEFAULTS[key]);

      const flat = aiNum(gear.flat[key], 0);
      const ratio = 1 + aiNum(gear.percent[key], 0);
      const exact = ratio > 0 ? (current - flat) / ratio : current;
      let picked = Math.round(exact * 100) / 100;
      for (let delta = 0; delta <= 4; delta += 1) {
        const around = delta === 0 ? [Math.round(exact)] : [Math.round(exact) - delta, Math.round(exact) + delta];
        const hit = around.find(candidate => Math.round((candidate + flat) * ratio) === current);
        if (hit !== undefined) {
          picked = hit;
          break;
        }
      }
      base[key] = picked;
    }
    base.负重上限 = aiNum(actor?.负重上限, HUD_BASE_DEFAULTS.负重上限) - aiNum(gear.flat.负重上限, 0);
    base.额外水下行动值上限 = Math.max(0, aiNum(actor?.额外水下行动值上限, 0) - aiNum(gear.extraCap, 0));
    return base;
  };

  const hudHeroBaseOf = (actor, gear) => {
    const raw = asObject(actor?.基础属性);
    const keys = Object.keys(HUD_BASE_DEFAULTS);
    const filled = keys.every(key => raw[key] !== undefined && raw[key] !== null && textOf(raw[key], '') !== '');
    if (textOf(raw.已校准, '') === '是' && filled) {
      const base = { 已校准: '是' };
      for (const key of keys) base[key] = aiNum(raw[key], HUD_BASE_DEFAULTS[key]);
      return base;
    }
    return hudCalibrateBase(actor, gear);
  };

  const hudHeroWithBase = (stat, nextBase, nextEquipment, nextBag = null) => {
    const actor = { ...asObject(stat?.主角), 基础属性: nextBase };
    return hudHeroStats({ ...asObject(stat), 主角: actor }, nextEquipment || asObject(stat?.装备), nextBag);
  };
  const hudHeroStats = (stat, nextEquipment, nextBag = null) => {
    const actor = asObject(stat?.主角);


    const current = hudGearBonus(asObject(stat?.装备),hudGearContext(stat));
    const gear = hudGearBonus(nextEquipment,hudGearContext(stat));
    const temp = hudTempBonusOf(actor);
    const facilities = HkmFacilities.bonuses(stat, GAME_DATA.maps);
    const calibratedGear = {...current,flat:{...current.flat,血量上限:aiNum(current.flat.血量上限,0)+facilities.血量上限,速度:aiNum(current.flat.速度,0)+facilities.速度,负重上限:aiNum(current.flat.负重上限,0)+facilities.负重上限},extraCap:aiNum(current.extraCap,0)+facilities.额外水下行动值上限};
    const base = hudHeroBaseOf(actor, calibratedGear);
    const next = { ...actor, 基础属性: base, 临时加成: asObject(actor.临时加成) };
    for (const key of HUD_PERCENT_KEYS) {
      const value = Math.round((aiNum(base[key], HUD_BASE_DEFAULTS[key]) + aiNum(gear.flat[key], 0) + aiNum(temp.flat[key], 0) + aiNum(facilities[key], 0))
        * (1 + aiNum(gear.percent[key], 0) + aiNum(temp.percent[key], 0)));

      next[key] = key === '血量上限' ? Math.max(1, value) : Math.max(0, value);
    }
    next.负重上限 = Math.max(1, Math.round(aiNum(base.负重上限, HUD_BASE_DEFAULTS.负重上限)
      + aiNum(gear.flat.负重上限, 0) + aiNum(temp.flat.负重上限, 0) + facilities.负重上限));
    next.额外水下行动值上限 = Math.max(0, Math.round(aiNum(base.额外水下行动值上限, 0)
      + aiNum(gear.extraCap, 0) + aiNum(temp.flat.额外水下行动值上限, 0) + facilities.额外水下行动值上限));
    const conditional=HkmEquipment.virginDefense(hkm163HeroUnit({...stat,装备:nextEquipment}));
    next.防御力+=conditional;
    next.水下行动值上限=HkmSea.cap({...stat,主角:next});
    next.当前血量 = Math.min(Math.max(0, aiNum(actor.当前血量, next.血量上限)), next.血量上限);
    next.当前负重 = hudWeightOf({ ...asObject(stat), 背包: nextBag || asObject(stat?.背包), 装备: nextEquipment });
    return next;
  };


  const hudSettleHeroStats = async stat => {
    if (hudReadOnly) return false;
    const actor = asObject(stat?.主角);
    const gear = hudGearBonus(asObject(stat?.装备),hudGearContext(stat));
    const temp = hudTempBonusOf(actor);
    const base = hudHeroBaseOf(actor, gear);
    const hero = hudHeroStats(stat, asObject(stat?.装备));
    const calibrated = textOf(asObject(actor.基础属性).已校准, '') === '是';
    const drift = [...Object.keys(HUD_BASE_DEFAULTS),'水下行动值上限'].some(key => aiNum(actor[key], 0) !== aiNum(hero[key], 0));
    if (calibrated && !drift) return false;
    if (!autoWriteAllowed('heroStats', JSON.stringify([base, Object.keys(HUD_BASE_DEFAULTS).map(key => aiNum(hero[key], 0))]))) return false;
    const result=await aiWriteVars({主角:hero},stat);
    if (!result.ok) return false;
    currentStatSnapshot=null; return true;
  };
  const hudStatDeltaText = (beforeStat, afterActor) => {
    const before = asObject(beforeStat?.主角);
    const parts = [];
    for (const key of ['攻击力', '防御力', '速度', '血量上限', '负重上限', '额外水下行动值上限']) {
      const from = aiNum(before[key], 0);
      const to = aiNum(afterActor?.[key], 0);
      if (from !== to) parts.push(key + ' ' + from + '→' + to);
    }
    return parts.join('、');
  };





  const hudLocationOf = where => textOf(where, '背包');
  const queueItemMove = (name, from, to) => {
    const item = textOf(name, '');
    if (!item) return;
    const moves = asObject(state.itemMoves);
    const current = asObject(moves[item]);
    moves[item] = {
      start: current.start ? current.start : hudLocationOf(from),
      from: hudLocationOf(from),
      to: hudLocationOf(to),
    };
    state.itemMoves = moves;
    saveFrontendState(state);
  };
  const itemMovesOf = value => asObject(value);

  const queueUseRecord = entry => {
    const value = typeof entry === 'string' ? { text: entry } : asObject(entry);
    const line = textOf(value.text, '').trim();
    if (!line) return;
    const list = useRecordsOf(state.usePending);
    if (list.some(record => record.text === line)) { state.usePending = list; return; }
    list.push({
      id: 'USE-' + Date.now() + '-' + (list.length + 1),
      text: line,
      item: textOf(value.item, ''),
      useClass: textOf(value.useClass, ''),
      roundKey: hudRoundKey(),
      sent: false,
      undo: asObject(value.undo),
    });
    state.usePending = list;
    saveFrontendState(state);
  };

  const pruneUseRecords = () => {
    const roundKey = hudRoundKey();
    const list = useRecordsOf(state.usePending);
    const kept = list.filter(record => !record.roundKey || record.roundKey === roundKey);
    if (kept.length !== list.length) {
      state.usePending = kept;
      saveFrontendState(state);
    }
    return kept;
  };


  const hudGearName = value => {
    const raw = textOf(value, '').trim();
    if (!raw || raw === '无') return '无';
    return itemLookupName(raw) || raw;
  };
  const hudSameGear = (left, right) => hudGearName(left) === hudGearName(right);
  const queueGearChange = (slot, currentValue, stat) => {
    const pending = gearPendingOf(state.gearPending);
    const origin = pending[slot] ? pending[slot].原始 : (textOf(asObject(stat?.装备)[slot], '无') || '无');

    if (hudSameGear(currentValue, origin)) delete pending[slot];
    else pending[slot] = { 部位: slot, 当前: hudGearName(currentValue), 原始: hudGearName(origin) };
    state.gearPending = pending;
    saveFrontendState(state);
  };
  const hudEquipItem = async (name, stat) => {
    if(itemByName(name)?.id==='COL-0159' && stat.主角?.性别!=='女性'){setStatus('比基尼仅女性主角可装备。');return;}
    if(itemByName(name)?.fishingGear?.type==='rod')return hkmFishingEquip(name,stat);
    const slot = aiSlotOf(itemByName(name));
    if (!slot) {
      setStatus('「' + name + '」不是武器装备类收藏品，没有可装备的部位。');
      return;
    }
    const bag = { ...hudBucketOf(stat, '背包') };
    const entry = Object.values(bag).find(row => textOf(row?.名称, '') === name);
    if (!entry) {
      setStatus('背包里找不到「' + name + '」。');
      return;
    }
    const equipment = { ...asObject(stat?.装备) };
    const previous = textOf(equipment[slot], '无');
    if (hudSameGear(previous, name)) {

      if (previous !== name) {
        equipment[slot] = name;
        await hudCommit({ 装备: equipment, 主角: hudHeroStats({ ...asObject(stat), 装备: { ...asObject(stat?.装备), [slot]: previous } }, equipment, asObject(stat?.背包)) });
        setStatus('「' + hudSlotLabel(slot) + '」上的「' + name + '」只是标注了稀有度，已把标注去掉，其他没有改动。');
        return;
      }
      setStatus('「' + name + '」已经装备在「' + hudSlotLabel(slot) + '」上。');
      return;
    }
    const upgradeGear=HkmLifecycle.copy(asObject(state.upgradeGear)),origin=hkm138Proof(entry,1);
    const taken = aiTakeBucket(bag, name, 1);
    if (!taken) return;
    equipment[slot] = name;
    if (previous && previous !== '无') aiGrantBucket(bag, hudBagEntryToItem(previous, null), 1,upgradeGear[slot]?.名称===hudGearName(previous)?upgradeGear[slot]:null);
    upgradeGear[slot]={名称:name,...origin};
    const bagBox = { ...asObject(stat?.背包), 携带收藏品: bag };
    let hero = hudHeroStats(stat, equipment, bagBox);

    const evict = hudEvictStash(stat, equipment, bagBox);
    if (evict) hero = hudHeroStats(stat, equipment, evict.背包);
    await hudCommit(Object.assign({ 背包: bagBox, 装备: equipment, 主角: hero }, evict ? { 背包: evict.背包, 藏匿物: evict.藏匿物, 散落物品: evict.散落物品 } : {}), 'gear','',{upgradeGear});
    if (evict) hudReportEvict(evict, stat);
    queueGearChange(slot, name, stat);
    const delta = hudStatDeltaText(stat, hero);
    setStatus('已装备「' + name + '」到「' + hudSlotLabel(slot) + '」' + (previous && previous !== '无' ? '，换下的「' + previous + '」已放回背包' : '') + (delta ? '；' + delta : '') + '。');
  };
  const hudUnequipItem = async (slot, stat) => {
    const equipment = { ...asObject(stat?.装备) };
    const name = textOf(equipment[slot], '无');
    if (!name || !hudGearName(name) || hudGearName(name) === '无') {
      setStatus('「' + hudSlotLabel(slot) + '」上当前没有装备。');
      return;
    }
    const bag = { ...hudBucketOf(stat, '背包') };
    const upgradeGear=HkmLifecycle.copy(asObject(state.upgradeGear));
    aiGrantBucket(bag, hudBagEntryToItem(name, null), 1,upgradeGear[slot]?.名称===hudGearName(name)?upgradeGear[slot]:null);
    delete upgradeGear[slot];
    equipment[slot] = '无';
    const bagBox = { ...asObject(stat?.背包), 携带收藏品: bag };
    let hero = hudHeroStats(stat, equipment, bagBox);

    const evict = hudEvictStash(stat, equipment, bagBox);
    if (evict) hero = hudHeroStats(stat, equipment, evict.背包);
    await hudCommit(Object.assign({ 背包: bagBox, 装备: equipment, 主角: hero }, evict ? { 背包: evict.背包, 藏匿物: evict.藏匿物, 散落物品: evict.散落物品 } : {}), 'gear','',{upgradeGear});
    if (evict) hudReportEvict(evict, stat);
    queueGearChange(slot, '无', stat);
    const delta = hudStatDeltaText(stat, hero);
    setStatus('已卸下「' + name + '」，放回背包' + (delta ? '；' + delta : '') + '。');
  };


  const hudTransferItem = async (name, stat, toBag = false) => {
    const fromKey = toBag ? '安全屋' : '背包';
    const toKey = toBag ? '背包' : '安全屋';
    const source = { ...hudBucketOf(stat, fromKey) };
    const entry = Object.values(source).find(row => textOf(row?.名称, '') === name);
    if (!entry) {
      setStatus(hudBucketLabel(fromKey) + '里没有「' + name + '」，本次搬运没有执行。');
      return;
    }
    const taken = aiTakeBucket(source, name, 1);
    if (!taken) return;
    const target = { ...hudBucketOf(stat, toKey) };
    aiGrantBucket(target, { name, rarity: textOf(entry.稀有度, '寻常'), value: aiNum(entry.价值, 0), weight: aiNum(entry.重量, 0), description: textOf(entry.描述, '') }, taken,hkm138Proof(entry,taken));
    const bag = toKey === '背包' ? target : source;
    const bagBox = { ...asObject(stat?.背包), 携带收藏品: bag };
    await hudCommit({
      背包: bagBox,
      安全屋: { ...asObject(stat?.安全屋), 收藏品: toKey === '安全屋' ? target : source },
      主角: hudBurdenPatch(stat, bagBox),
    });
    setStatus('已把「' + name + '」' + (toBag ? '从安全屋取出，加入携带收藏品，负重已重新计算。' : '送入安全屋。'));
  };


  const hudSellItem = async (name, stat, where = '背包') => {
    return hudSellEntries(stat,[{name,quantity:1}],where);
  };
  const hudAttachItemButtons = (card, item, name, where) => {
    const actions = make('div', 'hkm-reset-card-actions');
    if (where === '散落') {
      const pickup = make('button', 'hkm-reset-mini', '拾取');
      pickup.type = 'button';
      pickup.disabled = hudLootLocked(currentStatSnapshot) || hudReadOnly;
      pickup.title = hudLootLocked(currentStatSnapshot) ? HUD_LOOT_LOCK_NOTE : '捡回背包并重新计算负重（不消耗交互轮数）';
      pickup.addEventListener('click', hudAction(async () => {
        if (specialBusy) return;
        specialBusy = true;
        try { await hudPickScatter(hudScatterKey(textOf(currentStatSnapshot?.场景?.地图, ''), textOf(currentStatSnapshot?.场景?.区域, ''), name), await currentStat()); } finally { specialBusy = false; }
      }));
      actions.append(pickup);
      card.append(actions);
      return;
    }
    if(item?.id==='COL-0245' && where==='背包')actions.append(hkm138Button());
    const effect = HUD_USE_EFFECTS[item?.id] || null;
    const usable = where === '背包' && (effect || hudToLlmItems.has(item?.id) || hudIsContainerKey(item?.id) || hudIsBottle(item?.id) || HUD_EFFECT_TEXT.has(textOf(item?.category, '').split('/')[0]) || textOf(item?.category, '').includes('消耗品'));
    if (usable) {
      const use = make('button', 'hkm-reset-mini', '使用');
      use.type = 'button';
      use.addEventListener('click', hudAction(async () => {
        if (specialBusy) return;
        specialBusy = true;
        try {
          const stat = await currentStat();
          await hudUseItem(name, stat);
        } finally {
          specialBusy = false;
        }
      }));
      actions.append(use);
    }
    if(item.fishingGear?.type==='rod' && ['背包','安全屋'].includes(where) && !hudReadOnly){
      const mod=make('button','hkm-reset-mini','装配');mod.addEventListener('click',hudAction(()=>hkmFishingOpenMods(name,where)));actions.append(mod);
    }
    if (where === '背包') {
      const equipSlot = aiSlotOf(item);
      if (equipSlot) {
        const equip = make('button', 'hkm-reset-mini', '装备');
        equip.type = 'button';
        equip.title = '装备到「' + hudSlotLabel(equipSlot) + '」；该部位原有装备会自动放回背包';
        equip.addEventListener('click', hudAction(async () => {
          if (specialBusy) return;
          specialBusy = true;
          try {
            await hudEquipItem(name, await currentStat());
          } finally {
            specialBusy = false;
          }
        }));
        actions.append(equip);
      }
      const hideOwner = hudStashOwner(currentStatSnapshot || {});
      if (hideOwner && aiNum(item?.weight, 0) <= hideOwner.rule.maxWeight) {
        const hidden = hudHiddenNames(currentStatSnapshot || {}).includes(name);
        const hide = make('button', 'hkm-reset-mini', hidden ? '取出' : '藏匿');
        hide.type = 'button';
        hide.title = hidden
          ? '从' + hideOwner.rule.label + '里取出 1 个，重新计入负重'
          : hideOwner.rule.verb + '：每件最多藏 1 个（共 ' + hideOwner.rule.slots + ' 格 / 单件≤' + hideOwner.rule.maxWeight
            + ' / 总重≤' + aiNum(hideOwner.rule.totalWeight, hideOwner.rule.slots * hideOwner.rule.maxWeight) + '），藏起来的那个不计负重';
        hide.addEventListener('click', hudAction(async () => {
          if (specialBusy) return;
          specialBusy = true;
          try {
            await hudToggleStash(name, item, await currentStat());
          } finally {
            specialBusy = false;
          }
        }));
        actions.append(hide);
      }
      if (!hudInMatch()) {
        const stash = make('button', 'hkm-reset-mini', '入安全屋');
        stash.type = 'button';
        stash.addEventListener('click', hudAction(async () => {
          if (specialBusy) return;
          specialBusy = true;
          try {
            await hudTransferItem(name, await currentStat());
          } finally {
            specialBusy = false;
          }
        }));
        actions.append(stash);
        const sell = make('button', 'hkm-reset-mini', '售出');
        sell.type = 'button';
        sell.title = '打开出售确认窗：可以改数量，点「确认售出」才真的卖';
        sell.addEventListener('click', hudAction(async () => {
          if (specialBusy) return;
          specialBusy = true;
          try {
            hudOpenSellConfirm(name, '背包', await currentStat());

            hudCloseItemPanel();
          } finally {
            specialBusy = false;
          }
        }));
        actions.append(sell);
      }
      const drop = make('button', 'hkm-reset-mini', '丢弃');
      drop.type = 'button';
      drop.addEventListener('click', hudAction(async () => {
        if (specialBusy) return;
        specialBusy = true;
        try {
          await hudDiscardItem(name, await currentStat());
        } finally {
          specialBusy = false;
        }
      }));
      actions.append(drop);
    } else if (!hudInMatch()) {

      const carry = make('button', 'hkm-reset-mini', '携带');
      carry.type = 'button';
      carry.title = '把「' + name + '」从安全屋取出，放进携带收藏品并重新计入负重';
      carry.addEventListener('click', hudAction(async () => {
        if (specialBusy) return;
        specialBusy = true;
        try {
          await hudTransferItem(name, await currentStat(), true);
        } finally {
          specialBusy = false;
        }
      }));
      actions.append(carry);
      const sell = make('button', 'hkm-reset-mini', '售出');
      sell.type = 'button';
      sell.title = '打开出售确认窗（安全屋）：可以改数量，点「确认售出」才真的卖';
      sell.addEventListener('click', hudAction(async () => {
        if (specialBusy) return;
        specialBusy = true;
        try {
          hudOpenSellConfirm(name, '安全屋', await currentStat());
        } finally {
          specialBusy = false;
        }
      }));
      actions.append(sell);
    }
    if (actions.childNodes.length) card.append(actions);
  };




  const hudTone = rarity => textOf(HUD_RARITY_TONE[textOf(rarity, '')], '#deeaf1');

  const HUD_RARITY_WASH = {
    寻常: 'rgba(222,234,241,.05)',
    少见: 'rgba(86,244,156,.09)',
    珍稀: 'rgba(76,164,255,.11)',
    奇异: 'rgba(205,102,255,.13)',
    至宝: 'rgba(255,202,62,.13)',
    神秘: 'rgba(255,64,112,.15)',
  };
  const hudWash = rarity => textOf(HUD_RARITY_WASH[textOf(rarity, '')], 'rgba(222,234,241,.05)');
  const hudPinKey = name => textOf(itemByName(name)?.id, '') || textOf(name, '');

  const hudDetailFields = item => {
    const out = {};
    for (const raw of textOf(item?.details, '').split('\n')) {
      const line = raw.trim();
      const at = line.indexOf(':') >= 0 ? line.indexOf(':') : line.indexOf('：');
      if (at <= 0) continue;
      const label = line.slice(0, at).trim();
      const value = line.slice(at + 1).trim();
      if (!value) continue;
      if (!out[label]) out[label] = [];
      if (!out[label].includes(value)) out[label].push(value);
    }
    return out;
  };


  const hudAreaGroupMap = () => {
    const bag = {};
    for (const map of Object.values(asObject(GAME_DATA.maps))) {
      for (const [groupName, areas] of Object.entries(asObject(map?.areaGroups))) {
        if (!Array.isArray(areas) || !areas.length) continue;
        bag[groupName] = areas.map(area => textOf(area, '')).filter(Boolean);
      }
    }
    return bag;
  };
  let hudAreaGroupCache = null;
  const hudExpandAreaGroups = value => {
    if (!hudAreaGroupCache) hudAreaGroupCache = hudAreaGroupMap();
    const parts = textOf(value, '').split(/[、；]/).map(part => part.replace(/[。．.,，]+$/, '').trim()).filter(Boolean);
    const out = [];
    const push = name => { if (name && !out.includes(name)) out.push(name); };
    for (const part of parts) {
      const areas = hudAreaGroupCache[part];
      if (!areas) { push(part); continue; }
      for (const area of areas) push(area);
    }
    return out.join('、');
  };


  const hudCleanSource = value => hudExpandAreaGroups(textOf(value, '')
    .split('[').join('').split(']').join('')
    .split('"').join('').split('“').join('').split('”').join('')
    .split(',').join('、').split('，').join('、')
    .trim());





  const hudStructuredSourceParts = item => {
    const src = asObject(item?.sources);
    const loot = asObject(src.loot);
    if (!Object.keys(loot).length && !Array.isArray(src.areas)) return null;
    const id = textOf(item?.id, '');
    const out = [];
    const precise = [];
    const mapOnly = [];
    for (const [map, meta] of Object.entries(loot)) {
      const areas = (Array.isArray(meta?.areas) ? meta.areas : []).map(name => textOf(name, '')).filter(Boolean);
      if (areas.length) precise.push({ map, areas });
      else if (textOf(asObject(GAME_DATA.maps?.[map]).kind, '') === 'mission') mapOnly.push(map);
    }
    if (precise.length) {
      out.push('区域：' + (precise.length === 1
        ? precise[0].areas.join('、')
        : precise.map(row => row.map + '：' + row.areas.join('、')).join('；')));
    }
    if (mapOnly.length) out.push(mapOnly.join('、') + '全域随机');
    const shop = Object.values(asObject(GAME_DATA.shops))
      .find(row => row?.kind === 'fixed' && Array.isArray(row.stockIds) && row.stockIds.includes(id));
    if (shop) {
      const unlock = textOf(asObject(item?.unlock).label, '');
      out.push(textOf(shop.name, '军需店') + '出售（' + aiNum(item?.shopPrice, 0) + ' 哈基币' + (unlock ? '；解锁条件：' + unlock : '') + '）');
    }
    const name = textOf(item?.name, '');
    if (name) {
      const hit = (Array.isArray(GAME_DATA.tasks) ? GAME_DATA.tasks : [])
        .filter(task => textOf(task?.reward, '').includes(name)).map(task => textOf(task?.name, '')).filter(Boolean);
      if (hit.length) out.push('任务奖励：' + hit.join('、'));
    }
    for(const [map,areas] of Object.entries(asObject(src.keySpawns)))out.push(map+'刷卡点：'+areas.join('、'));
    if (src.bottle === true) out.push('漂流瓶产出');
    return out;
  };
  const hudItemSourceParts = item => {
    const structured = hudStructuredSourceParts(item);
    if (structured && structured.length) return structured;
    const id = textOf(item?.id, '');
    const out = [];
    const fields = hudDetailFields(item);
    const explicit = [].concat(fields['产出区域'] || [], fields['产出地图'] || [], fields['获取区域'] || [])
      .map(hudCleanSource).filter(Boolean);
    const explicitText = explicit.join('；');
    if (explicit.length) out.push('区域：' + explicitText);
    const shop = Object.values(asObject(GAME_DATA.shops))
      .find(row => row?.kind === 'fixed' && Array.isArray(row.stockIds) && row.stockIds.includes(id));
    if (shop) {
      const unlock = textOf(asObject(item?.unlock).label, '');
      out.push(textOf(shop.name, '军需店') + '出售（' + aiNum(item?.shopPrice, 0) + ' 哈基币' + (unlock ? '；解锁条件：' + unlock : '') + '）');
    }
    const lists = Array.isArray(item?.sourceLists) ? item.sourceLists.filter(Boolean) : [];
    const areas = asObject(item?.areasByList);
    const precise = [];
    const mapOnly = [];
    for (const listName of lists) {
      let raw = hudCleanSource(textOf(areas[listName], ''));
      if (raw.startsWith(listName)) raw = raw.slice(listName.length).trim();
      if (raw.startsWith('的')) raw = raw.slice(1).trim();
      const hasArea = Boolean(raw) && raw !== listName;
      if (hasArea) {

        if (!explicitText.includes(raw)) precise.push(listName + '：' + raw);
      } else if (textOf(asObject(GAME_DATA.maps?.[listName]).kind, '') === 'mission') {
        mapOnly.push(listName);
      }
    }
    if (precise.length) out.push(precise.join('；'));
    if (mapOnly.length) out.push(mapOnly.join('、') + '全域随机');
    const name = textOf(item?.name, '');
    if (name) {
      const hit = (Array.isArray(GAME_DATA.tasks) ? GAME_DATA.tasks : [])
        .filter(task => textOf(task?.reward, '').includes(name))
        .map(task => textOf(task?.name, ''))
        .filter(Boolean);
      if (hit.length) out.push('任务奖励：' + hit.join('、'));
    }
    if (!out.length) out.push(lists.length ? '来源仅标注为「' + lists.join('、') + '」，未标注具体区域' : '未标注来源');
    return out;
  };
  const hudItemSource = item => item?.acquisition?.starlightShopOnly ? '星光商店 · 50星光' : hudItemSourceParts(item).join('；');
  const hudItemUsage = item => {
    const lines = [];
    const effect = HUD_USE_EFFECTS[textOf(item?.id, '')];
    const raw = modelEffectLines(item);
    if(hkmIsKeyItem(item))lines.push(item.description);

    if (!raw.length && effect) lines.push(effect.label + (effect.map ? '（仅限' + effect.map + '）' : ''));
    for (const line of raw) lines.push(line);
    if (textOf(item?.category, '').includes('消耗品') && !raw.some(line => line.includes('同类消耗品'))) {
      lines.push('同类消耗品一轮只能使用一个。');
    }
    return lines.filter((line, index) => line && lines.indexOf(line) === index);
  };
  const hudItemPicture = item => textOf(asObject(GAME_DATA.itemPictures)[textOf(item?.id, '')], '');
  const hudPictureUrls = new Set(Object.values(asObject(GAME_DATA.itemPictures)).map(value => {
    try { return new URL(value, location.href).href; } catch (_) { return ''; }
  }).filter(Boolean));






  const hudPromptMask = () => {
    const node = make('div', 'hkm-reset-prompt-mask');
    const band = hudVisibleBand();
    node.style.top = Math.round(band.top) + 'px';
    node.style.height = Math.round(band.height) + 'px';
    node.style.bottom = 'auto';
    return node;
  };
  const hudVisibleBand = () => {
    try {
      const frame = window.frameElement;
      const owner = frame && frame.ownerDocument ? frame.ownerDocument.defaultView : null;
      if (frame && owner) {
        const rect = frame.getBoundingClientRect();
        const viewHeight = Math.max(240, owner.innerHeight || 700);
        const top = Math.max(0, -rect.top);
        const bottom = Math.min(viewHeight, rect.bottom) - rect.top;
        return { top, height: Math.max(240, bottom - top) };
      }
    } catch (_) {}
    return { top: 0, height: Math.max(240, window.innerHeight || 700) };
  };

  const debugPanel = make('section', 'hkm-reset-dbg');
  debugPanel.hidden = true;
  hkmPortal.append(debugPanel);
  hkmOwnNodes(debugPanel);
  const hudRenderDebug = () => {
    if (!debugPanel || debugPanel.hidden) return;
    clear(debugPanel);



    const band = hudVisibleBand();
    hudApplyWinPos(debugPanel, 'debug', { left: '10px', top: Math.round(band.top + 10) + 'px' });
    debugPanel.style.maxHeight = Math.max(200, Math.round(band.height - 40)) + 'px';
    const head = make('div', 'hkm-reset-dbg-head');
    const close = make('button', 'hkm-reset-ip-close', '✕');
    close.type = 'button';
    close.title = '关闭调试浮窗';
    close.addEventListener('click', () => { state.debugOpen = false; saveFrontendState(state); debugPanel.hidden = true; });
    head.append(make('span', 'hkm-reset-dbg-title', '调试 · 全图信息'), close);
    debugPanel.append(head);

    const stat = currentStatSnapshot || {};
    const scene = asObject(stat.场景);
    const mapName = textOf(scene.地图, '');
    const map = GAME_DATA.maps?.[mapName];
    const hero = textOf(scene.区域, '');
    if (!map || textOf(map.kind, '') !== 'mission') {
      debugPanel.append(make('p', 'hkm-reset-dbg-note', '当前不在任务地图（' + (mapName || '未读取到地图') + '）：只有对局内才有后台玩家的位置与行动。'));
      return;
    }
    const counts = {};
    for (const player of aiAlive().filter(player => player.region !== hero || aiCanSee('hero', player))) {
      const region = textOf(player.region, '');
      if (region) counts[region] = aiNum(counts[region], 0) + 1;
    }
    const alive = aiAlive().filter(player => player.region !== hero || aiCanSee('hero', player));
    debugPanel.append(make('div', 'hkm-reset-dbg-note', mapName + ' · 你在 ' + hero + ' · 后台存活玩家 ' + alive.length + ' 名（本区域 ' + aiNum(counts[hero], 0) + '）'));
    const grid = Array.isArray(map.grid) ? map.grid : [];
    const board = make('div', 'hkm-reset-dbg-board');
    board.style.gridTemplateColumns = 'repeat(' + Math.max(1, ...grid.map(row => row.length)) + ',minmax(0,1fr))';
    for (const row of grid) {
      for (const cell of row) {
        const area = textOf(cell?.name, '');
        if (!area) continue;
        const node = make('div', 'hkm-reset-dbg-cell');
        const people = aiNum(counts[area], 0);
        const mine = area === hero;
        node.dataset.people = String(people);
        node.dataset.hero = String(mine);
        node.title = area + '：后台玩家 ' + people + ' 名' + (mine ? '（你在这里）' : '');
        node.append(
          make('span', 'hkm-reset-dbg-area', area),
          make('span', 'hkm-reset-dbg-count', (mine ? '你' : '') + (people ? (mine ? '+' + people : String(people)) : (mine ? '' : '·'))),
        );
        board.append(node);
      }
    }
    debugPanel.append(board);
    debugPanel.append(make('div', 'hkm-reset-dbg-title', '本回合后台行动'));
    const log = Array.isArray(state.aiLog) ? state.aiLog.filter(Boolean) : [];
    if (!log.length) debugPanel.append(make('p', 'hkm-reset-dbg-note', '移动或搜索后，这里会列出本轮玩家行动。'));
    for (const line of log) debugPanel.append(make('div', 'hkm-reset-dbg-line', line));


    if (alive.length) {
      debugPanel.append(make('div', 'hkm-reset-dbg-title', '玩家状态'));
      for (const player of alive) {
        debugPanel.append(make('div', 'hkm-reset-dbg-line', player.name + '（' + textOf(player.sub, '') + '）@' + textOf(player.region, '')
          + '｜轮数 ' + aiNum(player.rounds, 0) + '/' + aiNum(player.roundCap, 0) + (state.run?.map === '魔鬼海' ? '｜水下 ' + aiNum(player.water, 0) + '/' + aiNum(player.waterCap, 8) : '')
          + '｜负重 ' + aiNum(player.weight, 0) + '/' + aiWeightCap(player)));
      }
    }

  };
  const hudToggleDebug = () => {


    state.debugOpen = debugPanel.hidden;
    saveFrontendState(state);
    debugPanel.hidden = !state.debugOpen;
    if (!debugPanel.hidden) hudRenderDebug();
  };
  const debugButton = make('button', 'hkm-reset-tab', '调试');
  debugButton.type = 'button';
  debugButton.title = '全图人员分布与本回合玩家行动';
  debugButton.addEventListener('click', hudToggleDebug);
  toolbar.append(debugButton);
  const hudItemMask = make('div', 'hkm-reset-ipmask');
  const hudItemPanel = make('section', 'hkm-reset-ip');
  hudItemMask.hidden = true;
  hudItemPanel.hidden = true;


  let hudItemHoverTimer = 0;
  let hudItemHoverCard = null;
  let hudItemPanelAnchor = null;
  const hudCancelItemPanelHover = () => {
    if (hudItemHoverTimer) clearTimeout(hudItemHoverTimer);
    hudItemHoverTimer = 0;
    hudItemHoverCard = null;
  };
  const hudCloseItemPanel = () => {
    hudCancelItemPanelHover();
    hudItemPanelAnchor = null;
    hudItemMask.hidden = true;
    hudItemPanel.hidden = true;
  };
  const hudQueueItemPanelHover = (card, open) => {
    if (!hudItemPanel.hidden && hudItemPanel.dataset.pinned === 'true') return;
    if (hudItemHoverCard === card) return;
    hudCloseItemPanel();
    hudItemHoverCard = card;
    hudItemHoverTimer = setTimeout(() => {
      hudItemHoverTimer = 0;
      if (hudItemHoverCard !== card || !card.isConnected || disposed) return;
      open();
    }, 500);
  };
  const hudLeaveItemPanelHover = card => {
    if (hudItemHoverCard === card) hudCancelItemPanelHover();
    if (hudItemPanelAnchor === card && hudItemPanel.dataset.pinned !== 'true') hudCloseItemPanel();
  };
  hudItemMask.addEventListener('click', hudCloseItemPanel);
  hkmPortal.append(hudItemMask, hudItemPanel);
  hkmOwnNodes(hudItemMask, hudItemPanel);
  if (typeof document.addEventListener === 'function') {
    hkmListen(document, 'keydown', event => { if (event?.key === 'Escape') hudCloseItemPanel(); });
  }
  const hudPanelButton = (icon, label, handler, options = {}) => {
    const button = make('button', 'hkm-reset-ip-btn', '');
    button.type = 'button';
    button.append(make('i', 'hkm-reset-ip-icon', textOf(icon, '')), make('span', '', textOf(label, '')));
    if (options.title) button.title = options.title;
    if (options.disabled) button.disabled = true;
    if (typeof handler === 'function' && !options.disabled) {
      button.addEventListener('click', hudAction(async () => {
        if (specialBusy) return;
        specialBusy = true;
        try {
          await handler();
        } finally {
          specialBusy = false;
        }
      }));
    }
    return button;
  };
  const hudOpenItemPanel = options => {
    hudCancelItemPanelHover();
    hudItemPanelAnchor = options?.anchor || null;
    const name = textOf(options?.name, '');
    const item = itemByName(name) || options?.fallback || null;
    const where = textOf(options?.where, '背包');
    const mode = textOf(options?.mode, '收藏品');
    const rarity = textOf(item?.rarity, '寻常');
    const stamp = textOf(item?.id, '') || name;
    clear(hudItemPanel);hudItemPanel.setAttribute('role','dialog');hudItemPanel.setAttribute('aria-label',name+' 详情'+(options?.readonly?'（只读）':''));
    const head = make('header', 'hkm-reset-ip-head');
    const gem = make('span', 'hkm-reset-ip-gem');
    gem.style.color = hudTone(rarity);


    hudItemPanel.style.background = 'linear-gradient(180deg,' + hudWash(rarity) + ',rgba(16,16,16,0) 46%), rgba(16,16,16,.99)';
    hudItemPanel.style.borderColor = hudTone(rarity);
    hudItemPanel.dataset.rarity = rarity;
    const close = make('button', 'hkm-reset-ip-close', '✕');
    close.type = 'button';
    close.title = '关闭';close.setAttribute('aria-label','关闭收藏品详情');
    close.addEventListener('click', hudCloseItemPanel);
    const panelTitle = make('h3', 'hkm-reset-ip-name', name || '收藏品');
    panelTitle.style.color = hudTone(rarity);
    head.append(gem, panelTitle, close);

    const meta = make('div', 'hkm-reset-ip-meta');
    const pinned = Boolean(asObject(state.pins)[stamp] || asObject(state.pins)[hudPinKey(name)]);
    const star = make('button', 'hkm-reset-ip-star', pinned ? '★' : '☆');
    star.type = 'button';star.hidden=!!options?.readonly;
    star.dataset.on = String(pinned);
    star.title = pinned ? '取消收藏标记' : '标记收藏：标记的收藏品会排在列表最前';
    star.addEventListener('click', hudAction(async () => {
      if (specialBusy) return;
      specialBusy = true;
      try {
        const pins = { ...asObject(state.pins) };
        const key = stamp || hudPinKey(name);
        if (pins[key]) delete pins[key];
        else pins[key] = true;
        state.pins = pins;
        saveFrontendState(state);
        star.textContent = pins[key] ? '★' : '☆';
        star.dataset.on = String(Boolean(pins[key]));
        await refresh();
      } finally {
        specialBusy = false;
      }
    }));
    meta.append(
      make('span', 'hkm-reset-ip-coin', '◎'),
      make('b', 'hkm-reset-ip-value', (['收藏品','装备'].includes(mode) && !options?.readonly ? hudDurableUnitValue(hudBucketRowOf(currentStatSnapshot,where,name) || {名称:name,价值:item?.value},currentStatSnapshot,where):Math.max(0,aiNum(item?.value,0))).toLocaleString('en-US')),
      make('span', 'hkm-reset-ip-sep', '|'),
      make('span', 'hkm-reset-ip-cat', textOf(item?.category, '未分类')),
      star,
    );

    const figure = make('div', 'hkm-reset-ip-figure');
    const glyph = make('div', 'hkm-reset-ip-glyph');
    const picture = hudItemPicture(item);
    if (picture) {
      const img = hkmCreateElement('img');
      img.src = picture;
      img.alt = name;
      glyph.append(img);
    } else {
      glyph.append(make('span', '', textOf(name, '?').slice(0, 1)));
    }
    const foot = make('div', 'hkm-reset-ip-foot');
    const tags = make('div', 'hkm-reset-ip-tags');
    tags.append(make('span', 'hkm-reset-chip', rarity));
    if (mode === '收藏品') tags.append(make('span', 'hkm-reset-chip', textOf(options?.quantityText, '数量 ' + textOf(options?.quantity, '1'))));
    if (mode === '商店') tags.append(make('span', 'hkm-reset-chip', '售价 ' + aiNum(options?.price, 0)), make('span', 'hkm-reset-chip', options?.allowed ? '已解锁' : '未解锁'));
    if (mode === '购物车') tags.append(make('span', 'hkm-reset-chip', '单价 ' + aiNum(options?.unitPrice, 0)));
    if (mode === '摊位') tags.append(make('span', 'hkm-reset-chip', '溢价 ' + aiNum(options?.markupPercent, 0) + '%'), make('span', 'hkm-reset-chip', '报价 ' + aiNum(options?.askingPrice, 0)));
    const weight = make('div', 'hkm-reset-ip-weight');
    weight.append(make('span', '', textOf(item?.weight, '0') + 'KG'));
    foot.append(tags, weight);
    figure.append(glyph, foot);

    const body = make('div', 'hkm-reset-ip-body');
    body.append(make('p', 'hkm-reset-ip-desc', textOf(item?.description, '无描述')));
    const usageLines = hudItemUsage(item);
    const usage = make('p', 'hkm-reset-ip-line');
    usage.append(make('b', '', '【用途】'), make('span', '', usageLines.length ? usageLines.join('；') : '暂无特别用途'));
    const source = make('p', 'hkm-reset-ip-line');
    source.append(make('b', '', '【来源】'), make('span', '', hudItemSource(item)));
    const related = make('ul', 'hkm-reset-ip-list');
    related.hidden = true;
    body.append(usage);
    if (mode === '商店' && !options?.allowed) body.append(make('p', 'hkm-reset-ip-line', '未解锁：' + textOf(options?.lockNote, '条件未满足')));
    if (mode === '摊位') body.append(make('p', 'hkm-reset-ip-line', '按标价购买，或与摊主砍价。'));
    body.append(source, related);
    const flash = node => {
      node.classList.add('hkm-reset-ip-hit');
      setTimeout(() => { try { node.classList.remove('hkm-reset-ip-hit'); } catch (_) {} }, 900);
    };

    const actions = make('div', 'hkm-reset-ip-actions');
    const act = fn => async () => { await fn(); hudCloseItemPanel(); };
    if (!hudReadOnly && mode === '收藏品') {
      const source0 = itemByName(name) || { id: '', category: '' };
      if(HkmHome.inSafe(currentStatSnapshot) && HkmHome.isFurniture(source0)){const place=hudPanelButton('⌂','陈设',()=>hkmHomeAskPlace(source0.id,where),{title:'陈设到安全屋'});place.dataset.homePlace='true';actions.append(place);}
      const usable = textOf(source0?.category, '').includes('消耗品') || Boolean(HUD_USE_EFFECTS[textOf(source0?.id, '')])
        || hudToLlmItems.has(textOf(source0?.id, '')) || hudIsContainerKey(textOf(source0?.id, '')) || hudIsBottle(textOf(source0?.id, ''));
      if (where === '背包') {
        if (usable) actions.append(hudPanelButton('▸', '使用', act(async () => { await hudUseItem(name, await currentStat()); })));
        const slot = aiSlotOf(itemByName(name));
        if (slot) actions.append(hudPanelButton('▣', '装备', act(async () => { await hudEquipItem(name, await currentStat()); }), { title: '装备到「' + hudSlotLabel(slot) + '」' }));
        if (!hudInMatch()) actions.append(hudPanelButton('⌂', '入安全屋', act(async () => { await hudTransferItem(name, await currentStat()); }), { title: '放进安全屋，不计入携带负重' }));
        actions.append(hudPanelButton('✕', '丢弃', act(async () => { await hudDiscardItem(name, await currentStat()); })));
      } else if (!hudInMatch()) {
        actions.append(hudPanelButton('↑', '携带', act(async () => { await hudTransferItem(name, await currentStat(), true); }), { title: '取回背包并重新计入负重' }));
      }
      if (!hudInMatch()) actions.append(hudPanelButton('¥', '出售', () => { hudOpenSellConfirm(name, where, currentStatSnapshot || {}); hudCloseItemPanel(); }, { title: '打开出售确认窗：可以改数量，点「确认售出」才真的卖' }));
    }
    if(!hudReadOnly && item.id==='COL-0245' && ['收藏品','装备'].includes(mode))actions.append(hkm138Button());
    if(!hudReadOnly && item.fishingGear?.type==='rod' && ['收藏品','装备'].includes(mode)){actions.append(hudPanelButton('⚙','装配',hudAction(()=>hkmFishingOpenMods(name,mode==='装备'?'装备':where))));}
    if (!hudReadOnly && mode === '装备') {
      for (const skill of item.skills || []) {
        if (skill.kind !== 'active') continue;
        const offer = hkm130SkillAvailability(item, skill, currentStatSnapshot);
        actions.append(hudPanelButton('✦', offer.label, act(hudAction(() => hkm130ActivateSkill(item.id, skill.name))), {disabled:!offer.ok}));
      }
      const slot = textOf(options?.slot, '');
      if (slot) {
        actions.append(hudPanelButton('⏏', '卸下', act(async () => { await hudUnequipItem(slot, await currentStat()); }), { title: '把「' + name + '」放回背包；装备属性与负重会立刻重新结算' }));
      }
    }
    if (!hudReadOnly && mode === '散落') {
      const key = textOf(options?.key, '');
      if (key) {
        actions.append(hudPanelButton('✦', '拾取', act(async () => { await hudPickScatter(key, await currentStat()); }), { disabled: hudLootLocked(currentStatSnapshot), title: hudLootLocked(currentStatSnapshot) ? HUD_LOOT_LOCK_NOTE : '捡回背包并重新计算负重（不消耗交互轮数）' }));
      }
    }
    if (!hudReadOnly && mode === '商店') {
      const shop = Object.values(asObject(GAME_DATA.shops)).find(row => row.id === textOf(options?.shopId, '')) || null;
      actions.append(hudPanelButton('+', '加入购物车', async () => {
        if (shop && item) addToCart(shop, item, aiNum(options?.price, 0));
        hudCloseItemPanel();
      }, { disabled: !options?.allowed || !shop, title: options?.allowed ? '加入购物车' : '未解锁：' + textOf(options?.lockNote, '条件未满足') }));
    }
    if (!hudReadOnly && mode === '摊位') {
      actions.append(hudPanelButton('+','加入购物车',() => hkm130AddTradeCart(options.boothId,options.itemId,options.marketKey),{disabled:options.reserved || !!currentCart(hkm130TradeShop)[hkm130TradeCartKey(options.boothId,options.itemId)]}));
      actions.append(hudPanelButton('↘','砍价',act(() => hkm130NegotiateTrade(options.boothId,options.itemId,options.marketKey)),{disabled:options.reserved}));
    }
    if (!hudReadOnly && mode === '购物车') {
      const shop = options?.shopId === hkm130TradeShop.id ? hkm130TradeShop : Object.values(asObject(GAME_DATA.shops)).find(row => row.id === textOf(options?.shopId, '')) || null;
      actions.append(hudPanelButton('−', '移出购物车', async () => {
        if (shop && item) removeFromCart(shop, textOf(options?.cartId,item?.id || ''));
        hudCloseItemPanel();
      }));
    }
    actions.append(hudPanelButton('?', '用途', () => { flash(usage); }));
    actions.append(hudPanelButton('⌕', '来源', () => { flash(source); }));
    actions.append(hudPanelButton('⌕', '搜索关联', () => {
      if (!related.hidden) { related.hidden = true; return; }
      clear(related);
      const same = Object.values(asObject(GAME_DATA.collectibles))
        .filter(row => row && textOf(row.id, '') !== textOf(item?.id, '') && textOf(row.category, '') === textOf(item?.category, ''))
        .slice(0, 12);
      if (!same.length) related.append(make('li', '', '没有同类的收藏品。'));
      for (const row of same) related.append(make('li', '', row.name + '（' + textOf(row.rarity, '') + ' · 价值 ' + textOf(row.value, '0') + ' · 重量 ' + textOf(row.weight, '0') + '）'));
      related.hidden = false;
    }));
    if (hudReadOnly) body.append(make('p', 'hkm-reset-ip-line', '这是旧楼层的状态栏：只能查看，操作请用最新一条消息里的状态栏。'));

    hudItemPanel.append(head, meta, figure);
    if (options?.readonly) {

      body.append(make('p', 'hkm-reset-ip-line', '来自正文的收藏品卡片：这里只能查看，要操作请用状态栏里的收藏品。'));
    } else if (options?.pinned === false) {

      body.append(make('p', 'hkm-reset-ip-line', '点击固定收藏品面板，并显示完整操作按钮'));
    } else {
      hudItemPanel.append(actions);
    }
    hudItemPanel.append(body);
    const band = hudVisibleBand();
    hudItemPanel.dataset.pinned = options?.pinned === false ? 'false' : 'true';
    hudItemPanel.style.maxHeight = Math.max(220, Math.round(band.height - 44)) + 'px';

    hudItemPanel.hidden = false;




    const rectInFrame = rect => {
      try {
        const frame = window.frameElement;
        if (frame && rect) {
          const own = frame.getBoundingClientRect();
          return { left: rect.left - own.left, right: rect.right - own.left, top: rect.top - own.top, bottom: rect.bottom - own.top };
        }
      } catch (_) {}
      return rect || null;
    };
    const anchorRect = options?.anchor && typeof options.anchor.getBoundingClientRect === 'function' ? options.anchor.getBoundingClientRect()
      : (options?.anchorRect ? rectInFrame(options.anchorRect) : null);

    hudItemPanel.dataset.readonly = options?.readonly ? 'true' : 'false';
    if (!anchorRect || hudItemPanel.dataset.pinned === 'true') {
      hudItemPanel.style.left = '50%';
      hudItemPanel.style.transform = 'translateX(-50%)';
      hudItemPanel.style.top = Math.round(band.top + 10) + 'px';
    } else {
      const width = hudItemPanel.offsetWidth || 420;
      const height = Math.min(hudItemPanel.offsetHeight || 320, Math.max(220, band.height - 24));
      const gap = 10;
      let left = anchorRect.right + gap;
      if (left + width > window.innerWidth - 8) left = anchorRect.left - gap - width;
      left = Math.max(8, Math.min(left, Math.max(8, window.innerWidth - width - 8)));
      const top = Math.max(band.top + 8, Math.min(anchorRect.top, band.top + band.height - height - 8));
      hudItemPanel.style.transform = 'none';
      hudItemPanel.style.left = Math.round(left) + 'px';
      hudItemPanel.style.top = Math.round(top) + 'px';
    }



    hudItemMask.hidden = options?.pinned === false;
    hudItemPanel.hidden = false;
    hudItemPanel.scrollTop = 0;
  };

  const hudAttachItemPanel = (card, name, mode, extra, options = {}) => {
    card.dataset.panel = mode;
    if (options.hover) {
      const open = () => hudOpenItemPanel({ name, mode, pinned: false, anchor: card, ...(extra || {}) });
      card.addEventListener('mouseenter', () => hudQueueItemPanelHover(card, open));
      card.addEventListener('mouseleave', () => hudLeaveItemPanelHover(card));
      card.addEventListener('focusin', event => {
        if (!card.contains(event?.relatedTarget)) hudQueueItemPanelHover(card, open);
      });
      card.addEventListener('focusout', event => {
        if (!card.contains(event?.relatedTarget)) hudLeaveItemPanelHover(card);
      });
    }
    card.addEventListener('click', event => {
      const target = event?.target;
      if (target && typeof target.closest === 'function' && (target.closest('button') || target.closest('input'))) return;
      hudOpenItemPanel({ name, mode, ...(extra || {}) });
    });
    if (options.hover) {
      card.addEventListener('keydown', event => {
        if (event?.key === 'Enter' || event?.key === ' ') hudOpenItemPanel({ name, mode, ...(extra || {}) });
      });
    }
  };





  const hudProseItem = name => {
    const key = textOf(name, '').trim();
    const exact = itemByName(key) || itemById(key);
    if (exact) return exact;
    const normalized = key.replace(/\s+/g, '');
    if (!normalized) return null;
    const matches = Object.values(asObject(GAME_DATA.collectibles)).filter(item => textOf(item?.name, '').replace(/\s+/g, '') === normalized);
    return matches.length === 1 ? matches[0] : null;
  };
  const hkmProseIsNewestLayer = () => !disposed && env.isCurrent();
  const hkmProseOpen = (card, pinned) => {
    if (!hkmProseIsNewestLayer()) return;
    const item=hudProseItem(textOf(card.dataset?.itemName,''));if(!item){hudCloseItemPanel();return;}
    const quantity=Math.max(1,Math.min(9999,Number(card.dataset.itemQty || card.textContent.match(/×(\d+)/)?.[1])||1));
    hudOpenItemPanel({name:item.name,mode:'收藏品',pinned:pinned!==false,readonly:true,anchor:card,quantity});
  };
  disposers.push(hudCancelItemPanelHover);
  const hkmProseCardOf = event => {
    const target = event?.target;
    if (!target || typeof target.closest !== 'function') return null;
    return target.closest('.hkm-prose-item,.custom-hkm-prose-item');
  };
  hkmListen(document, 'mouseover', event => {
    const card = hkmProseCardOf(event);
    if (!card || card.contains(event?.relatedTarget)) return;
    hudQueueItemPanelHover(card, () => hkmProseOpen(card, false));
  }, true);
  hkmListen(document, 'mouseout', event => {
    const card = hkmProseCardOf(event);
    if (!card) return;
    const to = event?.relatedTarget;
    if (to && typeof card.contains === 'function' && card.contains(to)) return;
    hudLeaveItemPanelHover(card);
  }, true);
  hkmListen(document, 'click', event => {
    const card = hkmProseCardOf(event);
    if (!card) return;
    hkmProseOpen(card, true);
  }, true);

  hkmListen(document,'keydown',event=>{const card=hkmProseCardOf(event);if(card && ['Enter',' '].includes(event.key)){event.preventDefault();hkmProseOpen(card,true);}},true);
  hkmListen(document,'click',event=>{
    const button=event.target?.closest?.('.hkm-player-bag-link,.custom-hkm-player-bag-link');if(!button)return;
    const floor=Number(button.closest('.mes')?.getAttribute('mesid'));
    root.__HKM_PLAYER_BAG?.open?.(button.dataset.hkmPlayerBag,button,floor);
  },true);
  const hudInCombat = stat => hudCombatFlagOn(stat);
  const hudRoundCostFor = () => 1;
  const hudSpendRounds = async (stat,mapName,area,extra=0,options={}) => {
    const costArea=textOf(options.costArea,'') || area,statusList={...asObject(stat.状态列表)};
    const freeKey=Object.keys(statusList).find(key=>/免轮/.test(key)) || '';
    const equipmentFree=HkmEquipment.freeRound(hkm163HeroUnit(stat));
    if(freeKey)delete statusList[freeKey];
    const burden=hudCheckBurden(stat);
    const penalized=!/负重免疫/.test(JSON.stringify(statusList)) && burden.level!=='正常' && (mapName!=='魔鬼海' || aiWaterCost(mapName,costArea)>0);
    const penalty=(penalized?(burden.level==='完全超重'?1:(Math.random()<0.3?1:0)):0)+hkmSeaParasiteCost(stat,mapName,costArea);
    const cap=aiRoundCapFor(mapName,stat),waterCap=HkmSea.cap(stat);
    const result=HkmSea.spend({...asObject(stat.场景),地图:mapName,区域:area},{maps:GAME_DATA.maps,waterCap,costArea,free:Boolean(freeKey)||equipmentFree,extra,penalty:freeKey && mapName!=='魔鬼海'?0:penalty});
    const injury=HkmSea.suffocate(result.scene,stat.主角?.当前血量,stat.主角?.血量上限,GAME_DATA.maps);
    const patch={场景:result.scene,...(freeKey?{状态列表:statusList}:{}),...(injury.damage?{主角:{...asObject(stat.主角),当前血量:injury.hp,致命溢出伤害:injury.overkill}}:{})};
    const roundHero=hkm163HeroUnit({...stat,...patch});
    const restored=HkmEquipment.roundHeal(roundHero,result.cost);
    if(restored)patch.主角={...asObject(stat.主角),...asObject(patch.主角),当前血量:roundHero.hp};
    const dead=HkmLifecycle.dead({...stat,...patch});
    if(dead && state.run?.map===mapName && options.skipAiOnDeath !== true){
      const turnStat={...stat,...patch},resolved=aiResolveTurn(mapName,{mode:'action',area,stat:turnStat});
      Object.assign(patch,aiEnemyPatch(mapName,area,turnStat));
      if(resolved?.scatter)patch.散落物品=resolved.scatter;
      Object.assign(patch,resolved?.heroPatch || {});
    }
    const facilities=HkmFacilities.observe({...stat,...patch},GAME_DATA.maps);
    if(JSON.stringify(facilities)!==JSON.stringify(stat.特勤处))patch.特勤处=facilities;
    await hudCommit(patch);
    if(state.run){state.run.rounds=aiNum(result.scene.剩余交互轮数,0);state.run.water=aiNum(result.scene.剩余水下行动值,0);saveFrontendState(state);}
    return {...result,rounds:aiNum(result.scene.剩余交互轮数,0),water:aiNum(result.scene.剩余水下行动值,0),cap,waterCap,costArea,area,oxygen:aiIsOxygenArea(mapName,costArea),freeRound:Boolean(freeKey)||equipmentFree,damage:injury.damage,dead};
  };
  const hudRoundSpendText=spent=>'交互轮数 −'+spent.cost+' · '+spent.rounds+'/'+spent.cap+(spent.scene.地图==='魔鬼海'?'；水下行动值 −'+spent.waterCost+' · '+spent.water+'/'+spent.waterCap+(spent.arrivingOxygen?'（有氧补满）':''):'')+(spent.damage?'；缺氧损失 '+spent.damage+' 点生命值':'')+'。';
  const hudEscape = async (stat, mapName, fromArea, toArea) => {
    const heroSpeed = aiNum(stat?.主角?.速度, 10);
    const targets = hkm142EscapeTargets(stat);
    const chasers = targets.map(({ record }) => record);



    const rangedHolders = targets.map(({ player }) => player).filter(Boolean)
      .filter(player => textOf(player.mode, '') === 'fight')
      .filter(player => AI_ALL_SLOTS.some(slot => hkmItemHasTrait(itemById(player.equip?.[slot]), 'ranged')))
      .map(player => ({ name: textOf(player.name, ''), attack: Math.max(0, aiNum(player.attack, 0)) }))
      .filter(row => row.name);
    const slowest = chasers.length ? Math.min(...chasers.map(row => aiNum(row.速度, heroSpeed))) : heroSpeed;
    const advantage = Math.max(0, Math.round((heroSpeed - slowest) * 10) / 10);
    const chance = Math.min(0.95, AI_ESCAPE_BASE + advantage * AI_ESCAPE_PER_SPEED);
    const blocked=targets.some(({player})=>player && HkmEquipment.stopsEscape({equipment:player.equip}));
    const ok = !blocked && Math.random() < chance;
    const rangedLines=await hkm163RangedEscape(stat,targets,mapName,fromArea);
    return { ok, chance: Math.round(chance * 100), advantage, chasers: chasers.length, ranged: [], rangedLines };
  };
  const hudEscapeLines = result => {
    const lines = result.ok
      ? ['逃脱结果：成功，已抵达' + result.to + '。']
      : ['逃脱结果：失败，仍在' + result.from + '。'];

    for (const row of (Array.isArray(result?.ranged) ? result.ranged : [])) {
      lines.push('远程压制：'+row.name+'造成一击折前伤害 '+row.attack+'（含逃脱成功；受防御与减免影响）。');
    }
    lines.push(...(result.rangedLines || []));
    return lines;
  };



  const consoleWindow = make('section', 'hkm-reset-dbg');
  consoleWindow.hidden = true;
  hkmPortal.append(consoleWindow);
  hkmOwnNodes(consoleWindow);
  const consoleLog = [];
  const hudConsolePrint = line => {
    consoleLog.push(String(line == null ? '' : line));
    if (consoleLog.length > 120) consoleLog.splice(0, consoleLog.length - 120);
    if (!consoleWindow.hidden) hudRenderConsole();
  };

  const hudConsolePlayer = (stat, key) => {
    const raw = textOf(key, '').trim();
    const hero = asObject(stat?.主角);
    const heroNames = [textOf(hero.姓名, ''), '主角', '{{user}}', '干员', '我'].filter(Boolean);
    if (heroNames.includes(raw)) return { kind: 'hero', name: textOf(hero.姓名, '主角') };
    const players = Array.isArray(state.run?.players) ? state.run.players : [];
    const hit = players.find(player => [textOf(player.name, ''), textOf(player.id, '')].includes(raw))
      || players.find(player => textOf(player.name, '').includes(raw));
    return hit ? { kind: 'ai', name: textOf(hit.name, ''), player: hit } : null;
  };

  const hudConsoleGive = async (stat, target, item, quantity) => {
    if (target.kind === 'hero') {
      const result = await hudGrantResults(stat, [{ item, quantity }], '背包');
      return result.ok;
    }
    const player = target.player;
    if (!player) return false;
    if (!Array.isArray(player.bag)) player.bag = [];
    const entry = player.bag.find(row => row.id === item.id);
    if (entry) entry.quantity = Math.max(1, aiNum(entry.quantity, 1)) + quantity;
    else player.bag.push({ id: item.id, quantity });
    aiRecalcStats(player);
    player.weight = aiPlayerWeight(player);
    saveFrontendState(state);
    return true;
  };

  const hudConsoleInventory = (stat, target) => {
    const rows = [];
    if (target.kind === 'hero') {
      for (const [name, entry] of entriesOf(asObject(asObject(stat?.背包)?.携带收藏品))) {
        const item = itemByName(name) || {};
        rows.push({ name, rarity: textOf(entry?.稀有度 ?? item.rarity, '寻常'), quantity: Math.max(1, aiNum(entry?.数量, 1)), value: aiNum(entry?.价值 ?? item.value, 0), weight: aiNum(entry?.重量 ?? item.weight, 0) });
      }
      return rows;
    }
    for (const entry of (Array.isArray(target.player?.bag) ? target.player.bag : [])) {
      const item = itemById(entry?.id) || {};
      rows.push({ name: textOf(item.name, textOf(entry?.id, '未知')), rarity: textOf(item.rarity, '寻常'), quantity: Math.max(1, aiNum(entry?.quantity, 1)), value: aiNum(item.value, 0), weight: aiNum(item.weight, 0) });
    }
    return rows;
  };
  const hudConsoleExec = async line => {
    const text = textOf(line, '').trim();
    if (!text) return;
    hudConsolePrint('> ' + text);
    const parts = text.replace(/^\//, '').split(/\s+/).filter(Boolean);
    const cmd = textOf(parts[0], '').toLowerCase();
    const consoleStat = await currentStat();
    if (cmd === 'gamerule') {
      const command = HkmLifecycle.gamerule(text);
      if (command.list) {
        for (const [key, values, effect] of hkm098RuleList()) hudConsolePrint(key + ' [' + values + '] · ' + effect + ' · 当前值：' + String(state.rules[key]));
        return;
      }
      if (command.query) {
        hudConsolePrint(command.key + ' = ' + String(state.rules[command.key]));
        return;
      }
      await hkm098SetRule(command.key, command.value);
      hudConsolePrint(command.key + ' = ' + String(state.rules[command.key]));
      return;
    }
    if (cmd === 'help') {
      hudConsolePrint('可用指令：');
      hudConsolePrint('/give <玩家名> <物品ID或物品名> <数量>  给该玩家刷收藏品（主角或自机玩家）');
      hudConsolePrint('/inv <玩家名>                     列出该玩家物品栏（与主角同一套行样式）');
      hudConsolePrint('/players                          列出本局所有玩家');
      hudConsolePrint('/help                             显示本说明');
      hudConsolePrint('/gamerule list                    列出所有游戏规则、参数和影响');
      return;
    }
    if (cmd === 'players') {
      const hero = asObject(consoleStat?.主角);
      hudConsolePrint('主角：' + textOf(hero.姓名, '主角'));
      const players = Array.isArray(state.run?.players) ? state.run.players : [];
      if (!players.length) hudConsolePrint('（当前不在对局内，没有自机玩家）');
      for (const player of players) {
        hudConsolePrint('· ' + textOf(player.name, '') + '（' + textOf(player.id, '') + '）区域：' + textOf(player.region, '') + (player.alive === false ? ' · 已倒下' : (player.extracted ? ' · 已撤离' : '')));
      }
      return;
    }
    if (cmd === 'inv') {
      const target = hudConsolePlayer(consoleStat, parts[1]);
      if (!target) { hudConsolePrint('找不到玩家：「' + textOf(parts[1], '') + '」。用 /players 看名单。'); return; }
      const rows = hudConsoleInventory(consoleStat, target);
      hudConsolePrint(target.name + ' 的物品栏（' + rows.length + ' 种）：');
      if (!rows.length) hudConsolePrint('（空）');
      for (const row of rows) {
        hudConsolePrint('· ' + row.name + '｜' + row.rarity + '｜数量 ' + row.quantity + '｜价值 ' + row.value + '｜重量 ' + row.weight);
      }
      return;
    }
    if (cmd === 'give') {
      hkm098RequireAlive();
      const targetKey = parts[1];
      const itemKey = parts[2];
      const count = Math.max(1, Math.floor(aiNum(parts[3], 1)));
      if (!targetKey || !itemKey) { hudConsolePrint('用法：/give <玩家名> <物品ID或物品名> <数量>'); return; }
      const target = hudConsolePlayer(consoleStat, targetKey);
      if (!target) { hudConsolePrint('找不到玩家：「' + targetKey + '」。用 /players 看名单。'); return; }
      const item = itemById(itemKey) || itemByName(itemKey);
      if (!item) { hudConsolePrint('找不到物品：「' + itemKey + '」。用物品ID（如 COL-0001）或物品名都行。'); return; }
      const ok = await hudConsoleGive(consoleStat, target, item, count);
      hudConsolePrint(ok ? '已给 ' + target.name + ' 刷取 ' + textOf(item.name, itemKey) + '×' + count + '。' : '刷取失败：入账通道不可用。');
      if (ok) hudConsolePrint(...(hudConsoleInventory(await currentStat(), target).slice(0, 0)));
      return;
    }
    hudConsolePrint('未知指令：「' + cmd + '」。输入 /help 看可用指令。');
  };
  const hudRenderConsole = () => {
    if (!consoleWindow) return;
    clear(consoleWindow);
    const band = hudVisibleBand();
    hudApplyWinPos(consoleWindow, 'console', { left: '50%', top: Math.round(band.top + 30) + 'px' });
    consoleWindow.style.maxHeight = Math.max(240, Math.round(band.height - 60)) + 'px';
    const head = make('div', 'hkm-reset-dbg-head');
    head.append(make('div', 'hkm-reset-dbg-title', '控制台'));
    const close = make('button', 'hkm-reset-ip-close', '收起');
    close.type = 'button';
    close.addEventListener('click', () => { consoleWindow.hidden = true; });
    head.append(close);
    consoleWindow.append(head);
    consoleWindow.append(make('p', 'hkm-reset-dbg-note', '输入 /help 查看可用指令。'));
    const input = make('input');
    input.type = 'text';
    input.placeholder = '/give ' + textOf(aiPlayers()[0]?.name,'林安') + ' COL-0001 3';
    input.style.cssText = 'width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #3d3d3d;background:#111;color:#e8e8e8;font:12px/1.4 system-ui';
    input.disabled = hudReadOnly;
    input.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (hudReadOnly) return;
      const value = String(input.value || '');
      input.value = '';
      hudConsoleExec(value).catch(error => hudConsolePrint('执行出错：' + (error?.message || error)));
    });
    consoleWindow.append(input);
    const body = make('div', 'hkm-reset-dbg-body');
    body.style.cssText = 'margin-top:8px;max-height:' + Math.max(120, Math.round(hudVisibleBand().height - 190)) + 'px;overflow:auto;';
    for (const line of consoleLog) body.append(make('div', 'hkm-reset-dbg-line', line));
    if (!consoleLog.length) body.append(make('div', 'hkm-reset-dbg-line', '输入 /help 查看可用指令。'));
    consoleWindow.append(body);
    hudMakeDraggable(consoleWindow, 'console');
  };
  const hudOpenConsole = () => {
    if (hudReadOnly) { setStatus('这是旧楼层的状态栏，只能查看。'); return; }
    consoleWindow.hidden = false;
    hudRenderConsole();
  };




  const HKM_KEY_MAX = 5;
  const hudDurableLineRows = (row, stat, where) => {
    const item=itemByName(textOf(row?.名称 ?? row?.name,''));
    if(item?.fishingGear?.type!=='line')return [];
    return Object.values(asObject(stat?.渔具状态?.instances)).filter(entry=>entry.itemId===item.id && entry.where===where);
  };
  const hudDurableValues = (row, stat=currentStatSnapshot, where='背包', front=state) => {
    const name=textOf(row?.名称 ?? row?.name,''),item=itemByName(name),count=Math.max(1,Math.floor(aiNum(row?.数量 ?? row?.quantity,1)));
    if(item?.fishingGear?.type==='line'){
      const instances=hudDurableLineRows(row,stat,where),max=item.fishingGear.maxDurability;
      return Array.from({length:count},(_,index)=>HkmFishing.durabilityValue(item,instances[index]?.durability ?? max,max));
    }
    if(hkmIsKeyItem(item)){
      if(where==='钥匙链')return [HkmFishing.durabilityValue(item,asObject(front.keychain)[name]?.耐久 ?? row?.耐久 ?? HKM_KEY_MAX,HKM_KEY_MAX)];
      const legacy=where==='背包' ? asObject(front.keyDurability)[name] : undefined;
      return hkmKeyDurs(Array.isArray(row?.钥匙耐久) ? row : {...row,耐久:row?.耐久 ?? legacy},count).map(dur=>HkmFishing.durabilityValue(item,dur,HKM_KEY_MAX));
    }
    return Array(count).fill(Math.max(0,aiNum(row?.价值 ?? row?.value,0)));
  };
  const hudDurableUnitValue = (row,stat=currentStatSnapshot,where='背包',front=state) => {
    const values=hudDurableValues(row,stat,where,front);
    return Math.round(values.reduce((sum,value)=>sum+value,0)/values.length*100)/100;
  };
  const hudDurableValuePatch = (stat,front=state) => {
    const patch={};
    for(const [key,field,where]of [['背包','携带收藏品','背包'],['安全屋','收藏品','安全屋'],['藏匿物',null,'藏匿物'],['散落物品',null,'散落物品']]){
      const original=field ? asObject(stat[key]?.[field]):asObject(stat[key]);let next=null;
      for(const [id,row]of Object.entries(original)){
        const item=itemByName(row?.名称 || id);
        if(item?.fishingGear?.type!=='line' && !hkmIsKeyItem(item))continue;
        const value=hudDurableUnitValue(row,stat,where==='散落物品'?where+':'+id:where,front);
        if(hkmIsKeyItem(item)){
          const legacy=where==='背包' ? asObject(front.keyDurability)[item.name] : undefined;
          const durs=hkmKeyDurs(Array.isArray(row.钥匙耐久) ? row : {...row,耐久:row.耐久 ?? legacy}).filter(dur=>dur>0);
          const updated={...row,数量:durs.length,钥匙耐久:durs,价值:durs.length ? Math.round(durs.reduce((sum,dur)=>sum+HkmFishing.durabilityValue(item,dur,HKM_KEY_MAX),0)/durs.length*100)/100 : 0,描述:item.description};
          delete updated.耐久;
          if(!durs.length || JSON.stringify(updated)!==JSON.stringify(row)){next ||= {...original};if(durs.length)next[id]=updated;else delete next[id];}
        }else if(aiNum(row.价值,-1)!==value){next ||= {...original};next[id]={...row,价值:value};}
      }
      if(next)patch[key]=field ? {...stat[key],[field]:next}:next;
    }
    return patch;
  };
  const hudKeychainOf = (source = readFrontendState()) => asObject(source?.keychain);
  const hudValuedKeychain = (stat,front=state) => Object.fromEntries(Object.entries(asObject(front.keychain)).map(([name,row])=>[name,{...row,价值:hudDurableUnitValue({...row,名称:name,数量:1},stat,'钥匙链',front)}]));
  const hkmIsKeyItem = item => Boolean(item?.id) && (GAME_DATA.specialMechanics?.keyContainers || []).some(box=>box.keyId===item.id);
  const hkmKeyClamp = value => Math.min(HKM_KEY_MAX,Math.max(0,Math.floor(aiNum(value,HKM_KEY_MAX))));
  const hkmKeyDurs = (row, count = Math.max(0,Math.floor(aiNum(row?.数量 ?? row?.quantity,1)))) => {
    const saved=Array.isArray(row?.钥匙耐久) ? row.钥匙耐久 : null;
    return Array.from({length:count},(_,index)=>hkmKeyClamp(saved?.[index] ?? (index===0 ? row?.耐久 : undefined) ?? HKM_KEY_MAX));
  };
  const hkmKeyPrunedChain = chain => Object.fromEntries(Object.entries(asObject(chain)).flatMap(([name,row])=>{
    const item=itemByName(name);
    if(!hkmIsKeyItem(item))return [[name,row]];
    const durability=hkmKeyClamp(row?.耐久 ?? HKM_KEY_MAX);
    return durability>0 ? [[name,{...row,耐久:durability,价值:HkmFishing.durabilityValue(item,durability,HKM_KEY_MAX)}]] : [];
  }));
  const hkmKeyDurOf = (name, stat = currentStatSnapshot) => {
    const source=readFrontendState(), chain=asObject(source.keychain)[textOf(name,'')];
    if(chain)return hkmKeyClamp(chain.耐久 ?? HKM_KEY_MAX);
    const row=hudBucketOf(stat,'背包')[textOf(name,'')];
    if(Array.isArray(row?.钥匙耐久) || row?.耐久!==undefined)return hkmKeyDurs(row)[0] ?? 0;
    return hkmKeyClamp(asObject(source.keyDurability)[textOf(name,'')] ?? HKM_KEY_MAX);
  };
  const hkmKeyInChain = name => Boolean(hudKeychainOf()[textOf(name,'')]) && hkmKeyDurOf(name)>0;
  const hkmKeyInBag = (stat,name) => {
    const row=hudBucketOf(stat,'背包')[textOf(name,'')];
    return aiNum(row?.数量,0)>0 && (Array.isArray(row?.钥匙耐久) ? hkmKeyDurs(row)[0]>0 : hkmKeyClamp(row?.耐久 ?? asObject(readFrontendState().keyDurability)[name] ?? HKM_KEY_MAX)>0);
  };
  const hkmKeyWhere = (stat,name) => hkmIsKeyItem(itemByName(name)) ? (hkmKeyInChain(name) ? '钥匙链' : hkmKeyInBag(stat,name) ? '背包' : '') : '';
  const hkmKeychainLocked = (stat = currentStatSnapshot) => hudInMatch() || GAME_DATA.maps?.[stat?.场景?.地图]?.kind==='mission' || GAME_DATA.maps?.[state.run?.map]?.kind==='mission';
  const hkmKeyEquip = async name => {
    hkm098RequireAlive();
    if (hkmKeychainLocked()) { setStatus('对局中不能整理钥匙链，请回哈基米空间。'); return false; }
    const stat=await currentStat(), key=textOf(name,''), source=readFrontendState();
    if(hkmKeychainLocked(stat))throw Error('对局中不能整理钥匙链，请回哈基米空间。');
    if(!hkmIsKeyItem(itemByName(key)))throw Error('该物品不是可开卡的钥匙。');
    if (source.keychain?.[key]) return false;
    const entry=asObject(hudBucketOf(stat,'背包')[key]);
    if (!entry.名称) throw Error('背包里没有「'+key+'」。');
    const durability=hkmKeyDurs(entry)[0];if(!(durability>0))throw Error('钥匙已损毁。');
    const keychain={...source.keychain,[key]:{耐久:durability,稀有度:entry.稀有度,价值:hudDurableUnitValue(entry,stat,'背包',source),重量:aiNum(entry.重量,0)}};
    await hkm098Transact('key-equip:'+Date.now()+':'+(++hkm095QueueSerial),hudExchangePatch(stat,[{name:key,quantity:1}],[]),{keychain});
    await refresh(); setStatus('「'+key+'」已装备到钥匙链。'); return true;
  };
  const hkmKeyUnequip = async name => {
    hkm098RequireAlive();
    if (hkmKeychainLocked()) { setStatus('对局中不能整理钥匙链，请回哈基米空间。'); return false; }
    const stat=await currentStat(), key=textOf(name,''), source=readFrontendState(), row=source.keychain?.[key];
    if(hkmKeychainLocked(stat))throw Error('对局中不能整理钥匙链，请回哈基米空间。');
    if(!hkmIsKeyItem(itemByName(key)))throw Error('该物品不是可开卡的钥匙。');
    if (!row || hkmKeyClamp(row.耐久)<=0) return false;
    const keychain={...source.keychain}; delete keychain[key];
    const item=itemByName(key) || {name:key,rarity:row.稀有度,value:row.价值,weight:row.重量,description:''};
    await hkm098Transact('key-unequip:'+Date.now()+':'+(++hkm095QueueSerial),hudExchangePatch(stat,[],[{item,quantity:1,origin:{钥匙耐久:[hkmKeyClamp(row.耐久)]}}]),{keychain});
    await refresh(); setStatus('「'+key+'」已放回背包，剩余耐久保留。'); return true;
  };

  const keychainWindow = make('section', 'hkm-reset-dbg');
  keychainWindow.hidden = true;
  hkmPortal.append(keychainWindow);
  hkmOwnNodes(keychainWindow);
  const hudRenderKeychain = stat => {
    if (!keychainWindow) return;
    keychainWindow.hidden = false;
    clear(keychainWindow);
    const band = hudVisibleBand();
    hudApplyWinPos(keychainWindow, 'keychain', { left: '50%', top: Math.round(band.top + 40) + 'px' });
    keychainWindow.style.maxHeight = Math.max(220, Math.round(band.height - 60)) + 'px';
    const head = make('div', 'hkm-reset-dbg-head');
    head.append(make('div', 'hkm-reset-dbg-title', '钥匙链'));
    const close = make('button', 'hkm-reset-ip-close', '收起');
    close.type = 'button';
    close.addEventListener('click', () => { keychainWindow.hidden = true; });
    head.append(close);
    keychainWindow.append(head);
    keychainWindow.append(make('p', 'hkm-reset-dbg-note', hkmKeychainLocked() ? '钥匙链内物品不会因死亡或清空收藏品丢失。对局中不能装备/卸下钥匙（回哈基米空间再整理）。' : '钥匙链内物品不会因死亡或清空收藏品丢失。点「装备」把背包里的钥匙挂上，点「卸下」放回背包。'));
    const chain = hudKeychainOf();
    const names = Object.keys(chain);
    keychainWindow.append(make('div', 'hkm-reset-dbg-line', '已装备（' + names.length + '）：'));
    if (!names.length) keychainWindow.append(make('p', 'hkm-reset-dbg-note', '钥匙链是空的。'));
    for (const name of names) {
      const box = make('div', 'hkm-reset-dbg-cell');
      box.append(make('div', 'hkm-reset-dbg-line', '「' + name + '」耐久 ' + hkmKeyDurOf(name) + '/' + HKM_KEY_MAX));
      const off = make('button', 'hkm-reset-mini', '卸下');
      off.type = 'button';
      off.disabled = hudReadOnly || hkmKeychainLocked();
      off.addEventListener('click', () => { void hkmKeyUnequip(name, currentStatSnapshot || {}).then(() => hudRenderKeychain(currentStatSnapshot || {})); });
      box.append(off);
      keychainWindow.append(box);
    }
    const bagKeys = entriesOf(asObject(asObject(stat?.背包)?.携带收藏品))
      .filter(([name]) => hkmIsKeyItem(itemByName(name)));
    keychainWindow.append(make('div', 'hkm-reset-dbg-line', '背包里的钥匙（' + bagKeys.length + '）：'));
    if (!bagKeys.length) keychainWindow.append(make('p', 'hkm-reset-dbg-note', '背包里没有钥匙。'));
    for (const [name] of bagKeys) {
      const box = make('div', 'hkm-reset-dbg-cell');
      box.append(make('div', 'hkm-reset-dbg-line', '「' + name + '」耐久 ' + (hkmKeyDurs(hudBucketOf(stat,'背包')[name])[0] ?? 0) + '/' + HKM_KEY_MAX));
      const on = make('button', 'hkm-reset-mini', '装备');
      on.type = 'button';
      on.disabled = hudReadOnly || hkmKeychainLocked();
      on.addEventListener('click', () => { void hkmKeyEquip(name, currentStatSnapshot || {}).then(() => hudRenderKeychain(currentStatSnapshot || {})); });
      box.append(on);
      keychainWindow.append(box);
    }
    hudMakeDraggable(keychainWindow, 'keychain');
  };

  const queueSettleRecord = (key, text) => queueInsuranceRecord(key, text);
  const queueInsuranceRecord = (key, text) => {
    const next = { ...asObject(state.insuranceLog) };
    next[String(key)] = String(text || '');
    state.insuranceLog = next;
    saveFrontendState(state);
  };


  const hudLootAll = async stat => {
    stat = await hudRequireLoot();
    const area=textOf(stat.场景?.区域,''), draft=HkmLifecycle.copy(state.run);
    if (!draft || draft.map!==stat.场景?.地图) return;
    const boxes=(draft.boxes?.[area] || []).filter(box=>!box.looted);
    if (!boxes.length) return;
    const results=[];
    for(const box of boxes) {
      for(const entry of box.entries) { const item=itemById(entry.id);if(item)results.push({item,quantity:entry.quantity,origin:HkmUpgrade.proof({...entry,数量:entry.quantity},entry.quantity,state.run)}); }
      box.entries=[];box.looted=true;
    }
    const log=formatLootActionLines('战利品盒一键搜刮',results,[]).join('；')+'；本次搜刮不消耗交互轮数，盒内物品已移入背包。';
    await hkm098Transact('box-all:'+Date.now()+':'+(++hkm095QueueSerial),hudExchangePatch(stat,[],results),{run:draft},log,'loot');
    await refresh(); setStatus('一键搜刮完成，物品已入背包。');
  };






  const hudBoxWindows = {};
  const hudBoxWindowList = () => Object.values(hudBoxWindows);
  const hudBoxWindowOf = id => hudBoxWindows[textOf(id, '')] || null;
  const hudBoxSessionBox = (session, run = state.run) => {
    const row = hudBoxWindowOf(session?.boxId) || session || null;
    if (!row) return null;

    const boxes = asObject(run?.boxes)[textOf(row.area, '')];
    return (Array.isArray(boxes) ? boxes : []).find(box => textOf(box.id, '') === textOf(row.boxId, '')) || null;
  };
  const hudBoxAddEntry = (box, id, quantity = 1) => {
    if (!box || !id) return;
    if (!Array.isArray(box.entries)) box.entries = [];
    const current = box.entries.find(entry => textOf(entry?.id, '') === textOf(id, ''));
    if (current) {current.摸出数量=Math.min(Math.max(1,aiNum(current.quantity,1)),aiNum(current.摸出数量,0));current.quantity = Math.max(1, aiNum(current.quantity, 1)) + Math.max(1, aiNum(quantity, 1));}
    else box.entries.push({ id, quantity: Math.max(1, aiNum(quantity, 1)) });
    box.looted = false;
  };
  const hudBoxTakeEntry = (box, name, quantity = 0) => {
    if (!box || !Array.isArray(box.entries)) return [];
    const taken = [];
    for (const entry of box.entries.slice()) {
      const item = itemById(entry.id);
      if (!item || item.name !== name) continue;
      const have = Math.max(1, aiNum(entry.quantity, 1));
      const take = quantity > 0 ? Math.min(have, quantity) : have;
      const origin=HkmUpgrade.proof({...entry,数量:have},take,state.run);
      entry.摸出数量=Math.max(0,aiNum(entry.摸出数量,0)-take);entry.quantity = have - take;
      taken.push({ item, quantity: take, origin });
    }
    box.entries = box.entries.filter(entry => aiNum(entry.quantity, 0) > 0);
    return taken;
  };
  const hudBoxWindowTake = async (session, name, stat) => {
    stat = await hudRequireLoot(session);
    const draftRun=HkmLifecycle.copy(state.run);
    const box = hudBoxSessionBox(session,draftRun);
    const taken = hudBoxTakeEntry(box, name, 0);
    if (!taken.length) return;
    const bag = { ...hudBucketOf(stat, '背包') };
    let total = 0;
    for (const row of taken) { aiGrantBucket(bag, row.item, row.quantity,row.origin); total += row.quantity; }
    const bagBox = { ...asObject(stat?.背包), 携带收藏品: bag };
    await hkm098Transact('box-action:'+Date.now()+':'+(++hkm095QueueSerial),{ 背包: bagBox, 主角: hudBurdenPatch(stat, bagBox) },{run:draftRun}, '', 'loot');
    await refresh();
    queueItemMove(name, '战利品盒', '背包');
    setStatus('拿上了「' + name + '」×' + total + '。');
    hudRenderBoxWindows();
  };
  const hudBoxWindowEquip = async (session, name, stat) => {
    stat = await hudRequireLoot(session);
    const draftRun=HkmLifecycle.copy(state.run);
    const box = hudBoxSessionBox(session,draftRun);
    const slot = aiSlotOf(itemByName(name));
    if (!slot) {
      setStatus('「' + name + '」不是武器装备类收藏品，没有可装备的部位。');
      return;
    }
    if (!hudBoxTakeEntry(box, name, 1).length) return;
    const equipment = { ...asObject(stat?.装备) };
    const previous = textOf(equipment[slot], '无');
    equipment[slot] = name;
    const bag = { ...hudBucketOf(stat, '背包') };

    if (previous && previous !== '无') {
      const prevItem = itemByName(previous);
      if (prevItem && prevItem.id) hudBoxAddEntry(box, prevItem.id, 1);
      else aiGrantBucket(bag, { name: hudGearName(previous), rarity: '寻常', value: 0, weight: 0, description: '' }, 1);
    }
    const bagBox = { ...asObject(stat?.背包), 携带收藏品: bag };
    let hero = hudHeroStats(stat, equipment, bagBox);
    const evict = hudEvictStash(stat, equipment, bagBox);
    if (evict) hero = hudHeroStats(stat, equipment, evict.背包);
    await hkm098Transact('box-action:'+Date.now()+':'+(++hkm095QueueSerial),Object.assign({ 装备: equipment, 背包: bagBox, 主角: hero }, evict ? { 背包: evict.背包, 藏匿物: evict.藏匿物, 散落物品: evict.散落物品 } : {}),{run:draftRun}, '', 'gear');
    await refresh();
    if (evict) hudReportEvict(evict, stat);
    queueGearChange(slot, name, stat);
    queueItemMove(name, '战利品盒', '装备');
    const row = hudBoxWindowOf(session?.boxId);
    if (row) row.equipped = (Array.isArray(row.equipped) ? row.equipped : []).concat([{ slot, name }]);
    setStatus('从盒子里装备了「' + name + '」（' + hudSlotLabel(slot) + '）' + (previous && previous !== '无' ? '，换下的「' + hudGearName(previous) + '」放进了盒子' : '') + '。');
    hudRenderBoxWindows();
  };
  const hudBoxWindowStash = async (session, name, stat) => {
    stat = await hudRequireLoot(session);
    const hideOwner = hudStashOwner(stat), item = itemByName(name);
    if (!hideOwner || aiNum(item?.weight, 0) > hideOwner.rule.maxWeight) throw Error('当前装备没有可容纳该物品的藏匿空间。');
    if (textOf(hudHiddenEntry(stat, name).名称, '')) throw Error('该物品已经藏匿，每件最多藏 1 个。');
    const draftRun=HkmLifecycle.copy(state.run);
    const box = hudBoxSessionBox(session,draftRun);
    const taken = hudBoxTakeEntry(box, name, 1);
    if (!taken.length) return;
    const bag = { ...hudBucketOf(stat, '背包') };
    aiGrantBucket(bag, taken[0].item, 1,taken[0].origin);
    const bagBox = { ...asObject(stat?.背包), 携带收藏品: bag };
    await hkm098Transact('box-action:'+Date.now()+':'+(++hkm095QueueSerial),{ 背包: bagBox, 主角: hudBurdenPatch(stat, bagBox) },{run:draftRun}, '', 'loot');
    await refresh();
    queueItemMove(name, '战利品盒', '背包');
    hudRenderBoxWindows();
    await hudToggleStash(name, taken[0].item, await currentStat());
    hudRenderBoxWindows();
  };
  const hudBoxWindowDiscard = async (session, name, stat) => {
    stat = await hudRequireLoot(session);
    const draftRun=HkmLifecycle.copy(state.run);
    const box = hudBoxSessionBox(session,draftRun);
    const taken = hudBoxTakeEntry(box, name, 0);
    if (!taken.length) return;
    const mapName = textOf(stat?.场景?.地图, '');
    const area = textOf(hudBoxWindowOf(session?.boxId)?.area, '') || textOf(stat?.场景?.区域, '');
    let scatter = { ...asObject(stat?.散落物品) };
    let total = 0;
    for (const row of taken) { scatter = hudScatterMerge(scatter, mapName, area, {...row.item,...row.origin}, row.quantity); total += row.quantity; }
    await hkm098Transact('box-action:'+Date.now()+':'+(++hkm095QueueSerial),{ 散落物品: scatter },{run:draftRun});
    await refresh();
    setStatus('把「' + name + '」×' + total + '丢到了 ' + area + ' 的地上。');
    hudRenderBoxWindows();
  };
  const hudBoxWindowDump = async (session, stat) => {
    stat = await hudRequireLoot(session);
    const draftRun=HkmLifecycle.copy(state.run);
    const box = hudBoxSessionBox(session,draftRun);
    if (!box) return;
    const mapName = textOf(stat?.场景?.地图, '');
    const area = textOf(hudBoxWindowOf(session?.boxId)?.area, '') || textOf(stat?.场景?.区域, '');
    let scatter = { ...asObject(stat?.散落物品) };
    let count = 0;
    for (const entry of Array.isArray(box.entries) ? box.entries.slice() : []) {
      const item = itemById(entry.id);
      if (!item) continue;
      scatter = hudScatterMerge(scatter, mapName, area, {...item,...HkmUpgrade.proof({...entry,数量:entry.quantity},entry.quantity,state.run)}, entry.quantity);
      count += 1;
    }
    box.entries = [];
    box.looted = true;

    const equipment = { ...asObject(stat?.装备) };
    const row = hudBoxWindowOf(session?.boxId);
    const equipped = Array.isArray(row?.equipped) ? row.equipped.slice() : [];
    for (const gear of equipped) {
      if (textOf(equipment[gear.slot], '') !== textOf(gear.name, '')) continue;
      equipment[gear.slot] = '无';
      const item = itemByName(gear.name);
      if (item) { scatter = hudScatterMerge(scatter, mapName, area, item, 1); count += 1; }

    }



    const evict = hudEvictStash(stat, equipment, { ...asObject(stat?.背包) });
    if (evict) {
      for (const [key, entry] of Object.entries({ ...asObject(evict.散落物品) })) {
        if (!textOf(entry?.名称, '')) continue;
        const previous = asObject(asObject(stat.散落物品)[key]);
        const delta = Math.max(0, aiNum(entry.数量, 1) - aiNum(previous.数量, 0));
        if (delta > 0) scatter = hudScatterMerge(scatter, textOf(entry.地图, mapName), textOf(entry.区域, area), { name: entry.名称, rarity: entry.稀有度, value: entry.价值, weight: entry.重量, description: entry.描述 }, delta);
      }
      for (const name of evict.report.bag) {
        const item = itemByName(name);
        if (item) { scatter = hudScatterMerge(scatter, mapName, area, item, 1); count += 1; }
      }
      for (const name of evict.report.ground) count += 1;
    }
    const gearChanges = Object.keys(equipment).filter(slot => !hudSameGear(equipment[slot], stat.装备?.[slot])).length;
    const hero = hudHeroStats(stat, equipment, asObject(stat?.背包));
    await hkm098Transact('box-action:'+Date.now()+':'+(++hkm095QueueSerial),Object.assign({ 装备: equipment, 散落物品: scatter, 主角: hero }, evict ? { 藏匿物: evict.藏匿物 } : {}),{run:draftRun}, '', gearChanges ? 'gear' : '', gearChanges);
    await refresh();
    if (row) row.equipped=[];
    for (const gear of equipped) if (equipment[gear.slot]==='无') queueGearChange(gear.slot,'无',stat);
    saveFrontendState(state);
    setStatus('一键丢出：' + count + ' 项已落到 ' + area + ' 的地上。');
    hudRenderBoxWindows();
  };
  const hudRenderBoxWindow = session => {
    const row = hudBoxWindowOf(session?.boxId);
    if (!row || !row.node) return;
    const node = row.node;
    const box = hudBoxSessionBox(row);
    const area = textOf(row.area, '');
    clear(node);
    const head = make('div', 'hkm-reset-boxwin-head hkm-reset-drag');
    head.title = '按住这里可以拖动窗口（位置会记住）';
    const close = make('button', 'hkm-reset-ip-close', '✕');
    close.type = 'button';
    close.title = '关闭这个盒子（进入下一轮对话也会全部关闭）';
    close.addEventListener('click', () => hudCloseBoxWindow(row.boxId));
    head.append(make('h3', 'hkm-reset-boxwin-title', (box ? textOf(box.owner, '') : textOf(row.owner, '')) + ' 的战利品盒'), close);
    node.append(head);
    node.append(make('div', 'hkm-reset-small', area + ' · 舔包与丢出都不消耗交互轮数；装备会与身上同部位互换（换下的进盒子），丢弃落到地上。'));
    if (!box || !box.entries.length) {
      node.append(empty('盒子已经空了。'));
      return;
    }
    const grid = make('div', 'hkm-reset-tiles');

    const scrollBox = make('div', 'hkm-reset-scrollbox hkm-reset-boxscroll');
    for (const entry of box.entries) {
      const item = itemById(entry.id);
      if (!item) continue;
      const name = textOf(item.name, '');
      const tile = make('div', 'hkm-reset-tile');
      tile.style.borderLeftColor = hudTone(textOf(item.rarity, '寻常'));
      const gem = make('span', 'hkm-reset-tile-gem');
      gem.style.color = hudTone(textOf(item.rarity, '寻常'));
      const body = make('span', 'hkm-reset-tile-body');
      body.append(
        make('span', 'hkm-reset-tile-name', name),
        make('span', 'hkm-reset-tile-meta', '×' + textOf(entry.quantity, '1') + ' · 价值 ' + textOf(item.value, '0') + ' · 重量 ' + textOf(item.weight, '0')),
      );
      const main = make('div', 'hkm-reset-tile-main');
      main.append(gem, body);
      tile.append(main);
      const actions = make('div', 'hkm-reset-card-actions');
      const act = (label, title, run) => {
        const button = make('button', 'hkm-reset-mini', label);
        button.type = 'button';
        button.title = title;
        button.addEventListener('click', hudAction(async () => {
          if (specialBusy) return;
          specialBusy = true;
          try { await run(await currentStat()); } finally { specialBusy = false; }
        }));
        actions.append(button);
      };
      act('拿上', '整叠放进背包（不消耗交互轮数）', stat => hudBoxWindowTake(row, name, stat));
      if (aiSlotOf(item)) act('装备', '与身上同部位互换，换下来的进盒子', stat => hudBoxWindowEquip(row, name, stat));
      const hideOwner = hudStashOwner(currentStatSnapshot);
      if (hideOwner && aiNum(item.weight, 0) <= hideOwner.rule.maxWeight) act('藏匿', '拿 1 个进背包后藏起来（每件最多藏 1 个）', stat => hudBoxWindowStash(row, name, stat));
      act('丢弃', '丢到当前区域的地上（可在「当前区域散落」里捡回）', stat => hudBoxWindowDiscard(row, name, stat));
      tile.append(actions);
      hudAttachItemPanel(tile, name, '收藏品', { where: '战利品盒', quantity: textOf(entry.quantity, '1') }, { hover: true });
      grid.append(tile);
    }
    scrollBox.append(grid);
    node.append(scrollBox);
    if (hudLootLocked(currentStatSnapshot)) {
      node.querySelectorAll('button.hkm-reset-mini, button.hkm-reset-primary').forEach(button => {
        button.disabled = true;
        button.title = HUD_LOOT_LOCK_NOTE;
      });
    }
    const dump = make('button', 'hkm-reset-primary', '一键丢出（盒内所有物品，含已装备的，都落到地上）');
    dump.type = 'button';
    dump.disabled = hudLootLocked(currentStatSnapshot);
    if (dump.disabled) dump.title = HUD_LOOT_LOCK_NOTE;
    dump.addEventListener('click', hudAction(async () => {
      if (specialBusy) return;
      specialBusy = true;
      try { await hudBoxWindowDump(row, await currentStat()); } finally { specialBusy = false; }
    }));
    node.append(dump);
    hudMakeDraggable(node, 'box:' + textOf(row.boxId, ''));
  };
  const hudRenderBoxWindows = () => hudBoxWindowList().forEach(row => hudRenderBoxWindow(row));
  const hudCloseBoxWindow = id => {
    const row = hudBoxWindowOf(id);
    if (!row) return;
    if (row.node && row.node.parentNode) row.node.parentNode.removeChild(row.node);
    delete hudBoxWindows[textOf(id, '')];
  };

  const hudOpenBoxWindow = (box, stat) => {
    if (hudLootLocked(stat)) {
      setStatus(HUD_LOOT_LOCK_NOTE);
      return;
    }

    const id = textOf(box?.id, '');
    if (!id) return;
    const existing = hudBoxWindowOf(id);
    if (existing) {
      existing.node.style.zIndex = String(84 + hudBoxWindowList().length);
      hudRenderBoxWindow(existing);
      return;
    }
    const node = make('section', 'hkm-reset-boxwin');
    node.style.zIndex = String(84 + hudBoxWindowList().length);
    const cascade = hudBoxWindowList().length;
    hudApplyWinPos(node, 'box:' + id, {
      left: Math.round(Math.max(12, Math.min((window.innerWidth || 1200) - 450, 120 + cascade * 26))) + 'px',
      top: Math.round(70 + cascade * 26) + 'px',
    });
    hkmPortal.append(node);
    hkmOwnNodes(node);
    hudBoxWindows[id] = {
      boxId: id,
      owner: textOf(box.owner, ''),
      area: textOf(stat?.场景?.区域, ''),
      roundKey: hudRoundKey(),
      equipped: [],
      node,
    };
    hudRenderBoxWindow(hudBoxWindows[id]);
  };





  const HUD_EXTRACT_RULES = {
    魔鬼海: { 巨蚌钓台撤离点: { item: 'COL-0039', quantity: 1, label: '缴纳 1 份精液' } },
  };
  const hudExtractRule = (mapName, area) => { const rule = asObject(asObject(HUD_EXTRACT_RULES[mapName])[area]); return textOf(rule.item, '') ? rule : null; };
  const hudExtractPayment = (stat, mapName, area, consume = false) => {
    const rule = hudExtractRule(mapName, area), bag = { ...hudBucketOf(stat, '背包') };
    const rows = rule ? entriesOf(bag).filter(([key, row]) => hkm098Resolve(textOf(row?.名称, key))?.id === rule.item) : [];
    const owned = rows.reduce((sum, [, row]) => sum + Math.max(0, Math.floor(aiNum(row?.数量, 0))), 0), required = rule ? Math.max(1, Math.floor(aiNum(rule.quantity, 1))) : 0;
    let remaining = required;
    if (consume && owned >= required) for (const [key] of rows) { remaining -= aiTakeBucket(bag, key, remaining); if (remaining <= 0) break; }
    return { rule, owned, required, ok: owned >= required && (!consume || remaining <= 0), bag };
  };

  const hudConvertibleValue = item => {
    const text = textOf(item?.details, '') + ' ' + textOf(item?.description, '');
    const hit = text.match(/带出(?:对局)?后[^。\n]{0,12}(?:自动)?转化为\s*(\d+)\s*哈基币/);
    return hit ? Math.max(0, aiNum(hit[1], 0)) : 0;
  };
  const hudExtractionPlan = stat => {
    const carried = [];
    const bag = { ...hudBucketOf(stat, '背包') };
    for (const [key, row] of entriesOf(bag)) {
      const item = itemByName(textOf(row?.名称, ''));
      const value = hudConvertibleValue(item || row);
      if (!value) continue;
      carried.push({ where: '携带', key, name: textOf(row?.名称, key), quantity: Math.max(1, aiNum(row?.数量, 1)), value: value * Math.max(1, aiNum(row?.数量, 1)) });
    }
    const equipment = { ...asObject(stat?.装备) };
    for (const slot of Object.keys(equipment)) {
      const name = textOf(equipment[slot], '无');
      if (!name || name === '无') continue;
      const item = itemByName(hudGearName(name));
      const value = hudConvertibleValue(item);
      if (!value) continue;
      carried.push({ where: '装备', key: slot, name: hudGearName(name), quantity: 1, value });
    }
    const hidden = { ...asObject(stat?.藏匿物) };
    for (const [key, row] of entriesOf(hidden)) {
      const item = itemByName(textOf(row?.名称, key));
      const value = hudConvertibleValue(item || row);
      if (!value) continue;
      carried.push({ where: '藏匿', key, name: textOf(row?.名称, key), quantity: Math.max(1, aiNum(row?.数量, 1)), value: value * Math.max(1, aiNum(row?.数量, 1)) });
    }
    return carried;
  };
  const hudRunExtraction = async (stat, mapName, area) => {
    hkm098RequireAlive();
    await hkm154SyncBattle(await currentStat());
    stat = await currentStat();
    if (!state.run || state.run.map !== mapName || stat.场景?.地图 !== mapName || stat.场景?.区域 !== area) throw Error('对局或区域已变化，撤离停止。');
    if (!GAME_DATA.maps?.[mapName]?.extractAreas?.includes(area)) throw Error('当前区域不是撤离点。');
    const settlementId = hkm098RunId(state.run) + ':extract';
    const entryInventory = state.run.entryInventory || {};
    const killRule=HkmFishing.extraction(state.run,mapName,area);
    if(!killRule.ok){setStatus('撤离条件不满足：'+killRule.text);return false;}
    if(hudInCombat(stat))throw Error('战斗中无法撤离。');
    const payment = hudExtractPayment(stat, mapName, area, true), { rule, bag } = payment;
    if (!payment.ok) { setStatus('撤离条件不满足：' + textOf(rule?.label, '条件不够') + '。'); return false; }
    const brought = HkmLifecycle.extraction({ ...stat, 钥匙链:hudValuedKeychain(stat), 背包: { ...asObject(stat.背包), 携带收藏品: bag } }, entryInventory, hkm098Resolve);

    const plan = hudExtractionPlan(stat);
    const equipment = { ...asObject(stat?.装备) };
    const hidden = { ...asObject(stat?.藏匿物) };
    let cash = 0;
    for (const row of plan) {
      if (row.where === '携带') aiTakeBucket(bag, row.name, row.quantity);
      else if (row.where === '装备') equipment[row.key] = '无';
      else delete hidden[row.key];
      cash += row.value;
    }
    const battle=HkmBattle.summary(state.run),runKills=battle.playerKills;
    const clearMap=HkmBattle.clear(state.run);
    const noLivingUnits=clearMap && battle.npcs>0 && battle.npcKills>=Math.ceil(battle.npcs/3) && Object.keys(asObject(stat.敌人)).length===0 && !(typeof aiNpcsAlive==='function' && aiNpcsAlive().some(npc=>aiNum(npc?.hp,0)>0));
    const achievements=HkmAchievements.observeExtraction(state.achievements,brought,mapName,{runKills,clearMap,noLivingUnits});
    const stats = HkmLifecycle.endStats(stat.统计信息, true, brought);
    const codex = HkmCodex.record(state.codex, brought.rows, hkm098Resolve);
    stats.哈基币 = aiNum(stats.哈基币, 0) + cash;
    const bagBox = { ...asObject(stat?.背包), 携带收藏品: bag };
    const hero = hudHeroStats({ ...asObject(stat), 场景:{...asObject(stat.场景),地图:'哈基米空间',区域:'中转站'}, 主角: { ...asObject(stat?.主角), 临时加成: {}, 当前血量: aiNum(stat?.主角?.血量上限, 20) } }, equipment, bagBox);
    const questPatch = questProgressPatch(stat, {
      kind: 'extract',
      map: mapName,
      area,
      itemCount: brought.rows.reduce((sum, row) => sum + Math.max(0, Number(row.quantity) || 0), 0),
      broughtRows: brought.rows.map(row => ({ ...row, rarity: textOf(itemByName(row.name)?.rarity, row.rarity || ''), category: textOf(itemByName(row.name)?.category, row.category || '') })),
    }, { 统计信息: stats, 背包: bagBox });
    await hkm098Transact(settlementId, {
      ...questPatch,
      场景: { ...asObject(stat?.场景), 地图: '哈基米空间', 区域: '中转站', 剩余交互轮数: '0', 剩余水下行动值:'0',水下机制版本:1,是否战斗中: false },
      背包: questPatch.背包 || bagBox,
      装备: equipment,
      藏匿物: hidden,
      状态列表: {},
      统计信息: questPatch.统计信息 || stats,
      主角: { ...hero, 临时加成: {}, 是否死亡: false, 致命溢出伤害: 0, 当前血量: Math.max(1, aiNum(hero.血量上限, 20)) },
      敌人: {}, 散落物品: {},
    }, { codex, achievements, run: null, specials: {}, lastMap: '哈基米空间', lastArea: '中转站' }, hudPlayerName(stat)+'选择从'+mapName+'的'+area+'撤离，已成功回到哈基米空间·中转站。历史对局与成功撤离各+1，新增带出价值 '+brought.value+'。');
    await refresh();
    const lines = [
      textOf(state.insuranceLog[settlementId],hudPlayerName(stat)+'选择从'+mapName+'的'+area+'撤离。'),
      '撤离结果：成功。主角已回到哈基米空间·中转站，血量与状态已恢复。',
      rule ? '撤离条件：' + textOf(rule.label, '') + '（已由前端扣除）' : '',
      plan.length ? '局内限定物品已折成哈基币：' + plan.map(row => row.name + '×' + row.quantity + '（' + row.value + '）').join('、') + '，合计 ' + cash + ' 哈基币。' : '',
      '历史对局、成功撤离和历史带出已由前端入账；新增带出价值 ' + brought.value + '，奇异/至宝/神秘数量 ' + ['奇异','至宝','神秘'].map(k=>brought.counts[k]).join('/') + '；哈基币余额 ' + (questPatch.统计信息 || stats).哈基币 + '。',
    ].filter(Boolean);
    hudStashLogSync();
    await sendFrontendUserMessage(wrapSearchResultMessage(lines.join('\n')), { action: 'extract', map: mapName, area, cash, converted: plan.map(row => ({ name: row.name, where: row.where, value: row.value })) }, {coveredSettlementIds:[settlementId]});
    setStatus('撤离成功：回到哈基米空间·中转站' + (cash ? '，局内限定物品折算 ' + cash + ' 哈基币' : '') + '。');
    return true;
  };






  const HUD_HIGH_RARITY = ['奇异', '至宝', '神秘'];


  const hudSellRate = row => {
    const category = textOf(row?.类别, '') || textOf(itemByName(textOf(row?.名称 ?? row?.name, ''))?.category, '');
    if (category.indexOf('武器装备') === 0) return 0.8;
    if (category.indexOf('消耗品') >= 0) return 0.6;
    return 1;
  };
  const hudSellQuote = (row,quantity,stat=currentStatSnapshot,where='背包') => hudDurableValues(row,stat,where).slice(0,quantity).reduce((sum,value)=>sum+Math.max(0,Math.round(value*hudSellRate(row))),0);
  const hudSellUnit = (row,stat=currentStatSnapshot,where='背包') => hudSellQuote(row,1,stat,where);
  const hudSellRateText = row => Math.round(hudSellRate(row) * 100) + '%';
  const hudRarityOf = row => textOf(row?.稀有度 ?? row?.rarity, '寻常');
  const hudIsHighRarity = row => HUD_HIGH_RARITY.includes(hudRarityOf(row));

  const hudBucketRowOf = (stat, where, name) => Object.values(hudBucketOf(stat, where)).find(row => textOf(row?.名称, '') === textOf(name, '')) || null;
  const hudCategoryTagOf = (stat, name) => {
    const row = hudBucketRowOf(stat, hudBatchOf().where, name);
    const category = textOf(row?.类别, '') || textOf(itemByName(name)?.category, '');
    return category.split('/')[0].split('-')[0];
  };
  const hudBatchOf = () => {
    const box = asObject(state.sellBatch);
    const where = textOf(box.where, '') === '安全屋' ? '安全屋' : '背包';
    return {
      open: box.open === true,
      where,
      mode: textOf(box.mode, '') === 'store' ? 'store' : 'sell',
      list: asObject(box.list),
      rarities: Array.isArray(box.rarities) ? box.rarities.map(row => textOf(row, '')).filter(Boolean) : [],
      categories: Array.isArray(box.categories) ? box.categories.map(row => textOf(row, '')).filter(Boolean) : [],
    };
  };
  const hudBatchSave = next => {
    const current = hudBatchOf();
    const where = textOf(next?.where, current.where) === '安全屋' ? '安全屋' : '背包';
    state.sellBatch = {
      open: next?.open === true,
      where,
      mode: textOf(next?.mode, current.mode) === 'store' ? 'store' : 'sell',
      list: asObject(next?.list),
      rarities: Array.isArray(next?.rarities) ? next.rarities : [],
      categories: Array.isArray(next?.categories) ? next.categories : [],
    };
    saveFrontendState(state);
  };
  const hudBatchRows = stat => Object.entries(hudBatchOf().list)
    .map(([name, quantity]) => {
      const row = hudBucketRowOf(stat, hudBatchOf().where, name);
      if (!row) return null;
      const have = Math.max(1, aiNum(row.数量, 1));
      const take = Math.min(have, Math.max(1, aiNum(quantity, 1)));
      const total=hudSellQuote(row,take,stat,hudBatchOf().where);
      return { name, quantity: take, unit: Math.round(total/take*100)/100, total, high: hudIsHighRarity(row), rarity: hudRarityOf(row) };
    })
    .filter(Boolean);

  const hudBatchAdjust = (name, delta) => {
    const batch = hudBatchOf();
    const row = hudBucketRowOf(currentStatSnapshot || {}, hudBatchOf().where, name);
    if (!row) return;
    const have = Math.max(1, aiNum(row.数量, 1));
    const current = Math.max(0, aiNum(batch.list[name], 0));
    const next = Math.max(0, Math.min(have, current + (delta >= 0 ? 1 : -1)));
    if (next <= 0) delete batch.list[name];
    else batch.list[name] = next;
    hudBatchSave({ open: true, list: batch.list, rarities: batch.rarities, categories: batch.categories });
    hudRenderBatchWindow();

    if (currentStatSnapshot) renderCollectionCards({ body: bagListBox }, asObject(currentStatSnapshot.背包)?.携带收藏品, '背包为空。', '背包', { scroll: true });
    if (!next) {
      setStatus('已把「' + name + '」从待处理清单拿掉（物品本来就没动过）。');
      return;
    }
    setStatus('「' + name + '」' + (batch.mode === 'store' ? '待入库 ' : '待售 ') + next + '/' + have + (batch.mode === 'store' ? '；确认后才搬进安全屋，背包现在不动。' : '；结算时才真正卖出，物品现在不动。'));
  };
  const hudBatchAdd = (name, quantity = 1) => hudBatchAdjust(name, quantity);
  const hudBatchRemove = name => {
    const batch = hudBatchOf();
    delete batch.list[name];
    hudBatchSave({ open: true, list: batch.list, rarities: batch.rarities, categories: batch.categories });
    hudRenderBatchWindow();
  };
  const hudConfirmDialog = options => {
    const mask = hudPromptMask();
    const box = make('div', 'hkm-reset-prompt');
    box.append(make('div', 'hkm-reset-prompt-title', textOf(options?.title, '确认')));
    if (options?.note) box.append(make('p', 'hkm-reset-small', textOf(options.note, '')));
    const actions = make('div', 'hkm-reset-prompt-actions');
    const cancel = make('button', 'hkm-reset-mini', '取消');
    const confirm = make('button', 'hkm-reset-mini', textOf(options?.confirmText, '确认'));
    const close = () => mask.remove();
    cancel.addEventListener('click', close);
    mask.addEventListener('click', event => { if (event.target === mask) close(); });
    confirm.addEventListener('click', () => {
      close();
      if (typeof options?.onConfirm === 'function') options.onConfirm();
    });
    actions.append(cancel, confirm);
    box.append(actions);
    mask.append(box);
    hkmPortal.append(mask);
    hkmOwnNodes(mask);
  };

  const hudSellEntries = async (stat, entries, where = '背包') => {
    const rows = (Array.isArray(entries) ? entries : []).filter(row => row && textOf(row.name, '') && aiNum(row.quantity, 0) > 0);
    if (!rows.length) return 0;
    const bucket = { ...hudBucketOf(stat, where) };
    const stats = { ...asObject(stat?.统计信息) };
    const sold = [];
    const ledger=HkmFishing.reconcile(stat,GAME_DATA);
    let money = 0;
    for (const entry of rows) {
      const row = Object.values(bucket).find(item => textOf(item?.名称, '') === entry.name);
      if (!row) continue;
      const have = Math.max(1, aiNum(row.数量, 1));
      const take = Math.min(have, Math.max(1, aiNum(entry.quantity, 1)));
      const price=hudSellQuote(row,take,stat,where);
      for(const instance of hudDurableLineRows(row,stat,where).slice(0,take))delete ledger.instances[instance.uid];
      aiTakeBucket(bucket, entry.name, take);
      money += price;
      sold.push(entry.name + '×' + take);
      queueItemMove(entry.name, where === '安全屋' ? '安全屋' : '背包', '售出');
    }
    if (!sold.length) return 0;
    stats.哈基币 = aiNum(stats.哈基币, 0) + money;
    const patch = { 统计信息: stats,渔具状态:ledger };
    if (hudBucketKey(where) === '安全屋') {
      patch.安全屋 = { ...asObject(stat?.安全屋), 收藏品: bucket };
    } else {
      const bagBox = { ...asObject(stat?.背包), 携带收藏品: bucket };
      patch.背包 = bagBox;
      patch.主角 = hudBurdenPatch(stat, bagBox);
    }
    await hudCommit(patch);
    setStatus('已出售 ' + sold.length + ' 项，共 ' + money + ' 哈基币：' + sold.join('、') + '。');
    return money;
  };
  const hudSellWithGuard = (stat, entries, where, after) => {
    const rows = (Array.isArray(entries) ? entries : []);
    const high = rows.filter(row => row.high);
    const run = async () => {
      try {
        await hudSellEntries(stat, rows.map(row => ({ name: row.name, quantity: row.quantity })), where);
      } finally {

        hudCloseItemPanel();
        if (typeof after === 'function') after();
      }
    };
    if (!high.length) { void run(); return; }
    hudConfirmDialog({
      title: '您出售的物品中有高稀有度收藏品，确认是否要出售',
      note: '涉及：' + high.map(row => row.name + '（' + row.rarity + '）').join('、'),
      confirmText: '确认出售',
      onConfirm: () => { void run(); },
    });
  };

  const sellWindow = make('section', 'hkm-reset-sellwin');
  sellWindow.hidden = true;
  hudApplyWinPos(sellWindow, 'sell', { left: Math.round(Math.max(12, Math.min((window.innerWidth || 1200) - 470, 340))) + 'px', top: '120px' });
  hkmPortal.append(sellWindow);
  hkmOwnNodes(sellWindow);
  let hudSellSession = null;
  const hudCloseSellWindow = () => { sellWindow.hidden = true; hudSellSession = null; };
  const hudRenderSellWindow = (stat = currentStatSnapshot) => {
    if (!hudSellSession || sellWindow.hidden) return;
    const { name, where } = hudSellSession;
    const row = Object.values(hudBucketOf(stat || {}, where)).find(item => textOf(item?.名称, '') === name) || null;
    clear(sellWindow);
    const head = make('div', 'hkm-reset-sellwin-head hkm-reset-drag');
    head.title = '按住这里可以拖动窗口（位置会记住）';
    const close = make('button', 'hkm-reset-ip-close', '✕');
    close.type = 'button';
    close.addEventListener('click', hudCloseSellWindow);
    head.append(make('h3', 'hkm-reset-sellwin-title', '出售 · ' + name), close);
    sellWindow.append(head);
    if (!row) {

      hudCloseSellWindow();
      return;
    }
    const have = Math.max(1, aiNum(row.数量, 1));
    const want = Math.min(have, Math.max(1, aiNum(hudSellSession.quantity, have)));
    hudSellSession.quantity = want;
    const total=hudSellQuote(row,want,stat,where),unit=Math.round(total/want*100)/100;
    sellWindow.append(make('div', 'hkm-reset-small', hudBucketLabel(where) + ' · ' + (want>1?'平均单价 ':'单价 ') + unit + ' 哈基币（价值的 ' + hudSellRateText(row) + '）' + (hudIsHighRarity(row) ? ' · 高稀有度' : '')));
    const line = make('div', 'hkm-reset-sellline');
    const minus = make('button', 'hkm-reset-mini', '−');
    const plus = make('button', 'hkm-reset-mini', '＋');
    const count = make('span', 'hkm-reset-sellcount', '×' + want + ' / ' + have);
    minus.type = 'button';
    plus.type = 'button';
    minus.disabled = want <= 1;
    plus.disabled = want >= have;
    minus.addEventListener('click', () => { hudSellSession.quantity = Math.max(1, want - 1); hudRenderSellWindow(stat); });
    plus.addEventListener('click', () => { hudSellSession.quantity = Math.min(have, want + 1); hudRenderSellWindow(stat); });
    line.append(make('span', 'hkm-reset-small', '数量'), minus, count, plus);
    sellWindow.append(line);
    sellWindow.append(make('div', 'hkm-reset-selltotal', '合计 ' + total + ' 哈基币'));
    const actions = make('div', 'hkm-reset-prompt-actions');
    const cancel = make('button', 'hkm-reset-mini', '取消');
    const confirm = make('button', 'hkm-reset-mini hkm-reset-primary', '确认售出');
    cancel.type = 'button';
    confirm.type = 'button';
    cancel.addEventListener('click', hudCloseSellWindow);
    confirm.addEventListener('click', hudAction(async () => {
      if (specialBusy) return;
      specialBusy = true;
      try {
        const fresh = await currentStat();
        const current = Object.values(hudBucketOf(fresh, where)).find(item => textOf(item?.名称, '') === name) || row;
        hudSellWithGuard(fresh, [{ name, quantity: want, high: hudIsHighRarity(current), rarity: hudRarityOf(current) }], where, hudCloseSellWindow);
      } finally {
        specialBusy = false;
      }
    }));
    actions.append(cancel, confirm);
    sellWindow.append(actions);
    hudMakeDraggable(sellWindow, 'sell');
  };
  const hudOpenSellConfirm = (name, where, stat) => {
    if (hudReadOnly) { setStatus('这是旧楼层的状态栏，只能查看。'); return; }
    const row = Object.values(hudBucketOf(stat || {}, where)).find(item => textOf(item?.名称, '') === name);
    if (!row) { setStatus(hudBucketLabel(where) + '里没有「' + name + '」。'); return; }
    hudSellSession = { name, where, quantity: Math.max(1, aiNum(row.数量, 1)) };
    sellWindow.hidden = false;
    hudRenderSellWindow(stat);
  };

  const batchWindow = make('section', 'hkm-reset-batchwin');
  batchWindow.hidden = true;
  hudApplyWinPos(batchWindow, 'batch', { left: Math.round(Math.max(12, Math.min((window.innerWidth || 1200) - 470, 40))) + 'px', top: '120px' });
  hkmPortal.append(batchWindow);
  hkmOwnNodes(batchWindow);
  const hudCloseBatchWindow = () => {
    const batch = hudBatchOf();
    hudBatchSave({ open: false, list: batch.list, rarities: batch.rarities, categories: batch.categories });
    batchWindow.hidden = true;
    if (currentStatSnapshot) renderCollectionCards({ body: bagListBox }, asObject(currentStatSnapshot.背包)?.携带收藏品, '背包为空。', '背包', { scroll: true });
  };
  const hudOpenBatchWindow = (stat, scope) => {
    if (hudReadOnly) { setStatus('这是旧楼层的状态栏，只能查看。'); return; }
    if (hudInMatch()) { setStatus('批量出售与入库只在哈基米空间（非对局）可用。'); return; }
    const where = textOf(scope?.where, '') === '安全屋' ? '安全屋' : '背包';
    const mode = textOf(scope?.mode, '') === 'store' ? 'store' : 'sell';
    const batch = { where, mode, list: {}, rarities: [], categories: [] };

    hudBatchSave({ open: true, where, mode, list: {}, rarities: [], categories: [] });
    batchWindow.hidden = false;
    hudRenderBatchWindow(stat);
    if (currentStatSnapshot) renderCollectionCards({ body: bagListBox }, asObject(currentStatSnapshot.背包)?.携带收藏品, '背包为空。', '背包', { scroll: true });
    if (currentStatSnapshot) renderCollectionCards(stashPanel, asObject(currentStatSnapshot.安全屋)?.收藏品, '安全屋暂无收藏品。', '安全屋');
  };
  const hudRenderBatchWindow = (stat = currentStatSnapshot) => {
    if (batchWindow.hidden) return;
    clear(batchWindow);
    const batch = hudBatchOf();
    const rows = hudBatchRows(stat || {});
    const total = rows.reduce((sum, row) => sum + row.total, 0);
    const head = make('div', 'hkm-reset-sellwin-head hkm-reset-drag');
    head.title = '按住这里可以拖动窗口（位置会记住）';
    const close = make('button', 'hkm-reset-ip-close', '✕');
    close.type = 'button';
    close.addEventListener('click', hudCloseBatchWindow);
    head.append(make('h3', 'hkm-reset-sellwin-title', (batch.mode === 'store' ? '批量入库 · ' : '批量出售 · ') + (batch.where === '安全屋' ? '安全屋收藏品' : '携带收藏品')), close);
    batchWindow.append(head);
    batchWindow.append(make('div', 'hkm-reset-small', batch.mode === 'store'
      ? '点收藏品卡片上的「＋」把东西放进这里（背包不会立刻少）；结算时才真正搬进安全屋。'
      : '点收藏品卡片上的「＋」把东西放进这里（' + (batch.where === '安全屋' ? '安全屋' : '背包') + '不会立刻少）；结算时才真正卖出。'));
    const filters = make('div', 'hkm-reset-batchfilters');
    const rarityRow = make('div', 'hkm-reset-batchrow');
    rarityRow.append(make('span', 'hkm-reset-small', '稀有度'));
    for (const rarity of GAME_DATA.rarityOrder) {
      const chip = make('button', 'hkm-reset-mini', rarity);
      chip.type = 'button';
      chip.dataset.on = String(batch.rarities.includes(rarity));
      chip.addEventListener('click', () => {
        const next = batch.rarities.includes(rarity) ? batch.rarities.filter(row => row !== rarity) : batch.rarities.concat([rarity]);
        hudBatchSave({ open: true, list: batch.list, rarities: next, categories: batch.categories });
        hudRenderBatchWindow(stat);
      });
      rarityRow.append(chip);
    }
    filters.append(rarityRow);
    const categories = [];
    for (const row of Object.values(hudBucketOf(stat || {}, batch.where))) {
      const name = textOf(row?.名称, '');
      const tag = hudCategoryTagOf(stat || {}, name);
      if (tag && !categories.includes(tag)) categories.push(tag);
    }
    if (categories.length) {
      const categoryRow = make('div', 'hkm-reset-batchrow');
      categoryRow.append(make('span', 'hkm-reset-small', '类别'));
      for (const tag of categories) {
        const chip = make('button', 'hkm-reset-mini', tag);
        chip.type = 'button';
        chip.dataset.on = String(batch.categories.includes(tag));
        chip.addEventListener('click', () => {
          const next = batch.categories.includes(tag) ? batch.categories.filter(row => row !== tag) : batch.categories.concat([tag]);
          hudBatchSave({ open: true, list: batch.list, rarities: batch.rarities, categories: next });
          hudRenderBatchWindow(stat);
        });
        categoryRow.append(chip);
      }
      filters.append(categoryRow);
    }
    batchWindow.append(filters);
    const pickActions = make('div', 'hkm-reset-prompt-actions');
    const pickAll = make('button', 'hkm-reset-mini', '按条件加入全部');

    const clearButton = make('button', 'hkm-reset-mini', '清空清单');
    pickAll.type = 'button';
    clearButton.type = 'button';
    pickAll.addEventListener('click', () => {
      const next = { ...batch.list };
      for (const row of Object.values(hudBucketOf(stat || {}, batch.where))) {
        const name = textOf(row?.名称, '');
        if (!name) continue;
        const hasFilter = batch.rarities.length > 0 || batch.categories.length > 0;
        const rarityHit = !batch.rarities.length || batch.rarities.includes(hudRarityOf(row));
        const categoryHit = !batch.categories.length || batch.categories.includes(hudCategoryTagOf(stat || {}, name));
        if (hasFilter && !(rarityHit && categoryHit)) continue;
        next[name] = Math.max(1, aiNum(row.数量, 1));
      }
      hudBatchSave({ open: true, list: next, rarities: batch.rarities, categories: batch.categories });
      hudRenderBatchWindow(stat);
    });
    clearButton.addEventListener('click', () => {
      hudBatchSave({ open: true, list: {}, rarities: batch.rarities, categories: batch.categories });
      hudRenderBatchWindow(stat);
    });
    pickActions.append(pickAll, clearButton);
    batchWindow.append(pickActions);
    if (!rows.length) {
      batchWindow.append(empty('清单还是空的：点收藏品上的「＋」，或先选条件再「按条件加入全部」。'));
    } else {
      const list = make('div', 'hkm-reset-batchlist');
      for (const row of rows) {
        const line = make('div', 'hkm-reset-batchitem');
        line.style.borderLeftColor = hudTone(row.rarity);
        const name = make('span', 'hkm-reset-batchname', row.name);
        if (row.high) name.style.color = hudTone(row.rarity);
        line.append(
          name,
          make('span', 'hkm-reset-small', '×' + row.quantity + ' · 单价 ' + row.unit),
          make('b', 'hkm-reset-batchsum', String(row.total)),
        );
        const back = make('button', 'hkm-reset-mini', '放回');
        back.type = 'button';
        back.title = '从待处理清单里拿掉（不影响物品）';
        back.addEventListener('click', () => hudBatchRemove(row.name));
        line.append(back);
        list.append(line);
      }
      batchWindow.append(list);
      batchWindow.append(make('div', 'hkm-reset-selltotal', batch.mode === 'store'
        ? '合计 ' + rows.reduce((sum, row) => sum + row.quantity, 0) + ' 件（搬进安全屋，不进账）'
        : '合计 ' + total + ' 哈基币（' + rows.length + ' 项）'));
      const actions = make('div', 'hkm-reset-prompt-actions');
      const confirm = make('button', 'hkm-reset-mini hkm-reset-primary', batch.mode === 'store' ? '确认入库' : '确认售出');
      confirm.type = 'button';
      confirm.addEventListener('click', hudAction(async () => {
        if (specialBusy) return;
        specialBusy = true;
        try {
          const fresh = await currentStat();
          const freshRows = hudBatchRows(fresh);
          if (batch.mode === 'store') {
            const doStore = async () => {
              await hudStoreEntries(fresh, freshRows.map(row => ({ name: row.name, quantity: row.quantity })));
              hudBatchSave({ open: true, where: batch.where, mode: batch.mode, list: {}, rarities: batch.rarities, categories: batch.categories });
              hudRenderBatchWindow(fresh);
            };
            hudConfirmDialog({
              title: '把这 ' + freshRows.length + ' 项放进安全屋？',
              note: '涉及：' + freshRows.map(row => row.name + '×' + row.quantity).join('、') + '（进安全屋后不计负重；穿戴中的装备不在这里，不会被搬走）',
              confirmText: '确认入库',
              onConfirm: () => { void doStore(); },
            });
          } else {
            hudSellWithGuard(fresh, freshRows, batch.where, () => {
              hudBatchSave({ open: true, where: batch.where, mode: batch.mode, list: {}, rarities: batch.rarities, categories: batch.categories });
              hudRenderBatchWindow(fresh);
            });
          }
        } finally {
          specialBusy = false;
        }
      }));
      actions.append(confirm);
      batchWindow.append(actions);
    }
    hudMakeDraggable(batchWindow, 'batch');
  };
  let await_current_stat_placeholder = currentStatSnapshot;

  const renderLootBoxes = (stat, host = null) => {
    const mapName = textOf(stat?.场景?.地图, '');
    const area = textOf(stat?.场景?.区域, '');
    const boxes = aiBoxesHere(mapName, area);
    if (!boxes.length) return 0;
    const target = host || specialPanel.body;
    const grid = make('div', 'hkm-reset-card-grid');
    for (const box of boxes) {
      const card = make('article', 'hkm-reset-card hkm-reset-lootbox');
      const meta = make('div', 'hkm-reset-card-meta');
      meta.append(make('span', 'hkm-reset-chip', '战利品盒'), make('span', 'hkm-reset-chip', `${box.entries.length} 项`));
      card.append(make('h4', '', box.owner + ' 的战利品盒'), meta);
      const list = make('p', 'hkm-reset-small', box.entries.map(entry => textOf(itemById(entry.id)?.name, entry.id) + ' ×' + entry.quantity).join('、'));
      card.append(list);
      const actions = make('div', 'hkm-reset-card-actions');
      const one = make('button', 'hkm-reset-mini', '搜刮');
      one.type = 'button';
      one.title = '打开舔包浮窗：可拿上/装备/藏匿/丢弃，也可一键丢出；舔包不消耗交互轮数';

      if (hudLootLocked(stat)) { one.disabled = true; one.title = HUD_LOOT_LOCK_NOTE; }

      one.addEventListener('click', hudAction(async () => {
        if (specialBusy) return;
        specialBusy = true;
        try { hudOpenBoxWindow(box, await currentStat()); } finally { specialBusy = false; }
      }));
      actions.append(one);
      card.append(actions);
      grid.append(card);
    }
    if (boxes.length > 1) {
      const all = make('button', 'hkm-reset-primary', '一键全部搜刮（不消耗交互轮数）');
      all.type = 'button';
      all.disabled = hudLootLocked(stat);
      if (all.disabled) all.title = HUD_LOOT_LOCK_NOTE;
      all.addEventListener('click', hudAction(async () => {
        if (specialBusy) return;
        specialBusy = true;
        try { await hudLootAll(await currentStat()); } finally { specialBusy = false; }
      }));
      target.append(all);
    }
    target.append(grid);
    return boxes.length;
  };


  let readOnlyBadge = null;
  let readOnlyApplied = null;
  const applyHudReadOnlyUI = () => {
    if (readOnlyApplied === hudReadOnly) return;
    readOnlyApplied = hudReadOnly;
    root.dataset.readonly = String(hudReadOnly);


    if (root.dataset.readonlyGuard !== 'true') {
      root.dataset.readonlyGuard = 'true';
      const block = event => {
        if (!hudReadOnly) return;
        event.stopPropagation();
        event.preventDefault();
        setStatus('这是旧楼层的状态栏，只能查看；操作请用最新一条消息里的状态栏。');
      };
      ['click', 'pointerdown', 'keydown'].forEach(type => root.addEventListener(type, block, true));
    }
    if (hudReadOnly) {
      if (!readOnlyBadge) {
        readOnlyBadge = make('div', 'hkm-reset-readonly', '只读 · 旧楼层');
        head.append(readOnlyBadge);
      }
      setStatus('这是旧楼层的状态栏，只能查看；操作请用最新一条消息里的状态栏。');
    } else if (readOnlyBadge) {
      readOnlyBadge.remove();
      readOnlyBadge = null;
    }
  };

  let hkm098Busy = false;
  let hkm098Internal = 0;
  let hkm098Dialog = null;
  let hkm098DialogSignature = '';
  const hkm098Instance = Symbol('hkm-life-owner');
  globalThis.__HKM_LIFE_OWNER = hkm098Instance;
  const hkm098Resolve = name => itemById(name) || itemByName(hudGearName(name));
  const hkm098RunId = run => run ? (run.id || String(run.map) + ':' + String(run.startedAt)) : '';
  const hkm098Locked = () => state.lifecycleJournal?.phase === 'prepared' || !!(state.death && state.death.phase !== 'resolved') || HkmLifecycle.dead(currentStatSnapshot || {});
  const hkm098OwnerChat = hkm095HostContext()?.chatId;
  const hkm098AssertOwner = (allowRestore=false, allowSend=false) => {
    if (hkmTurnLocked() && !allowSend) throw Error('等待回复，当前前端已锁定。');
    if (globalThis.__HKM_LIFE_OWNER !== hkm098Instance || hudReadOnly || !isLatestHudLayer() || hkm095HostContext()?.chatId !== hkm098OwnerChat) throw Error('聊天或可操作楼层已变化，本次操作停止。');
    if(!allowRestore && HkmSave.pending())throw Error('读档尚未完成，请重试读档或刷新恢复。');
  };
  const hkm098RequireAlive = () => {
    hkm098AssertOwner();
    if (HkmSave.pending()) throw Error('读档尚未完成，请重试读档或刷新恢复。');
    if (hkm098Locked() || hkm098Busy) throw Error('主角已死亡或存在未完成结算，请先完成复活或重试结算。');
  };


  const hkm098ApplyJournal = async () => {
    const tx = state.lifecycleJournal;
    if (!tx || tx.phase !== 'prepared') return false;
    hkm098AssertOwner();
    let current = await currentStat();
    if (asObject(current.前端结算?.回执)[tx.id] !== true) {
      hkm098Internal += 1;
      try {
        hkm098AssertOwner();
        const result = await aiWriteVars(HkmLifecycle.copy(tx.patch));
        if (!result.ok) throw Error('结算写入失败；保持锁定，可重试。');
        hkm098AssertOwner();
        current = await currentStat();
        if (asObject(current.前端结算?.回执)[tx.id] !== true) throw Error('未读到结算回执；保持锁定。');
      } finally { hkm098Internal -= 1; }
    }
    hkm098AssertOwner();
    const after=HkmLifecycle.copy(tx.after);

    if(Object.hasOwn(after,'keychain') && !/^(key-equip:|key-unequip:|key-maintenance:|container:)/.test(String(tx.id))) delete after.keychain;
    Object.assign(state, after);
    state.keychain=hkmKeyPrunedChain(state.keychain);
    if (tx.log && !hkmSilentSettlement(tx.id,tx.log)) state.insuranceLog[tx.id] = String(tx.log).replace('普通物品与钥匙链中的普通钥匙已掉落','普通物品已掉落；钥匙链全部物品与耐久保留');
    state.lifecycleJournal = { id: tx.id, phase: 'applied' };
    hkmAchievementSync(current);
    saveFrontendState(state);
    await hkm095Flush();
    currentStatSnapshot = await currentStat();
    return true;
  };

  const hkm139Friendly = row => {
    if (!row) return false;
    const tags = row.标签 ?? row.tags;
    const values = Array.isArray(tags) ? tags : typeof tags === 'object' && tags ? Object.keys(tags).filter(key => tags[key]) : String(tags || '').split(/[、,，;；\s]+/);
    return row.友善 === true || row.friendly === true || values.some(tag => ['友善', '友好'].includes(String(tag)))
      || /^(友善|友好)$/.test(textOf(row.attitude ?? row.态度, '')) || /(?:^|[·；;,，\s])(?:友善|友好)(?:$|[·；;,，\s])/.test(textOf(row.状态, ''));
  };
  const hkm139NpcFriendly = npc => hkm139Friendly(npc);
  const hkm139PlayerThreat = player => player?.meta === '鼠鼠' ? 2 : player?.meta === '萌新' ? 1 : aiNum(player?.threat ?? player?.威胁等级, 0);
  const hkm139TargetRows = stat => {
    const map = textOf(stat?.场景?.地图, ''), area = textOf(stat?.场景?.区域, ''), rows = new Map();
    const present = row => (!row.地图 || row.地图 === map) && (!row.区域 || row.区域 === area) && !['是','true'].includes(textOf(row.离开区域, ''))
      && !/死亡|阵亡|已撤离/.test(textOf(row.状态, '')) && aiNum(row.当前血量 ?? row.hp ?? String(row.血量 ?? '1').split('/')[0], 1) > 0;
    if (state.run?.map === map) {
      for (const player of aiAlive()) if (player.region === area && aiNum(player.hp, 0) > 0) rows.set(player.name, { player, record: aiEnemyRecord(player) });
      for (const npc of aiNpcsAlive()) if (npc.region === area) rows.set(npc.name, { npc, record: aiNpcRecord(npc) });
    }
    for (const [key, record] of entriesOf(stat?.敌人)) {
      const name = textOf(record?.名称 ?? record?.姓名, key);
      if (!name || name === '无') continue;
      if (!present(record)) { rows.delete(name); continue; }
      rows.set(name, { ...rows.get(name), record: { ...rows.get(name)?.record, ...record } });
    }
    return [...rows.values()];
  };
  const hkm139HostileTargets = stat => hkm139TargetRows(stat).filter(({ player, npc, record }) => {
    if (hkm139Friendly(record) || (npc && hkm139NpcFriendly(npc)) || (player && (hkm139Friendly(player) || aiPeaceful('hero', player.id)))) return false;
    if (player || record.来源 === '其他玩家') return hkm139PlayerThreat(player || record) > 3;
    return ['敌对', '中立-敌对'].includes(hudNpcAttitude({ ...npc, ...record }));
  });
  const hkm142EscapeTargets = stat => hkm139TargetRows(stat).filter(({ player, npc, record }) =>
    !hkm139Friendly(record) && !hkm139NpcFriendly(npc) && !(player && (hkm139Friendly(player) || aiPeaceful('hero', player.id))));
  const hkm139LootEscape = stat => {
    const map = textOf(stat?.场景?.地图, ''), area = textOf(stat?.场景?.区域, '');
    return state.run?.map === map && Object.values(hkmActionPenaltyOf(state.actionPenalty).events).some(event => event.kind === 'loot' && event.map === map && event.area === area)
      && hkm139HostileTargets(stat).length > 0;
  };
  const hkm139BlockedEscape = async stat => {
    const penalty = hkmActionPenaltyOf(state.actionPenalty);
    if (Object.values(penalty.events).some(event => event.kind === 'blockedEscape')) return;
    const line = hudPlayerName(stat) + '拿走区域散落物后试图开溜，但被场上的单位阻止了！本轮她受到的折前伤害提高30%!( 受到防御力减免之前的伤害)。';
    const id = 'blocked-escape:' + Date.now() + ':' + (++hkm095QueueSerial);
    penalty.events[id] = { kind: 'blockedEscape', text: line };
    await hkm098Transact(id, {}, { actionPenalty: penalty });
  };
  const hkm139HeroSoundLines = (map, area, context) => {
    const grid = GAME_DATA.maps?.[map]?.grid || [], positions = new Map();
    grid.forEach((line, r) => line.forEach((cell, c) => { if (cell?.name) positions.set(cell.name, [r,c]); }));
    const origin = positions.get(area), lines = new Map();
    for (const sound of context.sounds) {
      if (sound.actor === 'hero' || !sound.heardIn.has(area)) continue;
      const pos = positions.get(sound.area);
      if (!origin || !pos) continue;
      const dr = Math.sign(pos[0]-origin[0]), dc = Math.sign(pos[1]-origin[1]);
      const direction = dr === 0 && dc === 0 ? '当前区域' : dr === 0 ? (dc < 0 ? '正左方' : '正右方') : dc === 0 ? (dr < 0 ? '正上方' : '正下方') : (dc < 0 ? '左' : '右') + (dr < 0 ? '上方' : '下方');
      lines.set(sound.area + ':' + sound.kind, hudPlayerName(context.stat) + '听到' + direction + '的' + sound.area + '有' + sound.kind + '。');
    }
    return [...lines.values()];
  };
  const hkm139MouseBossEscape = (map, player) => {
    if (!aiMouseProfile(player)) return false;
    const boss = aiNpcsAlive().find(npc => npc.region === player.region && aiNum(npc.threat, hudNpcThreat(npc.name)) >= 5 && !hkm139NpcFriendly(npc) && ['敌对','中立-敌对'].includes(npc.attitude));
    return boss ? aiMouseEscape(map, player, boss) : false;
  };

  function hkmActionPenaltyOf(raw) {
    const value = asObject(raw);
    return { floor: hkmTurnOrigin, events: value.floor === hkmTurnOrigin && hkmTurnOrigin >= 0 ? { ...asObject(value.events) } : {} };
  }
  const hkmActionPenaltyPlan = (current, patch, after, id, kind, count = 1) => {
    const changed = key => Object.prototype.hasOwnProperty.call(patch, key) && JSON.stringify(patch[key]) !== JSON.stringify(current[key]);
    const effective = kind === 'use' || kind === 'search' || (kind === 'gear' && (changed('装备') || changed('渔具状态')))
      || (kind === 'loot' && (changed('背包') || (Object.prototype.hasOwnProperty.call(after, 'run') && JSON.stringify(after.run?.boxes) !== JSON.stringify(state.run?.boxes))));
    if (!effective || !['use', 'gear', 'loot', 'search'].includes(kind)) return after;
    const penalty = hkmActionPenaltyOf(state.actionPenalty);
    const context = { ...current, ...patch };
    if (kind === 'search' && !hkm139TargetRows(context).length) return after;
    penalty.events[id] = { kind, count: Math.max(1, Math.floor(aiNum(count, 1))), map: textOf(current.场景?.地图, ''), area: textOf(current.场景?.区域, '') };
    return { ...after, actionPenalty: penalty };
  };
  const hkmActionPenaltySnapshot = (latest, stat) => Object.fromEntries(Object.entries(hkmActionPenaltyOf(latest.actionPenalty).events)
    .filter(([,event]) => ['search','blockedEscape'].includes(event.kind) || hudCombatFlagOn(stat)));
  const hkmActionPenaltyText = events => {
    const values = Object.values(asObject(events)), lines = [];
    const count = values.filter(event => ['use','gear','loot'].includes(event.kind)).reduce((total, event) => total + Math.max(0, Math.floor(aiNum(event?.count, 0))), 0);
    if (count) lines.push('本次回复的战斗结算：本轮已实际完成 ' + count + ' 次装备更替、使用收藏品、搜刮或拾取；主角受到的伤害增加 ' + (count * 3) + '%，造成的伤害减少 ' + (count * 2) + '%（造成的伤害最低为 0）。按百分比加总，只影响本次回复，不写入永久属性或持续状态，后续回复不沿用。');
    if (values.some(event => event.kind === 'search')) lines.push('本轮搜索时区域内有其他目标；本轮主角受到的折前伤害提高30%（受到防御力减免之前的伤害）。仅影响本次回复，不写入永久属性或持续状态，后续回复不沿用。');
    return lines.join('\n');
  };
  const hkmActionPenaltyAcknowledge = (latest, snapshot) => {
    const penalty = hkmActionPenaltyOf(latest.actionPenalty);
    for (const [id, event] of Object.entries(asObject(snapshot))) {
      if (JSON.stringify(penalty.events[id]) === JSON.stringify(event)) delete penalty.events[id];
    }
    latest.actionPenalty = penalty;
    return penalty;
  };
  const hkm098Transact = async (id, patch, after = {}, log = '', actionKind = '', actionCount = 1, expected = null) => {
    hkm098AssertOwner();
    if (hkm098Busy) throw Error('上一笔结算尚未结束。');
    hkm098Busy = true;
    try {
      if (state.lifecycleJournal?.phase === 'prepared') await hkm098ApplyJournal();
      const current = await currentStat();
      if (asObject(current.前端结算?.回执)[id] === true) return false;
      if(expected && JSON.stringify(current)!==JSON.stringify(expected))throw Error('状态已变化，请重新选择后重试。');
      if(/^(key-equip:|key-unequip:)/.test(String(id)) && hkmKeychainLocked(current))throw Error('对局中不能整理钥匙链，请回哈基米空间。');
      patch=hkmFishingPreparePatch(current,patch,id,{...state,...after});
      const homePlan=hkmHomeLifecycle(current,patch,after,log);patch=homePlan.patch;after=homePlan.after;log=homePlan.log;
      after = hkmActionPenaltyPlan(current, patch, after, id, actionKind, actionCount);
      const receipts = { ...asObject(current.前端结算?.回执), ...asObject(patch.前端结算?.回执), [id]: true };
      state.lifecycleJournal = { id, phase: 'prepared', patch: { ...HkmLifecycle.copy(patch), 前端结算: { ...asObject(current.前端结算), ...asObject(patch.前端结算), 回执: receipts } }, after: HkmLifecycle.copy(after), log };
      saveFrontendState(state);
      await hkm095Flush();
      await hkm098ApplyJournal();
      return true;
    } finally { hkm098Busy = false; }
  };
  const hkm098CloseDeath = () => {
    for(const node of [host,hkmPortal])node.classList.remove('hkm-life-locked');
    hkm098Dialog?.remove(); hkm098Dialog = null; hkm098DialogSignature = '';
  };



  const hkm098Revive = async mode => {
    hkm098AssertOwner();
    const snapshot = state.death;
    if (snapshot?.inventory && !Object.hasOwn(snapshot.inventory,'钥匙链')) snapshot.inventory.钥匙链=HkmLifecycle.copy(asObject(state.keychain));
    if (!snapshot || hkm098Busy) return;
    const stat = await currentStat();
    if (mode === 'ransom') {
      const offer = HkmLifecycle.ransom(stat, state.run, snapshot, hkm098Resolve);
      if (!offer.enabled) throw Error(offer.used ? '本局人寿保险已使用。' : '无法赎金复活：未装备法典、不在对局内或哈基币不足。');
      const nextRun = { ...HkmLifecycle.copy(state.run), lifeInsuranceUsed: true };
      const hero = { ...asObject(stat.主角), 当前血量: offer.hp, 是否死亡: false, 致命溢出伤害: 0 };
      const nextDeath = null;
      await hkm098Transact(snapshot.id + ':ransom', { 主角: hero, 统计信息: { ...asObject(stat.统计信息), 哈基币: aiMoney(stat) - offer.fee } }, { run: nextRun, death: nextDeath }, hudPlayerName(stat)+'选择赎金复活，本局人寿保险次数已消耗，花费 ' + offer.fee + ' 哈基币；扣除致命溢出伤害后血量为 ' + offer.hp + '。' + (offer.hp > 0 ? '原地图与区域保留。' : '血量仍为0。'));
    } else {
      snapshot.phase = 'choices';
      const plan = HkmLifecycle.lossPlan(snapshot, hkm098Resolve, snapshot.choices);
      if (plan.insured.length) { saveFrontendState(state); hkm098RenderDeath(stat); return; }
      const stash = HkmLifecycle.copy(asObject(stat.安全屋?.收藏品));
      for (const row of plan.stashGrants) {
        const old = asObject(stash[row.名称]);
        stash[row.名称] = { ...row, 数量: aiNum(old.数量, 0) + row.数量 };
      }
      const inRun = !!state.run && state.run.map === snapshot.map;
      const stats = inRun ? HkmLifecycle.endStats(stat.统计信息, false) : { ...asObject(stat.统计信息) };
      stats.哈基币 = aiNum(stats.哈基币, 0) - plan.fee;
      const calibratedHero = hudHeroStats(stat, asObject(stat.装备), asObject(stat.背包));
      const cleanHero = { ...calibratedHero, 临时加成: {}, 当前血量: snapshot.maxHp, 是否死亡: false, 致命溢出伤害: 0 };
      const inventory=HkmLifecycle.copy(plan.inventory); delete inventory.钥匙链;
      const keyDurability=Object.fromEntries(Object.entries(asObject(state.keyDurability)).filter(([name])=>inventory.背包?.携带收藏品?.[name]));
      const hero = hudHeroStats({ ...stat, ...inventory, 场景:{...asObject(stat.场景),地图:'哈基米空间',区域:'中转站'}, 主角: cleanHero }, inventory.装备, inventory.背包);
      hero.当前血量 = hero.血量上限;
      const patch = { ...inventory, 安全屋: { ...asObject(stat.安全屋), 收藏品: stash }, 主角: hero,
        场景: { ...asObject(stat.场景), 地图: '哈基米空间', 区域: '中转站', 剩余交互轮数: '0', 剩余水下行动值:'0',水下机制版本:1,是否战斗中:false },
        统计信息: stats, 敌人: {}, 散落物品: {}, 状态列表: {} };

      const achievementPlan = { dropped: (plan.dropped || []).map(row => ({ ...row, rarity: hkm098Resolve(row.name)?.rarity || '寻常' })), paid: (plan.paid || []).map(row => ({ ...row, rarity: hkm098Resolve(row.name)?.rarity || '寻常' })) };
      const achievements = inRun ? HkmAchievements.observeLoss(state.achievements, achievementPlan) : state.achievements;
      const after = { keyDurability, death: null, run: null, insurance: null, gearPending: {}, usePending: [], itemMoves: {}, stashLog: { in: [], out: [] }, specials: {}, lastMap: '哈基米空间', lastArea: '中转站', achievements };
      const log = hudPlayerName(stat)+'选择回城复活，已返回哈基米空间·中转站，满血。' + (snapshot.keepInventory ? '本次死亡不掉落，装备、背包、藏匿物与钥匙链均保留。' : '普通物品已掉落；奇物、钥匙链全部物品与耐久、灵魂绑定及受保护藏匿物保留；保险赎回 ' + plan.paid.length + ' 项，扣款 ' + plan.fee + ' 哈基币。') + (inRun ? '历史对局总数已+1；撤离次数与历史带出统计不增加。请按原任务协议处理本局战局任务，结算已完成项、移除失败项，' : '安全区死亡不计为一局。');
      await hkm098Transact(snapshot.id + ':return', patch, after, log);
    }
    hkm098CloseDeath();
    await refresh();
  };
  const hkm098RenderDeath = stat => {
    if (!state.death && state.lifecycleJournal?.phase !== 'prepared') { hkm098CloseDeath(); return; }
    for(const node of [host,hkmPortal])node.classList.add('hkm-life-locked');
    const offer = state.death ? HkmLifecycle.ransom(stat, state.run, state.death, hkm098Resolve) : { visible: false };
    const signature = JSON.stringify([state.death, offer, aiMoney(stat), hudReadOnly, state.lifecycleJournal?.phase]);
    if (hkm098Dialog && signature === hkm098DialogSignature) return;
    hkm098DialogSignature = signature;
    if (!hkm098Dialog) {
      hkm098Dialog = make('section', 'hkm-life-dialog');
      hkm098Dialog.setAttribute('role', 'dialog'); hkm098Dialog.setAttribute('aria-modal', 'true');
      hkm098Dialog.setAttribute('aria-label', '主角死亡与复活');
      hkmPortal.append(hkm098Dialog);
    }
    clear(hkm098Dialog);
    hkm098Dialog.append(make('h2', '', state.death ? '主角已死亡' : '结算等待恢复'));
    if (state.death) hkm098Dialog.append(make('p', '', '当前区域：' + state.death.map + ' · ' + state.death.area), make('p', '', state.death.keepInventory ? '本次死亡不掉落物品。' : '点击复活后结算死亡掉落，并回到中转站；钥匙链内物品和耐久始终保留。'));
    const act = (label, mode, disabled = false, primary = true) => {
      const button = make('button', primary ? 'hkm-reset-primary hkm-life-revive' : 'hkm-reset-mini', label); button.type = 'button'; button.disabled = disabled || hudReadOnly || hkm098Busy;
      button.addEventListener('click', () => { hkm098Revive(mode).catch(error => { setStatus(error.message); hkm098Dialog?.append(make('p', 'hkm-life-error', error.message)); }); });
      return button;
    };
    if (state.lifecycleJournal?.phase !== 'prepared' && state.death?.phase === 'choices') {
      const pending = HkmLifecycle.lossPlan(state.death, hkm098Resolve, state.death.choices).insured;
      for (const row of pending) {
        const line = make('div', 'hkm-life-insurance'); line.append(make('p', '', row.name + ' ×' + row.quantity + ' · 赎回 ' + row.fee + ' 哈基币（可欠债）'));
        for (const [choice, label] of [['pay','缴纳赎回'], ['waive','放弃掉落']]) {
          const button = make('button', 'hkm-reset-mini', label); button.type = 'button';
          button.addEventListener('click', async () => { try { hkm098AssertOwner(); if (hkm098Busy) return; state.death.choices[row.token] = choice; saveFrontendState(state); await hkm095Flush(); hkm098RenderDeath(await currentStat()); } catch(e) { setStatus(e.message); } }); line.append(button);
        }
        hkm098Dialog.append(line);
      }
      const summary = HkmLifecycle.lossPlan(state.death, hkm098Resolve, state.death.choices);
      hkm098Dialog.append(make('p', '', '已选保险赎回合计：' + summary.fee + ' 哈基币。选择确认后，点击下方按钮应用结算。'));
      hkm098Dialog.append(act('复活', 'return', pending.length > 0));
    } else if (state.death && state.lifecycleJournal?.phase !== 'prepared') hkm098Dialog.append(act('复活', 'return'));
    if (offer.visible && state.lifecycleJournal?.phase !== 'prepared') {
      const label = offer.used ? '赎金复活 · 本局已使用' : '赎金复活 · ' + offer.fee + ' 哈基币';
      hkm098Dialog.append(act(label, 'ransom', !offer.enabled, false));
      hkm098Dialog.append(make('p', '', offer.used ? '人寿保险每局只能执行一次。' : !state.run ? '人寿保险仅在对局中生效。' : aiMoney(stat) < offer.fee ? '哈基币不足，无法赎金复活。' : '恢复半血并扣除致命攻击的剩余伤害，保留原战局。'));

    }
    if (state.lifecycleJournal?.phase === 'prepared') {
      const retry = make('button', 'hkm-reset-mini', '重试未完成结算');
      retry.addEventListener('click', async () => { if (hkm098Busy) return; hkm098Busy=true; try { await hkm098ApplyJournal(); } catch(e) { setStatus(e.message); } finally { hkm098Busy=false; await refresh(); } }); hkm098Dialog.append(retry);
    }

    hkm098Dialog.querySelector('button:not(:disabled)')?.focus();
  };
  const hkm098CheckDeath = async stat => {
    if (hudReadOnly) { hkm098CloseDeath(); return false; }
    if (!HkmLifecycle.dead(stat)) {
      if (state.death) { state.death = null; saveFrontendState(state); await hkm095Flush(); }
      hkm098CloseDeath(); return false;
    }
    if (state.death) { hkm098RenderDeath(stat); return true; }
    state.death = HkmLifecycle.capture({...stat,钥匙链:state.keychain}, state.run, state.rules, (hkm098RunId(state.run) || 'safe') + ':death:' + hudRoundKey() + ':' + Date.now());
    state.insurance = null;
    saveFrontendState(state); await hkm095Flush();
    hkm098RenderDeath(stat);
    return true;
  };
  const hkm098CaptureGuard = event => {
    if (globalThis.__HKM_LIFE_OWNER !== hkm098Instance || !isLatestHudLayer() || hkm095HostContext()?.chatId !== hkm098OwnerChat || (!hkm098Locked() && !HkmSave.pending())) return;
    const target = event.target;
    if(target?.closest?.('.hkm-save-ui'))return;
    if (target?.closest?.('.hkm-life-dialog')) {
      if (event.type === 'keydown' && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); }
      if (event.type === 'keydown' && event.key === 'Tab') {
        const buttons = [...hkm098Dialog.querySelectorAll('button:not(:disabled)')];
        const i = buttons.indexOf(document.activeElement);
        if (buttons.length) { event.preventDefault(); buttons[(i + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length].focus(); }
      }
      return;
    }
    const local = hkmOwnTarget(target);
    const gameSend = target?.closest?.('#send_but, #send_textarea');
    if (local || gameSend) { event.preventDefault(); event.stopImmediatePropagation(); setStatus(HkmSave.pending()?'读档尚未完成，请重试读档或刷新恢复。':'主角已死亡，请先选择复活。'); }
  };
  for (const type of ['click','pointerdown','keydown','submit']) {
    document.addEventListener(type, hkm098CaptureGuard, true);
    disposers.push(() => document.removeEventListener(type, hkm098CaptureGuard, true));
    try { const doc = window.parent.document; if (doc !== document) { doc.addEventListener(type, hkm098CaptureGuard, true); disposers.push(() => doc.removeEventListener(type, hkm098CaptureGuard, true)); } } catch (_) {}
  }
  disposers.push(hkm098CloseDeath);
  const hkm098RuleList = () => [
    ['keepInventory', 'true/false', '主角死亡时是否保留普通物品'],
    ['aiMaleProbability', '0-100', 'AI 玩家为男性的概率，剩余概率为女性'],
    ['femaleFutanari', 'true/false', '女性 AI 玩家是否拥有扶她性征'],
  ];
  const hkm098SetRule = async (key, value) => {
    hkm098RequireAlive();
    const stat = await currentStat();
    const current = {
      keepInventory: stat.游戏规则?.keepInventory === true,
      aiMaleProbability: Number.isInteger(Number(stat.游戏规则?.aiMaleProbability)) ? Math.max(0, Math.min(100, Number(stat.游戏规则.aiMaleProbability))) : 50,
      femaleFutanari: stat.游戏规则?.femaleFutanari === true,
    };
    if (key === 'keepInventory' || key === 'femaleFutanari') current[key] = value === true;
    else if (key === 'aiMaleProbability') current[key] = Math.max(0, Math.min(100, Math.floor(Number(value))));
    else throw Error('未知 gamerule：' + key);
    const result = await hudCommit({ 游戏规则: { ...asObject(stat.游戏规则), ...current } });
    if (!result.ok) throw Error('规则未保存。');
    state.rules = current; state.rulesInitialized = true;
    saveFrontendState(state); await hkm095Flush();
  };
  const hkm098SyncRules = async stat => {
    if (hudReadOnly) return false;
    if (!state.rulesInitialized) {
      const pending = typeof getVariables === 'function' ? getVariables({ type: 'chat' })?.hkm_opening_game_rules : null;
      const rules = {
        keepInventory: typeof pending?.keepInventory === 'boolean' ? pending.keepInventory : stat.游戏规则?.keepInventory === true,
        aiMaleProbability: Number.isInteger(Number(pending?.aiMaleProbability)) ? Math.max(0, Math.min(100, Number(pending.aiMaleProbability))) : (Number.isInteger(Number(stat.游戏规则?.aiMaleProbability)) ? Math.max(0, Math.min(100, Number(stat.游戏规则.aiMaleProbability))) : 50),
        femaleFutanari: typeof pending?.femaleFutanari === 'boolean' ? pending.femaleFutanari : stat.游戏规则?.femaleFutanari === true,
      };
      state.rules = rules;
      const result = await aiWriteVars({ 游戏规则: { ...asObject(stat.游戏规则), ...rules } });
      if (!result.ok) throw Error('开局游戏规则未能写入。');
      state.rulesInitialized = true; saveFrontendState(state); await hkm095Flush();
      return true;
    }
    state.rules = {
      keepInventory: stat.游戏规则?.keepInventory === true,
      aiMaleProbability: Number.isInteger(Number(stat.游戏规则?.aiMaleProbability)) ? Math.max(0, Math.min(100, Number(stat.游戏规则.aiMaleProbability))) : 50,
      femaleFutanari: stat.游戏规则?.femaleFutanari === true,
    };
    return false;
  };
  const hkm098SyncPlayers = async stat => {
    const area = textOf(stat.场景?.区域, '');
    const enemies = { ...asObject(stat.敌人) };
    let removed = false;
    let changed = false;
    for (const [key, record] of entriesOf(stat.敌人)) {
      const player = aiPlayers().find(p => p.region === area && (p.name === key || p.name === record?.名称 || p.id === key));
      if (!player) continue;
      if (player.alive === false || player.extracted) { delete enemies[key]; removed = true; continue; }
    const hpText = String(record?.血量 || '').split('/')[0].trim();
    const hp = hpText ? Number(hpText) : NaN;
      if (!Number.isFinite(hp)) continue;
      if (hp !== player.hp) { player.hp = Math.max(0, Math.min(player.maxHp, hp)); changed = true; }
      if (hp <= 0) { aiKillPlayer(state.run.map, player, '在' + area + '战斗中阵亡'); changed = true; delete enemies[key]; removed = true; }
    }
    if (changed) saveFrontendState(state);
    if (removed) {
      hkm098Internal += 1;
      try { const result = await aiWriteVars({ 敌人: enemies }); if (!result.ok) throw Error('阵亡玩家名单未能更新'); return true; }
      finally { hkm098Internal -= 1; }
    }
    return false;
  };
  const hkm154SyncBattle = async stat => {
    if (hudReadOnly || !state.run || state.run.map !== stat.场景?.地图) return false;
    const run = state.run;
    let changed = HkmBattle.register(run);
    for (const {target,kind,actor} of HkmBattle.narrative(stat,run)) {
      if (!HkmFishing.recordKill(run,target.id,actor,kind === '玩家')) continue;
      if (kind === '玩家') { target.hp = 0; aiKillPlayer(run.map,target,'在' + target.region + '战斗中阵亡'); }
      else if (run.npcs?.includes(target)) aiNpcKill(target,true,actor);
      changed = true;
    }
    HkmBattle.register(run);
    const plan = HkmBattle.settlement(stat,run);
    if (!changed && !plan.players && JSON.stringify(stat.本局统计) === JSON.stringify(plan.patch.本局统计)) return false;
    const quest = plan.players ? questProgressPatch(stat,{kind:'player_kill',count:plan.players},plan.patch) : {};
    const key = 'battle:' + HkmBattle.id(run) + ':' + Date.now() + ':' + (++hkm095QueueSerial);
    return hkm098Transact(key,{...plan.patch,...quest},{run:HkmLifecycle.copy(run)});
  };

  const hkm098ProcessStatEvents = async stat => {
    if (hudReadOnly) return false;
    const texts = hudLatestAssistantTexts();
    const last = texts[texts.length - 1];
    if (!last) return false;
    const stats = { ...asObject(stat.统计信息) };
    const ledger = { ...asObject(stat.前端结算?.事件) };
    const subjects = { ...asObject(stat.前端结算?.经验对象) };
    const bag = HkmLifecycle.copy(asObject(stat.背包?.携带收藏品));
    let gained = false;
    let changed = false;
    const re = /<HkmStatEvents\s+version="1">([\s\S]*?)<\/HkmStatEvents>/g;
    for (const block of last.text.matchAll(re)) {
      let events; try { events = JSON.parse(block[1]); } catch (_) { continue; }
      if (!Array.isArray(events) || events.length > 30) continue;
      for (const event of events) {
        if (!event || typeof event !== 'object' || !/^[\w:.-]{1,80}$/.test(event.id || '')) continue;
        const key = String(event.id);
      if (Object.hasOwn(ledger,key)) continue;
        if (event.type === 'experience' && typeof event.subjectId === 'string' && /^[\w\u4e00-\u9fff:.-]{1,80}$/.test(event.subjectId)) {
          if (!subjects[event.subjectId]) { stats.经验人数 = aiNum(stats.经验人数, 0) + 1; subjects[event.subjectId] = true; }
        } else if (event.type === 'semen' && Number.isSafeInteger(event.quantity) && event.quantity > 0 && event.quantity <= 9999) {
          aiGrantBucket(bag, itemById('COL-0039'), event.quantity); gained = true;
        } else if (event.type === 'fishing' && false && ['奇异','至宝','神秘'].includes(event.rarity) && Number.isInteger(event.quantity) && event.quantity > 0 && event.quantity <= 99) {
          const field = '钓到' + event.rarity + '鱼总数'; stats[field] = aiNum(stats[field], 0) + event.quantity;
        } else continue;
        ledger[key] = true; changed = true;
      }
    }

    if (!changed) return false;
    const eventPatch = { 统计信息: stats, ...(gained ? {背包:{...asObject(stat.背包),携带收藏品:bag}} : {}), 前端结算: { ...asObject(stat.前端结算), 事件: ledger, 经验对象: subjects } };
    return hkm098Transact('events:' + last.id + ':' + Object.keys(ledger).length,eventPatch);
  };

  const hkm098OwnedStep = (mapName, player, stat) => {
    if (aiPeaceful(player.id, 'hero')) { aiStep(mapName, player); return; }
    const treasureSearch = aiTreasureSearchOverride(mapName, player);
    const retainExtraction = treasureSearch && aiExtractionLocked(player);
    if (!treasureSearch) aiUpdateExtraction(mapName, player);
    if (!hkmSeaAiSpend(mapName,player))return;
    if (hkm139MouseBossEscape(mapName, player)) return;
    if (!treasureSearch) aiUpdateExtraction(mapName, player);
    if (aiMouseProfile(player) && aiHeroPresent(player) && aiMouseEncounter(mapName,player)) return;
    if (!treasureSearch && aiExtractStep(mapName, player, stat)) return;
    if (aiMouseProfile(player)) {
      const chart = AI_TYPES[player.meta]?.judge?.[player.sub] || AI_TYPES.鼠鼠.judge[player.sub] || AI_TYPES.鼠鼠.judge.跑刀;
      if (aiMouseEncounter(mapName, player) || aiMouseSoundDecision(mapName, player, chart)) return;
      aiUseHeal(player, mapName, chart);
      if (player.meta === '萌新' && player.sub === '小白') {
        if (player.region !== aiTurnContext?.heroTo && aiMovableFrom(mapName, player.region).length) {
          const next = aiMovableFrom(mapName, player.region)[0];
          player.prev = player.region; player.region = next; player.lastAction = '前往' + next;
        }
        return;
      }
      if (aiAreaTier(mapName, player.region) >= chart.holdTier) { aiSearchHere(mapName, player); return; }
    }
    if (aiTakeAmbush(player, 'hero')) {
      if (!retainExtraction) player.mode = 'fight';
      player.lastAction = '从蹲伏中对主角发动偷袭';
      aiTurnContext.soundLines.push(player.name + '从蹲伏中对进入' + player.region + '的主角发动偷袭。');
      return;
    }
    if (mapName==='魔鬼海' && player.water<Math.min(AI_MONSTER_SEA_TANK_LOW,player.waterCap) && !hudCombatFlagOn(stat) && aiBagCount(player,AI_OXYGEN_ITEM_IDS)>0){aiUseOxygen(player,mapName);return;}
    if (hudCombatFlagOn(stat)) return;
    if (treasureSearch && !aiVisiblePlayers(player).length && !aiNpcTargetsFor(player, mapName).length) {
      player.soundPursuit = null;
      aiSearchHere(mapName, player);
      return;
    }
    const exits = aiMovableFrom(mapName, player.region);
    if (!exits.length) return;
    if (player.meta === '猛攻哥') { player.crouched = false; player.soundWait = null; if (!retainExtraction) player.mode = 'fight'; player.lastAction = '留在当前区域准备攻击主角'; return; }
    player.prev = player.region; player.region = aiPickOne(exits); player.llm = false; player.mode = 'roam';
    if (!player.visited.includes(player.region)) player.visited.push(player.region);
    player.lastAction = '离开' + player.prev + '，前往' + player.region;
  };

    let hkmHomeBusy=false,hkmHomeSignature='',hkmHomeTab='craft',hkmHomeStation='COL-0054',hkmHomeReturnFocus=null;
  const hkmHomeDrafts=new Map();
  const hkmHomeStyle=make('style','',`
    .hkm-home-panel [hidden],.hkm-home-mask[hidden]{display:none!important}.hkm-home-actions{display:flex;gap:8px;flex-wrap:wrap}.hkm-home-mask{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.7);display:grid;place-items:center;padding:12px}.hkm-home-dialog{box-sizing:border-box;width:min(780px,100%);max-height:calc(100dvh - 24px);display:flex;flex-direction:column;border:1px solid #456474;border-radius:12px;background:#0b1821;color:#e7f7ff;font:13px/1.55 system-ui,"Microsoft YaHei",sans-serif;box-shadow:0 16px 60px #0008}.hkm-home-dialog *{box-sizing:border-box;min-width:0;overflow-wrap:anywhere}.hkm-home-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid #29434f}.hkm-home-heading h2{font-size:18px;margin:0}.hkm-home-tabs{display:flex;gap:8px;padding:10px 18px;border-bottom:1px solid #29434f}.hkm-home-dialog button,.hkm-home-panel button{min-height:40px;padding:7px 12px;border:1px solid #456474;border-radius:7px;background:#122e3c;color:#e7f7ff;font:inherit;cursor:pointer}.hkm-home-dialog button:disabled,.hkm-home-panel button:disabled{opacity:.45;cursor:default}.hkm-home-dialog button:focus-visible,.hkm-home-dialog input:focus-visible,.hkm-home-dialog select:focus-visible{outline:2px solid #83e2c6;outline-offset:2px}.hkm-home-tabs button[aria-selected="true"]{background:#245343;border-color:#83e2c6}.hkm-home-body{overflow:auto;padding:14px 18px;overscroll-behavior:contain}.hkm-home-status{margin:0;padding:10px 18px;border-top:1px solid #29434f;color:#8ce1bb;white-space:pre-wrap}.hkm-home-status[data-error="true"]{color:#ffb7ba}.hkm-home-summary{margin:0 0 12px;color:#afccd7}.hkm-home-section{margin:0 0 16px}.hkm-home-section h3{font-size:14px;margin:0 0 9px;color:#b6e4f4}.hkm-home-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.hkm-home-card{padding:12px;border:1px solid #29434f;border-radius:8px;background:#0c202b}.hkm-home-card h4{font-size:14px;margin:0 0 8px}.hkm-home-card p{margin:7px 0}.hkm-home-lines{display:grid;grid-template-columns:52px minmax(0,1fr);gap:6px 10px;margin:0 0 10px}.hkm-home-lines dt{color:#9cb7c6}.hkm-home-lines dd{margin:0}.hkm-home-controls{display:flex;align-items:end;flex-wrap:wrap;gap:8px;margin-top:10px}.hkm-home-controls label{display:grid;gap:4px;font-size:12px;color:#afccd7}.hkm-home-controls input,.hkm-home-controls select{max-width:110px;width:100%;min-height:40px;border:1px solid #456474;border-radius:6px;background:#07131b;color:#e7f7ff;padding:7px;font:inherit}.hkm-home-lock{color:#efc289}.hkm-home-result{color:#83e2c6}.hkm-home-placed{display:flex;flex-wrap:wrap;gap:7px}.hkm-home-chip{padding:4px 8px;background:#163746;border-radius:5px}.hkm-home-residents{border-top:1px solid #29434f;margin-top:14px;padding-top:12px}@media(max-width:560px){.hkm-home-mask{padding:8px}.hkm-home-dialog{max-height:calc(100dvh - 16px)}.hkm-home-heading,.hkm-home-tabs,.hkm-home-body{padding:12px}.hkm-home-grid{grid-template-columns:1fr}.hkm-home-controls button{flex:1}.hkm-home-dialog button,.hkm-home-panel button{min-height:44px}}
  `);
  hkmHomeStyle.textContent+=`
    .hkm-reset-ip [data-home-place][hidden]{display:none!important}
    .hkm-home-workshop{display:grid;grid-template-columns:112px minmax(0,1fr);gap:14px;align-items:start}
    .hkm-home-stations{display:flex;flex-direction:column;gap:8px;position:sticky;top:0}
    .hkm-home-stations button{width:100%;text-align:left}
    .hkm-home-stations button[aria-current="true"]{background:#245343;border-color:#83e2c6;color:#c6ffe6}
    .hkm-home-recipes{display:flex;flex-direction:column;gap:10px}
    .hkm-home-recipe{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px;border:1px solid #29434f;border-radius:8px;background:#0c202b}
    .hkm-home-formula{display:flex;align-items:center;gap:10px}
    .hkm-home-formula>span:first-child,.hkm-home-formula>span:last-child{flex:1}
    .hkm-home-arrow{color:#9cb7c6;flex:none}
    .hkm-home-recipe .hkm-home-controls{flex-wrap:nowrap;align-items:center;margin:0;gap:6px}
    .hkm-home-recipe input{width:52px}.hkm-home-recipe select{width:62px}
    .hkm-home-recipe button{padding:7px 10px}
    .hkm-home-recipe .hkm-home-lock{margin:0}
    @media(max-width:680px){.hkm-home-workshop{grid-template-columns:92px minmax(0,1fr);gap:10px}.hkm-home-recipe{grid-template-columns:1fr;gap:10px}.hkm-home-recipe .hkm-home-controls{justify-content:flex-end}}
    @media(max-width:380px){.hkm-home-workshop{grid-template-columns:72px minmax(0,1fr);gap:8px}.hkm-home-stations button{padding:7px 8px}.hkm-home-body{padding:10px 8px}.hkm-home-recipe{padding:8px;font-size:12px}.hkm-home-formula{gap:5px}.hkm-home-recipe input{width:46px}.hkm-home-recipe select{width:54px}.hkm-home-recipe button{padding:7px 8px}}
  `;
  document.head.append(hkmHomeStyle);
  const hkmHomePanel=section('安全屋陈设','');hkmHomePanel.box.classList.add('hkm-home-panel');hkmHomePanel.box.hidden=true;
  overviewView.append(hkmHomePanel.box);
  const hkmHomeButton=(label,handler)=>{const button=make('button','',label);button.type='button';button.addEventListener('click',hudAction(handler));return button;};
  const hkmHomeManufacture=hkmHomeButton('制造',()=>hkmHomeOpen('craft'));
  const hkmHomeManage=hkmHomeButton('管理陈设',()=>hkmHomeOpen('furniture'));
  const hkmHomePanelActions=make('div','hkm-home-actions');hkmHomePanelActions.append(hkmHomeManufacture,hkmHomeManage);hkmHomePanel.box.querySelector('.hkm-reset-section-title').append(hkmHomePanelActions);
  const hkmHomeMask=make('div','hkm-home-mask');hkmHomeMask.hidden=true;
  const hkmHomeDialog=make('section','hkm-home-dialog');hkmHomeDialog.setAttribute('role','dialog');hkmHomeDialog.setAttribute('aria-modal','true');hkmHomeDialog.setAttribute('aria-label','安全屋制造与陈设');
  const hkmHomeHeading=make('header','hkm-home-heading');hkmHomeHeading.append(make('h2','','安全屋'));
  const hkmHomeCloseButton=hkmHomeButton('关闭',()=>hkmHomeClose());hkmHomeHeading.append(hkmHomeCloseButton);
  const hkmHomeTabs=make('div','hkm-home-tabs');hkmHomeTabs.setAttribute('role','tablist');hkmHomeTabs.setAttribute('aria-label','安全屋页面');
  const hkmHomeCraftTab=hkmHomeButton('制造',()=>{hkmHomeTab='craft';hkmHomeSignature='';hkmHomeRender(currentStatSnapshot);});
  const hkmHomeFurnitureTab=hkmHomeButton('陈设',()=>{hkmHomeTab='furniture';hkmHomeSignature='';hkmHomeRender(currentStatSnapshot);});
  for(const [button,id] of [[hkmHomeCraftTab,'hkm-home-tab-craft'],[hkmHomeFurnitureTab,'hkm-home-tab-furniture']]){button.id=id;button.setAttribute('role','tab');button.setAttribute('aria-controls','hkm-home-content');}
  hkmHomeTabs.append(hkmHomeCraftTab,hkmHomeFurnitureTab);
  const hkmHomeBody=make('div','hkm-home-body');hkmHomeBody.id='hkm-home-content';hkmHomeBody.setAttribute('role','tabpanel');
  const hkmHomeStatus=make('p','hkm-home-status','');hkmHomeStatus.hidden=true;hkmHomeStatus.setAttribute('aria-live','polite');
  hkmHomeDialog.append(hkmHomeHeading,hkmHomeTabs,hkmHomeBody,hkmHomeStatus);hkmHomeMask.append(hkmHomeDialog);hkmPortal.append(hkmHomeMask);
  const hkmHomeReport=(text,error=false)=>{hkmHomeStatus.hidden=!text;hkmHomeStatus.textContent=text;hkmHomeStatus.dataset.error=String(error);setStatus(text);};
  const hkmHomeClose=()=>{hkmHomeMask.hidden=true;hkmHomeReturnFocus?.focus?.();hkmHomeReturnFocus=null;};
  const hkmHomeOpen=async tab=>{hkm098RequireAlive();const stat=await currentStat();hkm098RequireAlive();HkmHome.requireSafe(stat);hkmHomeTab=tab;hkmHomeReturnFocus=document.activeElement;hkmHomeMask.hidden=false;hkmHomeSignature='';hkmHomeReport('');hkmHomeRender(stat);hkmHomeCloseButton.focus();};
  hkmHomeMask.addEventListener('click',event=>{if(event.target===hkmHomeMask)hkmHomeClose();});
  const hkmHomeKeys=event=>{
    if(hkmHomeMask.hidden)return;
    if(event.key==='Escape'){event.preventDefault();hkmHomeClose();}
    if(event.key==='Tab'){
      const nodes=[...hkmHomeDialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')].filter(node=>node.getClientRects().length),index=nodes.indexOf(document.activeElement);
      if(nodes.length && ((event.shiftKey && index<=0) || (!event.shiftKey && (index===nodes.length-1 || index<0)))){event.preventDefault();nodes[event.shiftKey?nodes.length-1:0].focus();}
    }
    if(event.target.closest('.hkm-home-tabs') && ['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();(event.target===hkmHomeCraftTab?hkmHomeFurnitureTab:hkmHomeCraftTab).click();(hkmHomeTab==='craft'?hkmHomeCraftTab:hkmHomeFurnitureTab).focus();}
  };
  document.addEventListener('keydown',hkmHomeKeys);disposers.push(()=>{document.removeEventListener('keydown',hkmHomeKeys);hkmHomeMask.remove();hkmHomeStyle.remove();});
  const hkmHomeApply=async(planFactory,label)=>{
    if(hkmHomeBusy)return false;
    hkm098RequireAlive();if(searchBusy || moveBusy || launchBusy || purchaseBusy || specialBusy)throw Error('请等待当前操作完成。');
    hkmHomeBusy=true;specialBusy=true;
    try{
      const stat=await currentStat();hkm098AssertOwner();HkmHome.requireSafe(stat);
      const plan=planFactory(stat,HkmHome.normalize(readFrontendState().home));
      if(plan.patch.背包)plan.patch.主角=hudBurdenPatch(stat,plan.patch.背包);
      const resultText=typeof label==='function'?label(plan):label;
      await hkm098Transact('home:'+Date.now()+':'+(++hkm095QueueSerial),plan.patch,{home:plan.home},hudPlayerName(stat)+'在安全屋：'+resultText);
      hkmHomeReport(resultText);hudCloseItemPanel();return true;
    }catch(error){hkmHomeReport(error.message,true);throw error;}
    finally{hkmHomeBusy=false;specialBusy=false;hkmHomeSignature='';await refresh();}
  };
  const hkmHomePlace=(id,where,quantity)=>hkmHomeApply((stat,home)=>HkmHome.planPlace(stat,home,id,where,quantity,itemById),plan=>'已陈设'+plan.item.name+' ×'+plan.quantity+'。');
  const hkmHomeStore=(id,quantity)=>hkmHomeApply((stat,home)=>HkmHome.planStore(stat,home,id,quantity,itemById),plan=>'已收纳'+plan.item.name+' ×'+plan.quantity+'。');
  const hkmHomeUnlock=id=>hkmHomeApply((stat,home)=>HkmHome.planUnlock(stat,home,id,itemById),plan=>'已消耗一份图纸，解锁'+plan.recipe.name+'配方。');
  const hkmHomeCraft=(id,batches,baseCount)=>hkmHomeApply((stat,home)=>HkmHome.planCraft(stat,home,id,batches,baseCount,itemById),plan=>'制造完成：'+plan.outputs.map(row=>itemById(row.id).name+' ×'+row.quantity).join('、')+'，已存入安全屋。');
  const hkmHomeKeep=quantity=>hkmHomeApply((stat,home)=>HkmHome.planKeep(stat,home,quantity),'猫娘已留在安全屋常住。');
  const hkmHomeAskPlace=async(id,where)=>{
    hkm098RequireAlive();const stat=await currentStat();hkm098RequireAlive();HkmHome.requireSafe(stat);
    const item=itemById(id),max=HkmHome.count(stat,item.name,where);if(!max)throw Error('家具数量不足。');
    hudAskQuantity({title:'陈设 '+item.name,max,initial:1,onConfirm:quantity=>hkmHomePlace(id,where,quantity).catch(()=>{})});
  };
  const hkmHomeLifecycle=(stat,originalPatch,originalAfter,originalLog)=>{
    let patch={...originalPatch},after={...originalAfter},log=originalLog;
    const hasRun=Object.hasOwn(after,'run'),home=HkmHome.normalize(state.home),run=hasRun?after.run:null;
    if(run && GAME_DATA.maps[run.map]?.kind==='mission' && !run.homeIncome){
      const coins=home.cats.temporary*50;
      if(coins){patch.统计信息={...asObject(patch.统计信息 || stat.统计信息),哈基币:aiNum((patch.统计信息 || stat.统计信息)?.哈基币,0)+coins};home.cats.temporary=0;log=[log,'安全屋的猫娘转化为 '+coins+' 哈基币。'].filter(Boolean).join('；');}
      after.run={...run,homeIncome:HkmHome.incomeSnapshot(home)};after.home=home;
    }
    if(hasRun && run===null && state.run && GAME_DATA.maps[state.run.map]?.kind==='mission'){
      const snapshot=state.run.homeIncome || HkmHome.incomeSnapshot(home),outputs=[];
      if(!Number.isSafeInteger(snapshot.boxes) || snapshot.boxes<0 || !Number.isSafeInteger(snapshot.cats) || snapshot.cats<0)throw Error('家具收益数量无效。');
      for(let index=0;index<snapshot.boxes;index++){
        const rarity=pickFromDistribution(['寻常','少见','珍稀','奇异','至宝'],[.6,.27,.09,.03,.01]);
        const item=weightedPick(GAME_DATA.lootTables['谷歌大厦'][rarity].map(itemById).filter(Boolean));
        if(!item)throw Error('私人保险箱的收藏品池为空。');outputs.push({id:item.id,quantity:1});
      }
      if(outputs.length){const merged={...stat,...patch},gained=HkmHome.inventoryPatch(merged,[],outputs,itemById);patch.安全屋=gained.安全屋;log=[log,'私人保险箱送来了 '+outputs.map(row=>itemById(row.id).name+' ×1').join('、')+'。'].filter(Boolean).join('；');}
      home.cats.temporary+=snapshot.cats;if(!Number.isSafeInteger(home.cats.temporary))throw Error('安全屋住客数量过大。');
      if(snapshot.cats)log=[log,'安全屋迎来了 '+snapshot.cats+' 位猫娘。'].filter(Boolean).join('；');
      after.home=home;
    }
    return {patch,after,log};
  };
  const hkmHomeInput=(label,value,min,max,onChange)=>{
    const node=make('label','',label),input=make('input','');input.type='number';input.min=String(min);input.max=String(max);input.step='1';input.value=String(value);input.setAttribute('aria-label',label);node.append(input);input.addEventListener('input',()=>onChange(Number(input.value)));return {node,input};
  };
  const hkmHomeRecipeCard=(recipe,stat,home)=>{
    const card=make('article','hkm-home-recipe');card.dataset.recipe=recipe.id;
    const missingStation=!(home.placed[recipe.station]>0),missingBlueprint=recipe.blueprint && !home.unlockedRecipes.includes(recipe.id);
    if(missingStation || missingBlueprint){
      const conditions=[];
      if(missingStation)conditions.push('陈设'+itemById(recipe.station).name);
      if(missingBlueprint)conditions.push('消耗 '+itemById(recipe.blueprint).name+' ×1');
      card.append(make('p','hkm-home-lock',conditions.join('；')));
      if(missingBlueprint){const unlock=hkmHomeButton('解锁配方',()=>hkmHomeUnlock(recipe.id));unlock.dataset.homeAction='unlock';unlock.disabled=hkmHomeBusy || missingStation || HkmHome.owned(stat,itemById(recipe.blueprint).name)<1;card.append(unlock);}
      return card;
    }
    const formula=make('div','hkm-home-formula'),materials=make('span',''),results=make('span','hkm-home-result');formula.append(materials,make('span','hkm-home-arrow','→'),results);card.append(formula);
    const controls=make('div','hkm-home-controls');
    const draft=hkmHomeDrafts.get(recipe.id) || {batches:1,baseCount:recipe.herb?3:1};hkmHomeDrafts.set(recipe.id,draft);
    const manufacture=hkmHomeButton('制造',()=>hkmHomeCraft(recipe.id,draft.batches,draft.baseCount));manufacture.dataset.homeAction='craft';
    const refresh=()=>{
      try{
        const req=HkmHome.requirements(recipe,draft.batches,draft.baseCount);
        materials.textContent=req.costs.map(row=>itemById(row.id).name+' ×'+row.quantity).join(' + ');
        results.textContent=req.outputs.map(row=>itemById(row.id).name+' ×'+row.quantity).join(' + ');
        manufacture.disabled=hkmHomeBusy || req.costs.some(row=>HkmHome.owned(stat,itemById(row.id).name)<row.quantity);
      }catch(error){manufacture.disabled=true;materials.textContent=error.message;results.textContent='—';}
    };
    if(recipe.herb){const select=make('select','');select.setAttribute('aria-label','每批原料数量');select.title='每批原料数量';for(let n=1;n<=3;n++){const option=make('option','',n+'份');option.value=String(n);select.append(option);}select.value=String(draft.baseCount);select.addEventListener('change',()=>{draft.baseCount=Number(select.value);refresh();});controls.append(select);}
    const input=hkmHomeInput('制造批次',draft.batches,1,999,value=>{draft.batches=value;refresh();});input.input.title='制造批次';controls.append(input.input,manufacture);card.append(controls);
    refresh();return card;
  };
  const hkmHomeRender=stat=>{
    const allowed=HkmHome.inSafe(stat) && !hudReadOnly && !HkmLifecycle.dead(stat);hkmHomePanel.box.hidden=!allowed;
    for(const button of hudItemPanel.querySelectorAll('[data-home-place]'))button.hidden=!allowed;
    if(!allowed){hkmHomeClose();return;}
    const home=HkmHome.normalize(state.home);clear(hkmHomePanel.body);
    const chips=make('div','hkm-home-placed');for(const [id,n] of Object.entries(home.placed))if(n)chips.append(make('span','hkm-home-chip',(itemById(id)?.name || id)+' ×'+n));
    hkmHomePanel.body.append(chips.childNodes.length?chips:make('p','hkm-home-summary','尚未陈设家具。'));
    hkmHomeManufacture.disabled=hkmHomeBusy;hkmHomeManage.disabled=hkmHomeBusy;
    if(hkmHomeMask.hidden)return;
    const signature=JSON.stringify([hkmHomeTab,hkmHomeStation,home,stat.安全屋,stat.背包,hkmHomeBusy]);if(signature===hkmHomeSignature)return;hkmHomeSignature=signature;
    clear(hkmHomeBody);hkmHomeCraftTab.setAttribute('aria-selected',String(hkmHomeTab==='craft'));hkmHomeFurnitureTab.setAttribute('aria-selected',String(hkmHomeTab==='furniture'));hkmHomeBody.setAttribute('aria-labelledby',hkmHomeTab==='craft'?hkmHomeCraftTab.id:hkmHomeFurnitureTab.id);
    if(hkmHomeTab==='craft'){
      const workshop=make('div','hkm-home-workshop'),stations=make('nav','hkm-home-stations'),recipes=make('section','hkm-home-recipes');stations.setAttribute('aria-label','工作家居');recipes.setAttribute('aria-label',itemById(hkmHomeStation).name+'配方');
      for(const station of ['COL-0054','COL-0070','COL-0150']){
        const button=hkmHomeButton(itemById(station).name,()=>{hkmHomeStation=station;hkmHomeSignature='';hkmHomeReport('');hkmHomeRender(currentStatSnapshot);hkmHomeBody.querySelector('[data-station="'+station+'"]').focus();});button.dataset.station=station;button.setAttribute('aria-current',String(station===hkmHomeStation));stations.append(button);
      }
      for(const recipe of HkmHome.recipes.filter(row=>row.station===hkmHomeStation))recipes.append(hkmHomeRecipeCard(recipe,stat,home));
      workshop.append(stations,recipes);hkmHomeBody.append(workshop);
    }else{
      hkmHomeFurnitureContent(hkmHomeBody,stat,home);
    }
  };

  const hkmHomeFurnitureContent=(target,stat,home)=>{
      const grid=make('div','hkm-home-grid');
      for(const [id,quantity] of Object.entries(home.placed)){
        if(!quantity)continue;const item=itemById(id),card=make('article','hkm-home-card');card.dataset.furniture=id;card.append(make('h4','',(item?.name || id)+' ×'+quantity));
        const effect=id==='COL-0106'?'每局结束后，每件提供一件谷歌大厦收藏品。':id==='COL-0093'?'每局结束后，每件空闲耄爬架迎来一位猫娘；未常住的猫娘在下次入局时各转化为50哈基币。':item?hudItemUsage(item).join('；'):'家具资料暂不可用。';if(effect)card.append(make('p','',effect));
        let n=1;const controls=make('div','hkm-home-controls'),input=hkmHomeInput('收纳数量',1,1,quantity,value=>{n=value;}),button=hkmHomeButton('收纳',()=>hkmHomeStore(id,n));button.disabled=hkmHomeBusy || !item;controls.append(input.node,button);card.append(controls);grid.append(card);
      }
      target.append(grid.childNodes.length?grid:make('p','hkm-home-summary','在家具详情中点击「陈设」，将家具放入安全屋。'));
      const residents=make('section','hkm-home-residents');residents.append(make('h3','','安全屋住客'),make('p','','猫娘：'+home.cats.temporary+' 位待下次入局转换，'+home.cats.permanent+' 位常住。'));
      if(home.cats.temporary){let n=1;const controls=make('div','hkm-home-controls'),input=hkmHomeInput('留住数量',1,1,home.cats.temporary,value=>{n=value;}),button=hkmHomeButton('留住猫娘',()=>hkmHomeKeep(n));button.disabled=hkmHomeBusy;controls.append(input.node,button);residents.append(controls);}
      residents.append(make('p','hkm-home-summary','每位常住猫娘占用一件耄爬架的收益名额。收纳家具不会移走已有住客。'));target.append(residents);
  };

    const hkmFacilitiesPanel=section('特勤处');
  let hkmFacilitiesBusy=false;
  const hkmFacilitiesSync=async stat=>{
    if(hudReadOnly)return false;
    const next=HkmFacilities.observe(stat,GAME_DATA.maps);
    if(JSON.stringify(next)===JSON.stringify(stat.特勤处))return false;
    hkm098Internal+=1;
    let result;
    try{result=await aiWriteVars({特勤处:next},stat);}finally{hkm098Internal-=1;}
    if(!result.ok){setStatus('特勤处数据写入失败。');return false;}
    currentStatSnapshot=null;return true;
  };
  const hkmFacilitiesUpgrade=async(name,target)=>{
    if(hkmFacilitiesBusy)return;
    hkm098RequireAlive();
    hkmFacilitiesBusy=true;
    hkmFacilitiesRender(currentStatSnapshot || {});
    try{
      const fresh=await currentStat();
      hkm098RequireAlive();
      const patch=HkmFacilities.planUpgrade(fresh,name,target);
      const hero=hudHeroStats(fresh,asObject(fresh.装备));
      patch.主角=hudHeroStats({...fresh,...patch,主角:hero},asObject(fresh.装备),patch.背包);
      const result=await aiWriteVars(patch,fresh);
      if(!result.ok)throw Error(result.via==='stale-snapshot'?'变量已变化，请重试。':'升级写入失败。');
      currentStatSnapshot=null;
      await refresh();
      setStatus(name+' Lv.'+target);
    }finally{
      hkmFacilitiesBusy=false;
      if(currentStatSnapshot)hkmFacilitiesRender(currentStatSnapshot);
    }
  };
  const hkmFacilitiesRender=stat=>{
    const levels=HkmFacilities.normalize(stat.特勤处);
    clear(hkmFacilitiesPanel.body);
    const grid=make('div','hkm-facilities-grid');
    for(const definition of HkmFacilities.definitions){
      const level=levels[definition.name],card=make('article','hkm-facility');
      const head=make('div','hkm-facility-head');head.append(make('h3','',definition.name),make('b','',level===3?'Lv.3':'Lv.'+level+' → Lv.'+(level+1)));card.append(head);
      const current=definition.levels[level-1];
      if(level===3){card.append(make('p','hkm-facility-current',current.effect));grid.append(card);continue;}
      const config=definition.levels[level],effects=make('div','hkm-facility-effects');
      for(const [key,label] of [['weight','负重上限'],['speed','水下速度'],['rounds','水下行动值上限'],['hp','血量上限'],['power','钓鱼力量']]){
        const before=current?.[key] || 0,after=config[key] || 0;
        if(before!==after)effects.append(make('div','',label+' +'+before+' → +'+after));
      }
      card.append(effects);
      const details=make('dl','hkm-facility-details'),gate=HkmFacilities.condition(stat,config.condition),condition=make('dd','',gate.text),costs=make('dd');
      condition.dataset.met=String(gate.ok);costs.append(make('div','',config.money+' 哈基币'));
      if(config.stars){const value=make('div','',config.stars+' 星光');value.dataset.met=String(Number(stat.统计信息?.星光 || 0)>=config.stars);costs.append(value);}
      for(const cost of config.costs){const owned=HkmFacilities.count(stat,cost.name),value=make('div','',cost.name+' '+owned+'/'+cost.quantity);value.dataset.met=String(owned>=cost.quantity);costs.append(value);}
      details.append(make('dt','','解锁'),condition,make('dt','','消耗'),costs);card.append(details);
      const available=HkmFacilities.availability(stat,definition,level+1),button=make('button','hkm-page-button',hkmFacilitiesBusy?'升级中…':available.ok?'升级':available.reason);
      button.type='button';button.disabled=hudReadOnly || hkmFacilitiesBusy || !available.ok || HkmLifecycle.dead(stat) || stat.场景?.地图!=='哈基米空间' || stat.场景?.区域!=='特勤处';
      button.addEventListener('click',hudAction(()=>hkmFacilitiesUpgrade(definition.name,level+1)));card.append(button);grid.append(card);
    }
    hkmFacilitiesPanel.body.append(grid);
  };

    const hkmSeaSync=async stat=>{
    if(hudReadOnly)return false;
    const migrated=HkmSea.migrate(stat,state),next=migrated.stat;
    if(next.场景?.地图!=='魔鬼海'){
      next.状态列表={...asObject(next.状态列表)};
      for(const name of ['水肺药水','强效水肺药水'])delete next.状态列表['上限-'+name];
    }
    const run=migrated.front.run;
    if(run?.map==='魔鬼海'){
      run.waterBuffs={...asObject(run.waterBuffs)};
      const count=hudDialogueCount(),status={...asObject(next.状态列表)};
      for(const name of ['水肺药水','强效水肺药水']){
        const key='上限-'+name,row=status[key];
        if(!row){delete run.waterBuffs[name];continue;}
        if(!run.waterBuffs[name])run.waterBuffs[name]={expiresAt:count+Math.max(0,parseInt(row.持续时间,10) || 0)};
        const left=Math.max(0,run.waterBuffs[name].expiresAt-count);
        if(!left){delete status[key];delete run.waterBuffs[name];}
        else status[key]={...row,持续时间:left+'轮'};
      }
      next.状态列表=status;
    }
    const scene={...asObject(next.场景)};
    if(scene.行动结算消息===undefined || aiNum(scene.行动结算消息,-1)<0)scene.行动结算消息=mvuMessageId();
    if(scene.地图==='魔鬼海'){
      next.主角=hudHeroStats(next,asObject(next.装备));
      const cap=HkmSea.cap(next);
      scene.剩余水下行动值=String(aiIsOxygenArea(scene.地图,scene.区域)?cap:Math.max(0,Math.min(cap,aiNum(scene.剩余水下行动值,0))));
    }
    next.场景=scene;
    const patch={};
    for(const key of ['场景','主角','状态列表'])if(JSON.stringify(next[key])!==JSON.stringify(stat[key]))patch[key]=next[key];
    if(Object.keys(patch).length){
      hkm098Internal+=1;let result;
      try{result=await aiWriteVars(patch,stat);}finally{hkm098Internal-=1;}
      if(!result.ok)throw Error('水下行动值写入失败。');
      currentStatSnapshot=null;
    }
    if(run?.map==='魔鬼海'){
      run.roundCap=35;run.rounds=aiNum(scene.剩余交互轮数,35);run.water=aiNum(scene.剩余水下行动值,0);
      for(const player of run.players || []){
        aiRecalcStats(player);
        if(aiIsOxygenArea(run.map,player.region))player.water=player.waterCap;
      }
    }
    if(JSON.stringify(state.run)!==JSON.stringify(run) || JSON.stringify(state.usePending)!==JSON.stringify(migrated.front.usePending)){
      state.run=run;state.usePending=migrated.front.usePending;saveFrontendState(state);
    }
    return Object.keys(patch).length>0;
  };
  const hkmSeaAiSpend=(mapName,player)=>{
    const equipmentUnit={hp:player.hp,maxHp:player.maxHp,equipment:player.equip};
    const equipmentFree=HkmEquipment.freeRound(equipmentUnit);
    player.rounds=Math.max(0,aiNum(player.rounds,0)-(equipmentFree?0:1));
    if(!equipmentFree){HkmEquipment.roundHeal(equipmentUnit);player.hp=equipmentUnit.hp;}
    if(mapName==='魔鬼海'){
      player.water=aiIsOxygenArea(mapName,player.region)?player.waterCap:Math.max(0,aiNum(player.water,player.waterCap)-aiWaterCost(mapName,player.region));
    }
    if(player.rounds<=0){player.hp=0;aiKillPlayer(mapName,player,'交互轮数耗尽');return false;}
    const injury=HkmSea.suffocate({地图:mapName,区域:player.region,剩余水下行动值:player.water},player.hp,player.maxHp,GAME_DATA.maps);
    player.hp=injury.hp;
    if(injury.damage){
      if(player.hp<=0){aiKillPlayer(mapName,player,'水下缺氧');return false;}
      const fighting=hudCombatFlagOn(asObject(aiTurnContext?.stat)) || aiVisiblePlayers(player).length > 0 || aiNpcTargetsFor(player,mapName).length>0;
      if(!aiExtractionLocked(player) && !fighting && aiBagCount(player,AI_OXYGEN_ITEM_IDS)>0 && aiUseOxygen(player,mapName))return false;
    }
    return true;
  };
  const hkmSeaParasiteCost=(stat,mapName,area)=>{
    if(aiWaterCost(mapName,area)<=0)return 0;
    for(const row of Object.values(asObject(stat.状态列表))){
      const text=[row.名称,row.描述,row.效果].join(' ');
      if(!/触手寄生/.test(text))continue;
      const chance=text.match(/(?:有|以)?(20|50)%概率额外消耗/);
      if(chance && Math.random()<Number(chance[1])/100)return 1;
    }
    return 0;
  };
  let hkmSeaTickBusy=false;
  const hkmSeaNativeTick=async stat=>{
    if(hudReadOnly || hkmSeaTickBusy || stat.场景?.地图!=='魔鬼海' || !state.run || HkmLifecycle.dead(stat))return false;
    const chat=hudHostChat(),floor=mvuMessageId();
    if(!chat || chat[floor]?.is_user===true)return false;
    let user=floor-1;while(user>=0 && chat[user]?.is_user!==true)user--;
    if(user<0 || user<=aiNum(stat.场景.行动结算消息,-1) || user<=aiNum(state.run.startMessageId,-1) || user<=aiNum(state.replayAfter,-1))return false;
    const message=chat[user],content=String(message.mes ?? message.message ?? '');
    const alreadySettled=Boolean(message.extra?.hkm_frontend || message.data?.hkm_frontend) || /<HkmFrontend(?:SearchResult|MoveEncounter)>|交互轮数 −\d/.test(content);
    const response=String(chat[floor]?.mes ?? chat[floor]?.message ?? '');
    const freeAction=/<HkmSeaTurn\s+type="free"\s*\/?\s*>/.test(response);
    hkmSeaTickBusy=true;
    try{
      const scene={...stat.场景,行动结算消息:user};
      if(alreadySettled || freeAction){await hudCommit({场景:scene});return true;}
      const spent=await hudSpendRounds({...stat,场景:scene},scene.地图,scene.区域);
      if(spent.dead)return true;
      const fresh=await currentStat();
      const decisionFloor=chat.slice(0,user).findLastIndex(message=>message?.is_user!==true);
      const resolved=aiResolveTurn(scene.地图,{mode:'action',area:scene.区域,stat:fresh,decisionFloor});
      const enemyPatch=aiEnemyPatch(scene.地图,scene.区域,fresh);
      if(resolved?.scatter)enemyPatch.散落物品=resolved.scatter;
      Object.assign(enemyPatch,resolved?.heroPatch || {});
      await hudCommit(enemyPatch);
      return Boolean(spent);
    }finally{hkmSeaTickBusy=false;}
  };

    const hkmPage={main:null,sub:{inside:'action',outside:'travel',career:'records'},category:'system',filter:'active',expanded:new Set(),scroll:new Map(),route:'',scene:'',float:false,collapsed:false,hiddenOpen:false};
  const hkmButton=(label,run,cls='hkm-page-button')=>{const b=make('button',cls,label);b.type='button';if(run)b.addEventListener('click',run);return b;};
  const hkmParking=make('div');hkmParking.hidden=true;hkmParking.append(overviewView,taskView);body.replaceChildren(hkmParking);
  const hkmMain=make('nav','hkm-main-tabs'),hkmSub=make('nav','hkm-sub-tabs'),hkmContent=make('div','hkm-page-content');
  hkmMain.setAttribute('role','tablist');hkmMain.setAttribute('aria-label','游戏分页');hkmSub.setAttribute('role','tablist');hkmSub.setAttribute('aria-label','页面功能');
  hkmContent.id='hkm-page-content';hkmContent.setAttribute('role','tabpanel');
  let hkmViewport=window;
  try{if(window.parent.innerHeight>0)hkmViewport=window.parent;}catch(_){}
  const hkmResizeHud=()=>root.style.setProperty('--hkm-hud-height',Math.max(480,Math.round(hkmViewport.innerHeight*.82))+'px');
  hkmResizeHud();hkmViewport.addEventListener('resize',hkmResizeHud);disposers.push(()=>hkmViewport.removeEventListener('resize',hkmResizeHud));
  root.insertBefore(hkmMain,body);root.insertBefore(hkmSub,body);body.append(hkmContent);
  titleBox.firstChild.textContent='哈基米行动';
  const hkmVitals=make('div','hkm-vitals');titleBox.append(roundLabel,hkmVitals);
  const HkmTutorial = (() => {
    const slides=[{"title":"先认识三个页面","caption":"局外用来出行和整备。进入战局后看局内；生涯里查看历史、图鉴和人物档案。","image":"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA3NjAgNDQwIiByb2xlPSJpbWciPjxnIGZvbnQtZmFtaWx5PSJNaWNyb3NvZnQgWWFIZWksU2Vnb2UgVUksc2Fucy1zZXJpZiI+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9Ijc2MCIgaGVpZ2h0PSI0NDAiIHJ4PSIxNCIgZmlsbD0iIzA3MTMwZCIgc3Ryb2tlPSIjMDcxMzBkIi8+PHRleHQgeD0iMjYiIHk9IjM4IiBmaWxsPSIjZTNmMmU3IiBmb250LXNpemU9IjIzIiBmb250LXdlaWdodD0iNzAwIj7lk4jln7rnsbPooYzliqg8L3RleHQ+PHRleHQgeD0iNDAwIiB5PSIzNSIgZmlsbD0iI2I1ZDNiZCIgZm9udC1zaXplPSIxNSIgZm9udC13ZWlnaHQ9IjQwMCI+6KGA6YePIDIwIC8gMjAgICAgMTAwIOWTiOWfuuW4gTwvdGV4dD48cmVjdCB4PSI2NTEiIHk9IjE0IiB3aWR0aD0iNTUiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSI2NjMiIHk9IjM4IiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7vvJ88L3RleHQ+PHJlY3QgeD0iMjQiIHk9IjU4IiB3aWR0aD0iOTYiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSIzNiIgeT0iODIiIGZpbGw9IiNkZWVlZTQiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI0MDAiPuWxgOWGhTwvdGV4dD48cmVjdCB4PSIxMzIiIHk9IjU4IiB3aWR0aD0iOTYiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMjU0NzMzIiBzdHJva2U9IiNmM2NkNzYiLz48dGV4dCB4PSIxNDQiIHk9IjgyIiBmaWxsPSIjZmZlMmEwIiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7lsYDlpJY8L3RleHQ+PHJlY3QgeD0iMjQwIiB5PSI1OCIgd2lkdGg9Ijk2IiBoZWlnaHQ9IjM2IiByeD0iOCIgZmlsbD0iIzE3MmIyMSIgc3Ryb2tlPSIjNGM2YjU1Ii8+PHRleHQgeD0iMjUyIiB5PSI4MiIgZmlsbD0iI2RlZWVlNCIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjQwMCI+55Sf5ravPC90ZXh0PjxyZWN0IHg9IjI0IiB5PSIxMDgiIHdpZHRoPSIxMDgiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMjU0NzMzIiBzdHJva2U9IiNmM2NkNzYiLz48dGV4dCB4PSIzNiIgeT0iMTMyIiBmaWxsPSIjZmZlMmEwIiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7lh7rooYw8L3RleHQ+PHJlY3QgeD0iMTQ0IiB5PSIxMDgiIHdpZHRoPSIxMDgiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSIxNTYiIHk9IjEzMiIgZmlsbD0iI2RlZWVlNCIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjQwMCI+6IOM5YyF5pW05aSHPC90ZXh0PjxyZWN0IHg9IjI2NCIgeT0iMTA4IiB3aWR0aD0iMTA4IiBoZWlnaHQ9IjM2IiByeD0iOCIgZmlsbD0iIzE3MmIyMSIgc3Ryb2tlPSIjNGM2YjU1Ii8+PHRleHQgeD0iMjc2IiB5PSIxMzIiIGZpbGw9IiNkZWVlZTQiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI0MDAiPuS7u+WKoTwvdGV4dD48cmVjdCB4PSIyNCIgeT0iMTY1IiB3aWR0aD0iNzEyIiBoZWlnaHQ9IjI0NSIgcng9IjgiIGZpbGw9IiMxMzI1MWQiIHN0cm9rZT0iIzM1NTE0MiIvPjx0ZXh0IHg9IjQwIiB5PSIxOTMiIGZpbGw9IiNjZWU5ZDUiIGZvbnQtc2l6ZT0iMTkiIGZvbnQtd2VpZ2h0PSI3MDAiPumhtemdouWvvOiIqjwvdGV4dD48cmVjdCB4PSI0OCIgeT0iMjIwIiB3aWR0aD0iMTcwIiBoZWlnaHQ9IjM2IiByeD0iOCIgZmlsbD0iIzI1NDczMyIgc3Ryb2tlPSIjZjNjZDc2Ii8+PHRleHQgeD0iNjAiIHk9IjI0NCIgZmlsbD0iI2ZmZTJhMCIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjQwMCI+5bGA5aSWPC90ZXh0Pjx0ZXh0IHg9IjI0NSIgeT0iMjQ1IiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE5IiBmb250LXdlaWdodD0iNDAwIj7lh7rooYwgwrcg6IOM5YyF5pW05aSHIMK3IOWuieWFqOWxiyDCtyDku7vliqE8L3RleHQ+PHJlY3QgeD0iNDgiIHk9IjI4MCIgd2lkdGg9IjE3MCIgaGVpZ2h0PSIzNiIgcng9IjgiIGZpbGw9IiMxNzJiMjEiIHN0cm9rZT0iIzRjNmI1NSIvPjx0ZXh0IHg9IjYwIiB5PSIzMDQiIGZpbGw9IiNkZWVlZTQiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI0MDAiPuWxgOWGhTwvdGV4dD48dGV4dCB4PSIyNDUiIHk9IjMwNSIgZmlsbD0iI2RlZWVlNCIgZm9udC1zaXplPSIxOSIgZm9udC13ZWlnaHQ9IjQwMCI+6KGM5YqoIMK3IOiDjOWMheaVtOWkhyDCtyDku7vliqE8L3RleHQ+PHJlY3QgeD0iNDgiIHk9IjM0MCIgd2lkdGg9IjE3MCIgaGVpZ2h0PSIzNiIgcng9IjgiIGZpbGw9IiMxNzJiMjEiIHN0cm9rZT0iIzRjNmI1NSIvPjx0ZXh0IHg9IjYwIiB5PSIzNjQiIGZpbGw9IiNkZWVlZTQiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI0MDAiPueUn+a2rzwvdGV4dD48dGV4dCB4PSIyNDUiIHk9IjM2NSIgZmlsbD0iI2RlZWVlNCIgZm9udC1zaXplPSIxOSIgZm9udC13ZWlnaHQ9IjQwMCI+5Y6G5Y+y57uf6K6hIMK3IOWbvumJtCDCtyDkurrnianmoaPmoYg8L3RleHQ+PC9nPjwvc3ZnPg=="},{"title":"先整备，再出行","caption":"在背包里点击物品查看详情，使用或装备。藏匿物与奇物入口在整备页右上方。","image":"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA3NjAgNDQwIiByb2xlPSJpbWciPjxnIGZvbnQtZmFtaWx5PSJNaWNyb3NvZnQgWWFIZWksU2Vnb2UgVUksc2Fucy1zZXJpZiI+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9Ijc2MCIgaGVpZ2h0PSI0NDAiIHJ4PSIxNCIgZmlsbD0iIzA3MTMwZCIgc3Ryb2tlPSIjMDcxMzBkIi8+PHRleHQgeD0iMjYiIHk9IjM4IiBmaWxsPSIjZTNmMmU3IiBmb250LXNpemU9IjIzIiBmb250LXdlaWdodD0iNzAwIj7lk4jln7rnsbPooYzliqg8L3RleHQ+PHRleHQgeD0iNDAwIiB5PSIzNSIgZmlsbD0iI2I1ZDNiZCIgZm9udC1zaXplPSIxNSIgZm9udC13ZWlnaHQ9IjQwMCI+6KGA6YePIDIwIC8gMjAgICAgMTAwIOWTiOWfuuW4gTwvdGV4dD48cmVjdCB4PSI2NTEiIHk9IjE0IiB3aWR0aD0iNTUiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSI2NjMiIHk9IjM4IiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7vvJ88L3RleHQ+PHJlY3QgeD0iMjQiIHk9IjU4IiB3aWR0aD0iOTYiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSIzNiIgeT0iODIiIGZpbGw9IiNkZWVlZTQiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI0MDAiPuWxgOWGhTwvdGV4dD48cmVjdCB4PSIxMzIiIHk9IjU4IiB3aWR0aD0iOTYiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMjU0NzMzIiBzdHJva2U9IiNmM2NkNzYiLz48dGV4dCB4PSIxNDQiIHk9IjgyIiBmaWxsPSIjZmZlMmEwIiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7lsYDlpJY8L3RleHQ+PHJlY3QgeD0iMjQwIiB5PSI1OCIgd2lkdGg9Ijk2IiBoZWlnaHQ9IjM2IiByeD0iOCIgZmlsbD0iIzE3MmIyMSIgc3Ryb2tlPSIjNGM2YjU1Ii8+PHRleHQgeD0iMjUyIiB5PSI4MiIgZmlsbD0iI2RlZWVlNCIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjQwMCI+55Sf5ravPC90ZXh0PjxyZWN0IHg9IjI0IiB5PSIxMDgiIHdpZHRoPSIxMDgiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSIzNiIgeT0iMTMyIiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7lh7rooYw8L3RleHQ+PHJlY3QgeD0iMTQ0IiB5PSIxMDgiIHdpZHRoPSIxMDgiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMjU0NzMzIiBzdHJva2U9IiNmM2NkNzYiLz48dGV4dCB4PSIxNTYiIHk9IjEzMiIgZmlsbD0iI2ZmZTJhMCIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjQwMCI+6IOM5YyF5pW05aSHPC90ZXh0PjxyZWN0IHg9IjI2NCIgeT0iMTA4IiB3aWR0aD0iMTA4IiBoZWlnaHQ9IjM2IiByeD0iOCIgZmlsbD0iIzE3MmIyMSIgc3Ryb2tlPSIjNGM2YjU1Ii8+PHRleHQgeD0iMjc2IiB5PSIxMzIiIGZpbGw9IiNkZWVlZTQiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI0MDAiPuS7u+WKoTwvdGV4dD48dGV4dCB4PSIyOCIgeT0iMTgzIiBmaWxsPSIjZTNmMmU3IiBmb250LXNpemU9IjIxIiBmb250LXdlaWdodD0iNzAwIj7og4zljIXmlbTlpIc8L3RleHQ+PHJlY3QgeD0iNDU4IiB5PSIxNTkiIHdpZHRoPSIxMTUiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMjU0NzMzIiBzdHJva2U9IiNmM2NkNzYiLz48dGV4dCB4PSI0NzAiIHk9IjE4MyIgZmlsbD0iI2ZmZTJhMCIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjQwMCI+6JeP5Yy/54mpPC90ZXh0PjxyZWN0IHg9IjU4NyIgeT0iMTU5IiB3aWR0aD0iMTE1IiBoZWlnaHQ9IjM2IiByeD0iOCIgZmlsbD0iIzI1NDczMyIgc3Ryb2tlPSIjZjNjZDc2Ii8+PHRleHQgeD0iNTk5IiB5PSIxODMiIGZpbGw9IiNmZmUyYTAiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI0MDAiPuWlh+eJqTwvdGV4dD48cmVjdCB4PSIyNCIgeT0iMjE0IiB3aWR0aD0iMjg4IiBoZWlnaHQ9IjE5NiIgcng9IjgiIGZpbGw9IiMxMzI1MWQiIHN0cm9rZT0iIzM1NTE0MiIvPjx0ZXh0IHg9IjQwIiB5PSIyNDIiIGZpbGw9IiNjZWU5ZDUiIGZvbnQtc2l6ZT0iMTkiIGZvbnQtd2VpZ2h0PSI3MDAiPuijheWkh+WIl+ihqDwvdGV4dD48dGV4dCB4PSI0NCIgeT0iMjY5IiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE3IiBmb250LXdlaWdodD0iNDAwIj7kuLvmrablmaggICAg5pegPC90ZXh0Pjx0ZXh0IHg9IjQ0IiB5PSIzMDYiIGZpbGw9IiNkZWVlZTQiIGZvbnQtc2l6ZT0iMTciIGZvbnQtd2VpZ2h0PSI0MDAiPuiDuOeUsiAgICAgICAg5pegPC90ZXh0Pjx0ZXh0IHg9IjQ0IiB5PSIzNDMiIGZpbGw9IiNkZWVlZTQiIGZvbnQtc2l6ZT0iMTciIGZvbnQtd2VpZ2h0PSI0MDAiPuiDjOWMhSAgICAgICAg5pegPC90ZXh0PjxyZWN0IHg9IjMzMCIgeT0iMjE0IiB3aWR0aD0iNDA2IiBoZWlnaHQ9IjE5NiIgcng9IjgiIGZpbGw9IiMxMzI1MWQiIHN0cm9rZT0iIzM1NTE0MiIvPjx0ZXh0IHg9IjM0NiIgeT0iMjQyIiBmaWxsPSIjY2VlOWQ1IiBmb250LXNpemU9IjE5IiBmb250LXdlaWdodD0iNzAwIj7mkLrluKbmlLbol4/lk4E8L3RleHQ+PHRleHQgeD0iMzUyIiB5PSIyNjgiIGZpbGw9IiNkZWVlZTQiIGZvbnQtc2l6ZT0iMjEiIGZvbnQtd2VpZ2h0PSI0MDAiPuerueiKguervyDDlzE8L3RleHQ+PHRleHQgeD0iMzUyIiB5PSIzMDMiIGZpbGw9IiNkZWVlZTQiIGZvbnQtc2l6ZT0iMTkiIGZvbnQtd2VpZ2h0PSI0MDAiPuS4gOS7veeyvua2siDDlzU8L3RleHQ+PHJlY3QgeD0iMzUyIiB5PSIzNDQiIHdpZHRoPSIxMDAiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSIzNjQiIHk9IjM2OCIgZmlsbD0iI2RlZWVlNCIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjQwMCI+6K+m5oOFPC90ZXh0PjxyZWN0IHg9IjQ3MCIgeT0iMzQ0IiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjM2IiByeD0iOCIgZmlsbD0iIzI1NDczMyIgc3Ryb2tlPSIjZjNjZDc2Ii8+PHRleHQgeD0iNDgyIiB5PSIzNjgiIGZpbGw9IiNmZmUyYTAiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI0MDAiPuijheWkhzwvdGV4dD48L2c+PC9zdmc+"},{"title":"哈基米军需店","caption":"先在局外出行页前往哈基米军需店，再到交易页选购已解锁的装备和消耗品。加入购物车、确认数量后，用哈基币结算；购入物品在背包整备中使用或装备。","image":"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA3NjAgNDQwIiByb2xlPSJpbWciPgo8ZyBmb250LWZhbWlseT0iTWljcm9zb2Z0IFlhSGVpLFNlZ29lIFVJLHNhbnMtc2VyaWYiPjxyZWN0IHdpZHRoPSI3NjAiIGhlaWdodD0iNDQwIiByeD0iMTQiIGZpbGw9IiMwNzEzMGQiLz4KPHRleHQgeD0iMjYiIHk9IjM4IiBmaWxsPSIjZTNmMmU3IiBmb250LXNpemU9IjIzIiBmb250LXdlaWdodD0iNzAwIj7lk4jln7rnsbPooYzliqg8L3RleHQ+PHRleHQgeD0iNDMwIiB5PSIzNSIgZmlsbD0iI2I1ZDNiZCIgZm9udC1zaXplPSIxNSI+5bGA5aSWIMK3IOS6pOaYkzwvdGV4dD4KPHJlY3QgeD0iMjQiIHk9IjU4IiB3aWR0aD0iOTYiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSIzNiIgeT0iODIiIGZpbGw9IiNkZWVlZTQiIGZvbnQtc2l6ZT0iMTYiPuWxgOWGhTwvdGV4dD4KPHJlY3QgeD0iMTMyIiB5PSI1OCIgd2lkdGg9Ijk2IiBoZWlnaHQ9IjM2IiByeD0iOCIgZmlsbD0iIzI1NDczMyIgc3Ryb2tlPSIjZjNjZDc2Ii8+PHRleHQgeD0iMTQ0IiB5PSI4MiIgZmlsbD0iI2ZmZTJhMCIgZm9udC1zaXplPSIxNiI+5bGA5aSWPC90ZXh0Pgo8cmVjdCB4PSIyNDAiIHk9IjU4IiB3aWR0aD0iOTYiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSIyNTIiIHk9IjgyIiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE2Ij7nlJ/mtq88L3RleHQ+CjxyZWN0IHg9IjI0IiB5PSIxMDgiIHdpZHRoPSIxMDgiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSIzNiIgeT0iMTMyIiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE2Ij7lh7rooYw8L3RleHQ+CjxyZWN0IHg9IjE0NCIgeT0iMTA4IiB3aWR0aD0iMTA4IiBoZWlnaHQ9IjM2IiByeD0iOCIgZmlsbD0iIzE3MmIyMSIgc3Ryb2tlPSIjNGM2YjU1Ii8+PHRleHQgeD0iMTU2IiB5PSIxMzIiIGZpbGw9IiNkZWVlZTQiIGZvbnQtc2l6ZT0iMTYiPuiDjOWMheaVtOWkhzwvdGV4dD4KPHJlY3QgeD0iMjY0IiB5PSIxMDgiIHdpZHRoPSIxMDgiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMjU0NzMzIiBzdHJva2U9IiNmM2NkNzYiLz48dGV4dCB4PSIyNzYiIHk9IjEzMiIgZmlsbD0iI2ZmZTJhMCIgZm9udC1zaXplPSIxNiI+5Lqk5piTPC90ZXh0Pgo8cmVjdCB4PSIyNCIgeT0iMTY1IiB3aWR0aD0iNzEyIiBoZWlnaHQ9IjI0NSIgcng9IjgiIGZpbGw9IiMxMzI1MWQiIHN0cm9rZT0iIzM1NTE0MiIvPgo8dGV4dCB4PSI0MiIgeT0iMTk2IiBmaWxsPSIjY2VlOWQ1IiBmb250LXNpemU9IjIxIiBmb250LXdlaWdodD0iNzAwIj7lk4jln7rnsbPlhpvpnIDlupc8L3RleHQ+CjxyZWN0IHg9IjQyIiB5PSIyMTciIHdpZHRoPSIyNzAiIGhlaWdodD0iMTMyIiByeD0iNiIgZmlsbD0iIzE3MmIyMSIgc3Ryb2tlPSIjNGM2YjU1Ii8+Cjx0ZXh0IHg9IjU4IiB5PSIyNDYiIGZpbGw9IiNkZWVlZTQiIGZvbnQtc2l6ZT0iMTgiPuWbuuWumuijheWkh+S4jua2iOiAl+WTgTwvdGV4dD48dGV4dCB4PSI1OCIgeT0iMjc4IiBmaWxsPSIjYjVkM2JkIiBmb250LXNpemU9IjE2Ij7mn6XnnIvku7fmoLzkuI7op6PplIHmnaHku7Y8L3RleHQ+CjxyZWN0IHg9IjU4IiB5PSIyOTYiIHdpZHRoPSIxNTIiIGhlaWdodD0iMzYiIHJ4PSI2IiBmaWxsPSIjMjU0NzMzIiBzdHJva2U9IiNmM2NkNzYiLz48dGV4dCB4PSI3NCIgeT0iMzIwIiBmaWxsPSIjZmZlMmEwIiBmb250LXNpemU9IjE2Ij7liqDlhaXotK3nianovaY8L3RleHQ+CjxwYXRoIGQ9Ik0zMjggMjc4aDQ2bS0xMC0xMCAxMCAxMC0xMCAxMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZjNjZDc2IiBzdHJva2Utd2lkdGg9IjMiLz4KPHJlY3QgeD0iMzkyIiB5PSIyMTciIHdpZHRoPSIzMjQiIGhlaWdodD0iMTMyIiByeD0iNiIgZmlsbD0iIzE3MmIyMSIgc3Ryb2tlPSIjNGM2YjU1Ii8+Cjx0ZXh0IHg9IjQwOCIgeT0iMjQ2IiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE4Ij7otK3nianovaY8L3RleHQ+PHRleHQgeD0iNDA4IiB5PSIyNzgiIGZpbGw9IiNiNWQzYmQiIGZvbnQtc2l6ZT0iMTYiPuaguOWvueaVsOmHj+S4juWTiOWfuuW4geaAu+S7tzwvdGV4dD4KPHJlY3QgeD0iNDA4IiB5PSIyOTYiIHdpZHRoPSIxNDQiIGhlaWdodD0iMzYiIHJ4PSI2IiBmaWxsPSIjMjU0NzMzIiBzdHJva2U9IiNmM2NkNzYiLz48dGV4dCB4PSI0MjQiIHk9IjMyMCIgZmlsbD0iI2ZmZTJhMCIgZm9udC1zaXplPSIxNiI+57uT566XPC90ZXh0Pgo8dGV4dCB4PSI0MiIgeT0iMzgyIiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE3Ij7lhYjliLDlhpvpnIDlupfvvIzlho3pgInotK3nianlk4HvvJvotK3lhaXlkI7liLDog4zljIXmlbTlpIfkuK3oo4XlpIfjgII8L3RleHQ+CjwvZz48L3N2Zz4="},{"title":"选择地图进入战局","caption":"在局外的出行页选择地图，确认入局。进入战局后，在局内行动页查看当前位置和可走的路线。","image":"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA3NjAgNDQwIiByb2xlPSJpbWciPjxnIGZvbnQtZmFtaWx5PSJNaWNyb3NvZnQgWWFIZWksU2Vnb2UgVUksc2Fucy1zZXJpZiI+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9Ijc2MCIgaGVpZ2h0PSI0NDAiIHJ4PSIxNCIgZmlsbD0iIzA3MTMwZCIgc3Ryb2tlPSIjMDcxMzBkIi8+PHRleHQgeD0iMjYiIHk9IjM4IiBmaWxsPSIjZTNmMmU3IiBmb250LXNpemU9IjIzIiBmb250LXdlaWdodD0iNzAwIj7lk4jln7rnsbPooYzliqg8L3RleHQ+PHRleHQgeD0iNDAwIiB5PSIzNSIgZmlsbD0iI2I1ZDNiZCIgZm9udC1zaXplPSIxNSIgZm9udC13ZWlnaHQ9IjQwMCI+6KGA6YePIDIwIC8gMjAgICAgMTAwIOWTiOWfuuW4gTwvdGV4dD48cmVjdCB4PSI2NTEiIHk9IjE0IiB3aWR0aD0iNTUiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSI2NjMiIHk9IjM4IiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7vvJ88L3RleHQ+PHJlY3QgeD0iMjQiIHk9IjU4IiB3aWR0aD0iOTYiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSIzNiIgeT0iODIiIGZpbGw9IiNkZWVlZTQiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI0MDAiPuWxgOWGhTwvdGV4dD48cmVjdCB4PSIxMzIiIHk9IjU4IiB3aWR0aD0iOTYiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMjU0NzMzIiBzdHJva2U9IiNmM2NkNzYiLz48dGV4dCB4PSIxNDQiIHk9IjgyIiBmaWxsPSIjZmZlMmEwIiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7lsYDlpJY8L3RleHQ+PHJlY3QgeD0iMjQwIiB5PSI1OCIgd2lkdGg9Ijk2IiBoZWlnaHQ9IjM2IiByeD0iOCIgZmlsbD0iIzE3MmIyMSIgc3Ryb2tlPSIjNGM2YjU1Ii8+PHRleHQgeD0iMjUyIiB5PSI4MiIgZmlsbD0iI2RlZWVlNCIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjQwMCI+55Sf5ravPC90ZXh0PjxyZWN0IHg9IjI0IiB5PSIxMDgiIHdpZHRoPSIxMDgiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMjU0NzMzIiBzdHJva2U9IiNmM2NkNzYiLz48dGV4dCB4PSIzNiIgeT0iMTMyIiBmaWxsPSIjZmZlMmEwIiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7lh7rooYw8L3RleHQ+PHJlY3QgeD0iMTQ0IiB5PSIxMDgiIHdpZHRoPSIxMDgiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSIxNTYiIHk9IjEzMiIgZmlsbD0iI2RlZWVlNCIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjQwMCI+6IOM5YyF5pW05aSHPC90ZXh0PjxyZWN0IHg9IjI2NCIgeT0iMTA4IiB3aWR0aD0iMTA4IiBoZWlnaHQ9IjM2IiByeD0iOCIgZmlsbD0iIzE3MmIyMSIgc3Ryb2tlPSIjNGM2YjU1Ii8+PHRleHQgeD0iMjc2IiB5PSIxMzIiIGZpbGw9IiNkZWVlZTQiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI0MDAiPuS7u+WKoTwvdGV4dD48cmVjdCB4PSIyNCIgeT0iMTY1IiB3aWR0aD0iMzIwIiBoZWlnaHQ9IjI0NSIgcng9IjgiIGZpbGw9IiMxMzI1MWQiIHN0cm9rZT0iIzM1NTE0MiIvPjx0ZXh0IHg9IjQwIiB5PSIxOTMiIGZpbGw9IiNjZWU5ZDUiIGZvbnQtc2l6ZT0iMTkiIGZvbnQtd2VpZ2h0PSI3MDAiPuWHuuihjDwvdGV4dD48cmVjdCB4PSI0OCIgeT0iMjIxIiB3aWR0aD0iMjYwIiBoZWlnaHQ9IjM2IiByeD0iOCIgZmlsbD0iIzI1NDczMyIgc3Ryb2tlPSIjZjNjZDc2Ii8+PHRleHQgeD0iNjAiIHk9IjI0NSIgZmlsbD0iI2ZmZTJhMCIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjQwMCI+6LC35q2M5aSn5Y6mPC90ZXh0PjxyZWN0IHg9IjQ4IiB5PSIyODEiIHdpZHRoPSIyNjAiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSI2MCIgeT0iMzA1IiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7prZTprLzmtbc8L3RleHQ+PHRleHQgeD0iNDgiIHk9IjM2NCIgZmlsbD0iI2I1ZDNiZCIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjQwMCI+5YWl5bGA5raI6ICX5Lul5Zyw5Zu+5oyJ6ZKu5Li65YeGPC90ZXh0PjxyZWN0IHg9IjM2NCIgeT0iMTY1IiB3aWR0aD0iMzcyIiBoZWlnaHQ9IjI0NSIgcng9IjgiIGZpbGw9IiMxMzI1MWQiIHN0cm9rZT0iIzM1NTE0MiIvPjx0ZXh0IHg9IjM4MCIgeT0iMTkzIiBmaWxsPSIjY2VlOWQ1IiBmb250LXNpemU9IjE5IiBmb250LXdlaWdodD0iNzAwIj7lnLDlm77lr7zoiKo8L3RleHQ+PHJlY3QgeD0iMzkwIiB5PSIyMjEiIHdpZHRoPSIxNDgiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSI0MDIiIHk9IjI0NSIgZmlsbD0iI2RlZWVlNCIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjQwMCI+5b2T5YmN5L2N572uPC90ZXh0PjxyZWN0IHg9IjU1MyIgeT0iMjgwIiB3aWR0aD0iMTQ4IiBoZWlnaHQ9IjM2IiByeD0iOCIgZmlsbD0iIzI1NDczMyIgc3Ryb2tlPSIjZjNjZDc2Ii8+PHRleHQgeD0iNTY1IiB5PSIzMDQiIGZpbGw9IiNmZmUyYTAiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI0MDAiPuebuOmCu+WMuuWfnzwvdGV4dD48dGV4dCB4PSIzOTAiIHk9IjM0OSIgZmlsbD0iI2RlZWVlNCIgZm9udC1zaXplPSIxOSIgZm9udC13ZWlnaHQ9IjQwMCI+56e75Yqo5YmN55yL5Ymp5L2Z6L2u5pWwPC90ZXh0Pjx0ZXh0IHg9IjM5MCIgeT0iMzgxIiBmaWxsPSIjYjVkM2JkIiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7mkqTnprvngrnmnInlkIToh6rnmoTlvIDmlL7mnaHku7Y8L3RleHQ+PC9nPjwvc3ZnPg=="},{"title":"搜索、查看、拿上","caption":"在局内点击搜寻。打开物品详情后决定拿上、装备或丢弃；留意负重和剩余轮数。","image":"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA3NjAgNDQwIiByb2xlPSJpbWciPjxnIGZvbnQtZmFtaWx5PSJNaWNyb3NvZnQgWWFIZWksU2Vnb2UgVUksc2Fucy1zZXJpZiI+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9Ijc2MCIgaGVpZ2h0PSI0NDAiIHJ4PSIxNCIgZmlsbD0iIzA3MTMwZCIgc3Ryb2tlPSIjMDcxMzBkIi8+PHRleHQgeD0iMjYiIHk9IjM4IiBmaWxsPSIjZTNmMmU3IiBmb250LXNpemU9IjIzIiBmb250LXdlaWdodD0iNzAwIj7lk4jln7rnsbPooYzliqg8L3RleHQ+PHRleHQgeD0iNDAwIiB5PSIzNSIgZmlsbD0iI2I1ZDNiZCIgZm9udC1zaXplPSIxNSIgZm9udC13ZWlnaHQ9IjQwMCI+6KGA6YePIDIwIC8gMjAgICAgMTAwIOWTiOWfuuW4gTwvdGV4dD48cmVjdCB4PSI2NTEiIHk9IjE0IiB3aWR0aD0iNTUiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSI2NjMiIHk9IjM4IiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7vvJ88L3RleHQ+PHJlY3QgeD0iMjQiIHk9IjU4IiB3aWR0aD0iOTYiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMjU0NzMzIiBzdHJva2U9IiNmM2NkNzYiLz48dGV4dCB4PSIzNiIgeT0iODIiIGZpbGw9IiNmZmUyYTAiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI0MDAiPuWxgOWGhTwvdGV4dD48cmVjdCB4PSIxMzIiIHk9IjU4IiB3aWR0aD0iOTYiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSIxNDQiIHk9IjgyIiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7lsYDlpJY8L3RleHQ+PHJlY3QgeD0iMjQwIiB5PSI1OCIgd2lkdGg9Ijk2IiBoZWlnaHQ9IjM2IiByeD0iOCIgZmlsbD0iIzE3MmIyMSIgc3Ryb2tlPSIjNGM2YjU1Ii8+PHRleHQgeD0iMjUyIiB5PSI4MiIgZmlsbD0iI2RlZWVlNCIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjQwMCI+55Sf5ravPC90ZXh0PjxyZWN0IHg9IjI0IiB5PSIxMDgiIHdpZHRoPSIxMDgiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSIzNiIgeT0iMTMyIiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7lh7rooYw8L3RleHQ+PHJlY3QgeD0iMTQ0IiB5PSIxMDgiIHdpZHRoPSIxMDgiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSIxNTYiIHk9IjEzMiIgZmlsbD0iI2RlZWVlNCIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjQwMCI+6IOM5YyF5pW05aSHPC90ZXh0PjxyZWN0IHg9IjI2NCIgeT0iMTA4IiB3aWR0aD0iMTA4IiBoZWlnaHQ9IjM2IiByeD0iOCIgZmlsbD0iIzE3MmIyMSIgc3Ryb2tlPSIjNGM2YjU1Ii8+PHRleHQgeD0iMjc2IiB5PSIxMzIiIGZpbGw9IiNkZWVlZTQiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI0MDAiPuS7u+WKoTwvdGV4dD48cmVjdCB4PSIyNCIgeT0iMTY1IiB3aWR0aD0iMzEyIiBoZWlnaHQ9IjI0NSIgcng9IjgiIGZpbGw9IiMxMzI1MWQiIHN0cm9rZT0iIzM1NTE0MiIvPjx0ZXh0IHg9IjQwIiB5PSIxOTMiIGZpbGw9IiNjZWU5ZDUiIGZvbnQtc2l6ZT0iMTkiIGZvbnQtd2VpZ2h0PSI3MDAiPuW9k+WJjeihjOWKqDwvdGV4dD48dGV4dCB4PSI0NiIgeT0iMjIwIiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE3IiBmb250LXdlaWdodD0iNDAwIj7ooYDph48gMjAgLyAyMDwvdGV4dD48dGV4dCB4PSI0NiIgeT0iMjU5IiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE3IiBmb250LXdlaWdodD0iNDAwIj7otJ/ph40gOCAvIDQwPC90ZXh0Pjx0ZXh0IHg9IjQ2IiB5PSIyOTgiIGZpbGw9IiNkZWVlZTQiIGZvbnQtc2l6ZT0iMTciIGZvbnQtd2VpZ2h0PSI0MDAiPuWJqeS9mSAyNCDova48L3RleHQ+PHJlY3QgeD0iNDYiIHk9IjM0NSIgd2lkdGg9IjI2MiIgaGVpZ2h0PSIzNiIgcng9IjgiIGZpbGw9IiMyNTQ3MzMiIHN0cm9rZT0iI2YzY2Q3NiIvPjx0ZXh0IHg9IjU4IiB5PSIzNjkiIGZpbGw9IiNmZmUyYTAiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI0MDAiPuaQnOWvuzwvdGV4dD48cmVjdCB4PSIzNTYiIHk9IjE2NSIgd2lkdGg9IjM4MCIgaGVpZ2h0PSIyNDUiIHJ4PSI4IiBmaWxsPSIjMTMyNTFkIiBzdHJva2U9IiMzNTUxNDIiLz48dGV4dCB4PSIzNzIiIHk9IjE5MyIgZmlsbD0iI2NlZTlkNSIgZm9udC1zaXplPSIxOSIgZm9udC13ZWlnaHQ9IjcwMCI+5pCc57Si5omA5b6XPC90ZXh0Pjx0ZXh0IHg9IjM4MiIgeT0iMjIwIiBmaWxsPSIjZDhlY2JkIiBmb250LXNpemU9IjIyIiBmb250LXdlaWdodD0iNzAwIj7lj6Tku6Ppk7bluIEgw5cxPC90ZXh0Pjx0ZXh0IHg9IjM4MiIgeT0iMjYwIiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE3IiBmb250LXdlaWdodD0iNDAwIj7ku7flgLwgMzYg5ZOI5Z+65biBPC90ZXh0Pjx0ZXh0IHg9IjM4MiIgeT0iMjk2IiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE3IiBmb250LXdlaWdodD0iNDAwIj7ph43ph48gMSBLRzwvdGV4dD48cmVjdCB4PSIzODIiIHk9IjM0NSIgd2lkdGg9IjEzNSIgaGVpZ2h0PSIzNiIgcng9IjgiIGZpbGw9IiMyNTQ3MzMiIHN0cm9rZT0iI2YzY2Q3NiIvPjx0ZXh0IHg9IjM5NCIgeT0iMzY5IiBmaWxsPSIjZmZlMmEwIiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7mi7/kuIo8L3RleHQ+PHJlY3QgeD0iNTM1IiB5PSIzNDUiIHdpZHRoPSIxMzUiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSI1NDciIHk9IjM2OSIgZmlsbD0iI2RlZWVlNCIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjQwMCI+6K+m5oOFPC90ZXh0PjwvZz48L3N2Zz4="},{"title":"行动与撤离","caption":"遭遇敌人时，通过酒馆输入框描述你的行动。在魔鬼海也要看水下行动值；前往撤离点前先检查撤离条件。","image":"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA3NjAgNDQwIiByb2xlPSJpbWciPjxnIGZvbnQtZmFtaWx5PSJNaWNyb3NvZnQgWWFIZWksU2Vnb2UgVUksc2Fucy1zZXJpZiI+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9Ijc2MCIgaGVpZ2h0PSI0NDAiIHJ4PSIxNCIgZmlsbD0iIzA3MTMwZCIgc3Ryb2tlPSIjMDcxMzBkIi8+PHRleHQgeD0iMjYiIHk9IjM4IiBmaWxsPSIjZTNmMmU3IiBmb250LXNpemU9IjIzIiBmb250LXdlaWdodD0iNzAwIj7lk4jln7rnsbPooYzliqg8L3RleHQ+PHRleHQgeD0iNDAwIiB5PSIzNSIgZmlsbD0iI2I1ZDNiZCIgZm9udC1zaXplPSIxNSIgZm9udC13ZWlnaHQ9IjQwMCI+6KGA6YePIDIwIC8gMjAgICAgMTAwIOWTiOWfuuW4gTwvdGV4dD48cmVjdCB4PSI2NTEiIHk9IjE0IiB3aWR0aD0iNTUiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSI2NjMiIHk9IjM4IiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7vvJ88L3RleHQ+PHJlY3QgeD0iMjQiIHk9IjU4IiB3aWR0aD0iOTYiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMjU0NzMzIiBzdHJva2U9IiNmM2NkNzYiLz48dGV4dCB4PSIzNiIgeT0iODIiIGZpbGw9IiNmZmUyYTAiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI0MDAiPuWxgOWGhTwvdGV4dD48cmVjdCB4PSIxMzIiIHk9IjU4IiB3aWR0aD0iOTYiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSIxNDQiIHk9IjgyIiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7lsYDlpJY8L3RleHQ+PHJlY3QgeD0iMjQwIiB5PSI1OCIgd2lkdGg9Ijk2IiBoZWlnaHQ9IjM2IiByeD0iOCIgZmlsbD0iIzE3MmIyMSIgc3Ryb2tlPSIjNGM2YjU1Ii8+PHRleHQgeD0iMjUyIiB5PSI4MiIgZmlsbD0iI2RlZWVlNCIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjQwMCI+55Sf5ravPC90ZXh0PjxyZWN0IHg9IjI0IiB5PSIxMDgiIHdpZHRoPSIxMDgiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSIzNiIgeT0iMTMyIiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7lh7rooYw8L3RleHQ+PHJlY3QgeD0iMTQ0IiB5PSIxMDgiIHdpZHRoPSIxMDgiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSIxNTYiIHk9IjEzMiIgZmlsbD0iI2RlZWVlNCIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjQwMCI+6IOM5YyF5pW05aSHPC90ZXh0PjxyZWN0IHg9IjI2NCIgeT0iMTA4IiB3aWR0aD0iMTA4IiBoZWlnaHQ9IjM2IiByeD0iOCIgZmlsbD0iIzE3MmIyMSIgc3Ryb2tlPSIjNGM2YjU1Ii8+PHRleHQgeD0iMjc2IiB5PSIxMzIiIGZpbGw9IiNkZWVlZTQiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI0MDAiPuS7u+WKoTwvdGV4dD48cmVjdCB4PSIyNCIgeT0iMTY1IiB3aWR0aD0iMzIwIiBoZWlnaHQ9IjI0NSIgcng9IjgiIGZpbGw9IiMxMzI1MWQiIHN0cm9rZT0iIzM1NTE0MiIvPjx0ZXh0IHg9IjQwIiB5PSIxOTMiIGZpbGw9IiNjZWU5ZDUiIGZvbnQtc2l6ZT0iMTkiIGZvbnQtd2VpZ2h0PSI3MDAiPuaVjOS6ujwvdGV4dD48dGV4dCB4PSI0OCIgeT0iMjIyIiBmaWxsPSIjZjBiOWEwIiBmb250LXNpemU9IjIyIiBmb250LXdlaWdodD0iNzAwIj7mlYzlr7nnm67moIc8L3RleHQ+PHRleHQgeD0iNDgiIHk9IjI2NCIgZmlsbD0iI2RlZWVlNCIgZm9udC1zaXplPSIxNyIgZm9udC13ZWlnaHQ9IjQwMCI+5p+l55yL6KGA6YeP44CB54q25oCB5ZKM6Led56a7PC90ZXh0PjxyZWN0IHg9IjQ4IiB5PSIzMTAiIHdpZHRoPSIyNzAiIGhlaWdodD0iNjUiIHJ4PSI4IiBmaWxsPSIjMDgxNjBlIiBzdHJva2U9IiMzNTUxNDIiLz48dGV4dCB4PSI2MyIgeT0iMzM2IiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE3IiBmb250LXdlaWdodD0iNDAwIj7lnKjphZLppobovpPlhaXmoYbmj4/ov7DooYzliqg8L3RleHQ+PHRleHQgeD0iNjMiIHk9IjM2MyIgZmlsbD0iI2RlZWVlNCIgZm9udC1zaXplPSIxNyIgZm9udC13ZWlnaHQ9IjQwMCI+5pS75Ye744CB6Lqy6YG/5oiW5bCd6K+V6ISx6LqrPC90ZXh0PjxyZWN0IHg9IjM2NCIgeT0iMTY1IiB3aWR0aD0iMzcyIiBoZWlnaHQ9IjI0NSIgcng9IjgiIGZpbGw9IiMxMzI1MWQiIHN0cm9rZT0iIzM1NTE0MiIvPjx0ZXh0IHg9IjM4MCIgeT0iMTkzIiBmaWxsPSIjY2VlOWQ1IiBmb250LXNpemU9IjE5IiBmb250LXdlaWdodD0iNzAwIj7prZTprLzmtbc8L3RleHQ+PHRleHQgeD0iMzkwIiB5PSIyMjIiIGZpbGw9IiNiOGRiZWYiIGZvbnQtc2l6ZT0iMjMiIGZvbnQtd2VpZ2h0PSI3MDAiPuawtOS4iyA2IC8gODwvdGV4dD48dGV4dCB4PSIzOTAiIHk9IjI2NSIgZmlsbD0iI2RlZWVlNCIgZm9udC1zaXplPSIxNyIgZm9udC13ZWlnaHQ9IjQwMCI+5pyJ5rCn5Yy65Z+f5Y+v6KGl5ruh6KGM5Yqo5YC8PC90ZXh0PjxyZWN0IHg9IjM5MCIgeT0iMzE5IiB3aWR0aD0iMzEwIiBoZWlnaHQ9IjM2IiByeD0iOCIgZmlsbD0iIzI1NDczMyIgc3Ryb2tlPSIjZjNjZDc2Ii8+PHRleHQgeD0iNDAyIiB5PSIzNDMiIGZpbGw9IiNmZmUyYTAiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI0MDAiPuafpeeci+aSpOemu+adoeS7tjwvdGV4dD48L2c+PC9zdmc+"},{"title":"接取任务，查看进度","caption":"在任务页查看可接取的任务，点接取任务后随下一次行动提交。已接取的任务可以展开查看目标、报酬和进度。","image":"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA3NjAgNDQwIiByb2xlPSJpbWciPjxnIGZvbnQtZmFtaWx5PSJNaWNyb3NvZnQgWWFIZWksU2Vnb2UgVUksc2Fucy1zZXJpZiI+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9Ijc2MCIgaGVpZ2h0PSI0NDAiIHJ4PSIxNCIgZmlsbD0iIzA3MTMwZCIgc3Ryb2tlPSIjMDcxMzBkIi8+PHRleHQgeD0iMjYiIHk9IjM4IiBmaWxsPSIjZTNmMmU3IiBmb250LXNpemU9IjIzIiBmb250LXdlaWdodD0iNzAwIj7lk4jln7rnsbPooYzliqg8L3RleHQ+PHRleHQgeD0iNDAwIiB5PSIzNSIgZmlsbD0iI2I1ZDNiZCIgZm9udC1zaXplPSIxNSIgZm9udC13ZWlnaHQ9IjQwMCI+6KGA6YePIDIwIC8gMjAgICAgMTAwIOWTiOWfuuW4gTwvdGV4dD48cmVjdCB4PSI2NTEiIHk9IjE0IiB3aWR0aD0iNTUiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSI2NjMiIHk9IjM4IiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7vvJ88L3RleHQ+PHJlY3QgeD0iMjQiIHk9IjU4IiB3aWR0aD0iOTYiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSIzNiIgeT0iODIiIGZpbGw9IiNkZWVlZTQiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI0MDAiPuWxgOWGhTwvdGV4dD48cmVjdCB4PSIxMzIiIHk9IjU4IiB3aWR0aD0iOTYiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMjU0NzMzIiBzdHJva2U9IiNmM2NkNzYiLz48dGV4dCB4PSIxNDQiIHk9IjgyIiBmaWxsPSIjZmZlMmEwIiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7lsYDlpJY8L3RleHQ+PHJlY3QgeD0iMjQwIiB5PSI1OCIgd2lkdGg9Ijk2IiBoZWlnaHQ9IjM2IiByeD0iOCIgZmlsbD0iIzE3MmIyMSIgc3Ryb2tlPSIjNGM2YjU1Ii8+PHRleHQgeD0iMjUyIiB5PSI4MiIgZmlsbD0iI2RlZWVlNCIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjQwMCI+55Sf5ravPC90ZXh0PjxyZWN0IHg9IjI0IiB5PSIxMDgiIHdpZHRoPSIxMDgiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSIzNiIgeT0iMTMyIiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7lh7rooYw8L3RleHQ+PHJlY3QgeD0iMTQ0IiB5PSIxMDgiIHdpZHRoPSIxMDgiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSIxNTYiIHk9IjEzMiIgZmlsbD0iI2RlZWVlNCIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjQwMCI+6IOM5YyF5pW05aSHPC90ZXh0PjxyZWN0IHg9IjI2NCIgeT0iMTA4IiB3aWR0aD0iMTA4IiBoZWlnaHQ9IjM2IiByeD0iOCIgZmlsbD0iIzI1NDczMyIgc3Ryb2tlPSIjZjNjZDc2Ii8+PHRleHQgeD0iMjc2IiB5PSIxMzIiIGZpbGw9IiNmZmUyYTAiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI0MDAiPuS7u+WKoTwvdGV4dD48cmVjdCB4PSIyNCIgeT0iMTY1IiB3aWR0aD0iNzEyIiBoZWlnaHQ9IjI0NSIgcng9IjgiIGZpbGw9IiMxMzI1MWQiIHN0cm9rZT0iIzM1NTE0MiIvPjx0ZXh0IHg9IjQwIiB5PSIxOTMiIGZpbGw9IiNjZWU5ZDUiIGZvbnQtc2l6ZT0iMTkiIGZvbnQtd2VpZ2h0PSI3MDAiPuS7u+WKoTwvdGV4dD48cmVjdCB4PSI0OCIgeT0iMjExIiB3aWR0aD0iMTgwIiBoZWlnaHQ9IjM2IiByeD0iOCIgZmlsbD0iIzI1NDczMyIgc3Ryb2tlPSIjZjNjZDc2Ii8+PHRleHQgeD0iNjAiIHk9IjIzNSIgZmlsbD0iI2ZmZTJhMCIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjQwMCI+5Y+v5o6l5Y+WPC90ZXh0PjxyZWN0IHg9IjI0NSIgeT0iMjExIiB3aWR0aD0iMTgwIiBoZWlnaHQ9IjM2IiByeD0iOCIgZmlsbD0iIzE3MmIyMSIgc3Ryb2tlPSIjNGM2YjU1Ii8+PHRleHQgeD0iMjU3IiB5PSIyMzUiIGZpbGw9IiNkZWVlZTQiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI0MDAiPui/m+ihjOS4rTwvdGV4dD48dGV4dCB4PSI0OCIgeT0iMjg5IiBmaWxsPSIjZTRlZmQ1IiBmb250LXNpemU9IjIyIiBmb250LXdlaWdodD0iNzAwIj7ku7vliqHnm67moIc8L3RleHQ+PHRleHQgeD0iNDgiIHk9IjMyOSIgZmlsbD0iI2RlZWVlNCIgZm9udC1zaXplPSIxOSIgZm9udC13ZWlnaHQ9IjQwMCI+5oql6YWsIMK3IOW9k+WJjei/m+W6piDCtyDnm67moIfov5vluqY8L3RleHQ+PHJlY3QgeD0iNTI5IiB5PSIzNDIiIHdpZHRoPSIxODAiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMjU0NzMzIiBzdHJva2U9IiNmM2NkNzYiLz48dGV4dCB4PSI1NDEiIHk9IjM2NiIgZmlsbD0iI2ZmZTJhMCIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjQwMCI+5o6l5Y+W5Lu75YqhPC90ZXh0PjwvZz48L3N2Zz4="},{"title":"存档与重看教学","caption":"点更多，再点存档，保存快照或导出文件。需要时点右上角的？重新查看这些教学图。","image":"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA3NjAgNDQwIiByb2xlPSJpbWciPjxnIGZvbnQtZmFtaWx5PSJNaWNyb3NvZnQgWWFIZWksU2Vnb2UgVUksc2Fucy1zZXJpZiI+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9Ijc2MCIgaGVpZ2h0PSI0NDAiIHJ4PSIxNCIgZmlsbD0iIzA3MTMwZCIgc3Ryb2tlPSIjMDcxMzBkIi8+PHRleHQgeD0iMjYiIHk9IjM4IiBmaWxsPSIjZTNmMmU3IiBmb250LXNpemU9IjIzIiBmb250LXdlaWdodD0iNzAwIj7lk4jln7rnsbPooYzliqg8L3RleHQ+PHRleHQgeD0iNDAwIiB5PSIzNSIgZmlsbD0iI2I1ZDNiZCIgZm9udC1zaXplPSIxNSIgZm9udC13ZWlnaHQ9IjQwMCI+6KGA6YePIDIwIC8gMjAgICAgMTAwIOWTiOWfuuW4gTwvdGV4dD48cmVjdCB4PSI2NTEiIHk9IjE0IiB3aWR0aD0iNTUiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSI2NjMiIHk9IjM4IiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7vvJ88L3RleHQ+PHJlY3QgeD0iMjQiIHk9IjU4IiB3aWR0aD0iOTYiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSIzNiIgeT0iODIiIGZpbGw9IiNkZWVlZTQiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI0MDAiPuWxgOWGhTwvdGV4dD48cmVjdCB4PSIxMzIiIHk9IjU4IiB3aWR0aD0iOTYiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMjU0NzMzIiBzdHJva2U9IiNmM2NkNzYiLz48dGV4dCB4PSIxNDQiIHk9IjgyIiBmaWxsPSIjZmZlMmEwIiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7lsYDlpJY8L3RleHQ+PHJlY3QgeD0iMjQwIiB5PSI1OCIgd2lkdGg9Ijk2IiBoZWlnaHQ9IjM2IiByeD0iOCIgZmlsbD0iIzE3MmIyMSIgc3Ryb2tlPSIjNGM2YjU1Ii8+PHRleHQgeD0iMjUyIiB5PSI4MiIgZmlsbD0iI2RlZWVlNCIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjQwMCI+55Sf5ravPC90ZXh0PjxyZWN0IHg9IjI0IiB5PSIxMDgiIHdpZHRoPSIxMDgiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMjU0NzMzIiBzdHJva2U9IiNmM2NkNzYiLz48dGV4dCB4PSIzNiIgeT0iMTMyIiBmaWxsPSIjZmZlMmEwIiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7lh7rooYw8L3RleHQ+PHJlY3QgeD0iMTQ0IiB5PSIxMDgiIHdpZHRoPSIxMDgiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSIxNTYiIHk9IjEzMiIgZmlsbD0iI2RlZWVlNCIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjQwMCI+6IOM5YyF5pW05aSHPC90ZXh0PjxyZWN0IHg9IjI2NCIgeT0iMTA4IiB3aWR0aD0iMTA4IiBoZWlnaHQ9IjM2IiByeD0iOCIgZmlsbD0iIzE3MmIyMSIgc3Ryb2tlPSIjNGM2YjU1Ii8+PHRleHQgeD0iMjc2IiB5PSIxMzIiIGZpbGw9IiNkZWVlZTQiIGZvbnQtc2l6ZT0iMTYiIGZvbnQtd2VpZ2h0PSI0MDAiPuS7u+WKoTwvdGV4dD48cmVjdCB4PSIyNCIgeT0iMTY1IiB3aWR0aD0iMzMwIiBoZWlnaHQ9IjI0NSIgcng9IjgiIGZpbGw9IiMxMzI1MWQiIHN0cm9rZT0iIzM1NTE0MiIvPjx0ZXh0IHg9IjQwIiB5PSIxOTMiIGZpbGw9IiNjZWU5ZDUiIGZvbnQtc2l6ZT0iMTkiIGZvbnQtd2VpZ2h0PSI3MDAiPuabtOWkmjwvdGV4dD48cmVjdCB4PSI0OCIgeT0iMjI0IiB3aWR0aD0iMjgwIiBoZWlnaHQ9IjM2IiByeD0iOCIgZmlsbD0iIzI1NDczMyIgc3Ryb2tlPSIjZjNjZDc2Ii8+PHRleHQgeD0iNjAiIHk9IjI0OCIgZmlsbD0iI2ZmZTJhMCIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjQwMCI+5a2Y5qGjPC90ZXh0PjxyZWN0IHg9IjQ4IiB5PSIyODIiIHdpZHRoPSIyODAiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSI2MCIgeT0iMzA2IiBmaWxsPSIjZGVlZWU0IiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7mjqfliLblj7A8L3RleHQ+PHJlY3QgeD0iMzc2IiB5PSIxNjUiIHdpZHRoPSIzNjAiIGhlaWdodD0iMjQ1IiByeD0iOCIgZmlsbD0iIzEzMjUxZCIgc3Ryb2tlPSIjMzU1MTQyIi8+PHRleHQgeD0iMzkyIiB5PSIxOTMiIGZpbGw9IiNjZWU5ZDUiIGZvbnQtc2l6ZT0iMTkiIGZvbnQtd2VpZ2h0PSI3MDAiPua4uOaIj+WtmOahozwvdGV4dD48dGV4dCB4PSI0MDIiIHk9IjIyMiIgZmlsbD0iI2RlZWVlNCIgZm9udC1zaXplPSIyMCIgZm9udC13ZWlnaHQ9IjQwMCI+6Ieq5Yqo5L+d5a2YIMK3IOS6lOS4quW/q+eFpzwvdGV4dD48cmVjdCB4PSI0MDIiIHk9IjI2MCIgd2lkdGg9IjMwNiIgaGVpZ2h0PSIzNiIgcng9IjgiIGZpbGw9IiMyNTQ3MzMiIHN0cm9rZT0iI2YzY2Q3NiIvPjx0ZXh0IHg9IjQxNCIgeT0iMjg0IiBmaWxsPSIjZmZlMmEwIiBmb250LXNpemU9IjE2IiBmb250LXdlaWdodD0iNDAwIj7kv53lrZjlv6vnhac8L3RleHQ+PHJlY3QgeD0iNDAyIiB5PSIzMTgiIHdpZHRoPSIzMDYiIGhlaWdodD0iMzYiIHJ4PSI4IiBmaWxsPSIjMTcyYjIxIiBzdHJva2U9IiM0YzZiNTUiLz48dGV4dCB4PSI0MTQiIHk9IjM0MiIgZmlsbD0iI2RlZWVlNCIgZm9udC1zaXplPSIxNiIgZm9udC13ZWlnaHQ9IjQwMCI+5a+85Ye65a2Y5qGjPC90ZXh0Pjx0ZXh0IHg9IjQwMiIgeT0iMzg5IiBmaWxsPSIjYjVkM2JkIiBmb250LXNpemU9IjE3IiBmb250LXdlaWdodD0iNDAwIj7or7vlj5blrZjmoaPkvJrmgaLlpI3or6Xov5vluqY8L3RleHQ+PC9nPjwvc3ZnPg=="}];
    let mask=null,index=0,opener=null,nodes=null;
    const node=(tag,text)=>{const out=hkmCreateElement(tag);if(text!==undefined)out.textContent=text;return out;};
    const css='.hkm-tutorial-mask{box-sizing:border-box;position:fixed;inset:0;z-index:2147483500;display:flex;align-items:center;justify-content:center;padding:12px;background:#020806e8;font:15px/1.6 system-ui,"Microsoft YaHei",sans-serif;color:#e2f0e5}.hkm-tutorial-mask *{box-sizing:border-box;min-width:0}.hkm-tutorial-dialog{width:min(820px,100%);max-height:100%;overflow:auto;padding:20px;border:1px solid #5d8367;border-radius:14px;background:#102019;box-shadow:0 20px 90px #000a}.hkm-tutorial-head{display:flex;gap:12px;align-items:center;margin-bottom:12px}.hkm-tutorial-head h2{font-size:clamp(18px,4vw,24px);margin:0;flex:1}.hkm-tutorial-mask button{min-height:44px;border:1px solid #54735b;border-radius:8px;padding:8px 14px;background:#20392a;color:#e2f0e5;font:inherit;cursor:pointer}.hkm-tutorial-mask button:disabled{opacity:.4;cursor:default}.hkm-tutorial-mask button:focus-visible{outline:2px solid #f1d18c;outline-offset:3px}.hkm-tutorial-image{width:100%;height:auto;display:block;border-radius:10px}.hkm-tutorial-caption{margin:14px 0;font-size:16px}.hkm-tutorial-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.hkm-tutorial-count{margin-right:auto;color:#b9d2be}.hkm-tutorial-mask [hidden]{display:none!important}@media(max-width:480px){.hkm-tutorial-dialog{padding:12px}.hkm-tutorial-caption{font-size:15px}.hkm-tutorial-actions button{flex:1;padding:8px}.hkm-tutorial-count{flex-basis:100%}}';
    const close=()=>{
      if(!mask)return;
      mask.remove();mask=null;document.removeEventListener('keydown',keyboard,true);
      if(opener?.isConnected)opener.focus();nodes=null;
    };
    const show=page=>{
      index=Math.max(0,Math.min(slides.length-1,page));const slide=slides[index];
      nodes.title.textContent=slide.title;nodes.image.src=slide.image;nodes.image.alt=slide.title+'：'+slide.caption;nodes.caption.textContent=slide.caption;
      nodes.count.textContent=(index+1)+' / '+slides.length;nodes.previous.disabled=index===0;nodes.next.disabled=index===slides.length-1;
    };
    const keyboard=event=>{
      if(!mask)return;
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return;}
      if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();show(index+(event.key==='ArrowLeft'?-1:1));return;}
      if(event.key==='Tab'){
        const buttons=[...mask.querySelectorAll('button')].filter(button=>!button.disabled),first=buttons[0],last=buttons.at(-1);
        if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    const open=()=>{
      if(mask){nodes.close.focus();return true;}
      opener=document.activeElement;mask=node('div');mask.className='hkm-tutorial-mask';
      const style=node('style',css),panel=node('section');panel.className='hkm-tutorial-dialog';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','hkm-tutorial-title');
      const header=node('header'),title=node('h2'),quit=node('button','结束教学');header.className='hkm-tutorial-head';title.id='hkm-tutorial-title';quit.type='button';quit.addEventListener('click',close);header.append(title,quit);
      const image=node('img'),caption=node('p'),actions=node('div'),count=node('span'),previous=node('button','上一张'),next=node('button','下一张');
      image.className='hkm-tutorial-image';image.width=760;image.height=440;caption.className='hkm-tutorial-caption';caption.setAttribute('aria-live','polite');actions.className='hkm-tutorial-actions';count.className='hkm-tutorial-count';
      for(const button of [previous,next])button.type='button';
      previous.addEventListener('click',()=>show(index-1));next.addEventListener('click',()=>show(index+1));
      actions.append(count,previous,next);panel.append(header,image,caption,actions);mask.append(style,panel);hkmPortal.append(mask);
      if(typeof hudVisibleBand==='function'){const band=hudVisibleBand();mask.style.top=Math.round(band.top)+'px';mask.style.height=Math.round(band.height)+'px';mask.style.bottom='auto';}
      nodes={title,image,caption,count,previous,next,close:quit};show(0);document.addEventListener('keydown',keyboard,true);quit.focus();return true;
    };
    return {open,close,get opened(){return !!mask;},images:slides};
  })();

  disposers.push(HkmTutorial.close);
  const hkmHelp=hkmButton('？',()=>HkmTutorial.open());hkmHelp.title='新手教学';hkmHelp.setAttribute('aria-label','新手教学');
  const hkmHeadActions=make('div','hkm-page-actions'),hkmTools=make('div','hkm-page-tools');hkmTools.hidden=true;
  const hkmBack=hkmButton('返回行动',()=>hkmSwitch('inside','action'));
  const hkmMore=hkmButton('更多',()=>{hkmTools.hidden=!hkmTools.hidden;hkmMore.setAttribute('aria-expanded',String(!hkmTools.hidden));});hkmMore.setAttribute('aria-expanded','false');hkmMore.setAttribute('aria-controls','hkm-page-tools');hkmTools.id='hkm-page-tools';
  hkmTools.append(saveButton,consoleButton,debugButton);hkmHeadActions.append(hkmBack,hkmHelp,hkmMore,hkmTools);head.append(hkmHeadActions);
  taskPanel.box.querySelector('.hkm-reset-section-title')?.remove();
  statsPanel.box.querySelector('.hkm-reset-section-title span').textContent='历史统计';
  liveStatus.setAttribute('role','status');liveStatus.setAttribute('aria-live','polite');
  const hkmPrepare=make('div','hkm-prepare'),hkmPrepareLeft=make('div','hkm-page-stack'),hkmPrepareRight=make('div','hkm-page-stack');hkmPrepare.append(hkmPrepareLeft,hkmPrepareRight);
  const hkmAction=make('div','hkm-action'),hkmActionLeft=make('div','hkm-page-stack'),hkmActionRight=make('div','hkm-page-stack');hkmAction.append(hkmActionLeft,hkmActionRight);
  const hkmProfile=section('人物档案'),hkmWorkspace=section('工作区'),hkmStorage=make('div','hkm-storage'),hkmEmpty=make('div','hkm-page-empty');
  const hkmTaskHeading=make('div','hkm-page-heading'),hkmTaskOpen=hkmButton('悬浮窗',()=>{hkmPage.float=true;hkmFloat.hidden=false;hkmPagedTasks(currentStatSnapshot,true);hkmFloatClose.focus();});hkmTaskHeading.append(make('h2','','任务'),hkmTaskOpen);
  const hkmPrepareHeading=make('div','hkm-page-heading'),hkmPrepareActions=make('div','hkm-page-actions');
  const hkmHiddenButton=hkmButton('藏匿物',()=>{hkmPage.hiddenOpen=!hkmPage.hiddenOpen;hkmPagedHidden(currentStatSnapshot);});
  const hkmOddityWindow=make('section','hkm-reset-boxwin');hkmOddityWindow.hidden=true;
  hkmOddityWindow.setAttribute('role','dialog');hkmOddityWindow.setAttribute('aria-label','奇物');hkmOddityWindow.setAttribute('aria-modal','false');
  const hkmOddityHead=make('header','hkm-reset-boxwin-head'),hkmOddityBody=make('div'),hkmOddityClose=hkmButton('关闭',()=>{hkmPage.oddityOpen=false;hkmOddityWindow.hidden=true;hkmOddityButton.focus();});
  hkmOddityHead.append(make('h3','','奇物'),hkmOddityClose);hkmOddityWindow.append(hkmOddityHead,hkmOddityBody);hkmPortal.append(hkmOddityWindow);hkmOwnNodes(hkmOddityWindow);
  const hkmOddityButton=hkmButton('奇物',()=>{hkmPage.oddityOpen=!hkmPage.oddityOpen;hkmPagedOddity(currentStatSnapshot);if(hkmPage.oddityOpen)hkmOddityClose.focus();});
  const hkmPagedOddity=stat=>{
    hkmOddityButton.disabled=hudReadOnly;hkmOddityButton.setAttribute('aria-expanded',String(!!hkmPage.oddityOpen&&!hudReadOnly));
    hkmOddityWindow.hidden=!hkmPage.oddityOpen || hudReadOnly;if(hkmOddityWindow.hidden)return;
    clear(hkmOddityBody);
    const name=stat?.装备?.特殊工具,item=itemByName(name),locked=hkm098Locked() || Boolean(state.fishing?.cast?.active);
    if(item){
      const tile=make('article','hkm-fishing-part'),picture=GAME_DATA.itemPictures[item.id];
      if(picture){const image=hkmCreateElement('img');image.src=picture;image.alt=item.name;tile.append(image);}
      tile.append(make('strong','',item.name),make('span','',item.rarity));
      const actions=make('div','hkm-page-actions');
      const off=hkmButton('卸下',hudAction(async()=>{hkm098RequireAlive();await hudUnequipItem('特殊工具',await currentStat());}));off.disabled=locked;actions.append(off);
      if(item.fishingGear?.type==='rod'){const mod=hkmButton('装配',hudAction(()=>hkmFishingOpenMods(item.name,'装备')));mod.disabled=locked;actions.append(mod);}
      tile.append(actions);hudAttachItemPanel(tile,item.name,'装备',{where:'装备',slot:'特殊工具'},{hover:true});hkmOddityBody.append(tile);
    }else hkmOddityBody.append(make('p','','未装备奇物。'));
    if(itemByName(stat?.装备?.特殊工具)?.id==='COL-0245')hkmOddityBody.append(hkm138Button());
    if(aiNum(hudBucketOf(stat,'背包')['融合升华仪']?.数量,0)>0){const equip=hkmButton('装备融合升华仪',hudAction(async()=>{hkm098RequireAlive();await hudEquipItem('融合升华仪',await currentStat());}));equip.disabled=locked;hkmOddityBody.append(equip);}
    const rods=hkmFishingInstances(stat).filter(row=>row.where==='背包' && GAME_DATA.fishing.allowedRodIds.includes(row.itemId));
    if(rods.length){
      const select=hkmCreateElement('select');select.setAttribute('aria-label','选择鱼竿');
      for(const row of rods){const option=hkmCreateElement('option');option.value=row.uid;option.textContent=itemById(row.itemId).name;select.append(option);}
      const equip=hkmButton('装备',hudAction(async()=>{hkm098RequireAlive();const row=rods.find(row=>row.uid===select.value);if(row)await hkmFishingEquip(itemById(row.itemId).name,await currentStat(),row.uid);}));equip.disabled=locked;hkmOddityBody.append(select,equip);
    }
    hudMakeDraggable(hkmOddityWindow,'oddity');
  };

  hkmPrepareHeading.append(make('h2','','背包整备'),hkmPrepareActions);hkmPrepareActions.append(keychainButton,hkmHiddenButton,hkmOddityButton);
  statePanel.box.classList.add('hkm-action-summary');
  statePanel.box.querySelector('.hkm-reset-section-title')?.remove();
  mapPanel.box.classList.add('hkm-action-map');mapPanel.body.id='hkm-action-map';
  const hkmMapToggle=hkmButton('',()=>{mapPanel.body.hidden=!mapPanel.body.hidden;hkmMapToggle.setAttribute('aria-expanded',String(!mapPanel.body.hidden));hkmMapToggle.querySelector('.hkm-reset-kv-value').textContent=mapPanel.body.hidden?'展开':'收起';});
  hkmMapToggle.className='hkm-reset-kv hkm-action-map-toggle';hkmMapToggle.setAttribute('aria-controls','hkm-action-map');hkmMapToggle.setAttribute('aria-expanded','true');
  hkmMapToggle.append(make('span','hkm-reset-kv-label','地图导航'),make('span','hkm-reset-kv-value','收起'));
  searchButton.textContent='搜寻';
  for(const panel of [characterPanel,equipmentPanel,bagPanel,stashPanel,statsPanel]){panel.body.hidden=false;panel.box.querySelector('.hkm-reset-section-toggle')?.remove();}
  for(const panel of [characterPanel,equipmentPanel,bagPanel,stashPanel,shopPanel,cartPanel])panel.box.querySelector('.hkm-reset-section-note')?.remove();
  const hkmFloat=make('aside','hkm-task-float hkm-reset-hud');hkmFloat.hidden=true;hkmFloat.setAttribute('role','dialog');hkmFloat.setAttribute('aria-modal','false');hkmFloat.setAttribute('aria-label','任务悬浮窗');
  const hkmFloatHead=make('header','hkm-task-float-head'),hkmDrag=make('span','hkm-task-drag','任务');hkmDrag.tabIndex=0;hkmDrag.setAttribute('role','button');hkmDrag.setAttribute('aria-label','移动任务窗口');
  const hkmFloatCollapse=hkmButton('收起',()=>{hkmPage.collapsed=!hkmPage.collapsed;hkmFloatBody.hidden=hkmPage.collapsed;hkmFloatCollapse.textContent=hkmPage.collapsed?'展开':'收起';hkmFloatCollapse.setAttribute('aria-expanded',String(!hkmPage.collapsed));});hkmFloatCollapse.setAttribute('aria-expanded','true');
  const hkmFloatClose=hkmButton('关闭',()=>{hkmPage.float=false;hkmFloat.hidden=true;if(hkmTaskOpen.isConnected&&hkmTaskOpen.getClientRects().length)hkmTaskOpen.focus();else hkmMain.querySelector('[aria-selected="true"]')?.focus();});
  const hkmFloatBody=make('div','hkm-task-float-body');hkmFloatHead.append(hkmDrag,hkmFloatCollapse,hkmFloatClose);hkmFloat.append(hkmFloatHead,hkmFloatBody);hkmPortal.append(hkmFloat);disposers.push(()=>hkmFloat.remove());
  let hkmDragStart=null;
  const hkmClampFloat=()=>{if(!hkmFloat.style.left)return;const r=hkmFloat.getBoundingClientRect();hkmFloat.style.left=Math.max(8,Math.min(parseFloat(hkmFloat.style.left),window.innerWidth-r.width-8))+'px';hkmFloat.style.top=Math.max(8,Math.min(parseFloat(hkmFloat.style.top),window.innerHeight-Math.min(r.height,window.innerHeight-16)-8))+'px';};
  hkmDrag.addEventListener('pointerdown',e=>{const r=hkmFloat.getBoundingClientRect();hkmDragStart={x:e.clientX,y:e.clientY,left:r.left,top:r.top};hkmDrag.setPointerCapture(e.pointerId);});
  hkmDrag.addEventListener('pointermove',e=>{if(!hkmDragStart)return;hkmFloat.style.right='auto';hkmFloat.style.left=hkmDragStart.left+e.clientX-hkmDragStart.x+'px';hkmFloat.style.top=hkmDragStart.top+e.clientY-hkmDragStart.y+'px';hkmClampFloat();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])hkmDrag.addEventListener(event,()=>hkmDragStart=null);
  hkmDrag.addEventListener('keydown',e=>{const d={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]}[e.key];if(!d)return;e.preventDefault();const r=hkmFloat.getBoundingClientRect();hkmFloat.style.right='auto';hkmFloat.style.left=r.left+d[0]+'px';hkmFloat.style.top=r.top+d[1]+'px';hkmClampFloat();});
  window.addEventListener('resize',hkmClampFloat);disposers.push(()=>window.removeEventListener('resize',hkmClampFloat));
  const hkmPageKeys=e=>{if(e.key==='Escape'){if(!hkmTools.hidden){hkmTools.hidden=true;hkmMore.setAttribute('aria-expanded','false');hkmMore.focus();}else if(hkmFloat.contains(e.target))hkmFloatClose.click();}const nav=e.target.closest('.hkm-main-tabs,.hkm-sub-tabs,.hkm-task-categories');if(!nav||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const tabs=[...nav.querySelectorAll('[role="tab"]')],i=tabs.indexOf(e.target);if(i<0)return;e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length,id=tabs[n].id;tabs[n].click();document.getElementById(id)?.focus();};
  document.addEventListener('keydown',hkmPageKeys);disposers.push(()=>document.removeEventListener('keydown',hkmPageKeys));
  let hkmTutorialChecking=false;
  const hkmMaybeTutorial=async()=>{
    if(hudReadOnly || hkmTutorialChecking || HkmSave.pending() || !isLatestHudLayer() || !currentStatSnapshot?.主角)return;
    const vars=HkmSave.variables(),pending=vars.hkm_tutorial_pending;
    if(!pending || pending.saveId!==vars.hkm_save_profile?.id)return;
    hkmTutorialChecking=true;
    try{
      hkm098AssertOwner();
      if(!HkmTutorial.open())return;
      const latest=HkmSave.variables();
      if(latest.hkm_tutorial_pending?.saveId===pending.saveId){delete latest.hkm_tutorial_pending;replaceVariables(latest,{type:'chat'});await hkm095Flush();}
    }finally{hkmTutorialChecking=false;}
  };
  const hkmMission=()=>GAME_DATA.maps[currentContext.mapName]?.kind==='mission';
  let hkm138Busy=false;
  const hkm138ItemId='COL-0245';
  const hkm138ActiveRun=stat=>state.run && GAME_DATA.maps[state.run.map]?.kind==='mission' && state.run.map===stat.场景?.地图 ? state.run:null;
  const hkm138Proof=(row,count)=>({...HkmUpgrade.proof(row,count,state.run),...(hkmIsKeyItem(itemByName(row?.名称 || row?.name)) ? {钥匙耐久:hkmKeyDurs(row).slice(0,count)}:{})});
  const hkm138Mark=(patch,results,stat=currentStatSnapshot)=>{
    const run=hkm138ActiveRun(stat || {}),bag=patch.背包?.携带收藏品;
    if(!run || !bag)return patch;
    for(const result of results){const row=bag[result.item?.name];if(!row || result.item?.acquisition?.starlightShopOnly)continue;const count=HkmUpgrade.eligible(row,run)+Math.max(1,Number(result.quantity)||1);row.摸出对局=HkmUpgrade.runId(run);row.摸出数量=Math.min(HkmUpgrade.quantity(row),count);}
    return patch;
  };
  const hkm138Require=stat=>{
    hkm098RequireAlive();
    if(itemByName(stat.装备?.特殊工具)?.id!==hkm138ItemId)throw Error('请先把融合升华仪装备到奇物栏。');
    if(!hkm138ActiveRun(stat))throw Error('只能在当前对局中使用本局摸出的收藏品。');
    if(aiNum(state.run.upgradeUses,0)>=3)throw Error('本局已完成三次升星，无法继续使用。');
    if(state.fishing?.cast?.active)throw Error('请先收杆，再使用融合升华仪。');
  };
  const hkm138Shop=make('section','hkm-star-shop');
  const hkm138ShopRender=stat=>{
    clear(hkm138Shop);
    const item=itemById(hkm138ItemId),heading=make('div','hkm-page-heading');
    heading.append(make('h2','','星光商店'),make('span','',aiNum(stat?.统计信息?.星光,0)+' 星光'));
    const card=make('article','hkm-reset-card hkm-reset-rarity-legendary');card.dataset.itemId=item.id;
    card.append(make('h3','',item.name),make('p','','至宝 · 奇物'),make('p','',item.description),make('p','','50 星光'));
    const buy=hkmButton('购买 · 50 星光',hudAction(hkm138Buy));buy.disabled=hudReadOnly || hkm098Locked() || hkm138Busy || aiNum(stat?.统计信息?.星光,0)<50;
    card.append(buy);hudAttachItemPanel(card,item.name,'商店',{allowed:true},{hover:true});hkm138Shop.append(heading,card);
  };
  const hkm138Buy=async()=>{
    if(hkm138Busy)return false;hkm138Busy=true;
    try{
      const stat=await currentStat();hkm098RequireAlive();const stars=Number(stat.统计信息?.星光);
      if(!Number.isSafeInteger(stars) || stars<50)throw Error('星光不足，需要 50 星光。');
      const item=itemById(hkm138ItemId),patch=hudExchangePatch(stat,[],[{item,quantity:1}]);
      patch.统计信息={...asObject(stat.统计信息),星光:stars-50};
      await hkm098Transact('star-purchase:'+Date.now()+':'+(++hkm095QueueSerial),patch,{},'在星光商店花费50星光购买融合升华仪×1。','',1,stat);
      await refresh();setStatus('已购买融合升华仪，花费 50 星光。');return true;
    }finally{hkm138Busy=false;if(currentStatSnapshot)hkm138ShopRender(currentStatSnapshot);}
  };
  const hkm138Dialog=make('section','hkm-upgrade-dialog');hkm138Dialog.hidden=true;hkm138Dialog.setAttribute('role','dialog');hkm138Dialog.setAttribute('aria-modal','true');hkm138Dialog.setAttribute('aria-label','升星');
  const hkm138Head=make('div','hkm-page-heading'),hkm138Close=hkmButton('关闭',()=>{hkm138Dialog.hidden=true;hkm138Opener?.focus();});
  hkm138Head.append(make('h2','','融合升华'),hkm138Close);
  const hkm138List=hkmCreateElement('select');hkm138List.setAttribute('aria-label','选择升星材料');
  const hkm138Preview=make('p',''),hkm138Result=make('p','hkm-upgrade-result');hkm138Result.setAttribute('role','status');
  const hkm138Confirm=hkmButton('确认升星 · 消耗3件',hudAction(()=>hkm138Fuse(hkm138List.value)));
  const hkm138Uses=make('p','');
  hkm138Dialog.append(hkm138Head,make('p','','三个相同的本局摸出收藏品，融合为一件高一阶的收藏品。最高可使用奇异材料，一份精液不能作为材料。'),hkm138Uses,hkm138List,hkm138Preview,hkm138Confirm,hkm138Result);
  hkmPortal.append(hkm138Dialog);hkmOwnNodes(hkm138Dialog);let hkm138Opener=null;
  const hkm138PreviewUpdate=()=>{
    const item=itemById(hkm138List.value),pool=HkmUpgrade.candidates(GAME_DATA,item);
    hkm138Preview.textContent=item ? '消耗 '+item.name+' ×3 → '+pool.rarity+' ×1。'+(pool.fallback?'该阶没有价值达到三倍的收藏品，将从价值最高者中抽取。':'从价值至少 '+(Number(item.value)*3)+' 哈基币的候选中抽取。'):'';
    hkm138Confirm.disabled=hkm138Busy || !item || hudReadOnly || hkm098Locked();
  };
  hkm138List.addEventListener('change',hkm138PreviewUpdate);
  hkm138Dialog.addEventListener('keydown',event=>{if(event.key==='Escape'&&!hkm138Busy){event.stopPropagation();hkm138Close.click();}if(event.key==='Tab'){const nodes=[...hkm138Dialog.querySelectorAll('button,select')].filter(node=>!node.disabled);const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
  const hkm138Fill=stat=>{
    hkm138Uses.textContent='本局剩余 '+Math.max(0,3-aiNum(state.run?.upgradeUses,0))+' / 3 次';
    const chosen=hkm138List.value;hkm138List.replaceChildren();
    for(const candidate of HkmUpgrade.rows(stat,hkm138ActiveRun(stat),GAME_DATA)){const option=hkmCreateElement('option');option.value=candidate.item.id;option.textContent=candidate.item.name+' · '+candidate.item.rarity+' · 本局摸出 '+candidate.count+' 件';hkm138List.append(option);}
    if([...hkm138List.options].some(option=>option.value===chosen))hkm138List.value=chosen;
    hkm138List.disabled=hkm138Busy || !hkm138List.options.length;hkm138PreviewUpdate();
    if(aiNum(state.run?.upgradeUses,0)>=3){hkm138Confirm.disabled=true;hkm138List.disabled=true;hkm138Preview.textContent='本局三次升星已用完。';}
    else if(!hkm138List.options.length)hkm138Preview.textContent='没有可升星的材料：需要三个相同、本局摸出且仍在背包中的寻常至奇异收藏品。';
  };
  const hkm138Open=async()=>{
    const stat=await currentStat();hkm138Require(stat);hkm138Opener=document.activeElement;hudCloseItemPanel();hkm138Result.textContent='';hkm138Fill(stat);hkm138Dialog.hidden=false;hkm138List.focus();
  };
  const hkm138Fuse=async id=>{
    if(hkm138Busy)return false;hkm138Busy=true;hkm138Confirm.disabled=true;hkm138Close.disabled=true;
    try{
      const stat=await currentStat();hkm138Require(stat);
      const run=hkm138ActiveRun(stat),candidate=HkmUpgrade.rows(stat,run,GAME_DATA).find(row=>row.item.id===id);
      if(!candidate)throw Error('材料已变化，或本局摸出的数量不足三件。');
      const selected=HkmUpgrade.choose(GAME_DATA,candidate.item),patch=hudExchangePatch(stat,[{name:candidate.row.名称,quantity:3}],[{item:selected.item,quantity:1}]);
      const text=candidate.item.name+' ×3 → '+selected.item.name+' ×1（'+selected.item.rarity+'，价值 '+selected.item.value+' 哈基币）。';
      await hkm098Transact('upgrade:'+HkmUpgrade.runId(run)+':'+Date.now()+':'+(++hkm095QueueSerial),patch,{run:{...HkmLifecycle.copy(run),upgradeUses:aiNum(run.upgradeUses,0)+1}},'融合升华仪升星：'+text,'use',1,stat);
      await refresh();hkm138Result.textContent=text;setStatus('升星完成：'+text);return selected.item.id;
    }catch(error){hkm138Result.textContent=error.message;throw error;}
    finally{hkm138Busy=false;hkm138Close.disabled=false;if(currentStatSnapshot)hkm138Fill(currentStatSnapshot);}
  };
  const hkm138Button=()=>{const button=hkmButton('升星',hudAction(hkm138Open),'hkm-reset-mini');button.disabled=hudReadOnly || hkm098Locked() || hkm138Busy;return button;};

  const hkmTabs=main=>main==='inside'?[['action','行动'],['prepare','背包整备'],['tasks','任务']]:main==='career'?[['records','历史统计'],['codex','图鉴'],['achievements','成就'],['starshop','星光商店'],['profile','人物档案']]:[...(!hkmMission()?[['travel','出行']]:[]),['prepare','背包整备'],...(currentContext.mapName==='哈基米空间'?[['storage','安全屋'],['home','工作区']]:[]),...(currentContext.mapName==='哈基米空间' && currentContext.area==='特勤处'?[['facilities','特勤处']]:[]),...(['哈基米军需店','玩家自由贸易区'].includes(currentContext.area)?[['trade','交易']]:[]),['tasks','任务']];
  const hkmSwitch=(main,sub)=>{hkmPage.scroll.set(hkmPage.main+':'+hkmPage.sub[hkmPage.main],hkmContent.scrollTop);hkmPage.main=main;if(sub)hkmPage.sub[main]=sub;hudCloseItemPanel();hkmPagedLayout(true);};
  const hkmPagedHidden=stat=>{const owner=hudStashOwner(stat||{});hkmHiddenButton.disabled=!owner||hudReadOnly;hkmHiddenButton.title=owner?'查看藏匿物':'当前装备没有藏匿空间';hkmHiddenButton.setAttribute('aria-expanded',String(hkmPage.hiddenOpen&&!!owner));stashWindow.hidden=!hkmPage.hiddenOpen||!owner||hudReadOnly;};
  const hkmPagedLayout=(force=false)=>{
    const mission=hkmMission();if(!hkmPage.main)hkmPage.main=mission?'inside':'outside';
    const tabs=hkmTabs(hkmPage.main);if(!tabs.some(([key])=>key===hkmPage.sub[hkmPage.main]))hkmPage.sub[hkmPage.main]=tabs[0][0];
    const sub=hkmPage.sub[hkmPage.main],key=hkmPage.main+':'+sub,signature=key+':'+JSON.stringify(tabs)+':'+mission;
    hkmBack.hidden=!(mission&&key!=='inside:action');
    if(!force&&signature===hkmPage.route)return;hkmPage.route=signature;
    const oldFocus=document.activeElement?.id;
    hkmMain.replaceChildren();hkmSub.replaceChildren();
    for(const [id,label] of [['inside','局内'],['outside','局外'],['career','生涯']]){const b=hkmButton(label,()=>hkmSwitch(id));b.id='hkm-main-'+id;b.dataset.main=id;b.setAttribute('role','tab');b.setAttribute('aria-controls','hkm-page-content');b.setAttribute('aria-selected',String(id===hkmPage.main));b.tabIndex=id===hkmPage.main?0:-1;hkmMain.append(b);}
    for(const [id,label]of tabs){const b=hkmButton(label,()=>hkmSwitch(hkmPage.main,id));b.id='hkm-sub-'+id;b.dataset.sub=id;b.setAttribute('role','tab');b.setAttribute('aria-controls','hkm-page-content');b.setAttribute('aria-selected',String(id===sub));b.tabIndex=id===sub?0:-1;hkmSub.append(b);}
    hkmContent.setAttribute('aria-labelledby','hkm-sub-'+sub);hkmContent.dataset.page=key;
    hkmParking.append(mapPanel.box,statePanel.box,characterPanel.box,equipmentPanel.box,bagPanel.box,enemyPanel.box,specialPanel.box,taskPanel.box,statsPanel.box,stashPanel.box,shopPanel.box,cartPanel.box,hkmHomePanel.box,hkmFacilitiesPanel.box,scatterBox,bagStatusBox,usedPanel);
    hkmContent.replaceChildren();
    if(hkmPage.main==='inside'&&!mission){hkmEmpty.replaceChildren(make('p','','当前没有进行中的对局'),hkmButton('前往出行',()=>hkmSwitch('outside','travel')));hkmContent.append(hkmEmpty);}
    else if(sub==='action'){
      hkmActionLeft.replaceChildren(statePanel.box,mapPanel.box);hkmActionRight.replaceChildren(specialPanel.box,enemyPanel.box);hkmContent.append(hkmAction,scatterBox);
    }else if(sub==='travel'){hkmContent.append(make('h2','','出行'),mapPanel.box,specialPanel.box);}
    else if(sub==='prepare'){hkmPrepareLeft.replaceChildren(characterPanel.box,equipmentPanel.box);hkmPrepareRight.replaceChildren(bagPanel.box,bagStatusBox,usedPanel);hkmContent.append(hkmPrepareHeading,hkmPrepare,scatterBox);}
    else if(sub==='tasks'){hkmContent.append(hkmTaskHeading,taskPanel.box);}
    else if(sub==='storage'){hkmStorage.replaceChildren(bagPanel.box,stashPanel.box);hkmContent.append(make('h2','','安全屋'),hkmStorage);}
    else if(sub==='home'){hkmContent.append(hkmHomePanel.box,hkmWorkspace.box);}
    else if(sub==='facilities'){hkmContent.append(hkmFacilitiesPanel.box);}
    else if(sub==='trade'){hkmContent.append(make('h2','','交易'),shopPanel.box,cartPanel.box);}
    else if(sub==='records')hkmContent.append(statsPanel.box);
    else if(sub==='codex'){hkmContent.append(hkmCodexBox);hkmCodexRender(currentStatSnapshot);}
    else if(sub==='achievements'){hkmContent.append(hkmAchievementsBox);hkmAchievementsRender(currentStatSnapshot);}
    else if(sub==='starshop'){hkm138ShopRender(currentStatSnapshot);hkmContent.append(hkm138Shop);}
    else if(sub==='profile')hkmContent.append(hkmProfile.box);
    hkmCodexDot();
    hkmAchievementDot();
    hkmContent.scrollTop=hkmPage.scroll.get(key)||0;
    if(oldFocus)document.getElementById(oldFocus)?.focus({preventScroll:true});
  };
  const hkmTaskMatches=type=>hkmPage.category==='system'?['main','daily'].includes(type):hkmPage.category==='battle'?type==='battle':!['main','daily','battle'].includes(type);
  const hkmTaskSurface=(stat,prefix)=>{
    const surface=make('div','hkm-task-surface'),nav=make('nav','hkm-task-categories');nav.setAttribute('role','tablist');nav.setAttribute('aria-label','任务分类');
    for(const [key,label]of [['system','哈基米系统任务'],['battle','战局任务'],['contract','特殊契约']]){const b=hkmButton(label,()=>{hkmPage.category=key;hkmPagedTasks(currentStatSnapshot,true);});b.id=prefix+'-category-'+key;b.dataset.taskCategory=key;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(hkmPage.category===key));b.tabIndex=hkmPage.category===key?0:-1;nav.append(b);}
    const filter=make('div','hkm-task-filter');for(const [key,label]of [['active','已接取'],['available','可接取']]){const b=hkmButton(label,()=>{hkmPage.filter=key;hkmPagedTasks(currentStatSnapshot,true);});b.id=prefix+'-filter-'+key;b.dataset.taskFilter=key;b.setAttribute('aria-pressed',String(hkmPage.filter===key));filter.append(b);}surface.append(nav,filter);
    const pending=pendingQuestIds().map(id=>questById.get(id)).filter(Boolean).map(task=>({...task,pending:true}));
    const active=displayTaskRows(stat).map(row=>({id:row.id,type:row.type,name:row.item.任务名称,description:row.item.描述,reward:row.item.报酬,item:row.item}));
    const rows=(hkmPage.filter==='active'?[...pending,...active]:availableQuestRows(stat)).filter(row=>hkmTaskMatches(row.type));
    for(const [index,row]of rows.entries()){
      const entry=make('article','hkm-task-entry'),key=hkmPage.filter+':'+row.id,expanded=hkmPage.expanded.has(key),detail=make('div','hkm-task-detail');entry.dataset.taskId=row.id;detail.id=prefix+'-detail-'+index;detail.hidden=!expanded;
      const toggle=hkmButton('',()=>{expanded?hkmPage.expanded.delete(key):hkmPage.expanded.add(key);hkmPagedTasks(currentStatSnapshot,true);},'hkm-task-toggle');toggle.id=prefix+'-task-'+index;toggle.setAttribute('aria-expanded',String(expanded));toggle.setAttribute('aria-controls',detail.id);
      const title=make('span','hkm-task-title');title.append(make('span','hkm-task-type',({main:'主线',daily:'日常',battle:'战局',commission:'契约'})[row.type]||'契约'),make('span','',String(row.name||'未命名任务').replace(/^\([^)]*\)/,'')));toggle.append(title);if(row.pending)toggle.append(make('span','hkm-task-pending','待接取'));toggle.append(make('span','hkm-task-chevron',expanded?'−':'+'));
      detail.append(make('p','',textOf(row.description,'无')),make('p','','报酬：'+textOf(row.reward,'无')));
      if(row.item)appendProgress(detail,row.item);
      const trade = asObject(state.tradeContracts)[row.id];
      if (trade && row.item && !hudReadOnly) {
        const pay = hkmButton('缴纳 ' + trade.price + ' 哈基币', hudAction(() => hkm130PayTradeContract(row.id)));
        pay.disabled = aiNum(row.item.当前进度,0) < trade.target - 1 || aiMoney(stat) < trade.price || stat.场景?.地图 !== '哈基米空间';
        detail.append(pay);
      }
      if(hkmPage.filter==='available'&&row.unlockText)detail.append(make('p','','条件：'+row.unlockText));
      if(row.pending)detail.append(make('p','hkm-task-pending','等待下一次行动接取。'));
      if(row.pending||hkmPage.filter==='available'){const action=hkmButton(row.pending?'撤销暂存':'接取任务',hudAction(()=>row.pending?cancelPendingQuest(row.id,currentStatSnapshot):queueQuest(row,currentStatSnapshot)));action.disabled=hudReadOnly;detail.append(action);}
      entry.append(toggle,detail);surface.append(entry);
    }
    if(!rows.length)surface.append(make('p','hkm-task-empty',hkmPage.category==='contract'?'暂无特殊契约。':'暂无任务。'));
    return surface;
  };
  let hkmTaskSignature='';
  const hkmPagedTasks=(stat,force=false)=>{
    const sig=JSON.stringify([stat,state.tasks,currentContext,hudReadOnly,hkmPage.category,hkmPage.filter,[...hkmPage.expanded],hkmPage.float]);if(!force&&sig===hkmTaskSignature)return;hkmTaskSignature=sig;
    const focus=document.activeElement?.id,scroll=hkmContent.scrollTop,floatScroll=hkmFloatBody.scrollTop;
    taskPanel.body.replaceChildren(hkmTaskSurface(stat,'hkm-task-page'));if(hkmPage.float)hkmFloatBody.replaceChildren(hkmTaskSurface(stat,'hkm-task-float'));
    hkmContent.scrollTop=scroll;hkmFloatBody.scrollTop=floatScroll;if(focus)document.getElementById(focus)?.focus({preventScroll:true});
  };
  const hkmPagedStats=stat=>{
    if(!hudRenderChanged(statsPanel.body,stat.统计信息))return;clear(statsPanel.body);const data=asObject(stat.统计信息),used=new Set(),metrics=make('div','hkm-career-metrics');
    for(const [label,key]of [['对局','历史对局总数'],['成功撤离','历史成功撤离总数'],['成功率',null],['玩家击杀','历史击杀玩家总数'],['带出价值','历史带出总价值'],['总资产','总资产'],['风评','风评'],['名望','名望']]){if(key)used.add(key);const n=make('div','hkm-metric');n.append(make('small','',label),make('b','',key?textOf(data[key],'0'):(aiNum(data.历史对局总数,0)>0?(aiNum(data.历史成功撤离总数,0)/data.历史对局总数*100).toFixed(1)+'%':'—')));metrics.append(n);}statsPanel.body.append(metrics);
    const records=make('div','hkm-record-details');for(const [title,prefix,suffix]of [['收藏品带出','历史带出','收藏品总数'],['钓鱼记录','钓到','鱼总数']]){const block=make('section','hkm-rarity-record'),dl=make('dl','hkm-rarity-stats');block.append(make('h3','',title));for(const [i,label]of ['奇异','至宝','神秘'].entries()){const key=prefix+label+suffix;used.add(key);const cell=make('div','hkm-rarity-stat');cell.dataset.rarity=String(i);cell.append(make('dt','',label),make('dd','',textOf(data[key],'0')));dl.append(cell);}block.append(dl);records.append(block);}statsPanel.body.append(records);
    const rest=make('div','hkm-reset-grid');for(const [key,value]of Object.entries(data))if(!used.has(key))rest.append(field(key,value));if(rest.childElementCount)statsPanel.body.append(rest);
  };
  let hkmWorkspaceSignature='',hkmProfileSignature='';
  const hkmPagedRefresh=stat=>{
    const scene=currentContext.mapName+(currentContext.area==='特勤处'?':facilities':'');if(hkmPage.scene!==scene){hkmPage.scene=scene;hkmPage.main=hkmMission()?'inside':'outside';hkmPage.sub[hkmPage.main]=hkmMission()?'action':currentContext.area==='特勤处'?'facilities':'travel';}
    const actor=asObject(stat.主角),money=asObject(stat.统计信息);hkmVitals.replaceChildren(...['血量 '+textOf(actor.当前血量,'—')+' / '+textOf(actor.血量上限,'—'),'负重 '+textOf(actor.当前负重,'—')+' / '+textOf(actor.负重上限,'—'),...(hkmMission()?['剩余 '+textOf(stat.场景?.剩余交互轮数,'—')+' 轮']:[]),...(currentContext.mapName==='魔鬼海'?['水下 '+textOf(stat.场景?.剩余水下行动值,'—')+' / '+HkmSea.cap(stat)]:[]),textOf(money.哈基币,'0')+' 哈基币',textOf(money.星光,'0')+' 星光'].map(t=>make('span','',t)));
    let opening={};try{opening=asObject(getVariables({type:'chat'}).hkm_opening_profile?.protagonist);}catch(_){}
    const profileSignature=JSON.stringify([actor,opening]);if(profileSignature!==hkmProfileSignature){hkmProfileSignature=profileSignature;clear(hkmProfile.body);const layout=make('div','hkm-profile-layout');for(const [title,rows]of [['身份资料',[['姓名',actor.姓名],['性别',actor.性别],['处女状态',actor.处女状态],['外貌',actor.外貌||opening.appearance],['身材',actor.身材||opening.figure],['性格',actor.性格||opening.personality]]],['基础能力',Object.entries(asObject(actor.基础属性)).filter(([key])=>key!=='已校准')]]){const block=make('section'),dl=make('dl');block.append(make('h3','',title));for(const [key,value]of rows)dl.append(make('dt','',key),make('dd','',textOf(value,'暂无资料')));block.append(dl);layout.append(block);}hkmProfile.body.append(layout);}
    const sig=JSON.stringify([currentContext,stat.安全屋,stat.背包,state.home,hkmHomeBusy,hudReadOnly]);if(sig!==hkmWorkspaceSignature){hkmWorkspaceSignature=sig;clear(hkmWorkspace.body);if(HkmHome.inSafe(stat)&&!hudReadOnly&&!HkmLifecycle.dead(stat)){hkmHomeFurnitureContent(hkmWorkspace.body,stat,HkmHome.normalize(state.home));const inventory=section('库存家居');for(const where of ['安全屋','背包']){const rows=asObject(where==='安全屋'?stat.安全屋?.收藏品:stat.背包?.携带收藏品);for(const [name,value]of Object.entries(rows)){const item=itemByName(name);if(!item||!HkmHome.isFurniture(item)||aiNum(value?.数量,0)<1)continue;const row=make('div','hkm-home-card');row.append(make('h4','',name+' ×'+value.数量),hkmButton('陈设',hudAction(()=>hkmHomeAskPlace(item.id,where))));inventory.body.append(row);}}if(inventory.body.childElementCount)hkmWorkspace.body.append(inventory.box);}else hkmWorkspace.body.append(make('p','','请前往安全屋管理陈设。'),hkmButton('前往出行',()=>hkmSwitch('outside','travel')));}
    hkmFacilitiesRender(stat);hkmPagedHidden(stat);if (!hudReadOnly) hkmAchievementSync(stat);hkmPagedLayout();hkmCodexRender(stat);hkmAchievementsRender(stat);
  };

    const hkmCodexItems = HkmCodex.catalog(Object.fromEntries(Object.keys(GAME_DATA.collectibles).map(id => [id, itemById(id)])), Object.keys(GAME_DATA.maps));
  const hkmCodexPage = { page: 1, rarity: '', category: '', map: '' };
  const hkmCodexBox = make('section', 'hkm-codex');
  const hkmCodexHeading = make('div', 'hkm-page-heading'), hkmCodexSummary = make('span', 'hkm-codex-summary');
  const hkmCodexActions = make('div', 'hkm-page-heading-actions'), hkmCodexLightAllButton = hkmButton('一键点亮');
  hkmCodexHeading.append(make('h2', '', '收藏品图鉴'), hkmCodexSummary, hkmCodexActions);
  const hkmCodexFilters = make('div', 'hkm-codex-filters'), hkmCodexGrid = make('div', 'hkm-codex-grid'), hkmCodexPager = make('nav', 'hkm-codex-pager');
  hkmCodexPager.setAttribute('aria-label', '图鉴翻页');
  for (const [key, label, values] of [['rarity', '稀有度', [...new Set(hkmCodexItems.map(item => item.rarity))]], ['category', '种类', [...new Set(hkmCodexItems.flatMap(item => item.categories))]], ['map', '地图', [...Object.keys(GAME_DATA.maps), '其他']]]) {
    const field = make('label'), select = make('select');
    select.setAttribute('aria-label', label); select.append(make('option', '', '全部' + label)); select.firstChild.value = '';
    for (const value of values) { const option = make('option', '', value); option.value = value; select.append(option); }
    select.addEventListener('change', () => { hkmCodexPage[key] = select.value; hkmCodexPage.page = 1; hkmCodexRender(currentStatSnapshot, true); });
    field.append(make('span', '', label), select); hkmCodexFilters.append(field);
  }
  hkmCodexBox.append(hkmCodexHeading, hkmCodexFilters, hkmCodexGrid, hkmCodexPager);
  let hkmCodexSignature = '', hkmCodexBusy = false;
  const hkmCodexLight = async id => {
    hkm098RequireAlive();
    if (hkmCodexBusy || !itemById(id)) return;
    hkmCodexBusy = true;
    try {
      const stat = await currentStat(), plan = HkmCodex.claim(state.codex, id, stat.统计信息?.星光);
      if (!plan) return;
      await hkm098Transact('codex:unlock:' + id, { 统计信息: { ...asObject(stat.统计信息), 星光: plan.stars } }, { codex: plan.codex });
      setStatus(itemById(id).name + '已点亮，获得 1 枚星光。');
    } finally { hkmCodexBusy = false; await refresh(); }
  };
  const hkmCodexLightAll = async () => {
    hkm098RequireAlive();
    if (hkmCodexBusy || hudReadOnly || hkm098Locked()) return;
    hkmCodexBusy = true;
    try {
      const stat = await currentStat();
      let next = HkmCodex.normalize(state.codex), stars = aiNum(stat.统计信息?.星光, 0), count = 0;
      for (const item of hkmCodexItems) {
        const plan = HkmCodex.claim(next, item.id, stars);
        if (!plan) continue;
        next = plan.codex; stars = plan.stars; count += 1;
      }
      if (!count) return;
      await hkm098Transact('codex:unlock-all:' + Date.now(), { 统计信息: { ...asObject(stat.统计信息), 星光: stars } }, { codex: next });
      setStatus('已点亮 ' + count + ' 项收藏品图鉴。');
    } finally { hkmCodexBusy = false; await refresh(); }
  };
  const hkmCodexDot = () => {
    const count = hkmCodexItems.filter(item => HkmCodex.pending(state.codex, item.id)).length, tab = document.getElementById('hkm-sub-codex');
    if (!tab) return;
    tab.querySelector('.hkm-codex-dot')?.remove();
    tab.setAttribute('aria-label', count ? '图鉴，' + count + '项待点亮' : '图鉴');
    if (count) { const dot = make('span', 'hkm-codex-dot'); dot.setAttribute('aria-hidden', 'true'); tab.append(dot); }
  };
  const hkmCodexRender = (stat, force = false) => {
    hkmCodexDot();
    const sig = JSON.stringify([state.codex, stat.统计信息?.星光, hkmCodexPage, hudReadOnly, hkm098Locked(), hkmCodexBusy]);
    if (!force && sig === hkmCodexSignature) return;
    hkmCodexSignature = sig;
    const data = HkmCodex.normalize(state.codex), view = HkmCodex.query(hkmCodexItems, data, hkmCodexPage, hkmCodexPage.page);
    hkmCodexPage.page = view.page;
    hkmCodexSummary.textContent = Object.keys(data.unlocked).length + ' / ' + hkmCodexItems.length + ' 已点亮';
    const pendingCount = hkmCodexItems.filter(item => HkmCodex.pending(data, item.id)).length;
    hkmCodexLightAllButton.disabled = hudReadOnly || hkm098Locked() || hkmCodexBusy || !pendingCount;
    hkmCodexLightAllButton.title = pendingCount ? '点亮全部已带出但尚未点亮的收藏品' : '没有待点亮的收藏品';
    if (!hkmCodexLightAllButton.dataset.bound) { hkmCodexLightAllButton.dataset.bound = 'true'; hkmCodexLightAllButton.addEventListener('click', hudAction(hkmCodexLightAll)); }
    hkmCodexActions.replaceChildren(hkmCodexLightAllButton);
    hkmCodexGrid.replaceChildren();
    for (const item of view.rows) {
      const lit = data.unlocked[item.id] === true, ready = HkmCodex.pending(data, item.id), card = make('article', 'hkm-codex-card');
      card.dataset.itemId = item.id; card.dataset.state = lit ? 'lit' : ready ? 'ready' : 'locked'; card.dataset.rarity = item.rarity;
      const visual = make('div', 'hkm-codex-visual'), picture = hudItemPicture(item);
      if (picture) { const img = make('img'); img.src = picture; img.alt = item.name; img.loading = 'lazy'; img.addEventListener('error', () => img.remove(), { once: true }); visual.append(img); }
      const head = make('div', 'hkm-codex-head'), info = make('div', 'hkm-codex-info');
      const name = hkmButton(item.name, () => hudOpenItemPanel({name:item.name,mode:'收藏品',pinned:true,readonly:true,anchor:name}));
      name.className = 'hkm-codex-name';name.setAttribute('aria-label', '查看' + item.name + '详情');
      info.append(name, make('p', 'hkm-codex-category', item.category));
      head.append(visual, info, make('span', 'hkm-codex-rarity', item.rarity));
      const sourceText = hudItemSource(item) || '未标注来源', source = make('p', 'hkm-codex-source', '来源：' + sourceText);
      source.title = sourceText;
      const foot = make('div', 'hkm-codex-foot');foot.append(make('p', 'hkm-codex-count', '带出 ' + (data.counts[item.id] || 0) + ' 次'));
      card.append(head, source, foot);
      if (ready) { const button = hkmButton('点亮 · +1 星光', hudAction(() => hkmCodexLight(item.id))); button.disabled = hudReadOnly || hkm098Locked() || hkmCodexBusy; foot.append(button); }
      else foot.append(make('span', 'hkm-codex-state', lit ? '已点亮' : '未带出'));
      hkmCodexGrid.append(card);
    }
    if (!view.total) hkmCodexGrid.append(make('p', 'hkm-page-empty', '没有符合条件的收藏品。'));
    hkmCodexPager.replaceChildren();
    const previous = hkmButton('‹', () => { hkmCodexPage.page--; hkmCodexRender(currentStatSnapshot, true); hkmContent.scrollTop = 0; }), next = hkmButton('›', () => { hkmCodexPage.page++; hkmCodexRender(currentStatSnapshot, true); hkmContent.scrollTop = 0; });
    previous.title = '上一页'; previous.setAttribute('aria-label', '上一页'); previous.disabled = view.page === 1;
    next.title = '下一页'; next.setAttribute('aria-label', '下一页'); next.disabled = view.page === view.pages;
    hkmCodexPager.append(make('span', '', '共 ' + view.total + ' 件'), previous, make('span', 'hkm-codex-page-number', view.page + ' / ' + view.pages), next);
  };
  const hkmAchievementsBox = make('section', 'hkm-achievements');
  const hkmAchievementsHeading = make('div', 'hkm-page-heading');
  const hkmAchievementsSummary = make('span', 'hkm-achievements-summary');
  const hkmAchievementsActions = make('div', 'hkm-page-heading-actions'), hkmAchievementClaimAllButton = hkmButton('一键领取');
  const hkmAchievementsGrid = make('div', 'hkm-achievements-grid');
  const hkmAchievementsPager = make('nav', 'hkm-achievements-pager');
  hkmAchievementsPager.setAttribute('aria-label', '成就翻页');
  hkmAchievementsHeading.append(make('h2', '', '成就'), hkmAchievementsSummary, hkmAchievementsActions);
  hkmAchievementsBox.append(hkmAchievementsHeading, hkmAchievementsGrid, hkmAchievementsPager);
  const hkmAchievementsPage = { page: 1 };
  let hkmAchievementsSignature = '', hkmAchievementBusy = false;
  const hkmAchievementToast = definition => {
    const toast = make('div', 'hkm-achievement-toast');
    toast.setAttribute('role', 'status');
    toast.append(make('strong', '', '成就完成'), make('span', '', definition.name));
    hkmPortal.append(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    setTimeout(() => { toast.classList.remove('is-visible'); setTimeout(() => toast.remove(), 260); }, 3000);
  };
  const hkmAchievementSync = stat => {
    if (state.run && stat.场景?.地图 === state.run.map) {
      const progress=HkmAchievements.normalize(state.achievements);
      progress.stats.runKills=Math.max(progress.stats.runKills,HkmBattle.summary(state.run).playerKills);
      if (stat.主角?.是否死亡 !== true && aiNum(stat.主角?.当前血量,0)>0 && HkmBattle.clear(state.run)) progress.stats.clearMap=1;
      state.achievements=progress;
    }
    const result = HkmAchievements.evaluate(HkmAchievements.reconcile(state.achievements, stat.前端结算?.回执), stat, state.codex);
    if (!result.newly.length && JSON.stringify(state.achievements) === JSON.stringify(result.next)) return;
    state.achievements = result.next;
    if (!hudReadOnly) {
      try { saveFrontendState(state); } catch (_) {}
      result.newly.forEach(hkmAchievementToast);
    }
  };
  const hkmAchievementRewardText = reward => { const box = reward || {}; const rows = []; if (box.stars) rows.push('星光×' + box.stars); if (box.coins) rows.push('哈基币×' + box.coins); if (box.randomRarity) rows.push('随机' + box.randomRarity + '收藏品'); if (box.base) for (const [key, value] of Object.entries(box.base)) rows.push(key + '+' + value); if (box.fishingPower) rows.push('钓鱼力量+' + box.fishingPower); return rows.join('，') || '暂无'; };
  const hkmAchievementApplyReward = (stat, patch, reward) => {
    const box = reward || {}, stats = patch.统计信息;
    if (box.stars) stats.星光 = aiNum(stats.星光, 0) + aiNum(box.stars, 0);
    if (box.coins) stats.哈基币 = aiNum(stats.哈基币, 0) + aiNum(box.coins, 0);
    if (box.base) Object.assign(patch, hudGrantBase({ ...stat, 主角: patch.主角 || stat.主角 }, box.base).patch);
    if (box.fishingPower) patch.主角 = { ...asObject(patch.主角 || stat.主角), 额外钓鱼力量: aiNum(patch.主角?.额外钓鱼力量, aiNum(stat.主角?.额外钓鱼力量, 0)) + aiNum(box.fishingPower, 0) };
    if (box.randomRarity) {
      const pool = Object.values(asObject(GAME_DATA.collectibles)).filter(item => item?.rarity === box.randomRarity), item = pool[Math.floor(Math.random() * pool.length)];
      if (item) {
        const stash = { ...asObject(patch.安全屋?.收藏品 || stat.安全屋?.收藏品) }, old = asObject(stash[item.name]);
        stash[item.name] = { 名称: item.name, 稀有度: item.rarity, 数量: aiNum(old.数量, 0) + 1, 描述: item.description, 价值: item.value, 重量: item.weight };
        patch.安全屋 = { ...asObject(patch.安全屋 || stat.安全屋), 收藏品: stash };
      }
    }
  };
  const hkmAchievementClaim = async id => {
    hkm098RequireAlive();
    if (hkmAchievementBusy || hudReadOnly || hkm098Locked()) return;
    hkmAchievementBusy = true;
    try {
      const stat = await currentStat(), plan = HkmAchievements.claim(HkmAchievements.reconcile(HkmAchievements.merge(state.achievements, readFrontendState().achievements), stat.前端结算?.回执), id);
      if (!plan?.definition) return;
      const reward = plan.definition.reward || {}, patch = { 统计信息: { ...asObject(stat.统计信息) } };
      hkmAchievementApplyReward(stat, patch, reward);
      await hkm098Transact('achievement:claim:' + id, patch, { achievements: plan.state }, '', '', 1, stat);
      setStatus('已领取成就奖励：' + hkmAchievementRewardText(plan.definition.reward) + '。');
    } finally {
      hkmAchievementBusy = false;
      await refresh();
    }
  };
  const hkmAchievementClaimAll = async () => {
    hkm098RequireAlive();
    if (hkmAchievementBusy || hudReadOnly || hkm098Locked()) return;
    hkmAchievementBusy = true;
    try {
      const stat = await currentStat();
      let next = HkmAchievements.reconcile(HkmAchievements.merge(state.achievements, readFrontendState().achievements), stat.前端结算?.回执), count = 0, patch = { 统计信息: { ...asObject(stat.统计信息) }, 前端结算: { ...asObject(stat.前端结算), 回执: { ...asObject(stat.前端结算?.回执) } } };
      for (const definition of HkmAchievements.defs) {
        const plan = HkmAchievements.claim(next, definition.id);
        if (!plan?.definition) continue;
        next = plan.state; hkmAchievementApplyReward(stat, patch, plan.definition.reward); patch.前端结算.回执['achievement:claim:' + definition.id] = true; count += 1;
      }
      if (!count) return;
      await hkm098Transact('achievement:claim-all:' + Date.now() + ':' + (++hkm095QueueSerial), patch, { achievements: next }, '', '', 1, stat);
      setStatus('已领取 ' + count + ' 项成就奖励。');
    } finally {
      hkmAchievementBusy = false;
      await refresh();
    }
  };
  const hkmAchievementDot = () => {
    const count = HkmAchievements.pending(state.achievements).length, tab = document.getElementById('hkm-sub-achievements');
    if (!tab) return;
    tab.querySelector('.hkm-achievement-dot')?.remove();
    tab.setAttribute('aria-label', count ? '成就，' + count + '项奖励待领取' : '成就');
    if (count) { const dot = make('span', 'hkm-achievement-dot'); dot.setAttribute('aria-hidden', 'true'); tab.append(dot); }
  };
  const hkmAchievementsRender = (stat, force = false) => {
    hkmAchievementDot();
    const data = HkmAchievements.normalize(state.achievements), result = HkmAchievements.evaluate(data, stat, state.codex), values = result.values;
    const sig = JSON.stringify([data, values, hkmAchievementsPage.page, hudReadOnly, hkmAchievementBusy]);
    if (!force && sig === hkmAchievementsSignature) return;
    hkmAchievementsSignature = sig;
    const pageSize = 8, rows = HkmAchievements.defs, pages = Math.max(1, Math.ceil(rows.length / pageSize));
    hkmAchievementsPage.page = Math.max(1, Math.min(pages, hkmAchievementsPage.page));
    const visible = rows.slice((hkmAchievementsPage.page - 1) * pageSize, hkmAchievementsPage.page * pageSize);
    hkmAchievementsSummary.textContent = rows.filter(row=>data.unlocked[row.id]).length + ' / ' + rows.length + ' 已完成';
    const pendingCount = HkmAchievements.pending(data).length;
    hkmAchievementClaimAllButton.disabled = hudReadOnly || hkmAchievementBusy || hkm098Locked() || !pendingCount;
    hkmAchievementClaimAllButton.title = pendingCount ? '领取全部已完成成就的奖励' : '没有待领取的成就奖励';
    if (!hkmAchievementClaimAllButton.dataset.bound) { hkmAchievementClaimAllButton.dataset.bound = 'true'; hkmAchievementClaimAllButton.addEventListener('click', hudAction(hkmAchievementClaimAll)); }
    hkmAchievementsActions.replaceChildren(hkmAchievementClaimAllButton);
    hkmAchievementsGrid.replaceChildren();
    for (const definition of visible) {
      const unlocked = data.unlocked[definition.id] === true, claimed = data.claimed[definition.id] === true;
      const card = make('article', 'hkm-achievement-card');
      card.dataset.state = unlocked ? claimed ? 'claimed' : 'ready' : 'locked';
      const body = make('div', 'hkm-achievement-body');
      body.append(make('h3', '', definition.name), make('p', '', definition.description));
      const value = Math.floor(values[definition.id] || 0);
      const current = definition.kind === 'reputation' ? value : Math.min(definition.target, value);
      const progress = definition.kind === 'coins' ? '当前 ' + value + ' · 需大于 ' + definition.target : current + ' / ' + definition.target;
      body.append(make('div', 'hkm-achievement-progress', unlocked ? '已完成' : progress));
      const reward = make('div', 'hkm-achievement-reward', '奖励：' + hkmAchievementRewardText(definition.reward));
      const action = make('div', 'hkm-achievement-action');
      if (unlocked && !claimed) {
        const button = hkmButton('领取', hudAction(() => hkmAchievementClaim(definition.id)));
        button.disabled = hudReadOnly || hkmAchievementBusy || hkm098Locked();
        action.append(button);
      } else action.append(make('span', 'hkm-achievement-state', claimed ? '已领取' : '未完成'));
      card.append(body, reward, action);
      hkmAchievementsGrid.append(card);
    }
    hkmAchievementsPager.replaceChildren();
    const previous = hkmButton('‹', () => { hkmAchievementsPage.page--; hkmAchievementsRender(currentStatSnapshot, true); hkmContent.scrollTop = 0; });
    const next = hkmButton('›', () => { hkmAchievementsPage.page++; hkmAchievementsRender(currentStatSnapshot, true); hkmContent.scrollTop = 0; });
    previous.title = '上一页'; previous.setAttribute('aria-label', '上一页'); previous.disabled = hkmAchievementsPage.page === 1;
    next.title = '下一页'; next.setAttribute('aria-label', '下一页'); next.disabled = hkmAchievementsPage.page === pages;
    hkmAchievementsPager.append(make('span', '', '共 ' + rows.length + ' 项'), previous, make('span', 'hkm-achievements-page-number', hkmAchievementsPage.page + ' / ' + pages), next);
  };

  const hkm098RefreshBody = async () => {
    const stat = await currentStat();
    currentStatSnapshot = stat;
    const scene = asObject(stat.场景);
    const mapName = textOf(scene.地图, '哈基米空间');
    const area = textOf(scene.区域, '安全屋');
    const previousContext = currentContext;

    hudReadOnly = !isLatestHudLayer();
    hkmTurnSyncUI();
    if (hkmTurnLocked()) { applyHudReadOnlyUI(); return; }
    if (!hudReadOnly && hkm098Busy) return;
    if (!hudReadOnly && state.lifecycleJournal?.phase === 'prepared') {
      hkm098Busy = true;
      try { await hkm098ApplyJournal(); } catch(error) { setStatus(error.message); hkm098RenderDeath(stat); return; }
      finally { hkm098Busy = false; }
      hkm098RefreshQueued = true; return;
    }
    if (!hudReadOnly && hkmFishingEngine && hkmFishingValid(stat) && (!state.fishing?.cast?.active || state.fishing.cast.runId===hkm098RunId(state.run))) return;
    if (!hudReadOnly) {
      const migrated=HkmSave.migrateGoogle(stat);
      if (JSON.stringify(migrated)!==JSON.stringify(stat)) {
        await hkm098Transact('google-layout-v107:'+mvuMessageId(),migrated,HkmSave.migrateGoogle(state));
        hkm098RefreshQueued=true;return;
      }
    }
    if(!hudReadOnly){
      const raw=await HkmSave.readGame(mvuMessageId());
      const projected=HkmStateBoundary.project(stat,state);
      if(!raw.data.hkm_game_data || JSON.stringify(raw.data.stat_data)!==JSON.stringify(projected)){
        hkm098Internal+=1;
        try{const result=await aiWriteVars({});if(!result.ok)throw Error('变量分离未能保存，请刷新重试。');}
        finally{hkm098Internal-=1;}
        return;
      }
    }
    if (!hudReadOnly && await hkm163EquipmentSync(stat)) return;
    if (!hudReadOnly && await hkm154SyncBattle(stat)) return;
    if (await hkmFishingSync(stat)) return;
    if (await hkmSeaSync(stat)) return;
    if (await hkmFacilitiesSync(stat)) return;
    if (!hudReadOnly && await hkm098SyncRules(stat)) return;
    if (!hudReadOnly) { if (await hkm140IngestSpared(stat)) return; if (await hkm098SyncPlayers(stat)) return; if (await hkm160IngestDeparture(stat)) return; if (await hkm098ProcessStatEvents(stat)) return; if (await hkm130IngestContracts(stat)) return; hkm130SkillClock(stat); }
    if (await hkm098CheckDeath(stat)) {
      roundLabel.textContent = '地图：' + mapName + ' · 区域：' + area + ' · 已死亡';
      renderCharacter(stat); renderEquipment(stat); hkmPagedOddity(stat); renderEnemies(stat);
      renderState(stat,mapName,area,getTier(mapName,area,GAME_DATA.maps[mapName]));
      currentContext={mapName,area,tier:0};hkmPagedRefresh(stat);
      return;
    }
    let stateChanged = false;
    if (state.lastMap && state.lastMap !== mapName) {
      state.tiers = {};
      state.visited = {};
      state.specials = {};
      stateChanged = true;
    }
    const currentKey = areaKey(mapName, area);
    if (!state.visited[currentKey]) {
      state.visited[currentKey] = true;
      stateChanged = true;
    }
    if (state.lastMap !== mapName || state.lastArea !== area) {
      state.lastMap = mapName;
      state.lastArea = area;
      stateChanged = true;
    }
    const map = GAME_DATA.maps[mapName] || GAME_DATA.maps['哈基米空间'];
    if (mapName === '魔鬼海' && state.specials['monsterSea.playerKillBaseline'] == null) {
      state.specials['monsterSea.playerKillBaseline'] = playerKillTotal(stat);
      stateChanged = true;
    }
    const isMissionMap = textOf(map?.kind, '') === 'mission';
    if (!hudReadOnly && !isMissionMap && state.run?.pendingEntry && GAME_DATA.maps[state.run.map]?.kind === 'mission') {
      const draft=hudDraftMission(stat,state.run.map,state.run);
      await hkm098Transact(hkm098RunId(draft.run)+':legacy-entry',{场景:{...asObject(stat.场景),地图:draft.run.map,区域:draft.area,剩余交互轮数:String(draft.run.rounds),剩余水下行动值:String(draft.run.water || 0),水下机制版本:1,是否战斗中:false},敌人:draft.enemies,散落物品:draft.scatter},{run:draft.run,tiers:{},visited:{[areaKey(draft.run.map,draft.area)]:true},specials:{},lastMap:draft.run.map,lastArea:draft.area},'旧版预留入局已由前端完成；不重复扣入局费、抽出生点或任务。');
      currentStatSnapshot=null; return;
    }
    if (!hudReadOnly && isMissionMap && (!state.run || state.run.map !== mapName)) {
      aiStartRun(mapName, stat);
      stateChanged = true;
    } else if (!hudReadOnly && !isMissionMap && state.run && !state.run.pendingEntry) {
      await hkm098Transact(hkm098RunId(state.run) + ':exit', { 统计信息: HkmLifecycle.endStats(stat.统计信息, false), 散落物品: {} }, { run: null });
      stateChanged = true;
      currentStatSnapshot = null;
      return;
    }

    if (!hudReadOnly && isMissionMap && state.run?.map === mapName && state.run.entered !== mapName) {
      const draft = hudDraftMission(stat, mapName, state.run);
      await hkm098Transact(hkm098RunId(draft.run)+':initialize', {散落物品:draft.scatter,敌人:draft.enemies}, {run:draft.run});
      currentStatSnapshot = null; return;
    }



    if (!hudReadOnly && isMissionMap && state.run && state.run.map === mapName) {
      aiNpcSpawnAll(mapName, stat);
      for (const player of aiPlayers()) {
        if ((player.meta === '鼠鼠' || player.meta === '萌新') && player.threat !== hkm139PlayerThreat(player)) { player.threat = hkm139PlayerThreat(player); stateChanged = true; }
        const record = asObject(stat.敌人)[player.name] || asObject(stat.敌人)[player.id];
        if (hkm139Friendly(record) && !hkm139Friendly(player)) { player.friendly = true; stateChanged = true; }
      }
      if (state.run.entryKeychainKnown !== true) {
        const baseline={...asObject(state.run.entryInventory)};
        for (const [name,row] of Object.entries(asObject(state.keychain))) {
          const old=asObject(baseline[name]), item=hkm098Resolve(name);
          baseline[name]={...old,name,quantity:Math.max(aiNum(old.quantity,0),1),value:aiNum(old.value,aiNum(row.价值,aiNum(item?.value,0))),rarity:old.rarity || row.稀有度 || item?.rarity || '寻常'};
        }
        state.run.entryInventory=baseline; state.run.entryKeychainKnown=true; stateChanged=true;
      }
    }

    if (!hudReadOnly && await hkmSeaNativeTick(stat)) return;
    hudDialogueSync();

    if (!hudReadOnly && await hudSettleCombatFlag(stat)) return;


    if (!hudReadOnly && await hudSettleTotalAssets(stat)) return;

    if (!hudReadOnly) aiNpcSyncHp(stat);
    if (!hudReadOnly && await hkmFishingDropDeaths(stat)) return;
    if (!hudReadOnly && await hkmFishingCollectKills(stat)) return;


    if (!hudReadOnly && isMissionMap) await aiEnsurePlayerRows(stat, mapName, area);

    if (!hudReadOnly && isMissionMap && await hudIngestKillBoxes(stat, mapName)) {
      await aiWriteVars(aiEnemyPatch(mapName, area, await currentStat()));
      return;
    }
    if (!hudReadOnly && await hkmSemanticTaskSync(stat)) return;

    if (!hudReadOnly && await hudSettleHeroStats(stat)) return;

    if (!hudReadOnly && await hudSettleMaskGrowth(stat)) return;
    const noticeCount = Array.isArray(state.notices?.list) ? state.notices.list.length : 0;
    hudCheckBurden(stat);
    if ((state.notices?.list?.length || 0) !== noticeCount) stateChanged = true;
    const tier = getTier(mapName, area, map);
    currentContext = { mapName, area, tier };
    roundLabel.textContent = '地图：' + mapName + ' · 区域：' + area;
    applyHudReadOnlyUI();
    renderMap(mapName, area);
    hkmHomeRender(stat);
    renderState(stat, mapName, area, tier);
    renderCharacter(stat);
    renderEquipment(stat);
    hkmPagedOddity(stat);
    renderEnemies(stat);

    hudBoxWindowList()
      .filter(row => textOf(row.roundKey, '') !== hudRoundKey())
      .map(row => row.boxId)
      .forEach(hudCloseBoxWindow);
    hudRenderBoxWindows();
    if (!hudReadOnly && await hudMigrateStash(stat)) return;
    hudRenderStashWindow(stat);

    sellAllButton.hidden = hudReadOnly || hudInMatch();
    storeAllButton.hidden = hudReadOnly || hudInMatch();
    stashSellAllButton.hidden = hudReadOnly || hudInMatch();
    if (!sellWindow.hidden) hudRenderSellWindow(stat);
    if (!batchWindow.hidden) hudRenderBatchWindow(stat);
    renderStatusStrip(stat);
    renderCollectionCards({ body: bagListBox }, stat.背包?.携带收藏品, '背包为空。', '背包', { scroll: true });
    renderScatter(stat, mapName, area);
    hkm140BagSync(stat);
    renderSpecial(stat, mapName, area);
    renderCollectionCards(stashPanel, stat.安全屋?.收藏品, '安全屋暂无收藏品。', '安全屋');
    syncQuestState(stat, { mapName, area });
    pruneUseRecords();
    renderUsedPanel();
    hkmFishingRenderClaims(stat);
    if (state.debugOpen && !hudReadOnly) hudRenderDebug();
    renderTasks(stat);
    renderStats(stat);
    renderShop(stat, mapName, area);
    renderCart(stat, area);
    updateSearchButton();
    hkmPagedRefresh(stat);
    if(!hkm138Dialog.hidden)hkm138Fill(stat);
    await hkmMaybeTutorial();
    if (mapName !== previousContext.mapName || area !== previousContext.area) setStatus('当前位于 ' + mapName + ' / ' + area + '。');
    else if (!searchBusy && !moveBusy && liveStatus.textContent === '正在读取干员状态…') setStatus('当前位于 ' + mapName + ' / ' + area + '。');
    if (stateChanged) saveFrontendState(state);


    hudMakeDraggable(debugPanel, 'debug');
    hudMakeDraggable(stashWindow, 'stash');
    hudBoxWindowList().forEach(row => { if (row && row.node) hudMakeDraggable(row.node, 'box:' + textOf(row.boxId, '')); });
  };



  const HkmFishing = (() => {
  const copy = value => JSON.parse(JSON.stringify(value));
  const obj = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const qty = row => Math.max(0, Math.floor(Number(row?.数量 ?? 1) || 0));
  const catalog = game => Object.values(game.collectibles);
  const resolve = (game, name) => game.collectibles[name] || catalog(game).find(item => item.name === String(name).replace(/[（(]\s*(?:寻常|少见|珍稀|奇异|至宝|神秘)\s*[）)]\s*$/,'').trim() || item.aliases?.includes(String(name)));
  const kind = item => item?.fishingGear?.type;
  const durabilityValue = (item, remaining, maximum) => {
    const base=Math.max(0,Number(item?.value)||0),max=Number(maximum),dur=Number(remaining);
    return Math.round(base*(max>0 ? Math.min(1,Math.max(0,Number.isFinite(dur)?dur:max)/max):1)*100)/100;
  };
  const make = (item, serial, ready = false) => {
    const row = { uid: 'FG-' + serial, itemId: item.id };
    if (kind(item) === 'rod') Object.assign(row, { baitId: null, line: null, hook: null });
    if (kind(item) === 'line') Object.assign(row, { durability: item.fishingGear.maxDurability, wear: 0 });
    if (ready && kind(item) === 'rod') {
      row.line = { uid: row.uid + '-L', itemId: 'COL-0232', durability: 1000, wear: 0 };
      row.hook = { uid: row.uid + '-H', itemId: 'COL-0238' };
    }
    return row;
  };
  const locations = (stat, game) => {
    const rows = [];
    const add = (name, count, where) => { const item = resolve(game, name); if (['rod','line','hook'].includes(kind(item))) rows.push({ item, count, where }); };
    for (const [slot, name] of Object.entries(obj(stat.装备))) add(name, name === '无' ? 0 : 1, '装备:' + slot);
    for (const [label, box] of [['背包',stat.背包?.携带收藏品],['安全屋',stat.安全屋?.收藏品],['藏匿物',stat.藏匿物],['散落物品',stat.散落物品]]) {
      for (const [key, row] of Object.entries(obj(box))) add(row.名称 || key, qty(row), label === '散落物品' ? label + ':' + key : label);
    }
    return rows;
  };
  const reconcile = (stat, game, search = false) => {
    const old = obj(stat.渔具状态), registry = Object.values(obj(old.instances)).map(copy);
    for (const row of registry) {
      const line=kind(resolve(game,row.itemId))==='line' ? row:row.line;
      if(line && Number(old.version || 1)<2){line.durability=Math.max(0,Number(line.durability)||0)*10;delete line.broken;}
      if(kind(resolve(game,row.itemId))==='rod')delete row.level;
    }
    let serial = Math.max(0, Number(old.serial) || 0);
    const next = {}, used = new Set(), missing = [];
    for (const target of locations(stat, game)) {
      for (let i = 0; i < target.count; i++) {
        const row = registry.find(entry => !used.has(entry.uid) && entry.itemId === target.item.id && entry.where === target.where);
        if (row) { used.add(row.uid); next[row.uid] = row; }
        else missing.push(target);
      }
    }
    for (const target of missing) {
      let row = registry.find(entry => !used.has(entry.uid) && entry.itemId === target.item.id);
      if (row) used.add(row.uid);
      else row = make(target.item, ++serial, search);
      row.where = target.where;
      next[row.uid] = row;
    }
    return { ...old, version: 2, serial, instances: next };
  };
  const violations = (stat, game) => {
    const out = [], lines = [];
    for (const [label, box] of [['背包',stat.背包?.携带收藏品],['藏匿物',stat.藏匿物],['钥匙链',stat.钥匙链]]) for (const row of Object.values(obj(box))) {
      const item = resolve(game, row.名称), count = qty(row);
      if (kind(item) === 'rod' && count) out.push({ name: item.name, where: label, quantity: count, reason: '鱼竿必须装备到奇物栏或留在安全屋' });
      if (kind(item) === 'line' && count) lines.push({ name: item.name, where: label, quantity: count, reason: '备用鱼线合计只能携带一条' });
    }
    if (lines.reduce((n,row) => n + row.quantity, 0) > 1) out.push(...lines);
    for(const [slot,name] of Object.entries(obj(stat.装备))){
      const item=resolve(game,name);
      if(kind(item)==='rod' && slot!=='特殊工具')out.push({name:item.name,where:slot,quantity:1,reason:'鱼竿必须装备到奇物栏'});
      if(kind(item)==='line')out.push({name:item.name,where:slot,quantity:1,reason:'鱼线只能装配到鱼竿或作为备用品携带'});
    }
    const worn = stat.装备?.特殊工具;
    if (worn && worn !== '无' && !game.fishing.allowedRodIds.includes(resolve(game,worn)?.id) && resolve(game,worn)?.id!=='COL-0245') out.push({ name: String(worn), where: '奇物', quantity: 1, reason: '该收藏品不能装备到奇物栏' });
    return out;
  };
  const choose = (rows, rng = Math.random) => {
    const sum = rows.reduce((n,row) => n + Math.max(0, Number(row.weight) || 0), 0);
    if (!rows.length || sum <= 0) throw Error('战利品池为空。');
    let value = rng() * sum;
    for (const row of rows) { value -= row.weight; if (value < 0) return row; }
    return rows[rows.length-1];
  };
  const mapPool = (game,map) => [...new Set(Object.values(obj(game.collectionLists[map])).flat())].map(id=>game.collectibles[id]).filter(item=>item && !item.acquisition?.militaryShopOnly && !item.acquisition?.googleSearchOnly);
  const rollTarget = (game, map, serial, rng = Math.random) => {
    const config = game.fishing, rarity = choose(config.rarityOrder.map((name,index)=>({name,weight:config.rarityWeights[index]})),rng).name;
    const row = { uid: 'FT-' + serial, rarity };
    if (config.rarityOrder.indexOf(rarity) >= 2 && rng() < .25) {
      const monster = choose(config.monsters.filter(item=>item.rarity===rarity),rng);
      const full = mapPool(game,map), fixed = choose(full.filter(item=>item.rarity===rarity).map(item=>({itemId:item.id,weight:item.drawWeight || 10})),rng);
      row.type = 'monster'; row.monsterId = monster.id; row.drops = [{ itemId:fixed.itemId,quantity:1 }];
      const extra = full.filter(item=>['rod','line','hook','bait'].includes(kind(item)) || item.kind==='equipment' || item.kind==='consumable' || /武器装备-|消耗品/.test(item.category)).map(item=>({itemId:item.id,weight:1000/(1+Math.max(0,item.value))}));
      for (let i=0;i<3;i++) if (rng()<.4) row.drops.push({itemId:choose(extra,rng).itemId,quantity:1});
    } else { row.type='collectible'; row.itemId=choose(config.primaryPools[rarity],rng).itemId; }
    return row;
  };
  const hookBonus = (game, hook, target, rng=Math.random) => {
    const effect = resolve(game,hook?.itemId)?.fishingGear?.effect;
    const result = { coins:0,items:[] };
    if (!effect || rng()>=effect.chance) return result;
    if (effect.type==='currencyBonus') result.coins=effect.amount;
    if (effect.type==='duplicatePrimary' && target.type==='collectible' && effect.eligibleRarities.includes(target.rarity)) result.items.push({itemId:target.itemId,quantity:1});
    if (effect.type==='weightedBonus') {
      const rarity=rng()<.95?'奇异':'至宝';
      const row=choose(game.fishing.tidalPools[rarity],rng);result.items.push({itemId:row.itemId,quantity:1});
    }
    return result;
  };
  const power = (game, rod, stat) => Number(resolve(game,rod.itemId)?.fishingGear?.basePower || 0)+Number(resolve(game,rod.itemId)?.fishingGear?.powerBonus || 0)+Math.max(0,Number(stat.主角?.额外钓鱼力量)||0)+HkmFacilities.bonuses(stat,game.maps).钓鱼力量;
  const recordKill = (run, victim, killer, player = false) => {
    if (!run || !victim || !killer) return false;
    HkmBattle.register(run);
    run.fishingKills ||= {};
    run.fishingKills.seen ||= {}; run.fishingKills.actors ||= {};
    if (run.fishingKills.seen[victim]) return false;
    run.fishingKills.seen[victim]=killer;
    const count=run.fishingKills.actors[killer] ||= { creatures:0,players:0 };
    count.players=Math.max(0,Math.floor(Number(count.players)||0)); count.creatures=Math.max(count.players,Math.floor(Number(count.creatures)||0));
    count.creatures++; if(player)count.players++;
    HkmBattle.register(run);
    return true;
  };
  const extraction = (run,map,area,actor='hero') => {
    const count=run?.fishingKills?.actors?.[actor] || {}, recordedPlayers=Math.max(0,Math.floor(Number(count.players)||0));
    const totals=actor==='hero' ? HkmBattle.summary(run) : null;
    const players=Math.max(recordedPlayers,totals?.playerKills || 0,actor==='hero'?Math.max(0,Math.floor(Number(run?.killCount)||0)):0);
    const creatures=Math.max(players+Math.max(0,Math.floor(Number(count.creatures)||0)-recordedPlayers),totals ? totals.playerKills+totals.npcKills : 0);
    if(map==='魔鬼海')return {ok:creatures>=3,text:'本局击杀任意生物 '+creatures+'/3'};
    if(map==='谷歌大厦' && area==='天台撤离点')return {ok:players>=1,text:'本局击杀玩家 '+players+'/1'};
    return {ok:true,text:''};
  };
  return {copy,obj,qty,resolve,kind,durabilityValue,make,locations,reconcile,violations,choose,mapPool,rollTarget,hookBonus,power,recordKill,extraction};
})();


    const HkmFishingGame = (mount, options) => {
      mount.innerHTML='<canvas width="1180" height="720" aria-label="深水战术垂钓"></canvas><div class="hkm-fishing-readouts"><span id="phaseText"></span><span id="lineText"></span><span id="lineDurabilityOut"></span><span id="stalemateOut"></span><span id="standoffOut"></span></div><div class="feed" id="feed"></div>';
      let paused=Boolean(options.restore),busy=false,disposed=false,raf=0,saveClock=0;
      const events=[];
      const listen=(node,type,fn)=>{node.addEventListener(type,fn);events.push(()=>node.removeEventListener(type,fn));};
      const canvas = mount.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const waterTop = 164;
      const fishArea = { left: W * .175, right: W * .825, top: waterTop + 40, bottom: waterTop + (H - waterTop) * .60 };
      const swimSpeedScale = 1.35 * 1.15;
      const anchor = { x: W * .50, y: 104 };
      const mouse = { x: W * .50, y: waterTop + 120, inside: false };
      const config = options.config;
      const lineEpsilon = .00001;
      const qualityList = [
        { id:'common', name:'寻常', color:'#f5f7fa', weight:54, strength:24, turns:2, size:1.0, speed:28 },
        { id:'uncommon', name:'少见', color:'#4ade80', weight:23, strength:40, turns:3, size:1.06, speed:39 },
        { id:'rare', name:'珍稀', color:'#60a5fa', weight:12, strength:60, turns:4, size:1.12, speed:52 },
        { id:'odd', name:'奇异', color:'#c084fc', weight:6, strength:84, turns:6, size:1.20, speed:66 },
        { id:'treasure', name:'至宝', color:'#fbbf24', weight:3.5, strength:112, turns:8, size:1.30, speed:82 },
        { id:'mystery', name:'神秘', color:'#fb4b63', weight:1.5, strength:148, turns:11, size:1.42, speed:100 }
      ];
      const fishSpecies = [
        { name:'棱鳍鲷', body:'#d8edf1', accent:'#7eaab6' },
        { name:'裂纹鲈', body:'#9ec4ac', accent:'#47705c' },
        { name:'深蓝鳐', body:'#6f96bf', accent:'#d5edff' },
        { name:'紫砂鱼', body:'#8f70a8', accent:'#e0b9ff' },
        { name:'金脊鳗', body:'#d6a742', accent:'#fff2ae' },
        { name:'赤潮鲟', body:'#bd4f5c', accent:'#ffd4d7' }
      ];
      let state = 'ready';
      let phaseTime = 0;
      let last = performance.now();
      let cast = { progress: 0, x: anchor.x, y: waterTop + 20 };
      let fish = [];
      let target = null;
      let fightRecord = null;
      let fightPoint = { x: anchor.x, y: waterTop + 20, vx: 0, vy: 0 };
      let atLineLimit = false;
      let standoffElapsed = 0;
      let standoffWearTime = config.wear || 0;
      let lineCapacity = config.durability;
      let lineDurability = config.currentDurability;
      let lineBroken = false;
      let hasHit = false, recalled = false;
      let reelDir = { x: 0, y: 0 };
      let reelPulse = 0;
      let spawnClock = 0;
      let bubbleClock = 0;
      let bubbles = [];
      let logItems = [];

      const readouts=Object.fromEntries(['feed','phaseText','lineText','lineDurabilityOut','stalemateOut','standoffOut'].map(id=>[id,mount.querySelector('#'+id)]));
      const $ = id => readouts[id];
      let uiPhase='';
      function addLog(title, text, color) {
        logItems.unshift({ title, text, color });
        logItems = logItems.slice(0, 5);
        $('feed').innerHTML = logItems.map(x => `<div><b style="color:${x.color || 'var(--text)'}">${x.title}</b>：${x.text}</div>`).join('');
      }
      function updateUi() {
        const map = { ready:'待命', casting:'下钩中', waiting:'搜索中', reeling:'收钩中', fight:'角力阶段', success:'捕获确认', lost:'脱钩', broken:'断线 / 待换钩' };
        const phase = state === 'fight' && atLineLimit ? '满线僵持' : state === 'success' && lineBroken ? '捕获确认 / 待换钩' : map[state];
        const phaseKey=state+':'+lineBroken+':'+phase;
        if(uiPhase!==phaseKey){uiPhase=phaseKey;$('phaseText').innerHTML = `<span class="status-dot" style="background:${state === 'fight' ? '#ffcc66' : state === 'lost' || lineBroken ? '#ff5b67' : '#66e6ff'};box-shadow:0 0 12px currentColor"></span>${phase}`;}
        $('stalemateOut').textContent = `${standoffLimit().toFixed(2)} s`;
        $('standoffOut').textContent = atLineLimit ? `${standoffElapsed.toFixed(2)} / ${standoffLimit().toFixed(2)} s` : '—';
        $('lineDurabilityOut').textContent = `鱼线耐久 ${lineDurability} / ${lineCapacity}`;
        const lineNow = target ? Math.hypot(fightPoint.x - anchor.x, fightPoint.y - anchor.y) : (state === 'casting' || state === 'waiting' ? Math.hypot(cast.x - anchor.x, cast.y - anchor.y) : 0);
        $('lineText').textContent = `${Math.round(lineNow)} / ${config.line} px`;
      }
      function setState(next) { state = next; phaseTime = 0; updateUi(); save(); }
      function startCast() {
        if (lineBroken) { addLog('换钩', '请先更换鱼钩；鱼线耐久耗尽时也需更换鱼线。', '#ff5b67'); return; }
        if (!(state === 'ready' || state === 'success' || state === 'lost')) return;
        target = null; fightRecord = null; hasHit = false; reelDir = { x: 0, y: 0 }; reelPulse = 0;
        const point = {x:mouse.x,y:Math.max(waterTop + 20,Math.min(mouse.y,waterTop + (H-waterTop)*config.depth/100))};
        constrainLine(point,waterTop + 20);
        cast = {progress:0,x:anchor.x,y:waterTop + 20,aimX:point.x,aimY:point.y};
        positionCast(0); setState('casting');
        addLog('行动', '浮标下沉，进入搜索窗口。', '#66e6ff');
      }
      function positionCast(progress = 1) {
        const startY = waterTop + 20;
        cast.x = anchor.x + (cast.aimX - anchor.x) * progress;
        cast.y = startY + (cast.aimY - startY) * progress;
      }
      function getRodTip() {
        const rodAngle = Math.max(-.45, Math.min(.45, (mouse.x-W/2)/W*1.4));
        return { x: anchor.x + Math.sin(rodAngle)*142, y: anchor.y + Math.cos(rodAngle)*28 };
      }
      async function handleLeftClick() {
        if(disposed || busy || !options.guard())return;
        if(paused && state!=='ready'){
          if(['success','lost','broken'].includes(state))endFight(state==='success');
          else{paused=false;last=performance.now();}
          return;
        }
        if(state==='ready'){
          busy=true;
          try{
            startCast();paused=false;
            if(!await options.authorize()){setState('ready');return;}
            last=performance.now();save();
          }
          catch(error){setState('ready');options.error(error);}
          finally{busy=false;}return;
        }
        if (state === 'casting' || state === 'waiting') {
          recalled = true;
          setState('reeling');
          addLog('行动', '再次点击，开始收回浮标。', '#66e6ff');
          return;
        }
        if (state === 'fight' && target) {
          if (atLineLimit && Math.hypot(fightPoint.x - anchor.x, fightPoint.y - anchor.y) >= config.line - lineEpsilon && oppositeLineQuadrant(target, mouse)) {
            endFight(false, '主动放线，鱼已脱钩。');
            return;
          }
          const dx = mouse.x - fightPoint.x, dy = mouse.y - fightPoint.y, len = Math.hypot(dx,dy) || 1;
          reelDir = { x: dx / len, y: dy / len };
          reelPulse = 1;
          if(fightRecord){fightRecord.pullCount++;if(fightRecord.pulls.length<16)fightRecord.pulls.push({time:Number(fightRecord.elapsed.toFixed(2)),direction:(reelDir.x<-.25?'左':reelDir.x>.25?'右':'')+(reelDir.y<-.25?'上':reelDir.y>.25?'下':'') || '原方向'});}
          addLog('收力', reelDir.x < -.25 ? '向左收力。' : reelDir.x > .25 ? '向右收力。' : '向当前方向收力。', '#ffd477');
          return;
        }
        startCast();
      }
      function oppositeLineQuadrant(f, aim) {
        const lineX = anchor.x - f.x, lineY = anchor.y - f.y;
        const aimX = aim.x - f.x, aimY = aim.y - f.y;
        return Math.abs(lineX) > lineEpsilon && Math.abs(lineY) > lineEpsilon && Math.abs(aimX) > lineEpsilon && Math.abs(aimY) > lineEpsilon && lineX * aimX < 0 && lineY * aimY < 0;
      }
      function constrainLine(point, minimumY = waterTop) {
        const dx = point.x - anchor.x, dy = point.y - anchor.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= config.line) return distance;
        const nx = dx / distance, ny = dy / distance;
        point.x = anchor.x + nx * config.line; point.y = anchor.y + ny * config.line;
        if (point.y < minimumY) {
          point.y = minimumY;
          point.x = anchor.x + Math.sign(dx) * Math.sqrt(Math.max(0, config.line * config.line - (minimumY - anchor.y) ** 2));
        }
        const boundedNx = (point.x - anchor.x) / config.line, boundedNy = (point.y - anchor.y) / config.line;
        const outwardSpeed = (point.vx || 0) * boundedNx + (point.vy || 0) * boundedNy;
        if (outwardSpeed > 0) { point.vx -= boundedNx * outwardSpeed; point.vy -= boundedNy * outwardSpeed; }
        return config.line;
      }
      function updateStandoff(dt, lineLength) {
        if (state !== 'fight' || !target) return;
        if (lineLength >= config.line - lineEpsilon) {
          if (!atLineLimit) { atLineLimit = true; standoffElapsed = 0;if(fightRecord)fightRecord.limitCount++;addLog('僵持', '鱼线已拉满。', '#ffd477'); }
          else {
            standoffElapsed += dt; standoffWearTime += dt;
            if(fightRecord)fightRecord.standoffSeconds+=dt;
            const wear = Math.floor((standoffWearTime + 1e-9) / .4);
            if (wear > 0) {
              lineDurability = Math.max(0, lineDurability - wear);
              standoffWearTime = Math.max(0, standoffWearTime - wear * .4);
              save();
            }
          }
          if (lineDurability<=0 || standoffElapsed + 1e-9 >= standoffLimit()) {
            lineBroken = true; lineDurability = Math.max(0,lineDurability-lineLength);
            endFight(false, '鱼线崩断，鱼钩遗失，请更换鱼钩。');
          }
        } else {
          if (atLineLimit) addLog('缓解', '鱼线已缩短，僵持解除。', '#66e6ff');
          atLineLimit = false; standoffElapsed = 0;
        }
      }
      function standoffLimit() {
        return lineDurability * .001 + (config.standoffBonus || 0);
      }
      function startEscape(f) {
        const angle = Math.random() * Math.PI;
        f.force = f.quality.strength * (.65 + Math.random() * .70);
        f.escapeX = Math.cos(angle) * f.force;
        f.escapeY = Math.sin(angle) * f.force;
        f.escapeBurst = .24;
        f.nextTurn = .65 + Math.random() * .50;
        f.struggleCount += 1;
        if(fightRecord?.uid===f.hidden.uid){fightRecord.escapeCount++;if(fightRecord.escapes.length<24)fightRecord.escapes.push({time:Number(fightRecord.elapsed.toFixed(2)),direction:(f.escapeX<-1?'左':f.escapeX>1?'右':'')+(f.escapeY>1?'下':''),force:Number(f.force.toFixed(2))});}
      }
      function fightVelocity(f) {
        const forceX = f.escapeX + reelDir.x * config.power;
        const forceY = f.escapeY + reelDir.y * config.power;
        const restBonus = f.restTimer > 0 ? 60 : 0;
        return { x: forceX * 2.1 + reelDir.x * restBonus, y: forceY * 2.1 + reelDir.y * restBonus };
      }
      function spawnFish() {
        const hidden=options.generate();
        const quality=qualityList.find(q=>q.name===hidden.rarity);
        const species = fishSpecies[Math.floor(Math.random()*fishSpecies.length)];
        const marginX = 32 * quality.size, marginY = 20 * quality.size;
        const x = fishArea.left + marginX + Math.random() * (fishArea.right - fishArea.left - marginX * 2);
        const y = fishArea.top + marginY + Math.random() * (fishArea.bottom - fishArea.top - marginY * 2);
        const f = { hidden, x, y, dir:Math.random() < .5 ? -1 : 1, vx:0, vy:0, quality, species, phase:Math.random()*Math.PI*2, force:quality.strength, struggleCount:0, struggleLimit:quality.turns, nextTurn:0, restTimer:0, age:0, attached:false };
        turnSwimmingFish(f, false);
        fish.push(f);save();
      }
      function turnSwimmingFish(f, reverse = Math.random() < .4) {
        if (reverse) f.dir *= -1;
        const angle = (f.dir < 0 ? Math.PI : 0) + (Math.random() - .5) * 1.0;
        const speed = f.quality.speed * swimSpeedScale * (.85 + Math.random() * .30);
        f.vx = Math.cos(angle) * speed;
        f.vy = Math.sin(angle) * speed;
        f.swimTimer = 1.4 + Math.random() * 2.4;
      }
      function swimFish(f, dt) {
        if (f.fleeing) {
          f.x += f.vx * dt; f.y += f.vy * dt;
          if (f.x < -80 || f.x > W + 80 || f.y > H + 60) f.dead = true;
          return;
        }
        f.swimTimer -= dt;
        if (f.swimTimer <= 0) turnSwimmingFish(f);
        f.x += f.vx * dt; f.y += f.vy * dt;
        const left = fishArea.left + 32 * f.quality.size, right = fishArea.right - 32 * f.quality.size;
        const top = fishArea.top + 20 * f.quality.size, bottom = fishArea.bottom - 20 * f.quality.size;
        if (f.x < left) { f.x = left; f.vx = Math.abs(f.vx); f.dir = 1; }
        else if (f.x > right) { f.x = right; f.vx = -Math.abs(f.vx); f.dir = -1; }
        if (f.y < top) { f.y = top; f.vy = Math.abs(f.vy); }
        else if (f.y > bottom) { f.y = bottom; f.vy = -Math.abs(f.vy); }
      }
      function startFleeing(f) {
        f.fleeing = true;
        f.restTimer = 0; f.force = 0; f.escapeX = 0; f.escapeY = 0; f.escapeBurst = 0;
        f.dir = f.x < W / 2 ? -1 : 1;
        const tilt = .1 + Math.random() * .35;
        const angle = f.dir < 0 ? Math.PI - tilt : tilt;
        const speed = f.quality.speed * swimSpeedScale * (.85 + Math.random() * .30);
        f.vx = Math.cos(angle) * speed;
        f.vy = Math.sin(angle) * speed;
      }
      function findBite() {
        if (!cast || !(state === 'waiting' || state === 'casting')) return;
        for (const f of fish) {
          if (f.dead || f.fleeing) continue;
          if (Math.hypot(f.x - cast.x, f.y - cast.y) < 25 + 9*f.quality.size) {
            fightRecord={uid:f.hidden.uid,elapsed:0,escapes:[],escapeCount:0,pulls:[],pullCount:0,restCount:0,limitCount:0,standoffSeconds:0};
            hasHit = true; target = f; f.attached = true; fightPoint = { x: cast.x, y: cast.y, vx: 0, vy: 0 }; atLineLimit = false; standoffElapsed = 0; reelDir = { x: 0, y: 0 }; reelPulse = 0; target.struggleCount = 0; target.restTimer = 0; target.x = cast.x; target.y = cast.y; target.vx = 0; target.vy = 0; startEscape(target); setState('fight'); updateStandoff(0, constrainLine(fightPoint));
            addLog('咬钩', '角力开始。', '#66e6ff'); return;
          }
        }
      }
      function endFight(success, reason, manualRecall = false) {
        if(busy)return;
        const caught=target;recalled = recalled || manualRecall;
        if(success){if(state!=='success')lineDurability=Math.max(0,lineDurability-config.wearPerSuccess);setState('success');}
        else setState(lineBroken?'broken':'lost');
        paused=true;busy=true;
        return options.finish(success,caught?.hidden,lineDurability,standoffWearTime,lineBroken,fightRecord?.uid===caught?.hidden?.uid ? JSON.parse(JSON.stringify(fightRecord)):null,hasHit,recalled).catch(error=>{busy=false;options.error(error);});
      }
      function update(dt) {
        phaseTime += dt;
        spawnClock += dt; bubbleClock += dt;
        const activeFish = fish.filter(f => f !== target && !f.dead && !f.fleeing).length;
        if (['ready','casting','waiting','fight','broken'].includes(state) && activeFish < 4 && (!activeFish || spawnClock > (state === 'fight' ? 3.6 : 2.4))) { spawnClock = 0; spawnFish(); }
        if (bubbleClock > .32) { bubbleClock = 0; bubbles.push({ x: 60+Math.random()*(W-120), y:H-20, r:2+Math.random()*5, vy:14+Math.random()*20, a:.15+Math.random()*.25 }); }
        bubbles.forEach(b => { b.y -= b.vy*dt; b.a -= dt*.012; }); bubbles = bubbles.filter(b => b.y > waterTop && b.a > 0);

        for (const f of fish) {
          f.age += dt;
          if (f === target && state === 'fight') continue;
          if (!f.dead) swimFish(f, dt);
        }
        fish = fish.filter(f => !f.dead || f === target);

        if (state === 'casting') {
          cast.progress = Math.min(1, cast.progress + dt / .85);
          const e = 1 - Math.pow(1-cast.progress, 3);
          positionCast(e);
          if (cast.progress >= 1) setState('waiting');
          findBite();
        } else if (state === 'waiting') {
          positionCast();
          findBite();
          if (phaseTime > 8.5) { endFight(false, '搜索窗口结束，浮标回收。'); }
        } else if (state === 'reeling') {
          const rodTip = getRodTip();
          cast.x += (rodTip.x - cast.x) * dt * 5.6;
          cast.y += (rodTip.y - cast.y) * dt * 5.6;
          const lineDist = Math.hypot(cast.x - anchor.x, cast.y - anchor.y);
          if (lineDist < 100 || Math.hypot(cast.x - rodTip.x, cast.y - rodTip.y) < 14) {
            cast.x = rodTip.x; cast.y = rodTip.y; endFight(false, '浮标已收回。');
          }
        } else if (state === 'fight' && target) {
          const f = target;
          if(fightRecord)fightRecord.elapsed+=dt;
          reelPulse = Math.max(0, reelPulse - dt * 2.8);
          if (f.restTimer > 0) {
            f.restTimer -= dt;
            if (f.restTimer <= 0) { f.restTimer = 0; f.struggleCount = 0; startEscape(f); addLog('恢复', '恢复挣扎。', '#66e6ff'); }
          } else {
            f.nextTurn -= dt;
            if (f.nextTurn <= 0) {
              if (f.struggleCount >= f.struggleLimit) {
                f.restTimer = 1.8 + f.quality.turns * .16; f.nextTurn = 999;
                if(fightRecord)fightRecord.restCount++;
                f.force = 0; f.escapeX = 0; f.escapeY = 0; f.escapeBurst = 0; addLog('脱力', '暂时脱力，停止挣扎。', '#66e6ff');
              } else {
                startEscape(f);
                addLog('变向', '快速改变逃跑向量。', '#66e6ff');
              }
            }
          }
          const velocity = fightVelocity(f);
          const response = 1 - Math.exp(-dt * (f.escapeBurst > 0 ? 18 : 9));
          f.escapeBurst = Math.max(0, f.escapeBurst - dt);
          fightPoint.vx += (velocity.x - fightPoint.vx) * response;
          fightPoint.vy += (velocity.y - fightPoint.vy) * response;
          fightPoint.x += fightPoint.vx * dt; fightPoint.y += fightPoint.vy * dt;
          fightPoint.y = Math.max(waterTop, Math.min(H - 55, fightPoint.y));
          const lineDist = constrainLine(fightPoint);
          const shake = f.restTimer > 0 ? 1 : 4 + f.quality.size * 3;
          const wobbleX = Math.sin(phaseTime * 13 + f.phase) * shake;
          const wobbleY = Math.cos(phaseTime * 17 + f.phase) * shake;
          const tetherX = (fightPoint.x + wobbleX - f.x) * 18;
          const tetherY = (fightPoint.y + wobbleY - f.y) * 18;
          f.vx += (tetherX - (f.vx - fightPoint.vx) * 8) * dt;
          f.vy += (tetherY - (f.vy - fightPoint.vy) * 8) * dt;
          const maxSpeed = 120 + f.quality.speed * 1.55;
          const speed = Math.hypot(f.vx,f.vy); if (speed > maxSpeed) { f.vx = f.vx/speed*maxSpeed; f.vy=f.vy/speed*maxSpeed; }
          f.x += f.vx*dt; f.y += f.vy*dt;
          f.y = Math.max(waterTop, Math.min(H-42, f.y));
          constrainLine(f);
          if (f.x < -80 || f.x > W+80) endFight(false, '鱼冲出水域边界。');
          else if (lineDist <= 80 && f.restTimer > 0) endFight(true);
          else updateStandoff(dt, lineDist);
        }
        updateUi();
      }

      function rect(x,y,w,h,fill,stroke) { ctx.fillStyle=fill; ctx.fillRect(x,y,w,h); if(stroke){ctx.strokeStyle=stroke;ctx.strokeRect(x+.5,y+.5,w-1,h-1);} }
      function drawCoral(x,y,scale,color,tipColor) {
        ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale);
        const branches = [
          [[0,0],[0,-28],[-16,-42],[-16,-62]],
          [[0,-20],[20,-34],[20,-59]],
          [[-16,-43],[-32,-49],[-32,-65]],
          [[20,-36],[35,-46],[35,-58]],
          [[0,-28],[0,-72]]
        ];
        ctx.lineCap='square'; ctx.lineJoin='miter'; ctx.lineWidth=8; ctx.strokeStyle=color;
        branches.forEach(points=>{ctx.beginPath();points.forEach(([bx,by],i)=>i?ctx.lineTo(bx,by):ctx.moveTo(bx,by));ctx.stroke();});
        branches.forEach(points=>{const [bx,by]=points[points.length-1];rect(bx-4,by-3,8,6,tipColor);});
        rect(-13,-5,26,8,color); ctx.restore();
      }
      function drawSeabed() {
        for(let i=0;i<7;i++) {
          const x=i*190-50, y=H-102+(i%3)*14;
          rect(x,y+20,150,H-y,'#0c303e'); rect(x+23,y,95,25,'#0d3541');
          rect(x+42,y-13,53,15,'#0d3541');
        }
        rect(0,H-45,W,45,'#173a42');
        for(let i=0;i<12;i++) {
          const x=i*103, y=H-49+(i%3)*5;
          rect(x,y,108,H-y,'#20444a'); rect(x+8,y,83,3,'#2e5357');
        }
        for(const [x,y,s] of [[50,674,1.1],[283,681,.8],[500,675,1],[839,677,1.15],[1071,678,.9]]) {
          rect(x-37*s,y-18*s,74*s,24*s,'#16313c');
          rect(x-26*s,y-34*s,54*s,20*s,'#274650');
          rect(x-15*s,y-44*s,32*s,13*s,'#33545c');
          rect(x-26*s,y-34*s,11*s,18*s,'#3b5d63');
          rect(x-37*s,y+3*s,74*s,7*s,'#102c35');
        }
        const plants = [[101,65],[347,48],[570,57],[742,43],[978,61],[1140,47]];
        plants.forEach(([x,h],i)=>{
          const sway=Math.sin(phaseTime*1.2+i)*4;
          for(let j=0;j<3;j++) {
            const base=x+j*9, height=h-j*9;
            rect(base,H-48-height*.45,7,height*.45,'#1b5960');
            rect(base+sway,H-48-height,6,height*.56,'#23656a');
            rect(base+sway+(j%2?-6:5),H-48-height*.75,10,5,'#2a7071');
          }
        });
        drawCoral(203,676,.86,'#a15d68','#de9286');
        drawCoral(427,677,.64,'#846793','#ba91b1');
        drawCoral(656,680,1,'#b47756','#eab280');
        drawCoral(911,675,.78,'#657baa','#91adc4');
        drawCoral(1110,683,.55,'#a25e78','#d596b0');
        for(const [x,y,s] of [[144,683,1],[380,686,.8],[786,682,1.1],[1030,687,.7]]) {
          rect(x-19*s,y-12*s,38*s,14*s,'#496970');
          rect(x-13*s,y-21*s,26*s,13*s,'#628087');
          for(let j=0;j<4;j++)rect(x+(-12+j*8)*s,y-18*s,3*s,15*s,'#385960');
        }
        for(let i=0;i<38;i++) {
          const x=(i*79+31)%W, y=H-29+(i%4)*7;
          rect(x,y,i%3===0?7:3,2,i%2?'#3b5c5c':'#2b4d51');
        }
      }
      function draw() {
        ctx.clearRect(0,0,W,H);
        const sky = ctx.createLinearGradient(0,0,0,waterTop); sky.addColorStop(0,'#0c1d28'); sky.addColorStop(1,'#163a43'); ctx.fillStyle=sky; ctx.fillRect(0,0,W,waterTop);
        rect(0, waterTop-12, W, 12, '#14262c');

        ctx.strokeStyle='rgba(166,233,236,.12)'; ctx.lineWidth=1;
        for(let x=0;x<W;x+=32){ ctx.beginPath();ctx.moveTo(x,waterTop);ctx.lineTo(x,H);ctx.stroke(); }
        for(let y=waterTop;y<H;y+=32){ ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke(); }
        const water = ctx.createLinearGradient(0,waterTop,0,H); water.addColorStop(0,'#113f4a'); water.addColorStop(.45,'#0b3445'); water.addColorStop(1,'#071b2d'); ctx.fillStyle=water; ctx.fillRect(0,waterTop,W,H-waterTop);
        for(const [x,width,drift] of [[190,84,140],[515,63,175],[854,97,120]]) {
          const light=ctx.createLinearGradient(0,waterTop,0,H-80);
          light.addColorStop(0,'rgba(141,218,216,.055)'); light.addColorStop(1,'rgba(141,218,216,0)');
          ctx.fillStyle=light; ctx.beginPath(); ctx.moveTo(x,waterTop); ctx.lineTo(x+width,waterTop);
          ctx.lineTo(x+width+drift+65,H-80); ctx.lineTo(x+drift,H-80); ctx.closePath(); ctx.fill();
        }
        rect(0,waterTop-2,W,2,'#6fe0dd');
        drawSeabed();
        bubbles.forEach(b=>{ctx.globalAlpha=Math.max(0,b.a);ctx.strokeStyle='#9ceef0';ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.stroke();}); ctx.globalAlpha=1;


        rect(anchor.x-102, 40, 204, 24, '#101b21', '#34535d'); rect(anchor.x-70, 64, 140, 10, '#1e353b');
        const rodAngle = Math.max(-.45, Math.min(.45, (mouse.x-W/2)/W*1.4));
        const tip = { x: anchor.x + Math.sin(rodAngle)*142, y: anchor.y + Math.cos(rodAngle)*28 };
        ctx.lineCap='square'; ctx.lineWidth=13; ctx.strokeStyle='#0a1014'; ctx.beginPath();ctx.moveTo(anchor.x,anchor.y);ctx.lineTo(tip.x,tip.y);ctx.stroke();
        ctx.lineWidth=8; ctx.strokeStyle='#a9c4b9';ctx.beginPath();ctx.moveTo(anchor.x,anchor.y);ctx.lineTo(tip.x,tip.y);ctx.stroke();
        rect(anchor.x-10,anchor.y-8,20,20,'#23373b','#bdeee0');
        const hookPos = state==='fight' ? fightPoint : ((state==='casting'||state==='waiting') ? cast : { x:tip.x, y:tip.y });
        if (!lineBroken) {
          ctx.strokeStyle = state==='fight' ? (target.force > config.power ? '#ff5b67' : '#ffce70') : '#d9f8f1'; ctx.lineWidth=state==='fight' ? 2 + Math.min(2, Math.abs(target.force - config.power) / 35) : 2; ctx.beginPath();ctx.moveTo(tip.x,tip.y);ctx.lineTo(hookPos.x,hookPos.y);ctx.stroke();
          if (state === 'fight') {
            ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(hookPos.x, hookPos.y); ctx.lineTo(target.x, target.y); ctx.stroke();
          }
          ctx.shadowColor='#f6d365'; ctx.shadowBlur=12; rect(hookPos.x-4,hookPos.y-2,8,15,'#ff6e5c'); rect(hookPos.x-7,hookPos.y+11,14,4,'#ffe8ba'); ctx.shadowBlur=0;
        }

        fish.forEach(f=>drawFish(f));
        if (state==='fight' && target) drawVector(target);

        if(mouse.inside){ ctx.strokeStyle='rgba(172,239,237,.55)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(mouse.x-10,mouse.y);ctx.lineTo(mouse.x+10,mouse.y);ctx.moveTo(mouse.x,mouse.y-10);ctx.lineTo(mouse.x,mouse.y+10);ctx.stroke(); }

        rect(14,H-34,240,20,'rgba(5,15,21,.74)','rgba(148,220,228,.18)'); ctx.fillStyle='#9dc6cf'; ctx.font='11px ui-monospace, monospace'; ctx.fillText(`AIM ${Math.round((mouse.x-W/2)/W*200)}°   DEPTH ${Math.round((hookPos.y-waterTop)/(H-waterTop)*100)}%`,24,H-20);
      }
      function drawFish(f) {
        const q=f.quality, s=13, flip=(f.attached ? f.vx : f.dir)<0?-1:1;
        ctx.save(); ctx.translate(f.x,f.y); ctx.rotate(f.attached && f.restTimer <= 0 ? Math.sin(f.age * 18) * .16 : 0); ctx.scale(flip,1); ctx.shadowColor=q.color;ctx.shadowBlur=18;
        ctx.fillStyle=q.color;ctx.globalAlpha=.16;ctx.fillRect(-s*1.7,-s*1.2,s*3.4,s*2.4);ctx.globalAlpha=1;
        ctx.fillStyle=f.species.body; ctx.fillRect(-s*1.0,-s*.72,s*1.9,s*1.45); ctx.fillStyle=f.species.accent; ctx.fillRect(-s*.2,-s*.72,s*.55,s*1.45);
        const tail = f.attached && f.restTimer <= 0 ? Math.sin(f.age * 24) * s * .45 : 0;
        ctx.fillStyle=f.species.body; ctx.beginPath();ctx.moveTo(-s,0);ctx.lineTo(-s*1.8,-s*.9 + tail);ctx.lineTo(-s*1.8,s*.9 + tail);ctx.closePath();ctx.fill();
        ctx.fillStyle='#07131c';ctx.fillRect(s*.55,-s*.4,3,3); ctx.fillStyle='rgba(255,255,255,.85)';ctx.fillRect(s*.55,-s*.4,1,1);
        ctx.strokeStyle='#83aab2';ctx.lineWidth=1;ctx.strokeRect(-s*1.04,-s*.76,s*2.0,s*1.52); ctx.restore();
      }
      function drawVector(f) {
        if (f.escapeBurst > 0) {
          ctx.strokeStyle = '#83aab2'; ctx.globalAlpha = f.escapeBurst / .24;
          ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(f.x, f.y, 22 + (1 - f.escapeBurst / .24) * 28, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
        }
        const sx=f.x,sy=f.y, mag=Math.min(70,Math.hypot(f.vx,f.vy)*.42), len=Math.hypot(f.vx,f.vy)||1, ex=sx+f.vx/len*mag, ey=sy+f.vy/len*mag;
        ctx.strokeStyle=f.force > config.power ? '#ff5b67' : '#ffce70';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(ex-f.vx/len*9-f.vy/len*4,ey-f.vy/len*9+f.vx/len*4);ctx.lineTo(ex-f.vx/len*9+f.vy/len*4,ey-f.vy/len*9-f.vx/len*4);ctx.closePath();ctx.fill();
      }
      function save() {
        if(disposed || !options.guard())return;
        options.snapshot(JSON.parse(JSON.stringify({state,phaseTime,cast,fish,target:target?.hidden?.uid || null,fightRecord,fightPoint,atLineLimit,standoffElapsed,standoffWearTime,lineCapacity,lineDurability,lineBroken,hasHit,recalled,reelDir,reelPulse,spawnClock,mouse,bubbles,bubbleClock})));
      }
      function restore(snapshot) {
        state=snapshot.state;phaseTime=snapshot.phaseTime;cast={...snapshot.cast};
        if(!Number.isFinite(cast.aimX) || !Number.isFinite(cast.aimY)){
          const point={x:cast.x,y:Math.min(cast.y,waterTop+(H-waterTop)*config.depth/100)};
          constrainLine(point,waterTop+20);cast.aimX=point.x;cast.aimY=point.y;
        }
        fish=snapshot.fish || [];target=fish.find(f=>f.hidden.uid===snapshot.target) || null;
        fightRecord=snapshot.fightRecord?.uid===target?.hidden?.uid ? snapshot.fightRecord:null;
        fightPoint=snapshot.fightPoint;atLineLimit=snapshot.atLineLimit;standoffElapsed=snapshot.standoffElapsed;standoffWearTime=snapshot.standoffWearTime;lineCapacity=snapshot.lineCapacity;lineDurability=snapshot.lineDurability;lineBroken=snapshot.lineBroken;hasHit=Boolean(snapshot.hasHit || snapshot.target || snapshot.fightRecord);recalled=snapshot.recalled===true;reelDir=snapshot.reelDir;reelPulse=snapshot.reelPulse;spawnClock=snapshot.spawnClock;bubbles=snapshot.bubbles || [];bubbleClock=snapshot.bubbleClock || 0;Object.assign(mouse,snapshot.mouse || {});updateUi();
      }
      function frame(now){
        if(disposed)return;
        const dt=Math.min(.033,(now-last)/1000);last=now;
        if(options.guard() && !paused){
          if(!busy){update(dt);saveClock+=dt;if(saveClock>=.5){saveClock=0;save();}}
          else if(state==='casting'){cast.progress=Math.min(.95,cast.progress+dt/.85);positionCast(1-Math.pow(1-cast.progress,3));updateUi();}
        }
        draw();raf=requestAnimationFrame(frame);
      }
      const point=e=>{const r=canvas.getBoundingClientRect();mouse.x=(e.clientX-r.left)/r.width*W;mouse.y=(e.clientY-r.top)/r.height*H;mouse.inside=true;};
      listen(canvas,'pointermove',point);
      listen(canvas,'pointerdown',e=>{if(e.button!==0)return;e.preventDefault();point(e);void handleLeftClick();});
      listen(canvas,'pointerleave',()=>{mouse.inside=false;});
      listen(canvas,'contextmenu',e=>e.preventDefault());
      const own= hkmCreateElement('span');own.textContent='钓鱼力量 '+config.power;mount.querySelector('.hkm-fishing-readouts').append(own);
      const depthOut=hkmCreateElement('span');depthOut.textContent='最大深度 '+config.depth+'%';mount.querySelector('.hkm-fishing-readouts').append(depthOut);
      const hint=hkmCreateElement('p');hint.textContent='左键点击水域下钩；未咬钩时再点可收回浮标并继续钓鱼。角力中左键点击收力，脱力时收至80px以内钓起；满线时朝鱼线相反象限收力可主动脱钩。暂离后可继续；收杆结束垂钓并发送汇总。';mount.append(hint);
      if(options.restore)restore(options.restore);else updateUi();
      raf=requestAnimationFrame(frame);
      return {
        click:handleLeftClick,
        targets:()=>fish.filter(f=>!f.dead && !f.fleeing).map(f=>f.hidden.uid),
        recall:()=>{if(busy)throw Error('钓鱼结算中，请稍后收杆。');return endFight(false,'已收杆。',true);},
        settle:(success,durability,wear,broken)=>{
          if(disposed)return;
          if(target){if(success)fish=fish.filter(f=>f!==target);else{target.attached=false;startFleeing(target);}}
          target=null;fightRecord=null;recalled=false;atLineLimit=false;standoffElapsed=0;reelDir={x:0,y:0};reelPulse=0;
          lineDurability=durability;standoffWearTime=wear;lineBroken=broken || lineDurability<=0;
          paused=false;busy=false;last=performance.now();setState(lineBroken?'broken':'ready');
        },
        resume:()=>{if(!options.guard())return;if(['success','lost','broken'].includes(state)){busy=false;endFight(state==='success');}else{paused=false;last=performance.now();}},
        dispose:()=>{save();disposed=true;cancelAnimationFrame(raf);events.forEach(fn=>fn());}
      };
    };


    let hkmFishingWindow = null, hkmFishingEngine = null, hkmFishingBusy = false, hkmFishingEnding = false;
  const hkmFishingReportSent = session => !!session?.reportText && versions(state.settleAcks?.[session.id]).includes(session.reportText);
  const hkmFishingNewSession = cast => ({id:'fishing-report:'+Date.now()+':'+(++hkm095QueueSerial),map:cast?.area ? '魔鬼海':currentContext.mapName,area:cast?.area || currentContext.area,casts:cast ? 1:0,rows:[],settlementIds:cast ? [cast.id+':cast']:[]});
  const hkmFishingReportText = (session, stat) => {
    const rows=Array.isArray(session.rows) ? session.rows:[],items=new Map();
    for(const row of rows)for(const reward of row.rewards || [])items.set(reward.itemId,(items.get(reward.itemId)||0)+reward.quantity);
    const lines=[hudPlayerName(stat)+'结束在'+session.map+'·'+session.area+'的垂钓并收杆。',
      '本次抛钩 '+session.casts+' 次，消耗饵料 '+session.casts+' 份；钓获 '+rows.filter(row=>row.success).length+' 次，断线 '+rows.filter(row=>row.broken).length+' 次；交互轮数减少 '+rows.reduce((n,row)=>n+row.roundCost,0)+'，当前剩余 '+stat.场景?.剩余交互轮数+' 轮。'];
    if(items.size){lines.push('本次所得：');for(const [id,quantity]of items)lines.push(...modelItemLines(itemById(id),quantity));}
    const coins=rows.reduce((n,row)=>n+(row.coins||0),0);if(coins)lines.push('鱼钩带来的哈基币收益：'+coins+'。');
    const rare=rows.filter(row=>row.success && ['奇异','至宝','神秘'].includes(row.rarity));
    for(const [index,row]of rare.entries()){
      const name=row.monsterId ? GAME_DATA.fishing.monsters.find(monster=>monster.id===row.monsterId)?.name:itemById(row.primaryId)?.name;
      lines.push('单条钓获角力记录 '+(index+1)+'：'+row.rarity+'·'+(name || '钓获')+'。');
      const fight=row.fight;
      if(!fight){lines.push('这条钓获没有保存角力过程。');continue;}
      lines.push('角力持续 '+Number(fight.elapsed.toFixed(2))+' 秒；鱼挣扎 '+fight.escapeCount+' 次，脱力 '+fight.restCount+' 次；收力 '+fight.pullCount+' 次；鱼线拉满 '+fight.limitCount+' 次，累计僵持 '+Number(fight.standoffSeconds.toFixed(2))+' 秒。');
      const events=[...fight.escapes.map(event=>({...event,type:'escape'})),...fight.pulls.map(event=>({...event,type:'pull'}))].sort((a,b)=>a.time-b.time);
      for(const event of events)lines.push(event.type==='escape' ? '第 '+event.time+' 秒，鱼向'+(event.direction || '下')+'方挣扎，力量 '+event.force+'。':'第 '+event.time+' 秒，主角向'+(event.direction==='原方向'?'原方向':event.direction+'方')+'收力。');
      lines.push('最终钓起了这条目标。');
    }
    if(stat.场景?.是否战斗中)lines.push(...formatEncounterLines(readAreaEncounter(stat.场景.地图,stat.场景.区域,stat)));
    lines.push(rare.length ? '请根据上述记录叙述本次收杆及钓获。每段角力描写只对应一条已列出的钓获，按该条记录还原挣扎、收力和钓起的过程。':'请结合当前场景叙述本次收杆及钓获结果。');
    return lines.join('\n');
  };
  const hkmFishingSendReport = async () => {
    const session=state.fishing?.session;
    if(!session?.casts || hkmFishingReportSent(session))return false;
    const stat=await currentStat();hkm098AssertOwner();
    session.reportText ||= hkmFishingReportText(session,stat);
    saveFrontendState(state);queueSettleRecord(session.id,session.reportText);await hkm095Flush();
    try{await sendFrontendUserMessage(session.reportText,{action:'fishing_end',sessionId:session.id},{coveredSettlementIds:[session.id,...session.settlementIds]});}
    catch(error){if(error.messageCreated)hkmFishingClose();throw error;}
    return true;
  };
  const hkmFishingEnd = async () => {
    if(hkmFishingBusy || hkmFishingEnding)return;
    hkm098RequireAlive();hkmFishingEnding=true;
    try{
      if(state.fishing?.cast?.active){
        if(!hkmFishingEngine)throw Error('请先继续垂钓，再收杆。');
        await hkmFishingEngine.recall();
        if(state.fishing?.cast?.active)throw Error('收杆结算尚未完成，请重试。');
      }
      await hkmFishingSendReport();hkmFishingClose();
    }finally{hkmFishingEnding=false;}
  };
  const hkmCollectionDataPatch = stat => {
    const patch={},aliases=GAME_DATA.collectionAliases || {};
    const rename=name=>GAME_DATA.collectibles[aliases[name]]?.name || name;
    const bucket=value=>Object.entries(asObject(value)).reduce((out,[key,row])=>{
      const item=itemByName(row?.名称 || key);
      const nextName=rename(row?.名称 || key),nextKey=rename(key);
      const updated={...row,...(item && GAME_DATA.collectionUpdatedIds.includes(item.id)?{名称:nextName,稀有度:item.rarity,价值:item.value,重量:item.weight,描述:item.description}:{})};
      if(out[nextKey])updated.数量=HkmFishing.qty(out[nextKey])+HkmFishing.qty(updated);
      out[nextKey]=updated;return out;
    },{});
    for(const key of ['背包','安全屋']){
      const field=key==='背包'?'携带收藏品':'收藏品';
      if(stat[key])patch[key]={...stat[key],[field]:bucket(stat[key][field])};
    }
    for(const key of ['藏匿物','钥匙链','散落物品'])if(stat[key])patch[key]=bucket(stat[key]);
    if(stat.装备)patch.装备=Object.fromEntries(Object.entries(stat.装备).map(([key,name])=>[key,rename(name)]));
    return Object.fromEntries(Object.entries(patch).filter(([key,value])=>JSON.stringify(value)!==JSON.stringify(stat[key])));
  };
  const hkmFishingPreparePatch = (stat, patch, id = '', front = state) => {
    const dataPatch=hkmCollectionDataPatch({...stat,...patch});
    patch={...patch,...dataPatch};
    const next = {...stat,...patch};
    next.装备 = {...asObject(next.装备),特殊工具:next.装备?.特殊工具 || '无'};
    next.渔具状态 = HkmFishing.reconcile(next,GAME_DATA,/^search:/.test(id));
    const cast=state.fishing?.cast,snapshot=cast?.snapshot,rod=next.渔具状态.instances[cast?.rodUid];
    if(cast?.active && rod?.line && snapshot && !Object.hasOwn(patch,'渔具状态')){
      rod.line.durability=Math.min(rod.line.durability,snapshot.lineDurability*(Number(stat.渔具状态?.version || 1)<2?10:1));
      rod.line.wear=snapshot.standoffWearTime;
    }
    return {...patch,装备:next.装备,渔具状态:next.渔具状态,...hudDurableValuePatch(next,front)};
  };
  const hkmFishingSync = async stat => {
    if(hudReadOnly)return false;
    const patch=hkmFishingPreparePatch(stat,{});
    const keychain=hkmKeyPrunedChain(state.keychain);
    let after=JSON.stringify(keychain)!==JSON.stringify(state.keychain) ? {keychain}:{};
    if(Number(stat.渔具状态?.version || 1)<2 && state.fishing?.cast?.snapshot){
      const fishing=HkmFishing.copy(state.fishing),snap=fishing.cast.snapshot;
      snap.lineCapacity*=10;snap.lineDurability*=10;
      if(fishing.cast.wearDurability!==undefined)fishing.cast.wearDurability*=10;
      after={...after,fishing};
      const row=patch.渔具状态.instances[fishing.cast.rodUid];
      if(row?.line)row.line.durability=snap.lineDurability;
    }
    const cast=state.fishing?.cast;
    if(cast?.active && (HkmLifecycle.dead(stat) || cast.runId!==hkm098RunId(state.run) || stat.场景?.区域!==cast.area)){
      hkmFishingClose();
      await hkm098Transact('fishing-cancel:'+cast.id,patch,{fishing:{...state.fishing,cast:{...cast,active:false,snapshot:null}}});return true;
    }
    if(!Object.keys(after).length && Object.entries(patch).every(([key,value])=>JSON.stringify(value)===JSON.stringify(stat[key])))return false;
    await hkm098Transact((after.keychain ? 'key-maintenance:':'fishing-migrate:')+mvuMessageId()+':'+Date.now(),patch,after);
    return true;
  };
  const hkmFishingInstances = stat => Object.values(asObject(stat.渔具状态?.instances));
  const hkmFishingEquipped = stat => hkmFishingInstances(stat).find(row=>row.where==='装备:特殊工具');
  const hkmFishingEquip = async (name, stat, selectedUid) => {
    hkm098RequireAlive();
    const ledger=HkmLifecycle.copy(stat.渔具状态),item=itemByName(name);
    if(!GAME_DATA.fishing.allowedRodIds.includes(item?.id))throw Error('该收藏品不能装备到奇物栏。');
    const candidates=Object.values(ledger.instances).filter(row=>row.where==='背包' && row.itemId===item.id);
    const selected=candidates.find(row=>row.uid===selectedUid) || candidates[0];
    if(!selected)throw Error('背包里找不到这条鱼竿。');
    const bag=HkmLifecycle.copy(hudBucketOf(stat,'背包')),equipment={...asObject(stat.装备)};
    if(aiTakeBucket(bag,name,1)<1)throw Error('鱼竿数量不足。');
    const previous=Object.values(ledger.instances).find(row=>row.where==='装备:特殊工具');
    if(previous){aiGrantBucket(bag,itemById(previous.itemId),1);previous.where='背包';}
    else if(equipment.特殊工具 && equipment.特殊工具!=='无')aiGrantBucket(bag,itemByName(equipment.特殊工具),1);
    selected.where='装备:特殊工具';equipment.特殊工具=name;
    const bagBox={...asObject(stat.背包),携带收藏品:bag};
    await hkm098Transact('fishing-equip:'+Date.now()+':'+(++hkm095QueueSerial),{装备:equipment,背包:bagBox,渔具状态:ledger,主角:hudHeroStats(stat,equipment,bagBox)}, {}, '', 'gear');
    queueGearChange('特殊工具',name,stat);await refresh();setStatus('已装备'+name+'。');
  };
  const hkmFishingValid = stat => stat.场景?.地图==='魔鬼海' && GAME_DATA.fishing.areas.includes(stat.场景?.区域) && state.run?.map==='魔鬼海' && !hudInCombat(stat) && !HkmLifecycle.dead(stat);
  const hkmFishingGuard = stat => {
    hkm098RequireAlive();
    if(!hkmFishingValid(stat))throw Error('当前无法垂钓。');
    if(aiNum(stat.场景?.剩余交互轮数,0)<=0)throw Error('剩余交互轮数不足。');
  };
  const hkmFishingClose = () => {
    const wasPlaying=Boolean(hkmFishingEngine);
    hkmFishingEngine?.dispose();hkmFishingEngine=null;
    hkmFishingWindow?.remove();hkmFishingWindow=null;
    if(wasPlaying && !hkm098Busy && !hkmFishingBusy)void refresh().catch(error=>setStatus(error.message));
  };
  const hkmFishingPanel = (title, wide=false) => {
    hkmFishingClose();
    const mask=hudPromptMask(),panel=make('div','hkm-fishing-panel'+(wide?' hkm-fishing-wide':''));
    panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',title);
    const top=make('div','hkm-fishing-top'),close=make('button','hkm-reset-mini',wide?'暂离':'关闭');
    if(wide){const end=make('button','hkm-reset-mini','收杆');end.addEventListener('click',hudAction(hkmFishingEnd));top.append(end);}
    top.append(make('h3','',title),close);panel.append(top);mask.append(panel);hkmPortal.append(mask);hkmFishingWindow=mask;
    if(wide)panel.style.setProperty('--hkm-fishing-canvas-height',Math.max(120,Math.floor(hudVisibleBand().height*.95-200))+'px');
    close.addEventListener('click',()=>{if(!hkmFishingBusy)hkmFishingClose();});close.focus();
    return panel;
  };
  const hkmHookClaimsWindow=make('section','hkm-fishing-panel');
  hkmHookClaimsWindow.hidden=true;
  hkmHookClaimsWindow.setAttribute('role','region');
  hkmHookClaimsWindow.setAttribute('aria-label','鱼钩保险');
  Object.assign(hkmHookClaimsWindow.style,{position:'fixed',right:'16px',top:'110px',width:'300px',maxWidth:'calc(100vw - 32px)',maxHeight:'70vh',overflow:'auto',zIndex:'2147483000'});
  hkmPortal.append(hkmHookClaimsWindow);hkmOwnNodes(hkmHookClaimsWindow);
  let hkmHookClaimBusy=false;
  const hkmFishingResolveClaim = async (id,redeem) => {
    hkm098RequireAlive();
    if(hudReadOnly || hkmHookClaimBusy || hkmFishingBusy || HkmSave.pending())return;
    if(state.fishing?.cast?.active)throw Error('请先收杆，再处理鱼钩保险。');
    hkmHookClaimBusy=true;
    try{
      const stat=await currentStat(),ledger=HkmFishing.copy(HkmFishing.reconcile(stat,GAME_DATA));
      const claim=ledger.hookClaims?.[id];if(!claim)return;
      const patch={渔具状态:ledger};
      if(redeem){
        const item=itemById(claim.hook.itemId),price=Math.max(0,Number(claim.price)||0);
        if(!item)throw Error('找不到遗失的鱼钩。');
        if(aiMoney(stat)<price)throw Error('哈基币不足，赎回需要 '+price+' 哈基币。');
        const bag=HkmFishing.copy(hudBucketOf(stat,'背包'));aiGrantBucket(bag,item,1);
        patch.背包={...asObject(stat.背包),携带收藏品:bag};
        patch.统计信息={...asObject(stat.统计信息),哈基币:aiMoney(stat)-price};
        ledger.instances[claim.hook.uid]={...claim.hook,where:'背包'};
      }
      delete ledger.hookClaims[id];
      await hkm098Transact(id+':'+(redeem?'redeem':'abandon'),patch);
      currentStatSnapshot=null;
      hkmFishingRenderClaims({...stat,...patch});
      await refresh();setStatus(redeem?'鱼钩已赎回，放入背包。':'已放弃赎回该鱼钩。');
    }finally{hkmHookClaimBusy=false;}
  };
  const hkmFishingRenderClaims = stat => {
    clear(hkmHookClaimsWindow);
    const claims=Object.values(asObject(stat?.渔具状态?.hookClaims));
    hkmHookClaimsWindow.hidden=hudReadOnly || !claims.length;
    if(hkmHookClaimsWindow.hidden)return;
    hkmHookClaimsWindow.append(make('h3','hkm-reset-drag','鱼钩保险'));
    for(const claim of claims){
      const item=itemById(claim.hook.itemId);if(!item)continue;
      const card=make('div','hkm-fishing-part');
      const picture=GAME_DATA.itemPictures[item.id];
      if(picture){const image=hkmCreateElement('img');image.src=picture;image.alt=item.name;card.append(image);}
      card.append(make('strong','',item.name),make('span','',item.rarity+' · '+item.value+' 哈基币'),make('p','hkm-reset-small',item.description),make('p','','赎回价格：'+claim.price+' 哈基币'));
      for(const [label,redeem] of [['赎回',true],['放弃',false]]){
        const button=make('button','hkm-reset-mini',label);
        button.disabled=hkmHookClaimBusy || Boolean(state.fishing?.cast?.active) || HkmLifecycle.dead(stat);
        button.addEventListener('click',()=>hudConfirmDialog({title:redeem?'确认赎回鱼钩':'确认放弃鱼钩',note:redeem?'消耗 '+claim.price+' 哈基币赎回「'+item.name+'」？':'放弃后无法再赎回「'+item.name+'」。',confirmText:label,onConfirm:hudAction(()=>hkmFishingResolveClaim(claim.id,redeem))}));
        card.append(button);
      }
      hkmHookClaimsWindow.append(card);
    }
    hudMakeDraggable(hkmHookClaimsWindow,'hook-insurance');
  };

  const hkmFishingModify = async (uid, action, value) => {
    hkm098RequireAlive();
    if(hkmFishingBusy || state.fishing?.cast?.active)throw Error('请先结束当前垂钓。');
    hkmFishingBusy=true;
    try {
      const stat=await currentStat(),ledger=HkmFishing.copy(HkmFishing.reconcile(stat,GAME_DATA)),rod=ledger.instances[uid];
      if(!rod || !['背包','安全屋','装备:特殊工具'].includes(rod.where))throw Error('这条鱼竿已不在可装配位置。');
      const where=rod.where==='安全屋'?'安全屋':'背包',bag=HkmLifecycle.copy(hudBucketOf(stat,where));
      const patch={},item=itemById(rod.itemId);
      if(action==='bait') {
        if(value && value!=='COL-0039')throw Error('无法装配该饵料。');
        if(value && !Object.values(bag).some(row=>row.名称===itemById(value).name && HkmFishing.qty(row)>0))throw Error('当前没有饵料。');
        rod.baitId=value || null;
      } else if(action==='line' || action==='hook') {
        const selected=value ? ledger.instances[value]:null;
        if(value && (!selected || selected.where!==where || itemById(selected.itemId)?.fishingGear?.type!==action))throw Error('零部件已变化。');
        if(action==='line' && selected && (!(Number(selected.durability)>0) || selected.broken===true))throw Error('这根鱼线已不可用，请更换鱼线。');
        const previous=rod[action];
        if(selected) {
          if(aiTakeBucket(bag,itemById(selected.itemId).name,1)<1)throw Error('零部件数量不足。');
          delete ledger.instances[selected.uid];rod[action]={...selected};delete rod[action].where;
        } else rod[action]=null;
        if(previous && (action!=='line' || previous.durability>0)) {
          aiGrantBucket(bag,itemById(previous.itemId),1);
          ledger.instances[previous.uid]={...previous,where};
        }
      } else throw Error('无效操作。');
      if(where==='安全屋')patch.安全屋={...asObject(stat.安全屋),收藏品:bag};
      else {patch.背包={...asObject(stat.背包),携带收藏品:bag};patch.主角=hudBurdenPatch(stat,patch.背包);}
      patch.渔具状态=ledger;
      await hkm098Transact('fishing-mod:'+Date.now()+':'+(++hkm095QueueSerial),patch,{},'',rod.where==='装备:特殊工具' ? 'gear' : '');
      currentStatSnapshot=null;await refresh();
      await hkmFishingOpenMods(item.name,rod.where==='装备:特殊工具'?'装备':where,uid);
    } finally {hkmFishingBusy=false;}
  };
  const hkmFishingOpenMods = async (name, where, selectedUid) => {
    if(hudReadOnly)return;
    if(state.fishing?.cast?.active)throw Error('请先结束当前垂钓。');
    const stat=await currentStat(),item=itemByName(name);
    const rows=hkmFishingInstances(stat).filter(row=>row.itemId===item?.id && row.where===(where==='装备'?'装备:特殊工具':where));
    const rod=rows.find(row=>row.uid===selectedUid) || rows[0];if(!rod)throw Error('找不到这条鱼竿。');
    const panel=hkmFishingPanel('渔具装配'),whereItems=rod.where==='安全屋'?'安全屋':'背包';
    if(rows.length>1){const select=hkmCreateElement('select');rows.forEach((row,index)=>{const option=hkmCreateElement('option');option.value=row.uid;option.textContent='鱼竿 '+(index+1);select.append(option);});select.value=rod.uid;select.addEventListener('change',hudAction(()=>hkmFishingOpenMods(name,where,select.value)));panel.append(select);}
    const head=make('div','hkm-fishing-rod');
    const picture=GAME_DATA.itemPictures[item.id];if(picture){const img=hkmCreateElement('img');img.src=picture;img.alt=item.name;head.append(img);}
    head.append(make('strong','',item.name),make('span','',item.rarity));panel.append(head);
    const grid=make('div','hkm-fishing-parts');
    for(const [type,label]of [['line','鱼线'],['hook','鱼钩'],['bait','饵料']]){
      const cell=make('div','hkm-fishing-part');cell.append(make('b','',label));
      const component=type==='bait'?itemById(rod.baitId):itemById(rod[type]?.itemId);
      const image=component && GAME_DATA.itemPictures[component.id];if(image){const img=hkmCreateElement('img');img.src=image;img.alt=component.name;cell.append(img);}
      cell.append(make('span','',component?.name || '空槽'));
      const select=hkmCreateElement('select'),emptyOption=hkmCreateElement('option');emptyOption.value='';emptyOption.textContent='卸下';select.append(emptyOption);
      if(type==='bait'){
        const count=Object.values(hudBucketOf(stat,whereItems)).filter(row=>row.名称==='一份精液').reduce((n,row)=>n+HkmFishing.qty(row),0);
        if(count){const option=hkmCreateElement('option');option.value='COL-0039';option.textContent='一份精液 ×'+count;select.append(option);}
      }else for(const row of hkmFishingInstances(stat).filter(row=>row.where===whereItems && itemById(row.itemId)?.fishingGear?.type===type && (type!=='line' || (Number(row.durability)>0 && row.broken!==true)))){
        const option=hkmCreateElement('option');option.value=row.uid;option.textContent=itemById(row.itemId).name+(type==='line'?' · 耐久 '+row.durability:'');select.append(option);
      }
      const equip=make('button','hkm-reset-mini','装配');equip.addEventListener('click',hudAction(()=>hkmFishingModify(rod.uid,type,select.value)));cell.append(select,equip);grid.append(cell);
    }
    panel.append(grid);
    const line=itemById(rod.line?.itemId)?.fishingGear,hook=itemById(rod.hook?.itemId)?.fishingGear;
    for(const [label,value,max,unit]of [['钓鱼力量',HkmFishing.power(GAME_DATA,rod,stat),Math.max(38,HkmFishing.power(GAME_DATA,rod,stat)),''],['最大鱼线长度',line?.maxLengthPx || 0,440,' px'],['最大下钩深度',hook?.maxDepthPercent || 0,100,'%'],['鱼线耐久',rod.line?.durability || 0,line?.maxDurability || 1,''],['成功耗损',line?.wearPerSuccess || 0,16,''],['连续僵持上限',(rod.line?.durability || 0)*.001+(line?.standoffBonusSeconds || 0),4,' s']]){
      const bar=make('div','hkm-fishing-stat');bar.append(make('span','',label),make('b','',Number(value.toFixed(2))+unit));const track=hkmCreateElement('progress');track.max=max;track.value=value;bar.append(track);panel.append(bar);
    }
    panel.append(make('p','hkm-reset-small',hook?.effectText || '未装配鱼钩。'));
  };
  const hkmFishingPersistGame = snapshot => {
    hkm098AssertOwner();
    if(!state.fishing?.cast?.active)return;
    state.fishing.cast.snapshot=snapshot;
    const rod=currentStatSnapshot && hkmFishingEquipped(currentStatSnapshot);
    if(rod?.line && snapshot.lineDurability<rod.line.durability) {
      state.fishing.cast.wearDurability=snapshot.lineDurability;
    }
    saveFrontendState(state);
  };
  const hkmFishingFinish = async (success, hidden, durability, wear, broken, fightRecord = null, hasHit = false, recalled = false) => {
    hkm098RequireAlive();
    const cast=state.fishing?.cast;if(!cast?.active || hkmFishingBusy)return;
    hkmFishingBusy=true;
    try {
      const stat=await currentStat();
      if(hkm098RunId(state.run)!==cast.runId || stat.场景?.区域!==cast.area)throw Error('对局或区域已变化。');
      broken=broken || cast.snapshot?.lineBroken===true;
      const ledger=HkmFishing.copy(stat.渔具状态),rod=ledger.instances[cast.rodUid];
      if(!rod || (!rod.line && !broken && durability>0) || (rod.line && cast.lineUid && rod.line.uid!==cast.lineUid))throw Error('当前鱼线已变化。');
      const hook=rod.hook,patch={},front=HkmLifecycle.copy(state.fishing),rewards=[];
      let run=HkmLifecycle.copy(state.run),aiLog=HkmLifecycle.copy(state.aiLog),soundLog=HkmLifecycle.copy(state.insuranceLog);
      if(rod.line){
        rod.line.durability=Math.max(0,durability);rod.line.wear=wear;delete rod.line.broken;
      }
      if(broken && hook && itemById(rod.itemId)?.fishingGear?.hookInsurance){
        ledger.hookClaims ||= {};
        const claimId=cast.id+':hook';
        ledger.hookClaims[claimId] ||= {id:claimId,hook:HkmFishing.copy(hook),price:itemById(hook.itemId).value};
      }
      if(broken)rod.hook=null;
      const target=hidden?.uid ? cast.targets[hidden.uid]:null;
      if(success && !target)throw Error('垂钓目标记录缺失。');
      const missed=!success && !broken && !hasHit && !hidden && !cast.snapshot?.hasHit && !cast.snapshot?.target && !cast.snapshot?.fightRecord;
      const recalledEmpty=recalled===true && missed;
      const baitRefund=missed && cast.baitConsumed===true && itemById(rod.itemId)?.fishingGear?.refundMissedBait;
      if(baitRefund)Object.assign(patch,hudExchangePatch(stat,[],[resultOf(itemById(cast.baitId || 'COL-0039'),1,'空军回响')],'背包'));
      const stats={...asObject(stat.统计信息)};
      if(success){
        const effect=HkmFishing.hookBonus(GAME_DATA,hook,target);stats.哈基币=aiMoney(stat)+effect.coins;rewards.push(...effect.items);
        if(['奇异','至宝','神秘'].includes(target.rarity)){const key='钓到'+target.rarity+'鱼总数';stats[key]=aiNum(stats[key],0)+1;}
        if(target.type==='collectible')rewards.unshift({itemId:target.itemId,quantity:1});
        else{
          const monster=GAME_DATA.fishing.monsters.find(row=>row.id===target.monsterId),id=cast.id+':'+target.uid;
          run.npcs ||= [];
          run.npcs.push({id,name:monster.name+'·'+target.uid,region:cast.area,faction:'海怪',attitude:'敌对',kind:target.rarity+'海怪',threat:5,hp:monster.hp,maxHp:monster.hp,attack:monster.attack,defense:monster.defense,speed:monster.speed,desc:monster.description,fishingMonster:true,dropEntries:target.drops});
          const enemies={...asObject(stat.敌人)},npc=run.npcs[run.npcs.length-1];enemies[npc.name]=aiNpcRecord(npc);patch.敌人=enemies;patch.场景={...asObject(stat.场景),是否战斗中:true};
        }
        if(rewards.length)Object.assign(patch,hudExchangePatch(stat,[],rewards.map(row=>resultOf(itemById(row.itemId),row.quantity,'垂钓')),'背包'));
        patch.统计信息=stats;
      }
      patch.渔具状态=ledger;
      const roundCost=cast.roundPolicy==='interruption' && (broken || (success && target.type==='monster')) ? 1 : 0;
      if(roundCost){
        const scene={...asObject(stat.场景),...asObject(patch.场景),剩余交互轮数:String(Math.max(0,aiNum(stat.场景?.剩余交互轮数,0)-roundCost))};
        run.rounds=aiNum(scene.剩余交互轮数,0);
        const prior=HkmLifecycle.copy(state);
        saveFrontendState.drafting=true;
        try{
          state.run=run;
          const resolved=aiResolveTurn('魔鬼海',{mode:'fishing',area:cast.area,heroFrom:cast.area,heroTo:cast.area,stat:{...stat,...patch,场景:scene}});
          Object.assign(patch,aiEnemyPatch('魔鬼海',cast.area,{...stat,...patch,场景:scene}));
          if(resolved.scatter)patch.散落物品=resolved.scatter;
          Object.assign(patch,resolved.heroPatch || {});
          run=HkmLifecycle.copy(state.run);aiLog=HkmLifecycle.copy(state.aiLog);soundLog=HkmLifecycle.copy(state.insuranceLog);
        }finally{for(const key of Object.keys(state))delete state[key];Object.assign(state,prior);saveFrontendState.drafting=false;}
        patch.场景=scene;
      }
      front.cast={...front.cast,active:false,settled:true,outcome:success?'success':broken?'broken':recalledEmpty?'recalled':'lost',snapshot:null};
      const id=cast.id+':finish',log=(success?(target.type==='monster'?'钓起海怪，进入战斗。':'垂钓成功：'+rewards.map(row=>itemById(row.itemId).name+'×'+row.quantity).join('、')):(broken?'鱼线崩断，鱼钩遗失。':'浮标已收回，未获得收藏品。'+(baitRefund?'空军回响返还鱼饵。':'')))+(roundCost?'交互轮数 −1 · '+run.rounds+'/35。':'');
      front.session ||= hkmFishingNewSession(cast);
      const fishingRow={id,success,broken,recalled:recalledEmpty,rarity:target?.rarity || '',primaryId:target?.itemId || null,monsterId:target?.monsterId || null,rewards,coins:success ? stats.哈基币-aiMoney(stat):0,roundCost,fight:success && ['奇异','至宝','神秘'].includes(target?.rarity) && fightRecord?.uid===target.uid ? HkmFishing.copy(fightRecord):null};
      front.session.rows.push(fishingRow);
      front.session.settlementIds.push(id);
      await hkm098Transact(id,patch,{run,fishing:front,aiLog,insuranceLog:soundLog,achievements:HkmAchievements.observeFishing(state.achievements,fishingRow)});
      hkmFishingRenderClaims({...stat,...patch});
      if(success && target.type==='monster')hkmFishingClose();
      else hkmFishingEngine?.settle(success,durability,wear,broken);
      currentStatSnapshot=null;await refresh();setStatus(log);
      if(success && target.type==='monster')await hkmFishingSendReport();
    } finally {hkmFishingBusy=false;}
  };
  const hkmFishingOpen = async () => {
    const stat=await currentStat();hkmFishingGuard(stat);
    const rod=hkmFishingEquipped(stat);if(!rod)throw Error('请先把鱼竿装备到奇物栏。');
    const panel=hkmFishingPanel('深水战术垂钓',true),body=make('div','hkm-fishing-game');panel.append(body);
    const initial=state.fishing?.cast?.active ? state.fishing.cast.snapshot:null;
    const line=itemById(rod.line?.itemId)?.fishingGear;
    if(!line || (!initial && (!rod.hook || !rod.baitId || rod.line.durability<=0))){panel.append(make('p','','请先装配可用鱼线、鱼钩和饵料。'));const button=make('button','hkm-reset-mini','渔具装配');button.addEventListener('click',hudAction(()=>hkmFishingOpenMods(itemById(rod.itemId).name,'装备',rod.uid)));panel.append(button);return;}
    const gearButton=make('button','hkm-reset-mini','渔具装配');panel.append(gearButton);
    gearButton.disabled=Boolean(state.fishing?.cast?.active);gearButton.addEventListener('click',hudAction(()=>hkmFishingOpenMods(itemById(rod.itemId).name,'装备',rod.uid)));
    const config={depth:itemById(rod.hook?.itemId)?.fishingGear.maxDepthPercent || 50,line:line.maxLengthPx,power:HkmFishing.power(GAME_DATA,rod,stat),durability:line.maxDurability,currentDurability:rod.line.durability,wear:rod.line.wear,wearPerSuccess:line.wearPerSuccess,standoffBonus:line.standoffBonusSeconds};
    const shoalTargets=HkmFishing.copy(state.fishing?.cast?.active ? state.fishing.cast.targets:{});
    const shoalId=Date.now()+'-'+(++hkm095QueueSerial);let shoalSerial=0;
    const ensureCast=async()=>{
      if(hkmFishingBusy || hkmFishingEnding)return false;
      if(state.fishing?.cast?.active)return true;
      hkmFishingBusy=true;
      try{
        const live=await currentStat();hkmFishingGuard(live);
        const current=hkmFishingEquipped(live);if(!current || current.uid!==rod.uid || !current.line || current.line.durability<=0 || !current.hook || current.baitId!=='COL-0039')throw Error('渔具已变化，请重新打开。');
        const bag=HkmLifecycle.copy(hudBucketOf(live,'背包'));
        if(!Object.values(bag).some(row=>row.名称==='一份精液' && HkmFishing.qty(row)>0))throw Error('饵料不足，需要一份精液。');
        const baitConsumed=!(Math.random()<Number(itemById(current.itemId)?.fishingGear?.baitSaveChance || 0));
        if(baitConsumed && aiTakeBucket(bag,'一份精液',1)<1)throw Error('饵料不足，需要一份精液。');
        const run=HkmLifecycle.copy(state.run);
        const front={...asObject(state.fishing),serial:aiNum(state.fishing?.serial,0)+1};
        if(front.session?.reportText && !hkmFishingReportSent(front.session))throw Error('收杆汇总尚未发送，请点击收杆重试。');
        front.session=!front.session || hkmFishingReportSent(front.session) ? hkmFishingNewSession():HkmFishing.copy(front.session);
        front.session.casts++;
        const id='fishing:'+hkm098RunId(run)+':'+front.serial;
        const visible=new Set(hkmFishingEngine.targets());
        for(const uid of Object.keys(shoalTargets))if(!visible.has(uid))delete shoalTargets[uid];
        front.cast={id,active:true,runId:hkm098RunId(run),area:live.场景.区域,rodUid:rod.uid,lineUid:current.line.uid,baitId:current.baitId,baitConsumed,roundPolicy:'interruption',targets:HkmFishing.copy(shoalTargets),targetSerial:0,snapshot:null};
        front.session.settlementIds.push(id+':cast');
        await hkm098Transact(id+':cast',{背包:{...asObject(live.背包),携带收藏品:bag}},{fishing:front});
        gearButton.disabled=true;hkmFishingRenderClaims(live);await refresh();return true;
      }finally{hkmFishingBusy=false;}
    };
    hkmFishingEngine=HkmFishingGame(body,{
      config,
      authorize:ensureCast,
      generate:()=>{
        hkm098AssertOwner();
        const target=HkmFishing.rollTarget(GAME_DATA,'魔鬼海',shoalId+'-'+(++shoalSerial));
        shoalTargets[target.uid]=target;
        const cast=state.fishing?.cast;
        if(cast?.active){cast.targets[target.uid]=target;cast.targetSerial++;}
        return {uid:target.uid,rarity:target.rarity};
      },
      snapshot:hkmFishingPersistGame,
      restore:initial,
      finish:async(...args)=>{try{await hkmFishingFinish(...args);}finally{if(panel.isConnected && !state.fishing?.cast?.active)gearButton.disabled=false;}},
      guard:()=>{try{hkm098AssertOwner();return !hkmFishingEnding && hkmFishingValid(currentStatSnapshot) && !HkmSave.pending();}catch(_){return false;}},
      error:error=>setStatus(error.message),
    });
  };
  const hkmFishingCollectKills = async stat => {
    if(!state.run || hudReadOnly)return false;
    const run=HkmLifecycle.copy(state.run);let changed=false;
    for(const row of hudLatestAssistantTexts()){
      if(row.id<=aiNum(run.startMessageId,-1))continue;
      for(const tag of row.text.matchAll(/<HkmKillBox\b([^>]{1,300})\/?\s*>/g)){
        const attrs=Object.fromEntries([...tag[1].matchAll(/(name|killer|area)="([^"]{1,80})"/g)].map(match=>[match[1],match[2]]));
        const area=attrs.area || stat.场景?.区域;
        const player=run.players?.find(p=>p.name===attrs.name && p.region===area),npc=run.npcs?.find(p=>p.name===attrs.name && p.region===area);
        const dead=Object.values(asObject(run.fishingDead)).find(p=>p.name===attrs.name && p.region===area && p.deathFloor===row.id);
        const victim=player || npc || dead;
        if(!victim || aiNum(victim.hp,1)>0 || (player && player.alive!==false))continue;
        const killer=['主角',stat.主角?.姓名].includes(attrs.killer)?'hero':run.players?.find(p=>p.name===attrs.killer)?.id;
        if(HkmFishing.recordKill(run,victim.id,killer,Boolean(player)))changed=true;
      }
    }
    if(!changed)return false;
    await hkm098Transact('fishing-kills:'+Date.now()+':'+(++hkm095QueueSerial),{},{run});return true;
  };
  const hkmFishingDropDeaths = async stat => {
    const pending=Object.values(asObject(state.run?.fishingDead)).filter(row=>row.fishingMonster && !row.dropped);
    if(!pending.length || hudReadOnly)return false;
    const run=HkmLifecycle.copy(state.run),scatter=HkmLifecycle.copy(asObject(stat.散落物品));
    for(const npc of pending){for(const row of npc.dropEntries)hudScatterMerge(scatter,run.map,npc.region,itemById(row.itemId),row.quantity);run.fishingDead[npc.id].dropped=true;}
    await hkm098Transact('fishing-drops:'+pending.map(npc=>npc.id).join(','),{散落物品:scatter},{run},'海怪掉落已放在死亡区域地面。');return true;
  };
  const hkmFishingDeath = (npc,killer) => {
    const run=state.run;if(!run)return;
    run.fishingDead ||= {};run.fishingDead[npc.id]={...HkmLifecycle.copy(npc),hp:0,deathFloor:mvuMessageId()};
    if(killer)HkmFishing.recordKill(run,npc.id,killer,false);
  };
  const hkmFishingEntry = stat => {
    const rows=HkmFishing.violations({...stat,钥匙链:state.keychain},GAME_DATA);
    if(rows.length)throw Error('违禁品：'+rows.map(row=>row.name+' ×'+row.quantity+'（'+row.where+'）：'+row.reason).join('；'));
  };
  const hkmFishingControlGuard = event => {
    if(!state.fishing?.cast?.active || hkm098Locked() || event.target?.closest?.('.hkm-fishing-panel,.hkm-fishing-entry,.hkm-life-dialog,.hkm-tutorial-mask'))return;
    const target=event.target;
    if(target?.closest?.('.hkm-save-ui'))return;
    if(hkmOwnTarget(target) || target?.closest?.('#send_but,#send_textarea')){event.preventDefault();event.stopImmediatePropagation();setStatus('请先继续垂钓并收回浮标，或结束角力。');}
  };
  for(const type of ['click','submit','keydown']){
    document.addEventListener(type,hkmFishingControlGuard,true);
    try{window.parent.document.addEventListener(type,hkmFishingControlGuard,true);}catch(_){}
    disposers.push(()=>{document.removeEventListener(type,hkmFishingControlGuard,true);try{window.parent.document.removeEventListener(type,hkmFishingControlGuard,true);}catch(_){}});
  }
  disposers.push(hkmFishingClose);

  let hkm098Refreshing = false, hkm098RefreshQueued = false, hkm098RefreshTimer = null;
  const refresh = async () => {
    if(disposed || !env.isCurrent())return;
    if(HkmSave.pending())return;
    if (hkm098Refreshing) { hkm098RefreshQueued = true; return; }
    hkm098Refreshing = true;
    try { await hkm098RefreshBody(); }
    finally {
      hkm098Refreshing = false;
      if(disposed)return;
      if (currentStatSnapshot && !hkm098Busy) hkm140BagSync(currentStatSnapshot);
      hkm103ScheduleSave();
      if (hkm098RefreshQueued || (!currentStatSnapshot && !hkm098Busy)) {
        hkm098RefreshQueued = false;
        clearTimeout(hkm098RefreshTimer);
        hkm098RefreshTimer = setTimeout(() => refresh().catch(e=>setStatus(e.message)), 0);
      }
    }
  };
  disposers.push(() => clearTimeout(hkm098RefreshTimer));
  const hkm103SaveUI=HkmSave.mount({
    dispose:fn=>disposers.push(fn),
    writable:()=>!hudReadOnly && !hkmTurnLocked() && isLatestHudLayer() && HkmSave.identity()===hkm103Scope,
    capture:async()=>{
      hkm098AssertOwner();
      if(hkm098Busy || hkm098Refreshing || searchBusy || moveBusy || launchBusy || purchaseBusy || specialBusy || state.lifecycleJournal?.phase==='prepared')throw Error('游戏正在处理操作，请完成后再保存。');
      const stat=await currentStat();hkm098AssertOwner();
      const save=HkmSave.capture(stat);HkmSave.rememberProfile(save);return save;
    },
    apply:async save=>{
      hkm098AssertOwner(true);
      if(hkm098Busy || hkm098Refreshing || searchBusy || moveBusy || launchBusy || purchaseBusy || specialBusy || state.lifecycleJournal?.phase==='prepared')throw Error('游戏正在处理操作，请完成后再读档。');
      hkm098Busy=true;
      try {
        await hkm099WriteTail;
        await HkmSave.restore(save,{scope:hkm103Scope,target:mvuMessageId(),check:()=>hkm098AssertOwner(true)});
        const next=readFrontendState();for(const k of Object.keys(state))delete state[k];Object.assign(state,next);
        currentStatSnapshot=null;hkm103AutoSignature='';hkm098CloseDeath();
        try {window.parent?.[nativeHookKey]?.destroy?.();}catch(_){}
        installNativeQuestInterceptor();
      } finally {hkm098Busy=false;}
      await refresh();
    }
  });
  const hkm103AutoInterval=setInterval(hkm103ScheduleSave,5000);
  disposers.push(()=>{clearTimeout(hkm103AutoTimer);clearInterval(hkm103AutoInterval);});
  const waitForVariables = async () => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 750));
      const stat = await currentStat();
      if (Object.keys(asObject(stat)).length) {
        await refresh();
        return true;
      }
    }
    return false;
  };

  try {
    await refresh();
    if(disposed)return;
    if (!Object.keys(asObject(currentStatSnapshot)).length) {
      setStatus('正在等待开局变量就绪（网络慢时 MVU 与变量结构脚本要下载一会儿）…');
      waitForVariables().then(ok => {
        if (!ok) setStatus('还没读到开局变量：请确认“MVU 变量系统 / Zod Schema”两个脚本已加载，或重新开局一次。');
      }).catch(() => {});
    }
    if (typeof eventOn === 'function' && typeof waitGlobalInitialized === 'function') {
      try {
        await waitGlobalInitialized('Mvu');
        if(disposed)return;
        const names = [globalThis.Mvu?.events?.VARIABLE_INITIALIZED, globalThis.Mvu?.events?.VARIABLE_UPDATE_ENDED]
          .filter((name, index, list) => typeof name === 'string' && list.indexOf(name) === index);
        for (const eventName of names) {
          const stop = eventOn(eventName, refresh);
          if (typeof stop === 'function') disposers.push(stop);
          else if (stop && typeof stop.stop === 'function') disposers.push(() => stop.stop());
        }
      } catch (_) {}
    }
  } catch (error) {
    setStatus(`HUD读取失败：${error?.message || error}`);
  }
})();
  ready.catch(error=>{if(!disposed && env.isCurrent())env.report(error);});
  return {ready,dispose,get disposed(){return disposed;}};
}
