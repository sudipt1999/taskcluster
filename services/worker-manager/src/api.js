const APIBuilder = require('taskcluster-lib-api');

let builder = new APIBuilder({
  title: 'Taskcluster Worker Manager',
  description: [
    'This service manages workers, including provisioning for dynamic worker pools.',
  ].join('\n'),
  serviceName: 'worker-manager',
  apiVersion: 'v1',
  params: {
    workerPoolId: /^[a-zA-Z0-9-_]{1,38}\/[a-z]([-a-z0-9]{0,36}[a-z0-9])?$/,
  },
  context: [
    'WorkerPool',
    'providers',
    'publisher',
  ],
});

module.exports = builder;

builder.declare({
  method: 'put',
  route: '/worker-pool/:workerPoolId',
  name: 'createWorkerPool',
  title: 'Create Worker Pool',
  stability: APIBuilder.stability.experimental,
  input: 'create-worker-pool-request.yml',
  output: 'worker-pool-full.yml',
  scopes: {AllOf: [
    'worker-manager:create-worker-type:<workerPoolId>',
    'worker-manager:provider:<providerId>',
  ]},
  description: [
    'Create a new worker pool. If the worker pool already exists, this will throw an error.',
  ].join('\n'),
}, async function(req, res) {
  const {workerPoolId} = req.params;
  const input = req.body;
  const providerId = input.providerId;

  await req.authorize({workerPoolId, providerId});

  const provider = this.providers.get(providerId);
  if (!provider) {
    return res.reportError('InputError', 'Invalid Provider', {
      providerId,
      validProviderIds: this.providers.validProviderIds(),
    });
  }

  // This has been validated at the api level to ensure that it
  // is valid config for at least one of our providers but
  // we check here to see that the config matches the config for the configured provider
  const error = provider.validate(input.config);
  if (error) {
    return res.reportError('InputValidationError', error);
  }

  const now = new Date();
  let workerPool;

  const definition = {
    workerPoolId,
    providerId,
    previousProviderIds: [],
    description: input.description,
    config: input.config,
    created: now,
    lastModified: now,
    owner: input.owner,
    emailOnError: input.emailOnError,
    providerData: {},
  };

  try {
    workerPool = await this.WorkerPool.create(definition);
  } catch (err) {
    if (err.code !== 'EntityAlreadyExists') {
      throw err;
    }
    workerPool = await this.WorkerPool.load({workerPoolId});

    if (!workerPool.compare(definition)) {
      return res.reportError('RequestConflict', 'Worker pool already exists', {});
    }
  }
  await this.publisher.workerPoolCreated({workerPoolId, providerId});
  res.reply(workerPool.serializable());
});

builder.declare({
  method: 'post',
  route: '/worker-pool/:workerPoolId',
  name: 'updateWorkerPool',
  title: 'Update Worker Pool',
  stability: APIBuilder.stability.experimental,
  input: 'create-worker-pool-request.yml',
  output: 'worker-pool-full.yml',
  scopes: {AllOf: [
    'worker-manager:update-worker-type:<workerPoolId>',
    'worker-manager:provider:<providerId>',
  ]},
  description: [
    'Given an existing worker pool definition, this will modify it and return',
    'the new definition.',
    '',
    'To delete a worker pool, set its `providerId` to `"null-provider"`.',
    'After any existing workers have exited, a cleanup job will remove the',
    'worker pool.  During that time, the worker pool can be updated again, such',
    'as to set its `providerId` to a real provider.',
  ].join('\n'),
}, async function(req, res) {
  const {workerPoolId} = req.params;
  const input = req.body;
  const providerId = input.providerId;

  await req.authorize({workerPoolId, providerId});

  const provider = this.providers.get(providerId);
  if (!provider) {
    return res.reportError('InputError', 'Invalid Provider', {
      providerId,
      validProviderIds: this.providers.validProviderIds(),
    });
  }

  const error = provider.validate(input.config);
  if (error) {
    return res.reportError('InputValidationError', error);
  }

  const workerPool = await this.WorkerPool.load({
    workerPoolId,
  }, true);
  if (!workerPool) {
    return res.reportError('ResourceNotFound', 'Worker pool does not exist', {});
  }

  const previousProviderId = workerPool.providerId;

  await workerPool.modify(wt => {
    wt.config = input.config;
    wt.description = input.description;
    wt.providerId = providerId;
    wt.owner = input.owner;
    wt.emailOnError = input.emailOnError;
    wt.lastModified = new Date();

    if (previousProviderId !== providerId && !wt.previousProviderIds.includes(previousProviderId)) {
      wt.previousProviderIds.push(previousProviderId);
    }
  });

  await this.publisher.workerPoolUpdated({workerPoolId, providerId, previousProviderId});
  res.reply(workerPool.serializable());
});

builder.declare({
  method: 'get',
  route: '/worker-pool/:workerPoolId',
  name: 'workerPool',
  title: 'Get Worker Pool',
  stability: APIBuilder.stability.experimental,
  output: 'worker-pool-full.yml',
  description: [
    'Fetch an existing worker pool defition.',
  ].join('\n'),
}, async function(req, res) {
  const {workerPoolId} = req.params;

  const workerPool = await this.WorkerPool.load({
    workerPoolId,
  }, true);
  if (!workerPool) {
    return res.reportError('ResourceNotFound', 'Worker pool does not exist', {});
  }
  res.reply(workerPool.serializable());
});

builder.declare({
  method: 'get',
  route: '/worker-pools',
  query: {
    continuationToken: /./,
    limit: /^[0-9]+$/,
  },
  name: 'listWorkerPools',
  title: 'List All Worker Pools',
  stability: APIBuilder.stability.experimental,
  output: 'worker-pool-list.yml',
  description: [
    'Get the list of all the existing worker pools.',
  ].join('\n'),
}, async function(req, res) {
  const { continuationToken } = req.query;
  const limit = parseInt(req.query.limit || 100, 10);
  const scanOptions = {
    continuation: continuationToken,
    limit,
  };

  const data = await this.WorkerPool.scan({}, scanOptions);
  const result = {
    workerPools: data.entries.map(e => e.serializable()),
  };

  if (data.continuation) {
    result.continuationToken = data.continuation;
  }
  return res.reply(result);
});

/*
 * ************** BELOW HERE LIVE PROVIDER ENDPOINTS **************
 */

builder.declare({
  method: 'post',
  route: '/credentials/google/:workerPoolId',
  name: 'credentialsGoogle',
  title: 'Google Credentials',
  stability: APIBuilder.stability.experimental,
  input: 'credentials-google-request.yml',
  output: 'temp-creds-response.yml',
  description: [
    'Get Taskcluster credentials for a worker given an Instance Identity Token',
  ].join('\n'),
}, async function(req, res) {
  const {workerPoolId} = req.params;

  try {
    const workerPool = await this.WorkerPool.load({workerPoolId});
    const provider = this.providers.get(workerPool.providerId);

    if (!provider) {
      return res.reportError('InputError', 'Invalid Provider', {
        providerId: workerPool.providerId,
      });
    }

    return res.reply(await provider.verifyIdToken({
      token: req.body.token,
      workerPool,
    }));
  } catch (err) {
    // We will internally record what went wrong and report back something generic
    this.monitor.reportError(err, 'warning');
    return res.reportError('InputError', 'Invalid Token', {});
  }
});

/*
 * ************** THIS SECTION FOR PROVIDER ENDPOINTS **************
 */
