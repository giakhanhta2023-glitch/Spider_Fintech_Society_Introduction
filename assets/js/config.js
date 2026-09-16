/* =========================================================================
   FinQuest — configuration
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

  /* Rank ladder — index = number of levels cleared */
  ranks: [
    'Intern', 'Junior Analyst', 'Analyst', 'Data Analyst', 'Quant Apprentice',
    'Credit Engineer', 'Risk Quant', 'Fraud Engineer', 'Platform Engineer',
    'Lead Engineer', 'Chief Fintech Officer'
  ],

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
