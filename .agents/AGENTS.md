# Git Workflow — CloudTag

1. **Before making significant changes**:
    * Check the current branch and Git status:
        * `git status`
        * `git branch --show-current`
    * Do not overwrite or discard existing work.

2. **For new features**:
    * Create a dedicated feature branch from the latest `main`.
    * Use a descriptive branch name, for example:
        * `feature/cloud-cost-dashboard`
        * `feature/resource-tagging`
        * `feature/user-management`
    * Do not develop new features directly on `main` unless explicitly instructed.

3. **For bug fixes**:
    * Create a branch such as:
        * `fix/login-issue`
        * `fix/cost-calculation`

4. **Commit changes**:
    * After completing a logical piece of work, review the changes with:
        * `git status`
        * `git diff`
    * Commit with a clear message, for example:
        * `feat: add cloud cost dashboard`
        * `fix: resolve resource cost calculation`
        * `refactor: improve AWS resource service`

5. **Push changes**:
    * When I say “push to git”, commit any relevant completed changes and push the current branch to GitHub.
    * If working on a feature/fix branch, push that branch rather than directly pushing to `main`.
    * Use the existing SSH remote. Do not switch the repository back to HTTPS or ask for GitHub username/password.

6. **Do not push blindly**:
    * Never commit secrets, credentials, API keys, tokens, `.env` files, private keys, passwords, or other sensitive information.
    * Check `.gitignore` before committing.
    * Do not force push unless I explicitly ask for it.

7. **Before pushing**:
    * Show/check:
        * current branch
        * changed files
        * commit being created
    * Ensure the application is not accidentally committing generated files, databases, dependencies, or secrets.

8. **When I explicitly say “push current work”**:
    * Do not ask me to manually run Git commands.
    * Inspect the repository, create the appropriate commit if there are changes, and push to the appropriate branch.
    * If the work is currently on `main` and I explicitly ask to push it, push `main`.
    * Otherwise, preserve the current feature/fix branch.

9. **After pushing**:
    * Confirm:
        * branch name
        * commit hash/message
        * push result
        * GitHub remote used

**Important Context**:
- The GitHub repository is: `suh-aib/cloudtag`
- The repository remote must remain: `git@github.com:suh-aib/cloudtag.git`
- Use SSH authentication configured on this Mac. Never use GitHub password authentication.
