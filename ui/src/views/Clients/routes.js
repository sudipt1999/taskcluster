import lazy from '../../utils/lazy';

const ViewClients = lazy(() =>
  import(/* webpackChunkName: 'Clients.ViewClients' */ './ViewClients')
);
const ViewClient = lazy(() =>
  import(/* webpackChunkName: 'Clients.ViewClient' */ './ViewClient')
);

export default path => [
  {
    component: ViewClient,
    path: `${path}/create`,
    isNewClient: true,
  },
  {
    component: ViewClient,
    path: `${path}/:clientId`,
  },
  {
    component: ViewClients,
    path,
    description:
      'Manage clients on the Auth service. This tool allows you to create, modify, and delete clients. You can also reset `accessToken` and explore indirect scopes.',
  },
];
