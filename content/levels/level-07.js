/* =========================================================================
   LEVEL 7: the payments API
   ========================================================================= */
FQ.registerLevel({
  id: 7,
  codename: 'payments-api',
  title: 'The payments API other systems depend on',
  tagline: 'A ledger nobody can call is a hobby. Put an HTTP interface in front of it that survives retries, refuses what it should, and tells a machine exactly what went wrong. This is the job itself.',
  difficulty: 7,
  minutes: 420,
  tags: ['FastAPI', 'REST', 'idempotency', 'validation', 'pagination'],
  summary: 'Most backend work at a payments company is an HTTP interface over a ledger, and most of the difficulty is in ' +
           'four things nobody demos: retries that must not double charge, errors a program can act on, pagination that ' +
           'does not fall over, and a contract you cannot break. You build all four on top of the level 6 database. Every ' +
           'request and response in this level came out of a running service.',

  objectives: [
    'Read an HTTP request and say what each part is for',
    'Design endpoints and status codes another team can program against',
    'Validate input at the edge and return errors a machine can branch on',
    'Accept an idempotency key over HTTP and handle all three cases correctly',
    'Authenticate callers with a hashed API key',
    'Paginate with a cursor, and know why offset stops working',
    'Put a request id on everything and know what it saves you',
    'Test the whole service without starting a server'
  ],

  knowledge: [
    { h: 'What is actually on the wire' },
    { p: 'Level 5 called somebody else\'s API. Now yours is the one being called, and the caller is another company\'s ' +
         'software. Before design, look at what an HTTP request is made of, because every decision in this level is about ' +
         'one of these four parts:' },
    { code: 'POST /v1/transfers HTTP/1.1                      <- method and path\nAuthorization: Bearer fq_test_demo               <- a header\nIdempotency-Key: idem_76b7d9e349                <- another header\nContent-Type: application/json\n\n{"from_account": "C000001", "to_account": "C000002",\n "amount_minor": 2500, "currency": "usd", "memo": "coffee"}     <- the body', lang: 'text' },
    { table: {
      head: ['Part', 'What it is for'],
      rows: [
        ['**Method**', 'The kind of action: `GET` reads, `POST` creates, `DELETE` removes'],
        ['**Path**', 'Which thing you are acting on. `/v1/transfers` is the collection of transfers'],
        ['**Headers**', 'Everything about the request that is not the data: who you are, what format, which retry this is'],
        ['**Body**', 'The data itself, in JSON'],
        ['**Status code**', 'On the way back: a three digit number saying how it went']
      ]
    }},
    { p: 'The rule for where things go: **data goes in the body, everything about the request goes in a header.** The amount ' +
         'is data. The API key and the idempotency key are not, so they are headers.' },

    { h: 'An endpoint is a promise' },
    { p: 'The moment another company writes code against your API, every field name and every status code is a promise. ' +
         'Break one and their code fails in production, with no warning first. So the shape is designed before the code:' },
    { table: {
      head: ['Endpoint', 'What it does', 'What it answers with'],
      rows: [
        ['`POST /v1/transfers`', 'Move money between two accounts', '`201` and the new transfer, or `200` if this is a retry'],
        ['`GET /v1/transfers/{id}`', 'Look up one transfer', '`200`, or `404`'],
        ['`GET /v1/accounts/{name}/balance`', 'The balance, in minor units', '`200`'],
        ['`GET /v1/accounts/{name}/entries`', 'One page of entries, with a cursor', '`200`']
      ]
    }},
    { p: 'Two habits keep that promise. **Adding** a field is safe, because old callers ignore what they do not read. ' +
         '**Removing or renaming** one is not. And the `/v1` at the front means that when you truly need a different shape, ' +
         'you build `/v2` beside it and leave `/v1` working until everybody has moved.' },
    { check: {
      q: 'A teammate wants to rename `amount_minor` to `amount` and return "25.00" instead of 2500, because it reads better. ' +
         'Two partners already call the endpoint. What do you tell them?',
      a: 'That it is a new version, not a rename, and that the second half is a worse idea than the first. Every caller ' +
         'reading `amount_minor` breaks the moment it ships. And returning "25.00" as a string hands every caller the ' +
         'decimal problem from level 5, in a language you do not control: someone will parse it as a float and be wrong by a ' +
         'cent on a large number. Add a field if you want, never remove one, and keep integers on the wire.'
    }},

    { h: 'Validate at the edge, once' },
    { p: 'Everything arriving from outside is untrusted: wrong types, missing fields, negative amounts, a currency code with ' +
         'four letters. **FastAPI** uses **pydantic** to turn a class into a validator, so bad input never reaches your ' +
         'logic:' },
    { code: 'class TransferRequest(BaseModel):\n    from_account: str = Field(min_length=1, max_length=64)\n    to_account:   str = Field(min_length=1, max_length=64)\n    amount_minor: int = Field(gt=0, le=10_000_000_00)     # positive, and capped\n    currency:     str = Field(min_length=3, max_length=3)\n    memo:         str = Field(default="", max_length=140)', lang: 'python' },
    { p: 'Send a negative amount and a four letter currency, and this is the real answer the service gives, with status ' +
         '**422**, before a single line of your own code runs:' },
    { code: '{\n  "detail": [\n    {"type": "greater_than", "loc": ["body", "amount_minor"],\n     "msg": "Input should be greater than 0", "input": -5, "ctx": {"gt": 0}},\n    {"type": "string_too_long", "loc": ["body", "currency"],\n     "msg": "String should have at most 3 characters", "input": "USDD", "ctx": {"max_length": 3}}\n  ]\n}', lang: 'json', label: 'measured: 422 in 4.3 ms' },
    { p: 'Notice what it gives the caller: which field, what rule, and what they sent. It reports **both** problems rather ' +
         'than stopping at the first, which saves a round trip of fix-and-retry.' },
    { warn: 'A cap matters as much as a minimum. `le=10_000_000_00` refuses a transfer of ten million dollars from a test ' +
            'script with an extra zero. Every amount field in a payments API has an upper bound somebody chose.' },

    { h: 'Errors a program can act on' },
    { p: 'Your caller is software. It cannot read a sentence and decide what to do, so every error carries three things: a ' +
         'status code for the kind of problem, a short fixed string for the exact problem, and a sentence for the human who ' +
         'reads the logs afterwards. Real responses from the service:' },
    { code: 'HTTP 422\n{"error": {"code": "insufficient_funds",\n           "message": "C000001 holds 500, this transfer needs 999999999.",\n           "request_id": "req_1c2f7e266775"}}\n\nHTTP 404\n{"error": {"code": "account_not_found",\n           "message": "No account named C999999.",\n           "request_id": "req_edf6958a3729"}}', lang: 'json' },
    { p: 'The caller writes `if error["code"] == "insufficient_funds": show_top_up_screen()`. It could never do that with the ' +
         'sentence, because sentences get reworded and code does not.' },
    { table: {
      head: ['Status', 'Means', 'Should the caller retry?'],
      rows: [
        ['`200`', 'Fine, and this was a replay of something already done', 'No need'],
        ['`201`', 'Created', 'No'],
        ['`400`', 'The request is badly formed, for example a missing header', 'No, fix it'],
        ['`401`', 'No key, or a key that is not valid', 'No'],
        ['`404`', 'No such thing, or not yours to see', 'No'],
        ['`409`', 'Correctly formed, and the current state refuses it', 'No, look at the state'],
        ['`422`', 'Correctly formed, and a value is wrong or the money is not there', 'No'],
        ['`429`', 'Too many requests', 'Yes, after the delay you are given'],
        ['`500`', 'Something broke on your side', 'Yes, with backoff'],
        ['`503`', 'Down or overloaded', 'Yes, with backoff']
      ]
    }},
    { p: 'Now a real problem, found by running the service rather than by reading about it. The errors above are the ones ' +
         'this code wrote by hand. But the framework produces errors too, and they look different:' },
    { code: 'your error:        {"error": {"code": "...", "message": "...", "request_id": "..."}}\nframework 401:     {"detail": "missing_api_key"}\nframework 422:     {"detail": [ {...}, {...} ]}', lang: 'text', label: 'three shapes, one API' },
    { p: 'A caller now has to handle two different error formats from the same service, and will get it wrong. The fix is an ' +
         '**exception handler**: one function that catches the framework\'s errors and rewrites them into your shape, so ' +
         'every error in the whole API looks the same. Writing that handler is a requirement of the build, and noticing this ' +
         'yourself is the kind of thing that separates a finished API from a demo.' },
    { check: {
      q: 'Your API returns `500` with `{"detail": "insufficient funds"}` when an account is short. Name three separate ' +
         'things wrong with that response.',
      a: 'The status, the shape and the wording. `500` means the server broke, so a well written caller retries it with ' +
         'backoff, forever, against an account that will never have the money: a clean refusal has been turned into a flood ' +
         'of retries, and their alerting will page somebody. The shape has no stable code, so the caller can only match on ' +
         'English, which breaks the first time you reword it. And the message gives no numbers, so the human debugging it ' +
         'still has to go and look. It should be `422`, with `"code": "insufficient_funds"`, and a message naming the ' +
         'balance and the amount.'
    }},

    { h: 'Idempotency over the wire' },
    { p: 'Level 4 met the lost response and level 6 made the database refuse a duplicate key. Now the retry arrives over the ' +
         'internet, from another company\'s server, which cannot know whether its first attempt reached you. The caller ' +
         'invents one key per payment it intends and sends it as a header on every attempt.' },
    { p: 'There are exactly three cases, and a serious API handles all three. These are the real responses:' },
    { table: {
      head: ['What arrives', 'What happens', 'Real result'],
      rows: [
        ['A key never seen before', 'Do the work, save the key with the response', '`201`, transfer id 230004'],
        ['The same key, the same body', 'A retry: send back the saved response, do nothing else', '`200`, the same id 230004, with `Idempotent-Replay: true`'],
        ['The same key, a **different** body', 'The caller has a bug. Refuse and name it', '`409 idempotency_key_reused`']
      ]
    }},
    { code: '{"error": {"code": "idempotency_key_reused",\n           "message": "Key idem_76b7d9e349 was used for a different request.",\n           "request_id": "req_ac00da266523"}}', lang: 'json' },
    { p: 'To tell the second case from the third you save a **fingerprint** of the body next to the key: a hash, as in level ' +
         '5. Same key and same fingerprint is a retry. Same key and a different fingerprint is a bug in their code, and ' +
         'saying so early is a kindness.' },
    { p: 'You also save the **response** you sent, so the replay returns exactly what the first attempt returned, down to ' +
         'the id and the timestamp. A retry that returns a slightly different answer is worse than one that fails.' },
    { warn: 'Writes without an idempotency key should be refused outright: `400 idempotency_key_required`. If it is ' +
            'optional, callers will leave it out, and you will find out during their incident rather than during your ' +
            'review.' },
    { check: {
      q: 'Your API saves the key and returns the saved response on any repeat, without comparing bodies. A caller has a bug ' +
         'that reuses one key for every transfer of the day. What does your API do, and why is it worse than a crash?',
      a: 'It returns the first transfer, every time, so the caller believes forty payments went through when one did. The ' +
         'money is safe and their records are wrong, and nobody is looking, because nothing failed. A crash would have been ' +
         'found in minutes. With the fingerprint saved you compare, see a different request under the same key, and return ' +
         '`409` naming the key, so their bug surfaces on the second request instead of at the end of the month.'
    }},

    { h: 'Who is calling: keys, hashed' },
    { p: 'Callers prove who they are with an **API key**, a long secret string sent in a header. Two rules, both from level ' +
         '5, now with the server\'s half:' },
    { code: 'Authorization: Bearer fq_test_demo\n\n# on your side, you never store the key itself\nAPI_KEYS = {sha256(b"fq_test_demo").hexdigest(): "demo-merchant"}\n\n# a request arrives: hash what it carries and look that up\ndigest = sha256(presented_key.encode()).hexdigest()', lang: 'python' },
    { p: 'A stolen copy of your key table is then useless, because a hash cannot be turned back into the key. Missing or ' +
         'unknown key gives `401`, measured at 6.1 ms because it never touches the database: authentication happens before ' +
         'any work.' },
    { p: 'Give keys a prefix that says what they are, `fq_live_` and `fq_test_`, so a leaked key is recognisable by ' +
         'automatic scanners and nobody runs a test against real money.' },

    { h: 'Pagination: why offset breaks and cursors do not' },
    { p: 'An account can have a million entries, so a list endpoint returns a page at a time. There are two ways, and the ' +
         'obvious one is a trap.' },
    { p: '**Offset pagination** says "skip 300,000 rows and give me 20". The database has to walk past every one of those ' +
         'rows to find where to start. On the level 6 table, measured:' },
    { code: 'select id, amount_minor from entries order by id offset 300000 limit 20;\n  Index Scan using entries_pkey  (actual rows=300020)\n  Buffers: shared hit=3323\n  Execution Time: 63.259 ms', lang: 'text', label: 'offset: 300,020 rows read to return 20' },
    { p: '**Cursor pagination**, also called keyset, says "give me 20 rows after id 300000". The index goes straight there:' },
    { code: 'select id, amount_minor from entries where id > 300000 order by id limit 20;\n  Index Scan using entries_pkey  (actual rows=20)\n  Buffers: shared hit=3 read=1\n  Execution Time: 1.365 ms', lang: 'text', label: 'cursor: 20 rows read to return 20' },
    { p: 'Forty six times faster here, and the gap grows with the page number: offset gets slower the deeper somebody pages, ' +
         'while a cursor costs the same on page 1 and page 10,000. Offset has a second fault too. If a new row is inserted ' +
         'while somebody is paging, every later page shifts by one, so they see a row twice or miss one entirely. A cursor ' +
         'is anchored to a real row, so it cannot drift.' },
    { p: 'The response says where to continue, and the caller passes it back:' },
    { code: 'GET /v1/accounts/C000001/entries?limit=3\n{"data": [{"id": 2000, "amount_minor": -74100},\n          {"id": 4000, "amount_minor": -58100},\n          {"id": 6000, "amount_minor": -42100}],\n "has_more": true, "next_cursor": 6000}\n\nGET /v1/accounts/C000001/entries?limit=3&cursor=6000\n{"data": [{"id": 8000, ...}, {"id": 10000, ...}, {"id": 12000, ...}],\n "has_more": true, "next_cursor": 12000}', lang: 'json', label: 'real responses' },
    { tip: 'Ask for one more row than the page size. If you get it, there is another page, and you drop the extra before ' +
           'answering. That is how `has_more` is computed without a second count query.' },

    { h: 'The request id, and the two headers worth adding' },
    { p: 'Every response from this service carries a request id, made up if the caller did not supply one:' },
    { code: 'X-Request-Id: req_1c2f7e266775\nX-Duration-Ms: 317.2', lang: 'text' },
    { p: 'Put that id in every log line about the request, and return it in every response, including errors. When a partner ' +
         'reports a problem they quote the id and you find the exact request in one search rather than an afternoon. It is ' +
         'the cheapest debugging tool that exists, and almost nobody adds it before their first incident.' },
    { p: 'The duration header is for you. It is also how the next section was noticed.' },

    { h: 'The number that decides your p99' },
    { p: 'Look again at the timings on the real responses. A validation failure took **4.3 ms**. A missing API key took ' +
         '**6.1 ms**. Anything that touched the database took **200 to 500 ms**. That gap is not the query: the level 6 ' +
         'balance query runs in under a millisecond.' },
    { p: 'It is the connection. This service opens a new database connection per request, and that costs a TLS handshake ' +
         'and an authentication round trip every time. Measured, fifteen runs each:' },
    { table: {
      head: ['', 'Median', 'p95', 'Fastest'],
      rows: [
        ['A new connection every time', '202.7 ms', '216.0 ms', '180.0 ms'],
        ['One connection reused', '62.3 ms', '66.6 ms', '60.2 ms']
      ]
    }},
    { p: 'Three and a third times the latency, for exactly the same query and the same answer. The remaining 62 ms is the ' +
         'network, because this database is in another country. The fix is a **connection pool**: keep a handful of ' +
         'connections open and hand them out, so the handshake happens once rather than once per request. Level 8 builds ' +
         'one and measures what it does under load.' },
    { check: {
      q: 'Your API\'s p99 latency is 300 ms and your slowest SQL query takes 2 ms. Where is the time, and what does that ' +
         'tell you about how to find it?',
      a: 'Not in the query, which is the point. Time goes missing in the parts nobody instruments: opening a connection, ' +
         'waiting for a free one in a pool that is too small, TLS, DNS, the network to a database in another region, and ' +
         'work you do after the query. A measured example from this level is 202.7 ms median for a connect-then-query ' +
         'against 62.3 ms for the same query on a connection already open. The lesson for finding it is to measure the ' +
         'whole request, not the database: record a duration per request, then break the request into steps and record ' +
         'those too. Optimising the query would have gained nothing.'
    }},

    { h: 'Documentation you did not write' },
    { p: 'FastAPI turns your models and routes into an **OpenAPI** document: a machine readable description of every ' +
         'endpoint, which is what tools use to generate client libraries and browsable docs. The real output of this ' +
         'service:' },
    { code: 'paths: [\'/v1/transfers\', \'/v1/transfers/{transfer_id}\',\n        \'/v1/accounts/{name}/balance\', \'/v1/accounts/{name}/entries\']\n\nTransferRequest required: [\'from_account\', \'to_account\', \'amount_minor\', \'currency\']\namount_minor: {"type": "integer", "exclusiveMinimum": 0, "maximum": 1000000000}', lang: 'text' },
    { p: 'Two things follow. Your validation rules become public documentation for free, which is a real reason to express ' +
         'them in the model rather than in scattered `if` statements. And your error responses only appear in those docs if ' +
         'you declare them, which is why the build asks you to list the codes each endpoint can return.' },

    { h: 'Testing a service without running it' },
    { p: 'You do not need a running server to test an API. FastAPI\'s test client calls the application directly, in the ' +
         'same process, so a full test suite runs in seconds:' },
    { code: 'from fastapi.testclient import TestClient\nfrom app import app\n\nclient = TestClient(app)\n\ndef test_retry_returns_the_same_transfer():\n    body = {"from_account": "C1", "to_account": "C2", "amount_minor": 2500, "currency": "USD"}\n    headers = {"Authorization": "Bearer fq_test_demo", "Idempotency-Key": "k-1"}\n\n    first = client.post("/v1/transfers", json=body, headers=headers)\n    again = client.post("/v1/transfers", json=body, headers=headers)\n\n    assert first.status_code == 201\n    assert again.status_code == 200\n    assert again.json()["id"] == first.json()["id"]', lang: 'python' },
    { p: 'The tests worth writing are the ones this level is about: every status code your API can return, the three ' +
         'idempotency cases, an unauthenticated call, a validation failure, and one test that walks two pages with a cursor ' +
         'and checks no row appears twice.' }
  ],

  tutorial: {
    intro: 'This builds on the level 6 database: same tables, same migrations, one new column pair for idempotency. Python ' +
           '3.11 or newer, the moneykit library from level 5, and a Postgres you can reach. Work in a new repository, ' +
           '`payments-api`, and keep the database URL in an environment variable.',
    steps: [
      {
        t: 'Scaffold the service',
        blocks: [
          { code: 'mkdir payments-api && cd payments-api\npython -m venv .venv && source .venv/bin/activate     # or .venv\\Scripts\\activate\npip install "fastapi[standard]" psycopg[binary] pytest httpx\n\nexport DATABASE_URL="postgresql://..."      # never in a file you commit', lang: 'bash' },
          { code: 'from fastapi import FastAPI\n\napp = FastAPI(title="FinQuest payments", version="1.0.0")\n\n@app.get("/health")\ndef health():\n    return {"status": "ok"}', lang: 'python', label: 'app.py' },
          { code: 'fastapi dev app.py\n# then open http://127.0.0.1:8000/docs', lang: 'bash' },
          { p: 'That `/docs` page is generated from your code. Keep it open while you work: it is the fastest way to see ' +
               'what your API looks like from outside.' }
        ],
        check: 'GET /health returns {"status": "ok"} and /docs lists it.'
      },
      {
        t: 'Two tables columns and the models',
        blocks: [
          { p: 'Add one migration to the level 6 database. The API needs somewhere to remember what it answered:' },
          { code: 'alter table transactions add column if not exists request_fingerprint text;\nalter table transactions add column if not exists response_json jsonb;', lang: 'sql' },
          { p: 'Then write the request and response models with pydantic, exactly as in the knowledge section. Give every ' +
               'field a minimum, a maximum, or both. Run the service and post a negative amount to see the 422 for yourself.' }
        ],
        check: 'A negative amount is refused with 422 and a body naming the field, before your code runs.'
      },
      {
        t: 'The write path',
        blocks: [
          { p: 'One endpoint, in this order: authenticate, require the idempotency key, look the key up, check the accounts ' +
               'exist, check the balance, write both entries inside one database transaction, save the response, return 201.' },
          { code: 'with connect() as conn, conn.cursor() as cur:\n    cur.execute("select id, request_fingerprint, response_json from transactions where idempotency_key = %s", (key,))\n    seen = cur.fetchone()\n    if seen:\n        txn_id, saved_fingerprint, saved_response = seen\n        if saved_fingerprint != fingerprint:\n            return problem(409, "idempotency_key_reused", ...)\n        return JSONResponse(status_code=200, content=saved_response,\n                            headers={"Idempotent-Replay": "true"})\n    ...\n    conn.commit()', lang: 'python' },
          { warn: 'Order matters. Authenticate before you touch the database, so an unauthenticated flood costs you almost ' +
                  'nothing: measured, 6.1 ms against 200 ms or more once a connection is involved.' }
        ],
        check: 'A first transfer returns 201, the same request again returns 200 with the same id, and a different body under that key returns 409.'
      },
      {
        t: 'One error shape, everywhere',
        blocks: [
          { p: 'Write the `problem()` helper, then add exception handlers so the framework\'s own errors come back in the ' +
               'same shape. Otherwise your API speaks two error languages, as the knowledge section showed.' },
          { code: 'from fastapi.exceptions import RequestValidationError\nfrom starlette.exceptions import HTTPException as StarletteHTTPException\n\n@app.exception_handler(RequestValidationError)\nasync def validation_handler(request, exc):\n    return problem(422, "invalid_request",\n                   "; ".join(f"{e[\'loc\'][-1]}: {e[\'msg\']}" for e in exc.errors()),\n                   request.state.request_id)\n\n@app.exception_handler(StarletteHTTPException)\nasync def http_handler(request, exc):\n    return problem(exc.status_code, str(exc.detail), str(exc.detail), request.state.request_id)', lang: 'python' },
          { p: 'Then write down, in the README, every `code` string your API can return. That list is part of your contract, ' +
               'and callers will branch on it.' }
        ],
        check: 'Every failing request, including a validation failure and a missing key, returns a body with error.code, error.message and error.request_id.'
      },
      {
        t: 'The request id middleware',
        blocks: [
          { code: '@app.middleware("http")\nasync def request_id_middleware(request, call_next):\n    request_id = request.headers.get("x-request-id") or f"req_{uuid.uuid4().hex[:12]}"\n    request.state.request_id = request_id\n    started = time.perf_counter()\n    response = await call_next(request)\n    response.headers["X-Request-Id"] = request_id\n    response.headers["X-Duration-Ms"] = f"{(time.perf_counter() - started) * 1000:.1f}"\n    return response', lang: 'python' },
          { p: 'Accept an inbound `X-Request-Id` if the caller sent one. That is how a request keeps one id across several ' +
               'services, which is the thing that makes a multi service investigation possible at all.' }
        ],
        check: 'Every response, success or failure, carries X-Request-Id and X-Duration-Ms.'
      },
      {
        t: 'Authentication',
        blocks: [
          { p: 'Store `sha256(key)`, never the key. Show the key once when it is created and never again, which is exactly ' +
               'what every payments provider does to you.' },
          { code: 'def authenticate(authorization: Annotated[str | None, Header()] = None) -> str:\n    if not authorization or not authorization.startswith("Bearer "):\n        raise HTTPException(status_code=401, detail="missing_api_key")\n    digest = sha256(authorization.removeprefix("Bearer ").encode()).hexdigest()\n    if digest not in API_KEYS:\n        raise HTTPException(status_code=401, detail="invalid_api_key")\n    return API_KEYS[digest]', lang: 'python' },
          { p: 'Declaring it as a dependency, `merchant: Annotated[str, Depends(authenticate)]`, means every endpoint that ' +
               'wants it says so in its signature, and the one that forgets is visible in review.' }
        ],
        check: 'A request with no key gets 401 in single figure milliseconds, and never reaches the database.'
      },
      {
        t: 'Cursor pagination',
        blocks: [
          { code: '@app.get("/v1/accounts/{name}/entries")\ndef list_entries(name: str, limit: int = 20, cursor: int | None = None):\n    limit = min(max(limit, 1), 100)              # never trust a limit from outside\n    rows = fetch(name, after=cursor, count=limit + 1)     # one extra row\n    has_more = len(rows) > limit\n    rows = rows[:limit]\n    return {"data": rows, "has_more": has_more,\n            "next_cursor": rows[-1]["id"] if rows and has_more else None}', lang: 'python' },
          { p: 'Then prove the difference for yourself: run both queries from the knowledge section against your seeded ' +
               'table with EXPLAIN ANALYZE, and put the two plans in your README.' },
          { warn: 'Cap the limit. Without `min(limit, 100)` a caller can ask for a million rows and take your service down ' +
                  'without trying, which is a denial of service you wrote yourself.' }
        ],
        check: 'Two pages walked with the cursor return six different rows, and offset is measurably slower on a deep page.'
      },
      {
        t: 'Tests, then the README',
        blocks: [
          { p: 'Write the suite with `TestClient`, no server running. Cover every status code, all three idempotency cases, ' +
               'authentication, validation, and a two page cursor walk.' },
          { code: 'pytest -q\n.........                                                          [100%]\n9 passed in 2.31s', lang: 'text' },
          { p: 'Finish the README with: the endpoint table, every error code, a `curl` example that works, the two ' +
               'pagination plans, and the connection measurement with your own numbers. A reviewer should be able to call ' +
               'your API from the README alone.' },
          { tip: 'Record one `curl` session end to end, including a retry with the same idempotency key, and paste it in. ' +
                 'It is the fastest possible proof that the thing works.' }
        ],
        check: 'The suite passes in seconds, and somebody else can call your API using only the README.'
      }
    ]
  },

  glossary: [
    { t: 'Endpoint', d: 'One method and path your API answers, such as POST /v1/transfers.' },
    { t: 'Header', d: 'A labelled line of information about the request: who is calling, what format, which retry.' },
    { t: 'Body', d: 'The data of the request, in JSON.' },
    { t: 'Status code', d: 'The three digit number saying how a request went. 4xx is the caller, 5xx is you.' },
    { t: 'Contract', d: 'Everything about your API that callers depend on. Adding is safe, removing and renaming are not.' },
    { t: 'FastAPI', d: 'The Python framework used here: routes, validation, dependencies and generated docs.' },
    { t: 'pydantic', d: 'The validation library behind FastAPI. A class becomes a set of rules for incoming data.' },
    { t: 'Validation error', d: 'A 422 listing each field that failed, what rule it broke, and what was sent.' },
    { t: 'Error code', d: 'A short fixed string such as insufficient_funds that a program can branch on.' },
    { t: 'Idempotency key', d: 'A header the caller invents once per intended payment and repeats on every attempt.' },
    { t: 'Fingerprint', d: 'A hash of the request body, stored with the key, so a retry can be told from a different request.' },
    { t: 'API key', d: 'A caller\'s secret, sent as a bearer token. Stored only as a hash.' },
    { t: 'Offset pagination', d: 'Skip N rows and take a page. Slows down the deeper you page, and shifts when rows are inserted.' },
    { t: 'Cursor pagination', d: 'Give me rows after this id. Same cost on every page, and cannot drift.' },
    { t: 'Request id', d: 'An id on every request and response, logged everywhere, so one search finds one request.' },
    { t: 'Middleware', d: 'Code that runs around every request, for things like request ids and timing.' },
    { t: 'Dependency', d: 'A function FastAPI runs before your endpoint, such as authentication, declared in the signature.' },
    { t: 'Connection pool', d: 'A set of open database connections handed out to requests, so the handshake happens once.' },
    { t: 'OpenAPI', d: 'The machine readable description of your API that FastAPI generates from your code.' },
    { t: 'TestClient', d: 'Calls your application in the same process, so the whole suite runs without a server.' }
  ],

  quiz: [
    { q: "Where does an idempotency key belong in an HTTP request?",
      options: [
        "In a header, because it describes the request rather than being data",
        "In the URL path",
        "In the JSON body, next to the amount",
        "In a cookie"
      ],
      answer: 0,
      why: "Data goes in the body, everything about the request goes in a header. The same rule puts the API key in a header." },

    { q: "A retry arrives with the same idempotency key and the same body. Your API should return:",
      options: [
        "201 and a second transfer",
        "500, so the caller stops",
        "200 and the saved response from the first attempt",
        "409, because the key was used"
      ],
      answer: 2,
      why: "Same key, same body is a retry. Return exactly what you returned the first time, down to the id and timestamp." },

    { q: "The same idempotency key arrives with a different body. That means:",
      options: [
        "The caller has a bug, and 409 tells them early",
        "The key expired",
        "The first request must be replaced",
        "Both should be processed"
      ],
      answer: 0,
      why: "Silently returning the old response hides their bug until the end of the month, when the records do not match." },

    { q: "Why store a fingerprint of the request body next to the key?",
      options: [
        "To detect tampering in transit",
        "To allow the response to be regenerated",
        "Because it is the only way to tell a retry from a different request sent under the same key",
        "To save space"
      ],
      answer: 2,
      why: "The key alone cannot distinguish the second case from the third." },

    { q: "An account has $5.00 and a transfer of $10,000 arrives. The right status is:",
      options: [
        "400, because the request was wrong",
        "422, with a stable code such as insufficient_funds",
        "404, because the money is not there",
        "500, because the transfer failed"
      ],
      answer: 1,
      why: "The request was well formed; the state refuses it. 500 would make well behaved callers retry forever." },

    { q: "Why does an error need a `code` field as well as a `message`?",
      options: [
        "Because a program can branch on a code and cannot branch on a sentence that may be reworded",
        "Because HTTP requires it",
        "For translation into other languages",
        "To keep responses small"
      ],
      answer: 0,
      why: "Codes are part of your contract. Messages are for the human reading the logs afterwards." },

    { q: "Your handwritten errors use `{\"error\": {...}}` and the framework's use `{\"detail\": ...}`. Why does that matter?",
      options: [
        "The framework shape is faster to parse",
        "Callers have to handle two shapes from one API and will get it wrong, so exception handlers should rewrite the framework errors into your shape",
        "It does not: both are JSON",
        "It only affects the generated docs"
      ],
      answer: 1,
      why: "One API, one error shape. This is exactly the kind of thing found by running your own service rather than reading about it." },

    { q: "Validation with pydantic happens:",
      options: [
        "Before your endpoint code runs, returning 422 with the field, the rule and the value sent",
        "Only when you call a validate() function",
        "In the database",
        "After your endpoint code runs"
      ],
      answer: 0,
      why: "Bad input never reaches your logic, and the caller gets every problem at once rather than one per round trip." },

    { q: "Why cap an amount field with a maximum as well as a minimum?",
      options: [
        "Databases cannot store large integers",
        "To make the OpenAPI document smaller",
        "Because a test script with one extra zero should be refused rather than executed",
        "Because HTTP limits number size"
      ],
      answer: 2,
      why: "Every amount field in a payments API has an upper bound that somebody chose deliberately." },

    { q: "Why store `sha256(api_key)` rather than the key?",
      options: [
        "To support key rotation",
        "Hashes are faster to compare",
        "Because keys are too long to store",
        "So a stolen copy of your key table contains no working keys, while you can still check every request"
      ],
      answer: 3,
      why: "You hash what arrives and compare hashes. The original is never needed again." },

    { q: "Measured on 400,000 rows, `offset 300000 limit 20` read 300,020 rows in 63 ms and a cursor read 20 rows in 1.4 ms. The structural problem with offset is:",
      options: [
        "It cannot be used with an index",
        "Cost grows with the page number, and inserts shift every later page",
        "It always returns rows in the wrong order",
        "It cannot express a page size"
      ],
      answer: 1,
      why: "A cursor costs the same on page 1 and page 10,000, and is anchored to a real row so it cannot drift." },

    { q: "How do you know whether there is another page, without a second count query?",
      options: [
        "Run count(*) with the same filter",
        "Compare the page size to the table size",
        "Ask for one more row than the page size, and drop it before answering",
        "Return has_more: true always"
      ],
      answer: 2,
      why: "One extra row answers the question exactly, at no meaningful cost." },

    { q: "What is the point of returning a request id on every response?",
      options: [
        "It identifies the customer",
        "It is required by the HTTP specification",
        "It makes responses cacheable",
        "A partner can quote it and you find the exact request in one search instead of an afternoon"
      ],
      answer: 3,
      why: "Log it on every line about that request, and accept an inbound one so an id survives across services." },

    { q: "Validation fails in 4.3 ms and anything touching the database takes 200 ms or more, while the SQL itself runs in under a millisecond. The time is going into:",
      options: [
        "The web framework",
        "Opening a new database connection per request: measured 202.7 ms median against 62.3 ms on a connection already open",
        "JSON parsing",
        "Writing the response"
      ],
      answer: 1,
      why: "A connection pool removes the handshake from every request. Optimising the query would have gained nothing." },

    { q: "What does FastAPI's TestClient give you?",
      options: [
        "Automatic test generation from OpenAPI",
        "A mock database",
        "A load testing tool",
        "It calls your application in the same process, so the whole suite runs in seconds with no server"
      ],
      answer: 3,
      why: "No ports, no startup, no flakiness. Every status code your API can return becomes a fast test." }
  ],

  project: {
    title: 'payments-api: the interface other companies call',
    story: 'Put an HTTP API in front of the level 6 ledger, good enough that another team could integrate against it ' +
           'without asking you a question. Three status codes are easy. The work is in the retries, the error shape, the ' +
           'pagination, and the README that makes it usable.',
    scope: 'Uses levels 4, 5 and 6. FastAPI, psycopg, pytest. The moneykit library from level 5 handles amounts. No ' +
           'message queue and no cache yet: those are levels 11 and 14.',
    dataset: '{{RAW}}/data/level-03-transactions.csv',
    requirements: [
      'A versioned API under `/v1` with transfers, one transfer by id, a balance, and a paginated entries list',
      'pydantic models for every request and response, with a minimum and a maximum on every numeric field',
      'Bearer API key authentication, keys stored only as sha256 hashes, checked before any database work',
      'An `Idempotency-Key` header required on every write, returning 400 when it is missing',
      'All three idempotency cases: 201 for new, 200 with the saved response for a retry, 409 when the same key arrives with a different body',
      'The response of a successful write saved, so a replay returns exactly what the first attempt returned',
      'One error shape across the whole API, with exception handlers rewriting the framework\'s errors into it',
      'A documented list of every error code your API can return, in the README',
      'A request id on every response, accepted from the caller if supplied, and logged on every line about that request',
      'Cursor pagination with a capped limit, `has_more`, and `next_cursor`, implemented with the one extra row trick',
      'Both pagination plans measured with EXPLAIN ANALYZE and pasted into the README',
      'A measurement of connect-per-request against a reused connection, with your own numbers',
      'Tests with TestClient covering every status code, all three idempotency cases, authentication, validation and a two page cursor walk',
      'A README with the endpoint table, the error codes, a working curl session including a retry, and the measurements',
      'The repository public on GitHub as `payments-api`'
    ],
    starter: {
      lang: 'python',
      code: '"""FinQuest level 7: the payments API.\n\nLayout:\n  app/main.py          routes and the FastAPI app\n  app/models.py        pydantic request and response models\n  app/errors.py        problem() and the exception handlers\n  app/auth.py          hashed API keys\n  app/db.py            connections, and later a pool\n  app/transfers.py     the write path, including idempotency\n  tests/               TestClient tests: one per status code\n"""\n\nfrom typing import Annotated\n\nfrom fastapi import Depends, FastAPI, Header, Request\nfrom fastapi.responses import JSONResponse\nfrom pydantic import BaseModel, Field\n\napp = FastAPI(title="payments", version="1.0.0")\n\n\nclass TransferRequest(BaseModel):\n    from_account: str = Field(min_length=1, max_length=64)\n    to_account: str = Field(min_length=1, max_length=64)\n    amount_minor: int = Field(gt=0, le=10_000_000_00)\n    currency: str = Field(min_length=3, max_length=3)\n    memo: str = Field(default="", max_length=140)\n\n\ndef problem(status: int, code: str, message: str, request_id: str) -> JSONResponse:\n    """The one error shape this API speaks."""\n    # TODO\n    raise NotImplementedError\n\n\n@app.post("/v1/transfers", status_code=201)\ndef create_transfer(\n    body: TransferRequest,\n    request: Request,\n    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,\n):\n    """New key: do the work. Same key and body: replay. Same key, other body: 409."""\n    # TODO\n    raise NotImplementedError\n'
    },
    tests: [
      'POST with a new key returns 201 and a transfer with an id',
      'The identical request with the same key returns 200, the same id, and an Idempotent-Replay header',
      'The same key with a different amount returns 409 and code idempotency_key_reused',
      'A write with no Idempotency-Key returns 400 and code idempotency_key_required',
      'No Authorization header returns 401 without touching the database',
      'A negative amount returns 422 naming the field, in your error shape rather than the framework default',
      'An unknown account returns 404 and code account_not_found',
      'A transfer larger than the balance returns 422 and code insufficient_funds, and writes nothing',
      'Every response carries X-Request-Id, and a supplied X-Request-Id is echoed back',
      'Two pages walked with next_cursor return no row twice, and the last page reports has_more false',
      'A limit of 10,000 is capped rather than obeyed',
      'After a failed write, the balance is unchanged and no entries were created'
    ],
    rubric: [
      { pts: 25, t: 'Idempotency done properly', d: 'All three cases, the saved response replayed exactly, and the key required rather than optional.' },
      { pts: 20, t: 'One contract, one error shape', d: 'Versioned paths, stable error codes, framework errors rewritten, every code documented.' },
      { pts: 20, t: 'Validation and auth at the edge', d: 'Bounds on every field, hashed keys, authentication before any database work.' },
      { pts: 20, t: 'Pagination that scales', d: 'Cursor paging with a capped limit, the two plans measured and explained.' },
      { pts: 15, t: 'Usable by a stranger', d: 'Tests for every status code, a curl session in the README, and the latency measurement with your own numbers.' }
    ],
    stretch: [
      'Add a connection pool and measure the p50 and p99 before and after, on the same hardware',
      'Add `POST /v1/transfers/{id}/reverse` with a state machine that refuses a second reversal with 409',
      'Add rate limiting per API key, returning 429 with a Retry-After header',
      'Generate a client library from your OpenAPI document and call your own API with it',
      'Add a `GET /v1/transfers?created_after=&cursor=` listing with a compound cursor over (created_at, id), and explain why the id is needed'
    ],
    solutionPath: 'solutions/level-07'
  },

  faq: [
    { q: 'Flask or FastAPI?',
      a: 'FastAPI here, because validation and generated documentation come free and the type hints from level 5 do real work. Flask is common in older codebases and the ideas in this level carry across unchanged.' },
    { q: 'Should the API return money as a decimal string?',
      a: 'No. Integers of minor units on the wire, exactly as level 5 stores them, plus the currency code. A string invites callers to parse it as a float in a language you do not control.' },
    { q: 'Why 422 and not 400 for insufficient funds?',
      a: 'The request was well formed, so it is not a 400, and nothing broke, so it is not a 500. Some APIs use 402 Payment Required for this. Pick one, document it, and never change it.' },
    { q: 'How long should an idempotency key be remembered?',
      a: 'Long enough to outlive any retry: 24 hours is common, and payment providers publish theirs. Keep the key with the transaction and expire the saved responses on a schedule, not by deleting transactions.' },
    { q: 'My replay returns a different timestamp',
      a: 'You are rebuilding the response instead of returning the saved one. Save the exact JSON you sent the first time and return that.' },
    { q: 'Do I need async?',
      a: 'Not for this level. Plain functions are easier to get right and the bottleneck here is the database connection, not concurrency. Level 8 measures where async and a pool actually help.' },
    { q: 'What do I say about this project in an interview?',
      a: 'The three idempotency cases, with the 409 and why it exists, then the pagination numbers: 300,020 rows read to return 20 with offset against 20 with a cursor. Both are things most candidates have only read about.' }
  ]
});
