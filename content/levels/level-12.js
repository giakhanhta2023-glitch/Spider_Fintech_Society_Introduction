/* =========================================================================
   LEVEL 12: the payment API
   ========================================================================= */
FQ.registerLevel({
  id: 12,
  codename: 'payment api',
  title: 'The payment API other people depend on',
  tagline: 'A ledger nobody can call is a hobby. Put an HTTP interface in front of it that survives retries, signs what it sends, and never charges twice.',
  difficulty: 8,
  minutes: 240,
  tags: ['FastAPI', 'REST', 'idempotency', 'webhooks'],
  summary: 'This is the job. Most fintech backend work is an HTTP interface over a ledger, and most of the difficulty is in ' +
           'the four things nobody demos: retries, state, errors a client can act on, and webhooks that cannot be forged. ' +
           'You build all four on top of the level 11 ledger.',

  objectives: [
    'Design endpoints and status codes a client can program against',
    'Accept an idempotency key over HTTP and return the original result on a retry',
    'Model a payment as a state machine and reject illegal transitions',
    'Return errors a machine can branch on rather than a sentence a human reads',
    'Sign outgoing webhooks with HMAC and a timestamp, and retry them with backoff',
    'Verify an incoming webhook, including replay protection and a constant time compare',
    'Test the whole service without running a server'
  ],

  knowledge: [
    { h: 'The endpoint is a contract' },
    { p: 'Once one other system calls your API, every response shape is a promise. Renaming a field is a breaking change, ' +
         'adding one is not, and removing a status code you used to return will take somebody down on a Friday. Design ' +
         'the contract before the implementation, because the implementation is the easy half to change.' },
    { table: {
      head: ['Route', 'Does', 'Returns'],
      rows: [
        ['`POST /v1/transfers`', 'Move money between two accounts', '`201` with the transfer, or `200` on a replay'],
        ['`GET /v1/transfers/{id}`', 'Read one transfer', '`200`, or `404` if it is not yours'],
        ['`GET /v1/accounts/{id}/balance`', 'Balance in minor units', '`200`'],
        ['`POST /v1/transfers/{id}/reverse`', 'Post the mirror transaction', '`201`, or `409` if already reversed']
      ]
    }},
    { p: 'The `/v1` is not decoration. It is the promise that this shape keeps working while you build `/v2` beside it, and ' +
         'it costs one path segment to add on the first day and a migration project to add on the thousandth.' },
    { check: {
      q: 'A teammate wants to change `amount_cents` to `amount` and return a decimal string, because it reads better. Two ' +
         'partners already call the endpoint. What do you tell them?',
      a: 'That it is a new version, not a rename. Every caller reading `amount_cents` breaks the moment it ships, and they ' +
         'find out in production because nothing in HTTP warns them first. The cheap route is to add `amount` alongside, ' +
         'leave `amount_cents` in place, mark it deprecated in the docs, and remove it in `/v2` when the partners have ' +
         'moved. Adding a field is safe, removing or changing one is not, and that asymmetry is most of what API design is.'
    }},

    { h: 'Idempotency over the wire' },
    { p: 'Level 11 made the write idempotent inside the database. Now the retry arrives over a network, where the client ' +
         'has no idea whether the first attempt reached you. The convention every payments API uses: the client generates ' +
         'a key per intent and sends it as a header.' },
    { code: 'POST /v1/transfers\nIdempotency-Key: 7b3c0f1a-4d22-4c0a-9a8f-1b5f0e0a2c11\nContent-Type: application/json\n\n{"from": "alice", "to": "bob", "amount_cents": 2500, "memo": "coffee"}', lang: 'text' },
    { p: 'Three cases, and a serious API handles all three:' },
    { ol: [
      '**New key**: do the work, store the key with the response, return `201`.',
      '**Same key, same request**: return the stored response and `200`. Do nothing else.',
      '**Same key, different request body**: return `409`. The client has a bug, and quietly doing either thing hides it.'
    ]},
    { p: 'The third case is why you store a fingerprint of the request rather than only the key: a hash of the body, next to ' +
         'the key, so you can tell a retry from a mistake.' },
    { code: 'fingerprint = hashlib.sha256(raw_body).hexdigest()', lang: 'python' },
    { check: {
      q: 'Your API stores the key and returns the old response on any repeat. A client has a bug that reuses one key for ' +
         'every transfer of the day. What does your API do, and what should it do?',
      a: 'It returns the first transfer, every time, and the client believes forty payments went through when one did. The ' +
         'money is safe and the records are wrong, which is worse in one way: nobody is looking for a problem. With the ' +
         'body fingerprint stored you compare, see a different request under the same key, and return `409` naming ' +
         'the key. The client finds their bug on the second request instead of at month end.'
    }},

    { h: 'A payment is a state machine' },
    { p: 'Level 4 listed the states. Now they are columns, and the value of writing them down is that most bugs in payment ' +
         'systems are a transition nobody thought about: a refund of a payment that failed, a capture of an authorization ' +
         'that expired, a second reversal of the same transfer.' },
    { code: 'requested ──▶ posted ──▶ settled\n    │             │\n    │             └──▶ reversed\n    └──▶ failed\n\nlegal = {\n  "requested": {"posted", "failed"},\n  "posted":    {"settled", "reversed"},\n  "settled":   {"reversed"},\n  "reversed":  set(),        # terminal\n  "failed":    set(),        # terminal\n}', lang: 'python', label: 'the whole machine' },
    { code: 'def move(transfer, to_state):\n    if to_state not in LEGAL[transfer.state]:\n        raise IllegalTransition(f"{transfer.state} cannot become {to_state}")\n    transfer.state = to_state', lang: 'python' },
    { p: 'One function, one dictionary, and the illegal transition becomes an exception instead of a support ticket. In the ' +
         'API it becomes `409 Conflict`, because the request was well formed and the current state refuses it.' },
    { check: {
      q: 'A partner calls reverse twice on the same transfer, a second apart. Without the state machine, what happens, and ' +
         'with it, what status code do they get?',
      a: 'Without it, two mirror transactions post and the customer is refunded twice: the ledger still balances, which is ' +
         'what makes this kind of bug survive so long. With it, the first call moves the transfer to reversed, and the ' +
         'second finds reversed is terminal and returns `409` with a code the partner can branch on. Note what it is not: ' +
         'not `400`, because their request was fine, and not `500`, because nothing went wrong on your side.'
    }},

    { h: 'Errors a machine can act on' },
    { p: 'A client cannot branch on prose. Every error gets a status code for the class of problem and a short stable string ' +
         'for the specific one, and the human sentence is extra rather than the payload.' },
    { code: '{\n  "error": {\n    "code": "insufficient_funds",\n    "message": "alice holds $12.40, this transfer needs $25.00",\n    "request_id": "req_01J8ZC"\n  }\n}', lang: 'json' },
    { table: {
      head: ['Status', 'Means', 'Should the client retry?'],
      rows: [
        ['`400`', 'The request is malformed', 'No, fix it'],
        ['`401` / `403`', 'Not authenticated, or not allowed', 'No'],
        ['`404`', 'No such thing, or not yours', 'No'],
        ['`409`', 'Well formed, but the state refuses it', 'No, read the state'],
        ['`422`', 'Well formed, but the values are wrong', 'No'],
        ['`429`', 'Too fast', 'Yes, after the stated delay'],
        ['`500`', 'You broke', 'Yes, with backoff'],
        ['`503`', 'You are down or shedding load', 'Yes, with backoff']
      ]
    }},
    { p: 'The `request_id` is the cheapest debugging tool in the building. Generate one per request, log it with everything ' +
         'you log, and return it in every response and every error. A partner reporting a problem quotes it and you find ' +
         'the exact request in one search.' },
    { check: {
      q: 'Your API returns `500` when a transfer has insufficient funds, with the message "insufficient funds". Two things ' +
         'are wrong. What are they, and what does the caller do because of it?',
      a: 'The status is wrong and the payload is unusable. `500` means you broke, so a well behaved client retries it, with ' +
         'backoff, forever, against an account that will never have the money: you have turned a clean refusal into a ' +
         'retry storm. And because the only machine readable part is the status code, the client cannot tell this apart ' +
         'from a database outage. It should be `422` with `"code": "insufficient_funds"`, which tells the client to stop ' +
         'and tells their monitoring not to page anybody.'
    }},

    { h: 'Webhooks out: signed, timestamped, retried' },
    { p: 'Polling for state changes wastes everybody\'s capacity, so you tell the client instead. The receiving endpoint is ' +
         'on the public internet, so the only thing that makes your message trustworthy is a signature they can check.' },
    { code: 'signed_payload = f"{timestamp}.{raw_body}"\nsignature = hmac.new(secret, signed_payload.encode(), hashlib.sha256).hexdigest()\nheaders = {"FQ-Signature": f"t={timestamp},v1={signature}"}', lang: 'python' },
    { code: 'timestamp  1789000000\nbody       {"event":"transfer.posted","id":"evt_001","amount_cents":2500}\nsignature  8f06cd5628f7cb2f1a1b866c33e374be5d60dd6586354cf24f288eb58fc04b13\n\nchange amount_cents to 250000 and the same secret produces\n           5cf3256746fdfa70d1833b2d42d3ab4602d416fa88239f118b188ea55b3480f1', lang: 'text', label: 'one byte changes everything' },
    { p: 'The timestamp is inside the signed string on purpose. Without it, anybody who captures one valid request can send ' +
         'it again a year later and it still verifies. With it, the receiver rejects anything older than a few minutes, and ' +
         'an attacker cannot change the timestamp without breaking the signature.' },
    { p: 'Delivery is **at least once**, never exactly once. The network can lose your message or lose their acknowledgement, ' +
         'and you cannot tell which, so you retry: 1 second, 2, 4, 8, up to a limit, and then the event goes to a dead ' +
         'letter queue a human looks at. Which means the receiver has to cope with duplicates, which is why every event ' +
         'carries an id.' },
    { money: 'Stripe, Adyen, GoCardless and every other processor works exactly this way, down to the header format. ' +
             'Building it once means you can integrate any of them, because you already know what the other end is doing.' },
    { check: {
      q: 'Your webhook sends a transfer event, the customer\'s server processes it and credits an order, and then their ' +
         'response is lost on the way back. You retry. What has to be true on their side for that to be safe, and whose job ' +
         'is it to make it so?',
      a: 'Their handler has to be idempotent on the event id: look it up, and if they have already processed `evt_001`, ' +
         'acknowledge and do nothing. It is their job, and it is your job to make it possible, which means every event ' +
         'carries a stable unique id and your documentation says delivery is at least once. A processor that promises ' +
         'exactly once delivery over a network is promising something nobody can deliver.'
    }},

    { h: 'Webhooks in: verify before you trust' },
    { p: 'When you are the receiver the order matters, and every step of it is a real incident somebody has had.' },
    { ol: [
      'Read the **raw body**, not the parsed JSON. Re-serialising changes the bytes and the signature will not match.',
      'Check the **timestamp** is within a few minutes of now, or a captured message can be replayed forever.',
      'Recompute the HMAC and compare with **`hmac.compare_digest`**, never `==`.',
      'Only then parse the JSON and act, and make the action idempotent on the event id.'
    ]},
    { code: 'import hmac, hashlib, time\n\ndef verify(raw_body: bytes, header: str, secret: bytes, tolerance=300) -> bool:\n    parts = dict(p.split("=", 1) for p in header.split(","))\n    ts, sig = parts["t"], parts["v1"]\n    if abs(time.time() - int(ts)) > tolerance:\n        return False\n    expected = hmac.new(secret, f"{ts}.".encode() + raw_body, hashlib.sha256).hexdigest()\n    return hmac.compare_digest(expected, sig)', lang: 'python' },
    { warn: '`==` on a signature compares byte by byte and stops at the first difference, so how long it takes leaks how much ' +
            'of the signature was right. `compare_digest` takes the same time either way. This is a real attack, it has a ' +
            'name, and the fix is one function call.' },
    { check: {
      q: 'You verify the signature against the JSON you parsed and re-serialised, because it is easier to work with. It ' +
         'passes in your tests and fails in production. Why?',
      a: 'Because your tests round trip the same serialiser and production does not. The sender signed their exact bytes: ' +
         'their key order, their spacing, their unicode escaping. `json.loads` then `json.dumps` produces different bytes ' +
         'with the same meaning, and HMAC has no opinion about meaning. Read the raw body once, verify it, and parse ' +
         'afterwards. In FastAPI that is `await request.body()`, before anything touches the model.'
    }},

    { h: 'Keys, and what you do with them at rest' },
    { p: 'Callers authenticate with an API key in a header. Two rules make the difference between a professional service and ' +
         'a student one, and both are about what happens after the key is issued.' },
    { code: 'Authorization: Bearer fq_live_9c1d...', lang: 'text' },
    { ul: [
      '**Store a hash, never the key.** You show it once at creation and keep `sha256(key)` in the database. Then a copy of ' +
      'your table is not a copy of your customers\' credentials, and you can still authenticate by hashing what arrives.',
      '**Never log it.** Not in access logs, not in an exception, not in a request dump. Level 11 had the same rule for the ' +
      'connection string, and the redaction helper in this course exists because somebody learned it the hard way.'
    ]},
    { p: 'Give every key a prefix that says what it is, like `fq_live_` and `fq_test_`. It costs nothing, it makes a leaked ' +
         'key findable by a scanner, and it stops the oldest mistake in the industry: running a test against production.' }
  ],

  tutorial: {
    intro: 'FastAPI over the level 11 ledger. If you did not finish level 11, use its solution key as your starting ledger: ' +
           'this level is about the interface, not about rebuilding the store. Everything runs locally, and the last step ' +
           'tests the whole service without starting a server.',
    steps: [
      {
        t: 'A service that answers',
        blocks: [
          { code: 'pip install "fastapi[standard]" "psycopg[binary]" pytest httpx', lang: 'bash' },
          { code: 'from fastapi import FastAPI\n\napp = FastAPI(title="FinQuest payments", version="1.0.0")\n\n@app.get("/v1/health")\ndef health():\n    return {"status": "ok"}', lang: 'python' },
          { code: 'fastapi dev main.py        # reloads as you edit\n# then open http://127.0.0.1:8000/docs', lang: 'bash' },
          { p: 'That `/docs` page is generated from your code and is the reason FastAPI is worth learning: the contract and ' +
               'the implementation cannot drift apart, because one produces the other.' }
        ],
        check: 'GET /v1/health returns {"status":"ok"} and /docs lists it.'
      },
      {
        t: 'Types at the edge',
        blocks: [
          { p: 'Pydantic models validate the request before your code sees it, and turn a wrong type into a `422` with a ' +
               'message naming the field. This is the cheapest correctness you will ever buy.' },
          { code: 'from pydantic import BaseModel, Field\n\nclass TransferIn(BaseModel):\n    from_account: str = Field(min_length=1, max_length=64)\n    to_account: str = Field(min_length=1, max_length=64)\n    amount_cents: int = Field(gt=0, le=100_000_00)\n    memo: str = Field(default="transfer", max_length=140)\n    fee_cents: int = Field(default=0, ge=0)\n\nclass TransferOut(BaseModel):\n    id: int\n    state: str\n    amount_cents: int\n    fee_cents: int\n    memo: str', lang: 'python' },
          { p: '`gt=0` refuses a zero or negative transfer, and `le=100_000_00` puts a ceiling on a single request. Both are ' +
               'rules the level 11 ledger also enforces, and that repetition is correct: the API rejects nonsense early with ' +
               'a good message, the database refuses it absolutely.' }
        ],
        check: 'Posting amount_cents: 0 returns 422 with the field named, before any database work happens.'
      },
      {
        t: 'The transfer endpoint, with the key',
        blocks: [
          { code: 'import hashlib\nfrom fastapi import Header, HTTPException, Request, Response\n\n@app.post("/v1/transfers", status_code=201, response_model=TransferOut)\ndef create_transfer(\n    body: TransferIn,\n    request: Request,\n    response: Response,\n    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),\n):\n    if not idempotency_key:\n        raise problem(400, "missing_idempotency_key", "Send an Idempotency-Key header.")\n\n    fingerprint = hashlib.sha256(body.model_dump_json().encode()).hexdigest()\n    seen = lookup_key(idempotency_key)\n\n    if seen and seen.fingerprint != fingerprint:\n        raise problem(409, "idempotency_key_reused", "That key was used for a different request.")\n    if seen:\n        response.status_code = 200            # a replay, not a new transfer\n        return seen.response\n\n    txn = ledger.transfer(conn, body.from_account, body.to_account,\n                          body.amount_cents, body.memo, body.fee_cents,\n                          key=idempotency_key)\n    return store_and_return(idempotency_key, fingerprint, txn)', lang: 'python' },
          { p: 'Read the order. Validate, fingerprint, look up the key, refuse a reuse, replay a repeat, and only then touch ' +
               'the ledger. Every one of those steps is cheap and the last one is not.' }
        ],
        check: 'The same key twice returns 201 then 200 with an identical body, and the ledger holds one transfer.'
      },
      {
        t: 'Errors with a shape',
        blocks: [
          { code: 'from fastapi.responses import JSONResponse\n\ndef problem(status: int, code: str, message: str) -> HTTPException:\n    return HTTPException(status_code=status, detail={"code": code, "message": message})\n\n@app.exception_handler(HTTPException)\nasync def handle(request: Request, exc: HTTPException):\n    detail = exc.detail if isinstance(exc.detail, dict) else {"code": "error", "message": str(exc.detail)}\n    detail["request_id"] = request.state.request_id\n    return JSONResponse(status_code=exc.status_code, content={"error": detail})', lang: 'python' },
          { p: 'Add a middleware that puts a fresh `request_id` on every request, logs it with the method, path, status and ' +
               'duration, and returns it in a header. Four lines, and the day something goes wrong you will have it.' },
          { code: 'import uuid, time, logging\n\n@app.middleware("http")\nasync def tag_request(request: Request, call_next):\n    request.state.request_id = uuid.uuid4().hex[:12]\n    started = time.perf_counter()\n    response = await call_next(request)\n    response.headers["FQ-Request-Id"] = request.state.request_id\n    logging.info("%s %s %s %.0fms id=%s", request.method, request.url.path,\n                 response.status_code, (time.perf_counter() - started) * 1000,\n                 request.state.request_id)\n    return response', lang: 'python' }
        ],
        check: 'A failing request returns {"error": {"code", "message", "request_id"}} and the same id appears in the log line.'
      },
      {
        t: 'The state machine',
        blocks: [
          { code: 'LEGAL = {\n    "requested": {"posted", "failed"},\n    "posted": {"settled", "reversed"},\n    "settled": {"reversed"},\n    "reversed": set(),\n    "failed": set(),\n}\n\n@app.post("/v1/transfers/{transfer_id}/reverse", status_code=201)\ndef reverse(transfer_id: int):\n    transfer = get_transfer_or_404(transfer_id)\n    if "reversed" not in LEGAL[transfer.state]:\n        raise problem(409, "illegal_transition",\n                      f"a {transfer.state} transfer cannot be reversed")\n    return ledger.reverse(conn, transfer_id)', lang: 'python' }
        ],
        check: 'Reversing twice returns 201 then 409 with code illegal_transition, and the ledger holds one reversal.'
      },
      {
        t: 'Send a signed webhook',
        blocks: [
          { code: 'import hmac, hashlib, json, time, httpx\n\ndef deliver(url: str, secret: bytes, event: dict, attempts: int = 5) -> bool:\n    raw = json.dumps(event, separators=(",", ":")).encode()\n    ts = str(int(time.time()))\n    sig = hmac.new(secret, f"{ts}.".encode() + raw, hashlib.sha256).hexdigest()\n    headers = {"FQ-Signature": f"t={ts},v1={sig}", "Content-Type": "application/json"}\n\n    for attempt in range(attempts):\n        try:\n            r = httpx.post(url, content=raw, headers=headers, timeout=5)\n            if 200 <= r.status_code < 300:\n                return True\n            if 400 <= r.status_code < 500 and r.status_code != 429:\n                return False              # their endpoint is wrong, retrying will not fix it\n        except httpx.RequestError:\n            pass\n        time.sleep(2 ** attempt)\n    dead_letter(event)\n    return False', lang: 'python' },
          { p: 'The status code decision is the same rule as level 5, from the other side: retry what can change on its own, ' +
               'give up on what cannot, and put what you gave up on somewhere a person will see it.' }
        ],
        check: 'A test receiver accepts the event and verifies the signature; a receiver returning 500 is retried and ends in the dead letter list.'
      },
      {
        t: 'Receive one safely',
        blocks: [
          { code: '@app.post("/v1/webhooks/partner")\nasync def receive(request: Request):\n    raw = await request.body()                 # the bytes, before any parsing\n    header = request.headers.get("FQ-Signature", "")\n    if not verify(raw, header, PARTNER_SECRET):\n        raise problem(401, "bad_signature", "Signature did not verify.")\n\n    event = json.loads(raw)\n    if already_processed(event["id"]):\n        return {"status": "duplicate"}         # 200: acknowledge, do nothing\n    process(event)\n    return {"status": "ok"}', lang: 'python' },
          { p: 'Acknowledge a duplicate with `200` rather than an error. The sender did nothing wrong; you have simply seen ' +
               'this one already, and telling them so stops the retries.' }
        ],
        check: 'A tampered body returns 401, an old timestamp returns 401, and the same event twice is processed once.'
      },
      {
        t: 'Test it without a server',
        blocks: [
          { code: 'from fastapi.testclient import TestClient\nfrom main import app\n\nclient = TestClient(app)\n\ndef test_idempotent_transfer():\n    body = {"from_account": "alice", "to_account": "bob", "amount_cents": 2500}\n    first = client.post("/v1/transfers", json=body, headers={"Idempotency-Key": "k1"})\n    second = client.post("/v1/transfers", json=body, headers={"Idempotency-Key": "k1"})\n    assert first.status_code == 201\n    assert second.status_code == 200\n    assert first.json()["id"] == second.json()["id"]', lang: 'python' },
          { p: '`TestClient` calls the application in process, so the suite is fast enough to run on every save and has no ' +
               'port to clash with. A test that needs a running server is a test people stop running.' }
        ],
        check: 'pytest passes with no server started, and covers the 201, 200, 409 and 422 paths.'
      }
    ]
  },

  glossary: [
    { t: 'Idempotency key', d: 'A client generated string, one per intent, that lets a server recognise a retry and return the original result.' },
    { t: 'Request fingerprint', d: 'A hash of the request body stored with the key, so a retry can be told apart from a key reused by mistake.' },
    { t: 'State machine', d: 'The set of states a payment can be in and the transitions allowed between them. Everything else is refused.' },
    { t: '409 Conflict', d: 'The request was well formed and the current state refuses it. Not a client format error, not a server fault.' },
    { t: '422 Unprocessable', d: 'Well formed and understood, but the values are unacceptable. Where insufficient funds belongs.' },
    { t: 'Webhook', d: 'An HTTP request your service makes to a customer when something happens, instead of them polling you.' },
    { t: 'HMAC', d: 'A signature computed from a message and a shared secret. Proves who sent it and that nobody edited it.' },
    { t: 'Replay attack', d: 'Sending a captured valid request again. Prevented by signing a timestamp and refusing old ones.' },
    { t: 'Constant time compare', d: 'Comparing secrets without leaking how much matched through how long it took. hmac.compare_digest.' },
    { t: 'At least once delivery', d: 'The only honest promise over a network: the receiver may see an event twice and must handle it.' },
    { t: 'Dead letter', d: 'Where an event goes after the last retry fails, so a person can look rather than the event vanishing.' },
    { t: 'Request id', d: 'A short unique string per request, logged and returned, so a report can be traced to one request.' },
    { t: 'Pydantic model', d: 'A typed description of a request or response that validates at the edge and documents itself.' },
    { t: 'Breaking change', d: 'Anything a working client cannot survive: a removed field, a renamed field, a changed type or meaning.' }
  ],

  quiz: [
    { q: 'A client sends the same idempotency key with a different request body. What should the API return?',
      options: [
        '409, because the key was used for a different request',
        '200 with the original transfer',
        '201 and a second transfer',
        '500, because the state is ambiguous'
      ],
      answer: 0,
      why: 'Replaying the original hides a client bug that is quietly losing payments. 409 tells them on the second request instead of at month end.' },

    { q: 'Why store a hash of the request body next to the idempotency key?',
      options: [
        'To compress the stored response',
        'To detect a key reused for a different request',
        'To verify the client signature',
        'To index the table'
      ],
      answer: 1,
      why: 'Without the fingerprint you cannot tell a retry from a mistake, so both look like a repeat and one of them is a bug you never see.' },

    { q: 'A transfer has insufficient funds. Which status code?',
      options: [
        '500',
        '400',
        '403',
        '422'
      ],
      answer: 3,
      why: 'The request was well formed and understood; the values are unacceptable. 500 tells a well behaved client to retry forever against an account that will never have the money.' },

    { q: 'Why is a second reverse of the same transfer a 409 rather than a 400?',
      options: [
        'Because 409 is the code for money errors',
        'Because the request is well formed and the current state refuses it',
        'Because the client forgot a header',
        'Because reversal is always asynchronous'
      ],
      answer: 1,
      why: '400 means fix your request; nothing is wrong with theirs. 409 says read the state, which is the information they actually need.' },

    { q: 'Why is the timestamp included inside the signed payload of a webhook?',
      options: [
        'So the receiver can sort events',
        'To let the sender measure latency',
        'So a captured request cannot be replayed later',
        'Because HMAC requires a nonce'
      ],
      answer: 2,
      why: 'Signing it means an attacker cannot change it, and the receiver refuses anything older than a few minutes. Without it a valid message stays valid forever.' },

    { q: 'Why must a webhook signature be verified against the raw body?',
      options: [
        'Because parsing is slow',
        'Because the sender signed their exact bytes, and re-serialising produces different ones',
        'Because JSON cannot be hashed',
        'Because the body may not be JSON'
      ],
      answer: 1,
      why: 'Key order, spacing and escaping all change the bytes without changing the meaning, and HMAC has no opinion about meaning.' },

    { q: 'What is wrong with comparing signatures using ==?',
      options: [
        'It is case sensitive',
        'It cannot compare bytes to strings',
        'It returns early, so how long it takes leaks how much matched',
        'It allocates memory'
      ],
      answer: 2,
      why: 'That is a timing attack, and hmac.compare_digest takes the same time whatever the input. One function call.' },

    { q: 'Your webhook receiver processes an event and its acknowledgement is lost. You retry. What makes that safe?',
      options: [
        'The receiver handling the event id idempotently',
        'The sender waiting longer',
        'A larger timeout',
        'Signing the retry with a new secret'
      ],
      answer: 0,
      why: 'Delivery over a network is at least once. Every event carries a stable id so the receiver can recognise one it has already handled.' },

    { q: 'A partner returns 400 to your webhook. Should you retry?',
      options: [
        'Yes, ten times with backoff',
        'No: their endpoint rejects it, and sending it again changes nothing',
        'Yes, immediately',
        'Only if the body was larger than 1MB'
      ],
      answer: 1,
      why: 'Same rule as level 5 from the other side: retry what can change on its own. 4xx cannot, except 429, and the event belongs in the dead letter list.' },

    { q: 'Why keep only a hash of an API key in the database?',
      options: [
        'To save space',
        'To allow key rotation',
        'So a copy of the table is not a copy of your customers\' credentials',
        'Because keys are too long to index'
      ],
      answer: 2,
      why: 'You show the key once and store sha256 of it. Authentication still works, because you hash what arrives and compare.' },

    { q: 'Adding a new optional field to a JSON response is:',
      options: [
        'A breaking change requiring a new version',
        'Safe for existing clients',
        'Only safe if all clients are internal',
        'Impossible without a migration'
      ],
      answer: 1,
      why: 'Clients ignore fields they do not know. Removing, renaming or changing the meaning of a field is what breaks them.' },

    { q: 'What does the /v1 in the path buy you?',
      options: [
        'Faster routing',
        'Automatic documentation',
        'Rate limiting per version',
        'Room to ship a new shape beside the old one instead of breaking callers'
      ],
      answer: 3,
      why: 'One path segment on day one, a migration project if you add it later. It is the cheapest promise in API design.' },

    { q: 'Why validate amount_cents at the API edge when the ledger already refuses a bad amount?',
      options: [
        'Because the ledger check is unreliable',
        'To avoid a database round trip',
        'So the client gets a clear 422 naming the field, while the database keeps the absolute guarantee',
        'Because pydantic replaces database constraints'
      ],
      answer: 2,
      why: 'Two different jobs: a good error message early, and a guarantee that holds for every writer. Neither replaces the other.' },

    { q: 'What is a request id for?',
      options: [
        'Tracing one report back to one request across your logs',
        'Idempotency',
        'Authenticating the caller',
        'Ordering webhook deliveries'
      ],
      answer: 0,
      why: 'Generated per request, logged with everything, returned in the response. A partner quotes it and you find the request in one search.' },

    { q: 'Why test with TestClient instead of starting the server?',
      options: [
        'Because TestClient tests different code',
        'Because it calls the app in process, with no port to clash and fast enough to run on every save',
        'Because FastAPI cannot be started in tests',
        'Because it skips validation'
      ],
      answer: 1,
      why: 'It exercises the same application object, including validation and handlers. A suite that needs a running server is a suite people stop running.' }
  ],

  project: {
    title: 'The payments service',
    story: 'Another society is building an app that will move money through your level 11 ledger. They need an HTTP API ' +
           'they can integrate against in an afternoon, and they will retry on every network wobble, so it has to be ' +
           'impossible for them to charge somebody twice by accident.',
    scope: 'Uses this level plus level 11 (the ledger) and level 9 (tests, project layout). FastAPI, pydantic, psycopg, ' +
           'httpx, pytest. No frontend, no ORM, no queue: the retry loop is yours to write, which is how you learn what a ' +
           'queue does for you later.',
    requirements: [
      'POST /v1/transfers, GET /v1/transfers/{id}, GET /v1/accounts/{name}/balance and POST /v1/transfers/{id}/reverse, all under /v1',
      'Pydantic models for every request and response, with amount_cents > 0 and an upper bound',
      'Idempotency-Key required on every write, with the body fingerprint stored: 201 first, 200 on replay, 409 on reuse with a different body',
      'A payment state machine with the legal transitions in one dictionary, and illegal ones returning 409 with code illegal_transition',
      'Every error returns {"error": {"code", "message", "request_id"}} with a status code from the table in this level',
      'Middleware that gives every request an id, returns it as a header, and logs method, path, status and duration',
      'Bearer token authentication, with only the hash of each key stored, and the key never written to a log',
      'Outgoing webhooks on transfer.posted and transfer.reversed, signed with HMAC and a timestamp, retried with backoff, and dead lettered after the last attempt',
      'POST /v1/webhooks/partner that verifies the signature against the raw body, refuses a timestamp older than five minutes, uses compare_digest, and is idempotent on the event id',
      'A pytest suite covering 201, 200, 409, 422, 401 and 404, plus a tampered webhook and a replayed one',
      'A README with every endpoint, one curl example each, and a limitations section',
      'The repository in your GitHub portfolio as finquest-payments-api'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 12: the payments service.\n\nLayout:\n  main.py            the app, the routes, the middleware\n  api/models.py      pydantic requests and responses\n  api/errors.py      problem() and the exception handler\n  api/idempotency.py the key store and the fingerprint\n  api/state.py       the transition table\n  api/webhooks.py    sign, deliver with backoff, verify\n  tests/\n"""\n\nfrom fastapi import FastAPI\n\napp = FastAPI(title="FinQuest payments", version="1.0.0")\n\n\n@app.get("/v1/health")\ndef health():\n    return {"status": "ok"}\n\n\n# TODO: POST /v1/transfers, with the Idempotency-Key header\n# TODO: GET /v1/transfers/{transfer_id}\n# TODO: GET /v1/accounts/{name}/balance\n# TODO: POST /v1/transfers/{transfer_id}/reverse\n# TODO: POST /v1/webhooks/partner\n'
    },
    tests: [
      'POST /v1/transfers with a new key returns 201 and a transfer id',
      'The same key and body again returns 200 with an identical body, and the ledger holds one transfer',
      'The same key with a different body returns 409 with code idempotency_key_reused',
      'amount_cents of 0 returns 422 naming the field, and no ledger row is written',
      'A transfer from an account without the money returns 422 with code insufficient_funds',
      'Reversing twice returns 201 then 409 with code illegal_transition',
      'A request without a bearer token returns 401, and the token never appears in the logs',
      'A webhook is delivered with a valid FQ-Signature that the test receiver verifies',
      'A receiver returning 500 is retried with backoff and the event lands in the dead letter list',
      'An incoming webhook with a tampered body returns 401, and one with a timestamp ten minutes old returns 401',
      'The same incoming event id twice is processed once and acknowledged twice'
    ],
    rubric: [
      { pts: 25, t: 'Cannot charge twice', d: 'All three idempotency cases are implemented and tested, including the reuse with a different body.' },
      { pts: 20, t: 'Errors a client can use', d: 'Correct status codes, a stable machine readable code, and a request id in every response.' },
      { pts: 20, t: 'Webhooks both ways', d: 'Signed with a timestamp, retried with backoff, dead lettered. Verified against raw bytes with compare_digest and replay protection.' },
      { pts: 20, t: 'State handled', d: 'Transitions in one table, illegal ones refused with 409, and no path that mutates state without going through it.' },
      { pts: 15, t: 'Shipped', d: 'Runs from a clean clone, tests pass with no server, README documents every endpoint and says what is missing.' }
    ],
    stretch: [
      'Add rate limiting per API key with a 429 and a Retry-After header',
      'Add cursor pagination to a GET /v1/transfers list endpoint and explain why offset pagination breaks under writes',
      'Move webhook delivery into a background worker with a queue table, and keep the retry semantics identical',
      'Publish the OpenAPI document and generate a client from it'
    ],
    solutionPath: 'solutions/level-12'
  },

  faq: [
    { q: 'Should the idempotency key be a header or a field in the body?',
      a: 'A header, because it is about the request rather than about the payment, and because it is what every payments API does. Matching the convention means an integrator already knows how yours works.' },
    { q: 'How long do I keep idempotency keys?',
      a: 'Long enough to cover any retry a client will make, which in practice is 24 hours to a few days. Store the key, the fingerprint, the response and a created_at, and delete the old ones on a schedule.' },
    { q: 'My signature verifies in tests and fails against the real sender',
      a: 'You are almost certainly verifying against re-serialised JSON. Read the raw body once, verify those exact bytes, and parse afterwards.' },
    { q: 'Do I need async?',
      a: 'Not for this. FastAPI runs plain def endpoints in a thread pool, and psycopg calls are blocking. Use async when you have something to await, not because the framework can.' },
    { q: 'Where do I put the webhook secret?',
      a: 'In the environment, one per customer, alongside the endpoint URL. Rotate by accepting two secrets for a window, which is exactly how the processors let you rotate theirs.' },
    { q: 'What returns 404 instead of 403 for another account\'s transfer?',
      a: 'Either is defensible. 404 leaks less, because 403 confirms the id exists. Pick one, write it down, and be consistent.' },
    { q: 'Is TestClient really testing the real app?',
      a: 'Yes. It calls the same application object through the same middleware, validation and handlers. What it skips is the network, which is the part you are not testing here anyway.' }
  ]
});
