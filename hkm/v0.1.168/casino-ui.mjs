import {CASINO_GAMES,startGame,actGame,gameView} from './casino-games.mjs';
import {casinoAccount,casinoPatch,cashier,beginCasinoGame,finishCasinoGame,redemptionCap,redemptionLeft,repaymentRate} from './casino-economy.mjs';
import {ARCADE_HTML} from './casino-arcade-data.mjs';
import {CASINO_VISUAL_CSS,createCasinoVisuals,suggestCasinoCards} from './casino-visuals.mjs';
const ARCADES=[{id:'roulette',name:'命运轮盘',economic:true,stakes:[10],rules:'三轮两胜，每场入场10筹码；胜利奖励30筹码，失败无奖励。不可加注。'},{id:'assembly',name:'极速拼装',economic:true,stakes:[10],rules:'五件零件拼装竞速，每场入场10筹码；胜利奖励30筹码，失败无奖励。不可加注。'}];
const games=[...CASINO_GAMES,...ARCADES];
const copy=x=>JSON.parse(JSON.stringify(x));
export function createCasinoHost({window,document}){
 let api=null,chatId=null,disposed=false,busy=false,stat=null,selectedGame='blackjack',selectedStake=10,selectedCards=new Set(),frame=null,frameUid=null,frameApi=null,token=0,actionQueue=Promise.resolve(),idle=Promise.resolve(),autoPaused=false;
 const root=document.createElement('section');root.className='hkm-casino';root.hidden=true;root.setAttribute('role','region');root.setAttribute('aria-label','系统赌场');
 const style=document.createElement('style');style.textContent=`
.hkm-casino{--hkm-casino-bg:#242a23;--hkm-casino-panel:#1b2118;--hkm-casino-line:#6a7753;--hkm-casino-text:#e4e9d6;--hkm-casino-dim:#b6c2a5;--hkm-casino-accent:#abb77c;box-sizing:border-box;position:fixed;z-index:2147482000;left:max(8px,calc(50vw - 480px));top:24px;width:min(960px,calc(100vw - 16px));max-height:calc(100vh - 48px);max-height:calc(100dvh - 48px);background:var(--hkm-casino-bg);color:var(--hkm-casino-text);border:1px solid var(--hkm-casino-line);border-top:2px solid var(--hkm-casino-accent);border-radius:3px;box-shadow:0 14px 36px #0008;font:13px/1.55 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;color-scheme:dark;overflow:hidden;display:flex;flex-direction:column}
.hkm-casino[hidden],.hkm-casino-wait[hidden],.hkm-casino-toggle[hidden]{display:none}
.hkm-casino *{box-sizing:border-box;min-width:0;scrollbar-width:thin;scrollbar-color:#64724f #151d10}
.hkm-casino header{display:flex;align-items:center;gap:8px;background:#29341f;padding:8px 12px;border-bottom:1px solid #536142}
.hkm-casino h2{font-size:17px;line-height:1.4;letter-spacing:.025em;flex:1;margin:0;color:#edf3db}
.hkm-casino h3{margin:0 0 9px;font-size:14px;color:#dce5c4}
.hkm-casino button,.hkm-casino input,.hkm-casino select{appearance:none;font:inherit;color:inherit;background:#303a25;border:1px solid #75825c;border-radius:3px;min-height:44px;padding:7px 11px;line-height:1.35;max-width:100%}
.hkm-casino input,.hkm-casino select{background:#161d12;border-color:#596848;color:#e3ebd4}
.hkm-casino button{cursor:pointer;box-shadow:inset 0 1px #cad3a918}
.hkm-casino button:hover:not(:disabled){border-color:#b2bf86;background:#3b4a2b}
.hkm-casino button:disabled{opacity:.45;cursor:default}
.hkm-casino button[aria-pressed=true]{border-color:#b2bf86;background:#3b4a2b;color:#f0f5dd}
.hkm-casino :focus-visible{outline:2px solid #d9e7a7;outline-offset:2px}
.hkm-casino-body{min-height:0;overflow:auto;padding:12px;overscroll-behavior:contain}
.hkm-casino-accounts{display:flex;flex-wrap:wrap;gap:4px 16px;padding-bottom:7px;border-bottom:1px solid #475739;font-variant-numeric:tabular-nums;font-size:12px}
.hkm-casino-bar{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin:8px 0}
.hkm-casino-games{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin-top:8px}
.hkm-casino-games button{padding:7px 4px}
.hkm-casino-note{color:var(--hkm-casino-dim);white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0;line-height:1.65}
.hkm-casino-msg{color:#dec584;white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0;font-size:12px}.hkm-casino-msg:empty{display:none}
.hkm-casino-board{margin-top:8px;padding:11px;border:1px solid #475739;border-radius:3px;background:var(--hkm-casino-panel)}
.hkm-casino-board>h3{margin-bottom:8px}.hkm-casino-actions{justify-content:center}.hkm-casino-actions>button{min-width:78px}.hkm-casino-support{display:flex;flex-wrap:wrap;column-gap:20px}.hkm-casino-support details{flex:1 1 210px}.hkm-casino-location{font-size:11px;margin:6px 0;color:#aab99a}.hkm-casino-roundlog summary,.hkm-casino-rules summary{min-height:36px;padding:6px 0;font-size:12px}
.hkm-casino-hand{display:flex;gap:6px;flex-wrap:wrap}
.hkm-casino iframe{display:block;width:100%;height:min(580px,65dvh);border:0;border-radius:2px;background:#151b11}
.hkm-casino-frame{position:relative}
.hkm-casino-wait{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#151d10dd;pointer-events:auto;padding:12px;text-align:center;color:#dce9c4}
.hkm-casino summary{cursor:pointer;padding:8px 0;min-height:44px;color:#dce5c4}
.hkm-casino label{display:flex;align-items:center;gap:7px}
.hkm-casino input{width:100px}
.hkm-casino-log{max-height:160px;overflow:auto;color:var(--hkm-casino-dim)}
.hkm-casino-toggle{position:fixed;z-index:2147481900;right:12px;bottom:12px;max-width:calc(100vw - 24px);background:#303f23;color:#e3ecd1;border:1px solid #748a55;border-radius:3px;padding:8px 12px;min-height:44px;font:13px/1.4 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;cursor:pointer;color-scheme:dark}
.hkm-casino-toggle:focus-visible{outline:2px solid #d9e7a7;outline-offset:2px}
@media(max-width:600px){.hkm-casino-games{grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}.hkm-casino-games button{font-size:12px;min-height:40px}.hkm-casino-board{padding:7px}.hkm-casino-board>h3{font-size:13px}.hkm-casino-actions{gap:5px}.hkm-casino-actions>button{min-width:60px;padding:7px 8px;font-size:12px}}
@media(max-width:480px){.hkm-casino{top:8px;left:8px;max-height:calc(100vh - 16px);max-height:calc(100dvh - 16px)}.hkm-casino-body{padding:9px}.hkm-casino-bar>*{flex:0 1 auto}.hkm-casino iframe{height:65dvh}.hkm-casino-accounts{font-size:11px;gap:3px 10px}}
@media(max-height:500px){.hkm-casino{top:8px;max-height:calc(100vh - 16px);max-height:calc(100dvh - 16px)}.hkm-casino header{padding-top:6px;padding-bottom:6px}}
@media(prefers-reduced-motion:reduce){.hkm-casino *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`+CASINO_VISUAL_CSS;
 document.head.append(style);document.body.append(root);
 const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(className)n.className=className;return n;};
 const btn=(label,fn)=>{const b=el('button',label);b.type='button';b.addEventListener('click',()=>run(fn));return b;};
 const heading=el('header'),title=el('h2','哈基米系统赌场');heading.append(title);
 const close=btn('收起',async()=>{const current=await read();const a=casinoAccount(current);a.open=false;await commit(casinoPatch(current,a),'窗口已收起。');root.hidden=true;toggle.hidden=false;});heading.append(close);root.append(heading);
 const visuals=createCasinoVisuals({window,document});
 const body=el('div',undefined,'hkm-casino-body'),accountBox=el('div',undefined,'hkm-casino-accounts'),location=el('p',undefined,'hkm-casino-note hkm-casino-location'),message=el('p','', 'hkm-casino-msg');message.setAttribute('aria-live','polite');
 const controls=el('div'),cashDetails=el('details'),cashTitle=el('summary','筹码柜台 · 借款与还款');cashDetails.append(cashTitle);
 const amount=el('input');amount.type='number';amount.min='1';amount.step='1';amount.value='10';amount.setAttribute('aria-label','柜台数量');
 const cashRow=el('div',undefined,'hkm-casino-bar');cashRow.append(el('label','数量'),amount);
 for(const [action,label]of [['buy','哈基币→筹码'],['redeem','筹码→哈基币'],['borrow','借款（哈基币）'],['repay','还款（哈基币）']])cashRow.append(btn(label,async()=>{requireArea();const current=await read(),plan=cashier(current,action,Number(amount.value));await commit(plan.patch,plan.text,undefined,plan.text);}));
 cashDetails.append(el('p','兑换填筹码数；借款和还款填哈基币数。借款余额上限1000哈基币，无利息。','hkm-casino-note'),cashRow);
 const gameTabs=el('div',undefined,'hkm-casino-games'),rule=el('p',undefined,'hkm-casino-note'),wager=el('select');wager.setAttribute('aria-label','下注档位');
 wager.addEventListener('change',()=>{selectedStake=Number(wager.value);});
 const start=btn('开始一局',begin),wagerRow=el('div',undefined,'hkm-casino-bar');wagerRow.append(el('label','入场 / 下注'),wager,start);
 for(const g of games){const b=btn(g.name,async()=>{selectedGame=g.id;selectedStake=g.stakes[0];renderMenu();});b.dataset.game=g.id;gameTabs.append(b);}
 const ruleDetails=el('details',undefined,'hkm-casino-rules');ruleDetails.append(el('summary','玩法与奖励'),rule);controls.append(gameTabs,wagerRow,ruleDetails);
 const board=el('div',undefined,'hkm-casino-board'),boardTitle=el('h3','游戏桌'),lines=el('p',undefined,'hkm-casino-note'),hand=el('div',undefined,'hkm-casino-hand'),actions=el('div',undefined,'hkm-casino-bar hkm-casino-actions'),frameWrap=el('div',undefined,'hkm-casino-frame'),wait=el('div','等待回复完成…','hkm-casino-wait');wait.hidden=true;
 const roundLog=el('details',undefined,'hkm-casino-roundlog');roundLog.append(el('summary','本局记录'),lines);
 const history=el('details'),historyTitle=el('summary','最近对局'),historyBody=el('div',undefined,'hkm-casino-log');history.append(historyTitle,historyBody);
 const support=el('div',undefined,'hkm-casino-support');support.append(cashDetails,history);board.append(boardTitle,visuals.mount,actions,frameWrap,roundLog);body.append(accountBox,controls,message,board,location,support);root.append(body);
 const toggle=btn('赌场游戏',open);toggle.className='hkm-casino-toggle';toggle.hidden=true;document.body.append(toggle);
 const uid=()=>window.crypto?.randomUUID?.() || 'casino-'+Date.now()+'-'+Math.random().toString(36).slice(2);
 function check(){if(disposed || !api || api.chatId!==chatId || window.SillyTavern?.getContext?.()?.chatId!==chatId)throw Error('聊天已变化，请在当前聊天打开赌场。');if(!api.available())throw Error('等待当前回复或结算完成后再操作。');}
 function requireArea(current=stat){check();if(current?.场景?.地图!=='哈基米空间'||current?.场景?.区域!=='赌场')throw Error('请先从模拟都市进入赌场。');}
 function sameOwner(owner,origin){if(api!==owner || chatId!==origin)throw Error('聊天或游戏界面已变化，本次操作停止。');check();}
 async function read(){check();const owner=api,origin=chatId,current=await owner.read();sameOwner(owner,origin);stat=current;return current;}
 async function commit(patch,text='',id=uid(),log='') {check();const owner=api,origin=chatId;const fresh=await read();if(patch.赌场 && (JSON.stringify(patch.赌场.active)!==JSON.stringify(fresh.赌场?.active)||patch.赌场.chips!==(fresh.赌场?.chips ?? 0)||patch.赌场.debt!==(fresh.赌场?.debt ?? 0)))requireArea(fresh);await owner.commit('casino:'+id,patch,log);sameOwner(owner,origin);stat=await read();render();if(text)message.textContent=text.startsWith('赌场「')?'本局已结算。':text;}
 async function run(fn,queued=false){if(disposed)return;if(busy){if(!queued)return;await idle;if(disposed)return;}const origin=chatId;busy=true;let release;idle=new Promise(resolve=>{release=resolve;});lock();try{await fn();}catch(error){if(origin===chatId&&!disposed){message.textContent=error?.message || String(error);if(api)try{await read();render();}catch(_){}}}finally{busy=false;lock();release();}}
 function lock(){const ready=!!api && api.available() && api.chatId===chatId;const inArea=stat?.场景?.地图==='哈基米空间' && stat?.场景?.区域==='赌场';root.setAttribute('aria-busy',String(busy||!ready));for(const b of [...controls.querySelectorAll('button,input,select'),...cashDetails.querySelectorAll('button,input,select')])b.disabled=busy||!ready||!inArea;for(const b of actions.querySelectorAll('button'))b.disabled=busy||!ready||!inArea;for(const b of hand.querySelectorAll('button'))b.disabled=busy||!ready||!inArea||b.dataset.selectable==='false';const active=stat?.赌场?.active?.game;if(active?.stage==='playing'||stat?.赌场?.outbox)start.disabled=true;close.disabled=busy||!ready;wait.hidden=ready && inArea && !busy;if(!wait.hidden)wait.textContent=!ready?'等待回复完成…':busy?'正在保存游戏进度…':'返回赌场后继续游戏。';if(frameApi){if((!ready||!inArea)&&!autoPaused)autoPaused=frameApi.pause()===true;else if(ready&&inArea&&autoPaused){autoPaused=false;frameApi.resume();}}}
 function renderMenu(){const g=games.find(x=>x.id===selectedGame);if(!g)return;rule.textContent=g.rules;wager.replaceChildren();for(const stake of g.stakes){const o=el('option',stake+'筹码 / '+stake*10+'哈基币');o.value=String(stake);wager.append(o);}wager.value=String(selectedStake);for(const b of gameTabs.children)b.setAttribute('aria-pressed',String(b.dataset.game===selectedGame));lock();}
 function removeFrame(){token++;frameApi?.destroy?.();frame?.remove();frame=null;frameUid=null;frameApi=null;autoPaused=false;wait.remove();frameWrap.replaceChildren();}
 function render(){if(!stat)return;const a=casinoAccount(stat);accountBox.replaceChildren(el('span','余额 '+(stat.统计信息?.哈基币 ?? 0)+'哈基币'),el('span','筹码 '+a.chips+'枚'),el('span','欠款 '+a.debt+'哈基币'),el('span','累计兑换 '+a.redeemed+'/'+redemptionCap(a)+' · 剩余 '+redemptionLeft(a)));location.textContent='当前位置：'+(stat.场景?.区域 || '未就绪')+'。'+(a.debt?'出售收藏品和任务奖励自动还款'+repaymentRate(a)*100+'%；'+(a.overdue?'借款已暂停，仍可继续游戏。':'借款后完成两局仍未还清将逾期。'):'1筹码 = 10哈基币。');
 root.hidden=!a.open;toggle.hidden=a.open||!a.active;historyBody.replaceChildren(...a.history.slice().reverse().map(x=>el('p',x.name+' · '+x.result+' · 净变化 '+(x.payout-x.fee)+'筹码')));
 const active=a.active;if(!active){removeFrame();boardTitle.textContent='游戏桌';lines.textContent='选好游戏与下注档位后开始。';hand.replaceChildren();actions.replaceChildren();visuals.render({active:null,hand,selectedCards});roundLog.hidden=true;}
 else if(ARCADE_HTML[active.game.type]){visuals.reset();roundLog.hidden=false;boardTitle.textContent=active.game.name;lines.textContent=active.game.stage==='done'?active.game.resultText:'本场入场费 '+active.fee+'筹码，胜利奖励30筹码。';hand.replaceChildren();actions.replaceChildren();if(frameUid!==active.uid)mountArcade(active);}
 else {removeFrame();roundLog.hidden=false;const view=gameView(active.game);boardTitle.textContent=view.title;lines.textContent=(view.lines || []).join('\n');visuals.render({active,hand,selectedCards,onSelect:id=>run(async()=>{if(selectedCards.has(id))selectedCards.delete(id);else selectedCards.add(id);visuals.updateSelection(active.game,selectedCards);})});actions.replaceChildren();if(view.selectCards){actions.append(btn('提示',async()=>{selectedCards=new Set(suggestCasinoCards(active.game));visuals.updateSelection(active.game,selectedCards);if(!selectedCards.size)message.textContent='没有能压过上一手的牌，可以选择不出。';}),btn('清空选牌',async()=>{selectedCards.clear();visuals.updateSelection(active.game,selectedCards);}));}for(const action of view.actions || [])actions.append(btn(action.label,()=>play({type:action.id,cards:[...selectedCards]})));}
 if(active?.game.stage==='playing')actions.append(btn('弃局（入场费不退）',abandon));
 if(a.outbox)actions.append(btn('发送本局结算 / 重试',sendResult));
 renderMenu();lock();}
 async function open(){const current=await read();if(current.场景?.地图!=='哈基米空间'||current.场景?.区域!=='赌场')throw Error('请先从模拟都市进入赌场。');const a=casinoAccount(current);a.open=true;await commit(casinoPatch(current,a));root.hidden=false;close.focus();}
 async function begin(){requireArea();const current=await read(),g=games.find(x=>x.id===selectedGame),id=uid();let game;if(ARCADE_HTML[g.id])game={type:g.id,name:g.name,stage:'playing',arcade:null,payout:0,resultText:''};else game=startGame(g.id,selectedStake);game.name=g.name;selectedCards.clear();visuals.announce(id);await commit(beginCasinoGame(current,game,selectedStake,id),'入场已完成。',id+':start');if(game.stage==='done')await settle(game,id,g.economic);}
 async function play(action){requireArea();const current=await read(),a=casinoAccount(current),active=a.active;if(!active||active.game.stage!=='playing')throw Error('当前没有可继续的游戏。');const game=actGame(active.game,action);game.name=active.game.name;selectedCards.clear();if(game.stage==='done')await settle(game,active.uid,true);else{a.active={...active,game};await commit(casinoPatch(current,a));}}
 async function settle(game,id,economic){const current=await read(),plan=finishCasinoGame(current,game,id,economic);if(plan.patch)await commit(plan.patch,plan.text,id+':finish',plan.text);if(economic)await sendResult();}
 async function sendResult(){check();const current=await read(),out=casinoAccount(current).outbox;if(!out)return;const sender=api,origin=chatId;await sender.send(out.text,out.uid);if(api && chatId===origin){stat=await api.read();render();}}
 async function abandon(){requireArea();const current=await read(),active=casinoAccount(current).active;if(!active||active.game.stage!=='playing')return;const game={...copy(active.game),stage:'done',payout:0,resultText:'主角弃局'};await settle(game,active.uid,true);removeFrame();render();}
 function enqueueArcade(fn){const origin=chatId,originToken=token;actionQueue=actionQueue.then(async()=>{if(disposed||origin!==chatId||originToken!==token)return;await run(async()=>{if(disposed||origin!==chatId||originToken!==token)return;await fn();},true);}).catch(error=>{if(origin===chatId&&originToken===token&&!disposed)message.textContent=error.message;});}
 function mountArcade(active){removeFrame();frameUid=active.uid;const owned=token;frame=el('iframe');frame.title=active.game.name;frame.setAttribute('sandbox','allow-scripts allow-same-origin');frame.addEventListener('load',()=>{
 if(owned!==token || disposed)return;frameApi=frame.contentWindow?.TavernMiniGames?.[active.game.type];if(!frameApi){message.textContent='小游戏未能加载，请收起窗口后重试。';return;}
 frameApi.on('state',()=>{const snapshot=frameApi.exportState();enqueueArcade(async()=>{requireArea();const current=await read(),a=casinoAccount(current);if(a.active?.uid!==active.uid || a.active.settled)return;if((a.active.game.arcade?.sequence ?? -1)>snapshot.sequence)return;if(api.progress){const owner=api,origin=chatId;await owner.progress(active.uid,snapshot);sameOwner(owner,origin);await read();render();}else{a.active.game.arcade=snapshot;await commit(casinoPatch(current,a));}});});
 frameApi.on('result',event=>{const snapshot=frameApi.exportState();enqueueArcade(async()=>{requireArea();const current=await read(),a=casinoAccount(current);if(a.active?.uid!==active.uid||a.active.settled)return;const game={...a.active.game,arcade:snapshot,stage:'done',payout:event.result?.winner==='player'?30:0,resultText:event.result?.winner==='player'?'主角胜利':'对手玩家胜利'};await settle(game,active.uid,true);});});
 if(active.game.arcade)frameApi.restore(active.game.arcade);else{frame.contentWindow.hkmArcadeMatchId=active.uid;frame.contentWindow.hkmArcadeAuthorized=true;frameApi.start();}lock();
 },{once:true});frame.srcdoc=ARCADE_HTML[active.game.type];frameWrap.append(frame,wait);lock();}
 async function bind(next){if(disposed)return;api=next;const switched=chatId!==next.chatId;if(switched){chatId=next.chatId;stat=null;message.textContent='';removeFrame();visuals.reset();selectedCards.clear();root.hidden=true;toggle.hidden=true;}const current=await next.read();if(api!==next || chatId!==next.chatId || disposed)return;stat=current;render();const active=casinoAccount(stat).active;if(active?.game.stage==='done'&&!active.settled && next.available())run(()=>settle(active.game,active.uid,games.find(x=>x.id===active.game.type)?.economic===true),true);else if(active && !active.settled && frameApi && next.available()){const snapshot=frameApi.exportState();if(snapshot.state?.phase==='finished')enqueueArcade(()=>settle({...active.game,arcade:snapshot,stage:'done',payout:snapshot.state.winner==='player'?30:0,resultText:snapshot.state.winner==='player'?'主角胜利':'对手玩家胜利'},active.uid,true));}}
 function unbind(owner){if(api===owner){api=null;lock();}}
 function setContext(id){if(id!==chatId){api=null;chatId=id;stat=null;message.textContent='';root.hidden=true;toggle.hidden=true;removeFrame();visuals.reset();selectedCards.clear();}lock();}
 function sync(current,owner){if(!api||api.chatId!==chatId || owner && owner!==api)return;stat=current;render();}
 const onKey=e=>{if(e.key==='Escape'&&!root.hidden&&!document.querySelector('dialog[open]'))run(async()=>{const current=await read(),a=casinoAccount(current);a.open=false;await commit(casinoPatch(current,a));toggle.focus();});};document.addEventListener('keydown',onKey);
 function dispose(){if(disposed)return;disposed=true;api=null;removeFrame();visuals.dispose();root.remove();toggle.remove();style.remove();document.removeEventListener('keydown',onKey);}
 return {open:()=>run(open),bind,unbind,setContext,sync,lock,dispose};
}
