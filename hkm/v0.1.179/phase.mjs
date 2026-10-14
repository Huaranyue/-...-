export const HkmPhase = (() => {
  const itemId = 'COL-0259';
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const integer = value => Number.isFinite(Number(value)) ? Math.max(0,Math.floor(Number(value))) : 0;
  const identity = run => run ? String(run.id || String(run.map)+':'+String(run.startedAt)) : '';
  const initial = run => ({version:1,runId:identity(run),points:1,seen:Object.fromEntries(Object.keys(object(run?.fishingKills?.seen)).map(key=>[key,true]))});
  const normalize = run => {
    if (!run || run.ended === true) return {version:1,runId:'',points:0,seen:{}};
    const raw=object(run.phase),runId=identity(run);
    if (raw.version !== 1 || raw.runId !== runId) return initial(run);
    return {version:1,runId,points:integer(raw.points),seen:Object.fromEntries(Object.entries(object(raw.seen)).filter(([key,value])=>key && value===true))};
  };
  const ensure = run => {
    if (!run || run.ended === true) return false;
    const next=normalize(run),changed=JSON.stringify(run.phase)!==JSON.stringify(next);
    run.phase=next;
    return changed;
  };
  const begin = run => {if(run)run.phase=initial({...run,fishingKills:{}});return run?.phase || null;};
  const points = run => normalize(run).points;
  const reward = (run,{victim,killer,player=false}={}) => {
    if (!run || run.ended === true || killer !== 'hero' || player !== true || !victim || !(run.players || []).some(row=>row.id===victim)) return {awarded:false};
    ensure(run);
    if (run.phase.seen[victim]===true) return {awarded:false};
    run.phase.seen[victim]=true;
    run.phase.points++;
    return {awarded:true,points:run.phase.points,line:'击杀一名玩家，获得1点相位点数，当前'+run.phase.points+'点。'};
  };
  const positions = map => (Array.isArray(map?.grid)?map.grid:[]).flatMap((row,y)=>(Array.isArray(row)?row:[]).flatMap((cell,x)=>{
    const area=typeof cell==='string'?cell:cell?.name || cell?.area;
    return area?[{area,x,y}]:[];
  }));
  const destinations = (map,from) => {
    const all=positions(map),origin=all.find(row=>row.area===from);
    if(!origin)return [];
    return all.filter(row=>row.area!==from && Math.abs(row.x-origin.x)<=2 && Math.abs(row.y-origin.y)<=2);
  };
  const hasInstrument = (stat,resolve) => {
    const matches = value => typeof value==='string' && (value===itemId || resolve(value)?.id===itemId);
    if(Object.values(object(stat?.装备?.奇物)).some(matches) || matches(stat?.装备?.特殊工具))return true;
    return Object.entries(object(stat?.背包?.携带收藏品)).some(([key,row])=>integer(row?.数量 ?? row?.quantity)>0 && (matches(key) || matches(row?.名称 ?? row?.name) || row?.id===itemId || row?.itemId===itemId));
  };
  const consume = (run,{map,from,target}={}) => {
    if(!run || run.ended===true)throw Error('请先进入对局。');
    if(!destinations(map,from).some(row=>row.area===target))throw Error('相位传送目标必须在周围两格内。');
    ensure(run);
    if(run.phase.points<1)throw Error('相位点数不足。');
    run.phase.points--;
    return {from,to:target,points:run.phase.points,line:'相位传送仪从'+from+'传送至'+target+'，消耗1点相位点数，剩余'+run.phase.points+'点。'};
  };
  return {itemId,identity,initial,normalize,ensure,begin,points,reward,positions,destinations,hasInstrument,consume};
})();

export function createPhasePanel({document,portal,createMask,valid=()=>true,describe=()=>''}={}) {
  let pending=null;
  const close = target => {
    const ticket=pending;
    if(!ticket)return;
    pending=null;ticket.mask.remove();document.removeEventListener('keydown',ticket.keydown,true);
    if(ticket.origin?.isConnected)ticket.origin.focus();
    ticket.resolve(target);
  };
  const choose = ({map,from,points}={}) => {
    if(pending)return Promise.resolve(null);
    const candidates=HkmPhase.destinations(map,from),origin=HkmPhase.positions(map).find(row=>row.area===from);
    if(!origin || !candidates.length)throw Error('周围两格内没有可传送区域。');
    return new Promise(resolve=>{
      const mask=createMask?createMask():document.createElement('div');mask.classList.add('hkm-reset-prompt-mask');
      const box=document.createElement('section');box.className='hkm-reset-prompt hkm-phase-panel';box.style.width='min(680px,94vw)';
      box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','相位传送面板');
      const title=document.createElement('h2');title.className='hkm-reset-prompt-title';title.textContent='相位传送仪 · '+points+'点';
      const grid=document.createElement('div');grid.className='hkm-phase-grid';grid.style.cssText='display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px';
      for(let y=origin.y-2;y<=origin.y+2;y++)for(let x=origin.x-2;x<=origin.x+2;x++){
        const cell=HkmPhase.positions(map).find(row=>row.x===x && row.y===y),button=document.createElement('button');
        button.type='button';button.className='hkm-reset-mini';button.style.cssText='white-space:normal;min-height:54px';
        button.textContent=cell?.area || '—';button.disabled=!cell || cell.area===from || points<1;
        if(cell){button.setAttribute('aria-label','传送至'+cell.area);button.title=cell.area===from?'当前区域':describe(cell.area);button.dataset.area=cell.area;}
        button.addEventListener('click',()=>{if(!button.disabled && valid())close(cell.area);});grid.append(button);
      }
      const actions=document.createElement('div');actions.className='hkm-reset-prompt-actions';
      const cancel=document.createElement('button');cancel.type='button';cancel.className='hkm-reset-mini';cancel.textContent='取消';cancel.addEventListener('click',()=>close(null));actions.append(cancel);
      const keydown=event=>{
        if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close(null);}
        if(event.key==='Tab'){
          const buttons=[...box.querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(document.activeElement);
          event.preventDefault();buttons[(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();
        }
      };
      pending={mask,resolve,origin:document.activeElement,keydown};document.addEventListener('keydown',keydown,true);
      mask.addEventListener('click',event=>{if(event.target===mask)close(null);});box.append(title,grid,actions);mask.append(box);portal.append(mask);
      box.querySelector('button:not(:disabled)')?.focus();
    });
  };
  return {choose,dispose:()=>close(null),get open(){return !!pending;}};
}
