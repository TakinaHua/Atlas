# Version checkpoints

The original commits are retained without rewriting history:

- `ee8a869`: reorganized Atlas frontend/backend.
- `93241f0`: recorded the Django backend direction.
- `f0a5ea6`: formatted the previous code; behavior-preserving checkpoint.

Subsequent commits add the Django backend, the Next.js frontend, and verification/documentation. Use `git log --oneline --decorate` to inspect their final commit IDs.

To inspect an earlier file without changing the current checkout:

```sh
git show 93241f0:frontend/src/app.js
git diff 93241f0 f0a5ea6 -- frontend/src
```

To run an older version independently, create a separate worktree at the desired commit. Do not use `git reset --hard` on the working project. The original ZIP in `archive/atlas-frontend-mvp.zip` is unchanged.
