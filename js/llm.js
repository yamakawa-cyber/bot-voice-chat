// LLMアダプタ: stream(provider, {key,model,base}, system, messages, onDelta, signal)
const LLM={
 defaults:{gemini:'gemini-3.8-flash',openai:'gpt-4o-mini',xai:'grok-3-mini',custom:''},
 bases:{openai:'https://api.openai.com/v1',xai:'https://api.x.ai/v1'},
 async *sse(res){const rd=res.body.getReader(),dec=new TextDecoder();let buf='';
  for(;;){const{done,value}=await rd.read();if(done)break;buf+=dec.decode(value,{stream:true});
   let i;while((i=buf.indexOf('\n'))>=0){const l=buf.slice(0,i).trim();buf=buf.slice(i+1);
    if(l.trim().startsWith('data:')){const d=l.trim().slice(5).trim();if(d==='[DONE]')return;try{yield JSON.parse(d)}catch(e){}}}}},
 async stream(p,cfg,system,msgs,onDelta,signal){
  if(p==='mock')return this.mock(msgs,onDelta,signal);
  if(!cfg.key)throw new Error('APIキーが未設定です（⚙設定）');
  let res;
  if(p==='gemini'){let m=cfg.model||localStorage.vc_gem_auto||this.defaults.gemini;
   const call=(m,think)=>fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:streamGenerateContent?alt=sse`,{method:'POST',signal,
    headers:{'Content-Type':'application/json','x-goog-api-key':cfg.key},
    body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:msgs.filter(x=>x.content&&x.content.trim()).map(x=>({role:x.role==='user'?'user':'model',parts:[{text:x.content}]})),generationConfig:Object.assign({maxOutputTokens:4096,temperature:0.9},think?{thinkingConfig:{thinkingBudget:0}}:{})})});
   res=await call(m,false);
   for(let i=0;i<2&&[429,500,503].includes(res.status);i++){await new Promise(r=>setTimeout(r,800*(i+1)));res=await call(m,false)}
   if([429,500,503].includes(res.status)){for(const fb of ['gemini-3.8-flash-lite','gemini-flash-latest','gemini-flash-lite-latest'].filter(x=>x!==m)){const r2=await call(fb,false);if(r2.ok){res=r2;break}}}
   if(res.status===404){const nm=await this.pickGemini(cfg.key);if(nm){m=nm;localStorage.vc_gem_auto=nm;res=await call(m,false)}}
   await this.chk(res);let got=false,last=null;for await(const j of this.sse(res)){last=j;const t=j.candidates?.[0]?.content?.parts?.filter(x=>!x.thought).map(x=>x.text||'').join('');if(t){got=true;onDelta(t)}}
   if(!got){const r3=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`,{method:'POST',signal,headers:{'Content-Type':'application/json','x-goog-api-key':cfg.key},
     body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:msgs.filter(x=>x.content&&x.content.trim()).map(x=>({role:x.role==='user'?'user':'model',parts:[{text:x.content}]})),generationConfig:{maxOutputTokens:4096,temperature:0.9}})});
    await this.chk(r3);const j=await r3.json();const t=(j.candidates?.[0]?.content?.parts||[]).filter(x=>!x.thought).map(x=>x.text||'').join('');
    if(t)onDelta(t);else throw new Error('AIの返事が空でした（'+m+' / '+(j.candidates?.[0]?.finishReason||j.promptFeedback?.blockReason||'理由不明')+'）。この文字をみらいちゃんに送ってください：'+JSON.stringify(j).slice(0,300))}
  }else{const base=(p==='custom'?cfg.base:this.bases[p]).replace(/\/$/,'');
   res=await fetch(base+'/chat/completions',{method:'POST',signal,headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.key},
    body:JSON.stringify({model:cfg.model||this.defaults[p],stream:true,max_tokens:300,messages:[{role:'system',content:system},...msgs]})});
   await this.chk(res);for await(const j of this.sse(res)){const t=j.choices?.[0]?.delta?.content;if(t)onDelta(t)}}
 },
 async pickGemini(key){try{const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',{headers:{'x-goog-api-key':key}});if(!r.ok)return null;
  const ms=((await r.json()).models||[]).filter(x=>(x.supportedGenerationMethods||[]).includes('generateContent')).map(x=>x.name.replace('models/',''));
  const bad=/tts|image|live|embed|transcribe|vision|banana|audio/;const ok=ms.filter(n=>!bad.test(n));
  return ok.find(n=>/flash-latest/.test(n))||ok.find(n=>/flash/.test(n)&&!/lite|preview|exp/.test(n))||ok.find(n=>/flash/.test(n))||ok[0]||null}catch(e){return null}},
 async chk(r){if(!r.ok){let t='';try{t=(await r.text()).slice(0,200)}catch(e){}throw new Error(r.status===503||r.status===429?'AIが混み合っています（'+r.status+'）。少し待ってもう一度話しかけてください':'AIエラー '+r.status+' '+t)}},
 async mock(msgs,onDelta,signal){const s='はい、聞こえてますよ！これはテスト用の返事です。「'+msgs.at(-1).content.slice(0,20)+'」ですね。';
  for(const ch of s.match(/.{1,4}/gu)){if(signal?.aborted)throw new DOMException('abort','AbortError');await new Promise(r=>setTimeout(r,40));onDelta(ch)}}
};
if(typeof module!=='undefined')module.exports=LLM;
