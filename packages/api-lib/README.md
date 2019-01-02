## @sat-utils/api-lib

### Unit Tests
```
$ yarn
$ yarn test
```

### Integration Tests
Navigate to the integration directory
```
$ cd ./tests/integration
```
Use the environment variable `DOCKER_NAME` to set your Docker host name.
Normally `localhost`.
```
$ export DOCKER_NAME=localhost
```
To run the tests
```
$ ./runIntegration.sh
```

### Environment variables

`AWS_REGION`
`AWS_ACCESS_KEY_ID`
`AWS_SECRET_ACCESS_KEY`
`ES_HOST`
`ES_BATCH_SIZE`
`STAC_ID`
`STAC_TITLE`
`STAC_DESCRIPTION`
`STAC_VERSION`

### About
Sat API Lib was made by [Development Seed](http://developmentseed.org).
