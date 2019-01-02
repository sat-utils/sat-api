---
title: The SAT-API
language_tabs:
  - nodejs: NodeJS
  - python: Python
toc_footers: []
includes: []
search: false
highlight_theme: darkula
headingLevel: 2

---

<h1 id="the-sat-api">The SAT-API v0.2.0</h1>

> Scroll down for code samples, example requests and responses. Select a language for code samples from the tabs above or the mobile navigation menu.

Sat-api is a STAC compliant web API for searching and serving metadata for geospatial data (including but not limited to satellite imagery). Development Seed runs an instance of sat-api for the Landsat-8 and Sentinel-2 imagery that is hosted on AWS.

Base URLs:

* <a href="https://sat-api.developmentseed.org/">https://sat-api.developmentseed.org/</a>

* <a href="https://sat-api-dev.developmentseed.org/">https://sat-api-dev.developmentseed.org/</a>

Email: <a href="mailto:info@developmentseed.org">Development Seed</a> Web: <a href="https://developmentseed.org/contacts/">Development Seed</a> 
License: <a href="https://github.com/sat-utils/sat-api/blob/master/LICENSE">MIT License</a>

<h1 id="the-sat-api-stac">STAC</h1>

Extension to WFS3 Core to support STAC metadata model and search API

## Return the root catalog or collection.

> Code samples

```nodejs
const fetch = require('node-fetch');

const headers = {
  'Accept':'application/json'

};

fetch('https://sat-api.developmentseed.org/stac',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('https://sat-api.developmentseed.org/stac', params={

}, headers = headers)

print r.json()

```

`GET /stac`

Returns the root STAC Catalog or STAC Collection that is the entry point for users to browse with STAC Browser or for search engines to crawl. This can either return a single STAC Collection or more commonly a STAC catalog that usually lists sub-catalogs of STAC Collections, i.e. a simple catalog that lists all collections available through the API.

> Example responses

> 200 Response

```json
{
  "stac_version": "0.6.0",
  "id": "naip",
  "title": "NAIP Imagery",
  "description": "Catalog of NAIP Imagery.",
  "links": [
    {
      "href": "http://www.geoserver.example/stac/naip/child/catalog.json",
      "rel": "child",
      "type": "application/json",
      "title": "NAIP Child Catalog"
    }
  ]
}
```

<h3 id="return-the-root-catalog-or-collection.-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|A catalog json definition. Used as an entry point for a crawler.|[catalogDefinition](#schemacatalogdefinition)|

<aside class="success">
This operation does not require authentication
</aside>

## Search STAC items by simple filtering.

<a id="opIdgetSearchSTAC"></a>

> Code samples

```nodejs
const fetch = require('node-fetch');

const headers = {
  'Accept':'application/geo+json'

};

fetch('https://sat-api.developmentseed.org/stac/search',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```python
import requests
headers = {
  'Accept': 'application/geo+json'
}

r = requests.get('https://sat-api.developmentseed.org/stac/search', params={

}, headers = headers)

print r.json()

```

`GET /stac/search`

Retrieve Items matching filters. Intended as a shorthand API for simple queries.

<h3 id="search-stac-items-by-simple-filtering.-parameters">Parameters</h3>

|Parameter|In|Type|Required|Description|
|---|---|---|---|---|
|bbox|query|array[number]|false|Only features that have a geometry that intersects the bounding box are|
|time|query|string|false|Either a date-time or a period string that adheres to RFC3339. Examples:|
|limit|query|integer|false|The optional limit parameter limits the number of items that are|
|query|query|string|false|query for properties in items. Use the JSON form of the queryFilter used in POST.|
|sort|query|[sort](#schemasort)|false|Allows sorting results by the specified properties|

#### Detailed descriptions

**bbox**: Only features that have a geometry that intersects the bounding box are
selected. The bounding box is provided as four or six numbers,
depending on whether the coordinate reference system includes a
vertical axis (elevation or depth):

* Lower left corner, coordinate axis 1
* Lower left corner, coordinate axis 2
* Lower left corner, coordinate axis 3 (optional)
* Upper right corner, coordinate axis 1
* Upper right corner, coordinate axis 2
* Upper right corner, coordinate axis 3 (optional)

The coordinate reference system of the values is WGS84
longitude/latitude (http://www.opengis.net/def/crs/OGC/1.3/CRS84) unless
a different coordinate reference system is specified in the parameter
`bbox-crs`.

For WGS84 longitude/latitude the values are in most cases the sequence
of minimum longitude, minimum latitude, maximum longitude and maximum
latitude. However, in cases where the box spans the antimeridian the
first value (west-most box edge) is larger than the third value
(east-most box edge).

If a feature has multiple spatial geometry properties, it is the
decision of the server whether only a single spatial geometry property
is used to determine the extent or all relevant geometries.

**time**: Either a date-time or a period string that adheres to RFC3339. Examples:
* A date-time: "2018-02-12T23:20:50Z" * A period: "2018-02-12T00:00:00Z/2018-03-18T12:31:12Z" or "2018-02-12T00:00:00Z/P1M6DT12H31M12S"
Only features that have a temporal property that intersects the value of `time` are selected. If a feature has multiple temporal properties, it is the decision of the server whether only a single temporal property is used to determine the extent or all relevant temporal properties.

**limit**: The optional limit parameter limits the number of items that are
presented in the response document.

Only items are counted that are on the first level of the collection in
the response document. Nested objects contained within the explicitly
requested items shall not be counted.

* Minimum = 1
* Maximum = 10000
* Default = 10

> Example responses

> 200 Response

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "CS3-20160503_132130_04",
      "bbox": [
        -122.59750209,
        37.48803556,
        -122.2880486,
        37.613537207
      ],
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -122.308150179,
              37.488035566
            ],
            [
              -122.597502109,
              37.538869539
            ],
            [
              -122.576687533,
              37.613537207
            ],
            [
              -122.2880486,
              37.562818007
            ],
            [
              -122.308150179,
              37.488035566
            ]
          ]
        ]
      },
      "properties": {
        "datetime": "2016-05-03T13:21:30.040Z"
      },
      "links": [
        {
          "rel": "self",
          "href": "http://https://sat-api.developmentseed.org/collections/landsat-8-l1/items/LC80100102015050LGN00.json"
        }
      ],
      "assets": {
        "analytic": {
          "title": "4-Band Analytic",
          "href": "http://cool-sat.com/LC80100102015050LGN00/band4.tiff",
          "type": "image/tiff"
        },
        "thumbnail": {
          "title": "Thumbnail",
          "href": "http://cool-sat.com/LC80100102015050LGN00/thumb.png",
          "type": "image/png"
        }
      }
    }
  ],
  "links": [
    {
      "rel": "next",
      "href": "http://https://sat-api.developmentseed.org/collections/landsat-8-l1/items/gasd312fsaeg"
    }
  ]
}
```

<h3 id="search-stac-items-by-simple-filtering.-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|A feature collection.|[itemCollection](#schemaitemcollection)|
|default|Default|An error occurred.|[exception](#schemaexception)|

<aside class="success">
This operation does not require authentication
</aside>

## Search STAC items by full-featured filtering.

<a id="opIdpostSearchSTAC"></a>

> Code samples

```nodejs
const fetch = require('node-fetch');
const inputBody = '{
  "bbox": [
    -110,
    39.5,
    -105,
    40.5
  ],
  "time": "2018-02-12T00:00:00Z/2018-03-18T12:31:12Z",
  "intersects": null,
  "query": {
    "eo:cloud_cover": {
      "lt": 50
    }
  },
  "sort": [
    {
      "field": "eo:cloud_cover",
      "direction": "desc"
    }
  ]
}';
const headers = {
  'Content-Type':'application/json',
  'Accept':'application/geo+json'

};

fetch('https://sat-api.developmentseed.org/stac/search',
{
  method: 'POST',
  body: inputBody,
  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```python
import requests
headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/geo+json'
}

r = requests.post('https://sat-api.developmentseed.org/stac/search', params={

}, headers = headers)

print r.json()

```

`POST /stac/search`

retrieve items matching filters. Intended as the standard, full-featured query API. This method is mandatory.

> Body parameter

```json
{
  "bbox": [
    -110,
    39.5,
    -105,
    40.5
  ],
  "time": "2018-02-12T00:00:00Z/2018-03-18T12:31:12Z",
  "intersects": null,
  "query": {
    "eo:cloud_cover": {
      "lt": 50
    }
  },
  "sort": [
    {
      "field": "eo:cloud_cover",
      "direction": "desc"
    }
  ]
}
```

<h3 id="search-stac-items-by-full-featured-filtering.-parameters">Parameters</h3>

|Parameter|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[searchBody](#schemasearchbody)|false|none|

> Example responses

> 200 Response

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "CS3-20160503_132130_04",
      "bbox": [
        -122.59750209,
        37.48803556,
        -122.2880486,
        37.613537207
      ],
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -122.308150179,
              37.488035566
            ],
            [
              -122.597502109,
              37.538869539
            ],
            [
              -122.576687533,
              37.613537207
            ],
            [
              -122.2880486,
              37.562818007
            ],
            [
              -122.308150179,
              37.488035566
            ]
          ]
        ]
      },
      "properties": {
        "datetime": "2016-05-03T13:21:30.040Z"
      },
      "links": [
        {
          "rel": "self",
          "href": "http://https://sat-api.developmentseed.org/collections/landsat-8-l1/items/LC80100102015050LGN00.json"
        }
      ],
      "assets": {
        "analytic": {
          "title": "4-Band Analytic",
          "href": "http://cool-sat.com/LC80100102015050LGN00/band4.tiff",
          "type": "image/tiff"
        },
        "thumbnail": {
          "title": "Thumbnail",
          "href": "http://cool-sat.com/LC80100102015050LGN00/thumb.png",
          "type": "image/png"
        }
      }
    }
  ],
  "links": [
    {
      "rel": "next",
      "href": "http://https://sat-api.developmentseed.org/collections/landsat-8-l1/items/gasd312fsaeg"
    }
  ]
}
```

<h3 id="search-stac-items-by-full-featured-filtering.-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|A feature collection.|string|
|default|Default|An error occurred.|string|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="the-sat-api-capabilities">Capabilities</h1>

## describe the feature collections in the dataset

<a id="opIddescribeCollections"></a>

> Code samples

```nodejs
const fetch = require('node-fetch');

const headers = {
  'Accept':'application/json'

};

fetch('https://sat-api.developmentseed.org/collections',
{
  method: 'GET',

  headers: headers
})
.then(function(res) {
    return res.json();
}).then(function(body) {
    console.log(body);
});

```

```python
import requests
headers = {
  'Accept': 'application/json'
}

r = requests.get('https://sat-api.developmentseed.org/collections', params={

}, headers = headers)

print r.json()

```

`GET /collections`

> Example responses

> 200 Response

```json
{
  "links": [
    {
      "href": "http://data.example.org/collections.json",
      "rel": "self",
      "type": "application/json",
      "title": "this document"
    },
    {
      "href": "http://data.example.org/collections.html",
      "rel": "alternate",
      "type": "text/html",
      "title": "this document as HTML"
    },
    {
      "href": "http://schemas.example.org/1.0/foobar.xsd",
      "rel": "describedBy",
      "type": "application/xml",
      "title": "XML schema for Acme Corporation data"
    }
  ],
  "collections": [
    {
      "name": "buildings",
      "title": "Buildings",
      "description": "Buildings in the city of Bonn.",
      "links": [
        {
          "href": "http://data.example.org/collections/buildings/items",
          "rel": "item",
          "type": "application/geo+json",
          "title": "Buildings"
        },
        {
          "href": "http://example.org/concepts/building.html",
          "rel": "describedBy",
          "type": "text/html",
          "title": "Feature catalogue for buildings"
        }
      ],
      "extent": {
        "crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84",
        "spatial": [
          -180,
          -90,
          180,
          90
        ],
        "trs": "http://www.opengis.net/def/uom/ISO-8601/0/Gregorian",
        "temporal": [
          "2011-11-11T12:22:11Z",
          "2012-11-24T12:32:43Z"
        ]
      },
      "crs": [
        "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
      ],
      "stac_version": "0.6.0",
      "id": "buildings",
      "keywords": [
        [
          "buildings",
          "properties",
          "constructions"
        ]
      ],
      "version": 1,
      "license": "Apache-2.0",
      "providers": [
        {
          "name": "Big Building Corp",
          "description": "No further processing applied.",
          "roles": [
            "producer",
            "licensor"
          ],
          "url": "http://www.big-building.com"
        }
      ]
    }
  ]
}
```

<h3 id="describe-the-feature-collections-in-the-dataset-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Metdata about the feature collections shared by this API.|[content](#schemacontent)|

<aside class="success">
This operation does not require authentication
</aside>

# Schemas

<h2 id="tocSexception">exception</h2>

<a id="schemaexception"></a>

```json
{
  "code": "string",
  "description": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|code|string|true|none|none|
|description|string|false|none|none|

<h2 id="tocSlinks">links</h2>

<a id="schemalinks"></a>

```json
[
  {
    "href": "http://www.geoserver.example/stac/naip/child/catalog.json",
    "rel": "child",
    "type": "application/json",
    "title": "NAIP Child Catalog"
  }
]

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|*anonymous*|[[link](#schemalink)]|false|none|none|

<h2 id="tocSlink">link</h2>

<a id="schemalink"></a>

```json
{
  "href": "http://www.geoserver.example/stac/naip/child/catalog.json",
  "rel": "child",
  "type": "application/json",
  "title": "NAIP Child Catalog"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|href|string(url)|true|none|none|
|rel|string|true|none|none|
|type|string|false|none|none|
|title|string|false|none|none|

<h2 id="tocSsearchbody">searchBody</h2>

<a id="schemasearchbody"></a>

```json
{
  "bbox": [
    -110,
    39.5,
    -105,
    40.5
  ],
  "time": "2018-02-12T00:00:00Z/2018-03-18T12:31:12Z",
  "intersects": null,
  "query": {
    "eo:cloud_cover": {
      "lt": 50
    }
  },
  "sort": [
    {
      "field": "eo:cloud_cover",
      "direction": "desc"
    }
  ]
}

```

*The search criteria*

### Properties

*allOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|*anonymous*|[bboxFilter](#schemabboxfilter)|false|none|Only return items that intersect the provided bounding box.|

*and*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|*anonymous*|[timeFilter](#schematimefilter)|false|none|An object representing a time based filter.|

*and*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|*anonymous*|[intersectsFilter](#schemaintersectsfilter)|false|none|Only returns items that intersect with the provided polygon.|

*and*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|*anonymous*|[queryFilter](#schemaqueryfilter)|false|none|Allows users to query properties for specific values|

*and*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|*anonymous*|[sortFilter](#schemasortfilter)|false|none|Sort the results|

<h2 id="tocSbbox">bbox</h2>

<a id="schemabbox"></a>

```json
[
  -110,
  39.5,
  -105,
  40.5
]

```

*Only features that have a geometry that intersects the bounding box are
selected. The bounding box is provided as four or six numbers,
depending on whether the coordinate reference system includes a
vertical axis (elevation or depth):

* Lower left corner, coordinate axis 1
* Lower left corner, coordinate axis 2
* Lower left corner, coordinate axis 3 (optional)
* Upper right corner, coordinate axis 1
* Upper right corner, coordinate axis 2
* Upper right corner, coordinate axis 3 (optional)

The coordinate reference system of the values is WGS84
longitude/latitude (http://www.opengis.net/def/crs/OGC/1.3/CRS84) unless
a different coordinate reference system is specified in the parameter
`bbox-crs`.

For WGS84 longitude/latitude the values are in most cases the sequence
of minimum longitude, minimum latitude, maximum longitude and maximum
latitude. However, in cases where the box spans the antimeridian the
first value (west-most box edge) is larger than the third value
(east-most box edge).

If a feature has multiple spatial geometry properties, it is the
decision of the server whether only a single spatial geometry property
is used to determine the extent or all relevant geometries.
*

### Properties

*None*

<h2 id="tocSbboxfilter">bboxFilter</h2>

<a id="schemabboxfilter"></a>

```json
{
  "bbox": [
    -110,
    39.5,
    -105,
    40.5
  ]
}

```

*Only return items that intersect the provided bounding box.*

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|bbox|[bbox](#schemabbox)|false|none|Only features that have a geometry that intersects the bounding box are selected. The bounding box is provided as four or six numbers, depending on whether the coordinate reference system includes a vertical axis (elevation or depth):  * Lower left corner, coordinate axis 1 * Lower left corner, coordinate axis 2 * Lower left corner, coordinate axis 3 (optional) * Upper right corner, coordinate axis 1 * Upper right corner, coordinate axis 2 * Upper right corner, coordinate axis 3 (optional)  The coordinate reference system of the values is WGS84 longitude/latitude (http://www.opengis.net/def/crs/OGC/1.3/CRS84) unless a different coordinate reference system is specified in the parameter `bbox-crs`.  For WGS84 longitude/latitude the values are in most cases the sequence of minimum longitude, minimum latitude, maximum longitude and maximum latitude. However, in cases where the box spans the antimeridian the first value (west-most box edge) is larger than the third value (east-most box edge).   If a feature has multiple spatial geometry properties, it is the decision of the server whether only a single spatial geometry property is used to determine the extent or all relevant geometries.|

<h2 id="tocStimefilter">timeFilter</h2>

<a id="schematimefilter"></a>

```json
{
  "time": "2018-02-12T00:00:00Z/2018-03-18T12:31:12Z"
}

```

*An object representing a time based filter.*

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|time|[time](#schematime)|false|none|Either a date-time or a period string that adheres to RFC 3339. Examples: * A date-time: "2018-02-12T23:20:50Z" * A period: "2018-02-12T00:00:00Z/2018-03-18T12:31:12Z" or "2018-02-12T00:00:00Z/P1M6DT12H31M12S" Only features that have a temporal property that intersects the value of `time` are selected. If a feature has multiple temporal properties, it is the decision of the server whether only a single temporal property is used to determine the extent or all relevant temporal properties.|

<h2 id="tocSintersectsfilter">intersectsFilter</h2>

<a id="schemaintersectsfilter"></a>

```json
{
  "intersects": null
}

```

*Only returns items that intersect with the provided polygon.*

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|intersects|[http://geojson.org/schema/Geometry.json](#schemahttp://geojson.org/schema/geometry.json)|false|none|none|

<h2 id="tocStime">time</h2>

<a id="schematime"></a>

```json
"2018-02-12T00:00:00Z/2018-03-18T12:31:12Z"

```

*Either a date-time or a period string that adheres to RFC 3339. Examples:
* A date-time: "2018-02-12T23:20:50Z" * A period: "2018-02-12T00:00:00Z/2018-03-18T12:31:12Z" or "2018-02-12T00:00:00Z/P1M6DT12H31M12S"
Only features that have a temporal property that intersects the value of `time` are selected.
If a feature has multiple temporal properties, it is the decision of the server whether only a single temporal property is used to determine the extent or all relevant temporal properties.
*

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|*anonymous*|string|false|none|Either a date-time or a period string that adheres to RFC 3339. Examples: * A date-time: "2018-02-12T23:20:50Z" * A period: "2018-02-12T00:00:00Z/2018-03-18T12:31:12Z" or "2018-02-12T00:00:00Z/P1M6DT12H31M12S" Only features that have a temporal property that intersects the value of `time` are selected. If a feature has multiple temporal properties, it is the decision of the server whether only a single temporal property is used to determine the extent or all relevant temporal properties.|

<h2 id="tocScatalogdefinition">catalogDefinition</h2>

<a id="schemacatalogdefinition"></a>

```json
{
  "stac_version": "0.6.0",
  "id": "naip",
  "title": "NAIP Imagery",
  "description": "Catalog of NAIP Imagery.",
  "links": [
    {
      "href": "http://www.geoserver.example/stac/naip/child/catalog.json",
      "rel": "child",
      "type": "application/json",
      "title": "NAIP Child Catalog"
    }
  ]
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|stac_version|string|true|none|none|
|id|string|true|none|none|
|title|string|false|none|none|
|description|string|true|none|none|
|links|[links](#schemalinks)|true|none|none|

<h2 id="tocSitemcollection">itemCollection</h2>

<a id="schemaitemcollection"></a>

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "CS3-20160503_132130_04",
      "bbox": [
        -122.59750209,
        37.48803556,
        -122.2880486,
        37.613537207
      ],
      "geometry": {
        "type": "Polygon",
        "coordinates": [
          [
            [
              -122.308150179,
              37.488035566
            ],
            [
              -122.597502109,
              37.538869539
            ],
            [
              -122.576687533,
              37.613537207
            ],
            [
              -122.2880486,
              37.562818007
            ],
            [
              -122.308150179,
              37.488035566
            ]
          ]
        ]
      },
      "properties": {
        "datetime": "2016-05-03T13:21:30.040Z"
      },
      "links": [
        {
          "rel": "self",
          "href": "http://https://sat-api.developmentseed.org/collections/landsat-8-l1/items/LC80100102015050LGN00.json"
        }
      ],
      "assets": {
        "analytic": {
          "title": "4-Band Analytic",
          "href": "http://cool-sat.com/LC80100102015050LGN00/band4.tiff",
          "type": "image/tiff"
        },
        "thumbnail": {
          "title": "Thumbnail",
          "href": "http://cool-sat.com/LC80100102015050LGN00/thumb.png",
          "type": "image/png"
        }
      }
    }
  ],
  "links": [
    {
      "rel": "next",
      "href": "http://https://sat-api.developmentseed.org/collections/landsat-8-l1/items/gasd312fsaeg"
    }
  ]
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|type|string|true|none|none|
|features|[[item](#schemaitem)]|true|none|none|
|links|[itemCollectionLinks](#schemaitemcollectionlinks)|false|none|An array of links. Can be used for pagination, e.g. by providing a link with the `next` relation type.|

#### Enumerated Values

|Property|Value|
|---|---|
|type|FeatureCollection|

<h2 id="tocSitem">item</h2>

<a id="schemaitem"></a>

```json
{
  "type": "Feature",
  "id": "CS3-20160503_132130_04",
  "bbox": [
    -122.59750209,
    37.48803556,
    -122.2880486,
    37.613537207
  ],
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [
          -122.308150179,
          37.488035566
        ],
        [
          -122.597502109,
          37.538869539
        ],
        [
          -122.576687533,
          37.613537207
        ],
        [
          -122.2880486,
          37.562818007
        ],
        [
          -122.308150179,
          37.488035566
        ]
      ]
    ]
  },
  "properties": {
    "datetime": "2016-05-03T13:21:30.040Z"
  },
  "links": [
    {
      "rel": "self",
      "href": "http://https://sat-api.developmentseed.org/collections/landsat-8-l1/items/LC80100102015050LGN00.json"
    }
  ],
  "assets": {
    "analytic": {
      "title": "4-Band Analytic",
      "href": "http://cool-sat.com/LC80100102015050LGN00/band4.tiff",
      "type": "image/tiff"
    },
    "thumbnail": {
      "title": "Thumbnail",
      "href": "http://cool-sat.com/LC80100102015050LGN00/thumb.png",
      "type": "image/png"
    }
  }
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|id|[itemId](#schemaitemid)|true|none|Provider identifier, a unique ID, potentially a link to a file.|
|bbox|[bbox](#schemabbox)|true|none|Only features that have a geometry that intersects the bounding box are selected. The bounding box is provided as four or six numbers, depending on whether the coordinate reference system includes a vertical axis (elevation or depth):  * Lower left corner, coordinate axis 1 * Lower left corner, coordinate axis 2 * Lower left corner, coordinate axis 3 (optional) * Upper right corner, coordinate axis 1 * Upper right corner, coordinate axis 2 * Upper right corner, coordinate axis 3 (optional)  The coordinate reference system of the values is WGS84 longitude/latitude (http://www.opengis.net/def/crs/OGC/1.3/CRS84) unless a different coordinate reference system is specified in the parameter `bbox-crs`.  For WGS84 longitude/latitude the values are in most cases the sequence of minimum longitude, minimum latitude, maximum longitude and maximum latitude. However, in cases where the box spans the antimeridian the first value (west-most box edge) is larger than the third value (east-most box edge).   If a feature has multiple spatial geometry properties, it is the decision of the server whether only a single spatial geometry property is used to determine the extent or all relevant geometries.|
|geometry|[http://geojson.org/schema/Geometry.json](#schemahttp://geojson.org/schema/geometry.json)|true|none|none|
|type|[itemType](#schemaitemtype)|true|none|The GeoJSON type|
|properties|[itemProperties](#schemaitemproperties)|true|none|provides the core metatdata fields plus extensions|
|links|[links](#schemalinks)|true|none|none|
|assets|[itemAssets](#schemaitemassets)|true|none|none|

<h2 id="tocSitemid">itemId</h2>

<a id="schemaitemid"></a>

```json
"path/to/example.tif"

```

*Provider identifier, a unique ID, potentially a link to a file.*

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|*anonymous*|string|false|none|Provider identifier, a unique ID, potentially a link to a file.|

<h2 id="tocSitemtype">itemType</h2>

<a id="schemaitemtype"></a>

```json
"Feature"

```

*The GeoJSON type*

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|*anonymous*|string|false|none|The GeoJSON type|

#### Enumerated Values

|Property|Value|
|---|---|
|*anonymous*|Feature|

<h2 id="tocSitemassets">itemAssets</h2>

<a id="schemaitemassets"></a>

```json
{
  "property1": {
    "href": "http://cool-sat.com/LC80100102015050LGN00/thumb.png",
    "title": "Thumbnail",
    "type": "image/png"
  },
  "property2": {
    "href": "http://cool-sat.com/LC80100102015050LGN00/thumb.png",
    "title": "Thumbnail",
    "type": "image/png"
  }
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|**additionalProperties**|object|false|none|none|
|» href|string(url)|true|none|Link to the asset object|
|» title|string|false|none|Displayed title|
|» type|string|false|none|Media type of the asset|

<h2 id="tocSitemproperties">itemProperties</h2>

<a id="schemaitemproperties"></a>

```json
{
  "datetime": "2018-02-12T00:00:00Z/2018-03-18T12:31:12Z",
  "property1": null,
  "property2": null
}

```

*provides the core metatdata fields plus extensions*

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|**additionalProperties**|any|false|none|Any additional properties added in via extensions.|
|datetime|[time](#schematime)|true|none|Either a date-time or a period string that adheres to RFC 3339. Examples: * A date-time: "2018-02-12T23:20:50Z" * A period: "2018-02-12T00:00:00Z/2018-03-18T12:31:12Z" or "2018-02-12T00:00:00Z/P1M6DT12H31M12S" Only features that have a temporal property that intersects the value of `time` are selected. If a feature has multiple temporal properties, it is the decision of the server whether only a single temporal property is used to determine the extent or all relevant temporal properties.|

<h2 id="tocSitemcollectionlinks">itemCollectionLinks</h2>

<a id="schemaitemcollectionlinks"></a>

```json
[
  {
    "rel": "next",
    "href": "http://https://sat-api.developmentseed.org/collections/landsat-8-l1/items/gasd312fsaeg"
  }
]

```

*An array of links. Can be used for pagination, e.g. by providing a link with the `next` relation type.*

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|*anonymous*|[[link](#schemalink)]|false|none|An array of links. Can be used for pagination, e.g. by providing a link with the `next` relation type.|

<h2 id="tocSroot">root</h2>

<a id="schemaroot"></a>

```json
{
  "links": [
    {
      "href": "http://data.example.org/",
      "rel": "self",
      "type": "application/json",
      "title": "this document"
    },
    {
      "href": "http://data.example.org/api",
      "rel": "service",
      "type": "application/openapi+json;version=3.0",
      "title": "the API definition"
    },
    {
      "href": "http://data.example.org/conformance",
      "rel": "conformance",
      "type": "application/json",
      "title": "WFS 3.0 conformance classes implemented by this server"
    },
    {
      "href": "http://data.example.org/collections",
      "rel": "data",
      "type": "application/json",
      "title": "Metadata about the feature collections"
    }
  ]
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|links|[[link](#schemalink)]|true|none|none|

<h2 id="tocSreq-classes">req-classes</h2>

<a id="schemareq-classes"></a>

```json
{
  "conformsTo": [
    "http://www.opengis.net/spec/wfs-1/3.0/req/core",
    "http://www.opengis.net/spec/wfs-1/3.0/req/oas30",
    "http://www.opengis.net/spec/wfs-1/3.0/req/html",
    "http://www.opengis.net/spec/wfs-1/3.0/req/geojson"
  ]
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|conformsTo|[string]|true|none|none|

<h2 id="tocScontent">content</h2>

<a id="schemacontent"></a>

```json
{
  "links": [
    {
      "href": "http://data.example.org/collections.json",
      "rel": "self",
      "type": "application/json",
      "title": "this document"
    },
    {
      "href": "http://data.example.org/collections.html",
      "rel": "alternate",
      "type": "text/html",
      "title": "this document as HTML"
    },
    {
      "href": "http://schemas.example.org/1.0/foobar.xsd",
      "rel": "describedBy",
      "type": "application/xml",
      "title": "XML schema for Acme Corporation data"
    }
  ],
  "collections": [
    {
      "name": "buildings",
      "title": "Buildings",
      "description": "Buildings in the city of Bonn.",
      "links": [
        {
          "href": "http://data.example.org/collections/buildings/items",
          "rel": "item",
          "type": "application/geo+json",
          "title": "Buildings"
        },
        {
          "href": "http://example.org/concepts/building.html",
          "rel": "describedBy",
          "type": "text/html",
          "title": "Feature catalogue for buildings"
        }
      ],
      "extent": {
        "crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84",
        "spatial": [
          -180,
          -90,
          180,
          90
        ],
        "trs": "http://www.opengis.net/def/uom/ISO-8601/0/Gregorian",
        "temporal": [
          "2011-11-11T12:22:11Z",
          "2012-11-24T12:32:43Z"
        ]
      },
      "crs": [
        "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
      ],
      "stac_version": "0.6.0",
      "id": "buildings",
      "keywords": [
        [
          "buildings",
          "properties",
          "constructions"
        ]
      ],
      "version": 1,
      "license": "Apache-2.0",
      "providers": [
        {
          "name": "Big Building Corp",
          "description": "No further processing applied.",
          "roles": [
            "producer",
            "licensor"
          ],
          "url": "http://www.big-building.com"
        }
      ]
    }
  ]
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|links|[[link](#schemalink)]|true|none|none|
|collections|[[collectionInfo](#schemacollectioninfo)]|true|none|none|

<h2 id="tocScollectioninfo">collectionInfo</h2>

<a id="schemacollectioninfo"></a>

```json
{
  "name": "buildings",
  "title": "Buildings",
  "description": "Buildings in the city of Bonn.",
  "links": [
    {
      "href": "http://data.example.org/collections/buildings/items",
      "rel": "item",
      "type": "application/geo+json",
      "title": "Buildings"
    },
    {
      "href": "http://example.org/concepts/building.html",
      "rel": "describedBy",
      "type": "text/html",
      "title": "Feature catalogue for buildings"
    }
  ],
  "extent": {
    "crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84",
    "spatial": [
      -180,
      -90,
      180,
      90
    ],
    "trs": "http://www.opengis.net/def/uom/ISO-8601/0/Gregorian",
    "temporal": [
      "2011-11-11T12:22:11Z",
      "2012-11-24T12:32:43Z"
    ]
  },
  "crs": [
    "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
  ],
  "stac_version": "0.6.0",
  "id": "buildings",
  "keywords": [
    [
      "buildings",
      "properties",
      "constructions"
    ]
  ],
  "version": 1,
  "license": "Apache-2.0",
  "providers": [
    {
      "name": "Big Building Corp",
      "description": "No further processing applied.",
      "roles": [
        "producer",
        "licensor"
      ],
      "url": "http://www.big-building.com"
    }
  ]
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|name|string|true|none|identifier of the collection used, for example, in URIs|
|title|string|false|none|human readable title of the collection|
|description|string|true|none|a description of the features in the collection|
|links|[[link](#schemalink)]|true|none|none|
|extent|[extent](#schemaextent)|true|none|none|
|crs|[string]|false|none|The coordinate reference systems in which geometries may be retrieved. Coordinate reference systems are identified by a URI. The first coordinate reference system is the coordinate reference system that is used by default. This is always "http://www.opengis.net/def/crs/OGC/1.3/CRS84", i.e. WGS84 longitude/latitude.|
|stac_version|string|true|none|none|
|id|string|true|none|identifier of the collection used, for example, in URIs|
|keywords|[string]|false|none|none|
|version|string|false|none|none|
|license|string|true|none|none|
|providers|[any]|false|none|none|
|» name|string|false|none|none|
|» description|string|false|none|none|
|» roles|[string]|false|none|none|
|» url|string(url)|false|none|Homepage on which the provider describes the dataset and publishes contact information.|

<h2 id="tocSqueryfilter">queryFilter</h2>

<a id="schemaqueryfilter"></a>

```json
{
  "query": {
    "eo:cloud_cover": {
      "lt": 50
    }
  }
}

```

*Allows users to query properties for specific values*

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|query|[query](#schemaquery)|false|none|Define which properties to query and the operatations to apply|

<h2 id="tocSquery">query</h2>

<a id="schemaquery"></a>

```json
{
  "eo:cloud_cover": {
    "lt": 50
  }
}

```

*Define which properties to query and the operatations to apply*

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|**additionalProperties**|[queryProp](#schemaqueryprop)|false|none|Apply query operations to a specific property|

<h2 id="tocSqueryprop">queryProp</h2>

<a id="schemaqueryprop"></a>

```json
null

```

*Apply query operations to a specific property*

### Properties

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|*anonymous*|any|false|none|if the object doesn't contain any of the operators, it is equivalent to using the equals operator|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|*anonymous*|object|false|none|Match using an operator|
|» eq|any|false|none|Find items with a property that is equal to the specified value. For strings, a case-insensitive comparison must be performed.|
|» gt|number|false|none|Find items with a property value greater than the specified value.|
|» lt|number|false|none|Find items with a property value less than the specified value.|
|» gte|number|false|none|Find items with a property value greater than or equal the specified value.|
|» lte|number|false|none|Find items with a property value greater than or equal the specified value.|

<h2 id="tocSsortfilter">sortFilter</h2>

<a id="schemasortfilter"></a>

```json
{
  "sort": [
    {
      "field": "eo:cloud_cover",
      "direction": "desc"
    }
  ]
}

```

*Sort the results*

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|sort|[sort](#schemasort)|false|none|An array of objects containing a property name and sort direction.|

<h2 id="tocSsort">sort</h2>

<a id="schemasort"></a>

```json
[
  {
    "field": "eo:cloud_cover",
    "direction": "desc"
  }
]

```

*An array of objects containing a property name and sort direction.
*

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|field|string|true|none|none|
|direction|string|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|direction|asc|
|direction|desc|

<h2 id="tocSextent">extent</h2>

<a id="schemaextent"></a>

```json
{
  "crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84",
  "spatial": [
    -180,
    -90,
    180,
    90
  ],
  "trs": "http://www.opengis.net/def/uom/ISO-8601/0/Gregorian",
  "temporal": [
    "2011-11-11T12:22:11Z",
    "2012-11-24T12:32:43Z"
  ]
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|crs|string|false|none|Coordinate reference system of the coordinates in the spatial extent (property `spatial`). In the Core, only WGS84 longitude/latitude is supported. Extensions may support additional coordinate reference systems.|
|spatial|[number]|false|none|West, south, east, north edges of the spatial extent. The minimum and maximum values apply to the coordinate reference system WGS84 longitude/latitude that is supported in the Core. If, for example, a projected coordinate reference system is used, the minimum and maximum values need to be adjusted.|
|trs|string|false|none|Temporal reference system of the coordinates in the temporal extent (property `temporal`). In the Core, only the Gregorian calendar is supported. Extensions may support additional temporal reference systems.|
|temporal|[string]|false|none|Begin and end times of the temporal extent.|

#### Enumerated Values

|Property|Value|
|---|---|
|crs|http://www.opengis.net/def/crs/OGC/1.3/CRS84|
|trs|http://www.opengis.net/def/uom/ISO-8601/0/Gregorian|

