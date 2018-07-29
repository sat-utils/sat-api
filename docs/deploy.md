# Example sat-api Deployment

This deployment powers https://sat-api.developmentseed.org/search. We use [kes](https://www.npmjs.com/package/kes) to deploy sat-api as an application to AWS.

For the deployment to work we use a kes template included in the [@sat-utils/api](https://www.npmjs.com/package/@sat-utils/api) package. This package has all the necessary resources needed for a successful deployment of sat-api.

You can override all the configurations and options in this template by adding override files to the `.kes/config.yml` folder.

## Install

     $ yarn install

## Deploy with unpublished code

If you need to use the latest code on the master branch that is not released to npm yet, or if you need to do live development on an instance deployed to AWS (not recommended), you should follow these steps:

- Clone this repo and install requirements ([follow](../README.md#local-installation))
- At the repo root run: `yarn linkall` (this will link packages to your local npm).
- In the deployment repository (e.g. `example` folder) run the link command with the package name you are using:
    - `yarn link @sat-utils/api`
    - In the `example` folder we have included a shortcut: `yarn linkall`
- Verify packages are linked: `ls -la node_modules/@sat-utils`
    - This show an output similar to: `lrwxr-xr-x 1 user staff 29 Jul 11 14:19 api -> ../../../sat-api/packages/api`

To restore packages from npm just run `yarn`.

## Deploy an instance

Make sure the you add a deployment to `.kes/config.yml` by adding the following to the file:

```yaml
name-of-my-deployment:
  stackName: <name-of-my-stack>
  system_bucket: <a s3 bucket I have access to>
```

Then run this command:

     $ ./node_modules/.bin/kes cf deploy --region us-east-1 --profile <profile-name> --template node_modules/@sat-utils/api/template --deployment <name-of-deployment> --showOutputs

The command will return the api endpoint that is created by the operation.

The Landsat and Sentinel ingestors are run as Step Functions every 12 hours (Landsat at 6:00 and 18:00, Sentinel at 0:00 and 12:00), as can be seen under the CloudWatch Rules console. They can be disabled from the console.

### Deploy Devseed's Dev stack

This command only works if you have access to Devseed's AWS account

     $ ./node_modules/.bin/kes cf deploy --region us-east-1 --template node_modules/@sat-utils/api/template --deployment dev --profile <replace-me> --showOutputs

### Deployer Role

For the CI environment, we use a special IAM role that is assumed by an AWS user. This will allow us to give limited access to the user that is used inside the CI build environment.

To create the deployer role run:

     $ ./node_modules/.bin/kes cf deploy --kes-folder deployer --profile ds --region us-east-1 --showOutputs

Then create a user on AWS and give it this policy permission. Replase the value of the resource with the output of the previous command:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "sts:AssumeRole",
            "Resource": "<arn:DeployerRole>"
        }
    ]
}
```

When running the deployment command make sure to [include the `--role` flag](.circleci/config.yml#L17).