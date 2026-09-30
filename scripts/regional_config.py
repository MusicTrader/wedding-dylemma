"""One projection for the expanded airport map, route overlays and place pins."""
WIDTH, HEIGHT = 3000, 1600
OVERVIEW_WIDTH, OVERVIEW_HEIGHT = 900, 700
OFFSET_X, OFFSET_Y = (WIDTH-OVERVIEW_WIDTH)/2, (HEIGHT-OVERVIEW_HEIGHT)/2
WEST = -122.50 - OFFSET_X/2250
EAST = WEST + WIDTH/2250
NORTH = 47.64 + OFFSET_Y/ (700/.21)
SOUTH = NORTH - HEIGHT/(700/.21)

def project(point):
    lon,lat=point[:2]
    return ((lon+122.50)*2250+OFFSET_X,(47.64-lat)/.21*700+OFFSET_Y)
