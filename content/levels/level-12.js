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
    { h: 'An API is a promise' },
    { p: 'Level 11 built a ledger in a database. Nothing outside your own code can use it yet. This level puts an **API** in ' +
         'front of it, the level 5 idea from the other side: now your server is the one other programs call. Each web address ' +
         'it answers, together with its method, is an **endpoint**.' },
    { table: {
      head: ['Endpoint', 'What it does', 'What it answers with'],
      rows: [
        ['`POST /v1/transfers`', 'Move money between two accounts', '`201` and the new transfer, or `200` if it is a retry'],
        ['`GET /v1/transfers/{id}`', 'Look up one transfer', '`200`, or `404` if there is no such transfer for you'],
        ['`GET /v1/accounts/{id}/balance`', 'The balance, in cents', '`200`'],
        ['`POST /v1/transfers/{id}/reverse`', 'Cancel a transfer with a mirror transaction', '`201`, or `409` if it is already reversed']
      ]
    }},
    { p: 'The moment one other company writes code against these endpoints, every detail of every response is a promise. ' +
         'If you rename a field, their code breaks on the day you release it, and nothing warns them first. So you design the ' +
         'endpoints carefully before writing the code behind them, because the code is the easy part to change later.' },
    { p: 'The rule that follows: **adding** a field to a response is safe, because old code simply ignores it. **Removing** or ' +
         '**renaming** one breaks somebody. That is what the `/v1` in every address is for: when you truly need to change the ' +
         'shape, you build `/v2` beside it and leave `/v1` working until everybody has moved.' },
    { check: {
      q: 'A teammate wants to change `amount_cents` to `amount` and return a decimal string, because it reads better. Two ' +
         'partners already call the endpoint. What do you tell them?',
      a: 'That it is a new version, not a rename. Every caller reading `amount_cents` breaks the moment it ships, and they find ' +
         'out when real payments fail, because nothing in the web protocol warns them first. The cheap route is to add `amount` ' +
         'alongside, leave `amount_cents` in place, mark it as going away in the documentation, and remove it in `/v2` once the ' +
         'partners have moved. Adding a field is safe, removing or changing one is not, and that difference is most of what ' +
         'API design is about.'
    }},

    { h: 'Retries over the internet' },
    { p: 'Level 4 met the lost response: the server charged the customer, the "done" message vanished in a tunnel, and the ' +
         'phone tried again. Level 11 made the database refuse a duplicate key. Now the retry arrives over the internet, from ' +
         'another company\'s server, which has no idea whether its first attempt reached you.' },
    { p: 'The convention every payments API uses: the caller makes up one unique key for each payment it intends, and sends it ' +
         'in a **header**, a labelled line of extra information that travels with the request, separate from the **body**, ' +
         'which holds the data itself:' },
    { code: 'POST /v1/transfers\nIdempotency-Key: 7b3c0f1a-4d22-4c0a-9a8f-1b5f0e0a2c11        <- a header\nContent-Type: application/json                               <- another header\n\n{"from": "alice", "to": "bob", "amount_cents": 2500, "memo": "coffee"}      <- the body', lang: 'text' },
    { p: 'A serious API handles three cases:' },
    { table: {
      head: ['What arrives', 'What your API does', 'Status'],
      rows: [
        ['A key it has never seen', 'Do the transfer, save the key with the response', '`201`'],
        ['A key it has seen, with the same body', 'A retry: send back the saved response, do nothing else', '`200`'],
        ['A key it has seen, with a **different** body', 'The caller has a bug. Say so', '`409`']
      ]
    }},
    { p: 'To spot the third case you save a **fingerprint** of the body next to the key. A fingerprint here is a **hash**: a ' +
         'function that turns any amount of data into a short fixed-length code, where changing even one character gives a ' +
         'completely different code:' },
    { code: 'fingerprint = hashlib.sha256(raw_body).hexdigest()\n\n{"from": "alice", "to": "bob", "amount_cents": 2500, "memo": "coffee"}\n  -> b40aa7b7c24977df974168ca0f36e6ba2992243c978ce36e2005135419fb2a73\n\n{"from": "alice", "to": "bob", "amount_cents": 9900, "memo": "coffee"}\n  -> bb08dfe38c4af85aa928fc123dee2b1e6fea77f3a7ccf9f2fb9440e263f40dc6', lang: 'python' },
    { check: {
      q: 'Your API saves the key and sends back the old response on any repeat. A caller has a bug that reuses one key for ' +
         'every transfer of the day. What does your API do, and what should it do?',
      a: 'It sends back the first transfer every time, and the caller believes forty payments went through when one did. The ' +
         'money is safe and the records are wrong, which is worse in one way: nobody is looking for a problem. With the body ' +
         'fingerprint saved you compare, see a different request under the same key, and return `409` naming the key. The ' +
         'caller finds their bug on the second request instead of at the end of the month.'
    }},

    { h: 'A payment is a state machine' },
    { p: 'Level 4 listed the stages a payment passes through. A **state machine** is that list plus a strict rule about which ' +
         'stage may follow which. Most bugs in payment systems are a move nobody thought about: refunding a payment that ' +
         'failed, or reversing the same transfer twice.' },
    { code: 'requested ──▶ posted ──▶ settled\n    │             │\n    │             └──▶ reversed\n    └──▶ failed\n\nLEGAL = {\n  "requested": {"posted", "failed"},\n  "posted":    {"settled", "reversed"},\n  "settled":   {"reversed"},\n  "reversed":  set(),        # final: nothing can follow\n  "failed":    set(),        # final: nothing can follow\n}', lang: 'python', label: 'the whole machine' },
    { p: 'A state with nothing after it is called **terminal**. One small function then guards every change:' },
    { code: 'def move(transfer, to_state):\n    if to_state not in LEGAL[transfer.state]:\n        raise IllegalTransition(f"{transfer.state} cannot become {to_state}")\n    transfer.state = to_state\n\nmove(t, "reversed")    # posted -> reversed: fine\nmove(t, "reversed")    # IllegalTransition: reversed cannot become reversed', lang: 'python' },
    { p: 'One function and one dictionary, and an impossible move becomes an error instead of a customer complaint. In the API ' +
         'it becomes `409 Conflict`: the request was written correctly, but the transfer\'s current state refuses it.' },
    { check: {
      q: 'A partner calls reverse twice on the same transfer, a second apart. Without the state machine, what happens, and with ' +
         'it, what status code do they get?',
      a: 'Without it, two mirror transactions are saved and the customer is refunded twice. The ledger still balances, which is ' +
         'exactly why this kind of bug survives so long. With it, the first call moves the transfer to reversed, and the second ' +
         'finds that reversed is terminal and gets `409` with a code the partner\'s program can check. Note what it is not: not ' +
         '`400`, because their request was fine, and not `500`, because nothing broke on your side.'
    }},

    { h: 'Errors a program can act on' },
    { p: 'The caller of your API is a program, and a program cannot read a sentence and decide what to do. So every error ' +
         'carries three things: a status code for the kind of problem, a short fixed string for the exact problem, and a ' +
         'sentence for the human who reads the logs later:' },
    { code: '{\n  "error": {\n    "code": "insufficient_funds",\n    "message": "alice holds $12.40, this transfer needs $25.00",\n    "request_id": "req_01J8ZC"\n  }\n}', lang: 'json' },
    { p: 'The caller\'s code can then say `if error["code"] == "insufficient_funds": show_top_up_screen()`, which it could never ' +
         'do with the sentence. The status code tells it whether trying again could ever help:' },
    { table: {
      head: ['Status', 'Means', 'Should the caller try again?'],
      rows: [
        ['`400`', 'The request is badly formed', 'No, fix it'],
        ['`401` or `403`', 'Not logged in, or not allowed', 'No'],
        ['`404`', 'No such thing, or not yours to see', 'No'],
        ['`409`', 'Correctly written, but the current state refuses it', 'No, look at the state first'],
        ['`422`', 'Correctly written, but a value is wrong', 'No'],
        ['`429`', 'Too many requests', 'Yes, after the delay you are told'],
        ['`500`', 'Something broke on the server', 'Yes, with backoff'],
        ['`503`', 'The server is down or overloaded', 'Yes, with backoff']
      ]
    }},
    { p: 'The `request_id` is the cheapest debugging tool there is. Make one up for every request, include it in every line you ' +
         'log about that request, and send it back in every response. When a partner reports a problem they quote it, and you ' +
         'find their exact request in one search instead of an afternoon.' },
    { check: {
      q: 'Your API returns `500` when a transfer has insufficient funds, with the message "insufficient funds". Two things are ' +
         'wrong. What are they, and what does the caller do because of it?',
      a: 'The status is wrong and the body is useless to a program. `500` means the server broke, so a well written caller ' +
         'retries it, with backoff, forever, against an account that will never have the money: you have turned a clean refusal ' +
         'into a flood of retries. And because the only part a program can read is the status code, the caller cannot tell this ' +
         'apart from your database being down. It should be `422` with `"code": "insufficient_funds"`, which tells the caller to ' +
         'stop and tells their alerts not to wake anybody up.'
    }},

    { h: 'Webhooks: telling other systems what happened' },
    { p: 'A partner wants to know the moment a transfer settles. They could ask you every few seconds, called **polling**, which ' +
         'wastes everybody\'s effort. Instead you tell them: when something happens, your server sends a request to an address ' +
         'they gave you. That is a **webhook**.' },
    { p: 'The problem: their address is on the public internet, so anybody can send a request to it pretending to be you. The ' +
         'only thing that makes your message trustworthy is a **signature** they can check. You and the partner share a secret ' +
         'string, and you compute an **HMAC**: a hash of the message mixed with that secret. Only somebody holding the secret ' +
         'can produce it, and changing even one character of the message changes it completely:' },
    { code: 'signed_payload = f"{timestamp}.{raw_body}"\nsignature = hmac.new(secret, signed_payload.encode(), hashlib.sha256).hexdigest()\nheaders = {"FQ-Signature": f"t={timestamp},v1={signature}"}', lang: 'python' },
    { code: 'secret     whsec_demo\ntimestamp  1789000000\nbody       {"event":"transfer.posted","id":"evt_001","amount_cents":2500}\nsignature  4d1b509b955a53c3722bd994df5b07463b33bea6a533c634b6c437b642499561\n\nchange amount_cents to 250000 and the same secret produces\n           706589412db2aa3ba1945579134291303b33ab4ae02bf82bfcbd71b9b34a5857', lang: 'text', label: 'one change, a completely different signature' },
    { p: 'The **timestamp** is inside the signed text on purpose. Without it, someone who copies one genuine message could send ' +
         'it again a year later and it would still check out, which is called a **replay attack**. With it, the receiver refuses ' +
         'anything more than a few minutes old, and the attacker cannot change the time without breaking the signature.' },
    { p: 'Webhooks are delivered **at least once**, never exactly once. The internet can lose your message, or lose their ' +
         '"got it" reply, and you cannot tell which, so you keep retrying: after 1 second, 2, 4, 8, up to a limit. After that, ' +
         'the event goes into a holding list, a **dead letter queue**, for a person to look at. So the receiver will sometimes ' +
         'get the same event twice, which is why every event carries its own id.' },
    { money: 'Stripe, Adyen, GoCardless and every other payment processor works exactly this way, down to the header format. ' +
             'Build it once and you understand what the other end is doing in every integration you will ever write.' },
    { check: {
      q: 'Your webhook sends a transfer event, the partner\'s server receives it and marks an order as paid, and then their ' +
         '"got it" reply is lost. You retry. What has to be true on their side for that to be safe, and whose job is it?',
      a: 'Their handler has to ignore an event id it has already handled: look it up, and if `evt_001` was already processed, ' +
         'reply "got it" and do nothing. Doing that is their job; making it possible is yours, which means every event carries ' +
         'a unique id that never changes, and your documentation says delivery is at least once. A processor that promises ' +
         'exactly-once delivery over the internet is promising something nobody can deliver.'
    }},

    { h: 'Receiving a webhook: check before you trust' },
    { p: 'When you are the one receiving, the order of the steps matters, and every step is a real incident someone has had:' },
    { ol: [
      'Read the **raw body**, the exact bytes that arrived, before turning it into Python objects. Converting it and back ' +
      'changes the bytes, and the signature will no longer match.',
      'Check the **timestamp** is within a few minutes of now, or a copied message can be replayed forever.',
      'Recompute the HMAC with your copy of the secret and compare using **`hmac.compare_digest`**, never `==`.',
      'Only then read the JSON and act on it, ignoring any event id you have already handled.'
    ]},
    { code: 'import hmac, hashlib, time\n\ndef verify(raw_body: bytes, header: str, secret: bytes, tolerance=300) -> bool:\n    parts = dict(p.split("=", 1) for p in header.split(","))\n    ts, sig = parts["t"], parts["v1"]\n    if abs(time.time() - int(ts)) > tolerance:          # older than 5 minutes: refuse\n        return False\n    expected = hmac.new(secret, f"{ts}.".encode() + raw_body, hashlib.sha256).hexdigest()\n    return hmac.compare_digest(expected, sig)', lang: 'python' },
    { warn: '`==` compares two strings one character at a time and stops at the first difference, so how long it takes reveals ' +
            'how much of a guessed signature was right. An attacker who can time thousands of guesses can work the signature ' +
            'out one character at a time. `compare_digest` always takes the same time. This is called a **timing attack**, and ' +
            'the fix is one function call.' },
    { check: {
      q: 'You check the signature against JSON you parsed and turned back into text, because it is easier to work with. It ' +
         'passes in your tests and fails with the real partner. Why?',
      a: 'Because your tests convert with the same library both ways and the partner does not. The partner signed their exact ' +
         'bytes: their key order, their spacing, their way of writing special characters. `json.loads` then `json.dumps` ' +
         'produces different bytes with the same meaning, and an HMAC only cares about bytes. Read the raw body once, check it, ' +
         'and parse afterwards. In FastAPI that is `await request.body()`, before anything else touches the request.'
    }},

    { h: 'API keys, and how to store them' },
    { p: 'Callers prove who they are with an **API key**, a long secret string sent in a header on every request:' },
    { code: 'Authorization: Bearer fq_live_9c1d...', lang: 'text' },
    { p: 'Two rules separate a professional service from a student one, and both are about what you do after you hand the key ' +
         'out:' },
    { ul: [
      '**Store a hash, never the key.** Show the key once, when it is created, and save only its hash, `sha256(key)`. When a ' +
      'request arrives, hash the key it carries and compare. You can still check every request, but a stolen copy of your ' +
      'table contains no working keys, because a hash cannot be turned back into the key.',
      '**Never write it to a log.** Not in the request log, not in an error message, not in a debugging dump. Logs get copied ' +
      'to many places and read by many people, and a key in a log is a key anyone can use.'
    ]},
    { p: 'Give every key a prefix that says what it is, like `fq_live_` for real money and `fq_test_` for testing. It costs ' +
         'nothing, it lets automatic scanners recognise a leaked key, and it stops the oldest mistake in the industry: running a ' +
         'test against real customers\' money.' }
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
    { q: "A client sends the same idempotency key with a different request body. What should the API return?",
      options: [
        "500, because the state is ambiguous",
        "409, because the key was used for a different request",
        "201 and a second transfer",
        "200 with the original transfer"
      ],
      answer: 1,
      why: "Replaying the original hides a client bug that is quietly losing payments. 409 tells them on the second request instead of at month end." },

    { q: "Why store a hash of the request body next to the idempotency key?",
      options: [
        "To index the table",
        "To compress the stored response",
        "To detect a key reused for a different request",
        "To verify the client signature"
      ],
      answer: 2,
      why: "Without the fingerprint you cannot tell a retry from a mistake, so both look like a repeat and one of them is a bug you never see." },

    { q: "A transfer has insufficient funds. Which status code?",
      options: [
        "422",
        "400",
        "403",
        "500"
      ],
      answer: 0,
      why: "The request was well formed and understood; the values are unacceptable. 500 tells a well behaved client to retry forever against an account that will never have the money." },

    { q: "Why is a second reverse of the same transfer a 409 rather than a 400?",
      options: [
        "Because the client forgot a header",
        "Because the request is well formed and the current state refuses it",
        "Because 409 is the code for money errors",
        "Because reversal is always asynchronous"
      ],
      answer: 1,
      why: "400 means fix your request; nothing is wrong with theirs. 409 says read the state, which is the information they actually need." },

    { q: "Why is the timestamp included inside the signed payload of a webhook?",
      options: [
        "So a captured request cannot be replayed later",
        "Because HMAC requires a nonce",
        "To let the sender measure latency",
        "So the receiver can sort events"
      ],
      answer: 0,
      why: "Signing it means an attacker cannot change it, and the receiver refuses anything older than a few minutes. Without it a valid message stays valid forever." },

    { q: "Why must a webhook signature be verified against the raw body?",
      options: [
        "Because parsing is slow",
        "Because JSON cannot be hashed",
        "Because the body may not be JSON",
        "Because the sender signed their exact bytes, and re-serialising produces different ones"
      ],
      answer: 3,
      why: "Key order, spacing and escaping all change the bytes without changing the meaning, and HMAC has no opinion about meaning." },

    { q: "What is wrong with comparing signatures using ==?",
      options: [
        "It cannot compare bytes to strings",
        "It allocates memory",
        "It returns early, so how long it takes leaks how much matched",
        "It is case sensitive"
      ],
      answer: 2,
      why: "That is a timing attack, and hmac.compare_digest takes the same time whatever the input. One function call." },

    { q: "Your webhook receiver processes an event and its acknowledgement is lost. You retry. What makes that safe?",
      options: [
        "Signing the retry with a new secret",
        "A larger timeout",
        "The sender waiting longer",
        "The receiver handling the event id idempotently"
      ],
      answer: 3,
      why: "Delivery over a network is at least once. Every event carries a stable id so the receiver can recognise one it has already handled." },

    { q: "A partner returns 400 to your webhook. Should you retry?",
      options: [
        "Yes, ten times with backoff",
        "No: their endpoint rejects it, and sending it again changes nothing",
        "Only if the body was larger than 1MB",
        "Yes, immediately"
      ],
      answer: 1,
      why: "Same rule as level 5 from the other side: retry what can change on its own. 4xx cannot, except 429, and the event belongs in the dead letter list." },

    { q: "Why keep only a hash of an API key in the database?",
      options: [
        "So a copy of the table is not a copy of your customers' credentials",
        "Because keys are too long to index",
        "To allow key rotation",
        "To save space"
      ],
      answer: 0,
      why: "You show the key once and store sha256 of it. Authentication still works, because you hash what arrives and compare." },

    { q: "Adding a new optional field to a JSON response is:",
      options: [
        "Only safe if all clients are internal",
        "A breaking change requiring a new version",
        "Impossible without a migration",
        "Safe for existing clients"
      ],
      answer: 3,
      why: "Clients ignore fields they do not know. Removing, renaming or changing the meaning of a field is what breaks them." },

    { q: "What does the /v1 in the path buy you?",
      options: [
        "Rate limiting per version",
        "Faster routing",
        "Room to ship a new shape beside the old one instead of breaking callers",
        "Automatic documentation"
      ],
      answer: 2,
      why: "One path segment on day one, a migration project if you add it later. It is the cheapest promise in API design." },

    { q: "Why validate amount_cents at the API edge when the ledger already refuses a bad amount?",
      options: [
        "To avoid a database round trip",
        "So the client gets a clear 422 naming the field, while the database keeps the absolute guarantee",
        "Because pydantic replaces database constraints",
        "Because the ledger check is unreliable"
      ],
      answer: 1,
      why: "Two different jobs: a good error message early, and a guarantee that holds for every writer. Neither replaces the other." },

    { q: "What is a request id for?",
      options: [
        "Authenticating the caller",
        "Ordering webhook deliveries",
        "Tracing one report back to one request across your logs",
        "Idempotency"
      ],
      answer: 2,
      why: "Generated per request, logged with everything, returned in the response. A partner quotes it and you find the request in one search." },

    { q: "Why test with TestClient instead of starting the server?",
      options: [
        "Because it calls the app in process, with no port to clash and fast enough to run on every save",
        "Because it skips validation",
        "Because FastAPI cannot be started in tests",
        "Because TestClient tests different code"
      ],
      answer: 0,
      why: "It exercises the same application object, including validation and handlers. A suite that needs a running server is a suite people stop running." }
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
