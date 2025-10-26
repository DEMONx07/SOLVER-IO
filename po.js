/* script.js - plain JS conversion of SmartAnswerFinder logic */

const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const dropContent = document.getElementById('dropContent');
const filePreview = document.getElementById('filePreview');
const noFile = document.getElementById('noFile');
const fileNameEl = document.getElementById('fileName');
const fileCharsEl = document.getElementById('fileChars');
const removeFileBtn = document.getElementById('removeFile');

const questionArea = document.getElementById('questionArea');
const questionInput = document.getElementById('questionInput');
const findBtn = document.getElementById('findBtn');

const errorBox = document.getElementById('errorBox');
const loadingEl = document.getElementById('loading');
const emptyState = document.getElementById('emptyState');

const historySection = document.getElementById('historySection');
const historyList = document.getElementById('historyList');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');

let currentFile = null;
let fileContent = '';
let chatHistory = [];
let loading = false;
let copiedTimeout = null;

/* Utility UI functions */
function show(el){ el.classList.remove('hidden'); }
function hide(el){ el.classList.add('hidden'); }
function setError(msg){ if(msg){ errorBox.textContent = msg; show(errorBox); } else { hide(errorBox); } }
function setLoading(state){
  loading = state;
  if(state){
    show(loadingEl);
    hide(emptyState);
  } else {
    hide(loadingEl);
  }
}

/* Drag & drop support */
['dragenter','dragover'].forEach(e=>{
  dropzone.addEventListener(e, ev => ev.preventDefault());
});
dropzone.addEventListener('drop', ev=>{
  ev.preventDefault();
  const f = ev.dataTransfer.files && ev.dataTransfer.files[0];
  if(f) handleFile(f);
});
dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => {
  const f = e.target.files && e.target.files[0];
  if(f) handleFile(f);
});

removeFileBtn.addEventListener('click', (e)=>{
  e.preventDefault();
  removeFile();
});

/* File handling */
async function handleFile(uploadedFile){
  setError('');
  chatHistory = [];
  renderHistory();

  setLoading(true);

  try {
    const fileType = uploadedFile.type || '';
    if (fileType === 'application/pdf') {
      // Attempt simple extraction by reading arrayBuffer and decoding printable characters.
      const arrayBuffer = await uploadedFile.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      const text = extractTextFromPDF(uint8);
      fileContent = text;
      currentFile = uploadedFile;
    } else if (fileType === 'text/plain' || uploadedFile.name.toLowerCase().endsWith('.txt')) {
      const text = await uploadedFile.text();
      fileContent = text;
      currentFile = uploadedFile;
    } else {
      setError('Please upload a PDF or TXT file');
      currentFile = null;
      fileContent = '';
    }
  } catch (err) {
    setError('Error reading file: ' + (err && err.message ? err.message : err));
    currentFile = null;
    fileContent = '';
  } finally {
    setLoading(false);
    updateFileUI();
    updateQuestionUI();
  }
}

/* Very simple PDF text "extraction" — decodes bytes and strips non-printables.
   This is not a full-fledged PDF parser; for best results use server-side PDF parsing or PDF.js. */
function extractTextFromPDF(uint8Array){
  try {
    const decode = new TextDecoder().decode(uint8Array);
    const clean = decode.replace(/[^\x20-\x7E\n]/g, ' ');
    const matches = clean.match(/[A-Za-z0-9\s.,;:!?'"()\-\n]+/g);
    return matches ? matches.join(' ').replace(/\s+/g, ' ').trim() : 'Unable to extract readable text from PDF';
  } catch (e){
    return 'Unable to extract readable text from PDF';
  }
}

function updateFileUI(){
  if(currentFile){
    show(filePreview);
    hide(noFile);
    fileNameEl.textContent = currentFile.name;
    fileCharsEl.textContent = `${fileContent.length.toLocaleString()} characters loaded`;
    show(questionArea);
    hide(emptyState);
    show(historySection); // show area (history might still be empty)
  } else {
    hide(filePreview);
    show(noFile);
    hide(questionArea);
    if(chatHistory.length === 0) show(emptyState);
    if(chatHistory.length === 0) hide(historySection);
  }
}

/* Question/answer logic (ported from TSX) */
function getStopWords(){
  return ['what','where','when','which','who','how','explain','define','describe','tell','about','the','is','are','was','were','in','on','at','to','for','of','and'];
}

function advancedSearch(query, content){
  const lowerQuery = query.toLowerCase();
  const lowerContent = content.toLowerCase();
  const stopWords = getStopWords();

  const keywords = lowerQuery
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.includes(w))
    .map(w => w.replace(/[^a-z0-9]/g, ''));

  if(keywords.length === 0){
    return { answer: "Please ask a more specific question with key terms.", confidence: 0, sections: [] };
  }

  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 20);
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 15);

  const scoredParagraphs = paragraphs.map((para, idx) => {
    const lowerPara = para.toLowerCase();
    let score = 0;
    let matchedKeywords = [];

    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\w*\\b`, 'g');
      const matches = (lowerPara.match(regex) || []).length;
      if(matches > 0){
        score += matches * 3;
        matchedKeywords.push(keyword);
      }
    });

    if(matchedKeywords.length > 1) score += matchedKeywords.length * 2;
    if(matchedKeywords.length >= 2){
      const positions = matchedKeywords.map(kw => lowerPara.indexOf(kw));
      const maxDistance = Math.max(...positions) - Math.min(...positions);
      if(maxDistance < 200) score += 5;
    }

    return { text: para.trim(), score, matchedKeywords, index: idx };
  });

  const scoredSentences = sentences.map((sent, idx) => {
    const lowerSent = sent.toLowerCase();
    let score = 0;
    let matchedKeywords = [];

    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\w*\\b`, 'g');
      const matches = (lowerSent.match(regex) || []).length;
      if(matches > 0){
        score += matches * 2;
        matchedKeywords.push(keyword);
      }
    });

    if(matchedKeywords.length > 1) score += matchedKeywords.length * 3;

    return { text: sent.trim(), score, matchedKeywords, index: idx };
  });

  scoredParagraphs.sort((a,b)=>b.score-a.score);
  scoredSentences.sort((a,b)=>b.score-a.score);

  const topParagraphs = scoredParagraphs.filter(p => p.score > 0).slice(0,2);
  const topSentences = scoredSentences.filter(s => s.score > 0).slice(0,3);

  let answer = "", confidence = 0, sections = [];

  if(topParagraphs.length > 0 && topParagraphs[0].score >= 8){
    answer = topParagraphs.map(p => p.text).join('\n\n');
    confidence = Math.min(95, topParagraphs[0].score * 5);
    sections = topParagraphs.map(p => `Section ${p.index + 1}`);
  } else if(topSentences.length > 0 && topSentences[0].score >= 4){
    answer = topSentences.map(s => s.text).join('. ') + '.';
    confidence = Math.min(85, topSentences[0].score * 8);
    sections = topSentences.map(s => `Sentence ${s.index + 1}`);
  } else if(topSentences.length > 0){
    answer = topSentences[0].text + '.';
    confidence = 40;
    sections = [`Sentence ${topSentences[0].index + 1}`];
  } else {
    return { answer: "❌ I couldn't find the answer in the uploaded file. The keywords you're looking for may not be present in this document.", confidence: 0, sections: [] };
  }

  return { answer, confidence, sections };
}

/* Finding the answer */
findBtn.addEventListener('click', findAnswer);
questionInput.addEventListener('keypress', (e)=>{ if(e.key === 'Enter') findAnswer(); });

function findAnswer(){
  setError('');
  if(!fileContent || !questionInput.value.trim()){
    setError('Please upload a file and enter a question');
    return;
  }
  setLoading(true);
  // simulate a short processing delay
  setTimeout(()=>{
    const result = advancedSearch(questionInput.value.trim(), fileContent);
    chatHistory.push({
      question: questionInput.value.trim(),
      answer: result.answer,
      confidence: result.confidence,
      sections: result.sections
    });
    questionInput.value = '';
    setLoading(false);
    renderHistory();
    updateFileUI();
  }, 600);
}

/* Render history */
function getConfidenceClass(conf){
  if(conf >= 70) return 'conf-high';
  if(conf >= 40) return 'conf-med';
  return 'conf-low';
}

function renderHistory(){
  historyList.innerHTML = '';
  if(chatHistory.length === 0){
    hide(historySection);
    return;
  }
  show(historySection);
  chatHistory.forEach((chat, idx) => {
    const item = document.createElement('div');
    item.className = 'history-item';

    const q = document.createElement('div');
    q.className = 'q';
    q.textContent = `Q${idx+1}: ${chat.question}`;

    const answerBox = document.createElement('div');
    answerBox.className = 'answer-box';

    const meta = document.createElement('div');
    meta.style.display = 'flex';
    meta.style.alignItems = 'center';
    meta.style.marginBottom = '8px';

    if(chat.confidence > 0){
      const conf = document.createElement('span');
      conf.className = 'confidence ' + getConfidenceClass(chat.confidence);
      conf.textContent = `${chat.confidence}% Confidence`;
      meta.appendChild(conf);
    }

    if(chat.sections && chat.sections.length){
      const sec = document.createElement('span');
      sec.style.fontSize = '13px';
      sec.style.color = '#6b7280';
      sec.textContent = `Found in: ${chat.sections.join(', ')}`;
      meta.appendChild(sec);
    }

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn';
    copyBtn.style.marginLeft = 'auto';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', ()=> {
      navigator.clipboard.writeText(chat.answer).then(()=>{
        copyBtn.textContent = 'Copied';
        clearTimeout(copiedTimeout);
        copiedTimeout = setTimeout(()=>{ copyBtn.textContent = 'Copy'; }, 1500);
      }).catch(()=>{ copyBtn.textContent = 'Copy'; });
    });

    meta.appendChild(copyBtn);

    const ansText = document.createElement('div');
    ansText.style.whiteSpace = 'pre-line';
    ansText.textContent = chat.answer;

    answerBox.appendChild(meta);
    answerBox.appendChild(ansText);

    item.appendChild(q);
    item.appendChild(answerBox);

    historyList.appendChild(item);
  });
}

/* Clear / Export */
clearBtn.addEventListener('click', ()=>{
  chatHistory = [];
  renderHistory();
  setError('');
  if(!currentFile) hide(historySection);
});

exportBtn.addEventListener('click', ()=>{
  if(chatHistory.length === 0){
    setError('No chat history to export');
    return;
  }
  const exportText = chatHistory.map((c, i)=>`Q${i+1}: ${c.question}\n\nA${i+1}: ${c.answer}\n\n---\n\n`).join('');
  const blob = new Blob([exportText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chat-answers.txt';
  a.click();
  URL.revokeObjectURL(url);
});

/* Remove file */
function removeFile(){
  currentFile = null;
  fileContent = '';
  fileInput.value = '';
  chatHistory = [];
  renderHistory();
  updateFileUI();
  setError('');
}

/* initial UI states */
updateFileUI();
renderHistory();
setError('');
setLoading(false);
