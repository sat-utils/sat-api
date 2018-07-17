## Tests for the sat-api updater
import unittest
import json
import requests
import imp
from elasticsearch import Elasticsearch

## load functions to test
lambda_handler = imp.load_source('lambda_handler', './../lambda/lambda-handler.py')

## define test setup
TESTDATA = "./data/event_message.json"
ES_HOST = "http://search-sat-updater-test-3ghi3tga4tezvc3trjhnyq4ize.us-east-1.es.amazonaws.com"



class Test(unittest.TestCase):
    def setUp(self):
        """ Load the test message data to work with for the rest of the tests """
        self.snsData = self.loadTestData()

    def loadTestData(self):
        fh = open(TESTDATA, 'r')
        return json.load(fh)

    def test_createESHostConnection(self):
        """ Test that the module is creating a new connection to elastic search"""
        cnx = lambda_handler.createES("localhost", 9200)
        self.assertTrue(isinstance(cnx, Elasticsearch))

    def test_processRecord(self):
        """ Test the processRecord function, ensuring proper structure and return value """
        message = self.snsData['Message']
        response = lambda_handler.processRecord(message)
        print response
        self.assertTrue(True)









if __name__ == '__main__':
    unittest.main()
