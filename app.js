const STORAGE_KEY = "psycho-quiz-state-v3";
const DATA_URL = "./questions_by_topics.json";
const AUTO_ADVANCE_DELAY_MS = 700;
const REVIEW_ANSWER_OVERRIDES = {
  "psihodiagnostika-3": 1,
  "psihodiagnostika-21": 2,
};

const REQUIRED_TOPICS = [
  "Общая психология",
  "Возрастная психология",
  "Социальная психология",
  "Теории и методы психотерапии",
  "Введение в патопсихологию",
  "Психодиагностика",
];

const state = {
  data: null,
  topics: [],
  questions: [],
  selectedTopic: "all",
  mode: "all",
  currentIndex: 0,
  currentView: "quiz",
  sessionOrder: [],
  sessionCompletionKey: null,
  answers: {},
  retryAnswers: {},
  mistakes: [],
  history: {
    completedSessions: [],
  },
  charts: {
    statsChart: null,
  },
  completionShownForKey: null,
  navExpanded: false,
  autoAdvanceTimeoutId: null,
};

const elements = {
  topicSelect: document.getElementById("topic-select"),
  modeSelect: document.getElementById("mode-select"),
  randomQuestionButton: document.getElementById("random-question-button"),
  randomQuestionButtonMobile: document.getElementById("random-question-button-mobile"),
  restartButton: document.getElementById("restart-button"),
  restartStatsButton: document.getElementById("restart-stats-button"),
  clearProgressButton: document.getElementById("clear-progress-button"),
  viewQuizButton: document.getElementById("view-quiz-button"),
  viewStatsButton: document.getElementById("view-stats-button"),
  quizView: document.getElementById("quiz-view"),
  statsView: document.getElementById("stats-view"),
  leftStickyZone: document.getElementById("left-sticky-zone"),
  rightStickyZone: document.getElementById("right-sticky-zone"),
  questionNav: document.getElementById("question-nav"),
  questionNavFade: document.getElementById("question-nav-fade"),
  questionNavToggle: document.getElementById("question-nav-toggle"),
  questionNavToggleLabel: document.getElementById("question-nav-toggle-label"),
  progressBar: document.getElementById("progress-bar"),
  progressCaption: document.getElementById("progress-caption"),
  scoreCaption: document.getElementById("score-caption"),
  currentModeLabel: document.getElementById("current-mode-label"),
  sessionInfoTooltip: document.getElementById("session-info-tooltip"),
  answeredCount: document.getElementById("answered-count"),
  correctCount: document.getElementById("correct-count"),
  mistakesCount: document.getElementById("mistakes-count"),
  reviewCount: document.getElementById("review-count"),
  statsProgressBar: document.getElementById("stats-progress-bar"),
  statsSummary: document.getElementById("stats-summary"),
  mistakesList: document.getElementById("mistakes-list"),
  chartTitle: document.getElementById("chart-title"),
  statsChart: document.getElementById("stats-chart"),
  completedRunsCount: document.getElementById("completed-runs-count"),
  topicRunsCount: document.getElementById("topic-runs-count"),
  runsCaption: document.getElementById("runs-caption"),
  statusBanner: document.getElementById("status-banner"),
  questionCard: document.getElementById("question-card"),
  emptyState: document.getElementById("empty-state"),
  questionTopic: document.getElementById("question-topic"),
  questionNumber: document.getElementById("question-number"),
  reviewFlag: document.getElementById("review-flag"),
  questionText: document.getElementById("question-text"),
  questionHint: document.getElementById("question-hint"),
  optionsList: document.getElementById("options-list"),
  answerFeedback: document.getElementById("answer-feedback"),
  prevButton: document.getElementById("prev-button"),
  nextButton: document.getElementById("next-button"),
  resultModal: document.getElementById("result-modal"),
  closeResultModal: document.getElementById("close-result-modal"),
  modalCorrect: document.getElementById("modal-correct"),
  modalMistakes: document.getElementById("modal-mistakes"),
  modalPercent: document.getElementById("modal-percent"),
  modalPercentBox: document.getElementById("modal-percent-box"),
  modalPracticeMistakes: document.getElementById("modal-practice-mistakes"),
};

initialize();

async function initialize() {
  bindEvents();
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    state.data = data;
    state.topics = REQUIRED_TOPICS.filter((topic) => data.topics.some((entry) => entry.title === topic));
    state.questions = data.questions
      .filter((question) => state.topics.includes(question.topic))
      .map((question) => applyReviewOverride(question));

    hydrateState();
    renderTopicSelect();
    rebuildSession({ preservePosition: true });
    syncControls();
    render();
  } catch (error) {
    showEmptyState("Не удалось загрузить вопросы", `Проверьте файл ${DATA_URL}. ${error.message}`);
  }
}

function bindEvents() {
  elements.modeSelect.addEventListener("change", (event) => {
    state.mode = event.target.value;
    rebuildSession();
  });

  elements.topicSelect.addEventListener("change", (event) => {
    state.selectedTopic = event.target.value;
    rebuildSession();
  });

  elements.randomQuestionButton.addEventListener("click", () => {
    if (!state.sessionOrder.length) {
      return;
    }
    state.currentIndex = Math.floor(Math.random() * state.sessionOrder.length);
    saveState();
    render();
  });

  elements.randomQuestionButtonMobile.addEventListener("click", () => {
    if (!state.sessionOrder.length) {
      return;
    }
    state.currentIndex = Math.floor(Math.random() * state.sessionOrder.length);
    saveState();
    render();
  });

  elements.restartButton.addEventListener("click", () => restartSession());
  elements.restartStatsButton.addEventListener("click", () => resetTopicProgressFromStats());
  elements.clearProgressButton.addEventListener("click", () => clearProgress());
  elements.questionNavToggle.addEventListener("click", () => {
    state.navExpanded = !state.navExpanded;
    renderQuestionNav();
  });
  elements.closeResultModal.addEventListener("click", () => hideResultModal());
  elements.modalPracticeMistakes.addEventListener("click", () => startMistakesPractice());
  elements.resultModal.addEventListener("click", (event) => {
    if (event.target === elements.resultModal) {
      hideResultModal();
    }
  });

  elements.viewQuizButton.addEventListener("click", () => {
    state.currentView = "quiz";
    saveState();
    render();
  });

  elements.viewStatsButton.addEventListener("click", () => {
    state.currentView = "stats";
    saveState();
    render();
  });

  elements.prevButton.addEventListener("click", () => {
    if (state.currentIndex > 0) {
      state.currentIndex -= 1;
      saveState();
      render();
    }
  });

  elements.nextButton.addEventListener("click", () => {
    if (state.currentIndex < state.sessionOrder.length - 1) {
      state.currentIndex += 1;
      saveState();
      render();
      return;
    }

    const nextUnansweredIndex = findNextUnansweredCircular(state.currentIndex);
    if (nextUnansweredIndex !== -1) {
      state.currentIndex = nextUnansweredIndex;
      saveState();
      render();
    }
  });
}

function hydrateState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed.selectedTopic === "all" || state.topics.includes(parsed.selectedTopic)) {
      state.selectedTopic = parsed.selectedTopic;
    }
    if (["all", "mistakes"].includes(parsed.mode)) {
      state.mode = parsed.mode;
    }
    if (["quiz", "stats"].includes(parsed.currentView)) {
      state.currentView = parsed.currentView;
    }
    state.currentIndex = Number.isInteger(parsed.currentIndex) ? parsed.currentIndex : 0;
    state.answers = parsed.answers && typeof parsed.answers === "object" ? parsed.answers : {};
    state.retryAnswers = parsed.retryAnswers && typeof parsed.retryAnswers === "object" ? parsed.retryAnswers : {};
    state.mistakes = Array.isArray(parsed.mistakes) ? parsed.mistakes : [];
    state.history = normalizeHistory(parsed.history);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      selectedTopic: state.selectedTopic,
      mode: state.mode,
      currentIndex: state.currentIndex,
      currentView: state.currentView,
      sessionOrder: state.sessionOrder,
      sessionCompletionKey: state.sessionCompletionKey,
      answers: state.answers,
      retryAnswers: state.retryAnswers,
      mistakes: state.mistakes,
      history: state.history,
    })
  );
}

function restartSession() {
  clearAutoAdvanceTimeout();
  state.sessionOrder.forEach((questionId) => {
    delete state.answers[questionId];
    delete state.retryAnswers[questionId];
  });

  state.mistakes = state.mistakes.filter((questionId) => !state.sessionOrder.includes(questionId));
  state.currentIndex = 0;
  state.completionShownForKey = null;
  state.navExpanded = false;
  hideResultModal();
  rebuildSession();
}

function resetTopicProgressFromStats() {
  clearAutoAdvanceTimeout();
  const topicMatcher = (question) =>
    state.selectedTopic === "all" || question.topic === state.selectedTopic;

  state.questions.filter(topicMatcher).forEach((question) => {
    delete state.answers[question.id];
    delete state.retryAnswers[question.id];
  });

  const topicQuestionIds = new Set(
    state.questions.filter(topicMatcher).map((question) => question.id)
  );

  state.mistakes = state.mistakes.filter((questionId) => !topicQuestionIds.has(questionId));
  state.history.completedSessions = state.history.completedSessions.filter((entry) => {
    if (state.selectedTopic === "all") {
      return false;
    }
    return entry.topic !== state.selectedTopic;
  });

  state.currentIndex = 0;
  state.completionShownForKey = null;
  state.navExpanded = false;
  hideResultModal();
  rebuildSession();
}

function clearProgress() {
  clearAutoAdvanceTimeout();
  localStorage.removeItem(STORAGE_KEY);
  state.answers = {};
  state.retryAnswers = {};
  state.mistakes = [];
  state.currentIndex = 0;
  state.history = normalizeHistory();
  state.completionShownForKey = null;
  rebuildSession();
}

function renderTopicSelect() {
  elements.topicSelect.innerHTML = '<option value="all">Все</option>';

  state.topics.forEach((topic) => {
    const option = document.createElement("option");
    option.value = topic;
    option.textContent = topic;
    elements.topicSelect.appendChild(option);
  });
}

function syncControls() {
  elements.modeSelect.value = state.mode;
  elements.topicSelect.value = state.selectedTopic;
}

function rebuildSession({ preservePosition = false } = {}) {
  clearAutoAdvanceTimeout();
  const previousQuestionId = preservePosition ? state.sessionOrder[state.currentIndex] : null;
  const filteredQuestions = getFilteredQuestions();
  const orderedQuestions = filteredQuestions;

  state.sessionOrder = orderedQuestions.map((question) => question.id);
  state.sessionCompletionKey = createSessionCompletionKey();
  state.completionShownForKey = null;
  state.navExpanded = false;

  if (!state.sessionOrder.length) {
    state.currentIndex = 0;
  } else if (previousQuestionId && state.sessionOrder.includes(previousQuestionId)) {
    state.currentIndex = state.sessionOrder.indexOf(previousQuestionId);
  } else {
    state.currentIndex = 0;
  }

  renderTopicSelect();
  syncControls();
  saveState();
  render();
}

function getFilteredQuestions() {
  if (state.mode === "mistakes") {
    return state.questions
      .filter((question) => state.mistakes.includes(question.id))
      .filter((question) => state.selectedTopic === "all" || question.topic === state.selectedTopic)
      .sort((a, b) => a.topic.localeCompare(b.topic, "ru") || a.number - b.number);
  }

  return [...state.questions]
    .filter((question) => state.selectedTopic === "all" || question.topic === state.selectedTopic)
    .sort((a, b) => {
    const topicOrder = state.topics.indexOf(a.topic) - state.topics.indexOf(b.topic);
    return topicOrder || a.number - b.number;
  });
}

function render() {
  const currentQuestion = getCurrentQuestion();
  const stats = getStats();

  renderViewToggle();
  renderSessionStats(stats);
  renderStatus(stats);
  renderQuestionNav();
  renderStatsPage(stats);
  updateCompletionHistory(stats);

  if (!currentQuestion) {
    showEmptyState(
      state.mode === "mistakes" ? "Пока нет ошибок для повторения" : "Нет вопросов для отображения",
      state.mode === "mistakes"
        ? "Когда появятся ошибки в обычном режиме, они отобразятся здесь."
        : "Смените режим или тему."
    );
  } else {
    elements.emptyState.hidden = true;
    elements.questionCard.hidden = false;
    elements.questionTopic.textContent = currentQuestion.topic;
    elements.questionNumber.textContent = `Вопрос №${currentQuestion.number}`;
    elements.questionText.textContent = currentQuestion.question;
    elements.questionHint.textContent = "Выберите один вариант ответа.";
    elements.reviewFlag.hidden = !currentQuestion.needsReview;
    renderOptions(currentQuestion);
    elements.prevButton.disabled = state.currentIndex === 0;
    elements.nextButton.disabled =
      state.currentIndex >= state.sessionOrder.length - 1 &&
      findNextUnansweredCircular(state.currentIndex) === -1;
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }

  maybeShowCompletionModal(stats);
}

function renderViewToggle() {
  const isQuiz = state.currentView === "quiz";
  elements.quizView.classList.toggle("hidden", !isQuiz);
  elements.statsView.classList.toggle("hidden", isQuiz);
  elements.viewQuizButton.className = `view-button min-h-11 rounded-xl px-4 py-2.5 transition ${isQuiz ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`;
  elements.viewStatsButton.className = `view-button min-h-11 rounded-xl px-4 py-2.5 transition ${!isQuiz ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`;
}

function renderSessionStats(stats) {
  elements.answeredCount.textContent = String(stats.answered);
  elements.correctCount.textContent = String(stats.correct);
  elements.mistakesCount.textContent = String(stats.mistakesCount);
  if (elements.reviewCount) {
    elements.reviewCount.textContent = String(stats.reviewCount);
  }
  elements.progressCaption.textContent = `${stats.answered} из ${state.sessionOrder.length}`;
  elements.scoreCaption.textContent = `${stats.percent}%`;
  elements.progressBar.style.width = `${stats.completionPercent}%`;
  elements.currentModeLabel.textContent = getModeLabel();
}

function renderStatus(stats) {
  elements.statusBanner.hidden = true;
  elements.sessionInfoTooltip.textContent =
    `${getModeLabel()}. Отвечено ${stats.answered} из ${state.sessionOrder.length}. ` +
    `Правильных ответов: ${stats.correct} из ${stats.gradedAnswered}.`;
}

function renderQuestionNav() {
  elements.questionNav.innerHTML = "";
  const maxVisible = window.innerWidth < 640 ? 15 : 24;
  const shouldCollapse = state.sessionOrder.length > maxVisible;
  const visibleQuestions = shouldCollapse && !state.navExpanded
    ? state.sessionOrder.slice(0, maxVisible)
    : state.sessionOrder;

  visibleQuestions.forEach((questionId) => {
    const question = state.questions.find((item) => item.id === questionId);
    const answerEntry = getDisplayedAnswerEntry(questionId);
    const actualIndex = state.sessionOrder.indexOf(questionId);
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = String(question?.number ?? index + 1);
    button.title = `${question?.topic ?? ""} · вопрос ${question?.number ?? ""}`;
    button.className =
      "min-h-11 rounded-2xl border text-sm font-extrabold transition " +
      getNavButtonClass(actualIndex, question, answerEntry);

    button.addEventListener("click", () => {
      state.currentIndex = actualIndex;
      saveState();
      render();
    });

    elements.questionNav.appendChild(button);
  });

  elements.questionNavToggle.classList.toggle("hidden", !shouldCollapse);
  elements.questionNavToggle.classList.toggle("flex", shouldCollapse);
  elements.questionNavFade.classList.toggle("hidden", !shouldCollapse || state.navExpanded);
  elements.questionNavToggleLabel.textContent = state.navExpanded ? "Скрыть" : "Показать ещё";
}

function getNavButtonClass(index, question, answerEntry) {
  if (index === state.currentIndex) {
    return "border-slate-900 bg-slate-900 text-white";
  }
  if (question?.needsReview && answerEntry) {
    return "border-slate-300 bg-slate-100 text-slate-700";
  }
  if (answerEntry?.isCorrect) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (answerEntry && !answerEntry.isCorrect) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (question?.needsReview) {
    return "border-slate-200 bg-slate-50 text-slate-600";
  }
  return "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
}

function renderOptions(question) {
  const answerEntry = getDisplayedAnswerEntry(question.id);
  elements.optionsList.innerHTML = "";
  elements.questionText.className = getQuestionTitleClass(question.question);

  question.options.forEach((option, optionIndex) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = option;
    button.className =
      "w-full min-h-12 rounded-lg border px-4 py-3 text-left text-[15px] font-semibold leading-6 transition active:scale-[0.995] sm:text-base";

    if (answerEntry) {
      button.disabled = true;
      button.className += ` ${getAnsweredOptionClass(question, answerEntry, optionIndex)}`;
    } else {
      button.className += " border-slate-200 bg-white text-slate-800 hover:bg-slate-50";
      button.addEventListener("click", () => submitAnswer(question, optionIndex));
    }

    elements.optionsList.appendChild(button);
  });

  if (!answerEntry) {
    elements.questionHint.textContent = "Выберите один вариант ответа.";
    elements.answerFeedback.textContent = "";
    return;
  }

  elements.questionHint.textContent = answerEntry.isCorrect
    ? "Правильный ответ подсвечен ниже."
    : "Посмотрите правильный вариант ниже.";
  elements.answerFeedback.textContent = answerEntry.isCorrect
    ? "Верно."
    : `Неверно. Правильный вариант: ${question.options[question.answer]}.`;
}

function getAnsweredOptionClass(question, answerEntry, optionIndex) {
  if (optionIndex === question.answer) {
    return "border-emerald-300 bg-emerald-50 text-emerald-800";
  }
  if (optionIndex === answerEntry.selectedIndex && answerEntry.selectedIndex !== question.answer) {
    return "border-rose-300 bg-rose-50 text-rose-800";
  }
  return "border-stone-200 bg-stone-50 text-stone-500";
}

function submitAnswer(question, selectedIndex) {
  const isCorrect = selectedIndex === question.answer;
  const answerStore = state.mode === "mistakes" ? state.retryAnswers : state.answers;

  answerStore[question.id] = {
    selectedIndex,
    isCorrect,
    answeredAt: Date.now(),
  };

  if (isCorrect) {
    state.mistakes = state.mistakes.filter((id) => id !== question.id);
  } else if (!state.mistakes.includes(question.id)) {
    state.mistakes.push(question.id);
  }

  saveState();
  render();

  clearAutoAdvanceTimeout();
  state.autoAdvanceTimeoutId = window.setTimeout(() => {
    const nextForwardUnansweredIndex = findNextUnansweredForward(state.currentIndex);

    if (nextForwardUnansweredIndex !== -1) {
      state.currentIndex = nextForwardUnansweredIndex;
    } else if (state.currentIndex < state.sessionOrder.length - 1) {
      state.currentIndex += 1;
    } else {
      const nextUnansweredIndex = findNextUnansweredCircular(state.currentIndex);
      if (nextUnansweredIndex !== -1) {
        state.currentIndex = nextUnansweredIndex;
      }
    }

    saveState();
    render();
    state.autoAdvanceTimeoutId = null;
  }, AUTO_ADVANCE_DELAY_MS);
}

function renderStatsPage(stats) {
  elements.statsProgressBar.style.width = `${stats.completionPercent}%`;
  elements.statsSummary.textContent =
    `${getModeLabel()}: завершено ${stats.answered} из ${state.sessionOrder.length}. ` +
    `Правильных ответов ${stats.correct}, ошибок ${stats.mistakesCount}, точность ${stats.percent}%.`;

  renderCharts(stats);
  renderRunsSummary();

  if (!state.mistakes.length) {
    elements.mistakesList.textContent = "Пока нет ошибок для повторения.";
    return;
  }

  const labels = state.mistakes
    .map((id) => state.questions.find((question) => question.id === id))
    .filter(Boolean)
    .slice(0, 10)
    .map((question) => `${question.topic}: вопрос №${question.number}`);

  elements.mistakesList.textContent = labels.join(" • ");
}

function getCurrentQuestion() {
  const questionId = state.sessionOrder[state.currentIndex];
  return state.questions.find((question) => question.id === questionId) || null;
}

function getStats() {
  const visibleQuestions = state.sessionOrder
    .map((id) => state.questions.find((question) => question.id === id))
    .filter(Boolean);

  const reviewCount = visibleQuestions.filter((question) => question.needsReview).length;
  const answered = visibleQuestions.filter((question) => getDisplayedAnswerEntry(question.id)).length;
  const gradableQuestions = visibleQuestions;
  const gradedAnswered = gradableQuestions.filter((question) => getDisplayedAnswerEntry(question.id)).length;
  const correct = gradableQuestions.filter((question) => getDisplayedAnswerEntry(question.id)?.isCorrect).length;

  return {
    answered,
    gradedAnswered,
    correct,
    mistakesCount: Math.max(gradedAnswered - correct, 0),
    reviewCount,
    isCompleted: visibleQuestions.length > 0 && answered === visibleQuestions.length,
    percent: gradedAnswered ? Math.round((correct / gradedAnswered) * 100) : 0,
    completionPercent: visibleQuestions.length ? Math.round((answered / visibleQuestions.length) * 100) : 0,
  };
}

function updateCompletionHistory(stats) {
  if (!stats.isCompleted || !state.sessionCompletionKey) {
    return;
  }

  const exists = state.history.completedSessions.some((entry) => entry.key === state.sessionCompletionKey);
  if (exists) {
    return;
  }

  state.history.completedSessions.push({
    key: state.sessionCompletionKey,
    mode: state.mode,
    topic: state.selectedTopic,
    completedAt: new Date().toISOString(),
    answered: stats.answered,
    correct: stats.correct,
    percent: stats.percent,
  });
  saveState();
}

function maybeShowCompletionModal(stats) {
  if (!stats.isCompleted || !state.sessionCompletionKey) {
    return;
  }

  if (state.completionShownForKey === state.sessionCompletionKey) {
    return;
  }

  showResultModal(stats);
  state.completionShownForKey = state.sessionCompletionKey;
}

function showResultModal(stats) {
  const mistakes = Math.max(stats.gradedAnswered - stats.correct, 0);
  elements.modalCorrect.textContent = String(stats.correct);
  elements.modalMistakes.textContent = String(mistakes);
  elements.modalPercent.textContent = `${stats.percent}%`;
  elements.modalPercentBox.className =
    `rounded-2xl p-4 text-white ${stats.percent < 60 ? "bg-rose-600" : "bg-emerald-600"}`;
  elements.resultModal.classList.remove("hidden");
  elements.resultModal.classList.add("flex");
}

function hideResultModal() {
  elements.resultModal.classList.add("hidden");
  elements.resultModal.classList.remove("flex");
}

function startMistakesPractice() {
  hideResultModal();
  state.currentView = "quiz";
  state.mode = "mistakes";
  state.currentIndex = 0;
  state.retryAnswers = {};

  rebuildSession();
}

function createSessionCompletionKey() {
  return [
    state.mode,
    state.selectedTopic,
    Date.now(),
    Math.random().toString(36).slice(2, 8),
  ].join(":");
}

function normalizeHistory(history = undefined) {
  if (!history || typeof history !== "object") {
    return { completedSessions: [] };
  }
  return {
    completedSessions: Array.isArray(history.completedSessions) ? history.completedSessions : [],
  };
}

function renderCharts(stats) {
  if (typeof Chart === "undefined" || !elements.statsChart) {
    return;
  }

  const topicStats = getTopicBreakdown();
  const selectedTopicRuns = state.selectedTopic === "all"
    ? state.history.completedSessions.length
    : state.history.completedSessions.filter((entry) => entry.topic === state.selectedTopic).length;

  elements.chartTitle.textContent =
    state.selectedTopic === "all"
      ? `Общая статистика по всем темам. Завершённых прохождений: ${selectedTopicRuns}.`
      : `Статистика по теме: ${state.selectedTopic}. Завершений: ${selectedTopicRuns}.`;

  const labels = topicStats.map((entry) => entry.topicShort);
  const correctData = topicStats.map((entry) => entry.correct);
  const incorrectData = topicStats.map((entry) => entry.incorrect);

  if (state.charts.statsChart) {
    state.charts.statsChart.destroy();
  }

  state.charts.statsChart = new Chart(elements.statsChart, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Правильные ответы",
          data: correctData,
          backgroundColor: "#22c55e",
          borderRadius: 6,
          barThickness: 18,
        },
        {
          label: "Ошибки",
          data: incorrectData,
          backgroundColor: "#ef4444",
          borderRadius: 6,
          barThickness: 18,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: {
            boxWidth: 12,
            boxHeight: 12,
            color: "#334155",
          },
        },
      },
      scales: {
        x: {
          stacked: false,
          grid: {
            display: false,
          },
          ticks: {
            color: "#64748b",
          },
        },
        y: {
          beginAtZero: true,
          border: {
            display: false,
          },
          grid: {
            color: "#e2e8f0",
          },
          ticks: {
            precision: 0,
            color: "#64748b",
          },
        },
      },
    },
  });
}

function getTopicBreakdown() {
  const activeTopics = state.selectedTopic === "all" ? state.topics : [state.selectedTopic];

  return activeTopics.map((topic) => {
    const topicQuestions = state.questions.filter((question) => question.topic === topic && !question.needsReview);
    const correct = topicQuestions.filter((question) => state.answers[question.id]?.isCorrect).length;
    const incorrect = topicQuestions.filter((question) => {
      const answer = state.answers[question.id];
      return answer && !answer.isCorrect;
    }).length;

    return {
      topic,
      topicShort: topic,
      correct,
      incorrect,
    };
  });
}

function renderRunsSummary() {
  const totalRuns = state.history.completedSessions.length;
  const topicRuns = state.selectedTopic === "all"
    ? totalRuns
    : state.history.completedSessions.filter((entry) => entry.topic === state.selectedTopic).length;
  const modeRuns = state.history.completedSessions.filter((entry) => entry.mode === state.mode).length;

  elements.completedRunsCount.textContent = String(totalRuns);
  elements.topicRunsCount.textContent = String(topicRuns);
  elements.runsCaption.textContent =
    `Сессий в текущем режиме завершено: ${modeRuns}. ` +
    `Завершённое прохождение засчитывается, когда в выбранной сессии даны ответы на все вопросы.`;
}

function getModeLabel() {
  if (state.mode === "mistakes") {
    return state.selectedTopic === "all"
      ? "Повторение ошибок"
      : `Повторение ошибок · ${state.selectedTopic}`;
  }
  return state.selectedTopic === "all" ? "Все вопросы" : state.selectedTopic;
}

function findNextUnansweredIndex(excludeIndex = -1) {
  return state.sessionOrder.findIndex(
    (questionId, index) => index !== excludeIndex && !getDisplayedAnswerEntry(questionId)
  );
}

function findNextUnansweredCircular(currentIndex) {
  const total = state.sessionOrder.length;
  if (!total) {
    return -1;
  }

  for (let step = 1; step < total; step += 1) {
    const index = (currentIndex + step) % total;
    const questionId = state.sessionOrder[index];
    if (!getDisplayedAnswerEntry(questionId)) {
      return index;
    }
  }

  return -1;
}

function findNextUnansweredForward(currentIndex) {
  for (let index = currentIndex + 1; index < state.sessionOrder.length; index += 1) {
    const questionId = state.sessionOrder[index];
    if (!getDisplayedAnswerEntry(questionId)) {
      return index;
    }
  }

  return -1;
}

function applyReviewOverride(question) {
  const override = REVIEW_ANSWER_OVERRIDES[question.id];
  if (override === undefined) {
    return question;
  }

  return {
    ...question,
    answer: override,
    needsReview: false,
  };
}

function getQuestionTitleClass(questionText) {
  const length = questionText.length;
  if (length > 220) {
    return "max-w-4xl text-lg font-extrabold leading-snug sm:text-2xl";
  }
  if (length > 140) {
    return "max-w-4xl text-xl font-extrabold leading-snug sm:text-[1.65rem]";
  }
  return "max-w-4xl text-xl font-extrabold leading-snug sm:text-3xl";
}

function getDisplayedAnswerEntry(questionId) {
  if (state.mode === "mistakes") {
    return state.retryAnswers[questionId];
  }
  return state.answers[questionId];
}

function clearAutoAdvanceTimeout() {
  if (state.autoAdvanceTimeoutId !== null) {
    window.clearTimeout(state.autoAdvanceTimeoutId);
    state.autoAdvanceTimeoutId = null;
  }
}

function showEmptyState(title, text) {
  elements.questionCard.hidden = true;
  elements.emptyState.hidden = false;
  elements.emptyState.innerHTML = `<div class="max-w-md px-4"><h2 class="text-xl font-extrabold sm:text-2xl">${escapeHtml(title)}</h2><p class="mt-2 text-stone-600">${escapeHtml(text)}</p></div>`;
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
  }
  return items;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
