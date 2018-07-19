# sat-api 

[![CircleCI](https://circleci.com/gh/sat-utils/sat-api.svg?style=svg)](https://circleci.com/gh/sat-utils/sat-api)

Sat-api is a STAC compliant web API for searching and serving satellite imagery metadata. Development Seed runs an instance of it for Landsat and Sentinel imagery hosted on AWS. You can access this instance at https://sat-api.developmentseed.org.

An older version of sat-api can be found on the [legacy branch ](https://github.com/sat-utils/sat-api/tree/legacy) and is deployed at https://api.developmentseed.org/satellites.

This repo includes a number of npm packages that are used to create and populate an instance of sat-api. For the full list of packages go to:
https://www.npmjs.com/org/sat-utils

## Documentation

Access the documenation [here](docs) or on [gitbook](https://sat-utils.gitbook.io/sat-api/).

## Development

### Local Installation

    $ yarn
    $ yarn bootstrap
    $ yarn build

    # to continually watch and build source files
    $ yarn watch

### Run Docs locally

    $ yarn docs-serve

## Use Unreleased Version in Deployed Instances

If you need to use the latest code on the master branch that is not released to npm yet, or if you need to do live development on an instance deployed to AWS (not recommended), you should follow these steps:

- Clone this repo and install requirements ([follow](#local-installation))
- Run: `yarn linkall` (this will link packages to your local npm).
- In the deployment repository (e.g. [sat-api-deployment](https://github.com/sat-utils/sat-api-deployment#deploy-an-instance)) run the link command with the package name you are using:
    - `yarn link @sat-utils/api`
- Verify packages are linked: `ls -la node_modules/@sat-utils`
    - This show an output similar to: `lrwxr-xr-x 1 user staff 29 Jul 11 14:19 api -> ../../../sat-api/packages/api`

## Deployment

To create a new version for npm:

- create a new branch from master
- `$ yarn update`
- Follow the prompt and select the correct the version, then commit the changes.
- Update [CHANGES.md](CHANGES.md).
- Tag your branch with the same version number
- Make a PR
- When the PR is merged, the npm packages are automatically deployed to npm

### Manual Deployment

**WARNING:** This is not recommended. Only use it if absolutely necessary.

- create a new branch from master
- `$ yarn update`
- Follow the prompt and select the correct the version, then commit the changes.
- Update [CHANGES.md](CHANGES.md).
- Tag your branch with the same version number
- Run: `./node_modules/.bin/lerna publish --skip-git --repo-version <replace-version> --yes --force-publish=* --npm-client=npm`

## About

[sat-api](http://github.com/sat-utils/sat-api.git) was made by [Development Seed](http://developmentseed.org).
