# Wedding Dylemma — Dylan & Emma

A standalone, responsive wedding website styled as a vintage Seattle travel invitation, with a full-width photographic hero, postcard imagery, ticket-style itinerary cards, warm paper, muted teal, navy, and static film grain. No map API key, framework, or WebGL is required.

## Guest journey

The full-width photo presents a live 3D travel pamphlet. One persistent Three.js renderer and the same meshes stay active in the hero, during unfolding, while reading, and when folding back into the hero. Panel controls move between an overview and enlarged views; focused panels support wheel/touch/arrow-key scrolling. Projected semantic buttons remain aligned with the paper and open the atlas above it. The canonical HTML supplies texture content and screen-reader text. Reduced motion uses immediate poses of the same model; unavailable WebGL falls back to the HTML invitation. Three.js 0.180.0 is vendored locally with its MIT license in `assets/vendor/THREE-LICENSE.txt`.

The main page presents the invitation, weekend schedule, hotel and arrival options, interactive map preview, and RSVP status in that order. Guests can read the essential plans without opening the atlas. The persistent navigation includes an Open map action; location and arrival buttons open the relevant stop, hotel, or route directly. Closing the dialog or pressing Escape restores focus to the originating button.

`travel.css` styles the main page using a 1.25 major-third type scale rooted at 16px. Labels and supporting copy have a 16px minimum, with fewer decorative uppercase captions; `atlas.css` styles the interactive guide. `script.js` connects the contextual `data-open-map` buttons to the shared place details. Mobile navigation stays visible without a separate menu.

## Preview

From this folder, run:

```sh
python3 -m http.server 8765
```

Then open `http://localhost:8765`.

No build step or package installation is required.

## Before using it for guests

The ceremony date and time, hotel block booking links/codes, and RSVP flow still need real details. Alexis, Hotel 1000, and Populus are mapped at their actual addresses, but the block terms are not confirmed in this mockup. Confirm guest arrival and cruise check-in instructions before launch.

The itinerary currently includes a day-before sunset cruise from 6:00–9:00 PM at Argosy Cruises Pier 55 and a wedding at AXIS Pioneer Square. Friday, Saturday, and Sunday are draft itinerary labels; confirm them when the wedding date is supplied.

## Illustrated interactive atlas

`atlas.js` handles pan, wheel/pinch zoom, keyboard controls, map pins and camera framing. `atlas.css` scopes the poster styling to the guide and its preview. The existing itinerary content and dialog controls remain in `script.js`.

- Drag to pan, scroll or pinch to zoom, or use the visible + / − controls.
- Focus the map and use arrow keys to pan, + / − to zoom, and Home to reset.
- Select a card or map badge to see stop details and directions. Sunday deliberately has no location pin until plans are confirmed.
- Hotel badge leader lines terminate at actual address coordinates. Badge letters A / B / C distinguish the nearby hotels.
- The map works with local snapshots; external links open current directions or provider information. If the coordinate manifest fails to load, the illustrated map and itinerary/direction links remain available.

The atlas covers about 47.577–47.641° N and 122.386–122.291° W: downtown, Seattle Center, Lake Union, Capitol Hill, and SODO. Full water polygons from WSDOT extend the shoreline, with the finer Seattle shoreline retained around the event piers. Camera bounds account for the entire viewport, preventing the rendered edge from appearing during pan or zoom. The initial framing still centers the wedding stops. Run `node scripts/check_atlas_bounds.cjs` to check viewport coverage at extreme pan positions and zoom levels.

To refresh the expanded street, park, and building data, run `python3 scripts/fetch_atlas_data.py`. It downloads every page, verifies feature counts and unique IDs, and records source metadata in `data/atlas-sources.json`. Rendering reads these local snapshots; guests do not download the raw GeoJSON.

Rebuild the illustration and its coordinate manifest together:

```sh
python3 scripts/build_atlas.py
```

This produces `assets/seattle-atlas.svg`, `assets/seattle-atlas-region.svg`, and `data/atlas-layout.json`. The downtown map uses a local equirectangular projection with latitude correction, north-up orientation, and equal ground scale on both axes. Pins use that **same projection**; they are not positioned with guessed percentages. Airport and downtown anchors use the regional map projection, with the airport-road origin from the saved OSRM route and the geocoded AXIS address.

The illustration uses flat building footprints from the expanded City GIS snapshot (59,024 source features; very small outlines are omitted for legibility) in the [City of Seattle Building Outlines 2015 layer](https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Building_Outline_2015/FeatureServer/0). Building outlines reflect 2015 imagery, credited to GeoTerra / City of Seattle, downloaded September 30, 2026. They may omit more recent construction. Buildings are drawn directly at their ground coordinates, with no extrusion, perspective, or simulated height. A seeded, static film-grain layer (`assets/atlas-grain.svg`) covers the guide and preview without moving when the map pans or zooms. The ferry is a decorative vignette, not a cruise position or route. Saved GIS and travel routes should be refreshed before publishing for guests.

## Seattle map data

The downtown street grid and shoreline are generated from City of Seattle GIS data rather than hand-drawn geometry. The saved GeoJSON snapshots are in `data/`; the styled SVG is `assets/seattle-map.svg`. Run `python3 scripts/build_map.py` to regenerate the SVG from those snapshots.

- [Seattle Streets, SDOT Street Network Database](https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Seattle_Streets_1/FeatureServer/0)
- [Seattle Shoreline](https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Shoreline/FeatureServer/0)
- [Seattle Parks](https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Park_Boundaries/FeatureServer/2)
- [Seattle Landmarks](https://services.arcgis.com/ZOyb2t4B0UYuYNYH/arcgis/rest/services/Landmarks/FeatureServer/0)

The map covers roughly 47.591–47.614° N and 122.360–122.317° W. These are static snapshots from September 2026; refresh them before relying on the map for live travel guidance.

Event locations are recorded in `data/event-locations.json`: [AXIS Pioneer Square, 308 1st Ave S](https://axispioneersquare.com/contact-us/) uses a score-100 point from the [City of Seattle Address Point geocoder](https://gisdata.seattle.gov/cosgis/rest/services/locators/AddressPoints/GeocodeServer); [Argosy Cruises Pier 55, 1101 Alaskan Way](https://www.argosycruises.com/contact/) uses the City's Pier 55 landmark point. The three hotel address points are in `data/hotel-locations.json` and also have score-100 City geocoder matches.

## Regional airport map

`assets/seattle-region.svg` covers a broad area around the SEA Airport–downtown corridor at approximately equal ground scale. The travel tab fills its viewport with simple coastlines, arterial roads and place labels; no buildings are drawn. Initial framing keeps both airport and downtown visible. The regional camera has the same viewport-aware pan and zoom limits as the downtown atlas. Its roads are from [King County NG9-1-1 road centerlines](https://services.arcgis.com/Ej0PsM5Aw677QF1W/ArcGIS/rest/services/SiteAddressPoints_Distribution/FeatureServer/1), its shoreline is from [WSDOT Major Shorelines](https://data.wsdot.wa.gov/ArcGIS/rest/services/Shared/MajorShorelinesData/FeatureServer/0), and the rail alignment and station points are from [Sound Transit GIS](https://rtamaps3.soundtransit.org/arcgis/rest/services/ST_Rail/MapServer). The saved source snapshots are in `data/`. Run `python3 scripts/fetch_regional_data.py` to refresh the expanded road and water snapshots. Run `python3 scripts/build_regional_map.py` followed by `python3 scripts/build_atlas.py` to rebuild the regional map, route overlays, styled atlas and coordinate manifest together. `scripts/regional_config.py` supplies one shared projection for all of these assets.

The train overlay follows Sound Transit's recorded Link alignment. The Uber and rental overlays use locally saved [OSRM](https://project-osrm.org/) driving route snapshots from SEA and the [SEA rental facility](https://www.portseattle.org/places/rental-car-facility) to AXIS. Road routes are illustrative; the site links guests to current travel information for real directions. The airport pin marks the main terminal area, and the downtown pin marks AXIS. Hotel callouts 1 and 2 have small visual offsets because their addresses are on opposite sides of the same block; their underlying coordinates are geocoded.

The $3 adult Link fare comes from [Sound Transit](https://www.soundtransit.org/ride-with-us/how-to-pay/fares); the roughly 38-minute downtown trip is from [SEA Airport](https://www.portseattle.org/page/public-transit-link-light-rail). The ~$75 daily rental average is from [KAYAK's SEA rental insights](https://www.kayak.com/Seattle-Tacoma-Intl-Airport-Car-Rentals.SEA.cap.ksp). The ~$80 Uber fare is the couple's planning estimate. Rental rates, rideshare fares, schedules, parking, and road conditions vary, so refresh these before guests travel.

The two photographs were generated for this mockup and are stored in `assets/`.
