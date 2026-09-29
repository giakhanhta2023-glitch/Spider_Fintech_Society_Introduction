/* =========================================================================
   FinQuest: progress store (localStorage, fails soft in private mode)
   ========================================================================= */
(function (w) {
  'use strict';

  var KEY = 'finquest.progress.v1';
  var CFG = w.FQ_CONFIG;
  var listeners = [];

  var BADGES = [
    { id: 'orientation', ico: '🧭', name: 'Oriented', hint: 'Clear level 1',
      test: function (s) { return cleared(1, s); } },
    { id: 'toolsmith', ico: '🔧', name: 'Toolsmith', hint: 'Finish the setup checklist',
      test: function (s) { return lvl(1, s).projectDone; } },
    { id: 'first-build', ico: '🛠️', name: 'First build', hint: 'Ship any build',
      test: function (s) { return anyLevel(s, function (l) { return l.projectDone; }, 2); } },
    { id: 'perfect', ico: '🎯', name: 'Flawless', hint: 'Score 15 of 15 on a drill',
      test: function (s) { return anyLevel(s, function (l) { return l.quizBest === 15; }, 1); } },
    { id: 'halfway', ico: '⚡', name: 'Halfway', hint: 'Clear half the course',
      test: function (s) { return clearedCount(s) >= Math.ceil(total() / 2); } },
    { id: 'scholar', ico: '📚', name: 'Scholar', hint: 'Pass every drill',
      test: function (s) { return countWhere(s, function (l) { return l.quizPassed; }) >= total(); } },
    { id: 'shipper', ico: '🚀', name: 'Shipper', hint: 'Finish every build',
      test: function (s) { return countWhere(s, function (l) { return l.projectDone; }) >= total(); } },
    { id: 'cfo', ico: '👑', name: 'Principal engineer', hint: 'Clear the whole track',
      test: function (s) { return clearedCount(s) >= total(); } }
  ];

  /* ------------------------------------------------------------- tracks */
  /* Every count in this file is a count within one track, because "how many
     levels are there" has two answers: twenty for engineering and five for the
     analyst track. The active track is remembered per device. */
  function activeTrack() {
    var want = (state && state.track) || DEFAULT();
    return w.FQ && w.FQ.track && w.FQ.track(want) ? want : DEFAULT();
  }

  function DEFAULT() {
    return (w.FQ && w.FQ.DEFAULT_TRACK) || 'eng';
  }

  function trackLevels(trackId) {
    if (w.FQ && w.FQ.levelsIn) return w.FQ.levelsIn(trackId || activeTrack());
    return (w.FQ && w.FQ.levels) || [];
  }

  /* How many levels there are is a question for the curriculum, not for this
     file: register a sixth analyst level and every count here follows it. */
  function total() {
    return trackLevels().length;
  }

  function ids() {
    return trackLevels().map(function (l) { return l.id; });
  }

  /* A badge is earned inside a track, so finishing five analyst levels does not
     hand out the badge for twenty engineering ones. Keys for the default track
     keep their old shape, so saves written before the second track still read. */
  function badgeKey(id, trackId) {
    trackId = trackId || activeTrack();
    return trackId === DEFAULT() ? id : trackId + ':' + id;
  }

  function blank() {
    return { xp: 0, levels: {}, badges: [], started: Date.now(), tutorAsked: 0,
             track: DEFAULT() };
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
      obj.track = obj.track || DEFAULT();
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
    ids().forEach(function (i) { if (cleared(i, s)) n++; });
    return n;
  }

  function countWhere(s, fn) {
    var n = 0;
    ids().forEach(function (i) { if (fn(lvl(i, s))) n++; });
    return n;
  }

  function anyLevel(s, fn, from) {
    return ids().some(function (i) { return i >= (from || 1) && fn(lvl(i, s)); });
  }

  /* The badge list as the active track names it: the last one is that track's
     title rather than always an engineering one. */
  function badgeList(trackId) {
    var track = w.FQ && w.FQ.track ? w.FQ.track(trackId || activeTrack()) : null;
    return BADGES.map(function (b) {
      if (b.id !== 'cfo' || !track || !track.finalBadge) return b;
      return { id: b.id, ico: b.ico, name: track.finalBadge, hint: b.hint, test: b.test };
    });
  }

  function checkBadges() {
    var fresh = [];
    badgeList().forEach(function (b) {
      var key = badgeKey(b.id);
      if (state.badges.indexOf(key) === -1 && b.test(state)) {
        state.badges.push(key);
        fresh.push(b);
      }
    });
    return fresh;
  }

  function addXp(n) { state.xp += n; }

  var store = {
    BADGES: BADGES,

    /* ----------------------------- tracks ----------------------------- */
    track: activeTrack,
    trackOf: function (id) {
      return w.FQ && w.FQ.trackOfLevel ? w.FQ.trackOfLevel(id) : DEFAULT();
    },
    setTrack: function (trackId) {
      if (!trackId || trackId === state.track) return activeTrack();
      state.track = trackId;
      /* The new track may already be finished, so its badges are checked on
         arrival rather than only after the next quiz. */
      checkBadges();
      write();
      return activeTrack();
    },
    badgeList: badgeList,
    badgesEarned: function () {
      var mine = 0;
      badgeList().forEach(function (b) {
        if (state.badges.indexOf(badgeKey(b.id)) !== -1) mine++;
      });
      return mine;
    },

    /* Fold a saved state from the server into this device's state, keeping the
       better of the two everywhere. Signing in on a new laptop pulls your
       progress down; signing in after playing while logged out pushes it up.
       Neither direction can lose work. */
    merge: function (remote) {
      if (!remote || typeof remote !== 'object') return state;

      state.xp = Math.max(state.xp || 0, remote.xp || 0);
      state.tutorAsked = Math.max(state.tutorAsked || 0, remote.tutorAsked || 0);
      state.started = Math.min(state.started || Date.now(), remote.started || Date.now());

      (remote.badges || []).forEach(function (b) {
        if (state.badges.indexOf(b) === -1) state.badges.push(b);
      });

      Object.keys(remote.levels || {}).forEach(function (k) {
        var mine = lvl(k);
        var theirs = remote.levels[k] || {};
        /* The better attempt wins, and its answer sheet comes with it. */
        if ((theirs.quizBest || 0) > (mine.quizBest || 0)) {
          mine.quizBest = theirs.quizBest;
          mine.answers = theirs.answers || null;
        }
        mine.attempts = Math.max(mine.attempts || 0, theirs.attempts || 0);
        mine.quizPassed = !!(mine.quizPassed || theirs.quizPassed);
        mine.projectDone = !!(mine.projectDone || theirs.projectDone);
        Object.keys(theirs.reqs || {}).forEach(function (r) { mine.reqs[r] = true; });
      });

      checkBadges();
      write();
      return state;
    },

    all: function () { return state; },
    level: function (id) { return lvl(id); },
    xp: function () { return state.xp; },

    onChange: function (fn) { listeners.push(fn); },

    /* The previous level in the same track, not the previous id: the analyst
       track starts open rather than behind twenty engineering levels. */
    isUnlocked: function (id) {
      id = parseInt(id, 10);
      var order = ids();
      if (w.FQ && w.FQ.trackOfLevel) order = trackLevels(w.FQ.trackOfLevel(id))
        .map(function (l) { return l.id; });
      var at = order.indexOf(id);
      if (at <= 0) return true;                /* first in its track, or unknown */
      return cleared(order[at - 1]);
    },

    /* What to tell somebody standing in front of a locked row. */
    previousIn: function (id) {
      id = parseInt(id, 10);
      var levels = trackLevels(store.trackOf(id));
      var at = levels.map(function (l) { return l.id; }).indexOf(id);
      return at > 0 ? levels[at - 1] : null;
    },
    isCleared: function (id) { return cleared(id); },
    clearedCount: function () { return clearedCount(state); },

    /* first level that is unlocked but not cleared */
    currentLevel: function () {
      var open = ids().filter(function (i) { return store.isUnlocked(i) && !cleared(i); });
      return open.length ? open[0] : (ids()[ids().length - 1] || 1);
    },

    total: total,

    rank: function () {
      var n = clearedCount(state);
      var track = w.FQ && w.FQ.track ? w.FQ.track(activeTrack()) : null;
      var ladder = (track && track.ranks) || CFG.ranks;
      return ladder[Math.min(n, ladder.length - 1)];
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
      var gained = 0;
      l.attempts++;
      l.answers = answers || null;
      /* Only the improvement is paid for, so a drill cannot be farmed. */
      if (score > l.quizBest) {
        gained += (score - l.quizBest) * CFG.xp.perCorrectAnswer;
        l.quizBest = score;
      }
      if (score >= CFG.quiz.passMark && !l.quizPassed) {
        l.quizPassed = true;
        firstPass = true;
        gained += CFG.xp.quizPassBonus;
        if (score === total) gained += CFG.xp.perfectQuizBonus;
      }
      if (gained) addXp(gained);
      var fresh = checkBadges();
      write();
      return { firstPass: firstPass, badges: fresh, passed: l.quizPassed, gained: gained };
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

    badgeEarned: function (bid) {
      return state.badges.indexOf(badgeKey(bid)) !== -1;
    },

    bumpTutor: function () { state.tutorAsked = (state.tutorAsked || 0) + 1; write(); },

    reset: function () {
      state = blank();
      write();
    }
  };

  w.FQ = w.FQ || {};
  w.FQ.store = store;
})(window);
