# Security policy

## Supported versions

Security fixes go into the newest release. Please update before reporting, and
check whether the problem is still there.

| Version | Supported |
| --- | --- |
| Latest release | Yes |
| Anything older | No |

## Reporting a vulnerability

**Do not open a public issue for a security problem.** Use GitHub's private
reporting instead: on the repository's **Security** tab, choose **Report a
vulnerability**. Include what you found, the steps to reproduce it, the version and
platform, and what an attacker could do with it.

You can expect an acknowledgement within a week. We will keep you informed while it
is fixed and credit you in the release notes, unless you would rather not be named.

## What counts

FormTools runs on your own machine, so the things that matter most are the ways
something outside it could get in:

- **The engine** binds to loopback (127.0.0.1) and answers only requests whose host
  and origin are this computer's own window and agents. Anything that makes it
  reachable from another machine, or from a web page in your browser.
- **The terminal dock and Claude Code tabs**: anything that lets a web page, a file or
  an MCP client open or drive a terminal, which only you are meant to do.
- **MCP tools**: anything that lets an agent reach further than the tools describe.
- **Files**: reading, extracting or converting a file or archive in a way that writes
  outside where it should, and moving to the trash anything it should refuse.
- **Desktop utilities** that change system settings, such as the hosts file and
  environment variables: anything that changes them without you asking.

Bugs that need someone to already control your machine, or to run a modified build
of FormTools, are ordinary bugs: please open an issue for those.
