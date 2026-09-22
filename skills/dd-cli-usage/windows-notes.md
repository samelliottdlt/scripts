## Windows notes

- On Windows, `dd-cli` is a shim from Sam's `s` scripts repo (`bin/dd-cli.mjs`). It forwards
  every argument to the real binary inside WSL. Call `dd-cli` from PowerShell as usual.
- Prefer to keep each argument, including `--intent`, on one line.
- If sign-in has expired, ask the user to run `dd-cli login`. It opens their Windows browser.
- Never place an order (`order submit`) or change the default address without explicit
  confirmation from the user.
