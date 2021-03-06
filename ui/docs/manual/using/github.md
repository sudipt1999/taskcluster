---
filename: using/github.md
title: Integrating with Github
order: 10
---

# Integrating with Github

Taskcluster provides a convenient integration with Github to enable starting
tasks when events occur on a github repository.  Setting up the integration is
simple: add the integration to the Github organization and repository
(this requires administrator rights on the organization), then add a file called
`.taskcluster.yml` to the root of the repository.

We recommend using [The quickstart
tool](https://tools.taskcluster.net/quickstart/) to get started.  For more
in-depth documentation, [the reference
pages](/docs/reference/integrations/github)
provide detailed information.

## Task Security

It is convenient for contributors to run tasks on pull requests, but those
tasks then run arbitrary, un-reviewed code. If the tasks have access to
resources that should not be publicly available, then a pull request can
provide a route for a malicious contributor to abuse those resources.

The Github integration provides per-repository configuration for building pull
requests, with the configuration controlled from the default (`master`) branch.
The configuration can allow tasks to be created for any author's pull requests,
or limit tasks to pull requests created by repository collaborators.

With a little extra care in setting up the `repo:github.com/<org>/<repo>`
scopes, it is possible to provide scopes for branches (containing trusted,
reviewed code) that differ from the scopes given to pull requests.
