# Searching sat-api

Now with an undersanding of how STAC items and collections work we can look at how to query data. Behind the scenes sat-api queries both collections and items to find matches, so that if you search for `eo:off_nadir=0`, it will return all of the Landsat-8 scenes even though `eo:off_nadir` doesn't appear in the `items` themselves, only in the landsat-8 collection.

Any metadata field that appears in the `items` or `collection` properties can be queried by providing those as parameters in the form of key=value as shown below.

- All scenes from August 2017:   
[https://sat-api.developmentseed.org/search/stac?datetime=2017-08](https://sat-api.developmentseed.org/search/stac?datetime=2017-08)
- Sentinel-2 collection scenes from August 2017:  
[https://sat-api.developmentseed.org/search/stac?datetime=2017-08&collection=sentinel-2](https://sat-api.developmentseed.org/search/stac?datetime=2017-08&collection=sentinel-2)
- Cloud-free Landsat-8 scenes from 2016:  
[https://sat-api.developmentseed.org/search/stac?datetime=2017&collection=landsat-8&eo:cloud_cover=0](https://sat-api.developmentseed.org/search/stac?datetime=2017&collection=landsat-8&eo:cloud_cover=0)

## Range searches

For numeric fields a range of values can be specified by providing the begin and end values separated by a slash. 

- Landsat-8 scenes from 2016 with 0-20% cloud cover:  
[https://sat-api.developmentseed.org/search/stac?datetime=2017&collection=landsat-8&eo:cloud_cover=0/20](https://sat-api.developmentseed.org/search/stac?datetime=2017&collection=landsat-8&eo:cloud_cover=0/20)
- All scenes between Dec 31 2017 and Jan 1 2018:  
[https://sat-api.developmentseed.org/search/stac?datetime=2016-12-31/2017-01-01](https://sat-api.developmentseed.org/search/stac?datetime=2016-12-31/2017-01-01)

## Geospatial searches

No search term is more important however than the a geospatial query to find data covering a specific area. The core STAC spec allows for searching by providing a bounding box, with more complex 'intersects' query to query against user provided polygons. Sat-api does not currently support the [simpler] bounding box query, but does support the 'intersects' query.

**Caveat emptor**: Due to the way sat-api does the two pronged search of collections and items, a side effect is that queries fields that are absent from both will match scenes. For example, if a typo occurs in your query like `datetme=2017-08`, then that parameter will be ignored but no warning will be issued. This problem will be fixed once we implement validators into the API.
