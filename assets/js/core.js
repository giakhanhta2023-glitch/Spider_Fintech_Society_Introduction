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

  var FQ = {
    levels: LEVELS,
    quotes: QUOTES,

    /* ---------------------------- registry ---------------------------- */
    registerLevel: function (level) {
      LEVELS.push(level);
      LEVELS.sort(function (a, b) { return a.id - b.id; });
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
      return FQ.esc(FQ.subst(s))
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
        .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
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
