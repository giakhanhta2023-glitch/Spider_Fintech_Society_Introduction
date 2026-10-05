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
  blurb: 'Twenty levels, from a first ledger to a payments platform that takes an ' +
         'hour of load and survives four injected failures. You finish with ' +
         'repositories that measure themselves. Four of them are language levels and are optional: ' +
         'take the ones whose jobs you want.',
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
  blurb: 'An evening of setup, then four builds: SQL for the month end close, ' +
         'pandas doing the part you used to do by hand, a three statement model ' +
         'that ties, and a reporting pack that rebuilds itself from raw data. It ' +
         'assumes you can use a spreadsheet and assumes nothing else.',
  outcome: 'a corporate finance or planning analyst job, where automating your own ' +
           'reporting is the thing that gets noticed',

  /* One title per level cleared, so index 0 is where everybody starts. */
  ranks: [
    'finance student', 'analyst intern', 'junior analyst', 'reporting analyst',
    'planning analyst', 'senior financial analyst'
  ],
  finalBadge: 'Senior financial analyst'
});
