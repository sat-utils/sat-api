# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]


## [v0.2.0] - 2018-11-02

### Added
- links now all connect to each other between STAC catalog, Datasets (?), and Items. STAC points to all Datasets, each Dataset points to items. items point to STAC catalog as 'root' and Dataset as 'parent'.

### Changed
- implemented the changes in [STAC 0.6.0](https://github.com/radiantearth/stac-spec/blob/master/CHANGELOG.md)
- All functionality and references relating to Elasticsearch have been moved into the es.js module, and is now abstracted enough so that it could be replaced by another backend like PostGIS.
- All functionality relating to handling a STAC API path has been moved into a the api.js module. This greatly simplifies the API lambda handler function, which now just determines the requested endpoint from the headers, gets the payload from POST or GET, and passes it all on, along with query parameters, to the api module.
- refactored Elasticsearch queries and ES mappings to search and share fields with the properties nested type. Now, only fields under a Collections properties are inherited by the Item.
- Elasticsearch query parameters updated, should be faster and more accurate as all unique text fields (ID, instrument, etc.) are property mapped as keywords and exact matches are used as term queries rather than previous behavior or scoring based on text similarity.

### Removed
- manager module: it wasn't doing much (delete an elasticsearch index and reindex elasticsearch) and was not necessary given the much better elasticsearch admin tools like Kibana, which do that and more.
- Landsat and Sentinel lambda functions: Data is ingested via the ingest Lambda from SNS messages, or using the ingest catalog script.


## [v0.1.0] - 2018-09-18

### Fixed
- Fixed broken ingests for Landsat and Sentinel

## [v0.0.2]

### Added
- Added support for [STAC specification](https://github.com/radiantearth/stac-spec/)
- The following packages are released
  - @sat-utils/api
  - @sat-utils/api-lib
  - @sat-utils/ingest
  - @sat-utils/landsat
  - @sat-utils/sentinel
  - @sat-utils/manager
- A new document is added on how to configure and deploy and instance of sat-api

### Changed
- All lambdas and packages moved to `/packages` and lerna is used for managing them
- npm packages are published under `@sat-utils` org on npm

### Removed
- /geojson endpoint
- /count endpoint

## [legacy-v2.0.0] - 2018-01-01

- Moves all the metadata indexing logics to the same repo
- Uses CloudFormation for full deployment
- Includes a better ApiGateway support
- Use streams to read, transform, and write into elasticsearch
- Use batches of lambdas to speed up processing
- Refactor several modules: metadata, landsat, sentinel
- Refactor and improve splitting

[Unreleased]: https://github.com/sat-utils/sat-api/compare/master...develop
[v0.2.0]: https://github.com/sat-utils/sat-api/compare/v0.1.0...v0.2.0
[v0.1.0]: https://github.com/sat-utils/sat-api/compare/v0.0.2...v0.1.0
[v0.0.2]: https://github.com/sat-utils/sat-api/compare/legacy-v2.0.0...v0.0.2
[legacy-v2.0.0]: https://github.com/sat-utils/sat-api/tree/legacy