// app.js

// --- Global State ---
let currentLevel = 1; 
let currentWord = '';
let currentQuizMode = 'random'; 
let score = 0;
let streak = 0;
let lastCorrectDate = null;
const video_folder = "Video Data";
let currentLevelWordCount = 0; // Total number of words in the current level

// --- State for Type-In prerequisite & Level Progression ---
// Track words seen correctly in each non-Type-In mode
let seenWordsMCQ = new Set(); 
let seenWordsVideoSelect = new Set(); 
let seenWordsTypeIn = new Set(); // New set to track Type-In completion for progression

// --- Array to hold words the user got wrong and needs to repeat ---
let incorrectWordsQueue = []; 
let isReviewMode = false; // State to track if we are in review mode

// --- Synonyms for flexible answers (e.g., 'father' = 'dad') ---
const synonyms = {
    'father': ['dad', 'daddy'],
    'mother': ['mom', 'mommy'],
    'hello': ['hi', 'greetings'],
    'bye': ['goodbye']
};

// --- DOM Elements (Unified) ---
const mainVideo = document.getElementById('main-video');
const wordToSelectText = document.getElementById('word-to-select');

// Type-In Elements
const typeInInputContainer = document.getElementById('type-in-input-container');
const typeInAnswerInput = document.getElementById('type-in-answer-input');
const typeInSubmitButton = document.getElementById('type-in-submit-button');

const optionsContainer = document.getElementById('options-container');

const nextButton = document.getElementById('next-button');
const reviewModeButton = document.getElementById('review-mode-button'); 
const feedbackText = document.getElementById('feedback-text');

const scoreSpan = document.getElementById('current-score');
const streakSpan = document.getElementById('current-streak');
const currentLevelDisplay = document.getElementById('current-level-display'); // New element

// Display for the active mode
const activeModeDisplay = document.getElementById('active-mode-display');

// --- Utility Functions ---

function saveState() {
    localStorage.setItem('signLanguageCurrentLevel', currentLevel);
    localStorage.setItem('signLanguageSeenWordsMCQ', JSON.stringify(Array.from(seenWordsMCQ)));
    localStorage.setItem('signLanguageSeenWordsVideoSelect', JSON.stringify(Array.from(seenWordsVideoSelect)));
    localStorage.setItem('signLanguageSeenWordsTypeIn', JSON.stringify(Array.from(seenWordsTypeIn)));
    localStorage.setItem('signLanguageScore', score);
    localStorage.setItem('streak', streak);
    localStorage.setItem('incorrectWordsQueue', JSON.stringify(incorrectWordsQueue));
}

function loadState() {
    const savedLevel = localStorage.getItem('signLanguageCurrentLevel');
    if (savedLevel !== null) {
        currentLevel = parseInt(savedLevel);
    }
    
    const savedMCQ = localStorage.getItem('signLanguageSeenWordsMCQ');
    if (savedMCQ) seenWordsMCQ = new Set(JSON.parse(savedMCQ));
    
    const savedVideoSelect = localStorage.getItem('signLanguageSeenWordsVideoSelect');
    if (savedVideoSelect) seenWordsVideoSelect = new Set(JSON.parse(savedVideoSelect));

    const savedTypeIn = localStorage.getItem('signLanguageSeenWordsTypeIn');
    if (savedTypeIn) seenWordsTypeIn = new Set(JSON.parse(savedTypeIn));
    
    const savedScore = localStorage.getItem('signLanguageScore');
    if (savedScore !== null) {
        score = parseFloat(savedScore);
    }
    const savedStreak = localStorage.getItem('streak');
    if (savedStreak !== null) {
        streak = parseInt(savedStreak);
    }
    const savedQueue = localStorage.getItem('incorrectWordsQueue');
    if (savedQueue) {
        incorrectWordsQueue = JSON.parse(savedQueue);
    }

    // Update UI elements
    scoreSpan.textContent = score;
    streakSpan.textContent = streak;
    currentLevelDisplay.textContent = currentLevel;
    reviewModeButton.textContent = `Review Mode (${incorrectWordsQueue.length})`;
}

async function checkLevelCompletion(levelWordCount) {
    if (currentLevelWordCount === 0 || isReviewMode) return;
    
    // A word is considered fully mastered in a level if:
    // 1. It was correctly answered in MCQ.
    // 2. It was correctly answered in Video Select.
    // 3. It was correctly answered in Type-In.
    
    // We fetch the list of words in the current level to check against
    const response = await fetch('/level-data');
    if (!response.ok) return;
    const data = await response.json();
    const currentLevelKey = `Level ${currentLevel}`;
    const levelWords = new Set(data.allLevels[currentLevelKey] || []);

    if (levelWords.size === 0) return;

    let fullyMasteredCount = 0;
    
    for (const word of levelWords) {
        if (seenWordsMCQ.has(word) && 
            seenWordsVideoSelect.has(word) && 
            seenWordsTypeIn.has(word)) {
            fullyMasteredCount++;
        }
    }
    
    // Check for level advancement
    if (fullyMasteredCount === levelWords.size) {
        // Check if there's a next level available
        if (currentLevel < data.totalLevels) {
            currentLevel++;
            currentLevelDisplay.textContent = currentLevel;
            feedbackText.textContent = `🎉 Level Cleared! Advancing to Level ${currentLevel}! 🎉`;
            feedbackText.className = 'feedback correct-answer-text';
            // Start the next level quiz immediately
            startQuiz(); 
        } else {
            feedbackText.textContent = '🥳 Congratulations! You have mastered all available levels! 🏆';
            feedbackText.className = 'feedback correct-answer-text';
        }
        saveState();
    }
}


function handleCorrectAnswer() {
    // Only track words seen and answered correctly in a question-based mode 
    if (currentWord && !isReviewMode) {
        const wordLower = currentWord.toLowerCase();

        if (currentQuizMode === 'mcq') {
            seenWordsMCQ.add(wordLower);
        } else if (currentQuizMode === 'video_select') {
            seenWordsVideoSelect.add(wordLower);
        } else if (currentQuizMode === 'typein') {
            seenWordsTypeIn.add(wordLower);
        }
        
        saveState();
        
        // After any correct answer, check if the level is complete
        checkLevelCompletion(currentLevelWordCount);
    }
    
    // If we're in review mode, remove it from the incorrect queue
    if (isReviewMode) {
        const index = incorrectWordsQueue.indexOf(currentWord);
        if (index > -1) {
            incorrectWordsQueue.splice(index, 1);
            reviewModeButton.textContent = `Review Mode (${incorrectWordsQueue.length})`;
            // If the queue is empty after removal, exit review mode
            if (incorrectWordsQueue.length === 0) {
                toggleReviewMode();
            }
        }
        saveState();
    }
}

// --- Quiz Mode Logic ---

function checkAnswer(selectedAnswer) {
    let normalizedAnswer = selectedAnswer.toLowerCase().trim();
    let isCorrect = false;
    
    // Disable options and enable the next button immediately upon checking the answer
    disableOptions(currentQuizMode);
    nextButton.disabled = false;
    reviewModeButton.disabled = false;
    
    if (currentQuizMode === 'typein') {
        normalizedAnswer = typeInAnswerInput.value.toLowerCase().trim();
    }
    
    isCorrect = normalizedAnswer === currentWord.toLowerCase();
    
    if (!isCorrect && synonyms[currentWord]) {
        if (synonyms[currentWord].includes(normalizedAnswer)) {
            isCorrect = true;
        }
    }

    // --- Feedback and Styling ---
    if (isCorrect) {
        feedbackText.textContent = '✅ Correct!';
        feedbackText.className = 'feedback correct-answer-text';
        
        const correctElement = (currentQuizMode === 'mcq') 
            ? document.querySelector(`button[data-word="${currentWord.toLowerCase()}"]`)
            : (currentQuizMode === 'video_select') 
                ? document.querySelector(`.video-option[data-word="${currentWord.toLowerCase()}"]`)
                : typeInAnswerInput;
        
        if (correctElement) correctElement.classList.add('correct-answer');
        
    } else {
        feedbackText.textContent = `❌ Incorrect! The correct word was: ${currentWord.toUpperCase()}`;
        feedbackText.className = 'feedback incorrect-answer-text';
        
        if (currentQuizMode === 'mcq') {
            const incorrectBtn = document.querySelector(`button[data-word="${selectedAnswer}"]`);
            if(incorrectBtn) incorrectBtn.classList.add('incorrect-answer');
            const correctBtn = document.querySelector(`button[data-word="${currentWord.toLowerCase()}"]`);
            if(correctBtn) correctBtn.classList.add('correct-answer');
            
        } else if (currentQuizMode === 'video_select') {
            const incorrectVideoOpt = document.querySelector(`.video-option[data-word="${selectedAnswer}"]`);
            if(incorrectVideoOpt) incorrectVideoOpt.classList.add('incorrect-answer');
            const correctVideoOpt = document.querySelector(`.video-option[data-word="${currentWord.toLowerCase()}"]`);
            if(correctVideoOpt) correctVideoOpt.classList.add('correct-answer');
            
        } else if (currentQuizMode === 'typein') {
             typeInAnswerInput.classList.add('incorrect-answer');
             // Show correct answer feedback text already handles showing the correct word
        }
    }

    updateData(isCorrect);
}

function disableOptions(mode) {
    if (mode === 'mcq') {
        optionsContainer.querySelectorAll('button').forEach(btn => {
            btn.disabled = true;
            btn.removeEventListener('click', handleOptionClick);
        });
    } else if (mode === 'video_select') {
        optionsContainer.querySelectorAll('.video-option').forEach(div => {
            div.style.pointerEvents = 'none'; 
            div.removeEventListener('click', handleVideoOptionClick);
        });
    } else if (mode === 'typein') {
        typeInSubmitButton.disabled = true;
        typeInAnswerInput.disabled = true;
        typeInSubmitButton.removeEventListener('click', handleTypeInSubmit);
        typeInAnswerInput.removeEventListener('keypress', handleEnterKey);
    }
}

function handleOptionClick(event) {
    const selectedAnswer = event.target.getAttribute('data-word');
    checkAnswer(selectedAnswer);
}

function handleVideoOptionClick(event) {
    const videoOption = event.target.closest('.video-option');
    if (videoOption) {
        const selectedAnswer = videoOption.getAttribute('data-word');
        checkAnswer(selectedAnswer);
    }
}

function handleTypeInSubmit() {
    checkAnswer(typeInAnswerInput.value);
}

function handleEnterKey(event) {
    if (event.key === 'Enter') {
        handleTypeInSubmit();
    }
}

function renderWordOptions(options) {
    optionsContainer.innerHTML = '';
    optionsContainer.className = 'options-container'; 
    options.forEach(word => {
        const button = document.createElement('button');
        button.className = 'md-button quiz-option-button';
        button.textContent = word.toUpperCase();
        button.setAttribute('data-word', word.toLowerCase());
        button.addEventListener('click', handleOptionClick);
        optionsContainer.appendChild(button);
    });
}

function renderVideoOptions(videoOptions) {
    optionsContainer.innerHTML = '';
    optionsContainer.className = 'options-container video-select-grid'; 
    
    videoOptions.forEach(option => {
        const container = document.createElement('div');
        container.className = 'video-option';
        container.setAttribute('data-word', option.word.toLowerCase());
        container.addEventListener('click', handleVideoOptionClick);

        const video = document.createElement('video');
        video.className = 'video-option-player';
        video.src = `${video_folder}/${option.videoUrl}`;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.load();
        
        container.appendChild(video);
        optionsContainer.appendChild(container);
    });
}

function renderTypeInMode() {
    optionsContainer.innerHTML = ''; 
    optionsContainer.className = 'options-container'; 

    typeInAnswerInput.value = '';
    typeInAnswerInput.disabled = false;
    typeInSubmitButton.disabled = false;
    typeInAnswerInput.className = 'text-input';
    
    typeInSubmitButton.removeEventListener('click', handleTypeInSubmit); 
    typeInAnswerInput.removeEventListener('keypress', handleEnterKey);
    
    typeInSubmitButton.addEventListener('click', handleTypeInSubmit);
    typeInAnswerInput.addEventListener('keypress', handleEnterKey);
}

// Function to calculate the intersection of the two seen sets (MCQ and Video Select)
function getUnlockedWords() {
    return new Set(
        [...seenWordsMCQ].filter(word => seenWordsVideoSelect.has(word))
    );
}

async function fetchQuizData(targetWord = null) {
    const currentLevelKey = `Level ${currentLevel}`;
    
    let url = `/quiz-data?current_level=${currentLevelKey}`;
    if (targetWord) {
        url += `&target_word=${targetWord}`;
    }
    
    // Calculate the intersection (fully unlocked words) and send it to the server
    const unlockedWordsArray = Array.from(getUnlockedWords());
    const unlockedWordsString = JSON.stringify(unlockedWordsArray);
    url += `&unlocked_words=${encodeURIComponent(unlockedWordsString)}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

async function startQuiz() {
    feedbackText.textContent = '';
    feedbackText.className = 'feedback';
    // Disable buttons temporarily while fetching the new question
    nextButton.disabled = true; 
    reviewModeButton.disabled = true;
    
    const targetWord = isReviewMode ? incorrectWordsQueue[0] : null;
                       
    try {
        const data = await fetchQuizData(targetWord);
        
        if (data.error) {
            feedbackText.textContent = data.error;
            // CRITICAL FIX: If server returns error, re-enable to allow retry.
            nextButton.disabled = false; 
            reviewModeButton.disabled = false;
            return;
        }

        currentWord = data.correctWord;
        currentQuizMode = data.actualQuizMode; 
        currentLevelWordCount = data.levelWordCount; // Store the level count for completion check
        
        let displayModeText = currentQuizMode.replace('_', ' ');
        activeModeDisplay.textContent = `Mode: ${displayModeText.toUpperCase()}`;

        const isVisualMode = (currentQuizMode === 'mcq' || currentQuizMode === 'typein');
        
        // --- Manage UI elements visibility ---
        mainVideo.style.display = isVisualMode ? 'block' : 'none';
        wordToSelectText.style.display = (currentQuizMode === 'video_select') ? 'block' : 'none';
        typeInInputContainer.style.display = (currentQuizMode === 'typein') ? 'flex' : 'none';
        optionsContainer.style.display = (currentQuizMode === 'mcq' || currentQuizMode === 'video_select') ? 'flex' : 'none'; // Use flex for options

        // --- Setup based on the determined mode ---
        if (currentQuizMode === 'mcq') {
            // Video-to-Word (MCQ) Setup
            mainVideo.src = `${video_folder}/${data.videoUrl}`;
            mainVideo.load();
            mainVideo.play();
            renderWordOptions(data.options);
            
        } else if (currentQuizMode === 'video_select') {
            // Word-to-Video (Select) Setup
            wordToSelectText.textContent = `Which video shows: ${currentWord.toUpperCase()}?`;
            renderVideoOptions(data.videoOptions);

        } else if (currentQuizMode === 'typein') {
            // Video-to-Word (Type-In) Setup
            mainVideo.src = `${video_folder}/${data.videoUrl}`;
            mainVideo.load();
            mainVideo.play();
            renderTypeInMode();
            typeInAnswerInput.focus(); 
        }
        
    } catch (error) {
        console.error('Failed to fetch quiz data:', error);
        feedbackText.textContent = 'Failed to load quiz data (Network Error). Please try again.';
        // CRITICAL FIX: Re-enable on network failure to allow the user to click "Next Sign" to retry.
        nextButton.disabled = false; 
        reviewModeButton.disabled = false;
    }
}


function toggleReviewMode() {
    isReviewMode = !isReviewMode;
    if (isReviewMode && incorrectWordsQueue.length === 0) {
        isReviewMode = false;
        feedbackText.textContent = 'Your review list is empty! Keep practicing to fill it up.';
        feedbackText.className = 'feedback correct-answer-text'; 
        reviewModeButton.textContent = `Review Mode (0)`;
        nextButton.textContent = 'Next Sign';
        return;
    }

    if (isReviewMode) {
        reviewModeButton.textContent = `Exit Review Mode`;
        nextButton.textContent = 'Next Review Sign';
    } else {
        reviewModeButton.textContent = `Review Mode (${incorrectWordsQueue.length})`;
        nextButton.textContent = 'Next Sign';
    }
    
    startQuiz();
}

// --- Initial Setup and Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    
    document.getElementById('review-mode-button').addEventListener('click', toggleReviewMode);
    nextButton.addEventListener('click', startQuiz);
    
    // Start the quiz with the loaded level
    startQuiz();
});
