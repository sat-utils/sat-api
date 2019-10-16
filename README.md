# sat-api 

[![CircleCI](https://circleci.com/gh/sat-utils/sat-api.svg?style=svg)](https://circleci.com/gh/sat-utils/sat-api)

Sat-api is a STAC compliant web API for searching and serving metadata for geospatial data (including but not limited to satellite imagery).

Development Seed runs an instance of sat-api for the Landsat-8 and Sentinel-2 imagery that is [hosted on AWS](https://aws.amazon.com/earth/). You can access this at https://sat-api.developmentseed.org using the [API documentation](http://sat-utils.github.io/sat-api/) for reference and examples.

The STAC version supported by a given version of sat-api is shown in the table below. Additional information can be found in the [CHANGELOG](CHANGELOG.md)

| sat-api | STAC  |
| -------- | ----  |
| 0.1.0    | 0.5.x |
| 0.2.x    | 0.6.x |
| 0.3.x    | 0.7.x |
| 0.4.x    | 0.8.x |


## Development

Sat-api includes a number of NPM packages (in the packages/ directory) that are used to create and populate an instance of sat-api. See the [sat-utils org on NPM](https://www.npmjs.com/org/sat-utils) for the full list of packages. [Lerna](https://github.com/lerna/lerna) is used for for managing these packages.

The latest version released is on the [master branch](https://github.com/sat-utils/sat-api/tree/master), and the latest development version is on the [develop](https://github.com/sat-utils/sat-api/tree/develop) branch.

### Building local version

    # Install dependencies in package.json
    $ yarn

    # Run lerna boostrap to link together packages and install those package dependencies
    $ yarn bootstrap

    # Run the build command in each of the packages (runs webpack)
    $ yarn build

    # To continually watch and build source files
    $ yarn watch

    # To run tests for all packages
    $ yarn test

### Building API docs

    # To build API docs from the api spec
    $ yarn build-api-docs

### Creating a release

To create a new version for npm:

- create a new branch from master
- `$ yarn update`
- Follow the prompt and select the correct the version, then commit the changes.
- Update [CHANGELOG.md](CHANGELOG.md).
- Tag your branch with the same version number
- Make a PR
- When the PR is merged to master, the npm packages are automatically deployed to npm
- In GitHub create a release with the version (prefixed with 'v') and paste in the CHANGELOG section. This will create a GitHub release and a tag.


## About

[sat-api](https://github.com/sat-utils/sat-api) was created by [Development Seed](<http://developmentseed.org>) and is part of a collection of tools called [sat-utils](https://github.com/sat-utils).
