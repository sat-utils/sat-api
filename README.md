## Satellite API

[![Build Status](https://travis-ci.org/sat-utils/sat-api.svg?branch=develop)](https://travis-ci.org/sat-utils/sat-api)

*One API to search public Satellites metadata*

A live version of this API is deployed to https://api.developmentseed.org/satellites.

This API uses Elastic Search as its engine and uses on AWS's Lambda and APIGateway to update and serve the data.

### Develop

To further develop a deployed version of the API, make sure you have AWS credentials with necessary access to AWS Lambda and AWS APIGateway (an admin level access will do enough):

    $ yarn install
    $ yarn run watch

## Deploy:

### New deployment:

    $ kes cf create

### Updates

If you make changes to the source code, use command below to update with CloudFormation:

    $ kes cf update

`develop` branch is deployed to staging.

`master` is deployed to production.

### About
The Sat API was made by [Development Seed](http://developmentseed.org).

