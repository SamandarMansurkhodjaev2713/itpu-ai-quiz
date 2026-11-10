(() => {
  'use strict';
  const C = window.ITPU_CONFIG;
  const Q = window.ITPU_QUESTIONS;
  const WORDS = window.ITPU_COPY;
  const DEMO = C.mode === 'demo';
  const LANGS = ['ru','uz','en'];
  const root = document.getElementById('screen');
  const wipe = document.getElementById('wipe');
  const dialog = document.getElementById('privacy-dialog');
  const toast = document.getElementById('toast');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const STORAGE = 'itpu-ai-quiz-progress-v3';
  const st = {language:0,stage:'intro',session:null,index:0,answers:[],orders:{},deadlineEpoch:0,locked:false,result:null,recap:false,processing:false,pending:null};
  let frame=0,timeout=0,transitioning=false,toastTimeout=0;

  const L = value => Array.isArray(value) ? value[st.language] : value;
  const T = name => L(WORDS[name]) || name;
  const E = str => String(str??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
  const randomId = () => crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
  const btn = (label,action='')=>`<button class="main-button" type="button" data-action="${action}"><span>${E(label)}</span><span class="button-arrow" aria-hidden="true">↗</span></button>`;

  function save(){
    try{
      if(!st.session){sessionStorage.removeItem(STORAGE);return;}
      sessionStorage.setItem(STORAGE,JSON.stringify({at:Date.now(),stage:st.stage,session:st.session,index:st.index,answers:st.answers,orders:st.orders,deadlineEpoch:st.deadlineEpoch,result:st.result,pending:st.pending}));
    }catch(_){}
  }
  function restore(){
    try{
      const d=JSON.parse(sessionStorage.getItem(STORAGE)||'null');
      if(!d||!d.session||Date.now()-d.at>2*60*60*1000)return;
      if(!['ready','quiz','wait','result','error'].includes(d.stage))return;
      st.session=d.session;st.index=Math.min(9,Math.max(0,d.index|0));st.answers=Array.isArray(d.answers)?d.answers:[];
      st.orders=d.orders||{};st.deadlineEpoch=Number(d.deadlineEpoch)||0;st.result=d.result||null;st.pending=d.pending||null;
      st.stage=d.stage==='wait'?'error':d.stage;
      if(DEMO && st.stage==='quiz' && st.answers.some(a=>a.id===Q[st.index].id)){if(st.index===9)st.stage='error';else {st.index++;st.deadlineEpoch=0;}}
      if(st.pending&&!DEMO)st.stage='error';
      if(st.stage==='result'&&!st.result)st.stage='error';
    }catch(_){}
  }
  function setLanguage(lang){
    if(!LANGS.includes(lang))return;
    const oldForm=document.getElementById('lead-form');
    const values=oldForm?Array.from(oldForm.elements).filter(el=>el.name).map(el=>({name:el.name,value:el.value,checked:el.checked})):[];
    st.language=LANGS.indexOf(lang);
    document.documentElement.lang=lang;
    document.getElementById('brand-caption').textContent=T('brand');
    document.querySelectorAll('[data-lang]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===lang)));
    document.getElementById('privacy-title').textContent=T('privacyTitle');
    document.getElementById('privacy-copy').textContent=T('privacyBody');
    document.getElementById('privacy-link').textContent=T('privacyOfficial')+' ↗';
    document.getElementById('privacy-link').href=C.privacyUrl;
    document.getElementById('privacy-close').setAttribute('aria-label',T('close'));
    if(DEMO){const ribbon=document.getElementById('demo-ribbon');if(ribbon)ribbon.textContent=T('demo');}
    if(st.stage==='quiz'){cancelAnimationFrame(frame);render();timer(false);}else render();
    const newForm=document.getElementById('lead-form');
    if(newForm){values.forEach(item=>{const el=newForm.elements.namedItem(item.name);if(el){el.value=item.value;el.checked=item.checked;}});const minor=newForm.elements.age.value==='minor';document.getElementById('guardian-row').hidden=!minor;document.getElementById('minor-notice').hidden=!minor;}
    try{localStorage.setItem('itpu-ai-quiz-lang',lang);}catch(_){}
  }
  function initialLanguage(){
    const query=new URLSearchParams(location.search).get('lang');
    if(LANGS.includes(query))return query;
    try{const stored=localStorage.getItem('itpu-ai-quiz-lang');if(LANGS.includes(stored))return stored;}catch(_){}
    const browser=(navigator.language||'ru').toLowerCase();
    return browser.startsWith('uz')?'uz':browser.startsWith('en')?'en':'ru';
  }
  function toastMessage(message){clearTimeout(toastTimeout);toast.textContent=message;toast.classList.add('show');toastTimeout=setTimeout(()=>toast.classList.remove('show'),3200);}
  function enterStage(stage){st.stage=stage;document.body.dataset.stage=stage;save();render();window.scrollTo?.(0,0);root.focus({preventScroll:true});}
  function transition(stage,after){
    cancelAnimationFrame(frame);clearTimeout(timeout);
    if(transitioning)return;
    if(reduced.matches){enterStage(stage);after?.();return;}
    transitioning=true;wipe.classList.remove('leave');wipe.classList.add('cover');
    setTimeout(()=>{enterStage(stage);wipe.classList.remove('cover');wipe.classList.add('leave');setTimeout(()=>{wipe.classList.remove('leave');transitioning=false;after?.();},490);},460);
  }

  function intro(){return `<section class="hero" aria-labelledby="hero-title">
    <div class="hero-copy"><div class="eyebrow">${E(T('eyebrow'))}</div>
      <h1 id="hero-title"><span>${E(T('heroA'))}</span><span>${E(T('heroB'))}</span></h1>
      <p class="hero-lead">${E(T('heroText'))}</p>${btn(T('start'),'intro-start')}
      <p class="hero-note">${E(T('introHint'))}</p>
      <div class="hero-stats"><div class="stat"><strong>10</strong><span>${E(T('questions'))}</span></div><div class="stat"><strong>10s</strong><span>${E(T('seconds'))}</span></div><div class="stat"><strong>8/10</strong><span>${E(T('prize'))}</span></div></div>
    </div><div class="hero-visual" aria-hidden="true"><small>NEURAL FIELD / 001</small><div class="orb-wrap"><div class="orb-glow"></div><div class="orb-ring"></div><div class="orb-ring orb-ring--two"></div><div class="orb-ring orb-ring--three"></div><div class="orb"></div><div class="orb-chip">AI / HUMAN INTERFACE<b>001—010</b></div></div></div>
  </section>`;}
  function formMarkup(){return `<section class="form-shell" aria-labelledby="form-heading">
    <aside class="form-aside"><div class="eyebrow">${E(T('regKicker'))}</div><div class="form-aside-num" aria-hidden="true">01</div><div><h2>${E(T('regTitle'))}</h2><p>${E(T('regDesc'))}</p></div></aside>
    <div class="form-panel"><p class="form-kicker">ITPU / AI CHALLENGE</p><h1 id="form-heading">${E(T('regTitle'))}</h1><p class="form-desc">${E(T('regDesc'))}</p>
      <form id="lead-form" novalidate><div class="form-grid">
        <label class="field full"><span>${E(T('name'))} *</span><input name="fullname" maxlength="90" autocomplete="name" required placeholder="${E(T('namePlaceholder'))}"></label>
        <label class="field phone"><span>${E(T('phone'))} *</span><input name="phone" type="tel" inputmode="tel" maxlength="22" autocomplete="tel" placeholder="+998 90 123 45 67" required></label>
        <label class="field"><span>${E(T('grade'))} *</span><select name="grade" required><option value="">${E(T('gradeChoose'))}</option><option value="10">${E(T('grade10'))}</option><option value="11">${E(T('grade11'))}</option><option value="other">${E(T('gradeOther'))}</option></select></label>
        <label class="field"><span>${E(T('school'))} <small>(${E(T('optional'))})</small></span><input name="school" maxlength="100" placeholder="${E(T('schoolPlaceholder'))}"></label>
        <label class="field"><span>${E(T('age'))} *</span><select name="age" required><option value="">${E(T('ageChoose'))}</option><option value="minor">${E(T('minor'))}</option><option value="adult">${E(T('adult'))}</option></select></label>
      </div><div class="notice" id="minor-notice" hidden>${E(T('minorNotice'))}</div>
      <label class="check" id="guardian-row" hidden><input name="guardian" type="checkbox"><span>${E(T('guardian'))}</span></label>
      <label class="check"><input name="consent" type="checkbox" required><span>${E(T('consent'))}</span></label>
      <label class="check"><input name="marketing" type="checkbox"><span>${E(T('marketing'))}</span></label>
      <div style="margin-top:8px"><button type="button" class="text-link" data-action="privacy">${E(T('privacy'))}</button></div>
      <div class="reg-actions"><p id="reg-error" class="reg-error" role="alert" hidden></p><button type="submit" id="reg-submit" class="main-button"><span>${E(T('register'))}</span><span class="button-arrow" aria-hidden="true">↗</span></button><button type="button" class="guest" data-action="guest">${E(T('guest'))}</button></div>
      </form></div>
  </section>`;}
  function ready(){return `<section class="ready" aria-labelledby="ready-heading"><div class="eyebrow">${E(T('readyKicker'))}</div><div class="ready-number" aria-hidden="true">10</div><h1 id="ready-heading">${E(T('readyTitle'))}</h1><p>${E(T('readyText'))}</p>${btn(T('readyGo'),'quiz-start')}</section>`;}
  function orderFor(q){
    if(st.orders[q.id]?.length===5)return st.orders[q.id];
    const arr=[0,1,2,3,4];for(let i=4;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[arr[i],arr[j]]=[arr[j],arr[i]];}
    st.orders[q.id]=arr;return arr;
  }
  function quizMarkup(){
    const q=Q[st.index];const order=orderFor(q);
    return `<section class="quiz-shell" id="quiz-shell" aria-labelledby="question-title">
      <div class="quiz-head"><div class="quiz-index">${E(T('question'))} <b>${String(st.index+1).padStart(2,'0')}</b> / 10</div><small>ITPU AI EXPERIENCE</small></div>
      <div class="progress" role="progressbar" aria-valuenow="${st.index+1}" aria-valuemin="1" aria-valuemax="10"><span style="width:${st.index*10}%"></span></div>
      <div class="quiz-grid"><div class="question-side"><div><div class="question-tag">${E(L(q.tag))}</div><h1 id="question-title">${E(L(q.q))}</h1></div>
        <div class="timer-block"><div class="timer" role="timer" aria-label="${E(T('left'))}"><svg viewBox="0 0 110 110" aria-hidden="true"><circle class="timer-track" cx="55" cy="55" r="48"/><circle id="timer-progress" class="timer-progress" cx="55" cy="55" r="48" stroke-dasharray="301.593" stroke-dashoffset="0"/></svg><strong id="time-count">10</strong></div><div class="timer-label"><span>${E(T('left'))}</span><b id="quiz-hint">${E(T('choose'))}</b></div></div>
      </div><div class="answers" role="group" aria-label="${E(T('choose'))}">${order.map((answerIndex,i)=>`<button class="answer" type="button" data-action="answer" data-answer="${answerIndex}"><span class="answer-key" aria-hidden="true">${'ABCDE'[i]}</span><span class="answer-text">${E(L(q.a[answerIndex]))}</span><span class="answer-arrow" aria-hidden="true">↗</span></button>`).join('')}</div></div>
      <div class="quiz-foot"><span>ITPU / THINK FORWARD</span><span class="bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div>
    </section>`;
  }
  function waitMarkup(){return `<section class="ready" aria-live="polite"><div class="eyebrow">ITPU / FINAL SYNC</div><div class="ready-number" aria-hidden="true">AI</div><h1>${E(T('scoreCalc'))}</h1><span class="bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span></section>`;}
  function errorMarkup(){return `<section class="ready"><div class="eyebrow">ITPU / CONNECTION</div><h1>${E(T('scoreFail'))}</h1>${btn(T('retry'),'retry-score')}</section>`;}
  function tier(score){return score===10?4:score>=8?3:score>=6?2:score>=4?1:0;}
  function resultMarkup(){
    const r=st.result,s=r.score,eligible=s>=C.prizeAt&&!st.session.guest;
    const guestOrDemo=DEMO||st.session.guest;
    return `<section class="results" aria-labelledby="result-title"><div class="result-main"><div class="eyebrow">${E(T('resultKicker'))}</div><h1 id="result-title">${E(T('resultTitle'))}</h1><div class="score"><strong>${s}</strong><span>${E(T('outOf'))}</span></div><span class="result-badge">${['AI ROOKIE','AI EXPLORER','AI THINKER','AI VISIONARY','AI PIONEER'][tier(s)]}</span><p>${E(T('tier'+tier(s)))}</p>
      <div class="result-tools"><button class="secondary-button" type="button" data-action="share">↗ ${E(T('share'))}</button>${DEMO?`<button class="secondary-button" type="button" data-action="replay">↺ ${E(T('replay'))}</button>`:''}</div></div>
      <div class="result-card"><span class="micro">ITPU / NEXT LEVEL</span><h2>${E(eligible?T('eligible'):T('ctaTitle'))}</h2><p>${E(guestOrDemo?T('demoPrize'):(eligible?T('prizeInstructions'):T('noPrize')))}</p>
        ${eligible?`<div class="claim"><small>${E(T('code'))}</small><strong>${E(r.claimCode||'ITPU-******')}</strong></div>`:''}
        <a class="main-button" href="${E(C.admissions[LANGS[st.language]])}" target="_blank" rel="noopener noreferrer"><span>${E(T('cta'))}</span><span class="button-arrow" aria-hidden="true">↗</span></a>
      </div><div class="recap"><button class="recap-toggle" type="button" data-action="recap" aria-expanded="${st.recap}">${E(st.recap?T('recapClose'):T('recapOpen'))}<span aria-hidden="true">+</span></button><div class="recap-list" id="recap-list" ${st.recap?'':'hidden'}>${st.recap?recapMarkup():''}</div></div>
    </section>`;
  }
  function recapMarkup(){return Q.map((q,i)=>{
    const chosen=st.answers.find(a=>a.id===q.id),correct=st.result.correct[q.id],ok=chosen&&chosen.answer===correct;
    const wrong=chosen?.answer===null||!chosen?'':`<div class="wrong">${E(T('yourAnswer'))}: ${E(L(q.a[chosen.answer]))}</div>`;
    return `<article class="recap-item"><small>${E(T('question'))} ${String(i+1).padStart(2,'0')} · ${ok?'✓':'×'}</small><h3>${E(L(q.q))}</h3>${ok?'':(wrong||`<div class="wrong">${E(T('skipped'))}</div>`)}<div>✓ ${E(T('correct'))}: ${E(L(q.a[correct]))}</div>${q.why?`<p>${E(L(q.why))}</p>`:''}</article>`;
  }).join('');}
  function render(){
    root.classList.remove('enter');void root.offsetWidth;root.classList.add('enter');
    switch(st.stage){case 'intro':root.innerHTML=intro();break;case 'form':root.innerHTML=formMarkup();break;case 'ready':root.innerHTML=ready();break;case 'quiz':root.innerHTML=quizMarkup();break;case 'wait':root.innerHTML=waitMarkup();break;case 'error':root.innerHTML=errorMarkup();break;case 'result':root.innerHTML=resultMarkup();break;default:root.innerHTML=intro();}
    save();
  }
  function phoneNumber(text){let n=String(text||'').replace(/\D/g,'');if(n.length===9)n='998'+n;return /^998\d{9}$/.test(n)?'+'+n:null;}
  function formError(message){const el=document.getElementById('reg-error');if(el){el.textContent=message;el.hidden=false;}}
  async function register(form){
    if(st.processing)return;
    const name=form.elements.fullname.value.trim().replace(/\s+/g,' '),phone=phoneNumber(form.elements.phone.value),grade=form.elements.grade.value,school=form.elements.school.value.trim(),age=form.elements.age.value;
    const consent=!!form.elements.consent.checked,guardian=!!form.elements.guardian.checked,marketing=!!form.elements.marketing.checked;
    if(name.length<2)return formError(T('errName'));
    if(!phone)return formError(T('errPhone'));
    if(!grade||!age)return formError(T('ageChoose'));
    if(age==='minor'&&!guardian)return formError(T('errGuardian'));
    if(!consent)return formError(T('errConsent'));
    if(!DEMO&&(!C.consentApproved||!C.endpoint))return formError(T('regUnavailable'));
    const button=document.getElementById('reg-submit');button.disabled=true;button.firstElementChild.textContent=T('sending');st.processing=true;
    // Reuse the same ID after a network failure. A successful POST might have
    // reached Google Sheets even if the browser did not receive confirmation.
    const pendingKey='itpu-quiz-pending-registration';
    let pending=null;
    try{pending=JSON.parse(sessionStorage.getItem(pendingKey)||'null');}catch(_){}
    const id=pending?.phone===phone&&pending?.id?pending.id:randomId();
    try{sessionStorage.setItem(pendingKey,JSON.stringify({phone,id}));}catch(_){}
    try{
      if(!DEMO){const response=await submitBridge({action:'register',id,eventId:C.eventId,name,phone,grade,school,age,guardian,consent,marketing,lang:LANGS[st.language],consentVersion:'ITPU-QUIZ-DRAFT-V1'},'registered');if(response.status==='duplicate')throw new Error('duplicate');if(response.status!=='registered')throw new Error('unconfirmed');}
      try{sessionStorage.removeItem(pendingKey);}catch(_){}
      st.session={id,guest:false};st.answers=[];st.orders={};st.index=0;st.result=null;st.deadlineEpoch=0;transition('ready');
    }catch(err){formError(err.message==='duplicate'?T('duplicate'):T('regFail'));button.disabled=false;button.firstElementChild.textContent=T('register');}finally{st.processing=false;}
  }
  function guest(){st.session={id:randomId(),guest:true};st.answers=[];st.orders={};st.index=0;st.result=null;st.deadlineEpoch=0;transition('ready');}
  function startQuiz(){if(!st.session||transitioning)return;st.answers=[];st.orders={};st.index=0;st.deadlineEpoch=0;st.locked=false;if(DEMO)transition('quiz',()=>timer(true));else {st.pending={action:'start',id:st.session.id,eventId:C.eventId,guest:st.session.guest};liveStep();}}
  function timer(newQuestion){
    cancelAnimationFrame(frame);
    if(st.stage!=='quiz'||st.locked)return;
    if(newQuestion||!st.deadlineEpoch)st.deadlineEpoch=Date.now()+C.seconds*1000;
    save();
    const value=document.getElementById('time-count'),ring=document.getElementById('timer-progress'),shell=document.getElementById('quiz-shell');if(!value||!ring)return;
    const run=()=>{
      if(st.stage!=='quiz'||st.locked)return;
      const left=Math.max(0,st.deadlineEpoch-Date.now());
      value.textContent=String(Math.ceil(left/1000));ring.setAttribute('stroke-dashoffset',String(301.593*(1-left/(C.seconds*1000))));shell.classList.toggle('urgent',left<=3000);
      if(left<=0){choose(null);return;}frame=requestAnimationFrame(run);
    };run();
  }
  function choose(answer){
    if(st.stage!=='quiz'||st.locked)return;
    if(Date.now()>=st.deadlineEpoch)answer=null;
    st.locked=true;cancelAnimationFrame(frame);
    const q=Q[st.index],elapsed=answer===null?C.seconds*1000:Math.max(0,Math.min(C.seconds*1000,C.seconds*1000-(st.deadlineEpoch-Date.now())));
    st.answers=st.answers.filter(a=>a.id!==q.id);st.answers.push({id:q.id,answer,timeMs:Math.round(elapsed)});
    document.querySelectorAll('.answer').forEach(b=>{b.disabled=true;if(Number(b.dataset.answer)===answer)b.classList.add('selected');else b.classList.add('locked');});
    document.getElementById('quiz-hint').textContent=answer===null?T('timeout'):T('locked');save();
    if(!DEMO){st.pending={action:'answer',id:st.session.id,eventId:C.eventId,index:st.index,answer};save();timeout=setTimeout(()=>{st.locked=false;liveStep();},250);return;}
    timeout=setTimeout(()=>{
      st.locked=false;
      if(st.index===9){finish();return;}
      st.index++;st.deadlineEpoch=0;render();timer(true);
    },answer===null?310:470);
  }
  async function liveStep(){
    if(st.processing||!st.pending)return;
    st.processing=true;cancelAnimationFrame(frame);enterStage('wait');
    try{
      const payload=st.pending,result=await submitBridge(payload,payload.action==='start'?'playing':'advanced');
      if(result.status==='finished'){
        if(!Number.isInteger(result.score)||!result.correct||!Array.isArray(result.answers))throw new Error('Invalid result');
        st.pending=null;st.locked=false;st.answers=result.answers;st.result={score:result.score,correct:result.correct,claimCode:result.claimCode||''};st.recap=false;st.deadlineEpoch=0;transition('result');
      }else{
        if(result.status!=='playing'||!Number.isInteger(result.index)||result.index<0||result.index>9)throw new Error('Invalid progress');
        st.pending=null;st.locked=false;st.index=result.index;st.deadlineEpoch=Date.now()+Math.max(0,Math.min(10000,Number(result.remainingMs)||0));enterStage('quiz');timer(false);
      }
    }catch(err){enterStage('error');}finally{st.processing=false;}
  }
  async function finish(){
    if(st.processing||!st.session)return;
    st.processing=true;cancelAnimationFrame(frame);enterStage('wait');
    try{
      let result;
      if(DEMO){await sleep(750);const key=window.ITPU_DEMO_ANSWERS;if(!key)throw new Error('Demo key missing');result={status:'finished',score:st.answers.reduce((score,a)=>score+(a.answer===key[a.id]?1:0),0),correct:key,claimCode:'DEMO-'+st.session.id.replace(/-/g,'').slice(-6).toUpperCase()};}
      else throw new Error('Live results require a server-controlled session');
      st.result={score:result.score,correct:result.correct,claimCode:result.claimCode||''};st.recap=false;st.deadlineEpoch=0;transition('result');
    }catch(err){enterStage('error');}finally{st.processing=false;}
  }
  function jsonp(id){return new Promise((resolve,reject)=>{
    const callback='itpuStatus_'+randomId().replace(/-/g,'').slice(0,16),url=new URL(C.endpoint),script=document.createElement('script');
    url.searchParams.set('action','status');url.searchParams.set('id',id);url.searchParams.set('prefix',callback);
    const cleanup=()=>{clearTimeout(timeoutId);delete window[callback];script.remove();};
    const timeoutId=setTimeout(()=>{cleanup();reject(new Error('Status timed out'));},3900);
    window[callback]=data=>{cleanup();resolve(data);};script.onerror=()=>{cleanup();reject(new Error('Status failed'));};script.src=url.toString();document.head.appendChild(script);
  });}
  async function submitBridge(payload,required){
    if(!/^https:\/\/script\.google\.com\/macros\/s\//.test(C.endpoint))throw new Error('Invalid endpoint');
    // Apps Script is quota-limited. Three idempotent attempts allow recovery
    // from bursts or temporary failures without creating duplicate leads.
    for(let attempt=0;attempt<3;attempt++){
      if(attempt)await sleep(350+attempt*550);
      const form=document.createElement('form'),hidden=document.createElement('input');form.action=C.endpoint;form.method='POST';form.target='itpu-post-target';form.hidden=true;hidden.name='payload';hidden.value=JSON.stringify(payload);form.appendChild(hidden);document.body.appendChild(form);form.submit();form.remove();
      for(const pause of [300,550,950,1500,2400,3200]){
        await sleep(pause);
        let status;try{status=await jsonp(payload.id);}catch(_){continue;}
        if(status?.status===required||status?.status==='duplicate'||(payload.action==='start'&&status?.status==='finished')||(required==='advanced'&&(status?.status==='finished'||(status?.status==='playing'&&status.index>payload.index))))return status;
        if(status?.status==='error')break;
      }
    }
    throw new Error('No confirmation');
  }
  async function share(){const message=`ITPU AI Quiz — ${st.result.score}/10\n${location.href.split('?')[0]}`;if(navigator.share){try{await navigator.share({title:'ITPU AI Quiz',text:message});return;}catch(e){if(e.name==='AbortError')return;}}try{await navigator.clipboard.writeText(message);toastMessage(T('copied'));}catch(_){toastMessage(message);}}
  function replay(){st.session=null;st.answers=[];st.orders={};st.index=0;st.result=null;st.recap=false;save();transition('intro');}
  function ambient(){
    const canvas=document.getElementById('ambient-canvas'),ctx=canvas?.getContext('2d');if(!ctx)return;
    let width=0,height=0,dpr=1,last=0;
    const resize=()=>{width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,1.6);canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);};resize();addEventListener('resize',resize,{passive:true});
    let ambientFrame=0;
    const draw=time=>{ambientFrame=requestAnimationFrame(draw);if(time-last<50)return;last=time;ctx.clearRect(0,0,width,height);const count=width<620?17:39,seed=time*.00012,points=[];
      for(let i=0;i<count;i++){const angle=i*2.39996+seed,r=Math.sqrt((i+.3)/count)*Math.min(width,height)*(width<620?.43:.69);points.push([width*(width<620?.57:.73)+Math.cos(angle)*r+Math.sin(seed*3+i)*4,height*.5+Math.sin(angle)*r]);}
      for(let i=0;i<points.length;i++){const a=points[i];for(let j=i+1;j<Math.min(points.length,i+5);j++){const b=points[j],dist=Math.hypot(a[0]-b[0],a[1]-b[1]);if(dist>Math.min(width,height)*.25)continue;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.strokeStyle=`rgba(100,177,238,${Math.max(.02,.15-dist/1600)})`;ctx.lineWidth=.7;ctx.stroke();}ctx.beginPath();ctx.arc(a[0],a[1],i%6===0?2:1.1,0,Math.PI*2);ctx.fillStyle=i%6===0?'#72c7ff78':'#5ab2ef37';ctx.fill();}
    };
    const sync=()=>{cancelAnimationFrame(ambientFrame);ambientFrame=0;if(!document.hidden&&!reduced.matches)ambientFrame=requestAnimationFrame(draw);else ctx.clearRect(0,0,width,height);};
    document.addEventListener('visibilitychange',sync);reduced.addEventListener?.('change',sync);sync();
  }
  root.addEventListener('click',event=>{
    const button=event.target.closest('[data-action]');if(!button)return;
    switch(button.dataset.action){
      case 'intro-start':transition('form');break;
      case 'privacy':dialog.showModal();break;
      case 'guest':guest();break;
      case 'quiz-start':startQuiz();break;
      case 'answer':choose(Number(button.dataset.answer));break;
      case 'retry-score':if(!DEMO){st.pending=st.pending||{action:'start',id:st.session.id,eventId:C.eventId,guest:st.session.guest};liveStep();}else finish();break;
      case 'recap':st.recap=!st.recap;render();break;
      case 'share':share();break;
      case 'replay':replay();break;
    }
  });
  root.addEventListener('submit',event=>{if(event.target.id!=='lead-form')return;event.preventDefault();register(event.target);});
  root.addEventListener('change',event=>{if(event.target.name==='age'){const minor=event.target.value==='minor';document.getElementById('guardian-row').hidden=!minor;document.getElementById('minor-notice').hidden=!minor;}});
  document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>setLanguage(b.dataset.lang)));
  document.getElementById('privacy-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  restore();setLanguage(initialLanguage());
  if(DEMO){const ribbon=document.createElement('div');ribbon.id='demo-ribbon';ribbon.className='demo-ribbon';ribbon.textContent=T('demo');document.body.appendChild(ribbon);}
  if(st.stage==='quiz')timer(false);
  ambient();
})();
