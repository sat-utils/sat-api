# Satellite API

[![CircleCI](https://circleci.com/gh/sat-utils/sat-api.svg?style=svg)](https://circleci.com/gh/sat-utils/sat-api)

*One API to search public Satellites metadata*

This API uses Elastic Search as its engine and uses on AWS's Lambda and APIGateway to update and serve the data. A live API of the master branch is deployed to https://api.developmentseed.org/satellites.

Documentation is available at http://docs.sat-utils.org/ and can be contributed to [here](https://github.com/sat-utils/sat-api-express/).

## Develop

To further develop the API, install dependenceis with yarn, then build the files for deployment.

    $ yarn install
    $ yarn run watch

Running 'yarn run watch' will continually watch the source files and update the distribution files as needed. The distribution files are made with webpack and are what end up getting deployed as Lambda function source code.

## Deployment

First, make sure you have AWS credentials with necessary access to AWS Lambda and AWS APIGateway (an admin level access will do enough):

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

You should also go the APIGateway console, select the sat-api, click on the Binary Support menu on the left and then add `'*'` as the Binary media type.

You can find the API's url in your ApiGateway service page. To populate elasticsearch, go to CloudWatch/rules and activate the landsat and sentinel scheduled events. This will run the updater every 12 hours.

If you make changes to the source code, use command below to update with CloudFormation:

    $ kes cf update


## API Usage Examples

* search globally for Sentinel 2 coverage for 1st of January 2017
  `https://api.developmentseed.org/satellites/?limit=100&satellite_name=sentinel-2&date_from=2017-01-01&date_to=2017-01-02`
* search for Sentinel 2 tile '32UMG'
  `https://api.developmentseed.org/satellites/?limit=100&search=scene_id:S2*201707*32UMG*`
* search for Landsat 8 scenes that contain a lon,lat point and maximum cloud cover 20%
  `https://api.developmentseed.org/satellites/?limit=100$satellite_name=landsat-8&contains=12.568337,55.676098&cloud_to=20`
* search for Landsat 8 scenes since 2017-01-01 that intercect some GeoJSON polygon
  `https://api.developmentseed.org/satellites/?limit=100$satellite_name=landsat-8&date_from=2017-01-01&intersects={"type":"Polygon","coordinates":[[[12.10968017578125,55.443037320687935],[12.94189453125,55.443037320687935],[12.94189453125,55.85064987433714],[12.10968017578125,55.85064987433714],[12.10968017578125,55.443037320687935]]]}`

## About
[sat-api](http://github.com/sat-utils/sat-api.git) was made by [Development Seed](http://developmentseed.org).

