/* =========================================================================
   LEVEL 17: the deploy you can undo
   ========================================================================= */
FQ.registerLevel({
  id: 17,
  codename: 'ship',
  title: 'The deploy you can undo',
  tagline: 'Everything you have built runs on your laptop. This level is the part where it runs somewhere else, on a schedule, behind a pipeline, with a way back when it goes wrong.',
  difficulty: 8,
  minutes: 420,
  tags: ['Docker', 'CI/CD', 'infrastructure as code', 'deploys', 'cost'],
  summary: 'The last level of the production phase, and the one that turns twelve repositories into something a company ' +
           'would run. A container that holds only what runs, a pipeline fast enough that nobody bypasses it, ' +
           'infrastructure written down rather than clicked, a deploy strategy with a measured way back, feature flags ' +
           'so releasing is not deploying, and a cost model so you know what your design charges per payment.',

  objectives: [
    'Build an image that contains what runs and nothing else',
    'Order a Dockerfile so the cache does the work',
    'Write a merge gate fast enough that people wait for it',
    'Describe infrastructure in code, and explain what drift is',
    'Choose a deploy strategy by how long a rollback takes',
    'Separate deploying from releasing with feature flags',
    'Put a cost per payment on your own architecture'
  ],

  knowledge: [
    { h: 'What "works on my machine" actually means' },
    { p: 'Four things differ between your laptop and a server, and naming them tells you what a container does and does ' +
         'not fix:' },
    { table: {
      head: ['What differs', 'Fixed by the image?', 'Notes'],
      rows: [
        ['System libraries', 'Yes', 'The whole reason images exist'],
        ['Language runtime version', 'Yes', 'Pin it exactly. `python:3.12-slim`, never `python:3`'],
        ['Dependency versions', 'Yes, if you build from a lockfile', 'Level 15: build from the lock, not from the index'],
        ['Configuration and secrets', '**No**', 'They arrive at run time, and this is where the outages come from']
      ]
    }},
    { p: 'That last row is the one to design for. The same image must run in test and in production with nothing changed ' +
         'except environment variables, and the application should **read its whole configuration at start and refuse to ' +
         'boot if anything is missing or nonsensical**. A service that starts happily and fails on the first payment ' +
         'because a variable was empty has turned a deploy problem into a customer problem.' },
    { code: 'class Settings(BaseSettings):\n    database_url: PostgresDsn\n    redis_url: RedisDsn\n    vault_url: HttpUrl\n    payout_limit_minor: int = Field(gt=0)\n    environment: Literal["dev", "staging", "prod"]\n\nsettings = Settings()      # raises at import, before the first request', lang: 'python' },

    { h: 'The image: ship what runs, not what built it' },
    { p: 'An image is layers, and everything you install stays in it forever, even if a later layer deletes it. The ' +
         'commonest mistake is shipping the toolchain that built the application. Measured on the dependency tree of a ' +
         'payments service, which is where an image\'s weight comes from:' },
    { table: {
      head: ['Contents', 'Size', 'Files'],
      rows: [
        ['An empty virtual environment', '22.4 MB', '1,497'],
        ['+ what the service needs to run', '60.8 MB', '3,424'],
        ['+ the tools that test and lint it', '154.7 MB', '6,873'],
        ['**Shipped for no reason**', '**94.0 MB**', '**3,449**']
      ]
    }},
    { p: 'The test framework, the type checker, the linter, the formatter and the coverage tool add 94.0 MB and 3,449 files, which is **155% more than the service needs to run**. None of it executes in production, all of it is code an attacker can reach, and every byte is pulled down again on every machine that runs the image. It is in there because one `pip install -r requirements.txt` was easier to write than two.' },
    { p: 'The fix is a **multi stage build**: one stage installs everything and runs the tests, a second stage starts ' +
         'from a clean base and copies in only the installed runtime dependencies and your code.' },
    { code: 'FROM python:3.12-slim AS build\nCOPY requirements.lock .\nRUN pip install --no-cache-dir -r requirements.lock --target /deps\n\nFROM python:3.12-slim              # a fresh base: the build stage is discarded\nCOPY --from=build /deps /usr/local/lib/python3.12/site-packages\nCOPY src/ /app/src/\nUSER 10001                         # never root\nHEALTHCHECK CMD python -c "import urllib.request;urllib.request.urlopen(\'http://localhost:8000/healthz\')"\nCMD ["uvicorn", "src.main:app", "--host", "0.0.0.0"]', lang: 'docker' },
    { ul: [
      '**Order layers by how often they change.** Dependencies change monthly, your code changes hourly, so copy and install dependencies first and your source last. Reverse that and every one line change reinstalls everything.',
      '**Never run as root.** One line, and it converts a remote code execution into a much smaller problem.',
      '**Pin the base image,** ideally by digest. `python:3.12-slim` moves under you; a digest does not.',
      '**A health check that actually checks,** rather than one that returns 200 because the process is alive. Level 16 called this the difference between liveness and readiness.'
    ]},
    { p: 'One more number from the same install: those runtime dependencies took **29.7 seconds** to install. A ' +
         'Dockerfile that copies your source before installing them pays that 29.7 seconds on every one line ' +
         'change you make, for the rest of the project. A correctly ordered one pays it when the lockfile ' +
         'changes, which is roughly monthly.' },

    { h: 'A pipeline nobody bypasses' },
    { p: 'The merge gate is the only thing standing between a bad change and production, and its worst property is being ' +
         'slow, because a slow gate gets skipped "just this once". Here is this course\'s own gate, measured step by ' +
         'step:' },
    { table: {
      head: ['Step', 'Time'],
      rows: [
        ['Syntax check, 20 files, one process each', '**9.63 s**'],
        ['Every string renders as written', '0.67 s'],
        ['Answer key distribution', '0.53 s'],
        ['Writing style scan', '3.88 s'],
        ['Rebuild the quiz keys', '0.60 s'],
        ['Rebuild the solution readmes', '0.66 s'],
        ['**Total**', '**15.97 s**']
      ]
    }},
    { p: 'The first row is 60% of the gate, and it is not doing 60% of the work. It starts a new Node process for each ' +
         'of twenty files, and process startup is most of the cost. Doing the identical check inside one process:' },
    { code: 'twenty processes, one file each   9.63 s\none process, twenty files         0.61 s      16x\n\ntotal gate                       15.97 s  ->  6.95 s', lang: 'text' },
    { p: 'Nothing was removed and nothing was made less strict. **The slow step was startup, not work**, and that is ' +
         'usually where pipeline time goes: cold caches, fresh containers, dependency installs, and processes started ' +
         'per item instead of per run. Time your own steps before optimising any of them, for exactly the reason level ' +
         '14 gave.' },
    { table: {
      head: ['A gate should', 'Because'],
      rows: [
        ['Run on every pull request, not on merge', 'Finding it after merge means the main branch is already broken'],
        ['Fail fast on the cheap checks', 'Lint and types in ten seconds, before a five minute test suite'],
        ['Be deterministic', 'A test that fails one time in twenty teaches everybody to press retry'],
        ['Build the artefact once', 'What you tested is what you deploy, rather than a rebuild that might differ'],
        ['Refuse to deploy an untested commit', 'The gate is only a gate if it cannot be walked around']
      ]
    }},
    { check: {
      q: 'Your pipeline takes 25 minutes and the team has started merging with the "administrator override" when they are ' +
         'in a hurry. A colleague proposes making the override require a manager. Is that the right fix?',
      a: 'No, and the override is a symptom rather than the disease. People are not overriding because approval is too ' +
         'easy, they are overriding because waiting 25 minutes for a one line change is unreasonable, and adding a ' +
         'manager makes the wait longer and the override harder to audit, because it moves into direct messages. The ' +
         'fix is the 25 minutes. Time every step, as above, and expect to find startup and cache misses rather than ' +
         'tests. Then split it: a fast gate of a few minutes that must pass to merge, covering lint, types and unit ' +
         'tests, and a slower suite that runs after merge and can block the deploy rather than the merge. If integration ' +
         'tests are the slow part, run them in parallel and against a container that starts once for the whole suite. ' +
         'When the gate is three minutes, nobody wants the override, and then you can remove it.'
    }},

    { h: 'Infrastructure you can read' },
    { p: 'Everything your service needs, written as files in the repository and applied by a machine: the database, the ' +
         'cache, the queue, the load balancer, the alarms, the permissions. **Terraform** is the common tool and the ' +
         'shape is the same in all of them:' },
    { code: 'resource "aws_db_instance" "ledger" {\n  identifier        = "ledger-${var.environment}"\n  engine            = "postgres"\n  engine_version    = "16.3"\n  instance_class    = var.db_size          # small in staging, large in prod\n  storage_encrypted = true\n  backup_retention_period = 30\n  deletion_protection     = var.environment == "prod"\n}', lang: 'text' },
    { ul: [
      '**`plan` before `apply`, always.** The plan is a diff of reality against your files, and reading it is the review.',
      '**State is a real thing you can lose.** Terraform records what it created in a state file: keep it remote, versioned and locked, and never edit it by hand.',
      '**Drift is what somebody changed in the console at 2am.** The next plan will offer to undo their fix, which is why emergency changes get written back into the code the next morning.',
      '**The same code builds every environment,** with variables for the differences. Staging that differs in shape from production tests nothing that matters.'
    ]},
    { warn: 'Never put a secret in a Terraform file or a variable default. It ends up in the state file, which is a ' +
            'plaintext copy of everything, sitting in a bucket. Reference a secret manager and let the resource read it ' +
            'at run time.' },

    { h: 'AWS: where each piece you built actually runs' },
    { p: 'Everything so far has run on your laptop. Here is the translation, because "experience with AWS" in a job ' +
         'description means knowing which managed service replaces which thing you wrote, and what it charges for:' },
    { table: {
      head: ['What you built', 'What runs it', 'The thing people get wrong'],
      rows: [
        ['The ledger, in Postgres', '**RDS**, or **Aurora** Postgres', 'Multi AZ is failover, not a read replica. They are separate features and separate bills'],
        ['The API container', '**ECS on Fargate**, or **EKS**', 'Fargate means no machines to patch. Start there unless somebody hands you a cluster'],
        ['The cache and the rate limiter', '**ElastiCache** for Redis', 'It is still memory. Level 14 applies: everything in it must be losable'],
        ['The event log', '**MSK** for Kafka, or **SQS** with **SNS**', 'SQS is a queue, not a log: you cannot replay it, which level 11 needed'],
        ['Settlement files', '**S3**', 'Turn on versioning. A file overwritten by a bad job is otherwise gone'],
        ['Secrets', '**Secrets Manager**, or Parameter Store', 'Parameter Store is cheaper and does less. Either is better than an environment variable you set by hand'],
        ['The master key from level 15', '**KMS**', 'Look at this one twice, below'],
        ['Metrics, logs and traces', '**CloudWatch**, or managed Prometheus and Grafana with **X-Ray**', 'CloudWatch Logs charges per gigabyte ingested. Level 16 measured why that matters'],
        ['The level 12 sweeper', '**EventBridge Scheduler** into a Lambda or an ECS task', 'A cron job on one instance is a single point of failure that nobody monitors'],
        ['Blue green traffic switching', 'An **ALB** with two target groups', 'The switch is a weighted routing change, which is also how you do canary']
      ]
    }},
    { p: 'The row worth stopping on is **KMS**. Level 15\'s envelope encryption is literally its interface rather than ' +
         'merely similar to it: `GenerateDataKey` hands you a plaintext data key and a wrapped copy, `Decrypt` ' +
         'unwraps it, and the master key never leaves the service. You built the thing by hand, so you can now read that ' +
         'documentation and know exactly what the 8 ms call is costing you.' },

    { h: 'IAM, in one page' },
    { p: 'Identity and access management is where cloud security actually happens, and it has three nouns. A ' +
         '**principal** is who is acting: a person, or a service. A **policy** is a document saying which actions are ' +
         'allowed on which resources. A **role** is a set of policies that something can assume temporarily.' },
    { p: 'The rule that matters more than all the others: **use roles, never long lived access keys.** A task role means ' +
         'your container receives short lived credentials automatically, rotated for you, with nothing to leak. An ' +
         'access key in an environment variable is a permanent credential in a format designed to be copied, and it is ' +
         'the single most common way cloud accounts are compromised.' },
    { code: '# the narrowest policy that works, rather than the one that stops the error\n{\n  "Effect": "Allow",\n  "Action": ["s3:GetObject"],\n  "Resource": "arn:aws:s3:::settlement-files/incoming/*"     # not the bucket, the prefix\n}\n{\n  "Effect": "Allow",\n  "Action": ["kms:Decrypt", "kms:GenerateDataKey"],\n  "Resource": "arn:aws:kms:eu-west-1:123456789012:key/abc-123"   # that key, not all keys\n}', lang: 'text' },
    { warn: 'The two mistakes, in order of frequency. `"Action": "*"` on `"Resource": "*"`, added at 6pm to make an error ' +
            'go away and never narrowed afterwards. And an access key committed, pasted into a notebook, or set in a ' +
            'shell profile. Start every policy from nothing, add the one action that failed, and read the error message ' +
            'rather than widening the wildcard.' },

    { h: 'The network, and the bill nobody expects' },
    { p: 'A **VPC** is your own private network. Inside it, **public subnets** can reach the internet and **private ' +
         'subnets** cannot, and a **security group** is a firewall attached to a resource rather than to a subnet.' },
    { p: 'For a payments platform the shape is fixed and you should be able to draw it: the load balancer sits in the ' +
         'public subnets, the service sits in private ones, and **the database has no public address at all**, with a ' +
         'security group that permits port 5432 from the service\'s security group and from nothing else. Not from an ' +
         'address range, from the other security group, so it keeps working when instances are replaced.' },
    { p: 'Then the cost surprise, which is worth knowing before you meet it. A private subnet that needs to reach the ' +
         'internet does so through a **NAT gateway**, which is charged per hour and per gigabyte, runs whether or not ' +
         'you use it, and is the line most often missing from a first cost model. Level 17\'s egress row was about this.' },
    { warn: 'Set a billing alarm before you create a single resource. An idle database, a forgotten NAT gateway and an ' +
            'orphaned load balancer cost the same whether or not anything is using them, and the classic first AWS bill ' +
            'is a few hundred dollars of resources nobody remembered creating.' },
    { tip: 'The cheap path for this level: one small RDS instance you stop when not using it, one Fargate task, one S3 ' +
           'bucket, and no NAT gateway (put the task in a public subnet with a security group, which is fine for a ' +
           'learning environment and which you should say out loud is not how you would run production). Everything ' +
           'else in this level runs locally.' },

    { h: 'Kubernetes, enough to read a manifest' },
    { p: 'You do not need Kubernetes for this platform, and being able to say why is worth more than using it. You do ' +
         'need to read a manifest without flinching, because Capital One, Adyen and most large payments teams run on ' +
         'it, and an interviewer will assume the vocabulary.' },
    { p: 'The whole object model, in the order things are built on each other:' },
    { code: 'your image\n  -> Pod          one or more containers scheduled together. The smallest unit\n  -> Deployment   how many pods, which image, how to roll a new one out\n  -> Service      a stable name and address for whichever pods exist\n  -> Ingress      how traffic from outside reaches a Service', lang: 'text' },
    { table: {
      head: ['Object', 'Is', 'What it replaces from earlier in this level'],
      rows: [
        ['**Deployment**', 'A desired number of pods running a given image', 'Your rolling deploy script'],
        ['**Service**', 'A stable address in front of pods that come and go', 'The load balancer target group'],
        ['**Ingress**', 'The route from outside the cluster to a Service', 'The load balancer itself'],
        ['**ConfigMap**', 'Configuration injected as environment variables or files', 'Your environment variables'],
        ['**Secret**', 'The same, for sensitive values', 'Nothing, and see the warning below'],
        ['**Probes**', '`livenessProbe` and `readinessProbe`', 'Exactly the two probes you already wrote'],
        ['**HorizontalPodAutoscaler**', 'More pods when a metric rises', 'The autoscaling in your cost model']
      ]
    }},
    { code: 'spec:\n  replicas: 3\n  strategy:\n    rollingUpdate:\n      maxSurge: 1          # one extra pod during the roll\n      maxUnavailable: 0    # never fewer than three serving\n  template:\n    spec:\n      containers:\n        - name: payments\n          image: registry/payments@sha256:...    # a digest, never a tag\n          readinessProbe:\n            httpGet: { path: /readyz, port: 8000 }', lang: 'text' },
    { p: 'Blue green and canary are done here with two Deployments and traffic shifted between them, which is the same ' +
         'idea you already built with two environments and a load balancer. Nothing conceptual is new; the objects are ' +
         'just named.' },
    { warn: 'A Kubernetes **Secret is base64 encoded, not encrypted**. Anyone who can read the object can read the ' +
            'value. Level 15 applies unchanged: real secrets come from a secret manager, injected at run time, and the ' +
            'Kubernetes object holds at most a reference.' },
    { p: 'The proportionate amount of this to do now: run a local cluster with `kind` or `k3d`, deploy one component of ' +
         'your platform to it, write the manifest yourself rather than copying one, and stop there. Operating a cluster ' +
         'is a job rather than a level, and the interview question is almost always "what are these objects and why" ' +
         'rather than "tune the scheduler".' },

    { h: 'Deploying, and the only question that matters' },
    { p: 'Four strategies. Choose by how long it takes to get back, because that is the number you will care about at ' +
         'the moment you need it:' },
    { table: {
      head: ['Strategy', 'How', 'Downtime', 'Rollback', 'Cost'],
      rows: [
        ['Recreate', 'Stop the old, start the new', 'Yes', 'Another full deploy', 'Cheapest'],
        ['Rolling', 'Replace instances a few at a time', 'None', 'Roll forward or back, minutes', 'Cheap'],
        ['**Blue green**', 'Run both, switch the load balancer', 'None', '**Switch back, seconds**', 'Double, briefly'],
        ['Canary', 'Send 1% of traffic to the new one, then more', 'None', 'Stop sending, seconds', 'Slightly more']
      ]
    }},
    { p: 'For money, blue green or canary. The reason is in the rollback column: when a deploy is losing payments, ' +
         '**seconds against minutes is the whole argument**, and the cost of running two versions for ten minutes is ' +
         'trivial next to the cost of a ten minute outage.' },
    { p: 'Canary needs the level 16 work to be real. You are comparing the new version\'s error rate and latency against ' +
         'the old one on live traffic, automatically, and rolling back when it is worse. Without per version metrics ' +
         'that comparison is somebody squinting at a dashboard.' },

    { h: 'The thing that makes rollback impossible' },
    { p: 'Code rolls back in seconds. Databases do not, and that is why deploys go badly. If version 2 renamed a column ' +
         'and you roll back to version 1, version 1 meets a schema it has never seen.' },
    { p: 'The answer is level 13\'s expand and contract, and now you can see why it was worth six deploys: **every ' +
         'intermediate state is one where both the old and the new code work.** The rule that follows is short enough to ' +
         'remember:' },
    { code: 'A migration and the code that needs it never deploy together.\n\n  deploy 1   migration only: add the new column, nullable. Old code fine.\n  deploy 2   code that writes both.\n  deploy 3   backfill, verify.\n  deploy 4   code that reads the new one. Rollback is one deploy back.\n  deploy 5   code stops writing the old one.\n  deploy 6   migration only: drop the old column, days later.', lang: 'text' },
    { tip: 'Write the rollback plan into the pull request, in one line, before merging. If the honest answer is "we ' +
           'cannot roll this back", that is worth knowing while the change can still be restructured.' },

    { h: 'Deploying is not releasing' },
    { p: 'A **feature flag** separates shipping code from turning it on. The code goes out dark, and a configuration ' +
         'change enables it: for you, then for one merchant, then for one percent, then everybody.' },
    { ul: [
      '**A kill switch for every risky path.** Turning a feature off is a configuration change taking seconds, where a rollback is a deploy taking minutes.',
      '**Flags are read at request time,** not at start, or turning one off means a restart and you have lost the point.',
      '**Default to off, and fail to off.** If the flag service is unreachable, the new path stays dark rather than everybody getting it at once.',
      '**Flags expire.** Every flag is a branch in your code and two paths to test. Put a removal date on it and delete it, or in a year you will have sixty flags and nobody willing to touch any of them.'
    ]},
    { p: 'For payments there is a second use that matters more than gradual rollout: **the switch you reach for during ' +
         'an incident.** Turn off the new fraud provider, stop the payout job, route everything to the old processor. ' +
         'Those are flags, decided in advance, and they are the difference between a five minute incident and an hour.' },

    { h: 'What your design costs per payment' },
    { p: 'Nobody asks a junior engineer what their architecture costs, and being able to answer is a way to sound like ' +
         'somebody who has run something. The arithmetic is not difficult; what is rare is doing it at all.' },
    { code: 'Assume 200 payments per second at peak, 50 average, so 130 million a month.\nUnit prices are illustrative: look up the real ones, the method is the point.\n\n  database  1 primary + 1 replica, 8 vCPU each, managed           =  $2,200\n  compute   6 instances x 2 vCPU x $0.04 per vCPU hour x 730 h    =    $350\n  logs      8 GB a day x 30 x $0.50 per GB ingested               =    $120\n  queue     394 M requests, three per payment                     =    $158\n  cache     2 nodes, small                                        =    $180\n  metrics   900 series                                            =    $270\n  traces    1% tail sampled                                       =     $26\n  egress    2 TB x $0.09 per GB                                   =    $184\n  ---------------------------------------------------------------------------\n  total                                                              $3,488\n  per payment                                                     $0.000027', lang: 'text' },
    { p: 'Four things fall out of that table. **The managed database is usually the biggest line**, and it is the one ' +
         'nobody questions. **Logs and metrics are a real line item**, which is why level 16 sampled them: unsampled, the ' +
         'logs line alone is fourteen times larger. **Egress is charged and ingress usually is not**, so moving data out ' +
         'of a region costs money nobody budgeted. And **most of the compute line is idle**: it is sized for 200 payments ' +
         'a second at peak while the average is 50, so three quarters of it is insurance against a spike.' },
    { money: 'Under three thousandths of a cent per payment sounds like nothing, and that is the point of computing it. Now ' +
             'compare it with your processing fee of roughly 2.9% plus 30 cents, and you can say exactly how much of ' +
             'your margin the infrastructure takes. An engineer who can hold both numbers at once is talking the same ' +
             'language as the person deciding the budget.' },
    { check: {
      q: 'Your finance team asks you to cut the cloud bill by 30%. The database is the biggest line and the compute ' +
         'line is mostly idle. What do you look at first, and what would you refuse to do?',
      a: 'Look first at the gap between peak and average, because that is where the waste is: sized for 200 a second ' +
         'while averaging 50 means most instances are idle most of the day, and autoscaling on a metric that reflects ' +
         'real load recovers a lot of it without touching reliability. Next, the things nobody has looked at since they ' +
         'were switched on: log retention and volume, metrics cardinality from level 16, snapshots and backups that ' +
         'accumulate, and environments that exist but are used one week in ten. Those are usually a quarter of a bill ' +
         'and cost nothing to change. What to refuse is anything that removes headroom you sized deliberately: running ' +
         'the database without a replica, dropping to one instance per zone, or turning off backups, because the saving ' +
         'is small and the failure mode is the entire business. Say that out loud with the numbers attached, because ' +
         '"no" with arithmetic is a different conversation from "no".'
    }},

    { h: 'The twelve repositories problem' },
    { p: 'You now have a dozen projects that each work alone. A company would have one deployable system, and the last ' +
         'job of this level is to notice what is missing between them: one place to find every service, one way to run ' +
         'them together locally, one pipeline shape, one logging format, one set of dashboards, and one document that ' +
         'says which service owns what.' },
    { p: 'That document is worth writing even for yourself. It is the first thing a new engineer reads, it is what an ' +
         'interviewer will ask you to draw, and it is the spine of the capstone in level 20.' }
  ],

  tutorial: {
    intro: 'Take the payments API, the vault and the observability work and make them deployable together. Everything ' +
           'here runs on free tiers or locally. Work in a repository called `payments-platform`.',
    steps: [
      {
        t: 'Containerise, then look at what you shipped',
        blocks: [
          { p: 'A single stage Dockerfile first, deliberately, so you can measure it. Then the multi stage version. ' +
               'Compare image sizes and write both numbers down.' },
          { code: 'docker build -t pay:naive -f Dockerfile.naive .\ndocker build -t pay:slim  -f Dockerfile .\ndocker images | grep pay', lang: 'bash' },
          { p: 'The dependency tree is where the weight is. Measured on a payments service: what it needs to run against ' +
               'what it needs to be built and tested is 60.8 MB against 154.7 MB.' }
        ],
        check: 'Your final image contains no test framework, no linter and no compiler, and you can prove it by running `pip list` inside it.'
      },
      {
        t: 'Make the cache do the work',
        blocks: [
          { p: 'Order the Dockerfile so dependencies install before your source is copied, then change one line of code ' +
               'and rebuild. Time both orders.' },
          { code: 'installing the runtime dependencies   29.7 s\n\nordered wrongly, you pay that on every code change\nordered rightly, you pay it when the lockfile changes', lang: 'text' },
          { tip: 'Also add a `.dockerignore`. Without one, your git history, virtual environment and test data are sent ' +
                 'to the build daemon on every build, which is usually the reason a build is slow before anything has ' +
                 'been compiled.' }
        ],
        check: 'Changing one line of application code rebuilds in seconds, not minutes.'
      },
      {
        t: 'Configuration that refuses to start',
        blocks: [
          { p: 'One settings object, validated at import, with no defaults for anything that matters. Then prove it: ' +
               'start the container with a missing variable and confirm it exits immediately with a message naming the ' +
               'variable.' },
          { warn: 'Secrets come from the environment or a secret manager, never from the image and never from a file in ' +
                  'the repository. Level 15 applies unchanged here.' }
        ],
        check: 'A missing or invalid variable stops the service at start, not at the first payment.'
      },
      {
        t: 'The gate',
        blocks: [
          { p: 'GitHub Actions: lint, types, unit tests, build the image once, then integration tests against that ' +
               'exact image. Then time every step and publish the table in your README.' },
          { code: 'twenty processes, one file each   9.63 s\none process, twenty files         0.61 s     16x\ntotal gate                       15.97 s -> 6.95 s', lang: 'text' },
          { p: 'Find your own version of that row. It is almost always a step that starts a process per file, or a cache ' +
               'that is not being restored.' }
        ],
        check: 'The gate runs on every pull request, takes under five minutes, and the artefact it built is the one that deploys.'
      },
      {
        t: 'Write the infrastructure down',
        blocks: [
          { p: 'Terraform for the database, the cache, the queue and the alarms, with remote state and a variable for ' +
               'environment size. Run `plan` against a live environment and read the diff: that is your first encounter ' +
               'with drift.' },
          { p: 'Then destroy and recreate staging from scratch, timed. If you cannot, something is not in the code, and ' +
               'finding out which thing is the exercise.' }
        ],
        check: 'Staging can be destroyed and rebuilt from the repository alone, and you know how long it takes.'
      },
      {
        t: 'Blue green, with a switch you have used',
        blocks: [
          { p: 'Two environments, one load balancer, a health check that fails when the service is genuinely not ready. ' +
               'Deploy a deliberately broken version to the idle side and confirm it never receives traffic.' },
          { p: 'Then time a rollback, honestly, from the decision to the first healthy response. That number belongs in ' +
               'your README and in your interview answer.' }
        ],
        check: 'You have rolled back a live deploy and know how many seconds it took.'
      },
      {
        t: 'Flags, and a migration that can go backwards',
        blocks: [
          { p: 'A flag service read at request time, defaulting to off, with a kill switch on the payout path. Then ' +
               'perform an expand and contract migration across several deploys, rolling back in the middle on purpose ' +
               'to prove the intermediate states are safe.' },
          { code: 'deploy 1   migration only, additive\ndeploy 2   write both        <- roll back to here and confirm nothing breaks\ndeploy 3   backfill and verify\ndeploy 4   read the new column', lang: 'text' }
        ],
        check: 'Rolling back from deploy 4 to deploy 2 loses no data and breaks nothing.'
      },
      {
        t: 'Cost the whole thing',
        blocks: [
          { p: 'Build the table for your own architecture, with real list prices you looked up and your own measured ' +
               'log and metric volumes from level 16. Compute cost per payment, and compare it with a 2.9% plus 30 cent ' +
               'fee.' },
          { p: 'Then find the two biggest lines and write one paragraph on how you would halve each, and what you would ' +
               'refuse to cut. That paragraph is the difference between an engineer and a senior one.' }
        ],
        check: 'You can state your cost per payment and defend the two lines you would cut first.'
      }
    ]
  },

  glossary: [
    { t: 'Image', d: 'A filesystem plus metadata that a container runs from. Built in layers, and layers are forever.' },
    { t: 'Multi stage build', d: 'Building in one stage and copying only the result into a clean final stage.' },
    { t: 'Layer cache', d: 'Reusing unchanged layers. The reason dependency installs go before copying source.' },
    { t: 'Lockfile', d: 'Exact pinned versions, so what you tested is what you deploy.' },
    { t: 'Liveness probe', d: 'Is the process alive? Failing it restarts the container.' },
    { t: 'Readiness probe', d: 'Should it receive traffic yet? Failing it removes it from the load balancer.' },
    { t: 'Merge gate', d: 'The checks that must pass before a change can merge.' },
    { t: 'Flaky test', d: 'One that fails intermittently. It teaches the team to press retry, which is the real damage.' },
    { t: 'Infrastructure as code', d: 'Resources described in files and applied by a machine.' },
    { t: 'State file', d: 'Terraform\'s record of what it created. Remote, versioned, locked, never hand edited.' },
    { t: 'Drift', d: 'Reality differing from the code, usually because somebody changed it by hand during an incident.' },
    { t: 'Blue green', d: 'Two environments and a switch, so rollback is the switch going back.' },
    { t: 'Canary', d: 'A small share of live traffic on the new version, compared automatically against the old.' },
    { t: 'Feature flag', d: 'A run time switch that separates deploying code from releasing behaviour.' },
    { t: 'Kill switch', d: 'A flag whose only job is turning something off quickly during an incident.' },
    { t: 'Egress', d: 'Data leaving the provider or region. Charged, while ingress usually is not.' }
  ],

  quiz: [
    { q: "Which difference between your laptop and a server does a container NOT fix?",
      options: [
        "Configuration and secrets",
        "System libraries",
        "The language runtime version",
        "Dependency versions"
      ],
      answer: 0,
      why: "They arrive at run time, which is why the application should validate all of them at start and refuse to boot." },

    { q: "Why should a service validate its configuration at import rather than on first use?",
      options: [
        "So a bad deploy fails immediately instead of turning into a customer facing failure on the first payment",
        "Because the framework requires it",
        "To reduce memory",
        "It is faster"
      ],
      answer: 0,
      why: "A service that boots happily with an empty variable has converted a deploy problem into a money problem." },

    { q: "Why does a multi stage build produce a smaller image?",
      options: [
        "It uses a different filesystem",
        "It compresses the layers",
        "The final stage starts from a clean base and copies in only what runs, so the build tooling is never in the image at all",
        "It removes files in a later layer"
      ],
      answer: 2,
      why: "Deleting in a later layer does not help: everything installed stays in the image forever." },

    { q: "Your container needs to read one prefix of one S3 bucket. What is the right way to grant that?",
      options: [
        "Make the bucket public",
        "A task role with a policy allowing GetObject on that prefix, so the container receives short lived credentials with nothing to leak",
        "A key stored in the secret manager",
        "An access key in an environment variable"
      ],
      answer: 1,
      why: "Roles, never long lived access keys. A leaked key is a permanent credential in a format designed to be copied." },

    { q: "A syntax check over twenty files took 9.63 s as twenty processes and 0.61 s as one. What was the cost?",
      options: [
        "Process startup, not work: nothing was removed and nothing was made less strict",
        "Disk reads",
        "The check itself",
        "Network"
      ],
      answer: 0,
      why: "That one change took the whole gate from 15.97 s to 6.95 s." },

    { q: "The team keeps using the administrator override to skip a 25 minute pipeline. What is the fix?",
      options: [
        "Require a manager to approve the override",
        "Remove the override entirely",
        "Make the pipeline fast: time every step, split a fast merge gate from a slower post merge suite",
        "Run the pipeline only on the main branch"
      ],
      answer: 2,
      why: "The override is a symptom. Requiring approval moves it into direct messages, where nobody can audit it." },

    { q: "In Kubernetes, which object decides how many copies run and how a new image is rolled out?",
      options: [
        "The Deployment",
        "The Pod",
        "The Ingress",
        "The Service"
      ],
      answer: 0,
      why: "Pod is the unit, Deployment manages them, Service gives a stable address, Ingress lets traffic in." },

    { q: "What is drift in infrastructure as code?",
      options: [
        "Slow degradation of performance",
        "Configuration diverging between environments",
        "State file corruption",
        "Reality differing from the code, usually because somebody changed it by hand"
      ],
      answer: 3,
      why: "The next plan offers to undo their emergency fix, which is why it gets written back into the code the next morning." },

    { q: "Why must secrets never appear in Terraform files or variable defaults?",
      options: [
        "Terraform cannot read them",
        "They end up in the state file, which is a plaintext copy of everything, sitting in a bucket",
        "They change too often",
        "They would be too long"
      ],
      answer: 1,
      why: "Reference a secret manager and let the resource read it at run time." },

    { q: "Which deploy strategy makes rollback a matter of seconds?",
      options: [
        "Recreate",
        "Rolling",
        "Blue green",
        "Any of them, with automation"
      ],
      answer: 2,
      why: "Both versions are running, so rollback is the load balancer switching back. For money that is the argument." },

    { q: "What does canary deployment require that the others do not?",
      options: [
        "A database migration",
        "Per version metrics, so the new version can be compared against the old on live traffic automatically",
        "A feature flag service",
        "Twice the infrastructure"
      ],
      answer: 1,
      why: "Without them the comparison is somebody squinting at a dashboard during a deploy." },

    { q: "Why does a database migration make rollback hard?",
      options: [
        "Because backups take time",
        "Because the old code can meet a schema it has never seen, so code and migration must not deploy together",
        "Because of replication lag",
        "Migrations are slow"
      ],
      answer: 1,
      why: "Expand and contract exists so that every intermediate state works with both versions of the code." },

    { q: "Why must a feature flag be read at request time rather than at start?",
      options: [
        "To reduce load on the flag service",
        "Because flags change rarely",
        "Because otherwise turning a flag off requires a restart, which removes the point of having it",
        "It is faster"
      ],
      answer: 2,
      why: "And it should default to off, so an unreachable flag service leaves the new path dark." },

    { q: "Compute was sized for 200 payments a second while the average is 50. What does that tell you about the bill?",
      options: [
        "That the service is inefficient",
        "That the average should be measured differently",
        "Nothing, peak sizing is required",
        "That most of the compute line is idle capacity, which is the first place to look before cutting anything that removes headroom"
      ],
      answer: 3,
      why: "Autoscaling on real load recovers much of it. Removing a replica to save money does not." },

    { q: "Why compute a cost per payment at all?",
      options: [
        "For the finance team's report",
        "To choose a cloud provider",
        "Because it is required for compliance",
        "So you can compare infrastructure cost against the processing fee and say how much of the margin it takes"
      ],
      answer: 3,
      why: "An engineer who can hold both numbers is in the same conversation as the person setting the budget." }
  ],

  project: {
    title: 'payments-platform: everything you built, deployable',
    story: 'Take the payments API, the vault and the observability work, and make them one system somebody else could ' +
           'run. Containers that hold only what runs, a gate fast enough that nobody skips it, infrastructure in code, ' +
           'blue green with a rollback you have timed, flags with a kill switch, and a cost per payment you can defend.',
    scope: 'Free tiers and local tools throughout. If you cannot run a cloud account, run the same shapes with Docker ' +
           'Compose and a local registry, and say so in the README. The reasoning is what is being assessed.',
    requirements: [
      'A single stage Dockerfile and a multi stage one, with both image sizes reported',
      'Layers ordered so that a one line code change does not reinstall dependencies, with build times for both orders',
      'A `.dockerignore`, a non root user, a pinned base image and a health check that fails when the service is not ready',
      'Configuration as one validated object, with the service refusing to start on a missing or invalid variable',
      'A merge gate: lint, types, unit tests, one image build, integration tests against that image',
      'A table of your pipeline step timings, and at least one step you made faster with the reason',
      'Terraform for the database, cache, queue and alarms, with remote state and environment variables for sizing',
      'A destroy and rebuild of staging from the repository alone, timed',
      'At least one service running on a real cloud account, or a written substitution naming the local equivalent of each managed service',
      'An IAM role with the narrowest policy that works, and no long lived access key anywhere in the repository or the environment',
      'A database with no public address, reachable only from the service security group',
      'A billing alarm created before any other resource, with the threshold you chose',
      'One component deployed to a local Kubernetes cluster, with a manifest you wrote and can explain line by line',
      'Blue green deployment with a health check that keeps a broken version from receiving traffic',
      'A timed rollback, measured from decision to first healthy response',
      'A feature flag service read at request time, defaulting to off, with a kill switch on the payout path',
      'An expand and contract migration deployed across several releases, with a mid migration rollback proving the intermediate states are safe',
      'A cost model with real list prices and your own measured log and metric volumes, giving a cost per payment',
      'One paragraph on how you would halve the two biggest lines, and what you would refuse to cut',
      'An architecture document naming every service, what it owns, and what it depends on',
      'The repository public on GitHub as `payments-platform`'
    ],
    starter: {
      lang: 'text',
      code: '# FinQuest level 17: the deploy you can undo.\n#\n#   Dockerfile.naive     the one you measure against\n#   Dockerfile           multi stage, non root, pinned, health checked\n#   .dockerignore        the file everybody forgets\n#   .github/workflows/   the gate: fast checks first, one build, then integration\n#   infra/               terraform, remote state, one module per environment\n#   deploy/bluegreen.sh  switch, and the rollback you have timed\n#   flags/               read at request time, default off, kill switches listed\n#   COST.md              the table, the per payment number, and what you would cut\n#   ARCHITECTURE.md      every service, what it owns, what it depends on\n\n# The rollback plan goes in the pull request template, one line, every time:\n#\n#   Rollback: revert this deploy. No migration in this change.\n#   Rollback: revert, then disable flag payouts_v2. Migration is additive only.\n#   Rollback: NOT POSSIBLE without data loss  <- restructure before merging\n'
    },
    tests: [
      'The final image contains no test framework, linter or compiler',
      'A one line source change rebuilds without reinstalling dependencies',
      'The container refuses to start when a required variable is missing, naming it',
      'The container does not run as root',
      'The readiness probe fails while the database is unreachable, and the instance leaves the load balancer',
      'The gate fails on a deliberately broken commit, and the deploy step cannot run without it',
      'The image that integration tests ran against is the image that deploys',
      'A terraform plan against an untouched environment shows no changes',
      'Staging can be destroyed and rebuilt from the repository alone',
      'No long lived cloud access key exists in the repository, the environment or the shell profile',
      'The database refuses a connection from outside its security group',
      'The Kubernetes readiness probe removes a pod from the Service while its dependency is unavailable',
      'A deliberately broken version deployed to the idle side receives no traffic',
      'A rollback completes within the time stated in your README',
      'Turning off the payout kill switch stops payouts without a deploy',
      'Rolling back to the middle of an expand and contract migration breaks nothing'
    ],
    rubric: [
      { pts: 20, t: 'The artefact', d: 'Multi stage, ordered layers, non root, pinned, health checked, with sizes and build times reported.' },
      { pts: 20, t: 'The gate', d: 'Fast, deterministic, builds once, cannot be walked around, with step timings and one improvement.' },
      { pts: 20, t: 'Infrastructure', d: 'Terraform with remote state, a clean plan, staging rebuilt from the repository, roles rather than keys, and a private database.' },
      { pts: 25, t: 'Deploy and undo', d: 'Blue green, a timed rollback, flags with a kill switch, and a migration rollback proven mid flight.' },
      { pts: 15, t: 'Cost', d: 'A real cost model, a per payment number, and a defensible answer on what to cut and what not to.' }
    ],
    stretch: [
      'Add automated canary analysis: compare the new version\'s error rate and latency against the old and roll back without a human',
      'Add a deployment freeze window, and the override procedure for a genuine emergency',
      'Run the same service on two providers and compare the cost model honestly',
      'Add an ephemeral environment per pull request, torn down on merge, and measure what it costs a month',
      'Instrument the pipeline itself: track gate duration over time and alert when it crosses five minutes'
    ],
    solutionPath: 'solutions/level-17'
  },

  faq: [
    { q: 'I cannot run a cloud account. Is this level still worth doing?',
      a: 'Yes. Docker Compose, a local registry and Terraform against a local provider give you the same shapes: an image, a gate, declared infrastructure, two environments and a switch. The reasoning transfers completely, and saying in your README which parts you ran locally is more honest than a screenshot of a console.' },
    { q: 'How much Kubernetes do I actually need?',
      a: 'Enough to read a manifest and name the objects: Pod, Deployment, Service, Ingress, ConfigMap, Secret, probes. Deploy one component to a local cluster you started yourself and stop there. You do not need it to run this platform, and saying so with a reason is a good answer; what is not a good answer is being unable to follow the conversation, because most large payments teams run on it.' },
    { q: 'Which cloud, and will it cost me money?',
      a: 'AWS, because it is what most payments employers use and what most job descriptions name. It will cost a little: a small database and a load balancer are a few dollars a day, and a NAT gateway is the line that surprises people. Set a billing alarm before creating anything, stop the database when you are not using it, and delete the environment when the level is finished.' },
    { q: 'How fast should the merge gate be?',
      a: 'Fast enough that people wait for it rather than working around it, which in practice means single digit minutes. Split it if you have to: a fast gate that blocks merging and a fuller suite that blocks deploying.' },
    { q: 'My integration tests are flaky in CI and fine locally',
      a: 'Almost always timing or ordering: a service that is accepting connections before it is ready, tests sharing state, or a fixed sleep instead of waiting for a condition. Fix the wait, not the test, and treat a flaky test as a broken test rather than a fact of life, because the retry habit is what will later hide a real failure.' },
    { q: 'How do I test a rollback without breaking production?',
      a: 'Deploy a version that is deliberately broken in a harmless way, to staging first and then during a game day in production if you can. A rollback you have never performed is a plan rather than a capability, and the day you need it is the wrong day to find out which.' },
    { q: 'When should a feature flag be deleted?',
      a: 'When the feature is fully on for everybody and has been stable for a couple of weeks. Put the date in the code when you create the flag. Old flags are untested branches, and a service with sixty of them has a combinatorial number of behaviours nobody has ever run.' },
    { q: 'What do I say about this project in an interview?',
      a: 'The rollback number, because it is concrete and almost nobody has it: how many seconds from deciding to roll back to the first healthy response, and how you proved the migration in the middle was safe to roll back through. Then the cost per payment, because being able to say what your design charges per transaction is unusual at any level.' }
  ]
});
