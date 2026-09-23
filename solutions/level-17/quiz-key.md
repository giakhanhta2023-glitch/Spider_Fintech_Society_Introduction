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
- B. The language runtime version
- C. System libraries
- D. Dependency versions

**Why:** They arrive at run time, which is why the application should validate all of them at start and refuse to boot.

### 2. Why should a service validate its configuration at import rather than on first use?

- **A. So a bad deploy fails immediately instead of turning into a customer facing failure on the first payment** ✅
- B. To reduce memory
- C. It is faster
- D. Because the framework requires it

**Why:** A service that boots happily with an empty variable has converted a deploy problem into a money problem.

### 3. Why does a multi stage build produce a smaller image?

- A. It removes files in a later layer
- B. It uses a different filesystem
- **C. The final stage starts from a clean base and copies in only what runs, so the build tooling is never in the image at all** ✅
- D. It compresses the layers

**Why:** Deleting in a later layer does not help: everything installed stays in the image forever.

### 4. Where should dependency installation go in a Dockerfile?

- A. In the final stage only
- **B. Before copying the source, so a code change does not reinstall everything** ✅
- C. It makes no difference
- D. After copying the source, so the code is available

**Why:** Order layers by how often they change: dependencies monthly, your code hourly.

### 5. A syntax check over twenty files took 9.63 s as twenty processes and 0.61 s as one. What was the cost?

- **A. Process startup, not work: nothing was removed and nothing was made less strict** ✅
- B. Disk reads
- C. Network
- D. The check itself

**Why:** That one change took the whole gate from 15.97 s to 6.95 s.

### 6. The team keeps using the administrator override to skip a 25 minute pipeline. What is the fix?

- A. Remove the override entirely
- B. Require a manager to approve the override
- **C. Make the pipeline fast: time every step, split a fast merge gate from a slower post merge suite** ✅
- D. Run the pipeline only on the main branch

**Why:** The override is a symptom. Requiring approval moves it into direct messages, where nobody can audit it.

### 7. Why must a merge gate build the artefact once and deploy that same one?

- **A. Because a rebuild at deploy time might differ from what was tested** ✅
- B. To keep the registry small
- C. Because builds are slow
- D. To save money

**Why:** What you tested is what you deploy, or you tested nothing in particular.

### 8. What is drift in infrastructure as code?

- A. Slow degradation of performance
- B. Configuration diverging between environments
- C. State file corruption
- **D. Reality differing from the code, usually because somebody changed it by hand** ✅

**Why:** The next plan offers to undo their emergency fix, which is why it gets written back into the code the next morning.

### 9. Why must secrets never appear in Terraform files or variable defaults?

- A. They change too often
- **B. They end up in the state file, which is a plaintext copy of everything, sitting in a bucket** ✅
- C. They would be too long
- D. Terraform cannot read them

**Why:** Reference a secret manager and let the resource read it at run time.

### 10. Which deploy strategy makes rollback a matter of seconds?

- A. Recreate
- B. Rolling
- **C. Blue green** ✅
- D. Any of them, with automation

**Why:** Both versions are running, so rollback is the load balancer switching back. For money that is the argument.

### 11. What does canary deployment require that the others do not?

- A. A feature flag service
- **B. Per version metrics, so the new version can be compared against the old on live traffic automatically** ✅
- C. Twice the infrastructure
- D. A database migration

**Why:** Without them the comparison is somebody squinting at a dashboard during a deploy.

### 12. Why does a database migration make rollback hard?

- A. Because of replication lag
- **B. Because the old code can meet a schema it has never seen, so code and migration must not deploy together** ✅
- C. Migrations are slow
- D. Because backups take time

**Why:** Expand and contract exists so that every intermediate state works with both versions of the code.

### 13. Why must a feature flag be read at request time rather than at start?

- A. Because flags change rarely
- B. It is faster
- **C. Because otherwise turning a flag off requires a restart, which removes the point of having it** ✅
- D. To reduce load on the flag service

**Why:** And it should default to off, so an unreachable flag service leaves the new path dark.

### 14. Compute was sized for 200 payments a second while the average is 50. What does that tell you about the bill?

- A. That the average should be measured differently
- B. Nothing, peak sizing is required
- C. That the service is inefficient
- **D. That most of the compute line is idle capacity, which is the first place to look before cutting anything that removes headroom** ✅

**Why:** Autoscaling on real load recovers much of it. Removing a replica to save money does not.

### 15. Why compute a cost per payment at all?

- A. To choose a cloud provider
- B. For the finance team's report
- C. Because it is required for compliance
- **D. So you can compare infrastructure cost against the processing fee and say how much of the margin it takes** ✅

**Why:** An engineer who can hold both numbers is in the same conversation as the person setting the budget.
