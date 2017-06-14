## Satellite API

[![CircleCI](https://circleci.com/gh/sat-utils/sat-api.svg?style=svg)](https://circleci.com/gh/sat-utils/sat-api)

*One API to search public Satellites metadata*

A live version of this API is deployed to https://api.developmentseed.org/satellites.

This API uses Elastic Search as its engine and uses on AWS's Lambda and APIGateway to update and serve the data.

### Develop

To further develop a deployed version of the API, make sure you have AWS credentials with necessary access to AWS Lambda and AWS APIGateway (an admin level access will do enough):

    $ yarn install
    $ yarn run watch

## Deploy:

### New deployment:

You MUST create a bucket on S3 that is used for storing deployment artifacts and metadata csv files.

Update `.kes/config.yml` and enter the name of the bucket. Also, if you want to access the elasticsearch instance directly from fixed IP address, copy `.env.example` to `.env` and add your IP address there.

There are more configurations that you can update on `.kes/config.yml` before deployment.

    $ kes cf create

Then go to your AWS Lambda Console and open the `sat-api-dev-manager` function.

Run the function with the below payload to create the elasticsearch index with approporiate mapping:

```
{
   "action": "putMapping",
   "index": "sat-api"
}
```

You should also go the APIGateway console, select the sat-api, click on the Binary Support menu on the left and then add '*' as the Binary media type.

You can find the API's url in your ApiGateway service page. To populate elasticsearch, go to CloudWatch/rules and activate the landsat and sentinel scheduled events. This will run the updater every 12 hours.

### Updates

If you make changes to the source code, use command below to update with CloudFormation:

    $ kes cf update

`develop` branch is deployed to staging.

`master` is deployed to production.

### About
The Sat API was made by [Development Seed](http://developmentseed.org).

