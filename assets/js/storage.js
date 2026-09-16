/* =========================================================================
   FinQuest: progress store (localStorage, fails soft in private mode)
   ========================================================================= */
(function (w) {
  'use strict';

  var KEY = 'finquest.progress.v1';
  var CFG = w.FQ_CONFIG;
  var listeners = [];

  var BADGES = [
    { id: 'orientation', ico: '🧭', name: 'Oriented', hint: 'Clear Level 1',
      test: function (s) { return cleared(1, s); } },
    { id: 'toolsmith', ico: '🔧', name: 'Toolsmith', hint: 'Finish the setup checklist',
      test: function (s) { return lvl(1, s).projectDone; } },
    { id: 'first-build', ico: '🛠️', name: 'First build', hint: 'Ship any project',
      test: function (s) { return anyLevel(s, function (l) { return l.projectDone; }, 2); } },
    { id: 'perfect', ico: '🎯', name: 'Flawless', hint: 'Score 15/15 on a quiz',
      test: function (s) { return anyLevel(s, function (l) { return l.quizBest === 15; }, 1); } },
    { id: 'halfway', ico: '⚡', name: 'Halfway', hint: 'Clear 5 levels',
      test: function (s) { return clearedCount(s) >= 5; } },
    { id: 'scholar', ico: '📚', name: 'Scholar', hint: 'Pass all 10 quizzes',
      test: function (s) { return countWhere(s, function (l) { return l.quizPassed; }) >= 10; } },
    { id: 'shipper', ico: '🚀', name: 'Shipper', hint: 'Ship 9 projects',
      test: function (s) { return countWhere(s, function (l) { return l.projectDone; }) >= 10; } },
    { id: 'cfo', ico: '👑', name: 'Chief fintech officer', hint: 'Clear all 10 levels',
      test: function (s) { return clearedCount(s) >= 10; } }
  ];

  function blank() {
    return { xp: 0, levels: {}, badges: [], started: Date.now(), tutorAsked: 0 };
  }

  function read() {
    try {
      var raw = w.localStorage.getItem(KEY);
      if (!raw) return blank();
      var obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return blank();
      obj.levels = obj.levels || {};
      obj.badges = obj.badges || [];
      obj.xp = obj.xp || 0;
      return obj;
    } catch (e) { return blank(); }
  }

  var state = read();

  function write() {
    try { w.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
    listeners.forEach(function (fn) { try { fn(state); } catch (e) { } });
  }

  function lvl(id, s) {
    s = s || state;
    var k = String(id);
    if (!s.levels[k]) {
      s.levels[k] = { quizBest: 0, quizPassed: false, attempts: 0, projectDone: false, reqs: {}, answers: null };
    }
    return s.levels[k];
  }

  function hasProject(id) {
    var L = w.FQ && w.FQ.level ? w.FQ.level(id) : null;
    return !!(L && (L.project || L.setup));
  }

  function cleared(id, s) {
    var l = lvl(id, s);
    if (!l.quizPassed) return false;
    return hasProject(id) ? !!l.projectDone : true;
  }

  function clearedCount(s) {
    var n = 0;
    for (var i = 1; i <= 10; i++) if (cleared(i, s)) n++;
    return n;
  }

  function countWhere(s, fn) {
    var n = 0;
    for (var i = 1; i <= 10; i++) if (fn(lvl(i, s))) n++;
    return n;
  }

  function anyLevel(s, fn, from) {
    for (var i = from || 1; i <= 10; i++) if (fn(lvl(i, s))) return true;
    return false;
  }

  function checkBadges() {
    var fresh = [];
    BADGES.forEach(function (b) {
      if (state.badges.indexOf(b.id) === -1 && b.test(state)) {
        state.badges.push(b.id);
        fresh.push(b);
      }
    });
    return fresh;
  }

  function addXp(n) { state.xp += n; }

  var store = {
    BADGES: BADGES,

    all: function () { return state; },
    level: function (id) { return lvl(id); },
    xp: function () { return state.xp; },

    onChange: function (fn) { listeners.push(fn); },

    isUnlocked: function (id) {
      id = parseInt(id, 10);
      if (id <= 1) return true;
      return cleared(id - 1);
    },
    isCleared: function (id) { return cleared(id); },
    clearedCount: function () { return clearedCount(state); },

    /* first level that is unlocked but not cleared */
    currentLevel: function () {
      for (var i = 1; i <= 10; i++) {
        if (store.isUnlocked(i) && !cleared(i)) return i;
      }
      return 10;
    },

    rank: function () {
      var n = clearedCount(state);
      return CFG.ranks[Math.min(n, CFG.ranks.length - 1)];
    },

    /* XP needed for the next rank tier: purely cosmetic pacing */
    xpProgress: function () {
      var tier = 500;
      var into = state.xp % tier;
      return { pct: Math.round((into / tier) * 100), into: into, tier: tier };
    },

    recordQuiz: function (id, score, total, answers) {
      var l = lvl(id);
      var firstPass = false;
      l.attempts++;
      l.answers = answers || null;
      if (score > l.quizBest) {
        var gain = (score - l.quizBest) * CFG.xp.perCorrectAnswer;
        addXp(gain);
        l.quizBest = score;
      }
      if (score >= CFG.quiz.passMark && !l.quizPassed) {
        l.quizPassed = true;
        firstPass = true;
        addXp(CFG.xp.quizPassBonus);
        if (score === total) addXp(CFG.xp.perfectQuizBonus);
      }
      var fresh = checkBadges();
      write();
      return { firstPass: firstPass, badges: fresh, passed: l.quizPassed };
    },

    toggleReq: function (id, idx) {
      var l = lvl(id);
      var k = String(idx);
      if (l.reqs[k]) delete l.reqs[k]; else l.reqs[k] = true;
      write();
      return !!l.reqs[k];
    },

    reqCount: function (id) {
      var l = lvl(id);
      return Object.keys(l.reqs).length;
    },

    completeProject: function (id) {
      var l = lvl(id);
      if (l.projectDone) return { already: true, badges: [] };
      l.projectDone = true;
      addXp(CFG.xp.projectComplete);
      var fresh = checkBadges();
      write();
      return { already: false, badges: fresh };
    },

    reopenProject: function (id) {
      var l = lvl(id);
      l.projectDone = false;
      write();
    },

    badgeEarned: function (bid) { return state.badges.indexOf(bid) !== -1; },

    bumpTutor: function () { state.tutorAsked = (state.tutorAsked || 0) + 1; write(); },

    reset: function () {
      state = blank();
      write();
    }
  };

  w.FQ = w.FQ || {};
  w.FQ.store = store;
})(window);
