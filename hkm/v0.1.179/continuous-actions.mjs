export const HkmContinuous = (() => {
  const limit = 4;
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : fallback;
  const normalizeConfig = raw => {
    const value = object(raw);
    return {threshold:integer(value.threshold ?? 4,4),autoAttack:value.autoAttack === true,allowBeg:value.allowBeg === true};
  };
  const shouldInterruptThreat = (config, threat) => {
    const value = normalizeConfig(config);
    return value.threshold < 6 && Number.isFinite(Number(threat)) && Number(threat) >= value.threshold;
  };
  const action = raw => {
    const value = object(raw);
    if (typeof value.id !== 'string' || !value.id.trim()) throw Error('连续行动缺少操作编号。');
    if (!['move','search'].includes(value.kind)) throw Error('连续行动只支持移动或搜索。');
    if (typeof value.text !== 'string') throw Error('连续行动日志必须是文本。');
    if (value.rawInstruction !== undefined && typeof value.rawInstruction !== 'string') throw Error('原始指令必须是文本。');
    return {id:value.id,kind:value.kind,text:value.text,rawInstruction:value.rawInstruction ?? '',interrupted:value.interrupted === true};
  };
  const normalize = raw => {
    const value = object(raw),logs = [],seen = new Set();
    if (value.logs !== undefined && !Array.isArray(value.logs)) throw Error('连续行动日志格式无效。');
    for (const entry of value.logs || []) {
      const row = action(entry);
      if (seen.has(row.id)) continue;
      if (logs.length >= limit) throw Error('连续行动最多累计四次。');
      seen.add(row.id);logs.push(row);
    }
    const map = typeof value.map === 'string' ? value.map : '';
    const runId = typeof value.runId === 'string' ? value.runId : '';
    const floor = Number.isInteger(value.floor) && value.floor >= 0 ? value.floor : null;
    if (value.active === true && (!map.trim() || !runId.trim() || floor === null)) throw Error('连续行动的对局或消息楼层无效。');
    const revision = Math.max(logs.length,integer(value.revision,logs.length));
    return {version:1,map,runId,floor,active:value.active === true,logs,count:logs.length,revision,
      sealed:value.sealed === true || logs.length >= limit || logs.some(row=>row.interrupted),ended:value.ended === true};
  };
  const begin = ({map,runId,floor} = {}) => normalize({map,runId,floor,active:true});
  const canAct = raw => {
    const session = normalize(raw);
    return session.active && !session.sealed && session.count < limit;
  };
  const append = (raw, entry) => {
    const session = normalize(raw),row = action(entry);
    if (session.logs.some(existing=>existing.id === row.id)) return session;
    if (!canAct(session)) throw Error('当前连续行动已停止，不能继续操作。');
    return normalize({...session,logs:[...session.logs,row],revision:session.revision+1});
  };
  const seal = raw => {
    const session = normalize(raw);
    return session.active && session.count ? {...session,sealed:true} : session;
  };
  const shouldSend = (raw, {manual = false} = {}) => {
    const session = normalize(raw);
    return session.active && session.count > 0 && (session.sealed || manual === true);
  };
  const format = (raw, {includeInstructions = true} = {}) => normalize(raw).logs.map(row=>[row.text,...(includeInstructions ? [row.rawInstruction] : [])].filter(value=>value !== '').join('\n')).join('\n\n');
  const instructions = raw => normalize(raw).logs.map(row=>row.rawInstruction).filter(value=>value !== '');
  const archive = raw => normalize(raw);
  const key = session => JSON.stringify([session.map,session.runId,session.floor]);
  const signature = session => JSON.stringify([key(session),session.revision,session.logs]);
  const receipt = raw => {
    const session = normalize(raw);
    if (!session.active || !session.count) return null;
    return {key:key(session),revision:session.revision,signature:signature(session),actionIds:session.logs.map(row=>row.id),count:session.count,text:format(session),snapshot:archive(session)};
  };
  const ack = (raw, sentReceipt, evidence = {}) => {
    const session = normalize(raw),sent = object(sentReceipt),proof = object(evidence);
    if (!session.active || !session.count || !(proof.created === true || proof.messageCreated === true)) return session;
    if (sent.key !== key(session) || sent.revision !== session.revision || sent.signature !== signature(session)) return session;
    if (sent.count !== session.count || sent.text !== format(session) || JSON.stringify(sent.actionIds) !== JSON.stringify(session.logs.map(row=>row.id))) return session;
    return normalize({...session,active:false,logs:[],sealed:false,ended:true});
  };
  return {limit,normalizeConfig,shouldInterruptThreat,normalize,begin,append,seal,canAct,shouldSend,format,instructions,receipt,ack,archive};
})();
