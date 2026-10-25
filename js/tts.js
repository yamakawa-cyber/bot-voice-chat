// TTSアダプタ: speak(text,{pitch,rate}) -> Promise, stop()。VOICEVOX等はここに追加。
const TTS={
 engines:{
  browser:{q:Promise.resolve(),voice:null,
   pick(){const v=speechSynthesis.getVoices().filter(v=>v.lang.startsWith('ja'));this.voice=v.find(x=>/Google|Kyoko|Nanami|female/i.test(x.name))||v[0]||null},
   speak(t,o){return new Promise(res=>{const u=new SpeechSynthesisUtterance(t);u.lang='ja-JP';if(!this.voice)this.pick();if(this.voice)u.voice=this.voice;
    u.pitch=Math.min(2,o.pitch||1);u.rate=o.rate||1;u.onend=u.onerror=()=>res();speechSynthesis.speak(u)})},
   stop(){speechSynthesis.cancel()}},
  voicevox:{ // 例: ローカル/自前サーバの VOICEVOX ENGINE (http://.../audio_query → /synthesis)
   url:(typeof localStorage!=='undefined'&&localStorage.getItem('vc_vvurl'))||'',speaker:3,audio:null,
   async speak(t,o){if(!this.url)return TTS.engines.browser.speak(t,o);
    const q=await (await fetch(`${this.url}/audio_query?speaker=${this.speaker}&text=${encodeURIComponent(t)}`,{method:'POST'})).json();
    q.pitchScale=(o.pitch-1)*0.1;q.speedScale=o.rate;
    const b=await (await fetch(`${this.url}/synthesis?speaker=${this.speaker}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(q)})).blob();
    return new Promise(r=>{this.audio=new Audio(URL.createObjectURL(b));this.audio.onended=this.audio.onerror=r;this.audio.play().catch(r)})},
   stop(){this.audio?.pause()}}
 },
 cur:'browser',chain:Promise.resolve(),gen:0,
 enqueue(t,o){const g=this.gen;const e=this.engines[this.cur];this.chain=this.chain.then(()=>g===this.gen?e.speak(t,o):null);return this.chain},
 stop(){this.gen++;this.chain=Promise.resolve();Object.values(this.engines).forEach(e=>{try{e.stop()}catch(x){}})}
};
// 文ごとに区切る: 句点・！？・改行で切り出す
function splitSentences(buf){const out=[];let m;const re=/^[\s\S]*?[。！？!?\n]+/;while((m=buf.match(re))){const s=m[0].trim();if(s)out.push(s);buf=buf.slice(m[0].length)}return{out,rest:buf}}
if(typeof module!=='undefined')module.exports={TTS,splitSentences};
