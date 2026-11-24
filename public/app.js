const $ = s => document.querySelector(s);
let token = localStorage.getItem('quizToken');
let user = JSON.parse(localStorage.getItem('quizUser') || 'null');
let authMode = 'login', currentDraft = null, timerHandle = null, currentAttempt = null;

async function api(url, options={}) {
  const headers = {'Content-Type':'application/json', ...(options.headers||{})};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`/api${url}`, {...options, headers});
  const data = await response.json().catch(()=>({message:'Unexpected server response'}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}
function message(selector,text){$(selector).textContent=text||''}
function setAuth(mode){
  authMode=mode; document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  $('#nameWrap').classList.toggle('hidden',mode!=='register'); $('#authSubmit').textContent=mode==='login'?'Sign in':'Create account';
}
document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>setAuth(b.dataset.mode)));
$('#authForm').addEventListener('submit',async e=>{
  e.preventDefault(); message('#authMessage','');
  const body=Object.fromEntries(new FormData(e.currentTarget));
  try{
    if(authMode==='register'){await api('/auth/register',{method:'POST',body:JSON.stringify(body)});message('#authMessage','Account created. You can now sign in.');setAuth('login');}
    else {const data=await api('/auth/login',{method:'POST',body:JSON.stringify(body)});token=data.token;user=data.user;localStorage.setItem('quizToken',token);localStorage.setItem('quizUser',JSON.stringify(user));showApp();}
  }catch(err){message('#authMessage',err.message);}
});
$('#logoutBtn').onclick=()=>{localStorage.clear();token=null;user=null;location.reload()};
function showApp(){
  $('#authPanel').classList.add('hidden');$('#appPanel').classList.remove('hidden');$('#userLabel').textContent=`${user.name} · ${user.role}`;
  $('#adminPanel').classList.toggle('hidden',user.role!=='admin');$('#heading').textContent=user.role==='admin'?'Quiz administration':'Available quizzes';
  loadQuizzes();
}
async function loadQuizzes(){
  try{const data=await api('/quizzes');$('#quizList').innerHTML=data.quizzes.map(q=>`
    <article class="quiz-card"><h3>${escapeHtml(q.title)}</h3><p>${escapeHtml(q.description||'Test your knowledge.')}</p>
    <div class="meta">${q.duration_minutes} minutes · ${q.question_count} questions</div>
    <button class="primary" data-quiz="${q.id}">${user.role==='admin'?'Preview':'Start quiz'}</button></article>`).join('')||'<p>No published quizzes yet.</p>';
    document.querySelectorAll('[data-quiz]').forEach(b=>b.onclick=()=>startQuiz(b.dataset.quiz));
  }catch(e){$('#quizList').textContent=e.message;}
}
$('#quizForm').addEventListener('submit',async e=>{
  e.preventDefault();try{const data=await api('/quizzes',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});currentDraft=data.quizId;$('#questionEditor').classList.remove('hidden');$('#draftTitle').textContent='Draft quiz #'+currentDraft;message('#adminMessage','Draft created. Add at least one question, then publish.');}catch(err){message('#adminMessage',err.message);}
});
$('#questionForm').addEventListener('submit',async e=>{
  e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));const options=[f.option1,f.option2,f.option3,f.option4].filter(v=>v&&v.trim()).map((text,i)=>({text,is_correct:false}));
  const correct=Number(f.correct);if(correct>=options.length){message('#adminMessage','Select a correct option that has text.');return;}options[correct].is_correct=true;
  try{await api(`/quizzes/${currentDraft}/questions`,{method:'POST',body:JSON.stringify({question_text:f.question_text,points:f.points,options})});e.currentTarget.reset();message('#adminMessage','Question added.');}catch(err){message('#adminMessage',err.message);}
});
$('#publishBtn').onclick=async()=>{try{await api(`/quizzes/${currentDraft}/publish`,{method:'POST'});message('#adminMessage','Quiz published successfully.');$('#questionEditor').classList.add('hidden');loadQuizzes();}catch(e){message('#adminMessage',e.message)}};

async function startQuiz(id){
  try{
    const started=await api(`/quizzes/${id}/start`,{method:'POST',body:'{}'});
    currentAttempt=started.attemptId; window.activeAttemptId=started.attemptId;
    const data=await api(`/quizzes/${id}`);
    renderQuiz(data.quiz,started.deadlineAt);
  }catch(e){alert(e.message)}
}
function renderQuiz(quiz,deadline){
  $('#quizList').classList.add('hidden');$('#quizStage').classList.remove('hidden');$('#resultStage').classList.add('hidden');
  $('#quizStage').innerHTML=`<div class="welcome"><div><h2>${escapeHtml(quiz.title)}</h2><p class="muted">Select one answer for each question.</p></div><div class="timer" id="timer">--:--</div></div>
  <form id="takeForm">${quiz.questions.map((q,i)=>`<div class="question"><strong>${i+1}. ${escapeHtml(q.question_text)} (${q.points} point${q.points==1?'':'s'})</strong>
  ${q.options.map(o=>`<label class="choice"><input type="radio" name="q_${q.id}" value="${o.id}"> ${escapeHtml(o.option_text)}</label>`).join('')}</div>`).join('')}
  <button class="primary" type="submit">Submit answers</button></form><p class="message" id="takeMessage"></p>`;
  const deadlineMs=new Date(deadline).getTime();
  const tick=()=>{const left=Math.max(0,deadlineMs-Date.now());const sec=Math.floor(left/1000);$('#timer').textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;if(left<=0){clearInterval(timerHandle);submitQuiz(quiz,true)}};
  tick();timerHandle=setInterval(tick,1000);
  $('#takeForm').onsubmit=e=>{e.preventDefault();submitQuiz(quiz,false)};
}
async function submitQuiz(quiz,auto){
  if(!currentAttempt)return;
  clearInterval(timerHandle);currentAttempt=null;
  const answers=quiz.questions.map(q=>({questionId:q.id,optionId:document.querySelector(`input[name="q_${q.id}"]:checked`)?.value||null}));
  try{
    const attemptId=window.activeAttemptId;
    const response=await api(`/attempts/${attemptId}/submit`,{method:'POST',body:JSON.stringify({answers})});
    $('#quizStage').classList.add('hidden');$('#resultStage').classList.remove('hidden');
    $('#resultStage').innerHTML=`<h2>${response.result.status==='expired'?'Time expired':'Quiz submitted'}</h2><h1>${response.result.score} / ${response.result.maxScore}</h1><p>Your result has been saved.</p><button class="primary" id="backBtn">Back to quizzes</button>`;
    $('#backBtn').onclick=()=>{ $('#resultStage').classList.add('hidden');$('#quizList').classList.remove('hidden');loadQuizzes();};
  }catch(e){$('#takeMessage').textContent=e.message;}
}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
if(token&&user)showApp();
