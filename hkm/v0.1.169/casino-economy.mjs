export const CHIP_NAME='赌场筹码';
export const CHIP_ID='COL-0250';
export const CHIP_VALUE=10;
export const LOAN_LIMIT=1000;
export const casinoDefaults=()=>({version:1,chips:0,games:0,redeemed:0,debt:0,debtStart:null,overdue:false,serial:0,open:false,active:null,last:null,outbox:null,history:[]});
const copy=x=>JSON.parse(JSON.stringify(x));
const integer=(x,label)=>{const n=Number(x);if(!Number.isSafeInteger(n)||n<0)throw Error(label+'数据无效。');return n;};
export function casinoAccount(stat){
 const raw=stat?.赌场 ?? {};
 if(typeof raw!=='object'||Array.isArray(raw)||raw===null)throw Error('赌场账户格式无效。');
 const a={...casinoDefaults(),...copy(raw)};
 for(const k of ['chips','games','redeemed','debt','serial'])a[k]=integer(a[k],k);
 if(a.debtStart!==null)a.debtStart=integer(a.debtStart,'借款对局数');
 if(a.debtStart!==null && a.debtStart>a.games)throw Error('借款对局数数据无效。');
 if(a.debt>0 && a.debtStart===null)a.debtStart=a.games;
 a.overdue=a.debt>0 && a.games-a.debtStart>=2;
 if(!Array.isArray(a.history))throw Error('赌场历史格式无效。');
 if(a.history.some(row=>!row || typeof row!=='object'||typeof row.name!=='string'||typeof row.result!=='string'||!Number.isSafeInteger(row.fee)||row.fee<0||!Number.isSafeInteger(row.payout)||row.payout<0))throw Error('赌场历史记录格式无效。');
 if(a.active!==null && (!a.active || typeof a.active!=='object' || Array.isArray(a.active) || typeof a.active.uid!=='string' || !a.active.uid || !a.active.game || typeof a.active.game!=='object' || !['playing','done'].includes(a.active.game.stage)))throw Error('赌场活动对局格式无效。');
 if(a.active){integer(a.active.fee,'游戏入场费');if(a.active.settled!==undefined && typeof a.active.settled!=='boolean')throw Error('游戏结算状态格式无效。');}
 if(a.outbox!==null && (!a.outbox || typeof a.outbox!=='object'||Array.isArray(a.outbox)||typeof a.outbox.uid!=='string'||!a.outbox.uid||typeof a.outbox.text!=='string'))throw Error('赌场待发记录格式无效。');
 redemptionCap(a);
 return a;
}
export const redemptionCap=a=>integer(1000+100*a.games,'累计兑换上限');
export const redemptionLeft=a=>Math.max(0,redemptionCap(a)-a.redeemed);
export const repaymentRate=a=>a.overdue?0.75:0.5;
export function casinoPatch(stat,a,coins=stat?.统计信息?.哈基币 ?? 0){
 integer(a.chips,'筹码');
 redemptionCap(a);
 const bucket=copy(stat?.安全屋?.收藏品 || {});
 for(const [key,row]of Object.entries(bucket))if(row?.名称===CHIP_NAME || row?.ID===CHIP_ID)delete bucket[key];
 if(a.chips>0)bucket[CHIP_NAME]={名称:CHIP_NAME,ID:CHIP_ID,稀有度:'寻常',数量:a.chips,价值:10,重量:0,描述:'哈基米系统赌场筹码。1筹码可兑换10哈基币，兑换受累计额度限制。仅存放于安全屋，不可带入行动对局。'};
 return {赌场:a,安全屋:{...(stat?.安全屋 || {}),收藏品:bucket},统计信息:{...(stat?.统计信息 || {}),哈基币:integer(coins,'哈基币')}};
}
export function cashier(stat,action,amount){
 const a=casinoAccount(stat),n=integer(amount,'数量');if(n<1)throw Error('请输入正整数。');
 if(a.active && a.active.game?.stage!=='done')throw Error('请先完成当前游戏。');
 let coins=integer(stat?.统计信息?.哈基币 ?? 0,'哈基币'),text='';
 if(action==='buy'){
  const cost=n*CHIP_VALUE;if(coins<cost)throw Error('哈基币不足。');coins-=cost;a.chips+=n;text='兑换筹码'+n+'枚，支出'+cost+'哈基币。';
 }else if(action==='redeem'){
  if(a.chips<n)throw Error('筹码不足。');const value=n*CHIP_VALUE;
  if(value>redemptionLeft(a))throw Error('本次兑换超过剩余累计额度'+redemptionLeft(a)+'哈基币。');
  a.chips-=n;a.redeemed+=value;coins+=value;text='兑回'+value+'哈基币，使用筹码'+n+'枚。';
 }else if(action==='borrow'){
  if(a.overdue)throw Error('欠款已逾期，还清后才能再次借款。');
  if(a.debt+n>LOAN_LIMIT)throw Error('借款未偿余额上限为'+LOAN_LIMIT+'哈基币。');
  if(!a.debt)a.debtStart=a.games;a.debt+=n;coins+=n;text='借款'+n+'哈基币，当前欠款'+a.debt+'哈基币。';
 }else if(action==='repay'){
  const paid=Math.min(n,a.debt);if(!paid)throw Error('当前没有欠款。');if(coins<paid)throw Error('哈基币不足。');
  coins-=paid;a.debt-=paid;if(!a.debt){a.overdue=false;a.debtStart=null;}text='手动偿还'+paid+'哈基币，剩余欠款'+a.debt+'哈基币。';
 }else throw Error('未知柜台操作。');
 return {patch:casinoPatch(stat,a,coins),text};
}
export function autoRepay(stat,gross,patch={}){
 const a=casinoAccount({...stat,...patch}),income=integer(gross,'收入');
 const paid=Math.min(a.debt,Math.floor(income*repaymentRate(a)));
 if(!paid)return {patch,paid:0};
 a.debt-=paid;if(!a.debt){a.debtStart=null;a.overdue=false;}
 const coins=integer(patch.统计信息?.哈基币 ?? stat?.统计信息?.哈基币 ?? 0,'哈基币')-paid;
 integer(coins,'还款后哈基币');
 return {patch:{...patch,赌场:a,统计信息:{...(stat?.统计信息 || {}),...(patch.统计信息 || {}),哈基币:coins}},paid};
}
export function beginCasinoGame(stat,game,fee,uid){
 const a=casinoAccount(stat),cost=integer(fee,'入场筹码');
 if(a.outbox)throw Error('上一局结算消息尚未发送，请先发送或重试。');
 if(a.active && a.active.game.stage!=='done')throw Error('已有进行中的游戏。');
 if(a.chips<cost)throw Error('筹码不足，请先用哈基币兑换筹码。');
 a.chips-=cost;a.serial++;a.active={uid,fee:cost,game:copy(game)};a.last=null;
 return casinoPatch(stat,a);
}
export function finishCasinoGame(stat,game,uid,economic){
 const a=casinoAccount(stat);
 if(!a.active || a.active.uid!==uid)throw Error('当前游戏已变化。');
 if(a.active.settled)return {patch:null,text:a.last?.text || '',duplicate:true};
 if(game.stage!=='done')throw Error('游戏尚未结束。');
 const payout=integer(game.payout ?? 0,'游戏奖励'),fee=a.active.fee;
 a.chips+=payout;a.games++;a.overdue=a.debt>0 && a.games-a.debtStart>=2;
 a.active={...a.active,game:copy(game),settled:true};
 const text='赌场「'+game.name+'」：'+game.resultText+'；入场'+fee+'筹码，返还及奖励'+payout+'筹码，净变化'+(payout-fee)+'筹码。剩余'+a.chips+'筹码；累计兑换上限'+redemptionCap(a)+'哈基币，已兑回'+a.redeemed+'哈基币；欠款'+a.debt+'哈基币。'+(a.overdue?'借款已暂停；出售收藏品与任务奖励自动还款75%。':'');
 a.last={uid,text,economic};a.history=[...a.history,{uid,name:game.name,fee,payout,result:game.resultText}].slice(-30);
 if(economic)a.outbox={uid,text};
 return {patch:casinoPatch(stat,a),text,duplicate:false};
}
export function chipGuard(current,patch){
 const next={...current,...patch},a=casinoAccount(next);
 const safe=next.安全屋?.收藏品 || {},bag=next.背包?.携带收藏品 || {};
 const entries=Object.values(safe).filter(x=>x?.名称===CHIP_NAME || x?.ID===CHIP_ID);
 const bagEntries=Object.values(bag).filter(x=>x?.名称===CHIP_NAME || x?.ID===CHIP_ID);
 const hidden=Object.values(next.藏匿物 || {}).filter(x=>x?.名称===CHIP_NAME || x?.ID===CHIP_ID);
 const ground=Object.values(next.散落物品 || {}).filter(x=>x?.名称===CHIP_NAME || x?.ID===CHIP_ID);
 const equipment=Object.values(next.装备 || {}).some(x=>x===CHIP_NAME || x===CHIP_ID || x?.名称===CHIP_NAME || x?.ID===CHIP_ID);
 const total=entries.concat(bagEntries).reduce((s,x)=>s+Math.max(0,Number(x.数量)||0),0);
 if(total!==a.chips || bagEntries.length || hidden.length || ground.length || equipment || entries.some(row=>Number(row.重量)!==0||Number(row.价值)!==CHIP_VALUE))throw Error('赌场筹码只能由赌场柜台和游戏结算变更，不能移出安全屋。');
 return patch;
}
