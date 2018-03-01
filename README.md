# Satellite API

[![CircleCI](https://circleci.com/gh/sat-utils/sat-api.svg?style=svg)](https://circleci.com/gh/sat-utils/sat-api)

*One API to search public Satellites metadata*

**Note**: This is the legacy (<1.0) version of sat-api and lives on the *legacy* branch of [sat-api](https://github.com/sat-utils/sat-api). The legacy version of sat-search (<1.0) can be used as a client with this API.

# sat-api

This API uses Elastic Search as its engine and uses on AWS's Lambda and APIGateway to update and serve the data. A live API of the master branch is deployed to https://api.developmentseed.org/satellites.

Documentation is available at http://docs.sat-utils.org/ and can be contributed to [here](https://github.com/sat-utils/sat-api-express/).

## Deployment

First, make sure you have AWS credentials with necessary access to AWS Lambda and AWS APIGateway (an admin level access will do enough):

- You MUST create a bucket on S3 that is used for storing deployment artifacts and metadata csv files.
- Update `.kes/config.yml` and enter the name of the bucket.
- If direct access to the elasticsearch instance is needed from fixed IP address, copy `.env.example` to `.env` and add your IP address there.
-  In the APIGateway console select the sat-api, click on the Binary Support menu on the left and add `'*'` as the Binary media type.

    $ kes cf deploy -r us-east-1
    
Replace us-east-1 with any desired region. This will deploy the CloudFormation stack, which includes API Gateway, Lambda functions, Step Functions, CloudWatch Rules, Elasticsearch, and associated IAM Roles. Additional calls of 'kes cf deploy' will update the existing CloudFormation stack.

The Landsat and Sentinel ingestors are run as Step Functions every 12 hours (Landsat at 6:00 and 18:00, Sentinel at 0:00 and 12:00), as can be seen under the CloudWatch Rules console. They can be disabled from the console.

## Elasticsearch Management

A Lambda function is included that provides Elasticsearch management functions from within the AWS Lambda Console. Navigate to the Lambda functions console for the region the sat-api stack has been deployed to and locate the *stackName*-manager Lambda function. From here you can configure test events that consist of a JSON payload.

```
{
    "action": action,
    "index": "sat-api"
}
```

Unless it has been changed in the code, the main index used in the Elasticsearch instance will always be sat-api. The action parameter can be:

- putMapping: Puts a new mapping for indexing. This is done automatically during ingestion if it does not already exist so should never need to be used directly.
- deleteIndex: This deletes the index. Use with caution!
- listIndices: This returns a list of all indices. Unless some have been added should include 'sat-api' and '.kibana'
- reindex: Spawns a reindexing of all records

## Development

To further develop the API, install dependenceis with yarn and build the files for deployment (using webpack). This creates moduels under dist/ that can be deployed as the Lambda function source code.

    $ yarn install
    $ yarn build

    # to continually watch and build source files
    $ yarn run watch

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
