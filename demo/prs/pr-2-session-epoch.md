# Auth: sign everyone out after a key rotation

Adds SESSION_EPOCH. getSession rejects tokens issued before it, so ops can force a global re-login.
