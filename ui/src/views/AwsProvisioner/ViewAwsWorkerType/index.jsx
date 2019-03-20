import { hot } from 'react-hot-loader';
import React, { Component } from 'react';
import { graphql, withApollo } from 'react-apollo';
import Spinner from '@mozilla-frontend-infra/components/Spinner';
import { withStyles } from '@material-ui/core/styles';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import DeleteEmptyIcon from 'mdi-react/DeleteEmptyIcon';
import Dashboard from '../../../components/Dashboard';
import Button from '../../../components/Button';
import AwsProvisionerErrorsTable from '../../../components/AwsProvisionerErrorsTable';
import AwsProvisionerWorkerTypeStatus from '../../../components/AwsProvisionerWorkerTypeStatus';
import Snackbar from '../../../components/Snackbar';
import Ec2ResourcesTable from '../../../components/Ec2ResourcesTable';
import formatError from '../../../utils/formatError';
import ErrorPanel from '../../../components/ErrorPanel';
import workerTypeQuery from './workerType.graphql';
import terminateInstanceQuery from './terminateInstance.graphql';
import terminateWorkerTypeQuery from './terminateWorkerType.graphql';
import { FixedSizeList } from 'react-window';

@hot(module)
@withApollo
@graphql(workerTypeQuery, {
  options: props => ({
    variables: {
      workerType: props.match.params.workerType,
    },
  }),
})
@withStyles(theme => ({
  fab: {
    ...theme.mixins.fab,
  },
  spinner: {
    marginTop: theme.spacing.double,
  },
  terminateButton: {
    ...theme.mixins.errorIcon,
  },
}))
export default class ViewAwsWorkerType extends Component {
  state = {
    currentTab: 0,
    actionLoading: false,
    showTerminateAllInstancesSnackbar: false,
    showTerminateInstanceSnackbar: false,
    tabContentLoader: false,
  };

  handleTabChange = (e, currentTab) => {
    if(this.state.currentTab !== currentTab) {
      this.setState({ currentTab, tabContentLoader: true})
    }
    this.setState({ tabContentLoader: false });
  };

  handleTerminateAllInstances = async () => {
    const {
      client,
      match: {
        params: { workerType },
      },
    } = this.props;

    try {
      this.setState({ actionLoading: true, error: null });

      await client.mutate({
        mutation: terminateWorkerTypeQuery,
        variables: { workerType },
      });

      this.setState({
        actionLoading: false,
        showTerminateAllInstancesSnackbar: true,
      });
    } catch (error) {
      this.setState({ actionLoading: false, error: formatError(error) });
    }
  };

  handleTerminateInstance = async ({ region, id }) => {
    try {
      this.setState({ actionLoading: true, error: null });

      await this.props.client.mutate({
        mutation: terminateInstanceQuery,
        variables: { region, instanceId: id },
      });

      this.setState({
        actionLoading: false,
        showTerminateInstanceSnackbar: true,
      });
    } catch (error) {
      this.setState({ actionLoading: false, error: formatError(error) });
    }
  };

  handleSnackbarClose = () => {
    this.setState({
      showTerminateAllInstancesSnackbar: false,
      showTerminateInstanceSnackbar: false,
    });
  };

  render() {
    const {
      classes,
      data: {
        awsProvisionerWorkerTypeState,
        awsProvisionerWorkerTypeErrors,
        awsProvisionerWorkerType,
        loading,
        error,
      },
      match: {
        params: { workerType },
      },
    } = this.props;
    const {
      currentTab,
      actionLoading,
      showTerminateAllInstancesSnackbar,
      showTerminateInstanceSnackbar,
      tabContentLoader,
    } = this.state;
    const FIVE_SECONDS = 5000;
    const windowHeight = window.innerHeight;
    const tableHeight = windowHeight > 400 ? 0.6 * windowHeight : 400;

    return (
      <Dashboard title={`AWS Provisioner ${workerType}`}>
        <ErrorPanel error={error} />
        <ErrorPanel error={this.state.error} />
        <Tabs fullWidth value={currentTab} onChange={this.handleTabChange}>
          <Tab label="Status" />
          <Tab label="Recent Provisioning Errors" />
          <Tab label="EC2 Resources" />
        </Tabs>
        {loading && <Spinner className={classes.spinner} loading />}
        {!error && !loading && currentTab === 0 && (
          <AwsProvisionerWorkerTypeStatus
            workerType={awsProvisionerWorkerType}
            awsState={awsProvisionerWorkerTypeState}
          />
        )}
        {!error && !loading && currentTab === 1 && (
          <AwsProvisionerErrorsTable errors={awsProvisionerWorkerTypeErrors} />
        )}
        {!error && !loading && currentTab === 2 && (
          <FixedSizeList>
            <Spinner className={classes.spinner} tabContentLoader />
            <Ec2ResourcesTable
              onTerminateInstance={this.handleTerminateInstance}
              workerType={awsProvisionerWorkerType}
              awsState={awsProvisionerWorkerTypeState}
              actionLoading={actionLoading}
            />
          </FixedSizeList>
        )}
        {!error && !loading && currentTab === 2 && (
          <Button
            spanProps={{ className: classes.fab }}
            tooltipProps={{ title: 'Terminate All' }}
            disabled={
              actionLoading ||
              awsProvisionerWorkerTypeState.instances.length === 0
            }
            requiresAuth
            onClick={this.handleTerminateAllInstances}
            variant="round"
            className={classes.terminateButton}>
            <DeleteEmptyIcon />
          </Button>
        )}
        <Snackbar
          open={showTerminateAllInstancesSnackbar}
          onClose={this.handleSnackbarClose}
          autoHideDuration={FIVE_SECONDS}
          message="A request has been sent to terminate all instances."
        />
        <Snackbar
          open={showTerminateInstanceSnackbar}
          onClose={this.handleSnackbarClose}
          autoHideDuration={FIVE_SECONDS}
          message="A request has been sent to terminate the instance."
        />
      </Dashboard>
    );
  }
}
