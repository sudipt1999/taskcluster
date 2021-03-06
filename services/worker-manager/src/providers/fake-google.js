/**
 * This defines a fairly brittle and scripted
 * set of interactions that the google provider makes
 * with the google apis in order to test out our side of things
 * within the provider. This can either grow to be more flexible for
 * more testing later or we can come up with some other plan.
*/

// TODO: Move all google stuff into its own folder?
const sinon = require('sinon');

const WORKER_SERVICE_ACCOUNT_ID = '12345';

class FakeOAuth2 {
  constructor({project}) {
    this.project = project;
  }

  verifyIdToken({idToken, audience}) {
    if (!idToken || !audience) {
      throw new Error('Must provide both idToken and audience');
    }
    return {
      payload: {
        google: {
          compute_engine: {
            project_id: this.project,
            sub: WORKER_SERVICE_ACCOUNT_ID,
            instance_id: 'abc123',
          },
        },
      },
    };
  }
}

class FakeGoogle {
  constructor() {
    this.OAuth2 = FakeOAuth2;

    // For now we only support creating one of these per project
    // in this fake. We can support multiples later if needed
    this.serviceAccount = null;
    this.role = null;

    this.iamPolicy = {
      bindings: [],
    };
  }

  error(code) {
    const err = new Error(code);
    err.code = code;
    return err;
  }

  compute() {
    const opStub = sinon.stub();
    opStub.onCall(0).returns({data: {status: 'RUNNING'}});
    opStub.onCall(1).returns({data: {status: 'DONE'}});

    const instanceStub = sinon.stub();
    instanceStub.onCall(0).returns({data: {status: 'RUNNING'}});
    instanceStub.onCall(1).returns({data: {status: 'STOPPED'}});

    return {
      regions: {
        get: async () => ({
          data: {
            zones: ['whatever/a', 'whatever/b'],
          },
        }),
      },
      instances: {
        insert: async () => ({
          data: {
            targetId: '123', // This is the instanceId
            name: 'foo',
            zone: 'whatever/a',
          },
        }),
        get: async () => instanceStub(),
        delete: async () => {},
      },
      zoneOperations: {
        get: async () => opStub(),
        delete: async () => {},
      },
    };
  }

  iam() {
    return {
      projects: {
        serviceAccounts: {
          get: async () => {
            if (this.serviceAccount) {
              return {
                data: this.serviceAccount,
              };
            } else {
              throw this.error(404);
            }
          },
          create: async ({requestBody}) => {
            if (this.serviceAccount) {
              throw this.error(409);
            } else {
              this.serviceAccount = {uniqueId: WORKER_SERVICE_ACCOUNT_ID, ...requestBody.serviceAccount};
              return {data: this.serviceAccount};
            }
          },
          setIamPolicy: async () => {},
        },
        roles: {
          get: async () => {
            if (this.role) {
              return {data: this.role};
            } else {
              throw this.error(404);
            }
          },
          patch: async ({requestBody}) => {
            if (!this.role) {
              throw this.error(404);
            } else {
              this.role = requestBody;
            }
          },
          create: async ({requestBody}) => {
            if (this.role) {
              throw this.error(409);
            } else {
              this.role = requestBody.role;
              return {data: this.role};
            }
          },
        },
      },
    };
  }

  cloudresourcemanager() {
    return {
      projects: {
        getIamPolicy: async () => ({data: this.iamPolicy}),
        setIamPolicy: async ({requestBody}) => this.iamPolicy = requestBody.policy,
      },
    };
  }
}

module.exports = {
  FakeGoogle,
};
