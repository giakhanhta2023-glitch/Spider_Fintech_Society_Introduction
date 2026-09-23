# Level 17: The deploy you can undo: quiz answer key

> 15 questions. Pass mark is 12/15 (80%).
> Generated from `content/levels/` by `tools/build_quiz_keys.js`: do not edit by hand.

| # | Answer |
|---|--------|
| 1 | **A** |
| 2 | **A** |
| 3 | **C** |
| 4 | **B** |
| 5 | **A** |
| 6 | **C** |
| 7 | **A** |
| 8 | **D** |
| 9 | **B** |
| 10 | **C** |
| 11 | **B** |
| 12 | **B** |
| 13 | **C** |
| 14 | **D** |
| 15 | **D** |

---

### 1. Which difference between your laptop and a server does a container NOT fix?

- **A. Configuration and secrets** ✅
- B. System libraries
- C. The language runtime version
- D. Dependency versions

**Why:** They arrive at run time, which is why the application should validate all of them at start and refuse to boot.

### 2. Why should a service validate its configuration at import rather than on first use?

- **A. So a bad deploy fails immediately instead of turning into a customer facing failure on the first payment** ✅
- B. Because the framework requires it
- C. To reduce memory
- D. It is faster

**Why:** A service that boots happily with an empty variable has converted a deploy problem into a money problem.

### 3. Why does a multi stage build produce a smaller image?

- A. It uses a different filesystem
- B. It compresses the layers
- **C. The final stage starts from a clean base and copies in only what runs, so the build tooling is never in the image at all** ✅
- D. It removes files in a later layer

**Why:** Deleting in a later layer does not help: everything installed stays in the image forever.

### 4. Your container needs to read one prefix of one S3 bucket. What is the right way to grant that?

- A. Make the bucket public
- **B. A task role with a policy allowing GetObject on that prefix, so the container receives short lived credentials with nothing to leak** ✅
- C. A key stored in the secret manager
- D. An access key in an environment variable

**Why:** Roles, never long lived access keys. A leaked key is a permanent credential in a format designed to be copied.

### 5. A syntax check over twenty files took 9.63 s as twenty processes and 0.61 s as one. What was the cost?

- **A. Process startup, not work: nothing was removed and nothing was made less strict** ✅
- B. Disk reads
- C. The check itself
- D. Network

**Why:** That one change took the whole gate from 15.97 s to 6.95 s.

### 6. The team keeps using the administrator override to skip a 25 minute pipeline. What is the fix?

- A. Require a manager to approve the override
- B. Remove the override entirely
- **C. Make the pipeline fast: time every step, split a fast merge gate from a slower post merge suite** ✅
- D. Run the pipeline only on the main branch

**Why:** The override is a symptom. Requiring approval moves it into direct messages, where nobody can audit it.

### 7. In Kubernetes, which object decides how many copies run and how a new image is rolled out?

- **A. The Deployment** ✅
- B. The Pod
- C. The Ingress
- D. The Service

**Why:** Pod is the unit, Deployment manages them, Service gives a stable address, Ingress lets traffic in.

### 8. What is drift in infrastructure as code?

- A. Slow degradation of performance
- B. Configuration diverging between environments
- C. State file corruption
- **D. Reality differing from the code, usually because somebody changed it by hand** ✅

**Why:** The next plan offers to undo their emergency fix, which is why it gets written back into the code the next morning.

### 9. Why must secrets never appear in Terraform files or variable defaults?

- A. Terraform cannot read them
- **B. They end up in the state file, which is a plaintext copy of everything, sitting in a bucket** ✅
- C. They change too often
- D. They would be too long

**Why:** Reference a secret manager and let the resource read it at run time.

### 10. Which deploy strategy makes rollback a matter of seconds?

- A. Recreate
- B. Rolling
- **C. Blue green** ✅
- D. Any of them, with automation

**Why:** Both versions are running, so rollback is the load balancer switching back. For money that is the argument.

### 11. What does canary deployment require that the others do not?

- A. A database migration
- **B. Per version metrics, so the new version can be compared against the old on live traffic automatically** ✅
- C. A feature flag service
- D. Twice the infrastructure

**Why:** Without them the comparison is somebody squinting at a dashboard during a deploy.

### 12. Why does a database migration make rollback hard?

- A. Because backups take time
- **B. Because the old code can meet a schema it has never seen, so code and migration must not deploy together** ✅
- C. Because of replication lag
- D. Migrations are slow

**Why:** Expand and contract exists so that every intermediate state works with both versions of the code.

### 13. Why must a feature flag be read at request time rather than at start?

- A. To reduce load on the flag service
- B. Because flags change rarely
- **C. Because otherwise turning a flag off requires a restart, which removes the point of having it** ✅
- D. It is faster

**Why:** And it should default to off, so an unreachable flag service leaves the new path dark.

### 14. Compute was sized for 200 payments a second while the average is 50. What does that tell you about the bill?

- A. That the service is inefficient
- B. That the average should be measured differently
- C. Nothing, peak sizing is required
- **D. That most of the compute line is idle capacity, which is the first place to look before cutting anything that removes headroom** ✅

**Why:** Autoscaling on real load recovers much of it. Removing a replica to save money does not.

### 15. Why compute a cost per payment at all?

- A. For the finance team's report
- B. To choose a cloud provider
- C. Because it is required for compliance
- **D. So you can compare infrastructure cost against the processing fee and say how much of the margin it takes** ✅

**Why:** An engineer who can hold both numbers is in the same conversation as the person setting the budget.
