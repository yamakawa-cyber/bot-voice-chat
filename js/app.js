const $=s=>document.querySelector(s);const LS=localStorage;
let personas=[],bot=null,busy=false,ctrl=null,rec=null,listening=false;
const cfg=()=>({prov:LS.vc_prov||'gemini',key:LS['vc_key_'+(LS.vc_prov||'gemini')]||'',model:LS.vc_model||'',base:LS.vc_base||'',limit:+LS.vc_limit||100,tts:LS.vc_tts||'browser'});
const today=()=>new Date().toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo'});
function count(){const c=JSON.parse(LS.vc_count||'{}');return c.d===today()?c.n:0}
function bump(){LS.vc_count=JSON.stringify({d:today(),n:count()+1});showCount()}
function showCount(){const c=cfg();$('#counter').textContent=count()+'/'+c.limit;$('#counter').style.background=count()>=c.limit?'#e0245e':''}
function show(id){['pick','chat','settings'].forEach(s=>$('#'+s).hidden=s!==id);$('#back').hidden=id==='pick'}
function sysPrompt(p){return `あなたは「${p.name}」です。ユーザー（呼び方:「${p.address_user.replace(/（.*?）/g,'')}」）と音声でおしゃべりしています。
一人称:「${p.first_person.replace(/（.*?）/g,'')}」
話し方: ${p.speech_style}
性格: ${p.personality}
口ぐせ: ${p.catchphrases.join(' / ')}
得意な話題: ${p.role_topics}
話し方の例: ${p.sample_lines.join(' / ')}
ルール: 返事は1〜3文の短い話し言葉で。読み上げられるので、絵文字・記号・箇条書き・URL・マークダウンは使わない。キャラを崩さない。わからないことは正直に言う。`}
const hist=id=>JSON.parse(LS['vc_h_'+id]||'[]');
const saveHist=(id,h)=>LS['vc_h_'+id]=JSON.stringify(h.slice(-20)); // 10往復
function addMsg(cls,t){const d=document.createElement('div');d.className='m '+cls;d.textContent=t;$('#log').append(d);$('#log').scrollTop=1e9;return d}
function openBot(p){bot=p;$('#title').textContent=p.name;$('#log').innerHTML='';hist(p.id).forEach(m=>addMsg(m.role==='user'?'u':'b',m.content));show('chat')}
async function send(text){text=text.trim();if(!text||busy)return;const c=cfg();
 if(count()>=c.limit){$('#status').textContent='今日の上限に達しました（⚙で変更できます）';return}
 busy=true;TTS.stop();TTS.cur=c.tts;stopRec(true);addMsg('u',text);
 const h=hist(bot.id);h.push({role:'user',content:text});const el=addMsg('b','…');let full='',buf='';
 ctrl=new AbortController();bump();$('#status').textContent='考え中…';const t0=performance.now();let first=true;
 try{await LLM.stream(c.prov,c,sysPrompt(bot),h.slice(-20),d=>{
   if(first){first=false;$('#status').textContent='話してます（'+((performance.now()-t0)/1000).toFixed(1)+'秒）'}
   full+=d;buf+=d;el.textContent=full;$('#log').scrollTop=1e9;
   const r=splitSentences(buf);buf=r.rest;r.out.forEach(s=>TTS.enqueue(clean(s),bot.voice))},ctrl.signal);
  if(buf.trim())TTS.enqueue(clean(buf),bot.voice);
  h.push({role:'assistant',content:full});saveHist(bot.id,h);
  TTS.chain.then(()=>{if(!busy&&$('#cont').checked&&!$('#chat').hidden)startRec()});
 }catch(e){el.textContent=e.name==='AbortError'?'（止めました）':'⚠ '+e.message;$('#status').textContent=''}
 busy=false}
const clean=s=>s.replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF*#_`>]/gu,'').trim();
// 音声入力
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
function startRec(){if(!SR){$('#status').textContent='この端末は音声入力に未対応です。文字で送ってください';return}
 TTS.stop();rec=new SR();rec.lang='ja-JP';rec.interimResults=true;let fin='';
 rec.onresult=e=>{let t='';for(const r of e.results){t+=r[0].transcript;if(r.isFinal)fin=t}$('#status').textContent='🎤 '+t};
 rec.onend=()=>{listening=false;$('#talk').classList.remove('on');$('#talk').textContent='🎤 押して話す';if(fin)send(fin);else if(!busy)$('#status').textContent=''};
 rec.onerror=e=>{$('#status').textContent='音声入力エラー: '+e.error};
 rec.start();listening=true;$('#talk').classList.add('on');$('#talk').textContent='🎤 聞いてます…（離すと送信）'}
function stopRec(abort){if(rec&&listening){abort?rec.abort():rec.stop()}}
// 押して話す（押している間）＋タップ切替
const tb=$('#talk');tb.addEventListener('pointerdown',e=>{e.preventDefault();if(!listening)startRec();else stopRec()});
tb.addEventListener('pointerup',()=>{if(listening&&!$('#cont').checked)setTimeout(()=>stopRec(),300)});
$('#tf').onsubmit=e=>{e.preventDefault();send($('#ti').value);$('#ti').value=''};
$('#stop').onclick=()=>{ctrl?.abort();TTS.stop();stopRec(true);$('#cont').checked=false};
$('#clear').onclick=()=>{if(confirm(bot.name+'との履歴を消しますか？')){LS.removeItem('vc_h_'+bot.id);$('#log').innerHTML=''}};
$('#back').onclick=()=>{$('#stop').onclick();$('#title').textContent='ボットとおしゃべり';show('pick')};
$('#gear').onclick=()=>{const c=cfg();$('#prov').value=c.prov;$('#key').value=c.key;$('#model').value=c.model;$('#base').value=c.base;$('#limit').value=c.limit;$('#tts').value=c.tts;show('settings')};
$('#prov').onchange=()=>{$('#key').value=LS['vc_key_'+$('#prov').value]||''};
$('#save').onclick=()=>{LS.vc_prov=$('#prov').value;LS['vc_key_'+$('#prov').value]=$('#key').value.trim();LS.vc_model=$('#model').value.trim();LS.vc_base=$('#base').value.trim();LS.vc_limit=Math.max(1,+$('#limit').value||100);LS.vc_tts=$('#tts').value;showCount();show('pick')};
async function init(){const ids=await (await fetch('personas/index.json')).json();
 personas=await Promise.all(ids.map(i=>fetch('personas/'+i+'.json').then(r=>r.json())));
 $('#bots').innerHTML='';personas.forEach(p=>{const li=document.createElement('li'),b=document.createElement('button');
  b.textContent=p.name;const s=document.createElement('small');s.textContent=p.role_topics;b.append(s);b.onclick=()=>openBot(p);li.append(b);$('#bots').append(li)});
 showCount();if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');if(navigator.storage?.persist)navigator.storage.persist()}
init();
