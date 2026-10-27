# Geography practice assets

Country outline and locator map tiles are generated locally from [Natural Earth](https://www.naturalearthdata.com/) Admin 0 country boundaries (public domain), via the `world-atlas` TopoJSON distribution and `world-countries` for ISO 3166-1 alpha-3 codes and native names.

- **outline** — single-country silhouette on an azimuthal equal-area projection centred on the country.
- **locator** — regional map with neighbours in grey and the target country highlighted.

Import all countries in one step:

```bash
curl -s -X POST http://127.0.0.1:3000/api/entries/import-geography \
  -H "Content-Type: application/json" \
  -d '{"subjectId":"geography"}'
```

Configure variant mix on the practice subject (`mediaVariants.enabled` / `weights`). Wikimedia import remains available for non-map images (e.g. paintings).
