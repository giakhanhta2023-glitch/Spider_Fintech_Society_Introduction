/* =========================================================================
   FinQuest: core data layer.

   Deliberately a plain script with no imports: the ten curriculum files load
   straight after it and register themselves here, so the content is readable
   and editable without a build step. The React interface reads from this.
   ========================================================================= */
(function (w) {
  'use strict';

  var LEVELS = [];
  var QUOTES = [];
  var TRACKS = [];

  /* A level with no track belongs to the engineering one, so the twenty
     original files needed no edit when the second track arrived. */
  var DEFAULT_TRACK = 'eng';

  var FQ = {
    levels: LEVELS,
    quotes: QUOTES,
    tracks: TRACKS,
    DEFAULT_TRACK: DEFAULT_TRACK,

    /* ---------------------------- registry ---------------------------- */
    registerLevel: function (level) {
      LEVELS.push(level);
      LEVELS.sort(function (a, b) { return a.id - b.id; });
    },

    /* { id, name, kicker, blurb, ranks, finalBadge } */
    registerTrack: function (track) {
      TRACKS.push(track);
    },

    trackIdOf: function (level) {
      return (level && level.track) || DEFAULT_TRACK;
    },

    track: function (id) {
      id = id || DEFAULT_TRACK;
      for (var i = 0; i < TRACKS.length; i++) {
        if (TRACKS[i].id === id) return TRACKS[i];
      }
      return TRACKS.length ? TRACKS[0] : null;
    },

    /* The levels of one track, in order. Everything that counts levels asks
       this rather than reading FQ.levels, because "how many levels are there"
       has two answers now. */
    levelsIn: function (trackId) {
      trackId = trackId || DEFAULT_TRACK;
      return LEVELS.filter(function (l) { return FQ.trackIdOf(l) === trackId; });
    },

    trackOfLevel: function (id) {
      var L = FQ.level(id);
      return L ? FQ.trackIdOf(L) : DEFAULT_TRACK;
    },

    /* Where a level sits inside its own track: the number a reader sees. The
       engineering ids are already 1 to 20, so only a second track needs to say
       it. */
    positionOf: function (level) {
      if (!level) return 0;
      if (level.position) return level.position;
      return FQ.levelsIn(FQ.trackIdOf(level)).indexOf(level) + 1;
    },

    /* How to name a level in a sentence. Ids are global and positions are per
       track, so anything written for a reader says the position, and says which
       track when it is not the default one. */
    labelOf: function (id) {
      var L = FQ.level(id);
      if (!L) return 'level ' + id;
      var n = String(FQ.positionOf(L));
      if (n.length < 2) n = '0' + n;
      var trackId = FQ.trackIdOf(L);
      if (trackId === DEFAULT_TRACK) return 'level ' + n;
      var track = FQ.track(trackId);
      return (track ? track.name : trackId) + ' level ' + n;
    },

    /* Each line is { q: what was said, who: who said it }. */
    registerQuotes: function (lines) {
      lines.forEach(function (line) { QUOTES.push(line); });
    },

    /* The line for a given day, the same one for everybody in the society,
       changing at local midnight. A date rather than a random number, so
       nobody gets three different quotes from three reloads. */
    quoteOfTheDay: function (when) {
      if (!QUOTES.length) return null;
      var d = when || new Date();
      var day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
      return QUOTES[((day % QUOTES.length) + QUOTES.length) % QUOTES.length];
    },

    level: function (id) {
      id = parseInt(id, 10);
      for (var i = 0; i < LEVELS.length; i++) {
        if (LEVELS[i].id === id) return LEVELS[i];
      }
      return null;
    },

    /* ----------------------------- escaping ---------------------------- */
    esc: function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    /* {{RAW}} and {{REPO}} expand to the configured GitHub URLs, so the
       curriculum never hardcodes someone else's repository. */
    subst: function (s) {
      var c = w.FQ_CONFIG.repo;
      return String(s == null ? '' : s)
        .replace(/\{\{RAW\}\}/g,
          'https://raw.githubusercontent.com/' + c.owner + '/' + c.name + '/' + c.branch)
        .replace(/\{\{REPO\}\}/g, w.FQ_CONFIG.repoUrl);
    },

    /* Inline markdown subset used throughout the curriculum:
       **bold**, *em*, `code`, [text](url) */
    md: function (s) {
      /* Code spans come out first and go back last. Without that, an expression
         like `p * (1 + r) ** n` loses its operators to the emphasis rules and
         the reader is shown an answer that is not the one that was written. */
      var spans = [];
      var out = FQ.esc(FQ.subst(s)).replace(/`([^`]+)`/g, function (_, code) {
        spans.push(code);
        return '\u0000' + (spans.length - 1) + '\u0000';
      });
      return out
        .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
        .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/\u0000(\d+)\u0000/g, function (_, i) { return '<code>' + spans[i] + '</code>'; });
    },

    /* -------------------- syntax highlighting, no deps ------------------- */
    highlight: function (src, lang) {
      var re;
      if (lang === 'python' || lang === 'py') {
        re = /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[^\n]*|\b(?:def|class|return|if|elif|else|for|while|in|not|and|or|import|from|as|with|try|except|finally|raise|lambda|None|True|False|pass|break|continue|global|assert|yield|is|async|await)\b|\b\d+(?:\.\d+)?\b)/g;
      } else if (lang === 'js' || lang === 'javascript' || lang === 'json') {
        re = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\/[^\n]*|\/\*[\s\S]*?\*\/|\b(?:const|let|var|function|return|if|else|for|while|of|in|new|class|import|export|from|async|await|try|catch|finally|throw|typeof|null|undefined|true|false)\b|\b\d+(?:\.\d+)?\b)/g;
      } else if (lang === 'bash' || lang === 'sh' || lang === 'shell') {
        re = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[^\n]*|\b\d+(?:\.\d+)?\b)/g;
      } else {
        return FQ.esc(src);
      }

      var out = '', last = 0, m;
      re.lastIndex = 0;
      while ((m = re.exec(src)) !== null) {
        out += FQ.esc(src.slice(last, m.index));
        var tok = m[0], cls;
        if (tok.charAt(0) === '#' || tok.slice(0, 2) === '//' || tok.slice(0, 2) === '/*') cls = 'c';
        else if (tok.charAt(0) === '"' || tok.charAt(0) === "'" || tok.charAt(0) === '`') cls = 's';
        else if (/^[0-9]/.test(tok)) cls = 'n';
        else cls = 'k';
        out += '<span class="' + cls + '">' + FQ.esc(tok) + '</span>';
        last = m.index + tok.length;
        if (m.index === re.lastIndex) re.lastIndex++;      /* zero-width guard */
      }
      return out + FQ.esc(src.slice(last));
    },

    plural: function (n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  };

  w.FQ = FQ;
})(window);
