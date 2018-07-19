# Deploy your own sat-api

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

