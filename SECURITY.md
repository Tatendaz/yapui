# Security Policy

YapUI runs a local HTTP relay that serves your files and lets an agent edit them, so it
takes its guardrails seriously: path canonicalization, a symlink realpath guard, dotfile
and workdir blocking, same-origin POST checks, DNS-rebinding Host pinning, size-capped
uploads, and a resident agent restricted to Read/Edit tools inside the served directory
(no shell).

## Supported versions

Only the latest release (and `main`) receive security fixes.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Instead use GitHub's
private vulnerability reporting:

**https://github.com/Tatendaz/yapui/security/advisories/new**

Include what you can: affected file/route, a repro (a curl command or page snippet is
perfect), and impact. You'll get a response within a few days; fixes ship in a patch
release with credit to the reporter unless you'd rather stay anonymous.

## Scope notes

- The relay binds to localhost and trusts the local user. "Another local process can
  talk to the relay" is by design, not a vulnerability.
- The threat model YapUI does defend against: malicious *web pages* reaching the relay
  (cross-origin POSTs, DNS rebinding), and malicious *served content* escaping the
  preview directory (traversal, symlinks). Findings in those areas are very welcome.
