/* =========================================================================
   FinQuest: configuration
   Edit this file to point the app at your own repo / AI endpoint.
   ========================================================================= */
window.FQ_CONFIG = {

  /* Where the solution keys live. Change the owner/repo to yours. */
  repo: {
    owner: 'giakhanhta2023-glitch',
    name: 'Spider_Fintech_Society_Introduction',
    branch: 'main'
  },

  /* Quiz rules */
  quiz: {
    total: 15,
    passMark: 12          // 12 / 15 = 80% to unlock the project
  },

  /* XP economy */
  xp: {
    perCorrectAnswer: 10,
    quizPassBonus: 60,
    projectComplete: 250,
    perfectQuizBonus: 40
  },

  /* Rank ladder: index = number of levels cleared */
  /* One title per level cleared, so index 0 is where everybody starts and the
     last entry is the whole course. Add a level, add a title. */
  ranks: [
    'intern', 'junior developer', 'developer', 'backend developer',
    'ledger developer', 'money engineer', 'database engineer', 'api engineer',
    'concurrency engineer', 'payments engineer', 'settlement engineer',
    'streaming engineer', 'distributed systems engineer',
    'senior backend engineer', 'performance engineer', 'security engineer',
    'reliability engineer', 'platform engineer', 'polyglot engineer',
    'staff engineer', 'principal engineer'
  ],

  /* Accounts. The client id identifies this site to Google and is meant to be
     public: it authorises nothing on its own. The secret half stays with
     Google, and the server checks every sign in against it. Leave it empty and
     the gate explains how to set it up rather than locking anyone out. */
  auth: {
    googleClientId: '180407502818-k48k1hvm3vv1rk3b7hf0gk06sbdd2atq.apps.googleusercontent.com'
  },

  /* AI tutor. The built-in offline tutor always works with zero setup.
     Set `endpoint` when you deploy the included serverless function. */
  tutor: {
    endpoint: '/api/chat',        // your own proxy; keeps the API key server-side
    model: 'claude-opus-5',       // only used by the bring-your-own-key path;
                                  // the deployed endpoint chooses its own model
    maxTokens: 900
  }
};

window.FQ_CONFIG.repoUrl = 'https://github.com/' +
  window.FQ_CONFIG.repo.owner + '/' + window.FQ_CONFIG.repo.name;

window.FQ_CONFIG.repoPath = function (path) {
  var c = window.FQ_CONFIG.repo;
  return 'https://github.com/' + c.owner + '/' + c.name + '/blob/' + c.branch + '/' + path;
};
