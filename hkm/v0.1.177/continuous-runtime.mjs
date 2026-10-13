import {HkmContinuous} from './continuous-actions.mjs';

export function createContinuousRuntime(api) {
  let busy = false;
  const session = () => HkmContinuous.normalize(api.state().continuousActions);
  const render = () => api.render({session:session(),busy});
  const same = value => api.identity().map === value.map && api.identity().runId === value.runId && api.identity().floor === value.floor;
  const start = async () => {
    if (busy) return false;
    api.requireAction();
    const current=session();
    if(current.active){
      if(current.count)return send(false);
      await api.saveSession({...current,active:false,ended:true});render();return true;
    }
    const identity=api.identity();
    if(!identity.runId || !identity.mission)throw Error('请先进入对局。');
    await api.saveSession(HkmContinuous.begin(identity));render();return true;
  };
  const send = async (automatic = false) => {
    if(busy)return false;
    let current=session();
    if(!HkmContinuous.shouldSend(current,{manual:true}))return false;
    api.requireSend();
    if(!same(current))throw Error('连续行动所属的对局或消息已变化。');
    const before=HkmContinuous.receipt(current);
    let instruction=String(api.state().continuousSendDraft ?? '');
    const forced=current.count>=HkmContinuous.limit || current.logs.some(row=>row.interrupted);
    if(!automatic && !forced){
      const result=await api.confirm({title:'发送连续行动',details:current.logs.map(row=>row.text),submitLabel:'确认发送',initialInstruction:instruction,allowInstruction:true});
      if(result===null)return false;
      instruction=result;
      api.requireSend();
      current=session();
      if(!same(current) || HkmContinuous.receipt(current)?.signature!==before.signature)throw Error('行动日志已变化，请重新确认发送。');
    }
    busy=true;
    try{
      current=HkmContinuous.seal(current);
      await api.saveSession(current,instruction);
      render();
      const receipt=HkmContinuous.receipt(current);
      try{
        await api.send(HkmContinuous.format(current,{includeInstructions:false}),{
          action:'continuous_actions',map:current.map,count:current.count,actions:current.logs.map(row=>({id:row.id,kind:row.kind,interrupted:row.interrupted})),
        },{allowDead:true,forceSend:true,continuousOutboxId:receipt.key+':'+receipt.revision,rawInstruction:instruction,coveredSettlementIds:receipt.actionIds});
        await api.acknowledge(receipt,{created:true});
      }catch(error){
        if(error.messageCreated){await api.acknowledge(receipt,{messageCreated:true});api.report(error.message);return true;}
        throw error;
      }
      return true;
    }finally{busy=false;render();}
  };
  const perform = async intent => {
    if(busy)throw Error('行动结算中，请稍候。');
    api.requireAction();
    const before=session();
    if(before.active && (!same(before) || !HkmContinuous.canAct(before)))throw Error('连续行动已停止，请先发送日志。');
    busy=true;render();
    let shouldSend=false;
    try{
      const result=await api.execute(intent);
      if(!result)return false;
      const latest=session();
      if(before.active){
        if(!same(latest) || HkmContinuous.receipt(before)?.signature!==HkmContinuous.receipt(latest)?.signature)throw Error('连续行动记录已变化。');
        const next=HkmContinuous.append(latest,{id:result.id,kind:intent.kind,text:result.message,rawInstruction:intent.rawInstruction ?? '',interrupted:result.interrupted});
        await api.saveSession(next);
        shouldSend=HkmContinuous.shouldSend(next);
      }else{
        await api.send(result.message,result.payload,{allowDead:result.dead===true,coveredSettlementIds:[result.id],rawInstruction:intent.rawInstruction ?? ''});
      }
      return result;
    }finally{
      busy=false;render();
      if(shouldSend)await send(true);
    }
  };
  return {start,send,perform,render,get busy(){return busy;}};
}
