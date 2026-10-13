export function createContinuousActionWindow({document,window,onSend=async()=>{},onConfig=()=>{}}) {
  const make=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls || '';if(text!==undefined)node.textContent=String(text);return node;};
  const number=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
  const normalizeConfig=value=>({threshold:Math.max(0,Math.floor(number(value?.threshold,4))),autoAttack:value?.autoAttack===true,allowBeg:value?.allowBeg===true});
  const style=make('style');style.dataset.hkmContinuousStyle='1';
  style.textContent=`
.hkmca-root{--hkmca-gold:#d6b567;--hkmca-text:#eee7d6;--hkmca-dim:#b5ac96;--hkmca-line:#645234;font:13px/1.55 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;color:var(--hkmca-text)}
.hkmca-root *{box-sizing:border-box}.hkmca-root [hidden]{display:none!important}.hkmca-root button,.hkmca-root input,.hkmca-root textarea{font:inherit}.hkmca-root button{cursor:pointer}.hkmca-root button:disabled{cursor:not-allowed;opacity:.45}.hkmca-root :focus-visible{outline:2px solid #f8dc97;outline-offset:3px}
.hkmca-panel{position:fixed;z-index:2147482100;width:min(410px,calc(100vw - 16px));max-height:calc(100dvh - 16px);display:flex;flex-direction:column;min-width:0;border:1px solid #a38543;border-radius:14px;overflow:hidden;background:radial-gradient(ellipse at 100% 0%,#342a16 0%,transparent 52%),linear-gradient(145deg,#171b1d,#0d1013);box-shadow:0 18px 55px #000a,0 0 0 3px #0c0e10,0 0 24px #d6b56718}
.hkmca-panel:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(110deg,transparent 40%,#fff1 50%,transparent 60%);height:2px;background-size:200% 100%;animation:hkmca-glint 5s linear infinite}
.hkmca-head{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid #80633280;background:linear-gradient(90deg,#d6b56713,transparent)}
.hkmca-drag{touch-action:none;user-select:none;display:flex;align-items:center;gap:11px;flex:1;min-width:0;background:none;border:0;color:inherit;padding:4px 2px;text-align:left;min-height:44px;cursor:grab!important}.hkmca-drag:active{cursor:grabbing!important}.hkmca-mark{flex:none;width:30px;height:30px;border:1px solid #b68d46;color:#ffe5a5;display:grid;place-items:center;transform:rotate(45deg);background:#302610}.hkmca-mark>span{transform:rotate(-45deg);font-size:18px}.hkmca-title{font-size:15px;letter-spacing:.11em;font-weight:800;color:#f4d795}.hkmca-subtitle{font-size:10px;letter-spacing:.16em;color:var(--hkmca-dim)}
.hkmca-collapse{min-width:44px;min-height:44px;color:var(--hkmca-gold);background:#ffffff06;border:1px solid #6c5833;border-radius:8px;font-size:22px!important;line-height:1}
.hkmca-content{padding:13px 14px;overflow:auto;min-height:0;overscroll-behavior:contain}.hkmca-summary{display:flex;align-items:end;justify-content:space-between;gap:12px}.hkmca-caption{font-size:11px;color:var(--hkmca-dim);letter-spacing:.1em}.hkmca-count{color:#ffe6a6;font-size:29px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1}.hkmca-count>span{color:#b8a87f;font-size:14px;font-weight:500}
.hkmca-meter{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin:11px 0 15px}.hkmca-step{height:5px;background:#32312c;border-radius:3px;border:1px solid #50452e}.hkmca-step[data-filled="true"]{background:linear-gradient(90deg,#9c7431,#efd797);box-shadow:0 0 8px #d6b5672b}
.hkmca-log{list-style:none;margin:0;padding:0;display:grid;gap:10px}.hkmca-log-row{position:relative;padding:0 0 0 22px;min-width:0;border-left:1px solid #70552d;margin-left:5px}.hkmca-log-row:before{content:"";position:absolute;left:-4px;top:7px;width:7px;height:7px;transform:rotate(45deg);background:#d6b567;border:1px solid #f6dc98}.hkmca-log-text{white-space:pre-wrap;overflow-wrap:anywhere;color:#eee7d6}.hkmca-log-raw{margin-top:5px;font-size:11px;color:#c5b894}.hkmca-log-raw summary{cursor:pointer;min-height:24px}.hkmca-log-raw pre{margin:4px 0;padding:8px;background:#0005;border-left:2px solid #74603a;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;color:#d2c5a8}.hkmca-empty{margin:5px 0 13px;color:var(--hkmca-dim);font-size:12px}
.hkmca-config{margin-top:15px;padding-top:9px;border-top:1px solid #64523470}.hkmca-config>summary{cursor:pointer;color:var(--hkmca-gold);min-height:30px;font-size:12px;letter-spacing:.05em}.hkmca-fields{display:grid;gap:8px;margin-top:6px}.hkmca-field{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:36px;color:#d4cbb6}.hkmca-field>span{min-width:0}.hkmca-number{width:76px;min-height:38px;border:1px solid #796038;border-radius:7px;background:#080b0d;color:#f4d795;text-align:center;padding:5px}.hkmca-field input[type="checkbox"]{accent-color:#d6b567;width:20px;height:20px;margin:0}.hkmca-config-note{color:var(--hkmca-dim);font-size:11px;margin:0}
.hkmca-footer{padding:11px 14px;border-top:1px solid #64523480;background:#0002;display:grid;gap:8px}.hkmca-send{width:100%;min-height:44px;border:1px solid #eed28b;border-radius:8px;color:#17140d;font-weight:800!important;letter-spacing:.05em;background:linear-gradient(105deg,#b9934a,#edd493 65%,#d2aa5e);box-shadow:0 2px 10px #0006}.hkmca-send:hover:not(:disabled){filter:brightness(1.1)}.hkmca-status{margin:0;color:#d6b567;font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}.hkmca-status[data-error="true"]{color:#ffb8a9}
.hkmca-mini{position:fixed;z-index:2147482100;touch-action:none;user-select:none;display:flex;align-items:center;gap:9px;min-height:52px;max-width:calc(100vw - 16px);padding:8px 15px;border:1px solid #d6b567;border-radius:99px;background:linear-gradient(120deg,#292214,#111518);color:#f1d592;box-shadow:0 6px 24px #0008,0 0 13px #d6b56716}.hkmca-mini-count{font-weight:800;font-variant-numeric:tabular-nums;border-left:1px solid #6b5430;padding-left:9px;color:#ffe9b8}
.hkmca-mask{position:fixed;z-index:2147483100;inset:0;display:flex;align-items:center;justify-content:center;padding:12px;background:#000b;overscroll-behavior:contain}.hkmca-dialog{width:min(470px,100%);max-height:100%;overflow:auto;overscroll-behavior:contain;min-width:0;padding:19px;border:1px solid #bc954c;border-radius:13px;background:radial-gradient(ellipse at 90% 0%,#39301a,transparent 70%),#111518;box-shadow:0 18px 60px #000b;color:var(--hkmca-text)}.hkmca-dialog-title{margin:0 0 13px;font-size:17px;color:#f4d795;overflow-wrap:anywhere}.hkmca-details{margin:0 0 14px;padding-left:21px;color:#d2c9b5;white-space:pre-wrap;overflow-wrap:anywhere}.hkmca-details li+li{margin-top:6px}.hkmca-instruction-label{display:block;margin-bottom:7px;color:#e1d3b2;font-size:12px}.hkmca-instruction{display:block;width:100%;min-height:105px;resize:vertical;max-height:35dvh;padding:10px 12px;border:1px solid #78623d;border-radius:8px;background:#090c0f;color:#efe8d8;line-height:1.65;white-space:pre-wrap}.hkmca-dialog-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:17px}.hkmca-cancel,.hkmca-submit{min-width:84px;min-height:44px;border:1px solid #7b633a;border-radius:8px;padding:8px 15px;background:#202326;color:#e4d7b9}.hkmca-submit{background:linear-gradient(105deg,#b9934a,#edd493);color:#17140d;border-color:#eed28b;font-weight:700!important}
@keyframes hkmca-glint{to{background-position:200% 0}}@media(prefers-reduced-motion:reduce){.hkmca-panel:before{animation:none}}@media(max-width:480px){.hkmca-panel{border-radius:11px}.hkmca-content{padding:11px 12px}.hkmca-footer{padding:10px 12px}.hkmca-dialog{padding:15px}.hkmca-dialog-actions>*{flex:1}.hkmca-mask{padding:8px}}
`;
  const root=make('div','hkmca-root'),panel=make('section','hkmca-panel'),mini=make('button','hkmca-mini');
  panel.setAttribute('role','region');panel.setAttribute('aria-label','连续行动');panel.dataset.hkmContinuous='panel';panel.hidden=true;
  mini.type='button';mini.hidden=true;mini.setAttribute('aria-label','展开连续行动窗口');mini.dataset.hkmContinuous='mini';
  const head=make('header','hkmca-head'),drag=make('button','hkmca-drag'),mark=make('span','hkmca-mark'),names=make('span'),collapse=make('button','hkmca-collapse','−');
  drag.type='button';drag.setAttribute('aria-label','拖动连续行动窗口');drag.title='拖动窗口；方向键移动';mark.setAttribute('aria-hidden','true');mark.append(make('span','','›'));
  names.append(make('span','hkmca-title','连续行动'),make('div','hkmca-subtitle','行动记录'));drag.append(mark,names);
  collapse.type='button';collapse.setAttribute('aria-label','收起连续行动窗口');collapse.setAttribute('aria-expanded','true');head.append(drag,collapse);
  const content=make('div','hkmca-content'),summary=make('div','hkmca-summary'),count=make('div','hkmca-count'),countValue=make('strong','','0'),meter=make('div','hkmca-meter'),log=make('ol','hkmca-log'),empty=make('p','hkmca-empty','尚无行动记录。');
  count.append(countValue,make('span','',' / 4'));summary.append(make('span','hkmca-caption','已完成行动'),count);meter.setAttribute('aria-hidden','true');
  const steps=Array.from({length:4},()=>make('span','hkmca-step'));meter.append(...steps);content.append(summary,meter,empty,log);
  const settings=make('details','hkmca-config'),fields=make('div','hkmca-fields'),threshold=make('input','hkmca-number'),autoAttack=make('input'),allowBeg=make('input'),thresholdNote=make('p','hkmca-config-note');
  settings.append(make('summary','','行动配置'));threshold.type='number';threshold.min='0';threshold.step='1';threshold.setAttribute('aria-label','中断威胁等级');autoAttack.type='checkbox';allowBeg.type='checkbox';
  for(const [text,input]of [['中断威胁等级',threshold],['自动攻击',autoAttack],['接受求饶并标为友善',allowBeg]]){const label=make('label','hkmca-field');label.append(make('span','',text),input);fields.append(label);}
  fields.append(thresholdNote);settings.append(fields);content.append(settings);
  const footer=make('footer','hkmca-footer'),status=make('p','hkmca-status'),send=make('button','hkmca-send','发送行动记录');send.type='button';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.hidden=true;footer.append(status,send);panel.append(head,content,footer);
  const miniLabel=make('span','','连续行动'),miniCount=make('span','hkmca-mini-count','0 / 4');mini.append(miniLabel,miniCount);root.append(panel,mini);(document.head || document.documentElement).append(style);document.body.append(root);
  let disposed=false,collapsed=false,localBusy=false,view={active:false,count:0,logs:[],busy:false,blocked:false,config:normalizeConfig()},error='',logsSignature='',position=null,miniPosition=null,gesture=null,ignoreMiniClick=false,modal=null,request=0;
  const disposers=[];
  const listen=(target,type,handler,options)=>{target.addEventListener(type,handler,options);disposers.push(()=>target.removeEventListener(type,handler,options));};
  const viewport=()=>{const v=window.visualViewport;return {x:v?.offsetLeft || 0,y:v?.offsetTop || 0,w:Math.max(1,v?.width || window.innerWidth || 320),h:Math.max(1,v?.height || window.innerHeight || 600)};};
  const place=(node,point,defaultPoint)=>{
    const v=viewport();node.style.maxHeight=Math.max(1,v.h-16)+'px';
    if(node===panel)node.style.width=Math.min(410,Math.max(1,v.w-16))+'px';
    const rect=node.getBoundingClientRect(),w=Math.min(v.w-16,rect.width || (node===panel?410:185)),h=Math.min(v.h-16,rect.height || 52),p=point || defaultPoint;
    const x=Math.max(v.x+8,Math.min(p.x,v.x+v.w-Math.max(1,w)-8)),y=Math.max(v.y+8,Math.min(p.y,v.y+v.h-Math.max(1,h)-8));
    node.style.left=x+'px';node.style.top=y+'px';return {x,y};
  };
  const clamp=()=>{
    if(disposed)return;
    const v=viewport(),fallback={x:v.x+v.w-426,y:v.y+Math.min(88,Math.max(8,v.h*0.12))};
    if(!panel.hidden)position=place(panel,position,fallback);
    if(!mini.hidden)miniPosition=place(mini,miniPosition,position || fallback);
    if(modal){modal.mask.style.inset='auto';Object.assign(modal.mask.style,{left:v.x+'px',top:v.y+'px',width:v.w+'px',height:v.h+'px'});}
  };
  const stopGesture=()=>{if(!gesture)return;const current=gesture;gesture=null;try{current.captureTarget.releasePointerCapture(current.pointerId);}catch(_){}panel.removeAttribute('data-dragging');};
  const show=()=>{
    if(disposed)return;
    panel.hidden=!view.active || collapsed;mini.hidden=!view.active || !collapsed;panel.setAttribute('aria-busy',String(localBusy || view.busy));
    countValue.textContent=String(view.count);miniCount.textContent=view.count+' / 4';steps.forEach((step,index)=>step.dataset.filled=String(index<view.count));
    send.disabled=!view.active || view.count===0 || localBusy || view.busy || !!view.blocked;send.textContent=localBusy || view.busy?'正在发送…':'发送行动记录';
    for(const input of [threshold,autoAttack,allowBeg])input.disabled=localBusy || view.busy;
    if(document.activeElement!==threshold)threshold.value=String(view.config.threshold);autoAttack.checked=view.config.autoAttack;allowBeg.checked=view.config.allowBeg;
    thresholdNote.textContent=view.config.threshold>=6?'当前不会因威胁等级中断。':'遇到威胁等级达到 '+view.config.threshold+' 的目标时中断。';
    const message=error || (typeof view.blocked==='string'?view.blocked:view.blocked?'当前无法发送。':'');status.textContent=message;status.hidden=!message;status.dataset.error=String(!!error);
    clamp();
  };
  const setCollapsed=value=>{if(!view.active || disposed)return;collapsed=value;stopGesture();if(value)miniPosition=position?{...position}:null;else position=miniPosition?{...miniPosition}:position;show();(value?mini:drag).focus({preventScroll:true});};
  const beginDrag=(event,node)=>{
    if(disposed || !view.active || gesture || event.isPrimary===false || event.button!==0)return;
    const rect=node.getBoundingClientRect();gesture={node,captureTarget:event.currentTarget,pointerId:event.pointerId,x:event.clientX,y:event.clientY,start:{x:rect.left,y:rect.top},moved:false};
    try{event.currentTarget.setPointerCapture(event.pointerId);}catch(_){}
  };
  const moveDrag=event=>{
    if(!gesture || gesture.pointerId!==event.pointerId)return;
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;if(Math.hypot(dx,dy)>5)gesture.moved=true;if(!gesture.moved)return;
    event.preventDefault();panel.dataset.dragging='true';const point=place(gesture.node,{x:gesture.start.x+dx,y:gesture.start.y+dy},gesture.start);
    if(gesture.node===mini)miniPosition=point;else position=point;
  };
  const finishDrag=event=>{if(!gesture || gesture.pointerId!==event.pointerId)return;ignoreMiniClick=gesture.node===mini && (gesture.moved || event.type==='pointercancel');stopGesture();};
  for(const [handle,node]of [[drag,panel],[mini,mini]]){
    listen(handle,'pointerdown',event=>beginDrag(event,node));listen(handle,'pointermove',moveDrag);listen(handle,'pointerup',finishDrag);listen(handle,'pointercancel',finishDrag);listen(handle,'lostpointercapture',()=>stopGesture());
    listen(handle,'keydown',event=>{const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},d=directions[event.key];if(!d || !view.active)return;event.preventDefault();const rect=node.getBoundingClientRect(),delta=event.shiftKey?40:10,p=place(node,{x:rect.left+d[0]*delta,y:rect.top+d[1]*delta},{x:rect.left,y:rect.top});if(node===mini)miniPosition=p;else position=p;});
  }
  listen(collapse,'click',()=>setCollapsed(true));listen(mini,'click',event=>{if(ignoreMiniClick && event.detail!==0){ignoreMiniClick=false;return;}ignoreMiniClick=false;setCollapsed(false);});
  listen(window,'resize',clamp);if(window.visualViewport){listen(window.visualViewport,'resize',clamp);listen(window.visualViewport,'scroll',clamp);}
  const changeConfig=async()=>{
    if(disposed || localBusy || view.busy)return;
    if(threshold.value==='' || !threshold.validity.valid){threshold.value=String(view.config.threshold);return;}
    const next=normalizeConfig({threshold:threshold.value,autoAttack:autoAttack.checked,allowBeg:allowBeg.checked});view.config=next;error='';show();
    try{await onConfig({...next});}catch(failure){if(disposed)return;error=failure?.message || String(failure);show();}
  };
  for(const input of [threshold,autoAttack,allowBeg])listen(input,'change',changeConfig);
  listen(send,'click',async()=>{
    if(send.disabled || disposed || localBusy)return;
    const token=++request;localBusy=true;error='';show();
    try{const result=await onSend();if(disposed || request!==token)return;if(result!==false){view.active=false;collapsed=false;stopGesture();}}
    catch(failure){if(disposed || request!==token)return;error=failure?.message || String(failure);}
    finally{if(!disposed && request===token){localBusy=false;show();}}
  });
  const render=value=>{
    if(disposed)return;
    const previousActive=view.active;view={active:value?.active===true,count:Math.max(0,Math.min(4,Math.floor(number(value?.count,0)))),logs:Array.isArray(value?.logs)?value.logs:[],busy:value?.busy===true,blocked:value?.blocked || false,config:normalizeConfig(value?.config)};
    if(previousActive && !view.active){request++;localBusy=false;collapsed=false;stopGesture();error='';}
    if(!previousActive && view.active)error='';
    const rows=view.logs.map(row=>({text:String(row?.text ?? ''),hasRaw:Object.hasOwn(row || {},'rawInstruction'),raw:String(row?.rawInstruction ?? '')})),signature=JSON.stringify(rows);
    if(signature!==logsSignature){const nearEnd=content.scrollHeight-content.scrollTop-content.clientHeight<36;log.replaceChildren();for(const row of rows){const item=make('li','hkmca-log-row');item.append(make('div','hkmca-log-text',row.text));if(row.hasRaw){const raw=make('details','hkmca-log-raw');raw.append(make('summary','','本次指令'),make('pre','',row.raw));item.append(raw);}log.append(item);}logsSignature=signature;if(nearEnd)content.scrollTop=content.scrollHeight;}
    empty.hidden=rows.length>0;show();
  };
  const confirm=({title='确认行动',details=[],submitLabel='确认',initialInstruction='',allowInstruction=true}={})=>{
    if(disposed)return Promise.resolve(null);if(modal)modal.finish(null);
    return new Promise(resolve=>{
      const previousFocus=document.activeElement,mask=make('div','hkmca-mask'),dialog=make('section','hkmca-dialog'),heading=make('h2','hkmca-dialog-title',title),detailList=make('ul','hkmca-details'),actions=make('div','hkmca-dialog-actions'),cancel=make('button','hkmca-cancel','取消'),submit=make('button','hkmca-submit',submitLabel),input=make('textarea','hkmca-instruction');
      heading.id='hkmca-confirm-title-'+Math.random().toString(36).slice(2);dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby',heading.id);dialog.tabIndex=-1;
      for(const detail of Array.isArray(details)?details:[])detailList.append(make('li','',detail));dialog.append(heading);if(detailList.children.length)dialog.append(detailList);
      input.value=String(initialInstruction ?? '');input.rows=4;input.setAttribute('aria-label','本次指令');
      if(allowInstruction){const label=make('label','hkmca-instruction-label','本次指令');label.append(input);dialog.append(label);}
      cancel.type='button';submit.type='button';actions.append(cancel,submit);dialog.append(actions);mask.append(dialog);root.append(mask);
      const oldOverflow=document.body.style.getPropertyValue('overflow'),oldPriority=document.body.style.getPropertyPriority('overflow');document.body.style.setProperty('overflow','hidden');
      const cleanups=[];let done=false;
      const bind=(target,type,handler,options)=>{target.addEventListener(type,handler,options);cleanups.push(()=>target.removeEventListener(type,handler,options));};
      const focusable=()=>[...dialog.querySelectorAll('button,input,textarea,[tabindex]')].filter(node=>!node.disabled && !node.hidden && node.getClientRects().length);
      const finish=result=>{
        if(done)return;done=true;cleanups.forEach(clean=>clean());mask.remove();if(document.body.style.getPropertyValue('overflow')==='hidden'){if(oldOverflow)document.body.style.setProperty('overflow',oldOverflow,oldPriority);else document.body.style.removeProperty('overflow');}
        if(modal?.mask===mask)modal=null;
        if(previousFocus?.isConnected && typeof previousFocus.focus==='function')previousFocus.focus({preventScroll:true});else if(view.active && !disposed)(collapsed?mini:drag).focus({preventScroll:true});resolve(result);
      };
      const submitValue=()=>finish(allowInstruction?input.value:String(initialInstruction ?? ''));
      bind(cancel,'click',()=>finish(null));bind(submit,'click',submitValue);bind(mask,'click',event=>{if(event.target===mask)finish(null);});
      bind(document,'keydown',event=>{
        if(event.isComposing)return;
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finish(null);return;}
        if(event.key==='Enter' && (event.ctrlKey || event.metaKey)){event.preventDefault();event.stopPropagation();submitValue();return;}
        if(event.key!=='Tab')return;
        const nodes=focusable(),first=nodes[0] || dialog,last=nodes.at(-1) || dialog,active=document.activeElement;
        if(!dialog.contains(active)){event.preventDefault();(event.shiftKey?last:first).focus();}
        else if(event.shiftKey && active===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey && active===last){event.preventDefault();first.focus();}
      },true);
      bind(document,'focusin',event=>{if(!dialog.contains(event.target))(focusable()[0] || dialog).focus({preventScroll:true});},true);
      modal={mask,finish};clamp();(allowInstruction?input:submit).focus({preventScroll:true});
    });
  };
  const dispose=()=>{if(disposed)return;disposed=true;request++;stopGesture();if(modal)modal.finish(null);disposers.splice(0).forEach(clean=>clean());root.remove();style.remove();};
  return {render,confirm,dispose};
}
