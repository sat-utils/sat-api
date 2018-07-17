## This is Sat-Updater
## Updates sat-api upon receipt of SNS notification of new scene in AWS s3 bucket
## Designed to be run as AWS lambda function

## import modules
import json
from sentinel_s3 import single_metadata
from copy import copy
from collections import OrderedDict
from elasticsearch import Elasticsearch, RequestError
import os
import logging
import datetime

## define constants
s3_url = "http://sentinel-s2-l1c.s3.amazonaws.com"
es_index = 'sat-api'
es_type = 'sentinel2'
es_host = os.getenv("ES_HOST", "") # do not include 'http://' here
es_port = os.getenv("ES_PORT", 80)

logger = logging.getLogger('sentinel.meta.update')

def lambda_handler(event, context):
    """Sat-api update function for AWS lambda

        This function is called when the SNS is received, and buses the message
        to the parsing and updating functions.
    """
    print event
    print context
    logging.info("New message received.")
    # create the connection to the elastic search instance
    createES(es_host, es_port)
    records = event['Records']
    result = {
        'processed': 0,
        'error' : 0,
        'total' : 0
    }
    for record in records:
        ## SNS body contains array of records
        logging.info("Processing record....")
        message = record['Sns']['Message']
        print message
        try:
            processRecord(message) ##
            logging.info("Record Processed... Done.")
            result['processed'] += 1
        except Exception as e:
            logging.error("error:", str(e))
            result['error'] += 1
        result['total'] += 1
    return result

def processRecord(message):
    """Process the contents of the incoming message"""
    name = message['name'] # name of product that has been updated
    esWriter = elasticsearch_updater
    metadata = single_metadata(name, ".", writers = [esWriter])
    return metadata

def createES(host, port):
    global es
    es = Elasticsearch([{
        'host': host,
        'port': port
    }])
    logger.debug("Elastic search connector created.")
    return es


def meta_constructor(metadata):
    """Prepare the metadata for ingestion into elastic search

    From: https://github.com/sat-utils/sentinel2-metadata/blob/master/main.py#L45
    """
    internal_meta = copy(metadata)

    scene_id = 'S2A_tile_{0}_{1}{2}{3}_{4}'.format(
        metadata['date'].replace('-', ''),
        metadata['utm_zone'],
        metadata['latitude_band'],
        metadata['grid_square'],
        int(metadata['aws_path'].split('/')[-1])
    )

    body = OrderedDict([
        ('scene_id', scene_id),
        ('original_scene_id', internal_meta.pop('tile_name')),
        ('satellite_name', metadata.get('spacecraft_name', 'Sentintel-2A')),
        ('cloud_coverage', metadata.get('cloudy_pixel_percentage', 100)),
    ])

    body.update(internal_meta)

    try:
        body['data_geometry'] = body.pop('tile_data_geometry')
    except KeyError:
        pass

    return body

def elasticsearch_updater(product_dir, metadata):
    """ Update the elastic search instance with the scene metadata

    From https://github.com/sat-utils/sentinel2-metadata/blob/master/main.py#L73
    """
    try:
        body = meta_constructor(metadata) # format the metadata for ingestion
        print body
        try:
            es.index(index=es_index, doc_type=es_type, id=body['scene_id'],
                     body=body)
        except RequestError:
            body['data_geometry'] = None
            es.index(index=es_index, doc_type=es_type, id=body['scene_id'],
                     body=body)
    except Exception as e:
        logger.error('Unhandled error occured while writing to elasticsearch. Details: %s' % e.__str__())

## For local testing
# if __name__ == "__main__":
#     testMessage = json.load(open("./tests/data/event_message.json", 'r'))
#     lambda_handler(testMessage, None)
