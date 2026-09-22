"""File-backed backend for Python's `keyring` library.

Copied next to dd-cli's bundled Python by `s dd-cli install` (Windows/WSL only) and
selected per call by the dd-cli shim via PYTHON_KEYRING_BACKEND. It replaces
gnome-keyring, which re-locks every time the WSL VM restarts and pops an unlock
prompt, so dd-cli can run unattended.

Secrets are stored unencrypted in a JSON file readable only by the owner (0600),
the same trade-off as gh's hosts.yml or ~/.aws/credentials.
"""

import json
import os
import tempfile

from keyring.backend import KeyringBackend
from keyring.errors import PasswordDeleteError

PATH = os.path.join(
    os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share"),
    "s",
    "dd-cli",
    "credentials.json",
)


class Keyring(KeyringBackend):
    priority = 1
    path = PATH

    def _load(self):
        try:
            with open(self.path, encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            return {}

    def _save(self, data):
        folder = os.path.dirname(self.path)
        os.makedirs(folder, mode=0o700, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=folder, prefix=".credentials-")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            os.chmod(tmp, 0o600)
            os.replace(tmp, self.path)
        except BaseException:
            os.unlink(tmp)
            raise

    def get_password(self, service, username):
        return self._load().get(service, {}).get(username)

    def set_password(self, service, username, password):
        data = self._load()
        data.setdefault(service, {})[username] = password
        self._save(data)

    def delete_password(self, service, username):
        data = self._load()
        if username not in data.get(service, {}):
            raise PasswordDeleteError("Password not found")
        del data[service][username]
        if not data[service]:
            del data[service]
        self._save(data)
