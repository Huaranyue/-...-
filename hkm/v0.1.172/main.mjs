import {mount,createFishingHost} from './runtime.mjs';
import {createCasinoHost} from './casino-ui.mjs';
import {HUD_CSS} from './hud-style.mjs';

export function start({scriptWindow=globalThis.window}={}) {
  const window=scriptWindow.parent,document=window.document;
  const timers=new Set(),stops=[];
  const casino=createCasinoHost({window,document});
  const fishing=createFishingHost({window,document});
  let disposed=false,current=null,queued=false,observer=null,generating=false,generationBase=null;
  const pendingReplies=new Set(),settledReplies=new Set();
  const context=()=>window.SillyTavern?.getContext?.();
  const replyToken=id=>JSON.stringify([context()?.chatId,id,context()?.chat?.[id]?.swipe_id ?? 0]);
  const replyReady=id=>!generating && !pendingReplies.has(replyToken(id));
  const latest=()=>document.querySelector('#chat .mes[is_user="false"]:last-of-type') || [...document.querySelectorAll('#chat .mes[is_user="false"]')].at(-1);
  const candidate=()=>{
    const message=latest(),host=message?.querySelector('[data-hkm-hosted="166"]');
    if(!host)return null;
    const messageId=Number(message.getAttribute('mesid')),chatId=context()?.chatId;
    if(!Number.isInteger(messageId)||messageId<0||!chatId)return null;
    return {host,messageId,chatId};
  };
  const isCurrent=row=>{
    if(disposed || !row.host.isConnected || context()?.chatId!==row.chatId)return false;
    const next=candidate();return next?.host===row.host && next.messageId===row.messageId;
  };
  const status=(host,text,retry)=>{
    host.replaceChildren();const message=document.createElement('p');message.className='hkm-reset-status';message.textContent=text;host.append(message);
    if(retry){const button=document.createElement('button');button.type='button';button.textContent='重试加载';button.addEventListener('click',retry,{once:true});host.append(button);}
  };
  const release=()=>{
    if(!current)return;
    const old=current;current=null;old.runtime.dispose();
    if(old.row.host.isConnected)status(old.row.host,'游戏面板在最新回复中操作。');
  };
  const reconcile=()=>{
    if(disposed)return;
    casino.setContext(context()?.chatId);
    fishing.setContext(context()?.chatId);
    const row=candidate();
    for(const message of document.querySelectorAll('#chat .mes[is_user="false"]')){
      const host=message.querySelector('[data-hkm-hosted="166"]');
      if(host && host!==row?.host && !host.dataset.hkmHistory){
        host.dataset.hkmHistory='1';host.classList.add('hkm-reset-host');status(host,'游戏面板在最新回复中操作。');
      }
    }
    if(current && row && current.row.host===row.host && current.row.messageId===row.messageId && current.row.chatId===row.chatId && !current.runtime.disposed){current.runtime.refresh();return;}
    release();if(!row)return;delete row.host.dataset.hkmHistory;row.host.classList.add('hkm-reset-host');
    const retry=()=>{if(isCurrent(row)){release();reconcile();}};
    const runtime=mount({document,window,scriptWindow,casino,fishing,host:row.host,messageId:row.messageId,replyReady:()=>replyReady(row.messageId),isCurrent:()=>isCurrent(row),retry,report:error=>{
      if(!isCurrent(row))return;
      release();status(row.host,'前端加载失败：'+(error?.message || String(error)),retry);
    }});
    current={row,runtime};runtime.ready.catch(()=>{});
  };
  const schedule=()=>{
    if(disposed||queued)return;queued=true;
    const timer=scriptWindow.setTimeout(()=>{timers.delete(timer);queued=false;reconcile();},40);timers.add(timer);
  };
  const link=document.createElement('style');link.textContent=HUD_CSS;document.head.append(link);
  const ready=Promise.resolve().then(()=>{
    if(disposed)return;
    observer=new window.MutationObserver(records=>{
      if(records.some(record=>!record.target.closest?.('.hkm-reset-host,.hkm-portal,.hkm-casino,.hkm-fishing-host,.hkm-fishing-toggle')))schedule();
    });
    observer.observe(document.body,{subtree:true,childList:true});
    const ctx=context();
    const listen=(key,listener)=>{const type=ctx?.eventTypes?.[key];if(!type||!ctx.eventSource?.on)return;ctx.eventSource.on(type,listener);stops.push(()=>ctx.eventSource.removeListener(type,listener));};
    listen('CHAT_CHANGED',()=>{generating=false;generationBase=null;pendingReplies.clear();settledReplies.clear();schedule();});
    listen('GENERATION_STARTED',(type,options,dryRun)=>{
      if(dryRun===true)return;
      generating=true;settledReplies.clear();
      const id=context()?.chat?.findLastIndex(row=>row?.is_user===false && row?.is_system!==true);
      generationBase={token:replyToken(id),text:context()?.chat?.[id]?.mes};
    });
    listen('GENERATION_ENDED',()=>{
      generating=false;
      const id=context()?.chat?.findLastIndex(row=>row?.is_user===false && row?.is_system!==true);
      if(Number.isInteger(id) && id>=0){const token=replyToken(id);if(!settledReplies.has(token) && (generationBase?.token!==token || generationBase?.text!==context()?.chat?.[id]?.mes))pendingReplies.add(token);}
      generationBase=null;
      schedule();
    });
    listen('GENERATION_STOPPED',()=>{generating=false;generationBase=null;schedule();});
    listen('MESSAGE_RECEIVED',id=>{const token=replyToken(id);if(!settledReplies.has(token))pendingReplies.add(token);schedule();});
    listen('CHARACTER_MESSAGE_RENDERED',(...args)=>{
      const token=replyToken(args[0]);
      if(args.length===1){pendingReplies.delete(token);settledReplies.add(token);}
      else if(!settledReplies.has(token))pendingReplies.add(token);
      schedule();
    });
    for(const key of ['MESSAGE_UPDATED','MESSAGE_SWIPED','MESSAGE_DELETED'])listen(key,schedule);
    reconcile();
  });
  const dispose=()=>{
    if(disposed)return;disposed=true;observer?.disconnect();
    for(const timer of timers)scriptWindow.clearTimeout(timer);timers.clear();
    for(const stop of stops.splice(0)){try{stop();}catch(_){}}
    release();casino.dispose();fishing.dispose();link.remove();scriptWindow.removeEventListener('pagehide',dispose);
  };
  scriptWindow.addEventListener('pagehide',dispose,{once:true});
  return {ready,dispose};
}
