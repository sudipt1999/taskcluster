# Taskcluster Terraform

A simple module to set up some requirements for a taskcluster deployment.

To use this module, you must have configured the following terraform providers
in your module:

- aws
- azurerm
- kubernetes

You will also need to `kubectl config use-context <the cluster you wish to deploy to>`
in the shell you are applying this from.

## Requirements not managed here

- A kubernetes cluster
- An ingress controller that can handle rewrites in said cluster

## Usage

First include this module in your terraform.

```
module "taskcluster" {
  source                    = "github.com/taskcluster/taskcluster-terraform"
  bucket_prefix             = "${var.taskcluster_bucket_prefix}"
  azure_resource_group_name = "${var.azure_resource_group_name}"
  azure_region              = "${var.azure_region}"
  auth_pulse_username       = "${var.auth_pulse_username}"
  auth_pulse_password       = "${var.auth_pulse_password}"
}
```

Before you apply, you should `kubectl config use-context <the cluster you wish to deploy to>`
Now you can take the output from this module and feed it into the `infra` config for
your [taskcluster-installer](https://github.com/taskcluster/taskcluster-installer):

```
terraform output -json | jq '.taskcluster_installer_config.value' > some-config-file.json
```

The root accessToken is also available as output.


## TODO

- [ ] Ensure documentation for all variables and outputs
