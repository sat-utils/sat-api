# sat-api 

[![CircleCI](https://circleci.com/gh/sat-utils/sat-api.svg?style=svg)](https://circleci.com/gh/sat-utils/sat-api)

*One API to search public satellites metadata*

v1.0: This API uses Elastic Search as its engine and uses on AWS's Lambda and APIGateway to update and serve the data. A live API of the master branch is deployed to https://sat-api.developmentseed.org

v0.3.0 (sat-api legacy): A sat-api legacy version can be found on the [legacy branch ](https://github.com/sat-utils/sat-api/tree/legacy) and is deployed at https://api.developmentseed.org/satellites.

## SpatioTemporal Asset Catalog (STAC) compliant

A STAC is made up of `items`, which is data for a specific time and place. An `item` may contain multiple files (e.g., bands, quality data), but covers an identical geographical footprint for specific date and time. There are only a few so it is worth listing what the core fields are:

- `id`: A unique ID assigned by the data provider for this item.
- `geometry`: Polygon geojson geometry describing the area covered by the data
- `datetime`: The date and time of the item
- `provider`: Although an optional field, this is the name of the person or organization providing the data.
- `license`: The name of the license regarding data use.
- `assets`: This contains the individual resources that are accessed via a URI. Typically a web URL, this could also be a location on s3 of Google
- `links`: links are not the actual data, but any weblinks associated with the data. A 'self' link is required.

#### STAC extensions

The STAC specification is designed to be extended for different types of geospatial data, each of which may have different set of important metadata fields. LiDAR, Video, Mosaics, and Earth Observation imagery are all different types of data that could may eventually have their own extension.

The most common and immediate use case is what we call Earth Observeration data. This refers to raster imagery taken from a sensor at discreate date and time with multiple bands from the visible through long wave infrared. This may commonly be called a granule, or a scene, but in STAC it is referred to as an `item`.

Rather then get into the specifics of the EO spec, which can be found in the [stac-spec GitHub repository](https://github.com/radiantearth/stac-spec/blob/master/extensions/stac-eo-spec.md) I will instead use examples from sat-api.


## Searching sat-api

Now with an undersanding of how STAC items and collections work we can look at how to query data. Behind the scenes sat-api queries both collections and items to find matches, so that if you search for `eo:off_nadir=0`, it will return all of the Landsat-8 scenes even though `eo:off_nadir` doesn't appear in the `items` themselves, only in the landsat-8 collection.

Any metadata field that appears in the `items` or `collection` properties can be queried by providing those as parameters in the form of key=value as shown below.

- All scenes from August 2017:   
[https://sat-api.developmentseed.org/search/stac?datetime=2017-08](https://sat-api.developmentseed.org/search/stac?datetime=2017-08)
- Sentinel-2 collection scenes from August 2017:  
[https://sat-api.developmentseed.org/search/stac?datetime=2017-08&collection=sentinel-2](https://sat-api.developmentseed.org/search/stac?datetime=2017-08&collection=sentinel-2)
- Cloud-free Landsat-8 scenes from 2016:  
[https://sat-api.developmentseed.org/search/stac?datetime=2017&collection=landsat-8&eo:cloud_cover=0](https://sat-api.developmentseed.org/search/stac?datetime=2017&collection=landsat-8&eo:cloud_cover=0)

#### Range searches

For numeric fields a range of values can be specified by providing the begin and end values separated by a slash. 

- Landsat-8 scenes from 2016 with 0-20% cloud cover:  
[https://sat-api.developmentseed.org/search/stac?datetime=2017&collection=landsat-8&eo:cloud_cover=0/20](https://sat-api.developmentseed.org/search/stac?datetime=2017&collection=landsat-8&eo:cloud_cover=0/20)
- All scenes between Dec 31 2017 and Jan 1 2018:  
[https://sat-api.developmentseed.org/search/stac?datetime=2016-12-31/2017-01-01](https://sat-api.developmentseed.org/search/stac?datetime=2016-12-31/2017-01-01)

#### Geospatial searches

No search term is more important however than the a geospatial query to find data covering a specific area. The core STAC spec allows for searching by providing a bounding box, with more complex 'intersects' query to query against user provided polygons. Sat-api does not currently support the [simpler] bounding box query, but does support the 'intersects' query.

**Caveat emptor**: Due to the way sat-api does the two pronged search of collections and items, a side effect is that queries fields that are absent from both will match scenes. For example, if a typo occurs in your query like `datetme=2017-08`, then that parameter will be ignored but no warning will be issued. This problem will be fixed once we implement validators into the API.

## Deploy your own sat-api

Work is ongoing to simplify the deployment process, but the following steps should get you started:

1. Make sure you have AWS credentials with necessary access to AWS Lambda and AWS APIGateway (an admin level access will do enough).

2. To simplify deployment to AWS, we make use of [`kes`](http://devseed.com/kes/), a tool for CloudFormation deployment. It can be installed with:

       $ npm install -g kes

3. You MUST create a bucket on S3 that is used for storing deployment artifacts and metadata csv files.

4. Update `.kes/config.yml` and enter the name of the bucket.

5. If direct access to the elasticsearch instance is needed from fixed IP address, copy `.env.example` to `.env` and add your IP address there.

6. Deploy the system with `kes`. It can take some time for AWS to create the various resources, so be patient.

        $ kes cf deploy -r us-east-1
    
    Replace `us-east-1` with any desired region. This will deploy the CloudFormation stack, which includes:

    * API Gateway
    * Lambda functions
    * Step Functions
    * CloudWatch Rules
    * Elasticsearch
    * Associated IAM Roles

    Additional calls of `kes cf deploy` will update the existing CloudFormation stack (see below on building the deployment distribution).

7. Once the system is initialized, go to the API Gateway console and select the "sat-api-..." entry, click on the _Settings_ menu, and then click _Add Binary Media Type_ option and add `'*'` as the Binary media type.

The Landsat and Sentinel ingestors are run as Step Functions every 12 hours (Landsat at 6:00 and 18:00, Sentinel at 0:00 and 12:00), as can be seen under the CloudWatch Rules console. They can be disabled from the console.

### Elasticsearch Management

A Lambda function is included that provides Elasticsearch management functions from within the AWS Lambda Console. Navigate to the Lambda functions console for the region the sat-api stack has been deployed to and locate the *stackName*-manager Lambda function. From here you can configure test events that consist of a JSON payload.

```
{
    "action": action,
    "index": "items" or "collections"
}
```

Unless it has been changed in the code, the main index used in the Elasticsearch instance will always be sat-api. The action parameter can be:

- `putMapping`: Puts a new mapping for indexing. This is done automatically during ingestion if it does not already exist so should never need to be used directly.
- `deleteIndex`: This deletes the index. Use with caution!
- `listIndices`: This returns a list of all indices. Unless some have been added should include 'items', 'collections' and '.kibana'
- `reindex`: Spawns a reindexing of all records

## Development

A live API of the develop branch is auto-deployed to https://sat-api.developmentseed.org

To further develop the API, install dependenceis with yarn and build the files for deployment (using webpack). This creates moduels under dist/ that can be deployed as the Lambda function source code.

    $ yarn
    $ yarn bootstrap
    $ yarn build

    # to continually watch and build source files
    $ yarn watch

As noted above, running `kes cf deploy ...` will update the CloudFormation deployment with the latest build.

## About

[sat-api](http://github.com/sat-utils/sat-api.git) was made by [Development Seed](http://developmentseed.org).
