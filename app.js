// =========================================
// 1. 상태 변수 및 데이터 초기화
// =========================================
let words = [];             // 전체 단어 목록
let filteredWords = [];     // 현재 필터링된 단어 목록
let currentIndex = 0;       // 단어 학습 현재 인덱스
let isAnswerShown = false;  // 정답 공개 여부

// SRS 관련 변수
let srsList = [];           // 오늘 복습할 단어 목록
let srsIndex = 0;           // SRS 현재 인덱스
let isSrsAnswerShown = false;

// 필터 상태
let currentPos = '전체';
let hideMemorized = false;
let isBatchMode = false;
let currentBatchIndex = 0;

// 퀴즈 상태
let quizWords = [];
let currentQuizIndex = 0;
let quizScore = 0;
let wrongAnswers = [];
let quizLogs = [];

// =========================================
// 2. 초기화 & 이벤트 리스너 등록
// =========================================
document.addEventListener('DOMContentLoaded', () => {
    loadLocalData();
    initEventListeners();
    updatePosFilter();
    updateStudyView();
    updateSrsBadge();
});

// 로컬스토리지 데이터 로드
function loadLocalData() {
    const savedWords = localStorage.getItem('jp_words');
    const savedWrong = localStorage.getItem('jp_wrong');
    const savedLogs = localStorage.getItem('jp_logs');

    if (savedWords) {
        words = JSON.parse(savedWords);
    } else {
        // 샘플 데이터
        words = [
            { id: 1, kanji: '日本語', kana: 'にほんご', meaning: '일본어', pos: '명사', memorized: false, srsStage: 0, nextReviewDate: null },
            { id: 2, kanji: '食べる', kana: 'たべる', meaning: '먹다', pos: '동사', memorized: false, srsStage: 0, nextReviewDate: null },
            { id: 3, kanji: '大きい', kana: 'おおきい', meaning: '크다', pos: 'い형용사', memorized: false, srsStage: 0, nextReviewDate: null },
            { id: 4, kanji: '親切だ', kana: 'しんせつだ', meaning: '친절하다', pos: 'な형용사', memorized: false, srsStage: 0, nextReviewDate: null },
            { id: 5, kanji: 'とても', kana: 'とても', meaning: '아주 / 매우', pos: '부사', memorized: false, srsStage: 0, nextReviewDate: null }
        ];
        saveWordsData();
    }

    wrongAnswers = savedWrong ? JSON.parse(savedWrong) : [];
    quizLogs = savedLogs ? JSON.parse(savedLogs) : [];
}

function saveWordsData() {
    localStorage.setItem('jp_words', JSON.stringify(words));
}

function saveWrongData() {
    localStorage.setItem('jp_wrong', JSON.stringify(wrongAnswers));
}

function saveLogsData() {
    localStorage.setItem('jp_logs', JSON.stringify(quizLogs));
}

// =========================================
// 3. 페이지 전환 및 네비게이션
// =========================================
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.style.display = 'none';
    });
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.style.display = 'block';
    }

    if (pageId === 'srs') {
        initSrsReview();
    } else if (pageId === 'quiz') {
        startQuiz();
    } else if (pageId === 'wrong') {
        renderWrongList();
    } else if (pageId === 'score') {
        renderScorePage();
    }
}

// 오늘 날짜 가져오기 (YYYY-MM-DD)
function getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 날짜 더하기 함수
function addDays(dateStr, days) {
    const date = new Date(dateStr || Date.now());
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// =========================================
// 4. 이벤트 리스너 세팅
// =========================================
function initEventListeners() {
    // 키보드 단축키 (Space: 정답확인, ←/→: 이동)
    document.addEventListener('keydown', (e) => {
        const studyPage = document.getElementById('study');
        const srsPage = document.getElementById('srs');

        if (studyPage && studyPage.style.display !== 'none' && !isBatchMode) {
            if (e.code === 'Space') {
                e.preventDefault();
                toggleAnswer();
            } else if (e.code === 'ArrowLeft') {
                prevWord();
            } else if (e.code === 'ArrowRight') {
                nextWord();
            }
        } else if (srsPage && srsPage.style.display !== 'none') {
            if (e.code === 'Space') {
                e.preventDefault();
                toggleSrsAnswer();
            }
        }
    });

    // 품사 필터
    document.querySelectorAll('.pos-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentPos = e.target.getAttribute('data-pos');
            currentIndex = 0;
            updateStudyView();
        });
    });

    // 암기 숨기기 토글
    document.getElementById('hideMemorizedToggle').addEventListener('change', (e) => {
        hideMemorized = e.target.checked;
        currentIndex = 0;
        updateStudyView();
    });

    // 모드 전환
    document.getElementById('singleStudyBtn').addEventListener('click', () => {
        isBatchMode = false;
        document.getElementById('singleStudyBtn').classList.add('active');
        document.getElementById('batchStudyBtn').classList.remove('active');
        document.getElementById('singleStudyMode').classList.remove('hidden');
        document.getElementById('batchStudyMode').classList.add('hidden');
        updateStudyView();
    });

    document.getElementById('batchStudyBtn').addEventListener('click', () => {
        isBatchMode = true;
        document.getElementById('batchStudyBtn').classList.add('active');
        document.getElementById('singleStudyBtn').classList.remove('active');
        document.getElementById('batchStudyMode').classList.remove('hidden');
        document.getElementById('singleStudyMode').classList.add('hidden');
        renderBatchView();
    });

    // 학습 카드 버튼들
    document.getElementById('showBtn').addEventListener('click', toggleAnswer);
    document.getElementById('prevBtn').addEventListener('click', prevWord);
    document.getElementById('nextBtn').addEventListener('click', nextWord);
    document.getElementById('randomBtn').addEventListener('click', randomWord);
    document.getElementById('ttsBtn').addEventListener('click', () => {
        if (filteredWords[currentIndex]) speakTTS(filteredWords[currentIndex].kana || filteredWords[currentIndex].kanji);
    });

    // 암기 상태 버튼
    document.getElementById('btnSetMemorized').addEventListener('click', () => setWordStatus(true));
    document.getElementById('btnSetConfused').addEventListener('click', () => setWordStatus(false));

    // 묶음 학습 조작 버튼
    document.getElementById('prevBatchBtn').addEventListener('click', () => {
        if (currentBatchIndex > 0) {
            currentBatchIndex--;
            renderBatchView();
        }
    });
    document.getElementById('newBatchBtn').addEventListener('click', () => {
        const maxBatch = Math.ceil(filteredWords.length / 20) - 1;
        if (currentBatchIndex < maxBatch) {
            currentBatchIndex++;
            renderBatchView();
        }
    });
    document.getElementById('batchQuizBtn').addEventListener('click', startBatchQuiz);

    // SRS 복습 버튼들
    document.getElementById('srsShowBtn').addEventListener('click', toggleSrsAnswer);
    document.getElementById('srsTtsBtn').addEventListener('click', () => {
        if (srsList[srsIndex]) speakTTS(srsList[srsIndex].kana || srsList[srsIndex].kanji);
    });
    document.getElementById('btnSrsFail').addEventListener('click', () => processSrsFeedback('fail'));
    document.getElementById('btnSrsHard').addEventListener('click', () => processSrsFeedback('hard'));
    document.getElementById('btnSrsPass').addEventListener('click', () => processSrsFeedback('pass'));

    // 검색
    document.getElementById('searchInput').addEventListener('input', handleSearch);

    // 번역기
    document.getElementById('translateBtn').addEventListener('click', handleTranslation);
    document.getElementById('translateTtsBtn').addEventListener('click', () => {
        const res = document.getElementById('translateResult').innerText;
        if (res) speakTTS(res);
    });
    document.getElementById('addWordFromTranslatorBtn').addEventListener('click', addWordFromTranslator);

    // 데이터 관리
    document.getElementById('fileInput').addEventListener('change', handleCsvUpload);
    document.getElementById('exportDataBtn').addEventListener('click', exportDataJson);
    document.getElementById('importDataInput').addEventListener('change', importDataJson);

    // 오답 노트
    document.getElementById('clearWrongBtn').addEventListener('click', () => {
        if (confirm('오답 노트를 비우시겠습니까?')) {
            wrongAnswers = [];
            saveWrongData();
            renderWrongList();
        }
    });
    document.getElementById('startWrongQuizBtn').addEventListener('click', startWrongQuiz);

    // 기록 삭제
    document.getElementById('clearLogBtn').addEventListener('click', () => {
        if (confirm('모든 퀴즈 기록을 삭제하시겠습니까?')) {
            quizLogs = [];
            saveLogsData();
            renderScorePage();
        }
    });
}

// =========================================
// 5. 단어 학습 필터링 & 표시 로직
// =========================================
function updatePosFilter() {
    filteredWords = words.filter(item => {
        const posMatch = (currentPos === '전체') || (item.pos === currentPos);
        const memorizedMatch = !hideMemorized || !item.memorized;
        return posMatch && memorizedMatch;
    });
}

function updateStudyView() {
    updatePosFilter();
    const card = document.querySelector('.card');
    const wordEl = document.getElementById('word');
    const readingEl = document.getElementById('reading');
    const meaningEl = document.getElementById('meaning');
    const posBadge = document.getElementById('posBadge');
    const progressEl = document.getElementById('progress');

    if (filteredWords.length === 0) {
        wordEl.innerText = '조건에 맞는 단어가 없습니다.';
        readingEl.classList.add('hidden');
        meaningEl.innerText = '단어를 추가하거나 필터를 변경해 주세요.';
        meaningEl.classList.remove('hidden');
        posBadge.innerText = '-';
        progressEl.innerText = '0 / 0';
        return;
    }

    if (currentIndex >= filteredWords.length) currentIndex = 0;
    if (currentIndex < 0) currentIndex = filteredWords.length - 1;

    const currentWord = filteredWords[currentIndex];
    wordEl.innerText = currentWord.kanji || currentWord.kana;
    readingEl.innerText = currentWord.kana || '';
    meaningEl.innerText = currentWord.meaning || '';
    posBadge.innerText = currentWord.pos || '미지정';
    progressEl.innerText = `${currentIndex + 1} / ${filteredWords.length}`;

    // 기본적으로 정답(발음, 뜻) 숨기기
    isAnswerShown = false;
    readingEl.classList.add('hidden');
    meaningEl.classList.add('hidden');
    document.getElementById('showBtn').innerText = '정답 확인 (Space)';
}

function toggleAnswer() {
    if (filteredWords.length === 0) return;
    const readingEl = document.getElementById('reading');
    const meaningEl = document.getElementById('meaning');

    isAnswerShown = !isAnswerShown;
    if (isAnswerShown) {
        readingEl.classList.remove('hidden');
        meaningEl.classList.remove('hidden');
        document.getElementById('showBtn').innerText = '정답 숨기기 (Space)';
        speakTTS(filteredWords[currentIndex].kana || filteredWords[currentIndex].kanji);
    } else {
        readingEl.classList.add('hidden');
        meaningEl.classList.add('hidden');
        document.getElementById('showBtn').innerText = '정답 확인 (Space)';
    }
}

function prevWord() {
    if (filteredWords.length === 0) return;
    currentIndex = (currentIndex - 1 + filteredWords.length) % filteredWords.length;
    updateStudyView();
}

function nextWord() {
    if (filteredWords.length === 0) return;
    currentIndex = (currentIndex + 1) % filteredWords.length;
    updateStudyView();
}

function randomWord() {
    if (filteredWords.length <= 1) return;
    let newIndex;
    do {
        newIndex = Math.floor(Math.random() * filteredWords.length);
    } while (newIndex === currentIndex);
    currentIndex = newIndex;
    updateStudyView();
}

// 암기 상태 설정 (SRS 연동)
function setWordStatus(isMemorized) {
    if (filteredWords.length === 0) return;
    const currentWord = filteredWords[currentIndex];

    // 원본 words 배열에서 해당 단어 찾기
    const target = words.find(w => w.id === currentWord.id || (w.kanji === currentWord.kanji && w.kana === currentWord.kana));
    if (target) {
        target.memorized = isMemorized;
        if (isMemorized) {
            target.srsStage = 1;
            target.nextReviewDate = addDays(getTodayString(), 1); // 1일 후 첫 복습
        } else {
            target.srsStage = 0;
            target.nextReviewDate = null;
        }
        saveWordsData();
        updateSrsBadge();
        nextWord();
    }
}

// 묶음 보기(20개씩)
function renderBatchView() {
    updatePosFilter();
    const batchListEl = document.getElementById('batchWordList');
    const batchCountEl = document.getElementById('batchCount');

    batchListEl.innerHTML = '';
    const start = currentBatchIndex * 20;
    const end = Math.min(start + 20, filteredWords.length);

    batchCountEl.innerText = `${start + 1} ~ ${end} (총 ${filteredWords.length}개)`;

    const batchItems = filteredWords.slice(start, end);
    if (batchItems.length === 0) {
        batchListEl.innerHTML = '<p class="help-text" style="padding:20px; text-align:center;">단어가 없습니다.</p>';
        return;
    }

    batchItems.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'batch-item';
        itemEl.style.cssText = 'padding: 12px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;';
        itemEl.innerHTML = `
            <div>
                <strong style="font-size:18px;">${item.kanji}</strong> 
                <span style="color:#2563eb; font-size:14px;">[${item.kana}]</span>
                <p style="color:#475569; font-size:14px; margin-top:2px;">${item.meaning}</p>
            </div>
            <button class="btn btn-sm btn-outline" onclick="speakTTS('${item.kana || item.kanji}')">🔊</button>
        `;
        batchListEl.appendChild(itemEl);
    });
}

// =========================================
// 6. 🧠 SRS (망각 곡선 복습) 핵심 알고리즘
// =========================================
function updateSrsBadge() {
    const today = getTodayString();
    const dueList = words.filter(w => w.memorized && w.nextReviewDate && w.nextReviewDate <= today);
    const badgeEl = document.getElementById('srsBadge');
    if (badgeEl) badgeEl.innerText = dueList.length;
}

function initSrsReview() {
    const today = getTodayString();
    // 복습 일자가 오늘 이전이거나 오늘인 단어 추출
    srsList = words.filter(w => w.memorized && w.nextReviewDate && w.nextReviewDate <= today);
    srsIndex = 0;

    const srsEmpty = document.getElementById('srsEmpty');
    const srsContainer = document.getElementById('srsContainer');

    if (srsList.length === 0) {
        srsEmpty.style.display = 'block';
        srsContainer.style.display = 'none';
    } else {
        srsEmpty.style.display = 'none';
        srsContainer.style.display = 'block';
        updateSrsCard();
    }
}

function updateSrsCard() {
    if (srsIndex >= srsList.length) {
        initSrsReview(); // 복습 완료 시 갱신
        return;
    }

    const item = srsList[srsIndex];
    document.getElementById('srsWord').innerText = item.kanji || item.kana;
    document.getElementById('srsReading').innerText = item.kana || '';
    document.getElementById('srsMeaning').innerText = item.meaning || '';
    document.getElementById('srsProgress').innerText = `${srsIndex + 1} / ${srsList.length}`;

    const stageMap = { 1: '복습 1단계 (1일 차)', 2: '복습 2단계 (3일 차)', 3: '복습 3단계 (7일 차)' };
    document.getElementById('srsStageBadge').innerText = stageMap[item.srsStage] || `복습 ${item.srsStage}단계`;

    // 기본 숨김
    isSrsAnswerShown = false;
    document.getElementById('srsReading').classList.add('hidden');
    document.getElementById('srsMeaning').classList.add('hidden');
    document.getElementById('srsShowBtn').innerText = '정답 확인 (Space)';
}

function toggleSrsAnswer() {
    if (srsList.length === 0) return;
    const readingEl = document.getElementById('srsReading');
    const meaningEl = document.getElementById('srsMeaning');

    isSrsAnswerShown = !isSrsAnswerShown;
    if (isSrsAnswerShown) {
        readingEl.classList.remove('hidden');
        meaningEl.classList.remove('hidden');
        document.getElementById('srsShowBtn').innerText = '정답 숨기기 (Space)';
        speakTTS(srsList[srsIndex].kana || srsList[srsIndex].kanji);
    } else {
        readingEl.classList.add('hidden');
        meaningEl.classList.add('hidden');
        document.getElementById('srsShowBtn').innerText = '정답 확인 (Space)';
    }
}

// SRS 피드백 처리 (기억 상태 반영)
function processSrsFeedback(type) {
    if (srsList.length === 0) return;
    const item = srsList[srsIndex];
    const target = words.find(w => w.id === item.id);

    if (target) {
        const today = getTodayString();

        if (type === 'pass') {
            // ⭕ 잘 기억남: 다음 단계로 상승 (1일 -> 3일 -> 7일)
            target.srsStage = (target.srsStage || 1) + 1;
            if (target.srsStage === 2) {
                target.nextReviewDate = addDays(today, 3);
            } else if (target.srsStage === 3) {
                target.nextReviewDate = addDays(today, 7);
            } else {
                // 3단계 이상 통과 시 SRS 완전 완료
                target.nextReviewDate = addDays(today, 30);
            }
        } else if (type === 'hard') {
            // 🔺 헷갈림: 현재 복습 주기 유지 (1일 후 다시)
            target.nextReviewDate = addDays(today, 1);
        } else if (type === 'fail') {
            // ❌ 잘 기억 안 남: 1단계로 리셋 (내일 다시 복습)
            target.srsStage = 1;
            target.nextReviewDate = addDays(today, 1);
        }

        saveWordsData();
        updateSrsBadge();
    }

    srsIndex++;
    updateSrsCard();
}

// =========================================
// 7. 🔍 단어 검색 기능
// =========================================
function handleSearch(e) {
    const query = e.target.value.trim().toLowerCase();
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '';

    if (!query) {
        resultsContainer.style.display = 'none';
        return;
    }

    const matches = words.filter(w =>
        (w.kanji && w.kanji.toLowerCase().includes(query)) ||
        (w.kana && w.kana.toLowerCase().includes(query)) ||
        (w.meaning && w.meaning.toLowerCase().includes(query))
    ).slice(0, 8); // 최대 8개

    if (matches.length === 0) {
        resultsContainer.innerHTML = '<div class="search-item">검색 결과가 없습니다.</div>';
    } else {
        matches.forEach(m => {
            const div = document.createElement('div');
            div.className = 'search-item';
            div.innerHTML = `<strong>${m.kanji}</strong> (${m.kana}) - ${m.meaning}`;
            div.addEventListener('click', () => {
                showPage('study');
                const idx = filteredWords.findIndex(w => w.id === m.id);
                if (idx !== -1) currentIndex = idx;
                updateStudyView();
                resultsContainer.style.display = 'none';
                e.target.value = '';
            });
            resultsContainer.appendChild(div);
        });
    }
    resultsContainer.style.display = 'block';
}

// =========================================
// 8. 🧩 퀴즈 모드
// =========================================
function startQuiz() {
    if (words.length < 4) {
        alert('퀴즈를 진행하려면 최소 4개 이상의 단어가 필요합니다.');
        return;
    }

    // 무작위 10개 추출
    quizWords = [...words].sort(() => 0.5 - Math.random()).slice(0, 10);
    currentQuizIndex = 0;
    quizScore = 0;

    document.getElementById('quizResult').style.display = 'none';
    document.getElementById('quizChoices').style.display = 'grid';
    renderQuizQuestion();
}

function startBatchQuiz() {
    const start = currentBatchIndex * 20;
    const end = Math.min(start + 20, filteredWords.length);
    const batchList = filteredWords.slice(start, end);

    if (batchList.length < 4) {
        alert('묶음 퀴즈를 진행하려면 현재 묶음에 최소 4개 이상의 단어가 필요합니다.');
        return;
    }

    showPage('quiz');
    quizWords = [...batchList].sort(() => 0.5 - Math.random());
    currentQuizIndex = 0;
    quizScore = 0;

    document.getElementById('quizResult').style.display = 'none';
    document.getElementById('quizChoices').style.display = 'grid';
    renderQuizQuestion();
}

function renderQuizQuestion() {
    if (currentQuizIndex >= quizWords.length) {
        finishQuiz();
        return;
    }

    const current = quizWords[currentQuizIndex];
    document.getElementById('quizProgress').innerText = `문제 ${currentQuizIndex + 1} / ${quizWords.length}`;
    document.getElementById('quizScore').innerText = `점수: ${quizScore}`;
    document.getElementById('quizPosBadge').innerText = current.pos || '단어';
    document.getElementById('quizWord').innerText = current.kanji || current.kana;
    document.getElementById('quizKana').innerText = current.kana || '';
    document.getElementById('quizMessage').innerText = '';
    document.getElementById('nextQuestionBtn').style.display = 'none';

    document.getElementById('quizTtsBtn').onclick = () => speakTTS(current.kana || current.kanji);

    // 보기 생성 (정답 1개 + 오답 3개)
    const choices = [current.meaning];
    const otherMeanings = words.filter(w => w.meaning !== current.meaning).map(w => w.meaning);
    const shuffledOthers = otherMeanings.sort(() => 0.5 - Math.random()).slice(0, 3);
    
    const allChoices = [...choices, ...shuffledOthers].sort(() => 0.5 - Math.random());

    const choicesContainer = document.getElementById('quizChoices');
    choicesContainer.innerHTML = '';

    allChoices.forEach(choiceText => {
        const btn = document.createElement('button');
        btn.className = 'choice';
        btn.innerText = choiceText;
        btn.onclick = () => checkQuizAnswer(choiceText, current.meaning, btn);
        choicesContainer.appendChild(btn);
    });
}

function checkQuizAnswer(selected, correct, btnEl) {
    const choicesBtns = document.querySelectorAll('.choice');
    choicesBtns.forEach(b => b.disabled = true);

    const currentWord = quizWords[currentQuizIndex];

    if (selected === correct) {
        btnEl.classList.add('correct');
        quizScore++;
        document.getElementById('quizMessage').innerText = '⭕ 정답입니다!';
        document.getElementById('quizMessage').style.color = '#16a34a';
    } else {
        btnEl.classList.add('wrong');
        choicesBtns.forEach(b => {
            if (b.innerText === correct) b.classList.add('correct');
        });
        document.getElementById('quizMessage').innerText = `❌ 오답입니다. (정답: ${correct})`;
        document.getElementById('quizMessage').style.color = '#dc2626';

        // 오답 노트 추가
        if (!wrongAnswers.some(w => w.id === currentWord.id)) {
            wrongAnswers.push(currentWord);
            saveWrongData();
        }
    }

    const nextBtn = document.getElementById('nextQuestionBtn');
    nextBtn.style.display = 'block';
    nextBtn.onclick = () => {
        currentQuizIndex++;
        renderQuizQuestion();
    };
}

function finishQuiz() {
    document.getElementById('quizChoices').style.display = 'none';
    document.getElementById('quizMessage').innerText = '';
    document.getElementById('nextQuestionBtn').style.display = 'none';

    const resultEl = document.getElementById('quizResult');
    resultEl.style.display = 'block';
    document.getElementById('finalScore').innerText = `${quizScore} / ${quizWords.length}`;

    // 기록 저장
    const log = {
        date: new Date().toLocaleString('ko-KR'),
        score: quizScore,
        total: quizWords.length
    };
    quizLogs.unshift(log);
    if (quizLogs.length > 10) quizLogs.pop();
    saveLogsData();
}

// =========================================
// 9. 🔥 오답 노트 관리
// =========================================
function renderWrongList() {
    const container = document.getElementById('wrongList');
    container.innerHTML = '';

    if (wrongAnswers.length === 0) {
        container.innerHTML = '<p class="srs-empty-box">오답 노드가 비어 있습니다. 퀴즈에서 틀린 단어가 여기에 기록됩니다.</p>';
        return;
    }

    wrongAnswers.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'batch-item';
        div.style.cssText = 'padding: 12px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;';
        div.innerHTML = `
            <div>
                <strong style="font-size:18px;">${item.kanji}</strong> 
                <span style="color:#2563eb;">[${item.kana}]</span>
                <p style="color:#475569; font-size:14px;">${item.meaning}</p>
            </div>
            <button class="btn btn-sm btn-danger" onclick="removeWrongItem(${idx})">삭제</button>
        `;
        container.appendChild(div);
    });
}

function removeWrongItem(index) {
    wrongAnswers.splice(index, 1);
    saveWrongData();
    renderWrongList();
}

function startWrongQuiz() {
    if (wrongAnswers.length < 4) {
        alert('오답 집중 퀴즈를 진행하려면 오답 노에 최소 4개 이상의 단어가 있어야 합니다.');
        return;
    }
    showPage('quiz');
    quizWords = [...wrongAnswers].sort(() => 0.5 - Math.random());
    currentQuizIndex = 0;
    quizScore = 0;

    document.getElementById('quizResult').style.display = 'none';
    document.getElementById('quizChoices').style.display = 'grid';
    renderQuizQuestion();
}

// =========================================
// 10. 📊 통계 및 기록
// =========================================
function renderScorePage() {
    const bestEl = document.getElementById('bestScore');
    const recentEl = document.getElementById('recentScore');
    const logListEl = document.getElementById('quizLogList');

    if (quizLogs.length === 0) {
        bestEl.innerText = '0 / 0';
        recentEl.innerText = '0 / 0';
        logListEl.innerHTML = '<p class="help-text">아직 응시한 퀴즈 기록이 없습니다.</p>';
        return;
    }

    const recent = quizLogs[0];
    recentEl.innerText = `${recent.score} / ${recent.total}`;

    const best = quizLogs.reduce((max, cur) => cur.score > max.score ? cur : max, quizLogs[0]);
    bestEl.innerText = `${best.score} / ${best.total}`;

    logListEl.innerHTML = '';
    quizLogs.forEach(log => {
        const div = document.createElement('div');
        div.style.cssText = 'padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; display: flex; justify-content: space-between;';
        div.innerHTML = `<span>${log.date}</span> <strong>${log.score} / ${log.total} 점</strong>`;
        logListEl.appendChild(div);
    });
}

// =========================================
// 11. 🌐 예문 & 단어 실시간 번역기
// =========================================
async function handleTranslation() {
    const text = document.getElementById('translateInput').value.trim();
    const dir = document.getElementById('translateDirection').value;
    const resultEl = document.getElementById('translateResult');

    if (!text) {
        resultEl.innerText = '번역할 내용을 입력해주세요.';
        return;
    }

    resultEl.innerText = '번역 중...';

    const [langFrom, langTo] = dir.split('|');
    try {
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langFrom}|${langTo}`);
        const data = await res.json();
        if (data.responseData) {
            resultEl.innerText = data.responseData.translatedText;
        } else {
            resultEl.innerText = '번역 실패';
        }
    } catch (err) {
        resultEl.innerText = '번역 중 오류가 발생했습니다.';
    }
}

function addWordFromTranslator() {
    const text = document.getElementById('translateInput').value.trim();
    const result = document.getElementById('translateResult').innerText.trim();
    const dir = document.getElementById('translateDirection').value;

    if (!text || !result || result === '번역 중...' || result === '번역 실패') {
        alert('번역된 결과가 없습니다.');
        return;
    }

    let kanji = text, meaning = result;
    if (dir === 'ko|ja') {
        kanji = result;
        meaning = text;
    }

    const newWord = {
        id: Date.now(),
        kanji: kanji,
        kana: kanji,
        meaning: meaning,
        pos: '기타',
        memorized: false,
        srsStage: 0,
        nextReviewDate: null
    };

    words.push(newWord);
    saveWordsData();
    updateStudyView();
    alert('단어장에 정상적으로 추가되었습니다!');
}

// =========================================
// 12. 🔊 음성 합성 (TTS)
// =========================================
function speakTTS(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
}

// =========================================
// 13. 💾 CSV 및 JSON 백업 / 복원
// =========================================
function handleCsvUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const lines = event.target.result.split('\n');
        const newWords = [];

        lines.forEach((line, i) => {
            if (!line.trim()) return;
            const parts = line.split(',').map(p => p.trim());
            if (parts.length >= 3) {
                newWords.push({
                    id: Date.now() + i,
                    kanji: parts[0],
                    kana: parts[1],
                    meaning: parts[2],
                    pos: parts[3] || '기타',
                    memorized: false,
                    srsStage: 0,
                    nextReviewDate: null
                });
            }
        });

        if (newWords.length > 0) {
            words = newWords;
            saveWordsData();
            updateStudyView();
            updateSrsBadge();
            alert(`${newWords.length}개의 단어가 정상적으로 업로드되었습니다!`);
        }
    };
    reader.readAsText(file, 'UTF-8');
}

function exportDataJson() {
    const backupData = {
        words,
        wrongAnswers,
        quizLogs
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `JP_Word_Master_Backup_${getTodayString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importDataJson(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (data.words) words = data.words;
            if (data.wrongAnswers) wrongAnswers = data.wrongAnswers;
            if (data.quizLogs) quizLogs = data.quizLogs;

            saveWordsData();
            saveWrongData();
            saveLogsData();
            updateStudyView();
            updateSrsBadge();
            alert('데이터가 성공적으로 복원되었습니다!');
        } catch (err) {
            alert('올바른 백업 JSON 파일이 아닙니다.');
        }
    };
    reader.readAsText(file, 'UTF-8');
}