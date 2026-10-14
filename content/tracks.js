/* =========================================================================
   The two tracks.

   A track is a ladder with its own levels, its own rank titles and its own
   idea of what finishing means. Levels that name no track belong to the
   engineering one, which is why the original twenty files did not change when
   this file arrived.
   ========================================================================= */

FQ.registerTrack({
  id: 'eng',
  name: 'engineering',
  title: 'The engineering track',
  audience: 'computer science and anybody who wants to build the systems',
  blurb: 'Twenty levels from a first ledger to a payments platform that survives an hour of load ' +
         'and four injected failures.',
  outcome: 'backend or platform engineering in fintech',

  /* The existing ladder, left in config.js so that file keeps its documented
     shape. One title per level cleared, index 0 being where everybody starts. */
  ranks: window.FQ_CONFIG.ranks,
  finalBadge: 'Principal engineer'
});

FQ.registerTrack({
  id: 'fpa',
  name: 'analyst',
  title: 'The analyst track',
  audience: 'finance students who want the tech half of the job',
  blurb: 'Four builds: answer the month-end close in SQL, automate the manual part with pandas, ' +
         'forecast with a balance sheet that balances, and join it into a report that runs itself.',
  outcome: 'a corporate finance or planning analyst job, where automating your own reporting ' +
           'and catching the mistakes in it is what gets noticed',

  /* One title per level cleared, so index 0 is where everybody starts. */
  ranks: [
    'finance student', 'analyst intern', 'junior analyst', 'reporting analyst',
    'planning analyst', 'senior financial analyst'
  ],
  finalBadge: 'Senior financial analyst'
});
