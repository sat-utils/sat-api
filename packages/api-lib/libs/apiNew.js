const parsePath = function (path) {
  const searchFilters = {
    stac: false,
    collections: false,
    search: false,
    collectionId: false,
    items: false,
    itemId: false
  }
  const stac = 'stac'
  const collections = 'collections'
  const search = 'search'
  const items = 'items'

  const pathComponents = path.split('/').filter((x) => x)
  const { length } = pathComponents
  searchFilters.stac = pathComponents[0] === stac
  searchFilters.collections = pathComponents[0] === collections
  searchFilters.collectionId =
    pathComponents[0] === collections && length >= 2 ? pathComponents[1] : false
  searchFilters.search = pathComponents[1] === search
  searchFilters.items = pathComponents[2] === items
  searchFilters.itemId =
    pathComponents[2] === items && length === 4 ? pathComponents[3] : false
  return searchFilters
}

const search = async function (params, backend) {
  try {
    const response = await backend.search(params, null, 1, 1000)
    return response.results
  } catch (error) {
    console.log(error)
  }
}

module.exports = {
  search,
  parsePath
}
