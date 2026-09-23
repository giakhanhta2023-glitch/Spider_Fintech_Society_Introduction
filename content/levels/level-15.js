/* =========================================================================
   LEVEL 15: the keys to the money
   ========================================================================= */
FQ.registerLevel({
  id: 15,
  codename: 'vault',
  title: 'The keys to the money',
  tagline: 'Card numbers, secrets, signed requests and the people who should not be able to read any of it. The part of fintech engineering that ends careers when it is done badly, learned before anybody is relying on you.',
  difficulty: 9,
  minutes: 450,
  tags: ['security', 'encryption', 'OAuth2', 'PCI', 'threat modelling'],
  summary: 'You have built a system that moves money. This level is about the fact that other people would like to move ' +
           'it too. Threat modelling, secrets, service to service authentication, envelope encryption, a card vault ' +
           'with tokenisation, signed webhooks, logs that do not leak, and an audit trail that survives an insider. ' +
           'Measured where it can be measured, including one result that came out the opposite way to the textbook.',

  objectives: [
    'Write a threat model that names assets, actors and what you are choosing not to defend',
    'Choose between API keys, OAuth2 and mutual TLS, and say why',
    'Verify a JWT with all five checks, not the one line that looks like verification',
    'Implement envelope encryption and rotate a master key without rewriting your data',
    'Tokenise card numbers so that most of your system never sees one',
    'Sign and verify a webhook so a replayed or edited one is rejected',
    'Keep secrets out of logs, and prove it with a test'
  ],

  knowledge: [
    { h: 'Security is a list of decisions, not a feature' },
    { p: 'Nothing is "secure". A system is secure **against a stated attacker, for a stated asset, to a stated cost**, ' +
         'and everything else is marketing. So the first artefact is a **threat model** rather than code: three columns ' +
         'that force you to be specific.' },
    { table: {
      head: ['Asset', 'Who wants it', 'What you do about it'],
      rows: [
        ['Card numbers', 'Anyone who can sell them, including a compromised dependency', 'Tokenise, encrypt, and keep them out of most services'],
        ['The ability to move money', 'An attacker with a stolen API key, or an employee', 'Scoped credentials, limits, an audit trail, four eyes on large payouts'],
        ['Customer data', 'Credential stuffing, a leaked backup, a curious insider', 'Least privilege, encryption at rest, access logging'],
        ['Availability', 'Extortion, or a competitor', 'Level 14: rate limits and shedding. Security and latency are the same work here'],
        ['Your signing keys', 'Everyone above', 'A key service, short lifetimes, and a rotation you have actually practised']
      ]
    }},
    { p: 'The fourth column, the one people leave out, is **what you are choosing not to defend**. A startup that writes ' +
         '"we do not defend against a determined nation state, and we accept that a compromised laptop with production ' +
         'access is game over" is being more serious than one that claims bank-grade security, because it has told you ' +
         'where to look next.' },
    { money: 'Interviewers at payments companies ask about this directly: "walk me through how you would secure a service ' +
             'that stores card numbers". The answer that stands out starts with assets and attackers, not with a list of ' +
             'technologies. Anybody can say TLS.' },

    { h: 'Secrets: the boring failure that keeps happening' },
    { p: 'Most breaches do not start with cryptography. They start with a key in a repository, a key in a log line, a ' +
         'key in a screenshot, or a key that was rotated in 2022 by somebody who has left.' },
    { ul: [
      '**Nothing secret in the repository, ever,** including in history. Git remembers, so a secret that was committed and then deleted is still a leaked secret.',
      '**Secrets arrive at runtime,** from the environment or a secret manager, and the application refuses to start rather than falling back to a default.',
      '**Every secret has an owner and an expiry.** A credential nobody can name the owner of cannot be rotated, because nobody knows what will break.',
      '**Rotation is a drill you have run,** not a document. The first time you rotate a key must not be during an incident.',
      '**Assume the leak will happen** and make it survivable: short lifetimes, narrow scopes, and alerting on use from somewhere unexpected.'
    ]},
    { warn: 'When a key does leak, the order is: revoke first, investigate second. Every minute spent working out how bad ' +
            'it is, is a minute the key still works. Revocation you can perform in seconds, without a deploy, is worth ' +
            'more than any amount of prevention.' },

    { h: 'Who is calling: four mechanisms' },
    { p: 'Your payments API from level 7 needs to know who is on the other end. There are four answers in common use, and ' +
         'a payments company uses all of them in different places:' },
    { table: {
      head: ['Mechanism', 'How it works', 'Good for', 'Weak spot'],
      rows: [
        ['API key', 'A long random string in a header', 'Simple external integrations', 'Long lived, all or nothing, and it ends up in somebody\'s code'],
        ['OAuth2 client credentials', 'Trade a client id and secret for a short lived token with scopes', 'External services acting for themselves', 'Nothing revokes an issued token early unless you build it'],
        ['JWT', 'A signed token the receiver checks without a database call', 'High volume internal calls', 'Five separate ways to verify it wrongly, below'],
        ['Mutual TLS', 'Both sides present a certificate during the handshake', 'Service to service inside your own network', 'Certificate rotation is real operational work']
      ]
    }},
    { p: 'The shape most payments companies land on: **mutual TLS between internal services**, because the network itself ' +
         'then proves identity, and **OAuth2 with scoped, short lived tokens for anything outside**. API keys survive ' +
         'where a merchant\'s developer has to paste something into a form, and those keys are scoped and rotatable.' },

    { h: 'JWTs, and the five checks people skip' },
    { p: 'A **JSON Web Token** is three base64 pieces: a header saying how it was signed, a payload of claims, and a ' +
         'signature. Its appeal is that the receiver can verify it with no database call. Its danger is that verifying ' +
         'it *looks* like one line and is actually five:' },
    { code: 'claims = jwt.decode(\n    token,\n    key=public_key,\n    algorithms=["RS256"],   # 1. pin it. Never read the alg from the token\n    audience="payments",    # 2. is this token for ME?\n    issuer="auth.internal", # 3. did WE issue it?\n)\n# 4. exp and nbf are checked by the library, but only if present. Require them.\n# 5. check the scope you need, not merely that the token is valid', lang: 'python' },
    { ul: [
      '**Algorithm confusion.** If you let the token choose, an attacker sets `alg` to `none`, or signs an HS256 token using your public RSA key as the shared secret. Pin the algorithm in the code.',
      '**No audience check.** A perfectly valid token issued for the reporting service is accepted by the payments service. Every token says what it is for; read it.',
      '**A weak HS256 secret.** A shared secret that is a memorable phrase is brute forcible offline, at leisure, by anybody holding one token.',
      '**No expiry.** A token with no `exp` is a permanent credential in a format designed for temporary ones.',
      '**Valid is not authorised.** A signature proves who, never what they may do. Check the scope for the specific action.'
    ]},
    { p: 'Revocation is the honest weakness. Since the receiver checks the signature without asking anybody, a stolen ' +
         'token works until it expires. So **keep lifetimes short**, minutes rather than days, and refresh. If you need ' +
         'real revocation, you need a lookup, and then you have chosen a database call over a signature check, which is ' +
         'a reasonable trade you should make deliberately.' },

    { h: 'What verification costs, measured' },
    { p: 'Signature checking sits on the hot path of every request, so it belongs in the latency budget from level 14. ' +
         'One verification of the same token, measured:' },
    { table: {
      head: ['Algorithm', 'Per verification', 'CPU cost at 1,000 requests per second'],
      rows: [
        ['HS256, a shared secret', '79.9 us', '8% of one core'],
        ['RS256, RSA signature', '141.5 us', '14% of one core'],
        ['ES256, an elliptic curve', '239.7 us', '24% of one core']
      ]
    }},
    { p: 'Two things worth noticing. First, the ordering surprises people: **verifying an RSA signature is cheaper than ' +
         'verifying an elliptic curve one**, because RSA verification is arithmetic with a tiny public exponent, while ' +
         'RSA *signing* is the expensive direction. Second, most of the HS256 figure is the library parsing base64 and ' +
         'JSON rather than the cryptography, which is why "just use HMAC, it is faster" is a smaller win than it sounds.' },
    { p: 'The practical consequence: a public key algorithm is worth it when the verifier should not be able to mint ' +
         'tokens, which is most of the time, and a quarter of a core per thousand requests is a price you can pay. But ' +
         'put the number in your budget rather than discovering it during a load test.' },
    { check: {
      q: 'A colleague proposes caching the result of JWT verification, keyed by the token string, for five minutes, ' +
         'because the profiler shows verification is 24% of a core. What do you say?',
      a: 'That the saving is real but the change is riskier than it looks, and there is a better move. The cache means a ' +
         'token now works for up to five minutes after it should have stopped, which quietly extends every expiry and ' +
         'defeats short lifetimes, the one defence against a stolen token. It is also a new place where a valid ' +
         'credential sits in memory, keyed by the credential itself. If you do cache, cache only until the token\'s own ' +
         'expiry, never past it, and cache the verification result rather than the token. But the better move is to ' +
         'question the load: 24% of a core at a thousand requests per second is not usually the bottleneck, and if it ' +
         'genuinely is, switching from ES256 to RS256 halves it with no security loss and no new state.'
    }},

    { h: 'Encrypting what you store, and the key problem' },
    { p: 'Encryption at rest is easy. **Key management is the entire difficulty.** If the key sits next to the data, you ' +
         'have encrypted nothing; if every record needs a call to a key service, you have built something too slow to ' +
         'use. **Envelope encryption** is the standard answer:' },
    { ul: [
      'A **master key** lives in a key service and never leaves it. You cannot read it, and neither can an attacker with your database.',
      'A **data key** is a normal key you use locally to encrypt records. You ask the key service to encrypt the data key once, store the wrapped result, and throw the plaintext key away when you are done.',
      'To read a record, you send the wrapped data key to the key service, get the plaintext key back, and decrypt locally.'
    ]},
    { p: 'The reason is arithmetic. Encrypting 20,000 card numbers, with a key service that answers in 8 ms:' },
    { table: {
      head: ['', 'Calls to the key service', 'Total time'],
      rows: [
        ['One call per record', '20,000', '**160 s**'],
        ['Envelope, one data key per 100 records', '200', '**1.7 s**']
      ]
    }},
    { p: 'The local cryptography is not the cost. AES-256-GCM encrypted a card number in **2.8 microseconds**, which is ' +
         '358,539 records per second on one core. All 20,000 records took 56 ms. **The network call to the key service ' +
         'is a thousand times more expensive than the encryption**, and envelope encryption exists to do fewer of them.' },
    { p: 'The second reason is rotation, and it is the one that matters more over a career:' },
    { table: {
      head: ['Rotating the master key', 'Items touched', 'Time'],
      rows: [
        ['Rewrap the data keys', '200', '**1 ms**'],
        ['Re-encrypt every record', '20,000', '127 ms, and a rewrite of every row']
      ]
    }},
    { p: 'The 127 ms is cryptography only. In a real system, re-encrypting every record also means updating every row, ' +
         'which is the level 13 backfill with all of its locks, log volume and hours. With envelope encryption, rotating ' +
         'the master key touches only the wrapped data keys, and the records are never read at all. **That is the ' +
         'difference between a rotation you can do quarterly and one you have never done.**' },
    { tip: 'Bind the encryption to its context. AES-GCM takes "additional authenticated data", which stays readable and ' +
           'is still covered by the tag: put the record id and the purpose in there. Then a ciphertext copied from one ' +
           'row to another fails to decrypt instead of silently succeeding.' },

    { h: 'Card numbers: hold them in one place or none' },
    { p: 'Some vocabulary, because interviewers use it and it is precise:' },
    { table: {
      head: ['Term', 'Means'],
      rows: [
        ['PAN', 'The primary account number: the long number on the front of the card'],
        ['BIN', 'The first six to eight digits, which identify the issuing bank. Not sensitive'],
        ['Last four', 'The last four digits, shown to users. Not sensitive on their own'],
        ['CVV', 'The code on the back. **May never be stored after authorisation.** Not "encrypted", not at all'],
        ['Token', 'A meaningless reference that stands in for a PAN, useless anywhere else'],
        ['PCI DSS', 'The card industry\'s security standard. Its cost depends on how many systems touch a PAN']
      ]
    }},
    { p: '**Tokenisation** is the decision that changes the most in a card system. One small service, the **vault**, ' +
         'stores encrypted PANs and hands out tokens. Everything else in your company stores the token. The payments ' +
         'service, the ledger, the reporting database, the analytics warehouse, the support tool and the logs all hold ' +
         'something that is worthless if stolen.' },
    { code: 'without a vault                     with a vault\n\n  api        sees the PAN            api        sees the PAN briefly, then a token\n  payments   stores the PAN          payments   stores a token\n  ledger     stores the PAN          ledger     stores a token\n  reporting  stores the PAN          reporting  stores a token\n  warehouse  stores the PAN          warehouse  stores a token\n  backups    contain PANs            backups    contain tokens\n  logs       contain PANs            logs       contain tokens\n\n  7 systems in PCI scope             1 system in PCI scope', lang: 'text' },
    { p: 'That count is the whole argument. Every system in scope has to be audited, hardened, access controlled and ' +
         'evidenced, every year, forever. Going from seven to one decides whether an audit takes a week or a quarter, ' +
         'which is why this design is universal in the industry.' },
    { warn: 'A token must carry no information. If your token is the encrypted PAN, anyone who obtains the key has every ' +
            'card. Generate a random identifier, store the mapping in the vault, and let the token mean nothing outside ' +
            'it. Keeping the BIN and last four *alongside* the token is fine and usually necessary, but they are ' +
            'separate fields, not part of the token.' },
    { check: {
      q: 'The analytics team asks for the card number in the warehouse "so we can count how many customers use the same ' +
         'card across merchants". Refusing outright makes you the department of no. What do you offer instead?',
      a: 'Ask what question they are answering, because the request is for an identifier, not for a card number. The ' +
         'vault can issue a stable token for a given PAN, so the same card always produces the same token, and then ' +
         'counting cards across merchants works exactly as they want with no PAN in the warehouse at all. If they need ' +
         'to correlate across systems that must not share an identifier, the vault can issue a per merchant token ' +
         'instead, derived from the PAN and the merchant, which permits counting within a merchant and not across. ' +
         'Either way you have given them the analysis and kept the warehouse out of PCI scope, which is a better ' +
         'outcome for them too, because a warehouse in scope means their queries get audited.'
    }},

    { h: 'Signing what you send: webhooks' },
    { p: 'Level 7 sent webhooks. Now sign them, because an unsigned webhook is an invitation to anyone who learns the ' +
         'URL. The standard construction, used by most payment processors:' },
    { code: 'signed = f"{timestamp}.{raw_body}"                       # the exact bytes you sent\nsignature = hmac.new(secret, signed.encode(), hashlib.sha256).hexdigest()\n# header:  X-Signature: t=1758585600,v1=9f86d081...', lang: 'python' },
    { ul: [
      '**Sign the raw body,** before any parsing. Re-serialising JSON changes bytes and breaks every signature in a way that takes a day to find.',
      '**Include the timestamp inside the signed string,** and reject anything older than a few minutes. Without it, a valid request captured once can be replayed forever.',
      '**Support two secrets at a time,** so a receiver can rotate without downtime: accept either, then retire the old one.',
      '**Version the scheme** (`v1=`) so you can change algorithms later without breaking every integration at once.'
    ]},

    { h: 'A measurement that failed, and what it teaches' },
    { p: 'Every guide says to compare secrets with a constant time function, because comparing with `==` stops at the ' +
         'first differing byte and leaks, through timing, how much of the secret an attacker has guessed. It is a real ' +
         'attack. So we tried to measure it: 400,000 comparisons of a 64 character secret, differing at the first byte ' +
         'and at the last.' },
    { table: {
      head: ['Comparison', 'Differs at the first byte', 'Differs at the last byte'],
      rows: [
        ['`==`', '112.7 ns', '98.5 ns'],
        ['`hmac.compare_digest`', '163.2 ns', '169.8 ns']
      ]
    }},
    { p: 'The leak did not appear. If `==` were short circuiting per byte, the first-byte row would be clearly faster ' +
         'than the last-byte row, and it is not: the difference is inside the noise, and the sign is the wrong way ' +
         'round. The reason is that comparing 64 bytes in CPython is a single library call that compares a whole block ' +
         'at a time, so there is no per-byte staircase to detect, and any real signal is buried under the interpreter ' +
         'and the network in front of it.' },
    { p: 'So do you still use `compare_digest`? **Yes, and the measurement is why.** It cost 60 nanoseconds more. At a ' +
         'thousand requests per second that is 60 microseconds of CPU per second, which is nothing, and in exchange you ' +
         'stop depending on an implementation detail that is true today, in this interpreter, at this length. Use it ' +
         'because it is free, not because you have seen the attack.' },
    { money: 'The wider lesson is worth more than the function. **A measurement that fails to confirm the textbook is ' +
             'still a result, and reporting it honestly is a senior habit.** In an interview, "I tried to reproduce the ' +
             'timing leak and could not, here is why, and here is why I use the safe function anyway" is a far stronger ' +
             'answer than repeating the advice.' },

    { h: 'Logs are a data store nobody treats like one' },
    { p: 'Card numbers end up in logs more often than in databases, because logging is written in a hurry and never ' +
         'reviewed. The places they appear, in order of how often:' },
    { ul: [
      '**A request body logged on error.** The handler logs the whole payload so somebody can debug it, and now the payload is in your log aggregator, replicated and retained for a year.',
      '**A stack trace with arguments.** Some frameworks print local variables. The card number was a local variable.',
      '**A URL.** Anything in a query string is in access logs, browser history and any proxy in between, which is why sensitive values never travel in a URL.',
      '**A third party error reporter.** Your exception tracker is a company you have now sent card numbers to.'
    ]},
    { p: 'The fix is structural rather than disciplined. **Allowlist what may be logged** instead of trying to remember ' +
         'what may not, because a denylist only removes the fields somebody thought of. Then write the test that ' +
         'actually catches it:' },
    { code: 'def test_no_pan_in_logs(caplog, client):\n    client.post("/payments", json={"pan": "4111111111111111", ...})\n    text = "".join(r.getMessage() for r in caplog.records)\n    assert "4111111111111111" not in text\n    assert "411111" in text or "1111" in text    # BIN and last four are fine', lang: 'python' },
    { p: 'That test is worth more than a policy document, because it fails in the pull request that would have caused ' +
         'the leak, and it keeps working after everybody who wrote the policy has left.' },

    { h: 'The insider, and the log you cannot edit' },
    { p: 'The threat model that gets skipped, because it is uncomfortable: the attacker has a laptop and a badge. Every ' +
         'payments company designs for this, and none of it implies distrust of any individual.' },
    { table: {
      head: ['Control', 'What it stops'],
      rows: [
        ['Least privilege', 'A support engineer reading balances they have no ticket for'],
        ['Break glass access', 'Standing production access. It is requested, time limited, and loudly logged'],
        ['Four eyes on large payouts', 'One person, acting alone, sending money out'],
        ['An append only audit log', 'The same person deleting the evidence afterwards'],
        ['Alerting on access patterns', 'Bulk reads that no legitimate workflow performs']
      ]
    }},
    { p: 'The audit log is the level 4 lesson again, in a different costume: **append only, never updated, and the ' +
         'application must not have permission to delete from it.** If your service can edit its own audit trail, you do ' +
         'not have one. In Postgres that is a separate role with insert and select but no update or delete, and it is ' +
         'ten minutes of work.' },
    { check: {
      q: 'Your company has fifteen engineers and somebody argues that break glass access and four eyes are ' +
         'bureaucracy that would halve their shipping speed at this size. Make the strongest case for their position, ' +
         'then decide.',
      a: 'Their case is genuinely strong: at fifteen people, everybody knows everybody, an incident at three in the ' +
         'morning is resolved by whoever is awake, and a process that requires a second person can turn a ten minute ' +
         'outage into an hour. Controls that are painful get worked around, and a documented control that everybody ' +
         'bypasses is worse than none, because it gives false assurance to an auditor and to you. The decision is to ' +
         'split the list by cost. The append only audit log and the alerting are close to free and go in now, because ' +
         'they constrain nobody and they are what you will need if anything ever happens. Four eyes applies to money ' +
         'leaving above a threshold, not to every deploy, because that is where the irreversible damage is. Standing ' +
         'production access is the one to keep for now, with logging, and the thing to revisit when the team doubles, ' +
         'because that is when you stop knowing everybody.'
    }},

    { h: 'Your dependencies are your attack surface' },
    { p: 'You wrote perhaps two percent of the code that runs in your service. The rest arrived from a package index, ' +
         'and it runs with your permissions and your secrets.' },
    { ul: [
      '**Pin exact versions with a lockfile,** so that what you tested is what you deploy, and a package cannot change under you between the test run and the release.',
      '**Fewer dependencies.** Every one is a team you are trusting, and the smallest reduction in risk that actually works is not adding the next one.',
      '**Scan and update on a schedule,** so that the update is routine rather than an emergency the day something is announced.',
      '**Build from a lockfile in CI, not from the index,** so a compromised package version cannot be pulled in silently during a deploy.'
    ]},
    { p: 'And a habit that costs nothing: when you add a dependency, look at how many people maintain it and when it was ' +
         'last released. A single maintainer with a stale repository is a supply chain decision, whether or not you ' +
         'treat it as one.' }
  ],

  tutorial: {
    intro: 'Build a vault, then make everything else in your system stop holding card numbers. Every card number in this ' +
           'level is a published test number such as `4111111111111111`, and every key is generated at run time. Work in ' +
           'a repository called `card-vault`.',
    steps: [
      {
        t: 'Write the threat model first',
        blocks: [
          { p: 'One page, before any code. Assets, attackers, controls, and the explicit list of what you are not ' +
               'defending against. Put it in the repository as `THREAT_MODEL.md` and refer to it in the README.' },
          { tip: 'Write the "not defending" section honestly. A reviewer who sees "we do not defend against a ' +
                 'compromised build pipeline, and here is why that is currently acceptable" learns more about your ' +
                 'judgement than any control list can show.' }
        ],
        check: 'Every control in the rest of the project traces back to a line in the threat model.'
      },
      {
        t: 'A key service you can hold wrong',
        blocks: [
          { p: 'Simulate a hosted key service: a small module that holds a master key, answers `encrypt` and `decrypt` ' +
               'for data keys only, and sleeps 8 ms to make its network cost visible. It must refuse to hand out the ' +
               'master key, because that refusal is the entire point.' },
          { code: 'class KeyService:\n    def generate_data_key(self) -> tuple[bytes, bytes]:\n        """Returns (plaintext key, wrapped key). Forget the first one quickly."""\n\n    def unwrap(self, wrapped: bytes) -> bytes:\n        """8 ms. This is the call envelope encryption exists to do fewer of."""', lang: 'python' }
        ],
        check: 'There is no code path anywhere that can obtain the master key.'
      },
      {
        t: 'Envelope encryption, and prove the arithmetic',
        blocks: [
          { p: 'Encrypt 20,000 test card numbers both ways and record the difference.' },
          { code: 'one call per record : 20,000 calls, 160 s\nenvelope            :    200 calls,   1.7 s\nlocal AES-256-GCM   : 2.8 us per record, 358,539 per second', lang: 'text' },
          { p: 'Use AES-GCM, put the record id in the additional authenticated data, and store the nonce beside the ' +
               'ciphertext. Then prove the binding works: move a ciphertext to another row and confirm decryption fails.' }
        ],
        check: 'A ciphertext copied into a different record fails to decrypt rather than succeeding.'
      },
      {
        t: 'Rotate the master key',
        blocks: [
          { p: 'The step that justifies the design. Rotation rewraps the data keys and never reads a card record.' },
          { code: 'rewrap 200 data keys      :   1 ms\nre-encrypt 20,000 records : 127 ms, plus a rewrite of every row', lang: 'text' },
          { p: 'Then do the harder half: support two master key versions at once, so records written before and after ' +
               'the rotation are both readable, and write the job that retires the old version once nothing references ' +
               'it.' }
        ],
        check: 'After rotation, records written before it still decrypt, and no card row was rewritten.'
      },
      {
        t: 'Tokenise, and count your scope',
        blocks: [
          { p: 'Two endpoints: one takes a PAN and returns a token, the BIN and the last four; one takes a token and ' +
               'returns the PAN, and requires a scope that almost nothing has. Then change the rest of your system to ' +
               'store the token.' },
          { p: 'Write `SCOPE.md` listing every component and whether it can see a PAN, before and after. That table is ' +
               'the deliverable a security engineer will actually read.' },
          { warn: 'The token is random and means nothing. If you find yourself able to derive the PAN from the token ' +
                  'without the vault, start again.' }
        ],
        check: 'Exactly one service can produce a PAN, and the scope document says which and why.'
      },
      {
        t: 'Authenticate the callers',
        blocks: [
          { p: 'OAuth2 client credentials for external callers: a token endpoint that issues short lived scoped tokens, ' +
               'and verification that pins the algorithm and checks audience, issuer, expiry and scope.' },
          { p: 'Then mutual TLS between your payments service and the vault, with a local certificate authority you ' +
               'create yourself. Prove that a client without a certificate is refused at the handshake, before any of ' +
               'your code runs.' },
          { code: 'HS256  79.9 us per verification   8% of a core at 1,000 rps\nRS256 141.5 us                    14%\nES256 239.7 us                    24%', lang: 'text' }
        ],
        check: 'A token for the reporting audience is rejected by the vault, and a client with no certificate never reaches your handler.'
      },
      {
        t: 'Sign the webhooks, and try to forge one',
        blocks: [
          { p: 'Timestamp plus raw body, HMAC-SHA256, versioned header, constant time comparison. Then write the ' +
               'attacks as tests: an edited body, a replayed old request, a signature from the previous secret during a ' +
               'rotation window, and a request with no signature at all.' }
        ],
        check: 'Every forgery test fails to get through, and a legitimate request signed with the previous secret still works during the rotation window.'
      },
      {
        t: 'Make the leak impossible to merge',
        blocks: [
          { p: 'An allowlist logger, redaction of anything that looks like a card number as a second line of defence, ' +
               'and the test that asserts no PAN reaches the logs. Then the audit log: a separate table, a database ' +
               'role with insert and select only, and a test proving the application cannot delete from it.' },
          { p: 'Finish with a scan of your own repository history for secrets, and write down what you would do if it ' +
               'found one.' }
        ],
        check: 'The PAN test and the audit deletion test both fail loudly when you deliberately break them.'
      }
    ]
  },

  glossary: [
    { t: 'Threat model', d: 'Assets, attackers, controls, and what you are choosing not to defend against.' },
    { t: 'PAN', d: 'The primary account number: the long number on a card.' },
    { t: 'BIN', d: 'The first digits of a PAN, identifying the issuer. Not sensitive on its own.' },
    { t: 'CVV', d: 'The code on the back of the card. Never stored after authorisation, in any form.' },
    { t: 'Tokenisation', d: 'Replacing a PAN with a meaningless reference held only by a vault.' },
    { t: 'Vault', d: 'The one service that stores card numbers, so nothing else has to.' },
    { t: 'PCI DSS', d: 'The card industry security standard. Its cost scales with how many systems touch a PAN.' },
    { t: 'Envelope encryption', d: 'Encrypting data with a data key, and the data key with a master key.' },
    { t: 'Data key', d: 'A local key used to encrypt records, stored only in its wrapped form.' },
    { t: 'Master key', d: 'The key in the key service that never leaves it.' },
    { t: 'AEAD', d: 'Encryption that also authenticates, so tampering is detected. AES-GCM is one.' },
    { t: 'Additional authenticated data', d: 'Context covered by the tag but not encrypted, such as a record id.' },
    { t: 'Key rotation', d: 'Replacing a key. With envelopes it rewraps data keys rather than rewriting data.' },
    { t: 'OAuth2 client credentials', d: 'A service trades a client id and secret for a short lived scoped token.' },
    { t: 'JWT', d: 'A signed token carrying claims, verifiable without a database call.' },
    { t: 'Algorithm confusion', d: 'Attacks that exploit trusting the algorithm named inside the token.' },
    { t: 'Mutual TLS', d: 'Both ends present certificates, so the connection itself proves identity.' },
    { t: 'Constant time comparison', d: 'Comparing secrets without an early exit that could leak through timing.' },
    { t: 'Replay attack', d: 'Resending a captured valid request. Stopped by a signed timestamp and a window.' },
    { t: 'Least privilege', d: 'Every identity has the narrowest access that lets it do its job.' },
    { t: 'Break glass', d: 'Time limited, logged, requested access instead of standing production access.' }
  ],

  quiz: [
    { q: "What belongs in a threat model that most people leave out?",
      options: [
        "The compliance framework",
        "A list of technologies used",
        "What you are deliberately choosing not to defend against",
        "The incident response phone tree"
      ],
      answer: 2,
      why: "It tells a reader where the gaps are on purpose, which is more useful than a claim of being secure." },

    { q: "A secret was committed and then deleted in a later commit. What is its status?",
      options: [
        "Safe, because it is no longer in the current code",
        "Safe once the branch is deleted",
        "Still leaked, because the history contains it, so it must be rotated",
        "Safe if the repository is private"
      ],
      answer: 2,
      why: "Revoke first, investigate second. Every minute spent assessing is a minute the key still works." },

    { q: "Which mechanism lets the network itself prove which service is calling?",
      options: [
        "A JWT",
        "Mutual TLS",
        "IP allowlisting",
        "An API key in a header"
      ],
      answer: 1,
      why: "Both sides present certificates during the handshake, so a caller without one never reaches your code." },

    { q: "Why must you pin the algorithm when verifying a JWT?",
      options: [
        "Because otherwise an attacker chooses it, setting it to none or signing an HS256 token with your public key",
        "To support key rotation",
        "Because libraries require it",
        "For performance"
      ],
      answer: 0,
      why: "Algorithm confusion. Never read the algorithm from the token you are trying to verify." },

    { q: "A token is valid, correctly signed, unexpired, and issued by you. Is the request authorised?",
      options: [
        "No: a signature proves who, never what they may do. The scope for the specific action still has to be checked",
        "Only if it has an audience claim",
        "Only if it is RS256",
        "Yes, that is what verification means"
      ],
      answer: 0,
      why: "Authentication and authorisation are separate questions, and conflating them is a common breach." },

    { q: "Verification cost measured: HS256 79.9 us, RS256 141.5 us, ES256 239.7 us. What is surprising?",
      options: [
        "That elliptic curve is the cheapest",
        "That all three are the same",
        "That verifying an RSA signature is cheaper than verifying an elliptic curve one",
        "That HMAC is the slowest"
      ],
      answer: 2,
      why: "RSA verification uses a tiny public exponent. RSA signing is the expensive direction, not verifying." },

    { q: "Why does envelope encryption exist?",
      options: [
        "Because AES is slow",
        "Because it is required by PCI",
        "To support multiple algorithms",
        "Because a call to the key service costs milliseconds while local encryption costs microseconds, so you do far fewer calls, and rotation then touches only the wrapped keys"
      ],
      answer: 3,
      why: "Measured: 20,000 calls and 160 s, against 200 calls and 1.7 s. Rotation went from 127 ms plus a full rewrite to 1 ms." },

    { q: "Local AES-256-GCM encrypted a card number in 2.8 microseconds. What does that tell you?",
      options: [
        "That the measurement is wrong",
        "That the cost is in the key service round trip, not the cryptography, so the design question is how few calls you can make",
        "That encryption is the bottleneck",
        "That you should use a weaker cipher"
      ],
      answer: 1,
      why: "358,539 records per second on one core. The 8 ms network call is a thousand times more expensive." },

    { q: "Which may never be stored after authorisation, in any form?",
      options: [
        "The CVV",
        "The expiry date",
        "The last four digits",
        "The BIN"
      ],
      answer: 0,
      why: "Not encrypted, not hashed, not \"temporarily\". Not at all." },

    { q: "What does tokenisation actually buy you?",
      options: [
        "Encryption of the card number",
        "Compliance with GDPR",
        "That only one system holds card numbers, so the number of systems in PCI scope collapses",
        "Faster lookups"
      ],
      answer: 2,
      why: "Seven systems in scope becoming one is the difference between an audit of a week and one of a quarter." },

    { q: "Why must a token carry no information about the PAN?",
      options: [
        "To keep it short",
        "Because a token that is derived from the PAN turns one key compromise into every card",
        "For database indexing",
        "Because the standard says so"
      ],
      answer: 1,
      why: "Random identifier, mapping in the vault, meaningless anywhere else." },

    { q: "What must be inside the signed string of a webhook signature?",
      options: [
        "The parsed JSON",
        "The timestamp and the raw body bytes",
        "The receiver identifier",
        "The URL"
      ],
      answer: 1,
      why: "Raw bytes, because re-serialising changes them; the timestamp, because without it a captured request replays forever." },

    { q: "The timing leak in `==` could not be reproduced: 112.7 ns differing at the first byte against 98.5 ns at the last. What is the right conclusion?",
      options: [
        "The measurement was wrong and should be discarded",
        "Use a slower comparison to mask the timing",
        "Timing attacks are a myth, so use ==",
        "No leak was visible at this length in this interpreter, and compare_digest costs only 60 ns more, so use it because it is free rather than because you have seen the attack"
      ],
      answer: 3,
      why: "And reporting the failed reproduction honestly is a stronger interview answer than repeating the advice." },

    { q: "What is the right way to keep card numbers out of logs?",
      options: [
        "A denylist of fields to redact",
        "Reviewing log lines in code review",
        "Turning off logging on payment endpoints",
        "An allowlist of what may be logged, plus a test that asserts the PAN never appears"
      ],
      answer: 3,
      why: "A denylist only removes the fields somebody thought of. The test fails in the pull request that would leak." },

    { q: "What makes an audit log trustworthy against an insider?",
      options: [
        "The application not having permission to update or delete from it",
        "Encrypting it",
        "Writing it asynchronously",
        "Storing it in a separate table"
      ],
      answer: 0,
      why: "If a service can edit its own audit trail, it does not have one. A separate role with insert and select is ten minutes of work." }
  ],

  project: {
    title: 'card-vault: one service that can see a card number',
    story: 'Build the vault your payments system stores nothing sensitive without. Envelope encryption over a key service ' +
           'you cannot read the master key out of, tokens that mean nothing, a master key rotation that never touches a ' +
           'card row, authenticated callers, signed webhooks, and a scope document that shows how much of your system you ' +
           'just took out of PCI scope.',
    scope: 'Uses the level 7 API and the level 6 database. All card numbers are published test numbers. The key service ' +
           'is a local simulator with a latency dial. The deliverable includes the threat model and the scope table, ' +
           'which are read more often than the code.',
    requirements: [
      'A `THREAT_MODEL.md` with assets, attackers, controls and an explicit list of what you do not defend against',
      'A key service simulator that holds a master key, wraps and unwraps data keys, costs 8 ms a call, and has no path to reveal the master key',
      'Envelope encryption with AES-256-GCM, a nonce per record, and the record id bound in as additional authenticated data',
      'A measured comparison of one key service call per record against the envelope approach, over at least 20,000 records',
      'Master key rotation that rewraps data keys only, with two key versions readable at once and a retirement job',
      'A proof that no card row is rewritten during rotation',
      'Tokenisation: a token that is random, a stored mapping, and BIN and last four kept as separate fields',
      'The rest of your system changed to store tokens, and a `SCOPE.md` counting components in PCI scope before and after',
      'OAuth2 client credentials with short lived scoped tokens, verified with the algorithm pinned and audience, issuer, expiry and scope all checked',
      'Mutual TLS between the payments service and the vault, with your own certificate authority, proving a client without a certificate is refused at the handshake',
      'Signed webhooks with a timestamp, raw body, versioned header, a rotation window accepting two secrets, and constant time comparison',
      'Forgery tests: edited body, replayed request, missing signature, wrong secret',
      'Allowlist logging, plus a test asserting a PAN never appears in logs while the BIN and last four may',
      'An append only audit log, with a database role that cannot update or delete, and a test proving it',
      'The repository public on GitHub as `card-vault`, with no secret in the history'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 15: the vault.\n\nLayout:\n  vault/keys.py       the key service simulator. 8 ms a call, on purpose\n  vault/envelope.py   data keys, wrapping, AES-GCM with bound context\n  vault/tokens.py     random tokens, the mapping, BIN and last four\n  vault/rotate.py     rewrap data keys, two versions live, retire the old\n  api/auth.py         OAuth2 client credentials, and verification done fully\n  api/webhooks.py     sign, verify, rotate the secret, reject replays\n  obs/logging.py      an allowlist, not a denylist\n  THREAT_MODEL.md     written before any of the above\n  SCOPE.md            who can see a PAN, before and after\n"""\n\nTEST_PANS = ["4111111111111111", "5555555555554444", "378282246310005"]\n\nNEVER_STORED = {"cvv", "cvc", "cvv2", "pin", "magstripe"}\n\n\ndef tokenise(pan: str) -> dict:\n    """Return {token, bin, last4}. The token must reveal nothing about the pan."""\n    # TODO\n    raise NotImplementedError\n\n\ndef detokenise(token: str, scope: set[str]) -> str:\n    """The one function in the company that can produce a card number."""\n    if "vault:read_pan" not in scope:\n        raise PermissionError("not authorised to read a card number")\n    # TODO\n    raise NotImplementedError\n\n\ndef verify_webhook(headers: dict, raw_body: bytes, secrets: list[bytes]) -> bool:\n    """Timestamp inside the signed string, raw bytes, constant time compare,\n    and accept either secret so a rotation does not break the receiver."""\n    # TODO\n    raise NotImplementedError\n'
    },
    tests: [
      'The master key cannot be obtained through any public function of the key service',
      'A ciphertext moved to a different record fails to decrypt',
      'Encrypting 20,000 records with envelopes makes two orders of magnitude fewer key service calls',
      'After a master key rotation, records written before it still decrypt',
      'A master key rotation updates no card row',
      'Two tokens for the same card are identical if stable tokens are chosen, and the token reveals nothing about the PAN',
      'Detokenisation without the required scope raises rather than returning a card number',
      'A token issued for another audience is rejected by the vault',
      'A JWT with the algorithm set to none is rejected',
      'An expired token is rejected even though the signature is valid',
      'A client with no certificate cannot complete the TLS handshake with the vault',
      'A webhook with an edited body fails verification',
      'A webhook replayed after the window fails verification',
      'A webhook signed with the previous secret succeeds during the rotation window and fails after it',
      'No test PAN appears anywhere in captured log output, while the BIN and last four do',
      'The application database role cannot delete from the audit table'
    ],
    rubric: [
      { pts: 20, t: 'The thinking', d: 'A threat model with a real "not defending" section, and a scope table that shows the change.' },
      { pts: 25, t: 'Envelope encryption', d: 'Bound context, measured call counts, and a rotation that touches no card row.' },
      { pts: 20, t: 'The vault', d: 'Meaningless tokens, a single detokenisation path, scope enforced, the rest of the system converted.' },
      { pts: 20, t: 'Authentication', d: 'Full JWT verification, mutual TLS proven at the handshake, signed webhooks with forgery tests.' },
      { pts: 15, t: 'Containment', d: 'Allowlist logging with a failing-when-broken test, and an audit log the application cannot edit.' }
    ],
    stretch: [
      'Add format preserving tokens so legacy systems expecting sixteen digits keep working, and write down what that costs you',
      'Add per merchant tokens derived from the PAN and the merchant, so counting works within a merchant and not across',
      'Implement token revocation for JWTs with a short lived deny list, and measure what it adds to the latency budget',
      'Run a real key service such as AWS KMS or HashiCorp Vault in place of the simulator and compare the measured call cost',
      'Write the incident runbook for "a vault credential leaked", and rehearse it end to end with a timer'
    ],
    solutionPath: 'solutions/level-15'
  },

  faq: [
    { q: 'Is this level enough to make a system PCI compliant?',
      a: 'No, and no level could be. Compliance is an audit of an organisation, not a property of code: it covers network segmentation, physical access, vendor management, training and evidence. What this level gives you is the engineering that decides how expensive that audit is, which is the part you will be asked to design.' },
    { q: 'Should I really build a vault, or use a provider?',
      a: 'In a job, use a provider almost every time: Stripe, Adyen, VGS and the cloud key services exist so that you do not store card numbers at all. Build it once here so that you can read their documentation, ask the right questions about their key handling, and explain the design in an interview. Knowing what you are buying is the point.' },
    { q: 'Why not just encrypt the database and be done?',
      a: 'Full disk encryption defends against somebody stealing the disk. It does nothing against an application bug, a leaked credential, an overly broad query or a backup copied to the wrong bucket, because to the application the data is simply readable. Encrypting fields with a key the application must actively ask for is a different control against different attackers.' },
    { q: 'How short should a token lifetime be?',
      a: 'Short enough that a stolen token stops working before anybody notices it was stolen, and long enough that refreshing is not most of your traffic. Minutes for service to service, and pair it with a refresh flow. If you need immediate revocation, accept that you are adding a lookup and design for the latency.' },
    { q: 'My mutual TLS setup works locally and fails everywhere else',
      a: 'Usually certificate validity, the chain, or the name. Check that the client certificate is signed by a certificate authority the server trusts, that the name matches what the server expects, and that neither has expired. Then automate renewal, because the second outage is always an expiry nobody had a calendar entry for.' },
    { q: 'How do I know my logs are clean?',
      a: 'Test, not inspection. Send a known test card number through every endpoint in a test, capture all log output, and assert the number does not appear. Inspection finds what you remember to look for; the test finds what the new endpoint added last Tuesday.' },
    { q: 'What do I say about this project in an interview?',
      a: 'Lead with the scope table: your vault took the number of systems that can see a card number from seven to one. Then the rotation, because it separates people who have read about envelope encryption from people who have done it: rotating the master key rewrapped 200 data keys in a millisecond and rewrote no card rows at all.' }
  ]
});
