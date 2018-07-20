# What is STAC?

## SpatioTemporal Asset Catalog (STAC) compliant

A STAC is made up of `items`, which is data for a specific time and place. An `item` may contain multiple files (e.g., bands, quality data), but covers an identical geographical footprint for specific date and time. There are only a few so it is worth listing what the core fields are:

- `id`: A unique ID assigned by the data provider for this item.
- `geometry`: Polygon geojson geometry describing the area covered by the data
- `datetime`: The date and time of the item
- `provider`: Although an optional field, this is the name of the person or organization providing the data.
- `license`: The name of the license regarding data use.
- `assets`: This contains the individual resources that are accessed via a URI. Typically a web URL, this could also be a location on s3 of Google
- `links`: links are not the actual data, but any weblinks associated with the data. A 'self' link is required.

#### STAC extensions

The STAC specification is designed to be extended for different types of geospatial data, each of which may have different set of important metadata fields. LiDAR, Video, Mosaics, and Earth Observation imagery are all different types of data that could may eventually have their own extension.

The most common and immediate use case is what we call Earth Observeration data. This refers to raster imagery taken from a sensor at discreate date and time with multiple bands from the visible through long wave infrared. This may commonly be called a granule, or a scene, but in STAC it is referred to as an `item`.

Rather then get into the specifics of the EO spec, which can be found in the [stac-spec GitHub repository](https://github.com/radiantearth/stac-spec/blob/master/extensions/stac-eo-spec.md) I will instead use examples from sat-api.

