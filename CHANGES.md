# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/cumulus-nasa/cumulus/compare/v0.0.2...HEAD
[v0.0.2]: https://github.com/cumulus-nasa/cumulus/compare/v0.0.1...v0.0.2
[legacy-v2.0.0]: https://github.com/sat-utils/sat-api/tree/legacy