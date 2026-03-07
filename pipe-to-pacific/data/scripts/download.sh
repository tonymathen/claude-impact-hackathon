#!/bin/bash
DATA_DIR="$(dirname "$0")/../raw"
mkdir -p "$DATA_DIR"

echo "Downloading San Diego ocean monitoring data..."

curl -sL -o "$DATA_DIR/water_quality_2020_2029.csv" \
  "https://seshat.datasd.org/monitoring_ocean_water_quality/water_quality_2020_2029_datasd.csv"
echo "  water_quality_2020_2029.csv"

curl -sL -o "$DATA_DIR/water_quality_2011_2019.csv" \
  "https://seshat.datasd.org/monitoring_ocean_water_quality/water_quality_2011_2019_datasd.csv"
echo "  water_quality_2011_2019.csv"

curl -sL -o "$DATA_DIR/water_quality_2000_2010.csv" \
  "https://seshat.datasd.org/monitoring_ocean_water_quality/water_quality_2000_2010_datasd.csv"
echo "  water_quality_2000_2010.csv"

curl -sL -o "$DATA_DIR/stations_water_quality.csv" \
  "https://seshat.datasd.org/monitoring_ocean_water_quality/reference_stations_water_quality.csv"
echo "  stations_water_quality.csv"

curl -sL -o "$DATA_DIR/water_quality_dictionary.csv" \
  "https://seshat.datasd.org/monitoring_ocean_water_quality/water_quality_dictionary_datasd.csv"
echo "  water_quality_dictionary.csv"

curl -sL -o "$DATA_DIR/sediment_quality.csv" \
  "https://seshat.datasd.org/monitoring_ocean_sediment_quality/sediment_quality_datasd.csv"
echo "  sediment_quality.csv"

curl -sL -o "$DATA_DIR/stations_sediment.csv" \
  "https://seshat.datasd.org/monitoring_ocean_sediment_quality/reference_stations_sediment.csv"
echo "  stations_sediment.csv"

curl -sL -o "$DATA_DIR/fish_tissue.csv" \
  "https://seshat.datasd.org/monitoring_ocean_fish_tissue/fish_tissue_datasd.csv"
echo "  fish_tissue.csv"

echo "Done! Downloaded 8 files to $DATA_DIR"
