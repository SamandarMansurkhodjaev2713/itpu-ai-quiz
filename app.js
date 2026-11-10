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
  const STORAGE = 'itpu-ai-quiz-progress-v4';
  const st = {language:0,stage:'intro',session:null,index:0,answers:[],orders:{},deadlineEpoch:0,locked:false,result:null,recap:false,processing:false,pending:null};
  let frame=0,timeout=0,transitioning=false,queuedTransition=null,toastTimeout=0;

  const L = value => Array.isArray(value) ? value[st.language] : value;
  const T = name => L(WORDS[name]) || name;
  const E = str => String(str??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
  const randomId = () => crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
  const btn = (label,action='')=>`<button class="main-button" type="button" data-action="${action}"><span>${E(label)}</span><span class="button-arrow" aria-hidden="true"></span></button>`;

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
    if(!LANGS.includes(lang)||st.processing)return;
    const oldForm=document.getElementById('lead-form')||document.getElementById('contact-form');
    const values=oldForm?Array.from(oldForm.elements).filter(el=>el.name&&(el.type!=='radio'||el.checked)).map(el=>({name:el.name,value:el.value})):[];
    st.language=LANGS.indexOf(lang);
    document.documentElement.lang=lang;
    document.getElementById('brand-caption').textContent=T('brand');
    document.querySelectorAll('[data-lang]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===lang)));
    document.getElementById('privacy-title').textContent=T('privacyTitle');
    document.getElementById('privacy-copy').textContent=T('privacyBody');
    document.getElementById('privacy-link').textContent=T('privacyOfficial');
    document.getElementById('privacy-link').href=C.privacyUrl;
    document.getElementById('privacy-close').setAttribute('aria-label',T('close'));
    if(DEMO){const ribbon=document.getElementById('demo-ribbon');if(ribbon)ribbon.textContent=T('demo');}
    if(st.stage==='quiz'){cancelAnimationFrame(frame);render();timer(false);}else render();
    const newForm=document.getElementById('lead-form')||document.getElementById('contact-form');
    if(newForm){values.forEach(item=>{const el=newForm.elements.namedItem(item.name);if(el)el.value=item.value;});if(newForm.id==='lead-form'){const minor=newForm.elements.age.value==='minor';document.getElementById('minor-notice').hidden=!minor;}}
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
    if(transitioning){queuedTransition={stage,after};return;}
    if(reduced.matches){enterStage(stage);after?.();return;}
    transitioning=true;wipe.classList.remove('leave');wipe.classList.add('cover');
    setTimeout(()=>{enterStage(stage);wipe.classList.remove('cover');wipe.classList.add('leave');setTimeout(()=>{wipe.classList.remove('leave');transitioning=false;after?.();if(queuedTransition){const next=queuedTransition;queuedTransition=null;transition(next.stage,next.after);}},260);},240);
  }

  function intro(){return `<section class="hero" aria-labelledby="hero-title">
    <div class="hero-copy"><div class="eyebrow">${E(T('eyebrow'))}</div>
      <h1 id="hero-title"><span>${E(T('heroA'))}</span><span>${E(T('heroB'))}</span></h1>
      <p class="hero-lead">${E(T('heroText'))}</p><div class="hero-actions">${btn(T('start'),'intro-start')}<button class="contact-link" type="button" data-action="contact-open">${E(T('contactOpen'))}<span aria-hidden="true">↗</span></button></div>
      <p class="hero-note">${E(T('introHint'))}</p>
      <div class="hero-stats"><div class="stat"><strong>10</strong><span>${E(T('questions'))}</span></div><div class="stat"><strong>${C.seconds}s</strong><span>${E(T('seconds'))}</span></div><div class="stat"><strong>8/10</strong><span>${E(T('prize'))}</span></div></div>
    </div><div class="hero-visual" aria-hidden="true"><svg class="signal" viewBox="0 0 600 400" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="signal-gradient" x1="0" y1="0" x2="600" y2="0" gradientUnits="userSpaceOnUse"><stop stop-color="#1889df" stop-opacity="0"/><stop offset=".35" stop-color="#66c6ff"/><stop offset=".7" stop-color="#d0eeff"/><stop offset="1" stop-color="#1889df" stop-opacity="0"/></linearGradient></defs>${Array.from({length:17},(_,i)=>{const y=36+i*20, d=`M -20 ${y} C 110 ${y} 155 ${340-i*14} 300 ${200+i*1.3} S 485 ${y+20} 620 ${y-10}`;return `<path class="signal-base" d="${d}"/><path class="signal-trace" style="--line:${i}" pathLength="100" d="${d}"/>`;}).join('')}</svg></div>
  </section>`;}
  function formMarkup(){
    if(!DEMO && !C.consentApproved)return `<section class="registration-paused" aria-labelledby="paused-title"><div class="paused-mark" aria-hidden="true"></div><h1 id="paused-title">${E(T('registrationPausedTitle'))}</h1><p>${E(T('registrationPausedBody'))}</p></section>`;
    return `<section class="form-shell" aria-labelledby="form-heading">
    <aside class="form-aside"><div class="form-aside-num" aria-hidden="true">10</div><p>${E(T('regDesc'))}</p></aside>
    <div class="form-panel"><p class="form-kicker">ITPU / AI CHALLENGE</p><h1 id="form-heading">${E(T('regTitle'))}</h1><p class="form-desc">${E(T('regDesc'))}</p>
      <form id="lead-form" novalidate><div class="form-grid">
        <label class="field name-field"><span>${E(T('firstName'))} *</span><input name="firstName" maxlength="44" autocomplete="given-name" required></label>
        <label class="field name-field"><span>${E(T('lastName'))} *</span><input name="lastName" maxlength="44" autocomplete="family-name" required></label>
        <label class="field phone"><span>${E(T('phone'))} *</span><input name="phone" type="tel" inputmode="tel" maxlength="22" autocomplete="tel" placeholder="+998 90 123 45 67" required></label>
        <fieldset class="field age-field grade-field"><legend>${E(T('grade'))} *</legend><div class="age-options grade-options"><label><input type="radio" name="grade" value="10" required><span>${E(T('grade10'))}</span></label><label><input type="radio" name="grade" value="11"><span>${E(T('grade11'))}</span></label><label><input type="radio" name="grade" value="other"><span>${E(T('gradeOther'))}</span></label></div></fieldset>
        <label class="field"><span>${E(T('school'))} <small>(${E(T('optional'))})</small></span><input name="school" maxlength="100" placeholder="${E(T('schoolPlaceholder'))}"></label>
        <fieldset class="field age-field"><legend>${E(T('age'))} *</legend><div class="age-options"><label><input type="radio" name="age" value="minor" required><span>${E(T('minor'))}</span></label><label><input type="radio" name="age" value="adult"><span>${E(T('adult'))}</span></label></div></fieldset>
      </div><div class="notice" id="minor-notice" hidden>${E(T('minorButtonNotice'))}</div>
      <div class="consent-note"><p>${E(T('consentButtonNotice'))}</p><button type="button" class="text-link" data-action="privacy">${E(T('privacy'))}</button></div>
      <div class="reg-actions"><p id="reg-error" class="reg-error" role="alert" hidden></p><button type="submit" id="reg-submit" class="main-button"><span>${E(T('register'))}</span><span class="button-arrow" aria-hidden="true"></span></button></div>
      </form></div>
  </section>`;}
  function contactMarkup(){return `<section class="contact-shell" aria-labelledby="contact-heading"><button class="back-link" type="button" data-action="contact-back">← ${E(T('back'))}</button><div class="contact-content"><h1 id="contact-heading">${E(T('contactTitle'))}</h1><p>${E(T('contactDesc'))}</p><form id="contact-form" novalidate><label class="field contact-phone"><span>${E(T('phone'))} *</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="22" placeholder="+998 90 123 45 67" required></label><fieldset class="field contact-role"><legend>${E(T('contactRole'))} *</legend><div class="age-options"><label><input type="radio" name="role" value="applicant" required><span>${E(T('roleApplicant'))}</span></label><label><input type="radio" name="role" value="student"><span>${E(T('roleStudent'))}</span></label><label><input type="radio" name="role" value="parent"><span>${E(T('roleParent'))}</span></label></div></fieldset><p class="contact-consent">${E(T('contactConsent'))} <a href="${E(C.privacyUrl)}" target="_blank" rel="noopener noreferrer">${E(T('privacyOfficial'))}</a></p><p class="reg-error" id="contact-error" role="alert" hidden></p><button type="submit" id="contact-submit" class="main-button"><span>${E(T('contactSubmit'))}</span><span class="button-arrow" aria-hidden="true"></span></button></form></div></section>`;}
  function contactDone(){return `<section class="contact-shell contact-done"><div class="contact-content"><h1>${E(T('contactDone'))}</h1><p>${E(T('contactDoneText'))}</p><button class="secondary-button" type="button" data-action="contact-back">${E(T('backHome'))}</button></div></section>`;}
  function ready(){return `<section class="ready ready-new" aria-labelledby="ready-heading"><div class="ready-kicker">ITPU AI QUIZ</div><h1 id="ready-heading">${E(T('readyTitle'))}</h1><p>${E(T('readyText'))}</p><div class="ready-facts"><span><b>10</b>${E(T('questions'))}</span><span><b>${C.seconds}s</b>${E(T('seconds'))}</span><span><b>8/10</b>${E(T('prize'))}</span></div>${btn(T('readyGo'),'quiz-start')}</section>`;}
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
        <div class="timer-block"><div class="timer" role="timer" aria-label="${E(T('left'))}"><svg viewBox="0 0 110 110" aria-hidden="true"><circle class="timer-track" cx="55" cy="55" r="48"/><circle id="timer-progress" class="timer-progress" cx="55" cy="55" r="48" stroke-dasharray="301.593" stroke-dashoffset="0"/></svg><strong id="time-count">${C.seconds}</strong></div><div class="timer-label"><span>${E(T('left'))}</span><b id="quiz-hint">${E(T('choose'))}</b></div></div>
      </div><div class="answers" role="group" aria-label="${E(T('choose'))}">${order.map((answerIndex,i)=>`<button class="answer" type="button" data-action="answer" data-answer="${answerIndex}"><span class="answer-key" aria-hidden="true">${'ABCDE'[i]}</span><span class="answer-text">${E(L(q.a[answerIndex]))}</span><span class="answer-arrow" aria-hidden="true"></span></button>`).join('')}</div></div>
      <div class="quiz-foot"><span>ITPU / THINK FORWARD</span><span class="bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div>
    </section>`;
  }
  function waitMarkup(){return `<section class="ready" aria-live="polite"><div class="eyebrow">ITPU / FINAL SYNC</div><div class="ready-number" aria-hidden="true">AI</div><h1>${E(T('scoreCalc'))}</h1><span class="bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span></section>`;}
  function errorMarkup(){return `<section class="ready"><div class="eyebrow">ITPU / CONNECTION</div><h1>${E(T('scoreFail'))}</h1>${btn(T('retry'),'retry-score')}</section>`;}
  function tier(score){return score===10?4:score>=8?3:score>=6?2:score>=4?1:0;}
  function resultMarkup(){
    const r=st.result,s=r.score,eligible=s>=C.prizeAt&&!st.session.guest;
    const guestOrDemo=DEMO||st.session.guest;
    return `<section class="results" aria-labelledby="result-title"><div class="result-main"><div class="eyebrow">${E(T('resultKicker'))}</div><h1 id="result-title">${E(T('resultTitle'))}</h1><div class="score"><strong>${s}</strong><span>${E(T('outOf'))}</span></div><p>${E(T('tier'+tier(s)))}</p>
      <div class="result-tools"><button class="secondary-button" type="button" data-action="share">${E(T('share'))}</button>${DEMO?`<button class="secondary-button" type="button" data-action="replay">${E(T('replay'))}</button>`:''}</div></div>
      <div class="result-card"><h2>${E(eligible?T('eligible'):T('ctaTitle'))}</h2><p>${E(guestOrDemo?T('demoPrize'):(eligible?T('prizeInstructions'):T('noPrize')))}</p>
        ${eligible?`<div class="claim"><small>${E(T('code'))}</small><strong>${E(r.claimCode||'ITPU-******')}</strong></div>`:''}
        <a class="main-button" href="${E(C.admissions[LANGS[st.language]])}" target="_blank" rel="noopener noreferrer"><span>${E(T('cta'))}</span><span class="button-arrow" aria-hidden="true"></span></a>
      </div><div class="recap"><button class="recap-toggle" type="button" data-action="recap" aria-expanded="${st.recap}">${E(st.recap?T('recapClose'):T('recapOpen'))}<span aria-hidden="true">+</span></button><div class="recap-list" id="recap-list" ${st.recap?'':'hidden'}>${st.recap?recapMarkup():''}</div></div>
    </section>`;
  }
  function recapMarkup(){return Q.map((q,i)=>{
    const chosen=st.answers.find(a=>a.id===q.id),correct=st.result.correct[q.id],ok=chosen&&chosen.answer===correct;
    const wrong=chosen?.answer===null||!chosen?'':`<div class="wrong">${E(T('yourAnswer'))}: ${E(L(q.a[chosen.answer]))}</div>`;
    return `<article class="recap-item"><small>${E(T('question'))} ${String(i+1).padStart(2,'0')}</small><h3>${E(L(q.q))}</h3>${ok?'':(wrong||`<div class="wrong">${E(T('skipped'))}</div>`)}<div>${E(T('correct'))}: ${E(L(q.a[correct]))}</div>${q.why?`<p>${E(L(q.why))}</p>`:''}</article>`;
  }).join('');}
  function render(){
    document.body.dataset.stage=st.stage;
    root.classList.remove('enter');void root.offsetWidth;root.classList.add('enter');
    switch(st.stage){case 'intro':root.innerHTML=intro();break;case 'form':root.innerHTML=formMarkup();break;case 'contact':root.innerHTML=contactMarkup();break;case 'contact-done':root.innerHTML=contactDone();break;case 'ready':root.innerHTML=ready();break;case 'quiz':root.innerHTML=quizMarkup();break;case 'wait':root.innerHTML=waitMarkup();break;case 'error':root.innerHTML=errorMarkup();break;case 'result':root.innerHTML=resultMarkup();break;default:root.innerHTML=intro();}
    if(st.stage==='contact'){try{const d=JSON.parse(sessionStorage.getItem('itpu-contact-pending')||'null'),f=document.getElementById('contact-form');if(d&&f){f.elements.phone.value=d.phone||'';f.elements.role.value=d.role||'';}}catch(_){}}
    save();
  }
  function phoneNumber(text){let n=String(text||'').replace(/\D/g,'');if(n.length===9)n='998'+n;return /^998\d{9}$/.test(n)?'+'+n:null;}
  function formError(message){const el=document.getElementById('reg-error');if(el){el.textContent=message;el.hidden=false;}}
  async function submitContact(form){
    if(st.processing)return;
    const phone=phoneNumber(form.elements.phone.value),role=form.elements.role.value,error=document.getElementById('contact-error');
    if(!phone||!role){error.textContent=!phone?T('errPhone'):T('contactRoleError');error.hidden=false;return;}
    const button=document.getElementById('contact-submit');button.disabled=true;button.firstElementChild.textContent=T('contactSending');error.hidden=true;st.processing=true;
    const key='itpu-contact-pending';let pending=null;try{pending=JSON.parse(sessionStorage.getItem(key)||'null');}catch(_){}
    const id=pending?.phone===phone&&pending?.role===role&&pending?.id?pending.id:randomId();try{sessionStorage.setItem(key,JSON.stringify({phone,role,id}));}catch(_){}
    try{if(!DEMO){const result=await submitBridge({action:'contact',id,eventId:C.eventId,phone,role,lang:LANGS[st.language],consent:true,consentVersion:'ITPU-CONTACT-2026-11'},'contact_saved');if(result.status!=='contact_saved')throw new Error('Not confirmed');}try{sessionStorage.removeItem(key);}catch(_){}transition('contact-done');}
    catch(_){error.textContent=T('contactFail');error.hidden=false;button.disabled=false;button.firstElementChild.textContent=T('contactSubmit');}finally{st.processing=false;}
  }
  async function register(form){
    if(st.processing)return;
    const firstName=form.elements.firstName.value.trim().replace(/\s+/g,' '),lastName=form.elements.lastName.value.trim().replace(/\s+/g,' '),name=`${firstName} ${lastName}`,phone=phoneNumber(form.elements.phone.value),grade=form.elements.grade.value,school=form.elements.school.value.trim(),age=form.elements.age.value;
    const consent=true,guardian=age==='minor',marketing=false;
    if(!firstName||!lastName)return formError(T('errName'));
    if(!phone)return formError(T('errPhone'));
    if(!grade||!age)return formError(T('ageChoose'));
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
      if(!DEMO){const response=await submitBridge({action:'register',id,eventId:C.eventId,name,phone,grade,school,age,guardian,consent,marketing,lang:LANGS[st.language],consentVersion:'ITPU-QUIZ-2026-11-10-BUTTON-15S'},'registered');if(response.status==='duplicate')throw new Error('duplicate');if(response.status!=='registered')throw new Error('unconfirmed');}
      try{sessionStorage.removeItem(pendingKey);}catch(_){}
      st.session={id,guest:false};st.answers=[];st.orders={};st.index=0;st.result=null;st.deadlineEpoch=0;transition('ready');
    }catch(err){formError(err.message==='duplicate'?T('duplicate'):T('regFail'));button.disabled=false;button.firstElementChild.textContent=T('register');}finally{st.processing=false;}
  }
  function startQuiz(){if(!st.session||st.processing)return;if(transitioning){setTimeout(startQuiz,500);return;}st.answers=[];st.orders={};st.index=0;st.deadlineEpoch=0;st.locked=false;if(DEMO)transition('quiz',()=>timer(true));else {st.pending={action:'start',id:st.session.id,eventId:C.eventId,guest:st.session.guest};liveStep();}}
  function timer(newQuestion){
    cancelAnimationFrame(frame);
    if(st.stage!=='quiz'||st.locked)return;
    if(newQuestion||!st.deadlineEpoch)st.deadlineEpoch=Date.now()+C.seconds*1000;
    save();
    const value=document.getElementById('time-count'),ring=document.getElementById('timer-progress'),shell=document.getElementById('quiz-shell');if(!value||!ring)return;
    let lastDraw=0,lastNumber=-1,wasUrgent=null;
    const run=()=>{
      if(st.stage!=='quiz'||st.locked)return;
      const now=Date.now(),left=Math.max(0,st.deadlineEpoch-now),number=Math.ceil(left/1000),urgent=left<=3000;
      if(number!==lastNumber){value.textContent=String(number);lastNumber=number;}
      if(!lastDraw||now-lastDraw>=100||left<=0){ring.setAttribute('stroke-dashoffset',String(301.593*(1-left/(C.seconds*1000))));lastDraw=now;}
      if(urgent!==wasUrgent){shell.classList.toggle('urgent',urgent);wasUrgent=urgent;}
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
        st.pending=null;st.locked=false;st.index=result.index;st.deadlineEpoch=Date.now()+Math.max(0,Math.min(C.seconds*1000,Number(result.remainingMs)||0));enterStage('quiz');timer(false);
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
  let statusFrame=null, statusFrameReady=null;
  function jsonp(id){
    // Chrome's credentialless iframe prevents Google multi-login redirects from
    // returning an HTML error instead of the status script. Other browsers use
    // the original JSONP path; multi-login may still require a private window.
    if('credentialless' in HTMLIFrameElement.prototype){
      if(!statusFrame){
        statusFrame=document.createElement('iframe');statusFrame.hidden=true;statusFrame.credentialless=true;statusFrame.src='bridge.html';
        statusFrameReady=new Promise((resolve,reject)=>{statusFrame.onload=resolve;statusFrame.onerror=reject;});document.body.appendChild(statusFrame);
      }
      return statusFrameReady.then(()=>new Promise((resolve,reject)=>{
        const token=randomId().replace(/-/g,'').slice(0,24);
        const cleanup=()=>{clearTimeout(timerId);window.removeEventListener('message',receive);};
        const timerId=setTimeout(()=>{cleanup();reject(new Error('Status timed out'));},7000);
        const receive=e=>{if(e.source!==statusFrame.contentWindow||e.origin!==location.origin||e.data?.type!=='itpu-response'||e.data.token!==token)return;cleanup();if(e.data.error)reject(new Error('Status failed'));else resolve(e.data.data);};
        window.addEventListener('message',receive);statusFrame.contentWindow.postMessage({type:'itpu-query',token,id,endpoint:C.endpoint},location.origin);
      }));
    }
    return new Promise((resolve,reject)=>{
      const callback='itpuStatus_'+randomId().replace(/-/g,'').slice(0,16),url=new URL(C.endpoint),script=document.createElement('script');
      url.searchParams.set('action','status');url.searchParams.set('id',id);url.searchParams.set('prefix',callback);
      const cleanup=()=>{clearTimeout(timeoutId);delete window[callback];script.remove();};
      const timeoutId=setTimeout(()=>{cleanup();reject(new Error('Status timed out'));},7000);
      window[callback]=data=>{cleanup();resolve(data);};script.onerror=()=>{cleanup();reject(new Error('Status failed'));};script.src=url.toString();document.head.appendChild(script);
    });
  }
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
    let w=0,h=0,paintTimer=0;
    const resize=()=>{w=innerWidth;h=innerHeight;const d=Math.min(devicePixelRatio||1,1.4);canvas.width=w*d;canvas.height=h*d;ctx.setTransform(d,0,0,d,0,0);};
    resize();addEventListener('resize',resize,{passive:true});
    const draw=()=>{const t=Date.now();ctx.clearRect(0,0,w,h);
      const light=document.body.dataset.stage==='form'||document.body.dataset.stage==='quiz';
      for(let i=0;i<5;i++){const base=h*(.24+i*.15),drift=Math.sin(t*.00018+i*.6)*h*.035;ctx.beginPath();ctx.moveTo(-40,base);ctx.bezierCurveTo(w*.32,base-h*.12+drift,w*.63,base+h*.1-drift,w+40,base-h*.02);ctx.strokeStyle=light?'rgba(22,104,170,.14)':'rgba(105,194,249,.12)';ctx.lineWidth=1;ctx.stroke();}
      paintTimer=setTimeout(draw,100);
    };
    const sync=()=>{document.body.classList?.toggle('motion-paused',!!document.hidden);clearTimeout(paintTimer);if(!document.hidden&&!reduced.matches)draw();else ctx.clearRect(0,0,w,h);};
    document.addEventListener('visibilitychange',sync);reduced.addEventListener?.('change',sync);sync();
  }
  root.addEventListener('click',event=>{
    const button=event.target.closest('[data-action]');if(!button)return;
    switch(button.dataset.action){
      case 'intro-start':transition('form');break;
      case 'contact-open':transition('contact');break;
      case 'contact-back':if(!st.processing)transition('intro');break;
      case 'privacy':dialog.showModal();break;
      case 'quiz-start':startQuiz();break;
      case 'answer':choose(Number(button.dataset.answer));break;
      case 'retry-score':if(!DEMO){st.pending=st.pending||{action:'start',id:st.session.id,eventId:C.eventId,guest:st.session.guest};liveStep();}else finish();break;
      case 'recap':st.recap=!st.recap;render();break;
      case 'share':share();break;
      case 'replay':replay();break;
    }
  });
  root.addEventListener('submit',event=>{if(event.target.id==='lead-form'){event.preventDefault();register(event.target);}else if(event.target.id==='contact-form'){event.preventDefault();submitContact(event.target);}});
  root.addEventListener('change',event=>{if(event.target.name==='age'){document.getElementById('minor-notice').hidden=event.target.value!=='minor';}});
  document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>setLanguage(b.dataset.lang)));
  document.getElementById('privacy-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  restore();setLanguage(initialLanguage());
  if(DEMO){const ribbon=document.createElement('div');ribbon.id='demo-ribbon';ribbon.className='demo-ribbon';ribbon.textContent=T('demo');document.body.appendChild(ribbon);}
  if(st.stage==='quiz')timer(false);
  ambient();
})();
