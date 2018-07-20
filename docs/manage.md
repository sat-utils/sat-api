# Elasticsearch Management

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