# Accounts: Google sign in and a Neon database

FinQuest gates the course behind a sign in. Google says who the person is, Neon
stores the account and their progress, and a signed cookie keeps them in for
thirty days. No passwords are involved at any point, which is the main reason
for doing it this way: a database we cannot leak a password from is a database
we do not have to defend one in.

Everything below is free and needs no card.

## 1. A Neon database, about three minutes

1. Sign up at [neon.tech](https://neon.tech) and create a project. Any region
   near your members is fine.
2. Copy the connection string. It looks like
   `postgresql://user:password@ep-something.aws.neon.tech/neondb?sslmode=require`.
3. Open the Neon SQL editor, paste the contents of [`sql/schema.sql`](../sql/schema.sql)
   and run it. That creates the `users` and `progress` tables.

The connection string is a password. It goes into Vercel's environment
variables and nowhere else: never into the repository, never into a message.

## 2. A Google sign in client, about five minutes

1. Open [console.cloud.google.com](https://console.cloud.google.com) and create
   a project (call it FinQuest).
2. **APIs and services → OAuth consent screen**: choose External, fill in the app
   name, your email, and save. While it is in testing, only accounts you add as
   test users can sign in, so publish it when you are ready for the society.
3. **APIs and services → Credentials → Create credentials → OAuth client ID**,
   type **Web application**.
4. Under **Authorised JavaScript origins**, add every address the site runs on:
   - `https://finquest-rank-nullity.vercel.app`
   - `http://localhost:8010` for local work
   Add your custom domain here too if you attach one later.
5. Copy the **client ID**. It ends in `.apps.googleusercontent.com`.

You never need the client secret for this setup, because the browser asks Google
for an ID token rather than running an OAuth redirect.

## 3. Wire it up

The client ID is public, so it lives in the repository:

```js
// assets/js/config.js
auth: {
  googleClientId: '1234567890-abc123.apps.googleusercontent.com'
}
```

The three secrets live in Vercel, under **Settings → Environment Variables**, set
for Production (and Preview if you use it):

| Variable | Value |
|---|---|
| `DATABASE_URL` | the Neon connection string from step 1 |
| `GOOGLE_CLIENT_ID` | the same client ID as above, so the server can check tokens were minted for this site |
| `SESSION_SECRET` | 32 or more random characters, for signing session cookies |

Generate the session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Redeploy after adding them. Environment variables are read at request time, but
a deployment made before they existed will not have them.

## If the tutor answers offline on a deployment that has a key

Check `/api/health` first: `ANTHROPIC_API_KEY` shows there. If it is present and
Mou still falls back, the key may be an organization key rather than one created
inside a workspace. The API rejects those with a 400 that says so:

> This API key is not scoped to a workspace, so this request must include the
> anthropic-workspace-id header.

Two ways out, either is fine:

- create a new key inside a workspace in the Console and replace
  `ANTHROPIC_API_KEY`, or
- set `ANTHROPIC_WORKSPACE_ID` to the workspace id and keep the key you have.

The reason never reaches the browser on purpose, so read it in the function log:
`vercel logs <deployment-url>`.

## How it fits together

```
browser                          your functions                Google / Neon
  |  Google button               |                             |
  |----- ID token -------------->| /api/auth/google            |
  |                              |--- verify signature, --------> Google keys
  |                              |    audience, expiry         |
  |                              |--- upsert user -------------> Neon
  |<---- session cookie ---------|                             |
  |                              |                             |
  |----- GET /api/progress ----->| reads user from the cookie   |
  |<---- saved state ------------|<--- select ----------------- Neon
  |----- PUT /api/progress ----->|---- upsert ----------------> Neon
```

The user id always comes from the signed cookie, never from the request body, so
one account cannot read or overwrite another's progress by asking for it.

## What is stored

`users`: Google's account id, email, name, avatar URL, first and last seen.
`progress`: one JSON document per learner, the same shape the browser keeps in
`localStorage`: experience, badges, best drill scores, attempts, and which
requirements are ticked. Nothing else, and nothing from the AI tutor.

## Working offline

With no `DATABASE_URL` or client ID set, the sign in screen says so plainly
instead of locking everyone out, and `python serve.py` still serves the course
for editing. Progress then lives in `localStorage` only, as it did before.

## If sign in fails

- **"That Google sign in could not be verified"**: `GOOGLE_CLIENT_ID` on the
  server does not match the one in `config.js`.
- **The Google button does not appear**: the site's address is not in
  Authorised JavaScript origins. The browser console names the origin it tried.
- **"Sessions are not configured"**: `SESSION_SECRET` is missing or shorter than
  32 characters.
- **"Could not reach the progress database"**: check `DATABASE_URL`, and that
  the schema ran.
