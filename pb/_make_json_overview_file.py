from tqdm import *
from pabutools.election import parse_pabulib
import os
import json

this_folder = os.path.dirname(os.path.abspath(__file__))

files = {}

pb_files = [pb_file for pb_file in os.listdir(f"{this_folder}") if pb_file.endswith(".pb")]
pb_files.sort(reverse=True)

for pb_file in tqdm(pb_files):
    instance, profile = parse_pabulib(f"{this_folder}/{pb_file}")
    budget = float(instance.meta["budget"])
    num_voters = len(profile)
    num_projects = int(instance.meta["num_projects"])
    country = instance.meta["country"]
    unit = instance.meta["unit"]
    description = instance.meta["description"]
    if country not in files:
        files[country] = {}
    if unit not in files[country]:
        files[country][unit] = []
    files[country][unit].append({
        "num_voters": num_voters,
        "num_projects": num_projects,
        "description": description,
        "filename": pb_file
    })

with open(f"{this_folder}/_pabulib.json", "w") as f:
    json.dump(files, f, indent=4)

    