// LLMアダプタ: stream(provider, {key,model,base}, system, messages, onDelta, signal)
const LLM={
 defaults:{gemini:'gemini-2.5-flash',openai:'gpt-4o-mini',xai:'grok-3-mini',custom:''},
 bases:{openai:'https://api.openai.com/v1',xai:'https://api.x.ai/v1'},
 async *sse(res){const rd=res.body.getReader(),dec=new TextDecoder();let buf='';
  for(;;){const{done,value}=await rd.read();if(done)break;buf+=dec.decode(value,{stream:true});
   let i;while((i=buf.indexOf('\n'))>=0){const l=buf.slice(0,i).trim();buf=buf.slice(i+1);
    if(l.startsWith('data:')){const d=l.slice(5).trim();if(d==='[DONE]')return;try{yield JSON.parse(d)}catch(e){}}}}},
 async stream(p,cfg,system,msgs,onDelta,signal){
  if(p==='mock')return this.mock(msgs,onDelta,signal);
  if(!cfg.key)throw new Error('APIキーが未設定です（⚙設定）');
  let res;
  if(p==='gemini'){const m=cfg.model||this.defaults.gemini;
   res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:streamGenerateContent?alt=sse`,{method:'POST',signal,
    headers:{'Content-Type':'application/json','x-goog-api-key':cfg.key},
    body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:msgs.map(x=>({role:x.role==='user'?'user':'model',parts:[{text:x.content}]})),generationConfig:{maxOutputTokens:300,temperature:0.9,thinkingConfig:{thinkingBudget:0}}})});
   await this.chk(res);for await(const j of this.sse(res)){const t=j.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('');if(t)onDelta(t)}
  }else{const base=(p==='custom'?cfg.base:this.bases[p]).replace(/\/$/,'');
   res=await fetch(base+'/chat/completions',{method:'POST',signal,headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.key},
    body:JSON.stringify({model:cfg.model||this.defaults[p],stream:true,max_tokens:300,messages:[{role:'system',content:system},...msgs]})});
   await this.chk(res);for await(const j of this.sse(res)){const t=j.choices?.[0]?.delta?.content;if(t)onDelta(t)}}
 },
 async chk(r){if(!r.ok){let t='';try{t=(await r.text()).slice(0,200)}catch(e){}throw new Error('AIエラー '+r.status+' '+t)}},
 async mock(msgs,onDelta,signal){const s='はい、聞こえてますよ！これはテスト用の返事です。「'+msgs.at(-1).content.slice(0,20)+'」ですね。';
  for(const ch of s.match(/.{1,4}/gu)){if(signal?.aborted)throw new DOMException('abort','AbortError');await new Promise(r=>setTimeout(r,40));onDelta(ch)}}
};
if(typeof module!=='undefined')module.exports=LLM;
