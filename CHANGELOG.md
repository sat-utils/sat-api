# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [v0.2.1] - 2019-01-17

### Fixed
- Error handling of Items failing to get written to Elasticsearch. Now will continue traversing catalog.


## [v0.2.0] - 2019-01-16

### Changed
- Implemented the changes in [STAC 0.6.0](https://github.com/radiantearth/stac-spec/blob/master/CHANGELOG.md)
- All functionality relating to handling a STAC API path and query parameters has been moved into a the api.js module. The simplified lambda handler now passes query parameters or POST body through to the `api.js` module.
- API now only supports STAC compliant query parameters and filters.
- All functionality and references relating to Elasticsearch have been migrated into the es.js module to faciltate separation of concerns and abstract data storage.
- Refactored Elasticsearch queries and ES mappings to search and share fields with the properties nested type. Now, only fields under a Collections properties are inherited by the Item.
- Elasticsearch queries have been updated to use non-scoring filters to improve performance and return more intuitive results.
- Elasticsearch writing has been modified to use bulk updates whenever possible to improve throughput.
- Ingest has been updated to use concurrent file requests (to a user defined limit) to improve throughput.
- Ingest now supports a Fargate mode to run as a Fargate task rather than as a Lambda.
- API documentation generation now uses OpenAPI definitions processed by widdershins and shins.
- Unit and integration test coverage for all  modules.

### Removed
- Manager module: Removed in favor of Kibana for Elasticsearch administration and management tasks.
- Landsat and Sentinel lambda functions: Data is now ingested via the ingest Lambda.  It can be invoked with individual SNS messages or run in batch mode to ingest larger catalogs.
- Deployment files: Deployment related templates and code have been migrated to [https://github.com/sat-utils/sat-api-deployment](https://github.com/sat-utils/sat-api-deployment)

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
[v0.2.1]: https://github.com/sat-utils/sat-api/compare/v0.2.0...v0.2.1
[v0.2.0]: https://github.com/sat-utils/sat-api/compare/v0.1.0...v0.2.0
[v0.1.0]: https://github.com/sat-utils/sat-api/compare/v0.0.2...v0.1.0
[v0.0.2]: https://github.com/sat-utils/sat-api/compare/legacy-v2.0.0...v0.0.2
[legacy-v2.0.0]: https://github.com/sat-utils/sat-api/tree/legacy
